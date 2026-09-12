import { gql } from 'apollo-angular';
import { RepliesPageDto } from './get-comments.query';

export const GET_COMMENT_REPLIES_QUERY = gql`
  query GetCommentReplies($id: Long!, $skip: Int, $take: Int, $descending: Boolean) {
    comment(id: $id) {
      replies(skip: $skip, take: $take, descending: $descending) {
        totalCount
        items {
          id
          textHtml
          createdAt
          user {
            userName
            homePage
            avatarSeed
          }
          attachment {
            id
            kind
            originalName
            contentType
            sizeBytes
            width
            height
          }
          replies(take: 1, descending: true) {
            totalCount
            items {
              id
              textHtml
              createdAt
              user {
                userName
                homePage
                avatarSeed
              }
              attachment {
                id
                kind
                originalName
                contentType
                sizeBytes
                width
                height
              }
            }
          }
        }
      }
    }
  }
`;

export interface GetCommentRepliesResult {
  comment: { replies: RepliesPageDto } | null;
}

export interface GetCommentRepliesVariables {
  id: number;
  skip: number;
  take: number;
  descending: boolean;
}
