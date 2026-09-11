import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentsService } from '../comments.service';
import { CommentIdentity, CommentIdentityStore } from '../comment-identity.store';
import { mapNewComment } from '../comment-node.mapper';
import { AddCommentInput, UserErrorDto } from '../graphql/add-comment.mutation';

type FieldName = 'email' | 'userName' | 'homePage' | 'text';

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function escapeContent(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeCodeBlocks(text: string): string {
  return text.replace(/<code>([\s\S]*?)<\/code>/g, (_match, inner: string) => {
    return `<code>${escapeContent(inner)}</code>`;
  });
}

@Component({
  imports: [ReactiveFormsModule, MdbRippleModule],
  selector: 'app-comment-form',
  styleUrl: './comment-form.component.scss',
  templateUrl: './comment-form.component.html',
})
export class CommentFormComponent {
  private readonly modalRef = inject(MdbModalRef<CommentFormComponent>);
  private readonly commentsService = inject(CommentsService);
  private readonly identityStore = inject(CommentIdentityStore);

  parentId: number | null = null;
  parentAuthorName: string | null = null;

  readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('textArea');

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly matchedIdentity = signal<CommentIdentity | null>(null);
  readonly linkPromptOpen = signal(false);
  readonly linkHref = signal('');
  readonly linkTitle = signal('');

  readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
    userName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/^[A-Za-z0-9]+$/),
        Validators.maxLength(64),
      ],
    }),
    homePage: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^https?:\/\/\S+$/i), Validators.maxLength(2048)],
    }),
    text: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    this.form.controls.email.valueChanges
      .pipe(
        map((value) => value.trim()),
        debounceTime(350),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((email) => this.applyIdentityLookup(email));
  }

  isInvalid(name: FieldName): boolean {
    const control = this.form.controls[name];
    return control.invalid && (control.dirty || control.touched);
  }

  errorMessage(name: FieldName): string {
    const errors = this.form.controls[name].errors;
    if (!errors) {
      return '';
    }
    if (errors['server']) {
      return errors['server'];
    }
    if (errors['required']) {
      return 'This field is required.';
    }
    if (errors['email']) {
      return 'Enter a valid email address.';
    }
    if (errors['pattern']) {
      return name === 'userName'
        ? 'Only latin letters and digits are allowed, no spaces.'
        : 'Enter an absolute http:// or https:// URL.';
    }
    if (errors['maxlength']) {
      return `Too long (max ${errors['maxlength'].requiredLength} characters).`;
    }
    return 'Invalid value.';
  }

  wrapSelection(
    before: string,
    after: string,
    escapeSelection = false,
    fallbackIfEmpty = '',
  ): void {
    const el = this.textArea()?.nativeElement;
    if (!el) {
      return;
    }

    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    const value = this.form.controls.text.value;
    const rawSelected = value.slice(start, end) || fallbackIfEmpty;
    const selected = escapeSelection ? escapeContent(rawSelected) : rawSelected;
    const next = value.slice(0, start) + before + selected + after + value.slice(end);

    this.form.controls.text.setValue(next);
    this.form.controls.text.markAsDirty();

    queueMicrotask(() => {
      el.focus();
      el.selectionStart = start + before.length;
      el.selectionEnd = start + before.length + selected.length;
    });
  }

  toggleLinkPrompt(): void {
    this.linkPromptOpen.update((open) => !open);
  }

  insertLink(): void {
    const href = this.linkHref().trim();
    if (!href) {
      return;
    }

    const title = this.linkTitle().trim();
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    this.wrapSelection(`<a href="${escapeAttr(href)}"${titleAttr}>`, '</a>', true, title || href);

    this.linkPromptOpen.set(false);
    this.linkHref.set('');
    this.linkTitle.set('');
  }

  cancel(): void {
    this.modalRef.close();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.formError.set(null);

    const raw = this.form.getRawValue();
    const input: AddCommentInput = {
      userName: raw.userName,
      email: raw.email,
      homePage: raw.homePage ? raw.homePage : null,
      text: escapeCodeBlocks(raw.text),
      parentId: this.parentId,
    };

    this.commentsService.addComment(input).subscribe({
      next: (payload) => {
        this.submitting.set(false);

        if (payload.errors.length > 0) {
          this.applyServerErrors(payload.errors);
          return;
        }
        if (!payload.comment) {
          this.formError.set('Something went wrong. Please try again.');
          return;
        }

        this.identityStore.remember(
          raw.email,
          payload.comment.user.userName,
          payload.comment.user.homePage,
        );
        this.modalRef.close(mapNewComment(payload.comment));
      },
      error: () => {
        this.submitting.set(false);
        this.formError.set('Failed to submit your comment. Please try again.');
      },
    });
  }

  private applyIdentityLookup(email: string): void {
    const identity = email ? this.identityStore.lookup(email) : null;
    const previouslyMatched = this.matchedIdentity() !== null;
    this.matchedIdentity.set(identity);

    if (identity) {
      this.form.controls.userName.setValue(identity.userName);
      this.form.controls.homePage.setValue(identity.homePage ?? '');
      this.form.controls.userName.disable();
      this.form.controls.homePage.disable();
      return;
    }

    this.form.controls.userName.enable();
    this.form.controls.homePage.enable();
    if (previouslyMatched) {
      this.form.controls.userName.setValue('');
      this.form.controls.homePage.setValue('');
    }
  }

  private applyServerErrors(errors: UserErrorDto[]): void {
    this.formError.set(null);
    for (const err of errors) {
      if (
        err.field === 'userName' ||
        err.field === 'email' ||
        err.field === 'homePage' ||
        err.field === 'text'
      ) {
        this.form.controls[err.field].setErrors({ server: err.message });
      } else {
        this.formError.set(err.message);
      }
    }
  }
}
