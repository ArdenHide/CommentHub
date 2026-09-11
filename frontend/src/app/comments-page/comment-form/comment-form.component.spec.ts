import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';
import { CommentFormComponent } from './comment-form.component';
import { CommentsService } from '../comments.service';
import { CommentIdentityStore } from '../comment-identity.store';
import { AddCommentPayloadDto } from '../graphql/add-comment.mutation';

function successPayload(overrides?: Partial<AddCommentPayloadDto>): AddCommentPayloadDto {
  return {
    comment: {
      id: 1,
      textHtml: '<strong>hi</strong>',
      createdAt: '2026-09-11T10:00:00Z',
      user: { userName: 'alice', homePage: null, avatarSeed: 'seed' },
    },
    errors: [],
    ...overrides,
  };
}

describe('CommentFormComponent', () => {
  let component: CommentFormComponent;
  let fixture: ComponentFixture<CommentFormComponent>;
  let modalRef: { close: ReturnType<typeof vi.fn> };
  let commentsService: { addComment: ReturnType<typeof vi.fn> };
  let identityStore: { lookup: ReturnType<typeof vi.fn>; remember: ReturnType<typeof vi.fn> };

  async function createComponent(): Promise<void> {
    modalRef = { close: vi.fn() };
    commentsService = { addComment: vi.fn() };
    identityStore = { lookup: vi.fn(() => null), remember: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommentFormComponent],
      providers: [
        { provide: MdbModalRef, useValue: modalRef },
        { provide: CommentsService, useValue: commentsService },
        { provide: CommentIdentityStore, useValue: identityStore },
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

  beforeEach(async () => {
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

  it('wraps the textarea selection with the Bold/Italic/Code toolbar buttons', () => {
    fixture.detectChanges();

    component.form.controls.text.setValue('hello world');
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#cf-text');
    textarea.selectionStart = 0;
    textarea.selectionEnd = 5;

    component.wrapSelection('<strong>', '</strong>');
    expect(component.form.controls.text.value).toBe('<strong>hello</strong> world');
  });

  it('inserts a link tag from the link toolbar mini-form', () => {
    fixture.detectChanges();
    component.form.controls.text.setValue('click here');
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#cf-text');
    textarea.selectionStart = 0;
    textarea.selectionEnd = 10;

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.linkTitle.set('Example');
    component.insertLink();

    expect(component.form.controls.text.value).toBe(
      '<a href="https://example.com" title="Example">click here</a>',
    );
    expect(component.linkPromptOpen()).toBe(false);
  });

  it('escapes &, < and > in the selection when wrapping it in <code>', () => {
    fixture.detectChanges();
    const snippet = 'if (a < b) { return a & b; }';
    component.form.controls.text.setValue(snippet);
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#cf-text');
    textarea.selectionStart = 0;
    textarea.selectionEnd = snippet.length;

    component.wrapSelection('<code>', '</code>', true);

    expect(component.form.controls.text.value).toBe(
      '<code>if (a &lt; b) { return a &amp; b; }</code>',
    );
  });

  it('escapes a <code> block that was typed by hand, not produced by the toolbar', () => {
    fixture.detectChanges();
    setValid();
    component.form.controls.text.setValue(
      'Before.\n<code>\nif (a < b)\n{\n    // do something\n}\n</code>\nAfter.',
    );

    commentsService.addComment.mockReturnValue(of(successPayload()));
    component.submit();

    expect(commentsService.addComment).toHaveBeenCalledWith(
      expect.objectContaining({
        text: 'Before.\n<code>\nif (a &lt; b)\n{\n    // do something\n}\n</code>\nAfter.',
      }),
    );
  });

  it('does not double-escape a hand-typed <code> block that already uses entities', () => {
    fixture.detectChanges();
    setValid();
    component.form.controls.text.setValue('<code>a &lt; b &amp;&amp; c &gt; d</code>');

    commentsService.addComment.mockReturnValue(of(successPayload()));
    component.submit();

    expect(commentsService.addComment).toHaveBeenCalledWith(
      expect.objectContaining({ text: '<code>a &lt; b &amp;&amp; c &gt; d</code>' }),
    );
  });

  it('escapes &, < and > in the selection when inserting a link', () => {
    fixture.detectChanges();
    const snippet = 'a < b';
    component.form.controls.text.setValue(snippet);
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#cf-text');
    textarea.selectionStart = 0;
    textarea.selectionEnd = snippet.length;

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.insertLink();

    expect(component.form.controls.text.value).toBe('<a href="https://example.com">a &lt; b</a>');
  });

  it('falls back to the title as link text when nothing is selected', () => {
    fixture.detectChanges();
    component.form.controls.text.setValue('Check this out: ');
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#cf-text');
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.linkTitle.set('CommentHub');
    component.insertLink();

    expect(component.form.controls.text.value).toBe(
      'Check this out: <a href="https://example.com" title="CommentHub">CommentHub</a>',
    );
  });

  it('falls back to the href as link text when nothing is selected and no title was given, instead of an empty <a>', () => {
    fixture.detectChanges();
    component.form.controls.text.setValue('Check this out: ');
    fixture.detectChanges();

    const textarea: HTMLTextAreaElement = fixture.nativeElement.querySelector('#cf-text');
    textarea.selectionStart = textarea.value.length;
    textarea.selectionEnd = textarea.value.length;

    component.toggleLinkPrompt();
    component.linkHref.set('https://example.com');
    component.insertLink();

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
});
