import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { CommentFormComponent } from './comment-form.component';
import { CommentsService } from '../comments.service';
import { CommentIdentityStore } from '../comment-identity.store';
import { AttachmentUploadResultDto, AttachmentUploadService } from '../attachment-upload.service';
import { AddCommentPayloadDto } from '../graphql/add-comment.mutation';

function successPayload(overrides?: Partial<AddCommentPayloadDto>): AddCommentPayloadDto {
  return {
    comment: {
      id: 1,
      textHtml: '<strong>hi</strong>',
      createdAt: '2026-09-11T10:00:00Z',
      user: {
        userName: 'alice',
        homePage: null,
        avatarSeed: 'seed',
        maskedEmail: 'a***@example.com',
      },
      attachment: null,
    },
    errors: [],
    ...overrides,
  };
}

function uploadResult(overrides?: Partial<AttachmentUploadResultDto>): AttachmentUploadResultDto {
  return {
    token: 'token-1',
    kind: 'TEXT',
    originalName: 'notes.txt',
    contentType: 'text/plain',
    sizeBytes: 5,
    width: null,
    height: null,
    previewUrl: '/attachments/pending/token-1',
    ...overrides,
  };
}

function makeFile(name: string, sizeBytes: number, content = 'hello'): File {
  const file = new File([content], name);
  Object.defineProperty(file, 'size', { value: sizeBytes });
  return file;
}

describe('CommentFormComponent', () => {
  let component: CommentFormComponent;
  let fixture: ComponentFixture<CommentFormComponent>;
  let modalRef: { close: ReturnType<typeof vi.fn> };
  let commentsService: { addComment: ReturnType<typeof vi.fn> };
  let identityStore: { lookup: ReturnType<typeof vi.fn>; remember: ReturnType<typeof vi.fn> };
  let attachmentUploadService: {
    upload: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };

  async function createComponent(): Promise<void> {
    modalRef = { close: vi.fn() };
    commentsService = { addComment: vi.fn() };
    identityStore = { lookup: vi.fn(() => null), remember: vi.fn() };
    attachmentUploadService = { upload: vi.fn(), cancel: vi.fn(() => of(undefined)) };

    await TestBed.configureTestingModule({
      imports: [CommentFormComponent],
      providers: [
        { provide: MdbModalRef, useValue: modalRef },
        { provide: CommentsService, useValue: commentsService },
        { provide: CommentIdentityStore, useValue: identityStore },
        { provide: AttachmentUploadService, useValue: attachmentUploadService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentFormComponent);
    component = fixture.componentInstance;
  }

  function setValid(): void {
    component.form.controls.email.setValue('alice@example.com');
    component.form.controls.userName.setValue('alice');
    component.form.controls.text.setValue('hello');
    component.form.controls.captchaCode.setValue('valid-code');
  }

  function selectFile(file: File): void {
    const input = { files: [file], value: '' } as unknown as HTMLInputElement;
    component.onFileSelected({ target: input } as unknown as Event);
  }

  function editor(): HTMLElement {
    return fixture.nativeElement.querySelector('#cf-text');
  }

  function selectRange(
    startNode: Node,
    startOffset: number,
    endNode: Node,
    endOffset: number,
  ): void {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function selectAll(node: Node): void {
    const range = document.createRange();
    range.selectNodeContents(node);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function collapseCaretAtEnd(node: Node): void {
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    const selection = window.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
  }

  beforeEach(async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await createComponent();
  });

  afterEach(() => {
    fixture.destroy();
  });

  it('shows a "New comment" title when parentId is null', () => {
    component.parentId = null;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.modal-title').textContent.trim()).toBe(
      'New comment',
    );
  });

  it('shows a "Reply to <name>" title when replying', () => {
    component.parentId = 5;
    component.parentAuthorName = 'Bob';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.modal-title').textContent.trim()).toBe(
      'Reply to Bob',
    );
  });

  it('blocks submit and marks fields as touched when required fields are empty', () => {
    fixture.detectChanges();

    component.submit();

    expect(commentsService.addComment).not.toHaveBeenCalled();
    expect(component.form.controls.email.touched).toBe(true);
    expect(component.form.controls.userName.touched).toBe(true);
    expect(component.form.controls.text.touched).toBe(true);
    expect(component.form.controls.captchaCode.touched).toBe(true);
  });

  it('blocks submit when the captcha code is empty, even with otherwise valid fields', () => {
    fixture.detectChanges();
    component.form.controls.email.setValue('alice@example.com');
    component.form.controls.userName.setValue('alice');
    component.form.controls.text.setValue('hello');

    component.submit();

    expect(commentsService.addComment).not.toHaveBeenCalled();
  });

  it('rejects a userName containing spaces or non-latin characters', () => {
    fixture.detectChanges();

    component.form.controls.userName.setValue('john doe');
    expect(component.form.controls.userName.hasError('pattern')).toBe(true);

    component.form.controls.userName.setValue('john');
    expect(component.form.controls.userName.hasError('pattern')).toBe(false);
  });

  it('auto-fills and disables userName/homePage when the email matches a saved identity', () => {
    vi.useFakeTimers();
    identityStore.lookup.mockReturnValue({ userName: 'bob', homePage: 'https://bob.dev' });
    fixture.detectChanges();

    component.form.controls.email.setValue('bob@example.com');
    vi.advanceTimersByTime(350);

    expect(component.form.controls.userName.value).toBe('bob');
    expect(component.form.controls.homePage.value).toBe('https://bob.dev');
    expect(component.form.controls.userName.disabled).toBe(true);
    expect(component.form.controls.homePage.disabled).toBe(true);
    vi.useRealTimers();
  });

  it('keeps userName/homePage editable and empty when the email has no saved identity', () => {
    vi.useFakeTimers();
    identityStore.lookup.mockReturnValue(null);
    fixture.detectChanges();

    component.form.controls.email.setValue('new@example.com');
    vi.advanceTimersByTime(350);

    expect(component.form.controls.userName.disabled).toBe(false);
    expect(component.form.controls.homePage.disabled).toBe(false);
    vi.useRealTimers();
  });

  it('re-enables and clears userName/homePage when switching from a matched email to an unmatched one', () => {
    vi.useFakeTimers();
    identityStore.lookup
      .mockReturnValueOnce({ userName: 'bob', homePage: null })
      .mockReturnValueOnce(null);
    fixture.detectChanges();

    component.form.controls.email.setValue('bob@example.com');
    vi.advanceTimersByTime(350);

    component.form.controls.email.setValue('someone-else@example.com');
    vi.advanceTimersByTime(350);

    expect(component.form.controls.userName.disabled).toBe(false);
    expect(component.form.controls.userName.value).toBe('');
    expect(component.form.controls.homePage.value).toBe('');
    vi.useRealTimers();
  });

  it('wraps the selected text in <strong> in place when clicking Bold', () => {
    fixture.detectChanges();
    editor().textContent = 'hello world';
    const text = editor().firstChild!;

    selectRange(text, 0, text, 5);
    component.toggleFormat('bold');
    fixture.detectChanges();

    expect(editor().innerHTML).toBe('<strong>hello</strong> world');
    expect(component.form.controls.text.value).toBe('<strong>hello</strong> world');
  });

  it('removes bold formatting when Bold is clicked again on an already-bold selection', () => {
    fixture.detectChanges();
    editor().innerHTML = '<strong>hello</strong> world';
    selectAll(editor().querySelector('strong')!);

    component.toggleFormat('bold');
    fixture.detectChanges();

    expect(editor().innerHTML).toBe('hello world');
    expect(component.form.controls.text.value).toBe('hello world');
  });

  it('inserts a link tag from the link toolbar mini-form', () => {
    fixture.detectChanges();
    editor().textContent = 'click here';
    const text = editor().firstChild!;
    selectRange(text, 0, text, 10);

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.linkTitle.set('Example');
    component.insertLink();
    fixture.detectChanges();

    expect(editor().innerHTML).toBe('<a href="https://example.com" title="Example">click here</a>');
    expect(component.form.controls.text.value).toBe(
      '<a href="https://example.com" title="Example">click here</a>',
    );
    expect(component.linkPromptOpen()).toBe(false);
  });

  it('escapes &, < and > in the selection when wrapping it in <code>', () => {
    fixture.detectChanges();
    const snippet = 'if (a < b) { return a & b; }';
    editor().textContent = snippet;
    selectAll(editor());

    component.toggleFormat('code');
    fixture.detectChanges();

    expect(component.form.controls.text.value).toBe(
      '<code>if (a &lt; b) { return a &amp; b; }</code>',
    );
  });

  it('escapes &, < and > in the selection when inserting a link', () => {
    fixture.detectChanges();
    const snippet = 'a < b';
    editor().textContent = snippet;
    selectAll(editor());

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.insertLink();
    fixture.detectChanges();

    expect(component.form.controls.text.value).toBe('<a href="https://example.com">a &lt; b</a>');
  });

  it('falls back to the title as link text when nothing is selected', () => {
    fixture.detectChanges();
    editor().textContent = 'Check this out: ';
    collapseCaretAtEnd(editor());

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.linkTitle.set('CommentHub');
    component.insertLink();
    fixture.detectChanges();

    expect(component.form.controls.text.value).toBe(
      'Check this out: <a href="https://example.com" title="CommentHub">CommentHub</a>',
    );
  });

  it('falls back to the href as link text when nothing is selected and no title was given, instead of an empty <a>', () => {
    fixture.detectChanges();
    editor().textContent = 'Check this out: ';
    collapseCaretAtEnd(editor());

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.insertLink();
    fixture.detectChanges();

    expect(component.form.controls.text.value).toBe(
      'Check this out: <a href="https://example.com">https://example.com</a>',
    );
  });

  it('submits, remembers the server-returned identity and closes the modal on success', () => {
    fixture.detectChanges();
    setValid();
    const captchaId = component.captchaId();

    commentsService.addComment.mockReturnValue(of(successPayload()));

    component.submit();

    expect(commentsService.addComment).toHaveBeenCalledWith({
      userName: 'alice',
      email: 'alice@example.com',
      homePage: null,
      text: 'hello',
      parentId: null,
      captchaId,
      captchaCode: 'valid-code',
      attachmentToken: null,
    });
    expect(identityStore.remember).toHaveBeenCalledWith('alice@example.com', 'alice', null);
    expect(modalRef.close).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, authorName: 'alice', repliesKnown: true }),
    );
    expect(component.submitting()).toBe(false);
  });

  it('refreshes the captcha (new id, cleared code) after every submit attempt', () => {
    fixture.detectChanges();
    setValid();
    const captchaIdBeforeSubmit = component.captchaId();

    commentsService.addComment.mockReturnValue(of(successPayload()));
    component.submit();

    expect(component.captchaId()).not.toBe(captchaIdBeforeSubmit);
    expect(component.form.controls.captchaCode.value).toBe('');
  });

  it('shows server field errors under the matching control without closing the modal', () => {
    fixture.detectChanges();
    setValid();

    commentsService.addComment.mockReturnValue(
      of(
        successPayload({
          comment: null,
          errors: [{ field: 'userName', code: 'VALIDATION_ERROR', message: 'Bad name' }],
        }),
      ),
    );

    component.submit();

    expect(component.form.controls.userName.errors).toEqual({ server: 'Bad name' });
    expect(modalRef.close).not.toHaveBeenCalled();
  });

  it('shows unmapped server errors (e.g. parentId NOT_FOUND) as a form-level alert', () => {
    fixture.detectChanges();
    setValid();

    commentsService.addComment.mockReturnValue(
      of(
        successPayload({
          comment: null,
          errors: [
            { field: 'parentId', code: 'NOT_FOUND', message: 'Comment 999 does not exist.' },
          ],
        }),
      ),
    );

    component.submit();

    expect(component.formError()).toBe('Comment 999 does not exist.');
    expect(modalRef.close).not.toHaveBeenCalled();
  });

  it('shows a generic error and resets submitting on network failure', () => {
    fixture.detectChanges();
    setValid();

    commentsService.addComment.mockReturnValue(throwError(() => new Error('network')));

    component.submit();

    expect(component.formError()).toBeTruthy();
    expect(component.submitting()).toBe(false);
    expect(modalRef.close).not.toHaveBeenCalled();
  });

  it('closes the modal without a result when cancelled', () => {
    fixture.detectChanges();

    component.cancel();

    expect(modalRef.close).toHaveBeenCalledWith();
  });

  it('uploads a valid text file and marks the attachment as uploaded', () => {
    fixture.detectChanges();
    attachmentUploadService.upload.mockReturnValue(of(uploadResult()));

    selectFile(makeFile('notes.txt', 5));

    expect(attachmentUploadService.upload).toHaveBeenCalled();
    expect(component.attachmentStatus()).toBe('uploaded');
    expect(component.attachmentToken()).toBe('token-1');
  });

  it('rejects a file with a disallowed extension without contacting the server', () => {
    fixture.detectChanges();

    selectFile(makeFile('malware.exe', 10));

    expect(attachmentUploadService.upload).not.toHaveBeenCalled();
    expect(component.attachmentStatus()).toBe('error');
  });

  it('rejects a text file over 100 KB without contacting the server', () => {
    fixture.detectChanges();

    selectFile(makeFile('big.txt', 100 * 1024 + 1));

    expect(attachmentUploadService.upload).not.toHaveBeenCalled();
    expect(component.attachmentStatus()).toBe('error');
  });

  it('shows an error when the upload request fails', () => {
    fixture.detectChanges();
    attachmentUploadService.upload.mockReturnValue(throwError(() => new Error('network')));

    selectFile(makeFile('notes.txt', 5));

    expect(component.attachmentStatus()).toBe('error');
    expect(component.attachmentError()).toBeTruthy();
  });

  it('blocks submission while the attachment is still uploading', () => {
    fixture.detectChanges();
    setValid();
    attachmentUploadService.upload.mockReturnValue(new Subject());

    selectFile(makeFile('notes.txt', 5));
    expect(component.attachmentStatus()).toBe('uploading');

    component.submit();

    expect(commentsService.addComment).not.toHaveBeenCalled();
  });

  it('includes the uploaded attachment token when submitting', () => {
    fixture.detectChanges();
    setValid();
    attachmentUploadService.upload.mockReturnValue(of(uploadResult()));
    selectFile(makeFile('notes.txt', 5));

    commentsService.addComment.mockReturnValue(of(successPayload()));
    component.submit();

    expect(commentsService.addComment).toHaveBeenCalledWith(
      expect.objectContaining({ attachmentToken: 'token-1' }),
    );
  });

  it('keeps the uploaded attachment after a server-rejected submission attempt', () => {
    fixture.detectChanges();
    setValid();
    attachmentUploadService.upload.mockReturnValue(of(uploadResult()));
    selectFile(makeFile('notes.txt', 5));

    commentsService.addComment.mockReturnValue(
      of(
        successPayload({
          comment: null,
          errors: [{ field: 'captchaCode', code: 'CAPTCHA_INVALID', message: 'Wrong code' }],
        }),
      ),
    );
    component.submit();

    expect(component.attachmentToken()).toBe('token-1');
    expect(component.attachmentStatus()).toBe('uploaded');
    expect(attachmentUploadService.cancel).not.toHaveBeenCalled();
  });

  it('keeps the uploaded attachment after a network failure on submit', () => {
    fixture.detectChanges();
    setValid();
    attachmentUploadService.upload.mockReturnValue(of(uploadResult()));
    selectFile(makeFile('notes.txt', 5));

    commentsService.addComment.mockReturnValue(throwError(() => new Error('network')));
    component.submit();

    expect(component.attachmentToken()).toBe('token-1');
    expect(component.attachmentStatus()).toBe('uploaded');
  });

  it('removeAttachment cancels the uploaded pending token and resets the state', () => {
    fixture.detectChanges();
    attachmentUploadService.upload.mockReturnValue(of(uploadResult()));
    selectFile(makeFile('notes.txt', 5));

    component.removeAttachment();

    expect(attachmentUploadService.cancel).toHaveBeenCalledWith('token-1');
    expect(component.attachmentToken()).toBeNull();
    expect(component.attachmentStatus()).toBe('idle');
  });

  it('cancels an uploaded attachment when the form itself is cancelled', () => {
    fixture.detectChanges();
    attachmentUploadService.upload.mockReturnValue(of(uploadResult()));
    selectFile(makeFile('notes.txt', 5));

    component.cancel();

    expect(attachmentUploadService.cancel).toHaveBeenCalledWith('token-1');
  });

  it('does not call the upload service to cancel when nothing was ever attached', () => {
    fixture.detectChanges();

    component.cancel();

    expect(attachmentUploadService.cancel).not.toHaveBeenCalled();
  });

  it('formats subsequently typed text as bold after clicking Bold with no selection (typing mode)', () => {
    fixture.detectChanges();
    editor().textContent = 'hello ';
    collapseCaretAtEnd(editor());

    component.toggleFormat('bold');
    fixture.detectChanges();

    const event = new InputEvent('beforeinput', {
      inputType: 'insertText',
      data: 'world',
      cancelable: true,
    });
    editor().dispatchEvent(event);
    fixture.detectChanges();

    expect(editor().innerHTML).toBe('hello <strong>world</strong>');
    expect(component.form.controls.text.value).toBe('hello <strong>world</strong>');
  });

  it('stops formatting typed text once the typing-mode format is toggled off again', () => {
    fixture.detectChanges();
    editor().textContent = '';
    collapseCaretAtEnd(editor());

    component.toggleFormat('bold');
    editor().dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: 'bold', cancelable: true }),
    );
    component.toggleFormat('bold');
    editor().dispatchEvent(
      new InputEvent('beforeinput', { inputType: 'insertText', data: 'plain', cancelable: true }),
    );
    fixture.detectChanges();

    expect(component.pendingFormats().has('bold')).toBe(false);
    expect(editor().innerHTML).toBe('<strong>bold</strong>plain');
    expect(component.form.controls.text.value).toBe('<strong>bold</strong>plain');
  });

  it('inserts a literal newline instead of a browser paragraph break on Enter', () => {
    fixture.detectChanges();
    editor().textContent = 'line one';
    collapseCaretAtEnd(editor());

    const event = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    const preventSpy = vi.spyOn(event, 'preventDefault');
    editor().dispatchEvent(event);
    fixture.detectChanges();

    expect(preventSpy).toHaveBeenCalled();
    expect(component.form.controls.text.value).toBe('line one\n');
  });

  it('inserts only plain text on paste, ignoring rich clipboard content', () => {
    fixture.detectChanges();
    editor().textContent = 'before ';
    collapseCaretAtEnd(editor());

    const clipboardData = { getData: vi.fn().mockReturnValue('line1\nline2') };
    const event = new Event('paste', { cancelable: true }) as ClipboardEvent;
    Object.defineProperty(event, 'clipboardData', { value: clipboardData });
    editor().dispatchEvent(event);
    fixture.detectChanges();

    expect(component.form.controls.text.value).toBe('before line1\nline2');
  });

  it('disables Bold/Italic/Link while the selection is inside a <code> span, and disables Code while Bold/Italic is active', () => {
    fixture.detectChanges();
    editor().innerHTML = '<code>snippet</code> plain';
    selectAll(editor().querySelector('code')!);
    component.refreshActiveFormats();
    fixture.detectChanges();

    const boldBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Bold"]');
    const codeBtn: HTMLButtonElement = fixture.nativeElement.querySelector('[aria-label="Code"]');
    expect(boldBtn.disabled).toBe(true);
    expect(codeBtn.disabled).toBe(false);

    editor().innerHTML = '<strong>bold text</strong>';
    selectAll(editor().querySelector('strong')!);
    component.refreshActiveFormats();
    fixture.detectChanges();

    expect(codeBtn.disabled).toBe(true);
    expect(boldBtn.disabled).toBe(false);
  });

  it('keeps the formatting toolbar visible at all times', () => {
    fixture.detectChanges();
    editor().textContent = 'hello';
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Bold"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Italic"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Code"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="Link"]')).toBeTruthy();
    expect(editor()).toBeTruthy();
  });
});
