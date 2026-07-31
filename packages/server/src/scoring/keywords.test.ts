import { describe, it, expect } from 'vitest';
import { STOP_WORDS, extractKeywords, findMatchingKeywords } from './keywords';

describe('STOP_WORDS', () => {
  it('should include common articles', () => {
    expect(STOP_WORDS.has('a')).toBe(true);
    expect(STOP_WORDS.has('an')).toBe(true);
    expect(STOP_WORDS.has('the')).toBe(true);
  });

  it('should include common prepositions', () => {
    expect(STOP_WORDS.has('in')).toBe(true);
    expect(STOP_WORDS.has('on')).toBe(true);
    expect(STOP_WORDS.has('to')).toBe(true);
    expect(STOP_WORDS.has('with')).toBe(true);
  });

  it('should include common conjunctions', () => {
    expect(STOP_WORDS.has('and')).toBe(true);
    expect(STOP_WORDS.has('or')).toBe(true);
    expect(STOP_WORDS.has('but')).toBe(true);
  });

  it('should include pronouns', () => {
    expect(STOP_WORDS.has('i')).toBe(true);
    expect(STOP_WORDS.has('you')).toBe(true);
    expect(STOP_WORDS.has('he')).toBe(true);
    expect(STOP_WORDS.has('they')).toBe(true);
  });

  it('should include common GIF-specific words', () => {
    expect(STOP_WORDS.has('gif')).toBe(true);
    expect(STOP_WORDS.has('meme')).toBe(true);
    expect(STOP_WORDS.has('reaction')).toBe(true);
  });
});

describe('extractKeywords', () => {
  it('should extract meaningful words from text', () => {
    const result = extractKeywords('A happy dancing cat');
    expect(result).toEqual(['happy', 'dancing', 'cat']);
  });

  it('should convert to lowercase', () => {
    const result = extractKeywords('Happy DANCING Cat');
    expect(result).toEqual(['happy', 'dancing', 'cat']);
  });

  it('should filter out stop words', () => {
    const result = extractKeywords('the cat is on the mat');
    expect(result).toEqual(['cat', 'mat']);
  });

  it('should filter out short words (1-2 chars)', () => {
    const result = extractKeywords('I am a happy cat');
    expect(result).toEqual(['happy', 'cat']);
  });

  it('should remove punctuation', () => {
    const result = extractKeywords("It's a cat's world! (amazing)");
    expect(result).toEqual(['cat', 'world', 'amazing']);
  });

  it('should handle empty string', () => {
    expect(extractKeywords('')).toEqual([]);
  });

  it('should handle null/undefined', () => {
    expect(extractKeywords(null as any)).toEqual([]);
    expect(extractKeywords(undefined as any)).toEqual([]);
  });

  it('should handle string with only stop words', () => {
    expect(extractKeywords('the a an in on')).toEqual([]);
  });

  it('should handle multiple spaces', () => {
    const result = extractKeywords('happy   dancing    cat');
    expect(result).toEqual(['happy', 'dancing', 'cat']);
  });

  it('should extract keywords from GIF titles', () => {
    const result = extractKeywords('Funny Cat Dancing GIF - Reaction Meme');
    expect(result).toEqual(['funny', 'cat', 'dancing']);
  });
});

describe('findMatchingKeywords', () => {
  it('should find common keywords between two arrays', () => {
    const keywords1 = ['happy', 'cat', 'dancing'];
    const keywords2 = ['cat', 'jumping', 'happy'];
    const result = findMatchingKeywords(keywords1, keywords2);
    expect(result).toEqual(['happy', 'cat']);
  });

  it('should return empty array when no matches', () => {
    const keywords1 = ['happy', 'cat'];
    const keywords2 = ['sad', 'dog'];
    const result = findMatchingKeywords(keywords1, keywords2);
    expect(result).toEqual([]);
  });

  it('should return empty array for empty inputs', () => {
    expect(findMatchingKeywords([], [])).toEqual([]);
    expect(findMatchingKeywords(['cat'], [])).toEqual([]);
    expect(findMatchingKeywords([], ['cat'])).toEqual([]);
  });

  it('should handle duplicates in first array', () => {
    const keywords1 = ['cat', 'cat', 'dog'];
    const keywords2 = ['cat', 'bird'];
    const result = findMatchingKeywords(keywords1, keywords2);
    expect(result).toEqual(['cat', 'cat']);
  });

  it('should be case-sensitive (expects lowercase input)', () => {
    const keywords1 = ['Cat', 'dog'];
    const keywords2 = ['cat', 'bird'];
    const result = findMatchingKeywords(keywords1, keywords2);
    expect(result).toEqual([]);
  });
});
