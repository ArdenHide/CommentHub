const BLOCK_TAGS = new Set(['p', 'div']);
const INLINE_TAG_MAP: Record<string, string> = {
  strong: 'strong',
  b: 'strong',
  em: 'i',
  i: 'i',
  code: 'code',
};

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function escapeContent(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts Quill's native HTML output (one `<p>` per line, `<em>` for italics,
 * `<br>` for soft breaks) into the constrained markup accepted by
 * `CommentTextValidator` on the backend: `<strong>`, `<i>`, `<code>`, `<a href>`,
 * with lines joined by a literal `\n` instead of block elements.
 */
export function normalizeQuillHtml(html: string | null | undefined): string {
  if (!html) {
    return '';
  }

  const container = document.createElement('div');
  container.innerHTML = html;

  const lines = Array.from(container.childNodes).map(serializeBlock);
  return lines.join('\n').replace(/\n+$/, '');
}

function serializeBlock(node: ChildNode): string {
  if (node.nodeType === Node.ELEMENT_NODE && BLOCK_TAGS.has((node as HTMLElement).tagName.toLowerCase())) {
    return Array.from(node.childNodes).map(serializeInline).join('');
  }
  return serializeInline(node);
}

function serializeInline(node: ChildNode): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeContent(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(serializeInline).join('');

  if (tag === 'br') {
    return '\n' + inner;
  }

  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    return `<a href="${escapeAttr(href)}">${inner}</a>`;
  }

  const mappedTag = INLINE_TAG_MAP[tag];
  if (!mappedTag) {
    return inner;
  }

  return `<${mappedTag}>${inner}</${mappedTag}>`;
}
