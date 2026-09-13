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
      },
      attachment: null,
      replies: { totalCount: 0, items: [] },
    })),
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
    expect(component.hasMore()).toBe(true);
  });

  it('renders comment text with whitespace preserved so line breaks survive', () => {
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.comment-card p.comment-text')).toBeTruthy();
  });

  it('appends the next page when loadMore is called', () => {
    commentsService.getComments
      .mockReturnValueOnce(of(makePage(25, 60)))
      .mockReturnValueOnce(of(makePage(25, 60, 25)));

    fixture.detectChanges();
    component.loadMore();

    expect(commentsService.getComments).toHaveBeenCalledWith(25, 25, 'CREATED_AT', true);
    expect(component.comments()).toHaveLength(50);
    expect(component.hasMore()).toBe(true);
  });

  it('hides the load-more affordance once every comment is loaded', () => {
    commentsService.getComments.mockReturnValue(of(makePage(10, 10)));

    fixture.detectChanges();

    expect(component.hasMore()).toBe(false);
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

    const newNode: CommentNode = {
      id: 100,
      authorName: 'newbie',
      authorHomePage: null,
      avatarSeed: 'seed-100',
      textHtml: '<p>hi</p>',
      createdAt: '2026-09-11T10:00:00Z',
      attachment: null,
      replies: [],
      repliesTotalCount: 0,
      repliesKnown: true,
    };

    component.prependComment(newNode);

    expect(component.comments()[0]).toBe(newNode);
    expect(component.totalCount()).toBe(3);
  });

  it('renders a new reply under the right comment once the reply modal closes with a result', () => {
    const newReply: CommentNode = {
      id: 200,
      authorName: 'replier',
      authorHomePage: null,
      avatarSeed: 'seed-200',
      textHtml: '<p>reply text</p>',
      createdAt: '2026-09-11T10:00:00Z',
      attachment: null,
      replies: [],
      repliesTotalCount: 0,
      repliesKnown: true,
    };
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

  it('prepends a broadcast top-level comment while sorted by newest first', () => {
    commentsService.getComments.mockReturnValue(of(makePage(1, 1)));
    fixture.detectChanges();

    realtimeService.onCommentAdded.next(makeBroadcast(500, { textHtml: '<p>live comment</p>' }));

    expect(component.comments()[0].textHtml).toBe('<p>live comment</p>');
    expect(component.totalCount()).toBe(2);
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

  it('ignores a stale loadMore response that resolves after the sort changed', () => {
    const initial$ = new Subject<ReturnType<typeof makePage>>();
    const loadMore$ = new Subject<ReturnType<typeof makePage>>();
    const sorted$ = new Subject<ReturnType<typeof makePage>>();

    commentsService.getComments
      .mockReturnValueOnce(initial$)
      .mockReturnValueOnce(loadMore$)
      .mockReturnValueOnce(sorted$);

    fixture.detectChanges();
    initial$.next(makePage(25, 60));

    component.loadMore();
    component.onSortFieldChange('USER_NAME');
    sorted$.next(makePage(10, 10));

    loadMore$.next(makePage(25, 60, 25));

    expect(component.comments()).toHaveLength(10);
    expect(component.totalCount()).toBe(10);
  });
});
