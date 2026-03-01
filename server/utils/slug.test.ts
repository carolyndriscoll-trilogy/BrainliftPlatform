import { describe, it, expect, vi } from 'vitest';

vi.mock('../storage', () => ({ storage: {} }));

import { generateSlug } from './slug';

describe('generateSlug', () => {
  it('lowercases the title', () => {
    expect(generateSlug('Hello World')).toBe('hello-world');
  });

  it('replaces spaces with hyphens', () => {
    expect(generateSlug('my cool brainlift')).toBe('my-cool-brainlift');
  });

  it('strips special characters', () => {
    expect(generateSlug('hello! @world #2024')).toBe('hello-world-2024');
  });

  it('removes leading and trailing hyphens', () => {
    expect(generateSlug('---hello---')).toBe('hello');
  });

  it('collapses consecutive special chars into single hyphen', () => {
    expect(generateSlug('a!!!b')).toBe('a-b');
  });

  it('returns empty string for empty input', () => {
    expect(generateSlug('')).toBe('');
  });

  it('returns empty string for only special characters', () => {
    expect(generateSlug('!@#$%')).toBe('');
  });
});
