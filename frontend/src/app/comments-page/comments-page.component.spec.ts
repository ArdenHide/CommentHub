import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { CommentsPage } from './comments-page.component';
import { CommentsService } from './comments.service';
import { CommentsPageDto } from './graphql/get-comments.query';

function makePage(count: number, totalCount: number, offset = 0): CommentsPageDto {
  return {
    totalCount,
    items: Array.from({ length: count }, (_, i) => ({
      id: offset + i + 1,
      textHtml: `<p>Comment ${offset + i + 1}</p>`,
      createdAt: '2026-09-08T10:15:00Z',
      user: { userName: `User ${offset + i + 1}`, homePage: null },
      replies: { totalCount: 0, items: [] },
    })),
  };
}

describe('CommentsPage', () => {
  let component: CommentsPage;
  let fixture: ComponentFixture<CommentsPage>;
  let commentsService: { getComments: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    commentsService = {
      getComments: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [CommentsPage],
      providers: [{ provide: CommentsService, useValue: commentsService }],
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
});
