import type { GameConfig } from '@gif-game/shared';
import {
  DEFAULT_ROUNDS,
  GUESS_TIME_LIMIT_DEFAULT_SECONDS,
  MIN_ROUNDS,
  MAX_ROUNDS,
  MIN_GUESS_TIME,
  MAX_GUESS_TIME,
  SUBMISSION_FIRST_GIF_TIME_SECONDS,
  SUBMISSION_ADDITIONAL_GIF_TIME_SECONDS,
} from '@gif-game/shared';

/**
 * Calculates the submission phase time limit based on round count.
 * Formula: SUBMISSION_FIRST_GIF_TIME_SECONDS + SUBMISSION_ADDITIONAL_GIF_TIME_SECONDS * (roundCount - 1)
 */
export function calculateSubmissionTimeLimit(roundCount: number): number {
  return (
    SUBMISSION_FIRST_GIF_TIME_SECONDS +
    SUBMISSION_ADDITIONAL_GIF_TIME_SECONDS * (roundCount - 1)
  );
}

/**
 * Creates a default game configuration with all values at their defaults.
 */
export function createDefaultConfig(): GameConfig {
  const roundCount = DEFAULT_ROUNDS;
  return {
    roundCount,
    guessTimeLimit: GUESS_TIME_LIMIT_DEFAULT_SECONDS,
    submissionTimeLimit: calculateSubmissionTimeLimit(roundCount),
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
  let queryGuessEnabled = base.queryGuessEnabled;

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

  // Validate queryGuessEnabled (boolean)
  if (update.queryGuessEnabled !== undefined) {
    if (typeof update.queryGuessEnabled !== 'boolean') {
      errors.push({
        field: 'queryGuessEnabled',
        message: `queryGuessEnabled must be a boolean`,
      });
    } else {
      queryGuessEnabled = update.queryGuessEnabled;
    }
  }

  // submissionTimeLimit is always derived — ignore any client-supplied value
  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    config: {
      roundCount,
      guessTimeLimit,
      submissionTimeLimit: calculateSubmissionTimeLimit(roundCount),
      queryGuessEnabled,
    },
  };
}
