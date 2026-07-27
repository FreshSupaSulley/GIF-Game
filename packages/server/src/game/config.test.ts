import { describe, it, expect } from 'vitest';
import {
  validateConfig,
  createDefaultConfig,
  calculateSubmissionTimeLimit,
} from './config';

describe('calculateSubmissionTimeLimit', () => {
  it('returns 15 for 1 round', () => {
    expect(calculateSubmissionTimeLimit(1)).toBe(15);
  });

  it('returns 25 for 2 rounds', () => {
    expect(calculateSubmissionTimeLimit(2)).toBe(25);
  });

  it('returns 35 for 3 rounds (default)', () => {
    expect(calculateSubmissionTimeLimit(3)).toBe(35);
  });

  it('returns 105 for 10 rounds (max)', () => {
    expect(calculateSubmissionTimeLimit(10)).toBe(105);
  });
});

describe('createDefaultConfig', () => {
  it('returns correct defaults', () => {
    const config = createDefaultConfig();
    expect(config.roundCount).toBe(3);
    expect(config.guessTimeLimit).toBe(30);
    expect(config.submissionTimeLimit).toBe(35);
  });
});

describe('validateConfig', () => {
  it('accepts valid roundCount update', () => {
    const result = validateConfig({ roundCount: 5 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.roundCount).toBe(5);
      expect(result.config.submissionTimeLimit).toBe(55);
    }
  });

  it('accepts valid guessTimeLimit update', () => {
    const result = validateConfig({ guessTimeLimit: 45 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.guessTimeLimit).toBe(45);
    }
  });

  it('rejects roundCount below MIN_ROUNDS', () => {
    const result = validateConfig({ roundCount: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe('roundCount');
    }
  });

  it('rejects roundCount above MAX_ROUNDS', () => {
    const result = validateConfig({ roundCount: 11 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe('roundCount');
    }
  });

  it('rejects non-integer roundCount', () => {
    const result = validateConfig({ roundCount: 2.5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe('roundCount');
    }
  });

  it('rejects guessTimeLimit below MIN_GUESS_TIME', () => {
    const result = validateConfig({ guessTimeLimit: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe('guessTimeLimit');
    }
  });

  it('rejects guessTimeLimit above MAX_GUESS_TIME', () => {
    const result = validateConfig({ guessTimeLimit: 120 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].field).toBe('guessTimeLimit');
    }
  });

  it('collects multiple errors', () => {
    const result = validateConfig({ roundCount: 0, guessTimeLimit: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
    }
  });

  it('merges onto provided current config', () => {
    const current = createDefaultConfig();
    current.roundCount = 7;
    current.guessTimeLimit = 45;
    current.submissionTimeLimit = calculateSubmissionTimeLimit(7);

    const result = validateConfig({ guessTimeLimit: 20 }, current);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // roundCount stays at 7 from current
      expect(result.config.roundCount).toBe(7);
      expect(result.config.guessTimeLimit).toBe(20);
      expect(result.config.submissionTimeLimit).toBe(75);
    }
  });

  it('ignores client-supplied submissionTimeLimit', () => {
    const result = validateConfig({ submissionTimeLimit: 999 } as any);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Should be calculated from defaults, not 999
      expect(result.config.submissionTimeLimit).toBe(35);
    }
  });

  it('accepts boundary values (MIN and MAX)', () => {
    const minResult = validateConfig({ roundCount: 1, guessTimeLimit: 10 });
    expect(minResult.ok).toBe(true);

    const maxResult = validateConfig({ roundCount: 10, guessTimeLimit: 60 });
    expect(maxResult.ok).toBe(true);
  });

  it('returns defaults when empty update is provided', () => {
    const result = validateConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config).toEqual(createDefaultConfig());
    }
  });
});
