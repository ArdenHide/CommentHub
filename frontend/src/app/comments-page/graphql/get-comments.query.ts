import { gql } from 'apollo-angular';

export const GET_COMMENTS_QUERY = gql`
  query GetComments($skip: Int, $take: Int) {
    comments(skip: $skip, take: $take) {
      totalCount
      items {
        id
        textHtml
        createdAt
        user {
          userName
          homePage
        }
      }
    }
  }
`;

export interface UserDto {
  userName: string;
  homePage: string | null;
}

export interface CommentDto {
  id: number;
  textHtml: string;
  createdAt: string;
  user: UserDto;
}

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
