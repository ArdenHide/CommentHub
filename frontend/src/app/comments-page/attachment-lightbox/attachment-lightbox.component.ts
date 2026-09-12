import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { MdbModalRef } from 'mdb-angular-ui-kit/modal';

@Component({
  selector: 'app-attachment-lightbox',
  styleUrl: './attachment-lightbox.component.scss',
  templateUrl: './attachment-lightbox.component.html',
})
export class AttachmentLightbox implements OnInit {
  private readonly modalRef = inject(MdbModalRef<AttachmentLightbox>);
  private readonly http = inject(HttpClient);

  url = '';
  kind: 'IMAGE' | 'TEXT' = 'IMAGE';
  originalName = '';

  readonly textContent = signal<string | null>(null);
  readonly textError = signal<string | null>(null);

  ngOnInit(): void {
    if (this.kind !== 'TEXT') {
      return;
    }

    this.http.get(this.url, { responseType: 'text' }).subscribe({
      next: (content) => this.textContent.set(content),
      error: () => this.textError.set('Failed to load the file. Please try again.'),
    });
  }

  close(): void {
    this.modalRef.close();
  }
}
