import type { GamePhase } from './phases';

/** Server-authoritative game state for a single room. */
export interface GameState {
  roomId: string;
  instanceId: string;
  phase: GamePhase;
  config: GameConfig;
  players: Record<string, Player>;
  hostId: string;

  // Submission phase
  submissions: Record<string, PlayerSubmission>;
  submissionTimer: TimerState | null;

  // Guessing phase
  mysteryPool: MysteryPoolEntry[];
  currentRound: number;
  currentTurnIndex: number;
  turnOrder: string[];
  currentGifIndex: number;
  guessTimer: TimerState | null;

  // Scoring
  scores: Record<string, number>;
}

/** Host-configurable game parameters. */
export interface GameConfig {
  /** Number of guessing rounds (1-10, default 3). */
  roundCount: number;
  /** Seconds allowed per guess (10-60, default 30). */
  guessTimeLimit: number;
  /** Calculated: 15 + 10 * (roundCount - 1). */
  submissionTimeLimit: number;
  /** Whether players must guess the search query used (default false). */
  queryGuessEnabled: boolean;
}

/** A player connected to the game room. */
export interface Player {
  id: string;
  username: string;
  avatar: string;
  connected: boolean;
  disconnectedAt: number | null;
  joinOrder: number;
}

/** A player's GIF selections during the submission phase. */
export interface PlayerSubmission {
  playerId: string;
  gifs: SelectedGif[];
  finalized: boolean;
}

/** A GIF selected from KLIPY by a player. */
export interface SelectedGif {
  id: string;
  url: string;
  thumbnailUrl: string;
  /** GIF title metadata from KLIPY (defaults to "Untitled GIF" if absent). */
  title: string;
  /** The search query used to find this GIF (for query-based scoring). */
  query?: string;
}

/** An anonymous entry in the mystery pool shown during guessing. */
export interface MysteryPoolEntry {
  gif: SelectedGif;
  /** Player who submitted this GIF (hidden from clients until resolved). */
  submitterId: string;
  resolved: boolean;
  /** The search query used to find this GIF (for scoring). */
  query?: string;
}

/** Countdown timer state attached to a phase. */
export interface TimerState {
  startedAt: number;
  durationMs: number;
  remainingMs: number;
}

/** Detailed scoring breakdown revealed after each guess. */
export interface ScoreBreakdown {
  playerId: string;
  gifTitle: string;
  guess: string;
  /** Whether the guesser correctly identified the submitter (null if skipped in 2-player games). */
  submitterGuessCorrect: boolean | null;
  submitterPoints: number;
  exactKeywords: string[];
  exactMatchPoints: number;
  semanticScore: number;
  semanticPoints: number;
  /** The search query used to find this GIF (if available). */
  queryUsed?: string;
  /** Keywords matched against the query. */
  queryKeywords: string[];
  /** Points earned from query keyword matches. */
  queryMatchPoints: number;
  /** Semantic similarity score against the query. */
  querySemanticScore: number;
  /** Points earned from query semantic similarity. */
  querySemanticPoints: number;
  totalPoints: number;
}
