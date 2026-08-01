// Re-export all hooks from providers for convenience
export {
  // Discord hooks
  useDiscord,
  useDiscordUser,
  useInstanceId,
  
  // WebSocket hooks
  useWebSocket,
  useSend,
  useSubscription,
  
  // Game state hooks
  useGameState,
  usePhase,
  useConfig,
  usePlayers,
  useIsHost,
  useScores,
  useCurrentGif,
} from '../providers';

// Accessibility hooks
export { useReducedMotion, getReducedMotionProps } from './useReducedMotion';
