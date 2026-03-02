import { describe, it, expect } from 'vitest';
import { isWorkflowyExportHTML, parseWorkflowyExportHTML, extractTextFromHTML } from './file-extractors';

// ─── isWorkflowyExportHTML ──────────────────────────────────────

describe('isWorkflowyExportHTML', () => {
  it('returns true for HTML with data-wfid', () => {
    expect(isWorkflowyExportHTML('<div class="name" data-wfid="abc123">Test</div>')).toBe(true);
  });

  it('returns true for HTML with data-chid', () => {
    expect(isWorkflowyExportHTML('<div class="name" data-chid="xyz789">Test</div>')).toBe(true);
  });

  it('returns false for regular HTML', () => {
    expect(isWorkflowyExportHTML('<div class="container"><p>Hello</p></div>')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isWorkflowyExportHTML('')).toBe(false);
  });
});

// ─── parseWorkflowyExportHTML ───────────────────────────────────

describe('parseWorkflowyExportHTML', () => {
  it('parses a single li into one root node', () => {
    const html = `<ul><li><div class="name" data-wfid="abc"><span class="innerContentContainer">Hello World</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].name).toBe('Hello World');
  });

  it('parses nested li into tree structure', () => {
    const html = `
      <ul>
        <li>
          <div class="name" data-wfid="parent"><span class="innerContentContainer">Parent</span></div>
          <ul>
            <li><div class="name" data-wfid="child"><span class="innerContentContainer">Child</span></div></li>
          </ul>
        </li>
      </ul>
    `;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy).toHaveLength(1);
    expect(hierarchy[0].children).toHaveLength(1);
    expect(hierarchy[0].children[0].name).toBe('Child');
  });

  it('extracts name from innerContentContainer', () => {
    const html = `<ul><li><div class="name" data-wfid="x"><span class="innerContentContainer">My Node Name</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].name).toBe('My Node Name');
  });

  it('extracts note from note span', () => {
    const html = `
      <ul><li>
        <div class="name" data-wfid="x"><span class="innerContentContainer">Title</span></div>
        <span class="note"><span class="innerContentContainer">This is a note</span></span>
      </li></ul>
    `;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].note).toBe('This is a note');
  });

  it('extracts URL from href in content', () => {
    const html = `
      <ul><li>
        <div class="name" data-wfid="x"><span class="innerContentContainer">Link: <a href="https://example.com">source</a></span></div>
      </li></ul>
    `;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].extractedUrl).toBe('https://example.com');
  });

  it('detects DOK1 marker', () => {
    const html = `<ul><li><div class="name" data-wfid="x"><span class="innerContentContainer">DOK 1 Facts</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].isDOK1Marker).toBe(true);
  });

  it('detects Source marker', () => {
    const html = `<ul><li><div class="name" data-wfid="x"><span class="innerContentContainer">Source 1</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].isSourceMarker).toBe(true);
  });

  it('detects Category marker', () => {
    const html = `<ul><li><div class="name" data-wfid="x"><span class="innerContentContainer">Category 1</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].isCategoryMarker).toBe(true);
  });

  it('detects Purpose marker', () => {
    const html = `<ul><li><div class="name" data-wfid="x"><span class="innerContentContainer">Purpose</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].isPurposeMarker).toBe(true);
  });

  it('uses data-wfid as node ID', () => {
    const html = `<ul><li><div class="name" data-wfid="my-unique-id"><span class="innerContentContainer">Node</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].id).toBe('my-unique-id');
  });

  it('generates markdown with heading levels', () => {
    const html = `
      <ul>
        <li>
          <div class="name" data-wfid="root"><span class="innerContentContainer">Root</span></div>
          <ul>
            <li><div class="name" data-wfid="child"><span class="innerContentContainer">Child</span></div></li>
          </ul>
        </li>
      </ul>
    `;
    const { markdown } = parseWorkflowyExportHTML(html);
    expect(markdown).toContain('# Root');
    expect(markdown).toContain('## Child');
  });

  it('skips empty-named nodes', () => {
    const html = `
      <ul>
        <li><div class="name" data-wfid="a"><span class="innerContentContainer">Valid</span></div></li>
        <li><div class="name" data-wfid="b"><span class="innerContentContainer"></span></div></li>
      </ul>
    `;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    // Empty-named nodes should be excluded
    expect(hierarchy.every(n => n.name.length > 0)).toBe(true);
  });
});

// ─── extractTextFromHTML ────────────────────────────────────────

describe('extractTextFromHTML', () => {
  it('extracts text from paragraph', () => {
    expect(extractTextFromHTML('<p>Hello world</p>')).toBe('Hello world');
  });

  it('preserves list indentation', () => {
    const html = '<ul><li>Item 1</li><li>Item 2</li></ul>';
    const result = extractTextFromHTML(html);
    expect(result).toContain('- Item 1');
    expect(result).toContain('- Item 2');
  });

  it('handles nested lists with correct indentation', () => {
    const html = '<ul><li>Parent<ul><li>Child</li></ul></li></ul>';
    const result = extractTextFromHTML(html);
    const lines = result.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe('- Parent');
    expect(lines[1]).toBe('  - Child');
  });

  it('strips script tags', () => {
    const html = '<p>Before</p><script>alert("xss")</script><p>After</p>';
    const result = extractTextFromHTML(html);
    expect(result).not.toContain('alert');
    expect(result).toContain('Before');
    expect(result).toContain('After');
  });

  it('strips style tags', () => {
    const html = '<style>.red{color:red}</style><p>Content</p>';
    const result = extractTextFromHTML(html);
    expect(result).not.toContain('color');
    expect(result).toContain('Content');
  });

  it('strips HTML comments', () => {
    const html = '<!-- comment --><p>Visible</p>';
    const result = extractTextFromHTML(html);
    expect(result).not.toContain('comment');
    expect(result).toContain('Visible');
  });

  it('decodes HTML entities', () => {
    const html = '<p>Tom &amp; Jerry &lt;3&gt;</p>';
    const result = extractTextFromHTML(html);
    expect(result).toContain('Tom & Jerry <3>');
  });

  it('converts br to space', () => {
    const html = '<p>Line1<br>Line2</p>';
    const result = extractTextFromHTML(html);
    expect(result).toContain('Line1');
    expect(result).toContain('Line2');
  });

  it('returns empty string for empty input', () => {
    expect(extractTextFromHTML('')).toBe('');
  });
});

// ─── parseWorkflowyExportHTML: text after last tag ──────────────

describe('parseWorkflowyExportHTML text boundary', () => {
  it('preserves text after the last HTML tag in a node name', () => {
    const html = `<ul><li><div class="name" data-wfid="x"><span class="innerContentContainer"><b>bold</b> trailing text</span></div></li></ul>`;
    const { hierarchy } = parseWorkflowyExportHTML(html);
    expect(hierarchy[0].name).toContain('trailing text');
  });
});
