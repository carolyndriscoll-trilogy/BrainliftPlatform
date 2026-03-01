import { describe, it, expect } from 'vitest';
import { getIndentLevel, cleanHeader, extractUrl, truncatePurpose } from './brainliftExtractor';

describe('getIndentLevel', () => {
  it('returns 0 for no leading spaces', () => {
    expect(getIndentLevel('hello')).toBe(0);
  });

  it('returns 2 for two leading spaces', () => {
    expect(getIndentLevel('  hello')).toBe(2);
  });

  it('returns 4 for four leading spaces', () => {
    expect(getIndentLevel('    hello')).toBe(4);
  });

  it('returns 0 for empty string', () => {
    expect(getIndentLevel('')).toBe(0);
  });
});

describe('cleanHeader', () => {
  it('strips bullet prefix', () => {
    expect(cleanHeader('- Category 1')).toBe('Category 1');
  });

  it('strips markdown heading prefix', () => {
    expect(cleanHeader('## Category 1')).toBe('Category 1');
  });

  it('strips bold markers', () => {
    expect(cleanHeader('## **Category 1**')).toBe('Category 1');
  });

  it('strips trailing colon', () => {
    expect(cleanHeader('Category 1:')).toBe('Category 1');
  });

  it('strips combined formatting', () => {
    expect(cleanHeader('  - ## **Category 1:**')).toBe('Category 1');
  });

  it('strips asterisk bullets', () => {
    expect(cleanHeader('* Source 2')).toBe('Source 2');
  });

  it('strips dot bullets', () => {
    expect(cleanHeader('• Source 3')).toBe('Source 3');
  });
});

describe('extractUrl', () => {
  it('extracts http URL', () => {
    expect(extractUrl('Visit http://example.com for info')).toBe('http://example.com');
  });

  it('extracts https URL', () => {
    expect(extractUrl('Link: https://example.com/path?q=1')).toBe('https://example.com/path?q=1');
  });

  it('returns null when no URL present', () => {
    expect(extractUrl('No links here')).toBeNull();
  });

  it('extracts URL from middle of text', () => {
    expect(extractUrl('See https://test.org/page for details.')).toBe('https://test.org/page');
  });
});

describe('truncatePurpose', () => {
  it('returns text unchanged when under max length', () => {
    const short = 'A short purpose statement.';
    expect(truncatePurpose(short)).toBe(short);
  });

  it('cuts at sentence boundary (period)', () => {
    const text = 'First sentence about education. Second sentence about learning that extends the text beyond the limit.';
    const result = truncatePurpose(text, 50);
    expect(result).toBe('First sentence about education.');
  });

  it('cuts at sentence boundary (question mark)', () => {
    const text = 'Is this the main question? Here is some additional context that extends the length well beyond the maximum.';
    const result = truncatePurpose(text, 40);
    expect(result).toBe('Is this the main question?');
  });

  it('cuts at word boundary with ellipsis when no sentence end found', () => {
    const text = 'A really long continuous statement without any sentence ending punctuation that just keeps going on and on about various topics in education';
    const result = truncatePurpose(text, 60);
    expect(result).toMatch(/\.\.\.$/);
    expect(result.length).toBeLessThanOrEqual(64); // max + "..."
  });

  it('respects custom maxLength', () => {
    const text = 'Short. But this second sentence makes it longer than twenty characters for sure.';
    const result = truncatePurpose(text, 20);
    expect(result.length).toBeLessThanOrEqual(24); // max + "..."
  });
});
