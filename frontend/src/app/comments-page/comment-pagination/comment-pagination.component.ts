import { Component, input, output } from '@angular/core';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';

@Component({
  selector: 'app-comment-pagination',
  imports: [MdbRippleModule],
  templateUrl: './comment-pagination.component.html',
  styleUrl: './comment-pagination.component.scss',
})
export class CommentPagination {
  readonly currentPage = input.required<number>();
  readonly totalPages = input.required<number>();

  readonly pageChange = output<number>();

  goTo(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.currentPage()) {
      return;
    }
    this.pageChange.emit(page);
  }
}
