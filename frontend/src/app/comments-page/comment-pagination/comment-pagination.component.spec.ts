import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CommentPagination } from './comment-pagination.component';

describe('CommentPagination', () => {
  let fixture: ComponentFixture<CommentPagination>;
  let component: CommentPagination;

  function setPages(currentPage: number, totalPages: number): void {
    fixture.componentRef.setInput('currentPage', currentPage);
    fixture.componentRef.setInput('totalPages', totalPages);
    fixture.detectChanges();
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CommentPagination] }).compileComponents();
    fixture = TestBed.createComponent(CommentPagination);
    component = fixture.componentInstance;
  });

  it('renders "Page X of Y"', () => {
    setPages(2, 5);

    expect(fixture.nativeElement.textContent).toContain('Page 2 of 5');
  });

  it('disables Prev on the first page', () => {
    setPages(1, 5);

    const [prev]: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    expect(prev.disabled).toBe(true);
  });

  it('disables Next on the last page', () => {
    setPages(5, 5);

    const [, next]: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    expect(next.disabled).toBe(true);
  });

  it('emits the previous page number when Prev is clicked', () => {
    setPages(3, 5);
    const emitted: number[] = [];
    component.pageChange.subscribe((page) => emitted.push(page));

    const [prev]: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    prev.click();

    expect(emitted).toEqual([2]);
  });

  it('emits the next page number when Next is clicked', () => {
    setPages(3, 5);
    const emitted: number[] = [];
    component.pageChange.subscribe((page) => emitted.push(page));

    const [, next]: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    next.click();

    expect(emitted).toEqual([4]);
  });

  it('goTo ignores out-of-range page numbers', () => {
    setPages(3, 5);
    const emitted: number[] = [];
    component.pageChange.subscribe((page) => emitted.push(page));

    component.goTo(0);
    component.goTo(6);
    component.goTo(3);

    expect(emitted).toEqual([]);
  });
});
