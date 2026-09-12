import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AttachmentUploadResultDto {
  token: string;
  kind: 'IMAGE' | 'TEXT';
  originalName: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  previewUrl: string;
}

@Injectable({ providedIn: 'root' })
export class AttachmentUploadService {
  private readonly http = inject(HttpClient);

  upload(file: File): Observable<AttachmentUploadResultDto> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<AttachmentUploadResultDto>(`${environment.apiBaseUrl}/attachments`, formData);
  }

  cancel(token: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiBaseUrl}/attachments/pending/${token}`);
  }

  previewUrl(token: string): string {
    return `${environment.apiBaseUrl}/attachments/pending/${token}`;
  }
}
