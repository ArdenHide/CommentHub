import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentsService } from './comments.service';
import { getAuthorInitials, getAvatarColor } from './comment-avatar.util';

const PAGE_SIZE = 25;

export interface CommentItem {
  id: number;
  authorName: string;
  authorInitials: string;
  avatarColor: string;
  textHtml: string;
  createdAt: string;
}

@Component({
  imports: [DatePipe, MdbRippleModule],
  selector: 'app-comments-page',
  styleUrl: './comments-page.component.scss',
  templateUrl: './comments-page.component.html',
})
export class CommentsPage implements OnInit {
  private readonly commentsService = inject(CommentsService);

  readonly comments = signal<CommentItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly hasMore = computed(() => this.comments().length < this.totalCount());
  readonly initialLoading = computed(() => this.loading() && this.comments().length === 0);

  ngOnInit(): void {
    this.loadMore();
  }

  loadMore(): void {
    this.loading.set(true);
    this.error.set(null);

    this.commentsService.getComments(this.comments().length, PAGE_SIZE).subscribe({
      next: (page) => {
        const items = page.items.map((comment) => ({
          id: comment.id,
          authorName: comment.user.userName,
          authorInitials: getAuthorInitials(comment.user.userName),
          avatarColor: getAvatarColor(comment.user.userName),
          textHtml: comment.textHtml,
          createdAt: comment.createdAt,
        }));

        this.comments.update((current) => [...current, ...items]);
        this.totalCount.set(page.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load comments. Please try again.');
        this.loading.set(false);
      },
    });
  }
}
