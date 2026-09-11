import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentNode, mapRepliesPage } from '../comment-node.mapper';
import { CommentsService } from '../comments.service';

const PREVIEW_SIZE = 1;

@Component({
  imports: [DatePipe, MdbRippleModule, CommentReplies],
  selector: 'app-comment-replies',
  styleUrl: './comment-replies.component.scss',
  templateUrl: './comment-replies.component.html',
})
export class CommentReplies {
  private readonly commentsService = inject(CommentsService);
  private discoveryRequested = false;

  readonly node = input.required<CommentNode>();
  readonly depth = input(0);

  readonly expanded = signal(false);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly fullReplies = signal<CommentNode[] | null>(null);

  private readonly discoveredPreview = signal<CommentNode[] | null>(null);
  private readonly discoveredTotalCount = signal<number | null>(null);

  readonly repliesTotalCount = computed(() =>
    this.node().repliesKnown ? this.node().repliesTotalCount : (this.discoveredTotalCount() ?? 0),
  );

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
}
