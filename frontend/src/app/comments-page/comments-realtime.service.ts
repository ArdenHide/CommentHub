import { Injectable } from '@angular/core';
import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { CommentAttachmentDto } from './graphql/get-comments.query';

export interface CommentBroadcastUserDto {
  userName: string;
  homePage: string | null;
  avatarSeed: string;
  maskedEmail: string;
}

export interface CommentBroadcastDto {
  id: number;
  parentId: number | null;
  rootId: number;
  textHtml: string;
  createdAt: string;
  user: CommentBroadcastUserDto;
  attachment: CommentAttachmentDto | null;
}

@Injectable({ providedIn: 'root' })
export class CommentsRealtimeService {
  private connection: HubConnection | null = null;
  private readonly commentAdded$ = new Subject<CommentBroadcastDto>();

  readonly onCommentAdded: Observable<CommentBroadcastDto> = this.commentAdded$.asObservable();

  connect(): void {
    if (this.connection) {
      return;
    }

    this.connection = new HubConnectionBuilder()
      .withUrl(`${environment.apiBaseUrl}/hubs/comments`, { withCredentials: false })
      .withAutomaticReconnect()
      .build();

    this.connection.on('CommentAdded', (dto: CommentBroadcastDto) => this.commentAdded$.next(dto));
    this.connection
      .start()
      .catch((error: unknown) => console.error('SignalR connection failed', error));
  }
}
