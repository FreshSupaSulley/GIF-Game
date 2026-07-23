# Implementation Plan: GIF Guessing Game

## Overview

A multiplayer GIF guessing game built as a Discord Activity. Implementation proceeds from a deployable "hello world" Discord Activity (end-to-end infrastructure validation), then layers in game logic, scoring, real-time multiplayer, and UI polish. TypeScript throughout.

## Tasks

- [ ] 1. Project scaffolding
  - [~] 1.1 Initialize monorepo with server and client workspaces
    - Create root `package.json` with yarn/npm workspaces: `packages/shared`, `packages/server`, `packages/client`
    - Add root `tsconfig.json` with strict mode, path aliases, and composite project references
    - Add `.gitignore`, `.prettierrc`, `eslint.config.ts` with TypeScript rules
    - Install shared dev dependencies: `typescript`, `prettier`, `eslint`
    - _Requirements: 13.1, 13.4_

  - [~] 1.2 Create centralized constants file
    - Create `packages/shared/src/constants.ts` with all magic numbers grouped by domain
    - Timing: `SUBMISSION_FIRST_GIF_TIME_SECONDS = 15`, `SUBMISSION_ADDITIONAL_GIF_TIME_SECONDS = 10`, `GUESS_TIME_LIMIT_DEFAULT_SECONDS = 30`, `RECONNECT_WINDOW_MS = 30000`, `KLIPY_TIMEOUT_MS = 3000`, `KLIPY_RETRY_COUNT = 3`
    - Scoring: `EXACT_KEYWORD_MATCH_POINTS = 100`, `SEMANTIC_MATCH_POINTS = 50`, `SEMANTIC_MATCH_THRESHOLD = 0.6`, `CORRECT_SUBMITTER_GUESS_POINTS = 1`
    - Limits: `MIN_PLAYERS = 2`, `MAX_PLAYERS = 8`, `MIN_ROUNDS = 1`, `MAX_ROUNDS = 10`, `DEFAULT_ROUNDS = 3`, `MIN_GUESS_TIME = 10`, `MAX_GUESS_TIME = 60`, `MAX_SEARCH_RESULTS = 25`, `MAX_TITLE_GUESS_LENGTH = 200`
    - Animation: `SPRING_DURATION_MS = 300`, `PHASE_TRANSITION_MS = 300`, `EMPHASIS_ANIMATION_MS = 600`, `INTERACTION_FEEDBACK_MS = 100`, `REVEAL_ANIMATION_MS = 500`
    - API: `KLIPY_BASE_URL`, `DISCORD_API_BASE_URL`
    - Include inline JSDoc for each constant with purpose, valid range, and default value
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [~] 1.3 Define shared TypeScript types and interfaces
    - Create `packages/shared/src/types.ts` with all data model interfaces from the design: `GameState`, `GameConfig`, `Player`, `PlayerSubmission`, `SelectedGif`, `MysteryPoolEntry`, `TimerState`, `ScoreBreakdown`
    - Create `packages/shared/src/messages.ts` with discriminated union types for WebSocket protocol: `ClientMessage`, `ServerMessage`
    - Create `packages/shared/src/phases.ts` with `GamePhase` type (`'lobby' | 'submission' | 'guessing' | 'endgame'`)
    - Export all types from `packages/shared/src/index.ts` barrel file
    - _Requirements: 12.1, 2.2, 2.5_

- [ ] 2. Hello World Discord Activity (end-to-end checkpoint)
  - [~] 2.1 Create minimal React client that renders inside Discord
    - Create `packages/client/` with Vite + React + TypeScript configuration
    - Install dependencies: `react`, `react-dom`, `@discord/embedded-app-sdk`
    - Implement minimal `App.tsx` that initializes the Embedded App SDK, calls `ready()`, and renders "Hello World" with the authenticated user's Discord username
    - Configure Vite for production build output to `dist/`
    - _Requirements: 11.1, 11.3_

  - [~] 2.2 Create minimal Node.js server that serves the client
    - Create `packages/server/src/index.ts` with a basic HTTP server (express or native http)
    - Serve the built client static files from `packages/client/dist/`
    - Add a `/api/token` endpoint that exchanges the Discord OAuth2 code for an access token (minimal Discord auth flow)
    - Create `packages/server/src/config.ts` with environment variable parsing (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, PORT)
    - Add `.env.example` with all required environment variables documented
    - _Requirements: 11.1, 11.2, 11.4_

  - [~] 2.3 Create Docker and Caddy setup for local development
    - Create `Dockerfile` with multi-stage build (compile TS server, build Vite client, slim runtime image)
    - Create `docker-compose.yml` with the Node.js server service
    - Create `Caddyfile` for local development: reverse proxy to Node server, serve static assets, handle SPA fallback
    - Add `docker-compose.yml` service for Caddy (optional for local dev; can also run Caddy standalone)
    - _Requirements: 12.1_

  - [~] 2.4 Register Discord Activity and verify end-to-end
    - Document Discord Developer Portal setup: create application, enable Activities, add URL mapping to local dev tunnel (e.g., cloudflared or ngrok)
    - Configure OAuth2 redirect URI for local development
    - Verify: launch Activity in Discord voice channel -> iframe loads -> SDK initializes -> "Hello World" + username appears
    - _Requirements: 11.1, 11.3, 11.5_

- [ ] 3. Server-side game logic core
  - [~] 3.1 Implement GameConfig validation and defaults
    - Create `packages/server/src/game/config.ts`
    - Implement `validateConfig(update: Partial<GameConfig>): GameConfig | Error` that enforces bounds from constants
    - Implement `calculateSubmissionTimeLimit(roundCount: number): number` using formula from constants
    - Implement `createDefaultConfig(): GameConfig` returning defaults
    - _Requirements: 2.2, 2.3, 2.5, 2.9, 13.4_

  - [~] 3.2 Implement PlayerManager
    - Create `packages/server/src/game/player-manager.ts`
    - Implement `addPlayer(player: Player): boolean` enforcing MAX_PLAYERS limit
    - Implement `removePlayer(playerId: string): void` with player list update
    - Implement `promoteHost(currentHostId: string): string | null` promoting lowest join order connected player
    - Implement `markDisconnected(playerId: string): void` and `markReconnected(playerId: string): void` with timestamps
    - _Requirements: 1.2, 1.5, 1.6, 1.7, 12.5, 12.6, 12.7_

  - [~] 3.3 Implement GameRoom state machine
    - Create `packages/server/src/game/game-room.ts`
    - Implement state machine with phases: `lobby`, `submission`, `guessing`, `endgame`
    - Implement phase transition guards: lobby->submission requires >= 2 players and host trigger
    - Implement `handleAction(playerId: string, action: ClientMessage): void` dispatching actions to phase handlers
    - Reject actions from wrong phases with error messages
    - Host-only guard for config updates and game start
    - _Requirements: 1.4, 2.8, 12.1_

  - [~] 3.4 Implement submission phase logic
    - Create `packages/server/src/game/submission-handler.ts`
    - Implement `selectGif(playerId: string, gif: SelectedGif): boolean` enforcing round count limit
    - Implement `deselectGif(playerId: string, gifId: string): boolean` allowing removal before finalization
    - Implement `autoFinalize(playerId: string): void` triggered when count reaches roundCount
    - Implement `handleTimeout(state: GameState): GameState` that fills remaining slots via KLIPY random
    - Track per-player submission status and broadcast progress
    - _Requirements: 4.2, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10_

  - [~] 3.5 Implement MysteryPoolBuilder
    - Create `packages/server/src/game/mystery-pool-builder.ts`
    - Implement `buildPool(submissions: Map<string, PlayerSubmission>, roundCount: number): MysteryPoolEntry[] | Error`
    - Validate pool size equals playerCount * roundCount
    - Shuffle with constraint: no two consecutive entries from same submitter (when >= 3 players)
    - For 2 players, simple alternating shuffle
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 4. Scoring and guessing logic
  - [~] 4.1 Implement stop words list and keyword extraction
    - Create `packages/server/src/scoring/keywords.ts`
    - Define stop words set from the design document
    - Implement `extractKeywords(text: string): string[]` that tokenizes, lowercases, and removes stop words
    - _Requirements: 8.2_

  - [~] 4.2 Implement Scorer with exact keyword matching
    - Create `packages/server/src/scoring/scorer.ts`
    - Implement `scoreExactMatch(guess: string, gifTitle: string): { matchedKeywords: string[]; points: number }`
    - Case-insensitive keyword comparison after stop word removal
    - Award EXACT_KEYWORD_MATCH_POINTS per matched keyword
    - _Requirements: 8.2, 8.3_

  - [~] 4.3 Implement EmbeddingService with ONNX runtime
    - Create `packages/server/src/scoring/embedding-service.ts`
    - Install `onnxruntime-node` dependency
    - Load all-MiniLM-L6-v2 model on server startup
    - Implement `computeEmbedding(text: string): Promise<Float32Array>`
    - Implement `cosineSimilarity(a: Float32Array, b: Float32Array): number`
    - Graceful fallback: if ONNX fails, return 0 for semantic score
    - _Requirements: 8.4, 8.5_

  - [~] 4.4 Implement semantic scoring integration
    - Extend scorer with `scoreSemanticMatch(guess: string, gifTitle: string): Promise<{ similarity: number; points: number }>`
    - Only apply semantic scoring when zero exact keyword matches found
    - Award SEMANTIC_MATCH_POINTS when similarity >= SEMANTIC_MATCH_THRESHOLD, else 0
    - Compose full `scoreGuess(input: ScoringInput): Promise<ScoreBreakdown>` combining submitter guess, exact, and semantic
    - _Requirements: 8.3, 8.4, 8.5_

  - [~] 4.5 Implement guessing phase turn cycling
    - Create `packages/server/src/game/guessing-handler.ts`
    - Implement turn order randomization at phase start
    - Implement `getNextGif(playerId: string, pool: MysteryPoolEntry[]): MysteryPoolEntry | null` selecting a GIF not submitted by the guesser
    - Implement turn advancement: submitter guess -> title guess -> score reveal -> next turn
    - Skip player's turn if no eligible GIF remains
    - Track pool exhaustion across rounds
    - _Requirements: 6.1, 6.2, 6.3, 6.7, 6.8, 7.1, 7.4_

- [ ] 5. WebSocket gateway and real-time infrastructure
  - [~] 5.1 Implement WebSocket server with connection management
    - Create `packages/server/src/ws/gateway.ts`
    - Install `ws` package for WebSocket server
    - Implement connection lifecycle: accept, authenticate, assign to room, handle messages, disconnect
    - Implement message parsing and validation against `ClientMessage` union type
    - Implement broadcast to room: `broadcastToRoom(roomId: string, message: ServerMessage): void`
    - Implement targeted send: `sendToPlayer(playerId: string, message: ServerMessage): void`
    - _Requirements: 12.1, 12.2, 12.8_

  - [~] 5.2 Implement RoomManager
    - Create `packages/server/src/ws/room-manager.ts`
    - Implement `getOrCreateRoom(instanceId: string): GameRoom` mapping Discord instance IDs to game rooms
    - Implement room cleanup: destroy rooms 30s after last player disconnects
    - Implement reconnection: `reconnectPlayer(playerId: string, roomId: string): GameState | null` within 30s window
    - _Requirements: 11.4, 12.3, 12.4, 12.5, 12.6_

  - [~] 5.3 Implement TimerService
    - Create `packages/server/src/game/timer-service.ts`
    - Implement server-side countdown timers with tick broadcasts every second
    - Implement `startSubmissionTimer(durationMs: number, onExpiry: () => void): void`
    - Implement `startGuessTimer(durationMs: number, onExpiry: () => void): void`
    - Handle auto-submit on guess timer expiry (submit current text or random submitter)
    - Handle auto-fill on submission timer expiry
    - _Requirements: 2.3, 4.9, 6.5, 6.6_

  - [~] 5.4 Implement Discord OAuth2 token exchange (full)
    - Extend `packages/server/src/auth/discord-auth.ts` from task 2.2
    - Validate tokens on WebSocket connection handshake
    - Return user identity (id, username, avatar) on success
    - Reject connection with error on auth failure
    - _Requirements: 11.1, 11.2, 11.6_

- [ ] 6. KLIPY API integration
  - [~] 6.1 Implement KlipyService
    - Create `packages/server/src/services/klipy-service.ts`
    - Implement `search(query: string, limit?: number): Promise<KlipyGif[]>` with 3s timeout
    - Implement `random(count: number): Promise<KlipyGif[]>` for auto-fill
    - Implement retry logic (up to 3 attempts with 1s delay) for auto-fill scenarios
    - Normalize GIF titles: if empty/null/absent, store as "Untitled GIF"
    - Cap search results at MAX_SEARCH_RESULTS (25)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [ ] 7. Client providers and game views
  - [~] 7.1 Implement DiscordSDKProvider (full)
    - Extend the minimal SDK setup from task 2.1 into `packages/client/src/providers/DiscordSDKProvider.tsx`
    - Expose user identity (id, username, avatar) and instanceId via React context
    - Handle auth failure with error display
    - _Requirements: 11.1, 11.2, 11.3, 11.6_

  - [~] 7.2 Implement WebSocketProvider
    - Create `packages/client/src/providers/WebSocketProvider.tsx`
    - Connect to server WebSocket with auth token and instanceId
    - Implement exponential backoff reconnection (1s, 2s, 4s, max 30s)
    - Expose `send(message: ClientMessage)` and subscribe to `ServerMessage` events
    - Handle connection state (connecting, connected, disconnected, reconnecting)
    - _Requirements: 12.1, 12.5_

  - [~] 7.3 Implement GameStateProvider
    - Create `packages/client/src/providers/GameStateProvider.tsx`
    - Handle `state:full` messages to replace entire local state
    - Handle `state:patch` messages to merge partial updates
    - Expose current game state, current phase, current player, and derived selectors
    - Update within 200ms of receiving server messages
    - _Requirements: 12.1, 12.2_

  - [~] 7.4 Implement LobbyView
    - Create `packages/client/src/views/LobbyView.tsx`
    - Display player list with Discord avatars and usernames
    - Show configuration panel for host (round count slider, guess time slider)
    - Show calculated submission time limit for all players
    - Show "Start Game" button for host (enabled when >= 2 players)
    - Non-host players see config as read-only
    - Real-time config update display within 500ms
    - _Requirements: 1.3, 1.4, 2.1, 2.4, 2.6, 2.7_

  - [~] 7.5 Implement SubmissionView
    - Create `packages/client/src/views/SubmissionView.tsx`
    - GIF search input (triggers after 2 characters)
    - Display search results in a grid (up to 25 thumbnails)
    - Show progress indicator ("2 / 3 GIFs selected")
    - Handle GIF selection with bouncy confirmation animation
    - Handle GIF deselection before finalization
    - Show rejection message when max reached
    - Show countdown timer
    - Show waiting state with per-player completion status (no GIF reveals)
    - Handle KLIPY error display with retry button
    - _Requirements: 3.1, 3.2, 3.3, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.10_

  - [~] 7.6 Implement GuessingView
    - Create `packages/client/src/views/GuessingView.tsx`
    - GIF reveal with bouncy entrance animation (<=500ms)
    - Submitter guess selector showing all players except guesser (skip for 2-player games)
    - Free-text title guess input (1-200 characters)
    - Countdown timer display
    - Spectator view: current GIF, active player's time remaining, completion status
    - Score reveal breakdown animation after each guess
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 7.1, 7.2, 7.4, 7.5, 7.6, 8.1, 8.6_

  - [~] 7.7 Implement ScoreboardView and EndGame
    - Create `packages/client/src/views/ScoreboardView.tsx`
    - Live scoreboard: username, score, rank position (descending) updated within 200ms
    - End-game results screen with animated score reveals
    - Winner/co-winner declaration
    - Host options: "Play Again" (preserve config) or "New Game" (reset defaults)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

- [ ] 8. UI/UX polish and animations
  - [~] 8.1 Implement AnimationEngine and spring-based motion system
    - Create `packages/client/src/components/AnimationEngine.tsx`
    - Configure framer-motion spring presets for: button press, card selection, GIF reveal, phase transition, score reveal
    - Implement `prefers-reduced-motion` detection: disable all spring/transition animations, use instant state changes
    - Enforce duration constraints: interactions 200-500ms, navigation transitions <300ms, emphasis <600ms
    - Ensure interaction feedback within 100ms
    - _Requirements: 10.2, 10.3, 10.4, 10.7_

  - [~] 8.2 Implement responsive layout and design system
    - Create base CSS/Tailwind setup with max 5 primary colors, bold geometric shapes, flat elements
    - Ensure minimum 16px body text, 4.5:1 contrast ratio
    - Implement responsive layout from 320px to 1920px without clipping or overlap
    - Test in Discord Activity iframe constraints
    - _Requirements: 10.1, 10.5, 10.6_

- [ ] 9. Server entry point and full wiring
  - [~] 9.1 Wire all server components together
    - Extend `packages/server/src/index.ts` from task 2.2 into full entry point
    - Initialize ONNX embedding model on startup
    - Create HTTP server with WebSocket upgrade handling
    - Wire: Gateway -> RoomManager -> GameRoom -> PlayerManager, SubmissionHandler, GuessingHandler, Scorer, TimerService, KlipyService
    - Add graceful shutdown: drain connections, clear timers, release ONNX session
    - Add structured logging (pino) for all game events
    - _Requirements: 11.4, 12.1_

  - [~] 9.2 Implement KLIPY search proxy endpoint
    - Add search message handler in gateway that proxies through KlipyService
    - Send `search:results` back to requesting player only
    - Handle errors with `error` message type
    - _Requirements: 3.1, 3.2, 3.3_

- [ ] 10. Production deployment
  - [~] 10.1 Finalize Dockerfile for production
    - Update multi-stage `Dockerfile` from task 2.3 to include ONNX model, full server wiring, and production optimizations
    - Add build scripts to root `package.json`: `build:server`, `build:client`, `build:all`
    - Verify Docker image runs end-to-end locally with `docker-compose up`
    - _Requirements: 11.3_

  - [~] 10.2 Finalize Caddy configuration for production
    - Update `Caddyfile` from task 2.3 with production domain, auto-TLS via Let's Encrypt
    - Configure WebSocket upgrade headers for `/ws/*` path
    - Verify TLS + WebSocket + SPA routing works end-to-end
    - _Requirements: 12.1_

  - [~] 10.3 Document production deployment
    - Document full deployment steps: provision EC2/VPS, install Docker + Caddy, pull image, configure env vars, start services
    - Document Discord Developer Portal production setup: update URL mappings from dev tunnel to production domain
    - Add monitoring recommendations (structured logs to stdout, CloudWatch basic metrics)
    - _Requirements: 11.1, 11.5_

## Notes

- Task group 2 is the "Hello World" checkpoint: after completing it, you can launch the Activity in Discord and see a page with your username. No game logic yet, but the full infrastructure pipeline (build, serve, Discord SDK auth, iframe rendering) is validated end-to-end.
- Each task references specific requirements for traceability
- The server is fully authoritative; clients are thin rendering layers
- All magic numbers come from the centralized constants file (task 1.2)
- ONNX model must be downloaded separately and included in deployment artifacts
- Tasks 2.1-2.4 deliberately duplicate some setup from later tasks (6.1, 9.1, 10.x) in minimal form to get the checkpoint working fast. Later tasks extend those foundations.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3"] },
    { "id": 2, "tasks": ["2.1", "2.2"] },
    { "id": 3, "tasks": ["2.3", "2.4"] },
    { "id": 4, "tasks": ["3.1", "3.2"] },
    { "id": 5, "tasks": ["3.3", "3.4", "3.5", "6.1"] },
    { "id": 6, "tasks": ["4.1", "4.2"] },
    { "id": 7, "tasks": ["4.3", "4.4", "4.5"] },
    { "id": 8, "tasks": ["5.1", "5.2", "5.3", "5.4"] },
    { "id": 9, "tasks": ["7.1", "7.2", "7.3"] },
    { "id": 10, "tasks": ["7.4", "7.5", "7.6", "7.7"] },
    { "id": 11, "tasks": ["8.1", "8.2"] },
    { "id": 12, "tasks": ["9.1", "9.2"] },
    { "id": 13, "tasks": ["10.1", "10.2", "10.3"] }
  ]
}
```
