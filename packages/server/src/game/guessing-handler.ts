import type { MysteryPoolEntry, ScoreBreakdown, GameConfig } from '@gif-game/shared';
import { GUESS_TIME_LIMIT_DEFAULT_SECONDS } from '@gif-game/shared';
import { scoreGuess, type ScoringInput, type EmbeddingService } from '../scoring';

export interface TurnState {
  /** Current guesser's player ID */
  currentGuesser: string | null;
  /** Index into the mystery pool for the current GIF */
  currentGifIndex: number;
  /** Index into the turn order for the current round */
  currentTurnIndex: number;
  /** Randomized turn order for the current round */
  turnOrder: string[];
  /** Submitter guess for the current turn (null = not yet guessed, undefined = skipped in 2-player) */
  submitterGuess: string | null | undefined;
  /** Title guess for the current turn (null = not yet guessed) */
  titleGuess: string | null;
  /** Query guess for the current turn (null = not provided) */
  queryGuess: string | null;
  /** Whether the current turn has been scored/finalized */
  turnFinalized: boolean;
}

export interface GuessingResult {
  ok: boolean;
  error?: string;
}

export interface TurnResult {
  hasNext: boolean;
  nextGifIndex?: number;
  nextTurnIndex?: number;
  phaseComplete?: boolean;
}

/**
 * GuessingHandler manages the guessing phase turn mechanics:
 * - Turn order randomization per round
 * - Tracking current guesser and current GIF
 * - Processing submitter and title guesses
 * - Scoring using the scoring module
 * - Advancing turns and determining phase completion
 */
export class GuessingHandler {
  private mysteryPool: MysteryPoolEntry[] = [];
  private playerIds: string[] = [];
  private turnState: TurnState;
  private config: GameConfig;
  private embeddingService: EmbeddingService | null = null;

  constructor(config: GameConfig) {
    this.config = config;
    this.turnState = this.createEmptyTurnState();
  }

  private createEmptyTurnState(): TurnState {
    return {
      currentGuesser: null,
      currentGifIndex: 0,
      currentTurnIndex: 0,
      turnOrder: [],
      submitterGuess: null,
      titleGuess: null,
      queryGuess: null,
      turnFinalized: false,
    };
  }

  /**
   * Initialize the guessing phase with the mystery pool and player list.
   * Randomizes turn order for the first round.
   */
  initialize(
    mysteryPool: MysteryPoolEntry[],
    playerIds: string[],
    embeddingService: EmbeddingService | null = null
  ): void {
    this.mysteryPool = mysteryPool;
    this.playerIds = playerIds;
    this.embeddingService = embeddingService;

    // Randomize initial turn order
    this.turnState = {
      currentGuesser: null,
      currentGifIndex: 0,
      currentTurnIndex: 0,
      turnOrder: this.shuffleArray([...playerIds]),
      submitterGuess: null,
      titleGuess: null,
      queryGuess: null,
      turnFinalized: false,
    };

    this.setCurrentGuesser();
  }

  /**
   * Get the current turn state (for broadcasting to clients).
   */
  getTurnState(): TurnState {
    return { ...this.turnState };
  }

  /**
   * Get the current GIF being guessed.
   */
  getCurrentGif(): MysteryPoolEntry | null {
    return this.mysteryPool[this.turnState.currentGifIndex] ?? null;
  }

  /**
   * Get the current guesser's player ID.
   */
  getCurrentGuesser(): string | null {
    return this.turnState.currentGuesser;
  }

  /**
   * Check if the given player is the current guesser.
   */
  isCurrentGuesser(playerId: string): boolean {
    return this.turnState.currentGuesser === playerId;
  }

  /**
   * Check if all guesses have been made for the current turn.
   */
  isTurnComplete(): boolean {
    const gif = this.getCurrentGif();
    if (!gif) return false;

    // In 2-player games, submitter guess is skipped
    const submitterGuessComplete = 
      this.playerIds.length === 2 || this.turnState.submitterGuess !== null;
    const titleGuessComplete = this.turnState.titleGuess !== null;

    return submitterGuessComplete && titleGuessComplete;
  }

  /**
   * Process a submitter guess from the current guesser.
   */
  guessSubmitter(playerId: string, guessedPlayerId: string): GuessingResult {
    if (!this.isCurrentGuesser(playerId)) {
      return { ok: false, error: 'Not your turn' };
    }

    if (this.turnState.submitterGuess !== null) {
      return { ok: false, error: 'Submitter already guessed' };
    }

    // In 2-player games, submitter guess is skipped
    if (this.playerIds.length === 2) {
      return { ok: false, error: 'Submitter guess skipped in 2-player games' };
    }

    // Validate that the guessed player is in the game
    if (!this.playerIds.includes(guessedPlayerId)) {
      return { ok: false, error: 'Invalid player ID' };
    }

    // Cannot guess yourself (though the GIF might be yours - that's the game!)
    // Actually, you CAN guess yourself if you think the GIF is yours
    // So no validation needed here beyond player existence

    this.turnState.submitterGuess = guessedPlayerId;
    return { ok: true };
  }

  /**
   * Process a title guess from the current guesser.
   * @param playerId - The player making the guess
   * @param title - The title guess
   * @param queryGuess - Optional guess of what search query was used
   */
  guessTitle(playerId: string, title: string, queryGuess?: string): GuessingResult {
    if (!this.isCurrentGuesser(playerId)) {
      return { ok: false, error: 'Not your turn' };
    }

    if (this.turnState.titleGuess !== null) {
      return { ok: false, error: 'Title already guessed' };
    }

    if (!title || title.trim().length === 0) {
      return { ok: false, error: 'Title cannot be empty' };
    }

    this.turnState.titleGuess = title.trim();
    this.turnState.queryGuess = queryGuess?.trim() || null;
    return { ok: true };
  }

  /**
   * Score the current turn and return the breakdown.
   * Should be called after isTurnComplete() returns true.
   */
  async scoreTurn(): Promise<ScoreBreakdown | null> {
    const gif = this.getCurrentGif();
    const guesser = this.turnState.currentGuesser;
    
    if (!gif || !guesser || !this.turnState.titleGuess) {
      return null;
    }

    const input: ScoringInput = {
      playerId: guesser,
      gifTitle: gif.gif.title,
      titleGuess: this.turnState.titleGuess,
      submitterGuess: this.turnState.submitterGuess ?? null,
      actualSubmitter: gif.submitterId,
      playerCount: this.playerIds.length,
      query: gif.gif.query, // The actual search query used
      queryGuess: this.turnState.queryGuess ?? undefined, // Player's guess of the query
    };

    return scoreGuess(input, this.embeddingService);
  }

  /**
   * Advance to the next turn or GIF.
   * Returns information about what's next.
   */
  advanceTurn(): TurnResult {
    this.turnState.turnFinalized = true;

    const nextTurnIndex = this.turnState.currentTurnIndex + 1;

    // Check if we have more potential guessers for the current GIF
    if (nextTurnIndex < this.turnState.turnOrder.length) {
      // Try to find the next valid guesser
      this.turnState.currentTurnIndex = nextTurnIndex;
      this.resetTurnGuesses();
      this.setCurrentGuesser();

      // If setCurrentGuesser found a valid guesser, we have more turns
      if (this.turnState.currentGuesser !== null) {
        return {
          hasNext: true,
          nextTurnIndex: this.turnState.currentTurnIndex,
          nextGifIndex: this.turnState.currentGifIndex,
        };
      }
      // Otherwise, fall through to try the next GIF
    }

    // All guessers done for this GIF, move to next GIF
    const nextGifIndex = this.turnState.currentGifIndex + 1;

    if (nextGifIndex < this.mysteryPool.length) {
      // More GIFs to guess
      this.turnState.currentGifIndex = nextGifIndex;
      this.turnState.currentTurnIndex = 0;
      // Re-randomize turn order for the new round
      this.turnState.turnOrder = this.shuffleArray([...this.playerIds]);
      this.resetTurnGuesses();
      this.setCurrentGuesser();

      // If setCurrentGuesser found a valid guesser, we have more turns
      if (this.turnState.currentGuesser !== null) {
        return {
          hasNext: true,
          nextGifIndex,
          nextTurnIndex: 0,
        };
      }
      // Edge case: No valid guessers for this GIF either - shouldn't happen in practice
      // but handle gracefully by trying the next GIF (recursive case)
    }

    // No more GIFs - phase complete
    return {
      hasNext: false,
      phaseComplete: true,
    };
  }

  /**
   * Handle turn timeout - auto-submit empty guesses and advance.
   */
  handleTimeout(): TurnResult {
    // If no submitter guess yet (and not 2-player), mark as skipped
    if (this.turnState.submitterGuess === null && this.playerIds.length > 2) {
      this.turnState.submitterGuess = null; // Explicitly null (wrong guess)
    }

    // If no title guess yet, use empty string (will score 0)
    if (this.turnState.titleGuess === null) {
      this.turnState.titleGuess = '';
    }

    return this.advanceTurn();
  }

  /**
   * Get the time limit for a guess turn.
   */
  getGuessTimeLimit(): number {
    return this.config.guessTimeLimit ?? GUESS_TIME_LIMIT_DEFAULT_SECONDS;
  }

  /**
   * Reset the handler for a new game.
   */
  reset(config: GameConfig): void {
    this.config = config;
    this.mysteryPool = [];
    this.playerIds = [];
    this.embeddingService = null;
    this.turnState = this.createEmptyTurnState();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private setCurrentGuesser(): void {
    const { turnOrder, currentTurnIndex, currentGifIndex } = this.turnState;
    const currentGif = this.mysteryPool[currentGifIndex];

    if (!currentGif || currentTurnIndex >= turnOrder.length) {
      this.turnState.currentGuesser = null;
      return;
    }

    // Get the next guesser
    let guesser = turnOrder[currentTurnIndex];

    // Skip the submitter (can't guess your own GIF)
    if (guesser === currentGif.submitterId) {
      // Move to next in turn order
      const nextIndex = currentTurnIndex + 1;
      if (nextIndex < turnOrder.length) {
        this.turnState.currentTurnIndex = nextIndex;
        guesser = turnOrder[nextIndex];
        // Recursively check in case next is also submitter (shouldn't happen but safety)
        if (guesser === currentGif.submitterId) {
          this.turnState.currentGuesser = null;
          return;
        }
      } else {
        // No more guessers
        this.turnState.currentGuesser = null;
        return;
      }
    }

    this.turnState.currentGuesser = guesser;
  }

  private resetTurnGuesses(): void {
    this.turnState.submitterGuess = null;
    this.turnState.titleGuess = null;
    this.turnState.queryGuess = null;
    this.turnState.turnFinalized = false;
  }

  /**
   * Fisher-Yates shuffle.
   */
  private shuffleArray<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
