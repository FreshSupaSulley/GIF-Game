import type { GameConfig, PlayerSubmission, SelectedGif } from '@gif-game/shared';

export interface SubmissionResult {
  ok: boolean;
  error?: string;
}

/**
 * Manages the submission phase: selecting/deselecting GIFs, finalization,
 * and handling timeouts.
 */
export class SubmissionHandler {
  private submissions: Map<string, PlayerSubmission> = new Map();
  private config: GameConfig;

  constructor(config: GameConfig) {
    this.config = config;
  }

  /** Resets the handler for a new submission phase. */
  reset(config: GameConfig): void {
    this.config = config;
    this.submissions.clear();
  }

  /** Returns the current submissions map. */
  getSubmissions(): Map<string, PlayerSubmission> {
    return this.submissions;
  }

  /** Returns a specific player's submission, or undefined. */
  getPlayerSubmission(playerId: string): PlayerSubmission | undefined {
    return this.submissions.get(playerId);
  }

  /** Returns true if all given players have finalized their submissions. */
  allFinalized(playerIds: string[]): boolean {
    return playerIds.every((id) => {
      const sub = this.submissions.get(id);
      return sub?.finalized === true;
    });
  }

  /**
   * Selects a GIF for a player.
   * Auto-finalizes when the player reaches the required round count.
   */
  selectGif(playerId: string, gif: SelectedGif): SubmissionResult {
    const submission = this.getOrCreateSubmission(playerId);

    if (submission.finalized) {
      return { ok: false, error: 'Submission already finalized' };
    }

    if (submission.gifs.length >= this.config.roundCount) {
      return { ok: false, error: `Maximum ${this.config.roundCount} GIFs allowed` };
    }

    // Check for duplicate
    if (submission.gifs.some((g) => g.id === gif.id)) {
      return { ok: false, error: 'GIF already selected' };
    }

    submission.gifs.push(gif);

    // Auto-finalize when count reaches roundCount
    if (submission.gifs.length >= this.config.roundCount) {
      submission.finalized = true;
    }

    return { ok: true };
  }

  /**
   * Removes a previously selected GIF before finalization.
   */
  deselectGif(playerId: string, gifId: string): SubmissionResult {
    const submission = this.submissions.get(playerId);

    if (!submission) {
      return { ok: false, error: 'No submission found' };
    }

    if (submission.finalized) {
      return { ok: false, error: 'Cannot deselect after finalization' };
    }

    const index = submission.gifs.findIndex((g) => g.id === gifId);
    if (index === -1) {
      return { ok: false, error: 'GIF not found in selection' };
    }

    submission.gifs.splice(index, 1);
    return { ok: true };
  }

  /**
   * Manually finalizes a player's submission (e.g., they clicked "done" early).
   */
  finalize(playerId: string): SubmissionResult {
    const submission = this.submissions.get(playerId);

    if (!submission) {
      return { ok: false, error: 'No submission found' };
    }

    if (submission.finalized) {
      return { ok: false, error: 'Already finalized' };
    }

    if (submission.gifs.length === 0) {
      return { ok: false, error: 'Cannot finalize with no GIFs selected' };
    }

    submission.finalized = true;
    return { ok: true };
  }

  /**
   * Handles submission timeout: fills remaining slots with provided GIFs
   * and marks all unfinalized players as finalized.
   * @param playerIds - All player IDs that should have submissions
   * @param getRandomGifs - Function to get random GIFs for auto-fill
   * @returns Map of player IDs to the number of GIFs that were auto-filled
   */
  async handleTimeout(
    playerIds: string[],
    getRandomGifs: (count: number) => Promise<SelectedGif[]>
  ): Promise<Map<string, number>> {
    const autoFilled = new Map<string, number>();

    for (const playerId of playerIds) {
      const submission = this.getOrCreateSubmission(playerId);

      if (submission.finalized) {
        continue;
      }

      const remaining = this.config.roundCount - submission.gifs.length;

      if (remaining > 0) {
        const randomGifs = await getRandomGifs(remaining);
        submission.gifs.push(...randomGifs);
        autoFilled.set(playerId, randomGifs.length);
      }

      submission.finalized = true;
    }

    return autoFilled;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private getOrCreateSubmission(playerId: string): PlayerSubmission {
    let submission = this.submissions.get(playerId);
    if (!submission) {
      submission = {
        playerId,
        gifs: [],
        finalized: false,
      };
      this.submissions.set(playerId, submission);
    }
    return submission;
  }
}
