import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CommentReplies } from './comment-replies.component';
import { CommentsService } from '../comments.service';
import { CommentNode } from '../comment-node.mapper';
import { RepliesPageDto } from '../graphql/get-comments.query';

function makeNode(id: number, overrides: Partial<CommentNode> = {}): CommentNode {
  return {
    id,
    authorName: `User ${id}`,
    authorInitials: `U${id}`,
    avatarColor: '#3b71ca',
    textHtml: `<p>Reply ${id}</p>`,
    createdAt: '2026-09-08T10:15:00Z',
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
      user: { userName: `User ${i + 1}`, homePage: null },
      replies: { totalCount: 0, items: [] },
    })),
  };
}

describe('CommentReplies', () => {
  let fixture: ComponentFixture<CommentReplies>;
  let commentsService: { getReplies: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    commentsService = { getReplies: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommentReplies],
      providers: [{ provide: CommentsService, useValue: commentsService }],
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

    const revealButton: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
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

    const revealButton: HTMLButtonElement = fixture.nativeElement.querySelector('.toggle-replies-btn');
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
});
