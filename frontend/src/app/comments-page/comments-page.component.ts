import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentsService } from './comments.service';
import { CommentsRealtimeService, CommentBroadcastDto } from './comments-realtime.service';
import { CommentNode, mapBroadcastToNode, mapCommentNode } from './comment-node.mapper';
import { CommentSortField } from './graphql/get-comments.query';
import { CommentReplies } from './comment-replies/comment-replies.component';
import { CommentAvatar } from './comment-avatar/comment-avatar.component';
import { CommentAttachment } from './comment-attachment/comment-attachment.component';
import { CommentFormComponent } from './comment-form/comment-form.component';
import { CommentSortBar } from './comment-sort-bar/comment-sort-bar.component';
import { CommentPagination } from './comment-pagination/comment-pagination.component';

const PAGE_SIZE = 25;

export type CommentItem = CommentNode;

@Component({
  imports: [
    DatePipe,
    MdbRippleModule,
    CommentReplies,
    CommentAvatar,
    CommentAttachment,
    CommentSortBar,
    CommentPagination,
  ],
  selector: 'app-comments-page',
  styleUrl: './comments-page.component.scss',
  templateUrl: './comments-page.component.html',
})
export class CommentsPage implements OnInit {
  private readonly commentsService = inject(CommentsService);
  private readonly realtimeService = inject(CommentsRealtimeService);
  private readonly modalService = inject(MdbModalService);
  private readonly destroyRef = inject(DestroyRef);
  private requestSeq = 0;

  readonly comments = signal<CommentItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sortBy = signal<CommentSortField>('CREATED_AT');
  readonly sortDescending = signal(true);
  readonly newCommentsAvailable = signal(0);
  readonly currentPage = signal(1);

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalCount() / PAGE_SIZE)));
  readonly initialLoading = computed(() => this.loading() && this.comments().length === 0);

  ngOnInit(): void {
    this.fetchPage(0);

    this.realtimeService.connect();
    this.realtimeService.onCommentAdded
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((dto) => this.handleBroadcast(dto));
  }

  goToPage(page: number): void {
    const target = Math.min(Math.max(page, 1), this.totalPages());
    if (target === this.currentPage()) {
      return;
    }
    this.currentPage.set(target);
    this.fetchPage((target - 1) * PAGE_SIZE);
  }

  onSortFieldChange(sortBy: CommentSortField): void {
    if (this.sortBy() === sortBy) {
      return;
    }
    this.sortBy.set(sortBy);
    this.resetAndReload();
  }

  onSortDirectionChange(descending: boolean): void {
    if (this.sortDescending() === descending) {
      return;
    }
    this.sortDescending.set(descending);
    this.resetAndReload();
  }

  private resetAndReload(): void {
    this.comments.set([]);
    this.totalCount.set(0);
    this.newCommentsAvailable.set(0);
    this.currentPage.set(1);
    this.fetchPage(0);
  }

  private fetchPage(skip: number): void {
    const requestId = ++this.requestSeq;
    this.loading.set(true);
    this.error.set(null);

    this.commentsService
      .getComments(skip, PAGE_SIZE, this.sortBy(), this.sortDescending())
      .subscribe({
        next: (page) => {
          if (requestId !== this.requestSeq) {
            return;
          }

          this.comments.set(page.items.map(mapCommentNode));
          this.totalCount.set(page.totalCount);
          this.loading.set(false);
        },
        error: () => {
          if (requestId !== this.requestSeq) {
            return;
          }

          this.error.set('Failed to load comments. Please try again.');
          this.loading.set(false);
        },
      });
  }

  prependComment(node: CommentItem): void {
    if (this.comments().some((comment) => comment.id === node.id)) {
      return;
    }

    this.comments.update((current) => {
      const next = [node, ...current];
      return this.currentPage() === 1 ? next.slice(0, PAGE_SIZE) : next;
    });
    this.totalCount.update((count) => count + 1);
  }

  refreshForNewComments(): void {
    this.resetAndReload();
  }

  private handleBroadcast(dto: CommentBroadcastDto): void {
    if (dto.parentId !== null) {
      return;
    }
    if (this.comments().some((comment) => comment.id === dto.id)) {
      return;
    }

    if (this.sortBy() === 'CREATED_AT' && this.sortDescending() && this.currentPage() === 1) {
      this.prependComment(mapBroadcastToNode(dto));
    } else {
      this.newCommentsAvailable.update((count) => count + 1);
    }
  }

  onReply(comment: CommentItem, repliesRef: CommentReplies): void {
    const modalRef = this.modalService.open(CommentFormComponent, {
      modalClass: 'modal-lg modal-dialog-centered',
      keyboard: true,
      data: { parentId: comment.id, parentAuthorName: comment.authorName },
    });

    modalRef.onClose.subscribe((newReply: CommentNode | undefined) => {
      if (newReply) {
        repliesRef.receiveNewReply(newReply);
      }
    });
  }
}
