import type { GameConfig } from '@gif-game/shared';
import {
  DEFAULT_ROUNDS,
  GUESS_TIME_LIMIT_DEFAULT_SECONDS,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_GUESS_TIME,
  MAX_GUESS_TIME,
  MIN_SUBMISSION_TIME,
  MAX_SUBMISSION_TIME,
  DEFAULT_SUBMISSION_TIME,
} from '@gif-game/shared';

/**
 * Creates a default game configuration with all values at their defaults.
 */
export function createDefaultConfig(): GameConfig {
  return {
    roundCount: DEFAULT_ROUNDS,
    guessTimeLimit: GUESS_TIME_LIMIT_DEFAULT_SECONDS,
    submissionTimeLimit: DEFAULT_SUBMISSION_TIME,
    queryGuessEnabled: true,
  };
}

export interface ValidationError {
  field: string;
  message: string;
}

export type ValidateConfigResult =
  | { ok: true; config: GameConfig }
  | { ok: false; errors: ValidationError[] };

/**
 * Validates a partial config update and returns a full GameConfig with bounds enforced.
 * Merges the update on top of the current config (or defaults if not provided).
 */
export function validateConfig(
  update: Partial<GameConfig>,
  current?: GameConfig
): ValidateConfigResult {
  const base = current ?? createDefaultConfig();
  const errors: ValidationError[] = [];

  let roundCount = base.roundCount;
  let guessTimeLimit = base.guessTimeLimit;

  // Validate roundCount
  if (update.roundCount !== undefined) {
    if (
      typeof update.roundCount !== 'number' ||
      !Number.isInteger(update.roundCount)
    ) {
      errors.push({
        field: 'roundCount',
        message: `roundCount must be an integer`,
      });
    } else if (update.roundCount < MIN_ROUNDS || update.roundCount > MAX_ROUNDS) {
      errors.push({
        field: 'roundCount',
        message: `roundCount must be between ${MIN_ROUNDS} and ${MAX_ROUNDS}`,
      });
    } else {
      roundCount = update.roundCount;
    }
  }

  // Validate guessTimeLimit
  if (update.guessTimeLimit !== undefined) {
    if (
      typeof update.guessTimeLimit !== 'number' ||
      !Number.isInteger(update.guessTimeLimit)
    ) {
      errors.push({
        field: 'guessTimeLimit',
        message: `guessTimeLimit must be an integer`,
      });
    } else if (
      update.guessTimeLimit < MIN_GUESS_TIME ||
      update.guessTimeLimit > MAX_GUESS_TIME
    ) {
      errors.push({
        field: 'guessTimeLimit',
        message: `guessTimeLimit must be between ${MIN_GUESS_TIME} and ${MAX_GUESS_TIME}`,
      });
    } else {
      guessTimeLimit = update.guessTimeLimit;
    }
  }

  // Validate submissionTimeLimit
  let submissionTimeLimit = base.submissionTimeLimit;
  if (update.submissionTimeLimit !== undefined) {
    if (
      typeof update.submissionTimeLimit !== 'number' ||
      !Number.isInteger(update.submissionTimeLimit)
    ) {
      errors.push({
        field: 'submissionTimeLimit',
        message: `submissionTimeLimit must be an integer`,
      });
    } else if (
      update.submissionTimeLimit < MIN_SUBMISSION_TIME ||
      update.submissionTimeLimit > MAX_SUBMISSION_TIME
    ) {
      errors.push({
        field: 'submissionTimeLimit',
        message: `submissionTimeLimit must be between ${MIN_SUBMISSION_TIME} and ${MAX_SUBMISSION_TIME}`,
      });
    } else {
      submissionTimeLimit = update.submissionTimeLimit;
    }
  }

  // Validate queryGuessEnabled - REMOVED: now always enabled
  // Query matching uses the same guess as title matching

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: {
      roundCount,
      guessTimeLimit,
      submissionTimeLimit,
      queryGuessEnabled: true, // Always enabled
    },
  };
}
