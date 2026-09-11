import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentsService } from './comments.service';
import { CommentNode, mapCommentNode } from './comment-node.mapper';
import { CommentReplies } from './comment-replies/comment-replies.component';
import { CommentAvatar } from './comment-avatar/comment-avatar.component';
import { CommentFormComponent } from './comment-form/comment-form.component';

const PAGE_SIZE = 25;

export type CommentItem = CommentNode;

@Component({
  imports: [DatePipe, MdbRippleModule, CommentReplies, CommentAvatar],
  selector: 'app-comments-page',
  styleUrl: './comments-page.component.scss',
  templateUrl: './comments-page.component.html',
})
export class CommentsPage implements OnInit {
  private readonly commentsService = inject(CommentsService);
  private readonly modalService = inject(MdbModalService);

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
        const items = page.items.map(mapCommentNode);

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
