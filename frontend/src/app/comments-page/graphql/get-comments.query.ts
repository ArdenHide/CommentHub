import { gql } from 'apollo-angular';

export const GET_COMMENTS_QUERY = gql`
  query GetComments($skip: Int, $take: Int) {
    comments(skip: $skip, take: $take) {
      totalCount
      items {
        ...CommentNodeFields
      }
    }
  }

  fragment CommentNodeFields on Comment {
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
`;

export interface UserDto {
  userName: string;
  homePage: string | null;
  avatarSeed: string;
}

export interface CommentAttachmentDto {
  id: number;
  kind: 'IMAGE' | 'TEXT';
  originalName: string;
  contentType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
}

export interface RepliesPageDto {
  totalCount: number;
  items: CommentNodeDto[];
}

export interface CommentNodeDto {
  id: number;
  textHtml: string;
  createdAt: string;
  user: UserDto;
  attachment: CommentAttachmentDto | null;
  replies?: RepliesPageDto;
}

export type CommentDto = CommentNodeDto;

export interface CommentsPageDto {
  totalCount: number;
  items: CommentDto[];
}

export interface GetCommentsResult {
  comments: CommentsPageDto;
}

export interface GetCommentsVariables {
  skip: number;
  take: number;
}
