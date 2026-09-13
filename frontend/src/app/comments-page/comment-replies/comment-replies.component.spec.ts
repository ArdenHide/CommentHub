import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { CommentReplies } from './comment-replies.component';
import { CommentFormComponent } from '../comment-form/comment-form.component';
import { CommentsService } from '../comments.service';
import { CommentsRealtimeService, CommentBroadcastDto } from '../comments-realtime.service';
import { CommentNode } from '../comment-node.mapper';
import { RepliesPageDto } from '../graphql/get-comments.query';

function makeBroadcast(
  id: number,
  parentId: number,
  overrides: Partial<CommentBroadcastDto> = {},
): CommentBroadcastDto {
  return {
    id,
    parentId,
    rootId: parentId,
    textHtml: `<p>Broadcast reply ${id}</p>`,
    createdAt: '2026-09-13T10:00:00Z',
    user: {
      userName: `User ${id}`,
      homePage: null,
      avatarSeed: `seed-${id}`,
      maskedEmail: `u***@example.com`,
    },
    attachment: null,
    ...overrides,
  };
}

function makeNode(id: number, overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    id,
    authorName: `User ${id}`,
    authorHomePage: null,
    authorMaskedEmail: `u${id}***@example.com`,
    avatarSeed: `seed-${id}`,
    textHtml: `<p>Reply ${id}</p>`,
    createdAt: '2026-09-08T10:15:00Z',
    attachment: null,
    replies: [],
    repliesTotalCount: 0,
    repliesKnown: true,
    ...overrides,
  };
}

function makeRepliesPage(count: number, totalCount: number): RepliesPageDto {
  return {
    totalCount,
    items: Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      textHtml: `<p>Full reply ${i + 1}</p>`,
      createdAt: '2026-09-08T10:15:00Z',
      user: {
        userName: `User ${i + 1}`,
        homePage: null,
        avatarSeed: `seed-${i + 1}`,
        maskedEmail: `u${i + 1}***@example.com`,
      },
      attachment: null,
      replies: { totalCount: 0, items: [] },
    })),
  };
}

describe('CommentReplies', () => {
  let fixture: ComponentFixture<CommentReplies>;
  let commentsService: { getReplies: ReturnType<typeof vi.fn> };
  let modalService: { open: ReturnType<typeof vi.fn> };
  let commentAdded$: Subject<CommentBroadcastDto>;

  beforeEach(async () => {
    commentsService = { getReplies: vi.fn() };
    modalService = { open: vi.fn() };
    commentAdded$ = new Subject<CommentBroadcastDto>();

    await TestBed.configureTestingModule({
      imports: [CommentReplies],
      providers: [
        { provide: CommentsService, useValue: commentsService },
        { provide: MdbModalService, useValue: modalService },
        { provide: CommentsRealtimeService, useValue: { onCommentAdded: commentAdded$ } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CommentReplies);
  });

  function setNode(node: CommentNode): void {
    fixture.componentRef.setInput('node', node);
    fixture.detectChanges();
  }

  it('renders nothing when the comment has no replies', () => {
    setNode(makeNode(1, { repliesTotalCount: 0, replies: [] }));

    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(0);
  });

  it('renders reply text with whitespace preserved so line breaks survive', () => {
    const preview = [makeNode(2)];
    setNode(makeNode(1, { repliesTotalCount: 1, replies: preview }));

    expect(fixture.nativeElement.querySelector('.reply-card p.comment-text')).toBeTruthy();
  });

  it('renders only the one newest preview reply and hides the Show all button when there is just 1', () => {
    const preview = [makeNode(2)];
    setNode(makeNode(1, { repliesTotalCount: 1, replies: preview }));

    const cards = fixture.nativeElement.querySelectorAll('.reply-card');
    expect(cards).toHaveLength(1);
    expect(fixture.nativeElement.textContent).not.toContain('Show all');
  });

  it('shows a "Show all (N replies)" button when there is more than 1 reply', () => {
    const preview = [makeNode(2)];
    setNode(makeNode(1, { repliesTotalCount: 5, replies: preview }));

    expect(fixture.nativeElement.textContent).toContain('Show all (5 replies)');
  });

  it('fetches and displays the full list when Show all is clicked', () => {
    const preview = [makeNode(2)];
    commentsService.getReplies.mockReturnValue(of(makeRepliesPage(5, 5)));
    setNode(makeNode(1, { repliesTotalCount: 5, replies: preview }));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    expect(commentsService.getReplies).toHaveBeenCalledWith(1, 0, 5, true);
    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(5);
    expect(fixture.nativeElement.textContent).toContain('Show less');
  });

  it('collapses back to the preview via Show less without refetching', () => {
    const preview = [makeNode(2)];
    commentsService.getReplies.mockReturnValue(of(makeRepliesPage(5, 5)));
    setNode(makeNode(1, { repliesTotalCount: 5, replies: preview }));

    let button: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    button = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Show all (5 replies)');

    button = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    expect(commentsService.getReplies).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(5);
  });

  it('surfaces an error when fetching the full list fails', () => {
    const preview = [makeNode(2)];
    commentsService.getReplies.mockReturnValue(throwError(() => new Error('network error')));
    setNode(makeNode(1, { repliesTotalCount: 5, replies: preview }));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Failed to load replies');
  });

  it('silently discovers the preview when repliesKnown is false, without crashing', () => {
    commentsService.getReplies.mockReturnValue(of(makeRepliesPage(1, 4)));
    setNode(makeNode(1, { repliesKnown: false, replies: [], repliesTotalCount: 0 }));

    expect(commentsService.getReplies).toHaveBeenCalledWith(1, 0, 1, true);

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(1);
    expect(fixture.nativeElement.textContent).toContain('Show all (4 replies)');
  });

  it('treats a failed discovery as having no replies instead of erroring', () => {
    commentsService.getReplies.mockReturnValue(throwError(() => new Error('network error')));
    setNode(makeNode(1, { repliesKnown: false, replies: [], repliesTotalCount: 0 }));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(0);
    expect(fixture.nativeElement.textContent).not.toContain('Failed to load replies');
  });

  it('renders a Reply button only for what is currently visible, revealing more on click', () => {
    const grandchild = makeNode(3);
    const child = makeNode(2, { repliesTotalCount: 1, replies: [grandchild] });
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [child] }));

    expect(fixture.nativeElement.querySelectorAll('.reply-btn')).toHaveLength(1);

    const revealButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.toggle-replies-btn');
    expect(revealButton.textContent?.trim()).toBe('Show reply');
    revealButton.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.reply-btn')).toHaveLength(2);
  });

  it('reveals a lone nested reply on click without fetching — the data is already local', () => {
    const grandchild = makeNode(3);
    const child = makeNode(2, { repliesTotalCount: 1, replies: [grandchild] });
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [child] }));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    expect(commentsService.getReplies).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Show less');
  });

  it('renders nested replies-of-replies recursively, once each level is revealed', () => {
    const grandchild = makeNode(3);
    const child = makeNode(2, { repliesTotalCount: 1, replies: [grandchild] });
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [child] }));

    const revealButton: HTMLButtonElement =
      fixture.nativeElement.querySelector('.toggle-replies-btn');
    revealButton.click();
    fixture.detectChanges();

    const nested = fixture.nativeElement.querySelectorAll('app-comment-replies .reply-card');
    expect(nested).toHaveLength(1);
  });

  it('does not indent past the first reply level, however deep the thread goes', () => {
    const greatGrandchild = makeNode(4, { authorName: 'dave' });
    const grandchild = makeNode(3, {
      authorName: 'carol',
      repliesTotalCount: 1,
      replies: [greatGrandchild],
    });
    const child = makeNode(2, { authorName: 'bob', repliesTotalCount: 1, replies: [grandchild] });
    setNode(makeNode(1, { authorName: 'alice', repliesTotalCount: 1, replies: [child] }));

    let button: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
    expect(button.textContent?.trim()).toBe('Show reply');
    button.click();
    fixture.detectChanges();

    button = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.thread-rail')).toHaveLength(1);

    const labelElements: NodeListOf<HTMLElement> =
      fixture.nativeElement.querySelectorAll('.reply-to-label');
    const labels = Array.from(labelElements).map((el) => el.textContent?.trim());
    expect(labels).toEqual(['↳ Reply to bob', '↳ Reply to carol']);
  });

  it("clicking Reply on a preview item opens the modal with that reply's own id, not the parent's", () => {
    modalService.open.mockReturnValue({ onClose: of(undefined) });
    const preview = [makeNode(2, { authorName: 'preview-author' })];
    setNode(makeNode(1, { repliesTotalCount: 1, replies: preview }));

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.reply-btn');
    button.click();

    expect(modalService.open).toHaveBeenCalledWith(
      CommentFormComponent,
      expect.objectContaining({ data: { parentId: 2, parentAuthorName: 'preview-author' } }),
    );
  });

  it('receiveNewReply expands the thread and prepends the new reply (repliesKnown case)', () => {
    const existing = makeNode(2);
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [existing] }));
    const component = fixture.componentInstance;

    component.receiveNewReply(makeNode(99, { authorName: 'newbie' }));
    fixture.detectChanges();

    expect(component.expanded()).toBe(true);
    expect(component.repliesTotalCount()).toBe(2);
    const cards = fixture.nativeElement.querySelectorAll('.reply-card');
    expect(cards[0].textContent).toContain('newbie');
  });

  it('keeps showing the newly added reply in the collapsed preview after Show less', () => {
    const existing = makeNode(2, { authorName: 'old-timer' });
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [existing] }));
    const component = fixture.componentInstance;

    component.receiveNewReply(makeNode(99, { authorName: 'newbie' }));
    fixture.detectChanges();

    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
    button.click();
    fixture.detectChanges();

    expect(component.expanded()).toBe(false);
    const cards = fixture.nativeElement.querySelectorAll('.reply-card');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('newbie');
    expect(fixture.nativeElement.textContent).toContain('Show all (2 replies)');
  });

  it('receiveNewReply also increments the total when the count was discovered (repliesKnown: false)', () => {
    commentsService.getReplies.mockReturnValue(of(makeRepliesPage(0, 0)));
    setNode(makeNode(1, { repliesKnown: false, replies: [], repliesTotalCount: 0 }));
    const component = fixture.componentInstance;

    component.receiveNewReply(makeNode(99));
    fixture.detectChanges();

    expect(component.repliesTotalCount()).toBe(1);
    expect(component.expanded()).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.reply-card')).toHaveLength(1);
  });

  it("wires each Reply button to its own sibling nested CommentReplies instance, not a sibling comment's", () => {
    modalService.open.mockReturnValue({ onClose: of(makeNode(999, { authorName: 'zzz' })) });
    const childA = makeNode(2, { authorName: 'childA', repliesTotalCount: 0, replies: [] });
    const childB = makeNode(3, { authorName: 'childB', repliesTotalCount: 0, replies: [] });
    setNode(makeNode(1, { repliesTotalCount: 2, replies: [childA, childB] }));

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.reply-btn');
    expect(buttons).toHaveLength(2);

    buttons[1].click();
    fixture.detectChanges();

    const topLevelCards = fixture.nativeElement.querySelector('ul.reply-list').children;
    expect(topLevelCards[0].textContent).not.toContain('zzz');
    expect(topLevelCards[1].textContent).toContain('zzz');
  });

  it('adds a broadcast reply addressed to this node', () => {
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [makeNode(2)] }));

    commentAdded$.next(makeBroadcast(99, 1, { textHtml: '<p>live reply</p>' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('live reply');
    expect(fixture.componentInstance.repliesTotalCount()).toBe(2);
  });

  it('ignores a broadcast addressed to a different parent', () => {
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [makeNode(2)] }));

    commentAdded$.next(makeBroadcast(99, 42, { textHtml: '<p>someone else</p>' }));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('someone else');
    expect(fixture.componentInstance.repliesTotalCount()).toBe(1);
  });

  it('ignores a broadcast for a reply that is already visible (dedup by id)', () => {
    setNode(makeNode(1, { repliesTotalCount: 1, replies: [makeNode(2)] }));

    commentAdded$.next(makeBroadcast(2, 1, { textHtml: '<p>duplicate</p>' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.repliesTotalCount()).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('duplicate');
  });
});
