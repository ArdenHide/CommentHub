import { Component, input, output } from '@angular/core';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentSortField } from '../graphql/get-comments.query';

interface SortOption {
  value: CommentSortField;
  label: string;
}

const SORT_OPTIONS: SortOption[] = [
  { value: 'CREATED_AT', label: 'Date added' },
  { value: 'USER_NAME', label: 'User name' },
  { value: 'EMAIL', label: 'E-mail' },
];

@Component({
  selector: 'app-comment-sort-bar',
  imports: [MdbRippleModule],
  templateUrl: './comment-sort-bar.component.html',
  styleUrl: './comment-sort-bar.component.scss',
})
export class CommentSortBar {
  readonly sortBy = input.required<CommentSortField>();
  readonly descending = input.required<boolean>();

  readonly sortByChange = output<CommentSortField>();
  readonly descendingChange = output<boolean>();

  readonly options = SORT_OPTIONS;

  onFieldChange(value: string): void {
    this.sortByChange.emit(value as CommentSortField);
  }

  toggleDirection(): void {
    this.descendingChange.emit(!this.descending());
  }
}
