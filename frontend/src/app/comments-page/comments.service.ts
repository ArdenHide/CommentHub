import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, Observable } from 'rxjs';
import {
  CommentsPageDto,
  GET_COMMENTS_QUERY,
  GetCommentsResult,
  GetCommentsVariables,
  RepliesPageDto,
} from './graphql/get-comments.query';
import {
  GET_COMMENT_REPLIES_QUERY,
  GetCommentRepliesResult,
  GetCommentRepliesVariables,
} from './graphql/get-comment-replies.query';

@Injectable({ providedIn: 'root' })
export class CommentsService {
  private readonly apollo = inject(Apollo);

  getComments(skip: number, take: number): Observable<CommentsPageDto> {
    return this.apollo
      .query<GetCommentsResult, GetCommentsVariables>({
        query: GET_COMMENTS_QUERY,
        variables: { skip, take },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data) {
            throw new Error('GetComments query returned no data');
          }

          return result.data.comments;
        }),
      );
  }

  getReplies(
    commentId: number,
    skip: number,
    take: number,
    descending = false,
  ): Observable<RepliesPageDto> {
    return this.apollo
      .query<GetCommentRepliesResult, GetCommentRepliesVariables>({
        query: GET_COMMENT_REPLIES_QUERY,
        variables: { id: commentId, skip, take, descending },
        fetchPolicy: 'network-only',
      })
      .pipe(
        map((result) => {
          if (!result.data?.comment) {
            throw new Error('GetCommentReplies query returned no data');
          }

          return result.data.comment.replies;
        }),
      );
  }
}
