import { CommentNodeDto, RepliesPageDto } from './graphql/get-comments.query';

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
