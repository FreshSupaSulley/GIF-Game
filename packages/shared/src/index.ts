// Barrel file for @gif-game/shared

export * from './constants';

export type { GamePhase } from './phases';

export type {
  GameState,
  GameConfig,
  Player,
  PlayerSubmission,
  SelectedGif,
  MysteryPoolEntry,
  TimerState,
  ScoreBreakdown,
} from './types';

export type {
  ClientMessage,
  JoinMessage,
  ConfigUpdateMessage,
  GameStartMessage,
  GifSearchMessage,
  GifSelectMessage,
  GifDeselectMessage,
  GuessSubmitterMessage,
  GuessTitleMessage,
  ServerMessage,
  StateFullMessage,
  StatePatchMessage,
  SearchResultsMessage,
  ErrorMessage,
  PlayerJoinedMessage,
  PlayerLeftMessage,
  PlayerHostChangedMessage,
  TimerTickMessage,
  ScoreRevealMessage,
  GifResult,
  PlayerInfo,
} from './messages';
