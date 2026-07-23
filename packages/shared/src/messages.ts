import type { GameState, ScoreBreakdown } from './types';

// ---------------------------------------------------------------------------
// Client -> Server messages
// ---------------------------------------------------------------------------

export interface JoinMessage {
  type: 'join';
  token: string;
  instanceId: string;
}

export interface ConfigUpdateMessage {
  type: 'config:update';
  key: string;
  value: number;
}

export interface GameStartMessage {
  type: 'game:start';
}

export interface GifSearchMessage {
  type: 'gif:search';
  query: string;
}

export interface GifSelectMessage {
  type: 'gif:select';
  gifId: string;
  gifUrl: string;
  title: string;
}

export interface GifDeselectMessage {
  type: 'gif:deselect';
  gifId: string;
}

export interface GuessSubmitterMessage {
  type: 'guess:submitter';
  playerId: string;
}

export interface GuessTitleMessage {
  type: 'guess:title';
  text: string;
}

export type ClientMessage =
  | JoinMessage
  | ConfigUpdateMessage
  | GameStartMessage
  | GifSearchMessage
  | GifSelectMessage
  | GifDeselectMessage
  | GuessSubmitterMessage
  | GuessTitleMessage;

// ---------------------------------------------------------------------------
// Server -> Client messages
// ---------------------------------------------------------------------------

/** A GIF result returned from a KLIPY search. */
export interface GifResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  title: string;
  width: number;
  height: number;
}

/** Minimal player info sent with join notifications. */
export interface PlayerInfo {
  id: string;
  username: string;
  avatar: string;
}

export interface StateFullMessage {
  type: 'state:full';
  state: GameState;
}

export interface StatePatchMessage {
  type: 'state:patch';
  patch: Partial<GameState>;
}

export interface SearchResultsMessage {
  type: 'search:results';
  gifs: GifResult[];
}

export interface ErrorMessage {
  type: 'error';
  code: string;
  message: string;
}

export interface PlayerJoinedMessage {
  type: 'player:joined';
  player: PlayerInfo;
}

export interface PlayerLeftMessage {
  type: 'player:left';
  playerId: string;
}

export interface PlayerHostChangedMessage {
  type: 'player:host-changed';
  newHostId: string;
}

export interface TimerTickMessage {
  type: 'timer:tick';
  phase: string;
  remainingMs: number;
}

export interface ScoreRevealMessage {
  type: 'score:reveal';
  breakdown: ScoreBreakdown;
}

export type ServerMessage =
  | StateFullMessage
  | StatePatchMessage
  | SearchResultsMessage
  | ErrorMessage
  | PlayerJoinedMessage
  | PlayerLeftMessage
  | PlayerHostChangedMessage
  | TimerTickMessage
  | ScoreRevealMessage;
