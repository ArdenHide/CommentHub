import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { CommentsPage } from './comments-page.component';
import { CommentFormComponent } from './comment-form/comment-form.component';
import { CommentsService } from './comments.service';
import { CommentsRealtimeService, CommentBroadcastDto } from './comments-realtime.service';
import { CommentsPageDto } from './graphql/get-comments.query';
import { CommentNode } from './comment-node.mapper';

function makeBroadcast(
  id: number,
  overrides: Partial<CommentBroadcastDto> = {},
): CommentBroadcastDto {
  return {
    id,
    parentId: null,
    rootId: id,
    textHtml: `<p>Broadcast ${id}</p>`,
    createdAt: '2026-09-13T10:00:00Z',
    user: {
      userName: `User ${id}`,
      homePage: null,
      avatarSeed: `seed-${id}`,
      maskedEmail: 'u***@example.com',
    },
    attachment: null,
    ...overrides,
  };
}

function makePage(count: number, totalCount: number, offset = 0): CommentsPageDto {
  return {
    totalCount,
    items: Array.from({ length: count }, (_, i) => ({
      id: offset + i + 1,
      textHtml: `<p>Comment ${offset + i + 1}</p>`,
      createdAt: '2026-09-08T10:15:00Z',
      user: {
        userName: `User ${offset + i + 1}`,
        homePage: null,
        avatarSeed: `seed-${offset + i + 1}`,
        maskedEmail: `u${offset + i + 1}***@example.com`,
      },
      attachment: null,
      replies: { totalCount: 0, items: [] },
    })),
  };
}

function makeCommentNode(id: number, overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    id,
    authorName: `User ${id}`,
    authorHomePage: null,
    authorMaskedEmail: `u${id}***@example.com`,
    avatarSeed: `seed-${id}`,
    textHtml: `<p>Comment ${id}</p>`,
    createdAt: '2026-09-11T10:00:00Z',
    attachment: null,
    replies: [],
    repliesTotalCount: 0,
    repliesKnown: true,
    ...overrides,
  };
}

describe('CommentsPage', () => {
  let component: CommentsPage;
  let fixture: ComponentFixture<CommentsPage>;
  let commentsService: { getComments: ReturnType<typeof vi.fn> };
  let modalService: { open: ReturnType<typeof vi.fn> };
  let realtimeService: {
    connect: ReturnType<typeof vi.fn>;
    onCommentAdded: Subject<CommentBroadcastDto>;
  };

  beforeEach(async () => {
    commentsService = {
      getComments: vi.fn(),
    };
    modalService = { open: vi.fn() };
    realtimeService = { connect: vi.fn(), onCommentAdded: new Subject<CommentBroadcastDto>() };

    await TestBed.configureTestingModule({
      imports: [CommentsPage],
      providers: [
        { provide: CommentsService, useValue: commentsService },
        { provide: MdbModalService, useValue: modalService },
        { provide: CommentsRealtimeService, useValue: realtimeService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentsPage);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    commentsService.getComments.mockReturnValue(of(makePage(0, 0)));
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('loads the first page of comments on init', () => {
    commentsService.getComments.mockReturnValue(of(makePage(25, 60)));

    fixture.detectChanges();

    expect(commentsService.getComments).toHaveBeenCalledWith(0, 25, 'CREATED_AT', true);
    expect(component.comments()).toHaveLength(25);
    expect(component.totalCount()).toBe(60);
    expect(component.totalPages()).toBe(3);
    expect(component.currentPage()).toBe(1);
  });

  it('renders comment text with whitespace preserved so line breaks survive', () => {
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.comment-card p.comment-text')).toBeTruthy();
  });

  it('renders the top-level comments as a table with User/Email/Date/Comment columns', () => {
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));

    fixture.detectChanges();

    const headers: HTMLElement[] = fixture.nativeElement.querySelectorAll('table thead th');
    expect(Array.from(headers).map((h) => h.textContent?.trim())).toEqual([
      'User',
      'Email',
      'Date',
      'Comment',
    ]);
    expect(fixture.nativeElement.textContent).toContain('u1***@example.com');
  });

  it('goToPage(2) replaces the list with the second page', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(25, 60)))
      .mockReturnValueOnce(of(makePage(25, 60, 25)));

    fixture.detectChanges();
    component.goToPage(2);

    expect(commentsService.getComments).toHaveBeenCalledWith(25, 25, 'CREATED_AT', true);
    expect(component.comments()).toHaveLength(25);
    expect(component.comments()[0].id).toBe(26);
    expect(component.currentPage()).toBe(2);
  });

  it('goToPage ignores out-of-range or unchanged page numbers', () => {
    commentsService.getComments.mockReturnValue(of(makePage(10, 10)));

    fixture.detectChanges();
    const callsAfterInit = commentsService.getComments.mock.calls.length;

    component.goToPage(0);
    component.goToPage(5);
    component.goToPage(1);

    expect(commentsService.getComments.mock.calls.length).toBe(callsAfterInit);
    expect(component.currentPage()).toBe(1);
  });

  it('totalPages is 1 when everything fits on a single page', () => {
    commentsService.getComments.mockReturnValue(of(makePage(10, 10)));

    fixture.detectChanges();

    expect(component.totalPages()).toBe(1);
  });

  it('surfaces an error when loading fails', () => {
    commentsService.getComments.mockReturnValue(throwError(() => new Error('network error')));

    fixture.detectChanges();

    expect(component.error()).toBeTruthy();
    expect(component.loading()).toBe(false);
  });

  it("clicking Reply on a comment opens the modal with that comment's id", () => {
    modalService.open.mockReturnValue({ onClose: of(undefined) });
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));

    fixture.detectChanges();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.comment-card .btn-link');
    button.click();

    expect(modalService.open).toHaveBeenCalledWith(
      CommentFormComponent,
      expect.objectContaining({ data: { parentId: 1, parentAuthorName: 'User 1' } }),
    );
  });

  it('prependComment puts the new comment first and bumps totalCount', () => {
    commentsService.getComments.mockReturnValue(of(makePage(2, 2)));
    fixture.detectChanges();

    const newNode = makeCommentNode(100, { authorName: 'newbie' });
    component.prependComment(newNode);

    expect(component.comments()[0]).toBe(newNode);
    expect(component.totalCount()).toBe(3);
  });

  it('prependComment trims the list back to the page size on page 1', () => {
    commentsService.getComments.mockReturnValue(of(makePage(25, 25)));
    fixture.detectChanges();

    component.prependComment(makeCommentNode(999));

    expect(component.comments()).toHaveLength(25);
    expect(component.comments()[0].id).toBe(999);
    expect(component.totalCount()).toBe(26);
  });

  it('prependComment does not trim the list on a page other than 1', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(25, 60)))
      .mockReturnValueOnce(of(makePage(25, 60, 25)));
    fixture.detectChanges();
    component.goToPage(2);

    component.prependComment(makeCommentNode(999));

    expect(component.comments()).toHaveLength(26);
    expect(component.comments()[0].id).toBe(999);
  });

  it('renders a new reply under the right comment once the reply modal closes with a result', () => {
    const newReply = makeCommentNode(200, { authorName: 'replier', textHtml: '<p>reply text</p>' });
    modalService.open.mockReturnValue({ onClose: of(newReply) });
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));

    fixture.detectChanges();

    const button: HTMLButtonElement =
      fixture.nativeElement.querySelector('.comment-card .btn-link');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('reply text');
  });

  it('changing the sort field resets the list and refetches from skip 0', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(25, 60)))
      .mockReturnValueOnce(of(makePage(10, 10)));

    fixture.detectChanges();
    component.onSortFieldChange('USER_NAME');

    expect(commentsService.getComments).toHaveBeenCalledWith(0, 25, 'USER_NAME', true);
    expect(component.comments()).toHaveLength(10);
  });

  it('changing the sort direction resets the list and refetches from skip 0', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(25, 60)))
      .mockReturnValueOnce(of(makePage(10, 10)));

    fixture.detectChanges();
    component.onSortDirectionChange(false);

    expect(commentsService.getComments).toHaveBeenCalledWith(0, 25, 'CREATED_AT', false);
    expect(component.comments()).toHaveLength(10);
  });

  it('changing the sort field resets back to page 1', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(25, 60)))
      .mockReturnValueOnce(of(makePage(25, 60, 25)))
      .mockReturnValueOnce(of(makePage(10, 10)));

    fixture.detectChanges();
    component.goToPage(2);
    component.onSortFieldChange('USER_NAME');

    expect(component.currentPage()).toBe(1);
  });

  it('re-selecting the same sort field or direction does not refetch', () => {
    commentsService.getComments.mockReturnValue(of(makePage(25, 60)));

    fixture.detectChanges();
    const callsAfterInit = commentsService.getComments.mock.calls.length;

    component.onSortFieldChange('CREATED_AT');
    component.onSortDirectionChange(true);

    expect(commentsService.getComments.mock.calls.length).toBe(callsAfterInit);
  });

  it('connects to the realtime hub on init', () => {
    commentsService.getComments.mockReturnValue(of(makePage(0, 0)));

    fixture.detectChanges();

    expect(realtimeService.connect).toHaveBeenCalled();
  });

  it('prepends a broadcast top-level comment while sorted by newest first, on page 1', () => {
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));
    fixture.detectChanges();

    realtimeService.onCommentAdded.next(makeBroadcast(500, { textHtml: '<p>live comment</p>' }));

    expect(component.comments()[0].textHtml).toBe('<p>live comment</p>');
    expect(component.totalCount()).toBe(2);
  });

  it('does not auto-prepend a broadcast while on a page other than 1, even sorted by newest first', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(25, 60)))
      .mockReturnValueOnce(of(makePage(25, 60, 25)));
    fixture.detectChanges();
    component.goToPage(2);

    realtimeService.onCommentAdded.next(makeBroadcast(500));

    expect(component.newCommentsAvailable()).toBe(1);
    expect(component.comments()).toHaveLength(25);
    expect(component.comments()[0].id).toBe(26);
  });

  it('does not touch the list for a broadcast reply', () => {
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));
    fixture.detectChanges();

    realtimeService.onCommentAdded.next(makeBroadcast(500, { parentId: 1 }));

    expect(component.comments()).toHaveLength(1);
    expect(component.totalCount()).toBe(1);
    expect(component.newCommentsAvailable()).toBe(0);
  });

  it('ignores a broadcast for a comment already in the list (own just-added comment)', () => {
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));
    fixture.detectChanges();

    realtimeService.onCommentAdded.next(makeBroadcast(1));

    expect(component.comments()).toHaveLength(1);
    expect(component.totalCount()).toBe(1);
  });

  it('counts new comments instead of reordering when not sorted by newest first', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(1, 1)))
      .mockReturnValueOnce(of(makePage(1, 1)));
    fixture.detectChanges();
    component.onSortFieldChange('USER_NAME');

    realtimeService.onCommentAdded.next(makeBroadcast(500));

    expect(component.newCommentsAvailable()).toBe(1);
    expect(component.comments()).toHaveLength(1);
  });

  it('refreshForNewComments clears the counter and reloads from the top', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(1, 1)))
      .mockReturnValueOnce(of(makePage(1, 1)))
      .mockReturnValueOnce(of(makePage(2, 2)));
    fixture.detectChanges();
    component.onSortDirectionChange(false);
    realtimeService.onCommentAdded.next(makeBroadcast(500));
    expect(component.newCommentsAvailable()).toBe(1);

    component.refreshForNewComments();

    expect(component.newCommentsAvailable()).toBe(0);
    expect(commentsService.getComments).toHaveBeenLastCalledWith(0, 25, 'CREATED_AT', false);
    expect(component.comments()).toHaveLength(2);
  });

  it('ignores a stale page response that resolves after the sort changed', () => {
    const initial$ = new Subject<ReturnType<typeof makePage>>();
    const page2$ = new Subject<ReturnType<typeof makePage>>();
    const sorted$ = new Subject<ReturnType<typeof makePage>>();

    commentsService.getComments
      .mockReturnValueOnce(initial$)
      .mockReturnValueOnce(page2$)
      .mockReturnValueOnce(sorted$);

    fixture.detectChanges();
    initial$.next(makePage(25, 60));

    component.goToPage(2);
    component.onSortFieldChange('USER_NAME');
    sorted$.next(makePage(10, 10));

    page2$.next(makePage(25, 60, 25));

    expect(component.comments()).toHaveLength(10);
    expect(component.totalCount()).toBe(10);
  });
});
