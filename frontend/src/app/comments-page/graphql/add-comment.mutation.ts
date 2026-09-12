import { gql } from 'apollo-angular';
import { CommentAttachmentDto, UserDto } from './get-comments.query';

export const ADD_COMMENT_MUTATION = gql`
  mutation AddComment($input: AddCommentInput!) {
    addComment(input: $input) {
      comment {
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
      errors {
        field
        code
        message
      }
    }
  }
`;

export interface AddCommentInput {
  userName: string;
  email: string;
  homePage: string | null;
  text: string;
  parentId: number | null;
  captchaId: string;
  captchaCode: string;
  attachmentToken: string | null;
}

export interface UserErrorDto {
  field: string;
  code: string;
  message: string;
}

export interface AddedCommentDto {
  id: number;
  textHtml: string;
  createdAt: string;
  user: UserDto;
  attachment: CommentAttachmentDto | null;
}

export interface AddCommentPayloadDto {
  comment: AddedCommentDto | null;
  errors: UserErrorDto[];
}

export interface AddCommentResult {
  addComment: AddCommentPayloadDto;
}

export interface AddCommentVariables {
  input: AddCommentInput;
}
