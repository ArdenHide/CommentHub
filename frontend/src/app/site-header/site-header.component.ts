import { Component, inject, output } from '@angular/core';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { CommentFormComponent } from '../comments-page/comment-form/comment-form.component';
import { CommentNode } from '../comments-page/comment-node.mapper';

@Component({
  imports: [MdbRippleModule],
  selector: 'app-site-header',
  styleUrl: './site-header.component.scss',
  templateUrl: './site-header.component.html',
})
export class SiteHeader {
  private readonly modalService = inject(MdbModalService);

  readonly commentPosted = output<CommentNode>();

  openNewCommentModal(): void {
    const modalRef = this.modalService.open(CommentFormComponent, {
      modalClass: 'modal-lg modal-dialog-centered',
      keyboard: true,
      data: { parentId: null, parentAuthorName: null },
    });

    modalRef.onClose.subscribe((newComment: CommentNode | undefined) => {
      if (newComment) {
        this.commentPosted.emit(newComment);
      }
    });
  }
}
