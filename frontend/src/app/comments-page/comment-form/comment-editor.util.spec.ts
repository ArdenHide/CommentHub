import {
  buildFormattedNode,
  formatsAtCaret,
  formatsCoveringRange,
  insertNodeAtCaret,
  serializeEditorContent,
  toggleFormatOnSelection,
  wrapRangeInLink,
} from './comment-editor.util';

function makeRoot(html: string): HTMLDivElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

function rangeOverAll(node: Node): Range {
  const range = document.createRange();
  range.selectNodeContents(node);
  return range;
}

describe('serializeEditorContent', () => {
  it('serializes strong/i/code/a elements as their own tags', () => {
    const root = makeRoot('<strong>bold</strong> <i>italic</i> <code>code</code>');
    expect(serializeEditorContent(root)).toBe(
      '<strong>bold</strong> <i>italic</i> <code>code</code>',
    );
  });

  it('serializes an <a> element with its href and title attributes', () => {
    const a = document.createElement('a');
    a.setAttribute('href', 'https://example.com');
    a.setAttribute('title', 'Example');
    a.textContent = 'link';
    const root = document.createElement('div');
    root.appendChild(a);

    expect(serializeEditorContent(root)).toBe(
      '<a href="https://example.com" title="Example">link</a>',
    );
  });

  it('escapes &, < and > in every plain text node, regardless of whether it is inside a formatting tag', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('a < b & c > d'));
    const code = document.createElement('code');
    code.appendChild(document.createTextNode('x < y'));
    root.appendChild(code);

    expect(serializeEditorContent(root)).toBe('a &lt; b &amp; c &gt; d<code>x &lt; y</code>');
  });

  it('converts a stray <br> into a literal newline and unwraps unknown elements', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('line one'));
    root.appendChild(document.createElement('br'));
    const span = document.createElement('span');
    span.textContent = 'line two';
    root.appendChild(span);

    expect(serializeEditorContent(root)).toBe('line one\nline two');
  });

  it('preserves a literal newline text node as-is', () => {
    const root = document.createElement('div');
    root.appendChild(document.createTextNode('line one'));
    root.appendChild(document.createTextNode('\n'));
    root.appendChild(document.createTextNode('line two'));

    expect(serializeEditorContent(root)).toBe('line one\nline two');
  });
});

describe('toggleFormatOnSelection', () => {
  it('wraps a plain-text selection in the requested tag', () => {
    const root = makeRoot('hello world');
    const text = root.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);

    toggleFormatOnSelection(range, 'bold', root);

    expect(root.innerHTML).toBe('<strong>hello</strong> world');
  });

  it('removes the tag when the whole selection is already fully formatted', () => {
    const root = makeRoot('<strong>hello</strong> world');
    const range = rangeOverAll(root.querySelector('strong')!);

    toggleFormatOnSelection(range, 'bold', root);

    expect(root.innerHTML).toBe('hello world');
  });

  it('does not nest the same tag twice when adding formatting over a partially formatted selection', () => {
    const root = makeRoot('<strong>hel</strong>lo');
    const range = rangeOverAll(root);

    toggleFormatOnSelection(range, 'bold', root);

    expect(root.querySelectorAll('strong').length).toBe(1);
    expect(root.textContent).toBe('hello');
  });

  it('supports the code format independently of bold/italic', () => {
    const root = makeRoot('snippet');
    const range = rangeOverAll(root);

    toggleFormatOnSelection(range, 'code', root);

    expect(root.innerHTML).toBe('<code>snippet</code>');
  });
});

describe('wrapRangeInLink', () => {
  it('wraps a non-collapsed selection in an <a> tag', () => {
    const root = makeRoot('click here');
    const range = rangeOverAll(root);

    wrapRangeInLink(range, 'https://example.com', 'Example', 'click here');

    expect(root.innerHTML).toBe('<a href="https://example.com" title="Example">click here</a>');
  });

  it('inserts the fallback text as the link label when the selection is collapsed', () => {
    const root = makeRoot('Check this out: ');
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);

    wrapRangeInLink(range, 'https://example.com', '', 'https://example.com');

    expect(root.innerHTML).toBe(
      'Check this out: <a href="https://example.com">https://example.com</a>',
    );
  });

  it('omits the title attribute when no title is given', () => {
    const root = makeRoot('text');
    const range = rangeOverAll(root);

    wrapRangeInLink(range, 'https://example.com', '', 'text');

    expect(root.innerHTML).toBe('<a href="https://example.com">text</a>');
  });
});

describe('insertNodeAtCaret', () => {
  it('inserts a node at a collapsed caret and returns a range positioned right after it', () => {
    const root = makeRoot('hello ');
    const range = document.createRange();
    range.selectNodeContents(root);
    range.collapse(false);

    const newRange = insertNodeAtCaret(range, document.createTextNode('world'));

    expect(root.textContent).toBe('hello world');
    expect(newRange.collapsed).toBe(true);
  });

  it('replaces a non-collapsed selection with the inserted node', () => {
    const root = makeRoot('hello world');
    const text = root.firstChild!;
    const range = document.createRange();
    range.setStart(text, 0);
    range.setEnd(text, 5);

    insertNodeAtCaret(range, document.createTextNode('bye'));

    expect(root.textContent).toBe('bye world');
  });
});

describe('buildFormattedNode', () => {
  it('wraps text in <strong> and <i> together when both formats are active', () => {
    const node = buildFormattedNode('hi', new Set(['bold', 'italic']));
    const div = document.createElement('div');
    div.appendChild(node);

    expect(div.innerHTML).toBe('<strong><i>hi</i></strong>');
  });

  it('wraps text in <code> alone when code is active, ignoring other formats', () => {
    const node = buildFormattedNode('hi', new Set(['bold', 'code']));
    const div = document.createElement('div');
    div.appendChild(node);

    expect(div.innerHTML).toBe('<code>hi</code>');
  });

  it('returns a plain text node when no formats are active', () => {
    const node = buildFormattedNode('hi', new Set());
    expect(node.nodeType).toBe(Node.TEXT_NODE);
    expect(node.textContent).toBe('hi');
  });
});

describe('formatsCoveringRange / formatsAtCaret', () => {
  it('reports formats that cover the entire selection', () => {
    const root = makeRoot('<strong>bold</strong>');
    const range = rangeOverAll(root.querySelector('strong')!);

    expect(formatsCoveringRange(range, root)).toEqual(new Set(['bold']));
  });

  it('does not report a format that only partially covers the selection', () => {
    const root = makeRoot('<strong>bo</strong>ld');
    const range = document.createRange();
    range.setStart(root.querySelector('strong')!.firstChild!, 0);
    range.setEnd(root.lastChild!, 2);

    expect(formatsCoveringRange(range, root)).toEqual(new Set());
  });

  it('reports the formats surrounding a caret position', () => {
    const root = makeRoot('<code>snippet</code>');
    const textNode = root.querySelector('code')!.firstChild!;

    expect(formatsAtCaret(textNode, root)).toEqual(new Set(['code']));
  });
});
