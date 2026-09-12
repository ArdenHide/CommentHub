import { mapCommentNode, mapRepliesPage } from './comment-node.mapper';
import { CommentNodeDto, RepliesPageDto } from './graphql/get-comments.query';

function makeDto(id: number, replies: CommentNodeDto[] = [], repliesTotalCount = replies.length): CommentNodeDto {
  return {
    id,
    textHtml: `<p>Comment ${id}</p>`,
    createdAt: '2026-09-08T10:15:00Z',
    user: { userName: `User ${id}`, homePage: null, avatarSeed: `seed-${id}` },
    attachment: null,
    replies: { totalCount: repliesTotalCount, items: replies },
  };
}

describe('mapCommentNode', () => {
  it('keeps the newest-first order the preview arrives in, without reordering', () => {
    const newest = makeDto(3);
    const secondNewest = makeDto(2);
    const dto = makeDto(1, [newest, secondNewest], 5);

    const node = mapCommentNode(dto);

    expect(node.repliesTotalCount).toBe(5);
    expect(node.replies.map((reply) => reply.id)).toEqual([3, 2]);
  });

  it('maps nested reply previews recursively', () => {
    const grandchild = makeDto(3);
    const child = makeDto(2, [grandchild], 1);
    const dto = makeDto(1, [child], 1);

    const node = mapCommentNode(dto);

    expect(node.replies[0].id).toBe(2);
    expect(node.replies[0].replies.map((reply) => reply.id)).toEqual([3]);
  });

  it('does not crash on a node whose own replies field was not requested', () => {
    const beyondQueriedDepth: CommentNodeDto = {
      id: 4,
      textHtml: '<p>Comment 4</p>',
      createdAt: '2026-09-08T10:15:00Z',
      user: { userName: 'User 4', homePage: null, avatarSeed: 'seed-4' },
      attachment: null,
    };
    const dto = makeDto(1, [beyondQueriedDepth], 1);

    const node = mapCommentNode(dto);

    expect(node.replies[0].repliesKnown).toBe(false);
    expect(node.replies[0].replies).toEqual([]);
    expect(node.replies[0].repliesTotalCount).toBe(0);
  });
});

describe('mapRepliesPage', () => {
  it('preserves whatever order the page arrives in (newest-first, per the descending fetch)', () => {
    const page: RepliesPageDto = {
      totalCount: 3,
      items: [makeDto(3), makeDto(2), makeDto(1)],
    };

    const nodes = mapRepliesPage(page);

    expect(nodes.map((node) => node.id)).toEqual([3, 2, 1]);
  });
});
