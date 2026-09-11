import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, Observable } from 'rxjs';
import {
  CommentsPageDto,
  GET_COMMENTS_QUERY,
  GetCommentsResult,
  GetCommentsVariables,
} from './graphql/get-comments.query';

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
}
