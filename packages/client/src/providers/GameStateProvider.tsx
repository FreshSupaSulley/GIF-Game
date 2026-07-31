import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import type {
  GameState,
  GameConfig,
  Player,
  GamePhase,
  MysteryPoolEntry,
} from '@gif-game/shared';
import { useWebSocket, useSubscription } from './WebSocketProvider';

export interface GameStateContextValue {
  /** Full game state, null until received from server */
  state: GameState | null;
  /** Current game phase */
  phase: GamePhase | null;
  /** Game configuration */
  config: GameConfig | null;
  /** Map of player ID to player */
  players: Record<string, Player>;
  /** Current player (self) */
  currentPlayer: Player | null;
  /** Host player ID */
  hostId: string | null;
  /** Whether the current player is the host */
  isHost: boolean;
  /** Connected player count */
  connectedPlayerCount: number;
  /** Current mystery pool GIF (during guessing phase) */
  currentGif: MysteryPoolEntry | null;
  /** Current scores */
  scores: Record<string, number>;
  /** Whether the game is in progress (not in lobby) */
  isInProgress: boolean;
}

const GameStateContext = createContext<GameStateContextValue | null>(null);

interface GameStateProviderProps {
  children: ReactNode;
  /** Current player's Discord user ID */
  playerId: string;
}

export function GameStateProvider({ children, playerId }: GameStateProviderProps) {
  const [state, setState] = useState<GameState | null>(null);
  const { subscribe } = useWebSocket();

  // Handle full state updates
  useSubscription('state:full', useCallback((message) => {
    console.log('[GameState] Received full state');
    setState(message.state);
  }, []));

  // Handle partial state patches
  useSubscription('state:patch', useCallback((message) => {
    console.log('[GameState] Received state patch:', Object.keys(message.patch));
    setState((prev) => {
      if (!prev) return prev;
      return { ...prev, ...message.patch };
    });
  }, []));

  // Handle player join/leave for immediate UI updates
  useSubscription('player:joined', useCallback((message) => {
    console.log('[GameState] Player joined:', message.player.username);
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        players: {
          ...prev.players,
          [message.player.id]: {
            id: message.player.id,
            username: message.player.username,
            avatar: message.player.avatar,
            connected: true,
            disconnectedAt: null,
            joinOrder: Object.keys(prev.players).length,
          },
        },
      };
    });
  }, []));

  useSubscription('player:left', useCallback((message) => {
    console.log('[GameState] Player left:', message.playerId);
    setState((prev) => {
      if (!prev) return prev;
      const player = prev.players[message.playerId];
      if (!player) return prev;
      return {
        ...prev,
        players: {
          ...prev.players,
          [message.playerId]: {
            ...player,
            connected: false,
            disconnectedAt: Date.now(),
          },
        },
      };
    });
  }, []));

  useSubscription('player:host-changed', useCallback((message) => {
    console.log('[GameState] Host changed to:', message.newHostId);
    setState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        hostId: message.newHostId,
      };
    });
  }, []));

  // Derived state
  const derivedState = useMemo<Omit<GameStateContextValue, 'state'>>(() => {
    if (!state) {
      return {
        phase: null,
        config: null,
        players: {},
        currentPlayer: null,
        hostId: null,
        isHost: false,
        connectedPlayerCount: 0,
        currentGif: null,
        scores: {},
        isInProgress: false,
      };
    }

    const currentPlayer = state.players[playerId] ?? null;
    const connectedPlayers = Object.values(state.players).filter((p) => p.connected);
    const currentGifIndex = state.currentGifIndex ?? 0;
    const currentGif = state.mysteryPool?.[currentGifIndex] ?? null;

    return {
      phase: state.phase,
      config: state.config,
      players: state.players,
      currentPlayer,
      hostId: state.hostId,
      isHost: state.hostId === playerId,
      connectedPlayerCount: connectedPlayers.length,
      currentGif,
      scores: state.scores,
      isInProgress: state.phase !== 'lobby',
    };
  }, [state, playerId]);

  const contextValue: GameStateContextValue = {
    state,
    ...derivedState,
  };

  return (
    <GameStateContext.Provider value={contextValue}>
      {children}
    </GameStateContext.Provider>
  );
}

/**
 * Hook to access game state context.
 * Throws if used outside of GameStateProvider.
 */
export function useGameState(): GameStateContextValue {
  const context = useContext(GameStateContext);
  if (!context) {
    throw new Error('useGameState must be used within a GameStateProvider');
  }
  return context;
}

/**
 * Hook to get the current game phase.
 */
export function usePhase(): GamePhase | null {
  const { phase } = useGameState();
  return phase;
}

/**
 * Hook to get the game configuration.
 */
export function useConfig(): GameConfig | null {
  const { config } = useGameState();
  return config;
}

/**
 * Hook to get all players.
 */
export function usePlayers(): Record<string, Player> {
  const { players } = useGameState();
  return players;
}

/**
 * Hook to check if current player is host.
 */
export function useIsHost(): boolean {
  const { isHost } = useGameState();
  return isHost;
}

/**
 * Hook to get current scores.
 */
export function useScores(): Record<string, number> {
  const { scores } = useGameState();
  return scores;
}

/**
 * Hook to get the current mystery GIF during guessing phase.
 */
export function useCurrentGif(): MysteryPoolEntry | null {
  const { currentGif } = useGameState();
  return currentGif;
}
