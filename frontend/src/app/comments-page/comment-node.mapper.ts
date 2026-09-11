import { CommentNodeDto, RepliesPageDto } from './graphql/get-comments.query';
import { AddedCommentDto } from './graphql/add-comment.mutation';

export interface CommentNode {
  id: number;
  authorName: string;
  avatarSeed: string;
  textHtml: string;
  createdAt: string;
  replies: CommentNode[];
  repliesTotalCount: number;
  repliesKnown: boolean;
}

export function mapRepliesPage(page: RepliesPageDto): CommentNode[] {
  return page.items.map(mapCommentNode);
}

export function mapCommentNode(dto: CommentNodeDto): CommentNode {
  const repliesKnown = dto.replies !== undefined;

  return {
    id: dto.id,
    authorName: dto.user.userName,
    avatarSeed: dto.user.avatarSeed,
    textHtml: dto.textHtml,
    createdAt: dto.createdAt,
    replies: repliesKnown ? mapRepliesPage(dto.replies!) : [],
    repliesTotalCount: repliesKnown ? dto.replies!.totalCount : 0,
    repliesKnown,
  };
}

export function mapNewComment(dto: AddedCommentDto): CommentNode {
  return {
    id: dto.id,
    authorName: dto.user.userName,
    avatarSeed: dto.user.avatarSeed,
    textHtml: dto.textHtml,
    createdAt: dto.createdAt,
    replies: [],
    repliesTotalCount: 0,
    repliesKnown: true,
  };
}
