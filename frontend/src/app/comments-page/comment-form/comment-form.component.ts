import { Component, OnDestroy, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, map } from 'rxjs';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { QuillEditorComponent, QuillModules } from 'ngx-quill';
import type Quill from 'quill';
import { environment } from '../../../environments/environment';
import { CommentsService } from '../comments.service';
import { CommentIdentity, CommentIdentityStore } from '../comment-identity.store';
import { mapNewComment } from '../comment-node.mapper';
import { AddCommentInput, UserErrorDto } from '../graphql/add-comment.mutation';
import { AttachmentUploadResultDto, AttachmentUploadService } from '../attachment-upload.service';
import { normalizeQuillHtml } from './comment-editor.util';

type FieldName = 'email' | 'userName' | 'homePage' | 'text' | 'captchaCode';
type AttachmentStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

const MAX_IMAGE_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_TEXT_BYTES = 100 * 1024;
const ATTACHMENT_EXTENSION_PATTERN = /\.(jpe?g|gif|png|txt)$/i;
const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|gif|png)$/i;

function generateUuid(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

@Component({
  imports: [ReactiveFormsModule, MdbRippleModule, QuillEditorComponent],
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

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly matchedIdentity = signal<CommentIdentity | null>(null);
  readonly linkPromptOpen = signal(false);
  readonly linkHref = signal('');
  readonly linkText = signal('');
  readonly captchaId = signal(generateUuid());
  readonly captchaImageUrl = computed(
    () => `${environment.apiBaseUrl}/captcha/${this.captchaId()}`,
  );

  readonly attachmentStatus = signal<AttachmentStatus>('idle');
  readonly attachmentError = signal<string | null>(null);
  readonly attachmentToken = signal<string | null>(null);
  readonly attachmentPreview = signal<AttachmentUploadResultDto | null>(null);
  readonly attachmentLocalUrl = signal<string | null>(null);

  readonly quillFormats = ['bold', 'italic', 'link', 'code'];
  readonly quillModules: QuillModules = {
    toolbar: {
      container: [['bold', 'italic', 'code', 'link']],
      handlers: { link: () => this.openLinkPrompt() },
    },
  };

  private quillEditor: Quill | null = null;
  private savedLinkRange: { index: number; length: number } | null = null;

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

  onQuillEditorCreated(editor: Quill): void {
    this.quillEditor = editor;
  }

  onEditorBlur(): void {
    this.form.controls.text.markAsTouched();
  }

  openLinkPrompt(): void {
    const editor = this.quillEditor;
    if (!editor) {
      return;
    }

    const range = editor.getSelection() ?? { index: editor.getLength(), length: 0 };
    this.savedLinkRange = range;
    this.linkText.set(range.length > 0 ? editor.getText(range.index, range.length) : '');
    this.linkHref.set('');
    this.linkPromptOpen.set(true);
  }

  insertLink(): void {
    const editor = this.quillEditor;
    const range = this.savedLinkRange;
    const href = this.linkHref().trim();
    if (!editor || !range || !href) {
      this.closeLinkPrompt();
      return;
    }

    const text = this.linkText().trim() || href;
    editor.deleteText(range.index, range.length, 'user');
    editor.insertText(range.index, text, { link: href }, 'user');
    editor.setSelection(range.index + text.length, 0, 'user');

    this.form.controls.text.markAsDirty();
    this.closeLinkPrompt();
    editor.focus();
  }

  private closeLinkPrompt(): void {
    this.savedLinkRange = null;
    this.linkPromptOpen.set(false);
    this.linkHref.set('');
    this.linkText.set('');
  }

  cancel(): void {
    this.clearAttachment();
    this.modalRef.close();
  }

  refreshCaptcha(): void {
    this.captchaId.set(generateUuid());
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
      text: normalizeQuillHtml(raw.text),
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
