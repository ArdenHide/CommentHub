import { Component, computed, inject, input } from '@angular/core';
import { MdbModalService } from 'mdb-angular-ui-kit/modal';
import { MdbRippleModule } from 'mdb-angular-ui-kit/ripple';
import { environment } from '../../../environments/environment';
import { CommentAttachmentDto } from '../graphql/get-comments.query';
import { AttachmentLightbox } from '../attachment-lightbox/attachment-lightbox.component';

@Component({
  imports: [MdbRippleModule],
  selector: 'app-comment-attachment',
  styleUrl: './comment-attachment.component.scss',
  templateUrl: './comment-attachment.component.html',
})
export class CommentAttachment {
  private readonly modalService = inject(MdbModalService);

  readonly attachment = input<CommentAttachmentDto | null>(null);

  readonly url = computed(() => {
    const attachment = this.attachment();
    return attachment ? `${environment.apiBaseUrl}/attachments/${attachment.id}` : null;
  });

  readonly sizeLabel = computed(() => {
    const bytes = this.attachment()?.sizeBytes ?? 0;
    return bytes < 1024 ? `${bytes} B` : `${Math.round(bytes / 1024)} KB`;
  });

  open(): void {
    const attachment = this.attachment();
    const url = this.url();
    if (!attachment || !url) {
      return;
    }

    this.modalService.open(AttachmentLightbox, {
      modalClass: 'modal-dialog-centered',
      keyboard: true,
      data: { url, kind: attachment.kind, originalName: attachment.originalName },
    });
  }
}
