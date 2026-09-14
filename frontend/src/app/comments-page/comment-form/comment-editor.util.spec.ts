import { normalizeQuillHtml } from './comment-editor.util';

describe('normalizeQuillHtml', () => {
  it('joins separate <p> blocks with a literal newline', () => {
    expect(normalizeQuillHtml('<p>line one</p><p>line two</p>')).toBe('line one\nline two');
  });

  it('converts <em> to <i> and keeps <strong> and <code> as-is', () => {
    expect(normalizeQuillHtml('<p><strong>bold</strong> <em>italic</em> <code>code</code></p>')).toBe(
      '<strong>bold</strong> <i>italic</i> <code>code</code>',
    );
  });

  it('preserves nested/combined inline formats in either order', () => {
    expect(normalizeQuillHtml('<p><strong><code>both</code></strong></p>')).toBe(
      '<strong><code>both</code></strong>',
    );
  });

  it('converts a soft-break <br> inside a block into a literal newline', () => {
    expect(normalizeQuillHtml('<p>line one<br>line two</p>')).toBe('line one\nline two');
  });

  it('keeps only the href attribute on a link, dropping anything else Quill adds', () => {
    expect(
      normalizeQuillHtml(
        '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer" class="ql-link">click</a></p>',
      ),
    ).toBe('<a href="https://example.com">click</a>');
  });

  it('escapes &, < and > in text content', () => {
    expect(normalizeQuillHtml('<p>a &lt; b &amp; c &gt; d</p>')).toBe('a &lt; b &amp; c &gt; d');
  });

  it('unwraps a tag outside the allowlist while keeping its text', () => {
    expect(normalizeQuillHtml('<p><span class="ql-size-large">big</span> text</p>')).toBe(
      'big text',
    );
  });

  it('drops a single trailing blank line left over from pressing Enter at the end', () => {
    expect(normalizeQuillHtml('<p>hello</p><p><br></p>')).toBe('hello');
  });

  it('returns an empty string for null, undefined or empty input', () => {
    expect(normalizeQuillHtml(null)).toBe('');
    expect(normalizeQuillHtml(undefined)).toBe('');
    expect(normalizeQuillHtml('')).toBe('');
  });
});
