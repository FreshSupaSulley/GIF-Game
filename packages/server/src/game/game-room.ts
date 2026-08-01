import type {
  GameState,
  GameConfig,
  Player,
  PlayerSubmission,
  MysteryPoolEntry,
  SelectedGif,
} from '@gif-game/shared';
import type { ClientMessage, ServerMessage } from '@gif-game/shared';
import { MIN_PLAYERS } from '@gif-game/shared';
import type { GamePhase } from '@gif-game/shared';
import { PlayerManager } from './player-manager.js';
import { createDefaultConfig, validateConfig } from './config.js';
import { SubmissionHandler } from './submission-handler.js';
import { buildPool } from './mystery-pool-builder.js';
import { GuessingHandler } from './guessing-handler.js';
import { TimerService, TimerIds } from './timer-service.js';
import { createEmbeddingService, type EmbeddingService } from '../scoring/index.js';
import { CpuPlayerService } from './cpu-player-service.js';

export interface GameRoomEvents {
  broadcast(message: ServerMessage): void;
  sendTo(playerId: string, message: ServerMessage): void;
}

export interface GameRoomOptions {
  roomId: string;
  instanceId: string;
  events: GameRoomEvents;
  /** Optional: provide a KlipyService for auto-fill on submission timeout */
  getRandomGifs?: (count: number) => Promise<SelectedGif[]>;
  /** Enable CPU players for solo testing */
  cpuPlayersEnabled?: boolean;
}

/**
 * Server-authoritative game room state machine.
 * Manages phase transitions and dispatches actions to phase-specific handlers.
 */
export class GameRoom {
  readonly roomId: string;
  readonly instanceId: string;

  private phase: GamePhase = 'lobby';
  private config: GameConfig;
  private players: PlayerManager;
  private hostId: string | null = null;
  private submissions: Map<string, PlayerSubmission> = new Map();
  private mysteryPool: MysteryPoolEntry[] = [];
  private currentTurnIndex = 0;
  private turnOrder: string[] = [];
  private currentGifIndex = 0;
  private scores: Record<string, number> = {};
  
  private submissionHandler: SubmissionHandler;
  private guessingHandler: GuessingHandler;
  private timerService: TimerService;
  private embeddingService: EmbeddingService | null = null;
  private events: GameRoomEvents;
  private getRandomGifs?: (count: number) => Promise<SelectedGif[]>;
  private cpuService: CpuPlayerService | null = null;
  private cpuPlayersEnabled: boolean;

  constructor(options: GameRoomOptions) {
    this.roomId = options.roomId;
    this.instanceId = options.instanceId;
    this.events = options.events;
    this.getRandomGifs = options.getRandomGifs;
    this.cpuPlayersEnabled = options.cpuPlayersEnabled ?? false;
    
    this.config = createDefaultConfig();
    this.players = new PlayerManager();
    this.submissionHandler = new SubmissionHandler(this.config);
    this.guessingHandler = new GuessingHandler(this.config);
    this.timerService = new TimerService((msg) => this.events.broadcast(msg));
    
    // Initialize CPU service if enabled
    if (this.cpuPlayersEnabled && this.getRandomGifs) {
      this.cpuService = new CpuPlayerService(this.getRandomGifs);
      console.log('[GameRoom] CPU players enabled for dev testing');
    }

    // Initialize embedding service asynchronously
    this.initEmbeddingService();
  }

  private async initEmbeddingService(): Promise<void> {
    try {
      this.embeddingService = await createEmbeddingService({ enabled: true });
    } catch (err) {
      console.warn('[GameRoom] Embedding service unavailable:', err);
    }
  }

  /** Returns the current full game state (for state:full messages). */
  getState(): GameState {
    return {
      roomId: this.roomId,
      instanceId: this.instanceId,
      phase: this.phase,
      config: this.config,
      players: this.players.getAll(),
      hostId: this.hostId ?? '',
      submissions: Object.fromEntries(this.submissions),
      submissionTimer: this.timerService.getTimerState(TimerIds.submission()),
      mysteryPool: this.phase === 'guessing' || this.phase === 'endgame' 
        ? this.mysteryPool.map(entry => ({ ...entry, resolved: this.phase === 'endgame' }))
        : [],
      currentRound: Math.floor(this.currentGifIndex / Math.max(1, this.players.connectedCount)) + 1,
      currentTurnIndex: this.currentTurnIndex,
      turnOrder: this.turnOrder,
      currentGifIndex: this.currentGifIndex,
      guessTimer: this.timerService.getTimerState(TimerIds.guess(this.turnOrder[this.currentTurnIndex] ?? '')),
      scores: this.scores,
    };
  }

  /** Returns the current phase. */
  getPhase(): GamePhase {
    return this.phase;
  }

  /** Returns the PlayerManager for external use (e.g., connection management). */
  getPlayerManager(): PlayerManager {
    return this.players;
  }

  /** 
   * Updates the events handlers (broadcast/sendTo).
   * Call this when player connections change to ensure messages reach current sockets.
   */
  setEvents(events: GameRoomEvents): void {
    this.events = events;
    // Also update timer service's broadcast function
    this.timerService.setBroadcast((msg) => this.events.broadcast(msg));
  }

  /**
   * Adds a player to the room and sets them as host if they're the first.
   * @returns true if the player was added successfully.
   */
  addPlayer(player: Omit<Player, 'connected' | 'disconnectedAt' | 'joinOrder'>): boolean {
    const added = this.players.addPlayer(player);
    if (!added) return false;

    if (this.hostId === null) {
      this.hostId = player.id;
    }

    this.scores[player.id] = this.scores[player.id] ?? 0;
    return true;
  }

  /**
   * Handles a player disconnecting from the room.
   */
  handleDisconnect(playerId: string): void {
    this.players.markDisconnected(playerId);

    // If the host disconnected, promote a new one
    if (playerId === this.hostId) {
      const newHost = this.players.promoteHost(playerId);
      if (newHost) {
        this.hostId = newHost;
        this.events.broadcast({
          type: 'player:host-changed',
          newHostId: newHost,
        });
      }
    }

    this.events.broadcast({
      type: 'player:left',
      playerId,
    });

    // Handle disconnect during guessing (skip their turn)
    if (this.phase === 'guessing' && this.guessingHandler.isCurrentGuesser(playerId)) {
      this.handleGuessTurnTimeout();
    }
  }

  /**
   * Main action dispatcher. Routes actions to the appropriate phase handler.
   */
  handleAction(playerId: string, action: ClientMessage): void {
    switch (action.type) {
      case 'config:update':
        this.handleConfigUpdate(playerId, action.key, action.value);
        break;
      case 'game:start':
        this.handleGameStart(playerId);
        break;
      case 'gif:select':
        this.handleGifSelect(playerId, action);
        break;
      case 'gif:deselect':
        this.handleGifDeselect(playerId, action.gifId);
        break;
      case 'guess:submitter':
        this.handleGuessSubmitter(playerId, action.playerId);
        break;
      case 'guess:title':
        this.handleGuessTitle(playerId, action.text, action.queryGuess);
        break;
      case 'game:playAgain':
        this.handlePlayAgain(playerId);
        break;
      case 'game:newGame':
        this.handleNewGame(playerId);
        break;
      case 'host:transfer':
        this.handleHostTransfer(playerId, action.playerId);
        break;
      case 'game:cancel':
        this.handleGameCancel(playerId);
        break;
      default:
        // gif:search and join are handled at the gateway level
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // Lobby Phase Handlers
  // ---------------------------------------------------------------------------

  private handleConfigUpdate(playerId: string, key: string, value: number | boolean): void {
    if (this.phase !== 'lobby') {
      this.sendError(playerId, 'WRONG_PHASE', 'Config can only be updated in the lobby');
      return;
    }

    if (playerId !== this.hostId) {
      this.sendError(playerId, 'NOT_HOST', 'Only the host can update config');
      return;
    }

    const result = validateConfig({ [key]: value } as Partial<GameConfig>, this.config);
    if (!result.ok) {
      this.sendError(playerId, 'INVALID_CONFIG', result.errors[0].message);
      return;
    }

    this.config = result.config;
    this.submissionHandler = new SubmissionHandler(this.config);
    this.guessingHandler = new GuessingHandler(this.config);
    this.events.broadcast({
      type: 'state:patch',
      patch: { config: this.config },
    });
  }

  private handleHostTransfer(currentHostId: string, newHostId: string): void {
    // Only the current host can transfer
    if (currentHostId !== this.hostId) {
      this.sendError(currentHostId, 'NOT_HOST', 'Only the host can transfer host privileges');
      return;
    }

    // Check that the target player exists and is connected
    const targetPlayer = this.players.get(newHostId);
    if (!targetPlayer) {
      this.sendError(currentHostId, 'PLAYER_NOT_FOUND', 'Target player not found');
      return;
    }

    if (!targetPlayer.connected) {
      this.sendError(currentHostId, 'PLAYER_DISCONNECTED', 'Cannot transfer host to a disconnected player');
      return;
    }

    // Don't allow transfer to CPU players
    if (newHostId.startsWith('cpu-')) {
      this.sendError(currentHostId, 'INVALID_TARGET', 'Cannot transfer host to a CPU player');
      return;
    }

    // Transfer host
    this.hostId = newHostId;
    this.events.broadcast({
      type: 'player:hostChanged',
      playerId: newHostId,
    });
  }

  private handleGameStart(playerId: string): void {
    if (this.phase !== 'lobby') {
      this.sendError(playerId, 'WRONG_PHASE', 'Game can only be started from the lobby');
      return;
    }

    if (playerId !== this.hostId) {
      this.sendError(playerId, 'NOT_HOST', 'Only the host can start the game');
      return;
    }

    // If CPU players enabled and we don't have enough players, add CPUs
    if (this.cpuService && this.players.connectedCount < MIN_PLAYERS) {
      const cpusNeeded = MIN_PLAYERS - this.players.connectedCount;
      console.log(`[GameRoom] Adding ${cpusNeeded} CPU player(s) for dev testing`);
      
      for (let i = 0; i < cpusNeeded; i++) {
        const cpu = this.cpuService.createCpuPlayer();
        this.addPlayer({
          id: cpu.id,
          username: cpu.username,
          avatar: cpu.avatar,
        });
        // addPlayer sets connected:true, broadcast the join
        this.events.broadcast({
          type: 'player:joined',
          player: this.players.get(cpu.id)!,
        });
      }
    }

    if (this.players.connectedCount < MIN_PLAYERS) {
      this.sendError(
        playerId,
        'NOT_ENOUGH_PLAYERS',
        `Need at least ${MIN_PLAYERS} players to start`
      );
      return;
    }

    this.transitionToSubmission();
  }

  // ---------------------------------------------------------------------------
  // Submission Phase Handlers
  // ---------------------------------------------------------------------------

  private handleGifSelect(
    playerId: string,
    action: { gifId: string; gifUrl: string; title: string; query?: string }
  ): void {
    if (this.phase !== 'submission') {
      this.sendError(playerId, 'WRONG_PHASE', 'GIF selection only allowed during submission phase');
      return;
    }

    const result = this.submissionHandler.selectGif(playerId, {
      id: action.gifId,
      url: action.gifUrl,
      thumbnailUrl: action.gifUrl,
      title: action.title || 'Untitled GIF',
      query: action.query,
    });

    if (!result.ok) {
      this.sendError(playerId, 'SELECT_FAILED', result.error ?? 'Selection failed');
      return;
    }

    this.submissions = this.submissionHandler.getSubmissions();
    console.log('[GameRoom] handleGifSelect - updated submissions, now calling checkSubmissionComplete');
    console.log('[GameRoom] Submission after select:', { 
      playerId, 
      gifCount: this.submissions.get(playerId)?.gifs.length,
      finalized: this.submissions.get(playerId)?.finalized 
    });
    this.events.broadcast({
      type: 'state:patch',
      patch: { submissions: Object.fromEntries(this.submissions) },
    });

    // Check if all players are finalized
    this.checkSubmissionComplete();
  }

  private handleGifDeselect(playerId: string, gifId: string): void {
    if (this.phase !== 'submission') {
      this.sendError(playerId, 'WRONG_PHASE', 'GIF deselection only allowed during submission phase');
      return;
    }

    const result = this.submissionHandler.deselectGif(playerId, gifId);

    if (!result.ok) {
      this.sendError(playerId, 'DESELECT_FAILED', result.error ?? 'Deselection failed');
      return;
    }

    this.submissions = this.submissionHandler.getSubmissions();
    this.events.broadcast({
      type: 'state:patch',
      patch: { submissions: Object.fromEntries(this.submissions) },
    });
  }

  private checkSubmissionComplete(): void {
    const connectedPlayerIds = this.players.getConnected().map(p => p.id);
    const allFinalized = this.submissionHandler.allFinalized(connectedPlayerIds);

    console.log('[GameRoom] checkSubmissionComplete:', {
      connectedPlayers: connectedPlayerIds,
      allFinalized,
      submissions: [...this.submissionHandler.getSubmissions().entries()].map(([id, sub]) => ({
        id,
        gifCount: sub.gifs.length,
        finalized: sub.finalized,
      })),
    });

    if (allFinalized) {
      console.log('[GameRoom] All players finalized, transitioning to guessing...');
      this.timerService.cancel(TimerIds.submission());
      this.transitionToGuessing();
    }
  }

  private async handleSubmissionTimeout(): Promise<void> {
    console.log('[GameRoom] Submission timeout');
    
    // Auto-fill missing submissions
    const connectedPlayerIds = this.players.getConnected().map(p => p.id);
    
    for (const playerId of connectedPlayerIds) {
      const submission = this.submissions.get(playerId);
      const needed = this.config.roundCount - (submission?.gifs.length ?? 0);
      
      if (needed > 0 && this.getRandomGifs) {
        try {
          const randomGifs = await this.getRandomGifs(needed);
          for (const gif of randomGifs) {
            this.submissionHandler.selectGif(playerId, gif);
          }
        } catch (err) {
          console.error('[GameRoom] Failed to get random GIFs for auto-fill:', err);
        }
      }
      
      // Force finalize
      this.submissionHandler.finalize(playerId);
    }

    this.submissions = this.submissionHandler.getSubmissions();
    this.transitionToGuessing();
  }

  // ---------------------------------------------------------------------------
  // Guessing Phase Handlers
  // ---------------------------------------------------------------------------

  private handleGuessSubmitter(playerId: string, guessedPlayerId: string): void {
    if (this.phase !== 'guessing') {
      this.sendError(playerId, 'WRONG_PHASE', 'Guessing only allowed during guessing phase');
      return;
    }

    const result = this.guessingHandler.guessSubmitter(playerId, guessedPlayerId);
    if (!result.ok) {
      this.sendError(playerId, 'GUESS_FAILED', result.error ?? 'Submitter guess failed');
      return;
    }

    // Check if turn is complete
    this.checkGuessTurnComplete();
  }

  private handleGuessTitle(playerId: string, text: string, queryGuess?: string): void {
    if (this.phase !== 'guessing') {
      this.sendError(playerId, 'WRONG_PHASE', 'Guessing only allowed during guessing phase');
      return;
    }

    const result = this.guessingHandler.guessTitle(playerId, text, queryGuess);
    if (!result.ok) {
      this.sendError(playerId, 'GUESS_FAILED', result.error ?? 'Title guess failed');
      return;
    }

    // Check if turn is complete
    this.checkGuessTurnComplete();
  }

  private handlePlayAgain(playerId: string): void {
    if (this.phase !== 'endgame') {
      this.sendError(playerId, 'WRONG_PHASE', 'Play again only allowed in endgame');
      return;
    }

    if (playerId !== this.hostId) {
      this.sendError(playerId, 'NOT_HOST', 'Only the host can start a new game');
      return;
    }

    // Reset to lobby, preserving config
    this.resetToLobby(true);
  }

  private handleNewGame(playerId: string): void {
    if (this.phase !== 'endgame') {
      this.sendError(playerId, 'WRONG_PHASE', 'New game only allowed in endgame');
      return;
    }

    if (playerId !== this.hostId) {
      this.sendError(playerId, 'NOT_HOST', 'Only the host can start a new game');
      return;
    }

    // Reset to lobby with default config
    this.resetToLobby(false);
  }

  private handleGameCancel(playerId: string): void {
    // Only allow canceling during active game phases
    if (this.phase === 'lobby' || this.phase === 'endgame') {
      this.sendError(playerId, 'WRONG_PHASE', 'Can only cancel during an active game');
      return;
    }

    if (playerId !== this.hostId) {
      this.sendError(playerId, 'NOT_HOST', 'Only the host can cancel the game');
      return;
    }

    // Cancel any active timers
    this.timerService.cancelAll();

    // Reset to lobby, keeping current config
    this.resetToLobby(true);
  }

  private async checkGuessTurnComplete(): Promise<void> {
    if (!this.guessingHandler.isTurnComplete()) return;

    // Cancel current timer
    const currentGuesser = this.guessingHandler.getCurrentGuesser();
    if (currentGuesser) {
      this.timerService.cancel(TimerIds.guess(currentGuesser));
    }

    // Score the turn
    const scoreBreakdown = await this.guessingHandler.scoreTurn();
    
    if (scoreBreakdown) {
      // Update scores
      this.scores[scoreBreakdown.playerId] = 
        (this.scores[scoreBreakdown.playerId] ?? 0) + scoreBreakdown.totalPoints;

      // Broadcast score reveal
      this.events.broadcast({
        type: 'score:reveal',
        breakdown: scoreBreakdown,
      });

      // Wait a moment for clients to see the score reveal
      await this.delay(2000);
    }

    // Advance to next turn
    this.advanceGuessingTurn();
  }

  private async handleGuessTurnTimeout(): Promise<void> {
    console.log('[GameRoom] Guess turn timeout');
    
    const result = this.guessingHandler.handleTimeout();
    
    // Score the (empty) turn
    const scoreBreakdown = await this.guessingHandler.scoreTurn();
    
    if (scoreBreakdown) {
      this.scores[scoreBreakdown.playerId] = 
        (this.scores[scoreBreakdown.playerId] ?? 0) + scoreBreakdown.totalPoints;

      this.events.broadcast({
        type: 'score:reveal',
        breakdown: scoreBreakdown,
      });

      await this.delay(2000);
    }

    // The handler already advanced the turn
    if (result.phaseComplete) {
      this.transitionToEndgame();
    } else {
      this.startGuessTurn();
    }
  }

  private advanceGuessingTurn(): void {
    const result = this.guessingHandler.advanceTurn();

    if (result.phaseComplete) {
      this.transitionToEndgame();
      return;
    }

    // Update state from handler
    const turnState = this.guessingHandler.getTurnState();
    this.currentTurnIndex = turnState.currentTurnIndex;
    this.currentGifIndex = turnState.currentGifIndex;
    this.turnOrder = turnState.turnOrder;

    // Start next turn
    this.startGuessTurn();
  }

  private startGuessTurn(): void {
    const currentGuesser = this.guessingHandler.getCurrentGuesser();
    if (!currentGuesser) {
      this.transitionToEndgame();
      return;
    }

    // Broadcast updated state
    const stateToSend = this.getState();
    console.log('[GameRoom] Broadcasting state:full for guessing phase, phase =', stateToSend.phase);
    this.events.broadcast({
      type: 'state:full',
      state: stateToSend,
    });

    // Start timer for this turn
    this.timerService.start(TimerIds.guess(currentGuesser), {
      durationMs: this.config.guessTimeLimit * 1000,
      phase: 'guessing',
      onExpiry: () => this.handleGuessTurnTimeout(),
    });

    // If CPU is the guesser, schedule automated guessing
    if (this.cpuService?.isCpu(currentGuesser)) {
      this.scheduleCpuGuess(currentGuesser);
    }
  }

  /**
   * CPU players make their guesses after a delay.
   */
  private scheduleCpuGuess(cpuId: string): void {
    if (!this.cpuService) return;

    const delay = this.cpuService.getActionDelay();
    
    setTimeout(() => {
      if (this.phase !== 'guessing') return;
      if (!this.guessingHandler.isCurrentGuesser(cpuId)) return;
      
      this.performCpuGuess(cpuId);
    }, delay);
  }

  private performCpuGuess(cpuId: string): void {
    if (!this.cpuService) return;

    // Get current GIF info
    const currentGif = this.guessingHandler.getCurrentGif();
    if (!currentGif) return;

    // Pick a random submitter (excluding self)
    const eligiblePlayers = this.players.getConnected()
      .map(p => p.id)
      .filter(id => id !== cpuId);
    
    const guessedSubmitter = this.cpuService.guessRandomSubmitter(eligiblePlayers);
    const guessedTitle = this.cpuService.guessRandomTitle();

    console.log(`[GameRoom] CPU ${cpuId} guessing: submitter=${guessedSubmitter}, title="${guessedTitle}"`);

    // Make the submitter guess
    this.handleGuessSubmitter(cpuId, guessedSubmitter);

    // After a brief delay, make the title guess
    setTimeout(() => {
      if (this.phase !== 'guessing') return;
      this.handleGuessTitle(cpuId, guessedTitle);
    }, 300);
  }

  // ---------------------------------------------------------------------------
  // Phase Transitions
  // ---------------------------------------------------------------------------

  private transitionToSubmission(): void {
    this.phase = 'submission';
    this.submissions.clear();
    this.submissionHandler.reset(this.config);
    
    // Initialize submissions for all connected players
    for (const player of this.players.getConnected()) {
      this.submissions.set(player.id, {
        playerId: player.id,
        gifs: [],
        finalized: false,
      });
    }

    // Broadcast full state
    this.events.broadcast({
      type: 'state:full',
      state: this.getState(),
    });

    // Start submission timer
    this.timerService.start(TimerIds.submission(), {
      durationMs: this.config.submissionTimeLimit * 1000,
      phase: 'submission',
      onExpiry: () => this.handleSubmissionTimeout(),
    });

    // Trigger CPU submissions after a short delay
    if (this.cpuService) {
      this.scheduleCpuSubmissions();
    }
  }

  /**
   * CPU players submit their GIFs with random delays.
   */
  private async scheduleCpuSubmissions(): Promise<void> {
    if (!this.cpuService) {
      console.log('[GameRoom] scheduleCpuSubmissions: No CPU service');
      return;
    }

    const cpuIds = this.cpuService.getCpuIds().filter(id => this.players.get(id));
    console.log('[GameRoom] scheduleCpuSubmissions:', { cpuIds });
    
    for (const cpuId of cpuIds) {
      // Stagger CPU submissions with random delays
      const delay = this.cpuService.getActionDelay();
      console.log(`[GameRoom] Scheduling CPU ${cpuId} submission in ${delay}ms`);
      setTimeout(() => this.performCpuSubmission(cpuId), delay);
    }
  }

  private async performCpuSubmission(cpuId: string): Promise<void> {
    console.log(`[GameRoom] performCpuSubmission starting for ${cpuId}, phase=${this.phase}`);
    if (!this.cpuService || this.phase !== 'submission') {
      console.log(`[GameRoom] performCpuSubmission aborted: cpuService=${!!this.cpuService}, phase=${this.phase}`);
      return;
    }

    try {
      console.log(`[GameRoom] CPU ${cpuId} fetching random GIFs...`);
      const gifs = await this.cpuService.selectRandomGifs(this.config.roundCount);
      console.log(`[GameRoom] CPU ${cpuId} got ${gifs.length} GIFs`);
      
      for (const gif of gifs) {
        if (this.phase !== 'submission') break; // Phase may have changed
        
        const result = this.submissionHandler.selectGif(cpuId, gif);
        if (!result.ok) {
          console.warn(`[GameRoom] CPU ${cpuId} failed to select GIF:`, result.error);
        }
      }

      this.submissions = this.submissionHandler.getSubmissions();
      this.events.broadcast({
        type: 'state:patch',
        patch: { submissions: Object.fromEntries(this.submissions) },
      });

      console.log(`[GameRoom] CPU ${cpuId} submitted ${gifs.length} GIF(s)`);
      this.checkSubmissionComplete();
    } catch (err) {
      console.error(`[GameRoom] CPU submission error for ${cpuId}:`, err);
    }
  }

  private transitionToGuessing(): void {
    console.log('[GameRoom] transitionToGuessing called');
    console.log('[GameRoom] Submissions for pool:', [...this.submissions.entries()].map(([id, sub]) => ({
      id,
      gifCount: sub.gifs.length,
      finalized: sub.finalized,
    })));
    
    // Build mystery pool
    const poolResult = buildPool(this.submissions, this.config.roundCount);
    console.log('[GameRoom] buildPool result:', poolResult.ok ? `OK, ${poolResult.pool?.length} entries` : poolResult.error);
    
    if (!poolResult.ok) {
      console.error('[GameRoom] Failed to build mystery pool:', poolResult.error);
      // Fall back to endgame if pool can't be built
      this.transitionToEndgame();
      return;
    }

    this.mysteryPool = poolResult.pool ?? [];
    this.phase = 'guessing';
    this.currentGifIndex = 0;
    this.currentTurnIndex = 0;

    // Initialize guessing handler
    const playerIds = this.players.getConnected().map(p => p.id);
    this.guessingHandler.initialize(this.mysteryPool, playerIds, this.embeddingService);

    // Get turn state from handler
    const turnState = this.guessingHandler.getTurnState();
    this.turnOrder = turnState.turnOrder;
    this.currentTurnIndex = turnState.currentTurnIndex;

    // Start first turn
    this.startGuessTurn();
  }

  private transitionToEndgame(): void {
    this.phase = 'endgame';
    this.timerService.cancelAll();

    // Reveal all GIF submitters
    this.mysteryPool = this.mysteryPool.map(entry => ({
      ...entry,
      resolved: true,
    }));

    this.events.broadcast({
      type: 'state:full',
      state: this.getState(),
    });
  }

  /** Resets to lobby for a new game (preserves players and optionally config). */
  resetToLobby(preserveConfig: boolean): void {
    this.timerService.cancelAll();
    
    if (!preserveConfig) {
      this.config = createDefaultConfig();
    }
    
    this.phase = 'lobby';
    this.submissions.clear();
    this.mysteryPool = [];
    this.turnOrder = [];
    this.currentGifIndex = 0;
    this.currentTurnIndex = 0;
    
    // Reset scores
    this.scores = {};
    for (const playerId of Object.keys(this.players.getAll())) {
      this.scores[playerId] = 0;
    }

    this.submissionHandler.reset(this.config);
    this.guessingHandler.reset(this.config);

    this.events.broadcast({
      type: 'state:full',
      state: this.getState(),
    });
  }

  /** Clean up resources */
  dispose(): void {
    this.timerService.cancelAll();
    this.embeddingService?.dispose();
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private sendError(playerId: string, code: string, message: string): void {
    this.events.sendTo(playerId, {
      type: 'error',
      code,
      message,
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Backwards-compatible constructor for existing code
export function createGameRoom(
  roomId: string,
  instanceId: string,
  events: GameRoomEvents
): GameRoom {
  return new GameRoom({ roomId, instanceId, events });
}
