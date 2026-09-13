export type EditorFormat = 'bold' | 'italic' | 'code';
export type FormatTag = 'strong' | 'i' | 'code';

export const FORMAT_TAG: Record<EditorFormat, FormatTag> = {
  bold: 'strong',
  italic: 'i',
  code: 'code',
};

const ALLOWED_TAGS = new Set(['strong', 'i', 'code', 'a']);

export function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

export function escapeContent(value: string): string {
  return value
    .replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function serializeEditorContent(root: Node): string {
  return Array.from(root.childNodes).map(serializeNode).join('');
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeContent(node.textContent ?? '');
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = Array.from(el.childNodes).map(serializeNode).join('');

  if (tag === 'br') {
    return '\n' + inner;
  }

  if (!ALLOWED_TAGS.has(tag)) {
    return inner;
  }

  if (tag === 'a') {
    const href = el.getAttribute('href') ?? '';
    const title = el.getAttribute('title');
    const titleAttr = title ? ` title="${escapeAttr(title)}"` : '';
    return `<a href="${escapeAttr(href)}"${titleAttr}>${inner}</a>`;
  }

  return `<${tag}>${inner}</${tag}>`;
}

function getIntersectingTextNodes(range: Range, root: Node): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    if (node.textContent && range.intersectsNode(node)) {
      nodes.push(node as Text);
    }
    node = walker.nextNode();
  }
  return nodes;
}

function ancestorWithTag(node: Node, tagName: FormatTag, root: Node): HTMLElement | null {
  let current: Node | null = node.nodeType === Node.TEXT_NODE ? node.parentNode : node;
  while (current && current !== root) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      (current as HTMLElement).tagName.toLowerCase() === tagName
    ) {
      return current as HTMLElement;
    }
    current = current.parentNode;
  }
  return null;
}

export function isFullyFormatted(range: Range, tagName: FormatTag, root: Node): boolean {
  const nodes = getIntersectingTextNodes(range, root);
  if (nodes.length === 0) {
    return false;
  }
  return nodes.every((node) => ancestorWithTag(node, tagName, root) !== null);
}

export function formatsCoveringRange(range: Range, root: Node): Set<EditorFormat> {
  const result = new Set<EditorFormat>();
  (Object.keys(FORMAT_TAG) as EditorFormat[]).forEach((format) => {
    if (isFullyFormatted(range, FORMAT_TAG[format], root)) {
      result.add(format);
    }
  });
  return result;
}

export function formatsAtCaret(container: Node, root: Node): Set<EditorFormat> {
  const result = new Set<EditorFormat>();
  let node: Node | null = container;
  while (node && node !== root) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const tag = (node as HTMLElement).tagName.toLowerCase();
      if (tag === 'strong') result.add('bold');
      if (tag === 'i') result.add('italic');
      if (tag === 'code') result.add('code');
    }
    node = node.parentNode;
  }
  return result;
}

function stripTag(fragment: DocumentFragment, tagName: string): void {
  const elements = Array.from(fragment.querySelectorAll(tagName));
  for (const el of elements) {
    const parent = el.parentNode;
    if (!parent) continue;
    while (el.firstChild) parent.insertBefore(el.firstChild, el);
    parent.removeChild(el);
  }
}

function unwrapElement(el: HTMLElement): void {
  const parent = el.parentNode;
  if (!parent) return;
  while (el.firstChild) parent.insertBefore(el.firstChild, el);
  parent.removeChild(el);
}

function removeFormat(range: Range, tagName: FormatTag, root: Node): Range {
  const nodes = getIntersectingTextNodes(range, root);
  const elements = new Set<HTMLElement>();
  for (const node of nodes) {
    const el = ancestorWithTag(node, tagName, root);
    if (el) elements.add(el);
  }
  elements.forEach(unwrapElement);
  return range;
}

function addFormat(range: Range, tagName: FormatTag): Range {
  const fragment = range.extractContents();
  stripTag(fragment, tagName);
  const wrapper = document.createElement(tagName);
  wrapper.appendChild(fragment);
  range.insertNode(wrapper);

  const newRange = document.createRange();
  newRange.selectNodeContents(wrapper);
  return newRange;
}

export function toggleFormatOnSelection(range: Range, format: EditorFormat, root: Node): Range {
  if (range.collapsed) {
    return range;
  }
  const tagName = FORMAT_TAG[format];
  if (isFullyFormatted(range, tagName, root)) {
    return removeFormat(range, tagName, root);
  }
  return addFormat(range, tagName);
}

export function wrapRangeInLink(
  range: Range,
  href: string,
  title: string,
  fallbackText: string,
): Range {
  let contentRange = range;
  if (range.collapsed) {
    const textNode = document.createTextNode(fallbackText);
    range.insertNode(textNode);
    contentRange = document.createRange();
    contentRange.selectNode(textNode);
  }

  const fragment = contentRange.extractContents();
  stripTag(fragment, 'a');
  const a = document.createElement('a');
  a.setAttribute('href', href);
  if (title) {
    a.setAttribute('title', title);
  }
  a.appendChild(fragment);
  contentRange.insertNode(a);

  const newRange = document.createRange();
  newRange.setStartAfter(a);
  newRange.collapse(true);
  return newRange;
}

export function insertNodeAtCaret(range: Range, node: Node): Range {
  const target = range.cloneRange();
  if (!target.collapsed) {
    target.deleteContents();
  }
  target.insertNode(node);

  const newRange = document.createRange();
  newRange.setStartAfter(node);
  newRange.collapse(true);
  return newRange;
}

export function buildFormattedNode(text: string, formats: ReadonlySet<EditorFormat>): Node {
  let node: Node = document.createTextNode(text);

  if (formats.has('code')) {
    const codeEl = document.createElement('code');
    codeEl.appendChild(node);
    return codeEl;
  }

  if (formats.has('italic')) {
    const iEl = document.createElement('i');
    iEl.appendChild(node);
    node = iEl;
  }

  if (formats.has('bold')) {
    const strongEl = document.createElement('strong');
    strongEl.appendChild(node);
    node = strongEl;
  }

  return node;
}
