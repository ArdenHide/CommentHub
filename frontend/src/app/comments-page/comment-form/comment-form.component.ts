import { Component, ElementRef, OnDestroy, computed, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { environment } from '../../../environments/environment';
import { CommentsService } from '../comments.service';
import { CommentIdentity, CommentIdentityStore } from '../comment-identity.store';
import { mapNewComment } from '../comment-node.mapper';
import { AddCommentInput, UserErrorDto } from '../graphql/add-comment.mutation';
import { AttachmentUploadResultDto, AttachmentUploadService } from '../attachment-upload.service';

type FieldName = 'email' | 'userName' | 'homePage' | 'text' | 'captchaCode';
type AttachmentStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

const MAX_IMAGE_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_BYTES = 100 * 1024;
const ATTACHMENT_EXTENSION_PATTERN = /\.(jpe?g|gif|png|txt)$/i;
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|gif|png)$/i;

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
export class CommentFormComponent implements OnDestroy {
  private readonly modalRef = inject(MdbModalRef<CommentFormComponent>);
  private readonly commentsService = inject(CommentsService);
  private readonly identityStore = inject(CommentIdentityStore);
  private readonly attachmentUploadService = inject(AttachmentUploadService);

  parentId: number | null = null;
  parentAuthorName: string | null = null;

  readonly textArea = viewChild<ElementRef<HTMLTextAreaElement>>('textArea');

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly matchedIdentity = signal<CommentIdentity | null>(null);
  readonly linkPromptOpen = signal(false);
  readonly linkHref = signal('');
  readonly linkTitle = signal('');
  readonly captchaId = signal(crypto.randomUUID());
  readonly captchaImageUrl = computed(() => `${environment.apiBaseUrl}/captcha/${this.captchaId()}`);

  readonly attachmentStatus = signal<AttachmentStatus>('idle');
  readonly attachmentError = signal<string | null>(null);
  readonly attachmentToken = signal<string | null>(null);
  readonly attachmentPreview = signal<AttachmentUploadResultDto | null>(null);
  readonly attachmentLocalUrl = signal<string | null>(null);

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
    captchaCode: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
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
    this.clearAttachment();
    this.modalRef.close();
  }

  refreshCaptcha(): void {
    this.captchaId.set(crypto.randomUUID());
    this.form.controls.captchaCode.setValue('');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    input.value = '';
    if (!file) {
      return;
    }

    this.clearAttachment();

    if (!ATTACHMENT_EXTENSION_PATTERN.test(file.name)) {
      this.attachmentStatus.set('error');
      this.attachmentError.set('Only JPG, GIF, PNG images or TXT files are allowed.');
      return;
    }

    const isImage = IMAGE_EXTENSION_PATTERN.test(file.name);
    const maxBytes = isImage ? MAX_IMAGE_SOURCE_BYTES : MAX_TEXT_BYTES;
    if (file.size > maxBytes) {
      this.attachmentStatus.set('error');
      this.attachmentError.set(`The file must be at most ${Math.round(maxBytes / 1024)} KB.`);
      return;
    }

    this.attachmentLocalUrl.set(isImage ? URL.createObjectURL(file) : null);
    this.attachmentStatus.set('uploading');

    this.attachmentUploadService.upload(file).subscribe({
      next: (result) => {
        this.attachmentStatus.set('uploaded');
        this.attachmentToken.set(result.token);
        this.attachmentPreview.set(result);
      },
      error: () => {
        this.attachmentStatus.set('error');
        this.attachmentError.set('Failed to upload the file. Please try again.');
      },
    });
  }

  removeAttachment(): void {
    this.clearAttachment();
  }

  ngOnDestroy(): void {
    this.revokeLocalUrl();
  }

  submit(): void {
    if (this.form.invalid || this.attachmentStatus() === 'uploading') {
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
      captchaId: this.captchaId(),
      captchaCode: raw.captchaCode,
      attachmentToken: this.attachmentToken(),
    };

    this.commentsService.addComment(input).subscribe({
      next: (payload) => {
        this.submitting.set(false);
        this.refreshCaptcha();

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
        this.refreshCaptcha();
        this.formError.set('Failed to submit your comment. Please try again.');
      },
    });
  }

  private clearAttachment(): void {
    const token = this.attachmentToken();
    if (token) {
      this.attachmentUploadService.cancel(token).subscribe({ error: () => {} });
    }

    this.revokeLocalUrl();
    this.attachmentStatus.set('idle');
    this.attachmentError.set(null);
    this.attachmentToken.set(null);
    this.attachmentPreview.set(null);
    this.attachmentLocalUrl.set(null);
  }

  private revokeLocalUrl(): void {
    const url = this.attachmentLocalUrl();
    if (url) {
      URL.revokeObjectURL(url);
    }
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
        err.field === 'text' ||
        err.field === 'captchaCode'
      ) {
        this.form.controls[err.field].setErrors({ server: err.message });
      } else {
        this.formError.set(err.message);
      }
    }
  }
}
