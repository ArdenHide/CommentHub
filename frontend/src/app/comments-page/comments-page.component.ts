import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentsService } from './comments.service';
import { CommentNode, mapCommentNode } from './comment-node.mapper';
import { CommentSortField } from './graphql/get-comments.query';
import { CommentReplies } from './comment-replies/comment-replies.component';
import { CommentAvatar } from './comment-avatar/comment-avatar.component';
import { CommentAttachment } from './comment-attachment/comment-attachment.component';
import { CommentFormComponent } from './comment-form/comment-form.component';
import { CommentSortBar } from './comment-sort-bar/comment-sort-bar.component';

const PAGE_SIZE = 25;

export type CommentItem = CommentNode;

@Component({
  imports: [DatePipe, MdbRippleModule, CommentReplies, CommentAvatar, CommentAttachment, CommentSortBar],
  selector: 'app-comments-page',
  styleUrl: './comments-page.component.scss',
  templateUrl: './comments-page.component.html',
})
export class CommentsPage implements OnInit {
  private readonly commentsService = inject(CommentsService);
  private readonly modalService = inject(MdbModalService);
  private requestSeq = 0;

  readonly comments = signal<CommentItem[]>([]);
  readonly totalCount = signal(0);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly sortBy = signal<CommentSortField>('CREATED_AT');
  readonly sortDescending = signal(true);

  readonly hasMore = computed(() => this.comments().length < this.totalCount());
  readonly initialLoading = computed(() => this.loading() && this.comments().length === 0);

  ngOnInit(): void {
    this.fetchPage(0);
  }

  loadMore(): void {
    this.fetchPage(this.comments().length);
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

          const items = page.items.map(mapCommentNode);

          this.comments.update((current) => (skip === 0 ? items : [...current, ...items]));
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
    this.comments.update((current) => [node, ...current]);
    this.totalCount.update((count) => count + 1);
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
