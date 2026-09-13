import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentNode, mapBroadcastToNode, mapRepliesPage } from '../comment-node.mapper';
import { CommentsService } from '../comments.service';
import { CommentsRealtimeService } from '../comments-realtime.service';
import { CommentAvatar } from '../comment-avatar/comment-avatar.component';
import { CommentAttachment } from '../comment-attachment/comment-attachment.component';
import { CommentFormComponent } from '../comment-form/comment-form.component';

const PREVIEW_SIZE = 1;

@Component({
  imports: [DatePipe, MdbRippleModule, CommentReplies, CommentAvatar, CommentAttachment],
  selector: 'app-comment-replies',
  styleUrl: './comment-replies.component.scss',
  templateUrl: './comment-replies.component.html',
})
export class CommentReplies {
  private readonly commentsService = inject(CommentsService);
  private readonly realtimeService = inject(CommentsRealtimeService);
  private readonly modalService = inject(MdbModalService);
  private discoveryRequested = false;

  readonly node = input.required<CommentNode>();
  readonly depth = input(0);

  readonly expanded = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly fullReplies = signal<CommentNode[] | null>(null);

  private readonly discoveredPreview = signal<CommentNode[] | null>(null);
  private readonly discoveredTotalCount = signal<number | null>(null);
  private readonly addedRepliesCount = signal(0);

  readonly repliesTotalCount = computed(() => {
    const known = this.node().repliesKnown
      ? this.node().repliesTotalCount
      : (this.discoveredTotalCount() ?? 0);
    return known + this.addedRepliesCount();
  });

  readonly toggleVisible = computed(() =>
    this.depth() === 0 ? this.repliesTotalCount() > 1 : this.repliesTotalCount() > 0,
  );

  readonly toggleButtonLabel = computed(() => {
    if (this.loading()) {
      return 'Loading…';
    }
    if (this.expanded()) {
      return 'Show less';
    }
    if (this.depth() > 0 && this.repliesTotalCount() === 1) {
      return 'Show reply';
    }
    return `Show all (${this.repliesTotalCount()} replies)`;
  });

  readonly visibleReplies = computed(() => {
    if (this.expanded()) {
      return this.fullReplies() ?? [];
    }

    if (this.depth() > 0) {
      return [];
    }

    const reconciled = this.fullReplies();
    if (reconciled) {
      return reconciled.slice(0, PREVIEW_SIZE);
    }

    return this.node().repliesKnown ? this.node().replies : (this.discoveredPreview() ?? []);
  });

  constructor() {
    effect(() => {
      const node = this.node();

      if (node.repliesKnown || this.discoveryRequested) {
        return;
      }

      this.discoveryRequested = true;

      this.commentsService.getReplies(node.id, 0, PREVIEW_SIZE, true).subscribe({
        next: (page) => {
          this.discoveredPreview.set(mapRepliesPage(page));
          this.discoveredTotalCount.set(page.totalCount);
        },
        error: () => this.discoveredTotalCount.set(0),
      });
    });

    this.realtimeService.onCommentAdded.pipe(takeUntilDestroyed()).subscribe((dto) => {
      if (dto.parentId !== this.node().id) {
        return;
      }

      const visible =
        this.fullReplies() ??
        (this.node().repliesKnown ? this.node().replies : (this.discoveredPreview() ?? []));
      if (visible.some((reply) => reply.id === dto.id)) {
        return;
      }

      this.receiveNewReply(mapBroadcastToNode(dto));
    });
  }

  toggle(): void {
    if (this.expanded()) {
      this.expanded.set(false);
      return;
    }

    if (this.fullReplies()) {
      this.expanded.set(true);
      return;
    }

    if (this.depth() > 0 && this.repliesTotalCount() === 1) {
      const known = this.node().repliesKnown ? this.node().replies : this.discoveredPreview();

      if (known && known.length > 0) {
        this.fullReplies.set(known);
        this.expanded.set(true);
        return;
      }
    }

    this.loading.set(true);
    this.error.set(null);

    this.commentsService.getReplies(this.node().id, 0, this.repliesTotalCount(), true).subscribe({
      next: (page) => {
        this.fullReplies.set(mapRepliesPage(page));
        this.expanded.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load replies. Please try again.');
        this.loading.set(false);
      },
    });
  }

  onReply(reply: CommentNode, repliesRef: CommentReplies): void {
    const modalRef = this.modalService.open(CommentFormComponent, {
      modalClass: 'modal-lg modal-dialog-centered',
      keyboard: true,
      data: { parentId: reply.id, parentAuthorName: reply.authorName },
    });

    modalRef.onClose.subscribe((newReply: CommentNode | undefined) => {
      if (newReply) {
        repliesRef.receiveNewReply(newReply);
      }
    });
  }

  receiveNewReply(newReply: CommentNode): void {
    const currentlyVisible =
      this.fullReplies() ??
      (this.node().repliesKnown ? this.node().replies : (this.discoveredPreview() ?? []));

    this.fullReplies.set([newReply, ...currentlyVisible]);
    this.addedRepliesCount.update((count) => count + 1);
    this.expanded.set(true);
  }
}
