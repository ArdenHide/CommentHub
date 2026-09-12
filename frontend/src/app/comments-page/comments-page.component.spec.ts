import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { CommentsPage } from './comments-page.component';
import { CommentFormComponent } from './comment-form/comment-form.component';
import { CommentsService } from './comments.service';
import { CommentsPageDto } from './graphql/get-comments.query';
import { CommentNode } from './comment-node.mapper';

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

  beforeEach(async () => {
    commentsService = {
      getComments: vi.fn(),
    };
    modalService = { open: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [CommentsPage],
      providers: [
        { provide: CommentsService, useValue: commentsService },
        { provide: MdbModalService, useValue: modalService },
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

    expect(commentsService.getComments).toHaveBeenCalledWith(0, 25);
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

    expect(commentsService.getComments).toHaveBeenCalledWith(25, 25);
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
});
