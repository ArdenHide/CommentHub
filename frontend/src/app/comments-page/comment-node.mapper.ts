import { CommentAttachmentDto, CommentNodeDto, RepliesPageDto } from './graphql/get-comments.query';
import { AddedCommentDto } from './graphql/add-comment.mutation';
import { CommentBroadcastDto } from './comments-realtime.service';

export interface CommentNode {
  id: number;
  authorName: string;
  authorHomePage: string | null;
  avatarSeed: string;
  textHtml: string;
  createdAt: string;
  attachment: CommentAttachmentDto | null;
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
    authorHomePage: dto.user.homePage,
    avatarSeed: dto.user.avatarSeed,
    textHtml: dto.textHtml,
    createdAt: dto.createdAt,
    attachment: dto.attachment,
    replies: repliesKnown ? mapRepliesPage(dto.replies!) : [],
    repliesTotalCount: repliesKnown ? dto.replies!.totalCount : 0,
    repliesKnown,
  };
}

export function mapNewComment(dto: AddedCommentDto): CommentNode {
  return {
    id: dto.id,
    authorName: dto.user.userName,
    authorHomePage: dto.user.homePage,
    avatarSeed: dto.user.avatarSeed,
    textHtml: dto.textHtml,
    createdAt: dto.createdAt,
    attachment: dto.attachment,
    replies: [],
    repliesTotalCount: 0,
    repliesKnown: true,
  };
}

export function mapBroadcastToNode(dto: CommentBroadcastDto): CommentNode {
  return {
    id: dto.id,
    authorName: dto.user.userName,
    authorHomePage: dto.user.homePage,
    avatarSeed: dto.user.avatarSeed,
    textHtml: dto.textHtml,
    createdAt: dto.createdAt,
    attachment: dto.attachment,
    replies: [],
    repliesTotalCount: 0,
    repliesKnown: true,
  };
}
