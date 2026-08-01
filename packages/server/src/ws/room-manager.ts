import type { ClientMessage, ServerMessage, GameState } from '@gif-game/shared';
import { RECONNECT_WINDOW_MS } from '@gif-game/shared';
import { GameRoom, type GameRoomEvents } from '../game/game-room.js';
import type { DiscordUser } from '../auth/discord-auth.js';
import type { KlipyService } from '../services/klipy-service.js';
import { isCpuPlayersEnabled } from '../game/cpu-player-service.js';

export type JoinResult = {
  ok: true;
  state: GameState;
} | {
  ok: false;
  code: string;
  message: string;
};

export interface RoomEntry {
  room: GameRoom;
  events: GameRoomEvents;
  lastActivity: number;
  cleanupTimeout: ReturnType<typeof setTimeout> | null;
}

export interface RoomManagerOptions {
  klipyService: KlipyService;
  /** Cleanup delay in ms after last player leaves (default: 30000) */
  cleanupDelayMs?: number;
}

/**
 * Manages game rooms, mapping Discord instance IDs to GameRoom instances.
 * Handles room creation, cleanup, reconnection, and message routing.
 */
export class RoomManager {
  private rooms: Map<string, RoomEntry> = new Map();
  private klipyService: KlipyService;
  private cleanupDelayMs: number;
  private cpuPlayersEnabled: boolean;

  constructor(options: RoomManagerOptions) {
    this.klipyService = options.klipyService;
    this.cleanupDelayMs = options.cleanupDelayMs ?? RECONNECT_WINDOW_MS;
    this.cpuPlayersEnabled = isCpuPlayersEnabled();
    
    if (this.cpuPlayersEnabled) {
      console.log('[RoomManager] CPU players enabled for solo dev testing');
    }
  }

  /**
   * Join or create a room for the given instance ID.
   * Handles reconnection within the grace period.
   */
  joinRoom(
    instanceId: string,
    user: DiscordUser,
    events: GameRoomEvents
  ): JoinResult {
    let entry = this.rooms.get(instanceId);

    if (!entry) {
      // Create new room with KlipyService for auto-fill
      const room = new GameRoom({
        roomId: instanceId,
        instanceId,
        events,
        getRandomGifs: (count) => this.klipyService.random(count),
        cpuPlayersEnabled: this.cpuPlayersEnabled,
      });
      entry = {
        room,
        events,
        lastActivity: Date.now(),
        cleanupTimeout: null,
      };
      this.rooms.set(instanceId, entry);
      console.log(`[RoomManager] Created new room: ${instanceId}`);
    } else {
      // Update events (new connection endpoints) - important for broadcasts to reach new sockets
      entry.events = events;
      entry.room.setEvents(events);  // Update the GameRoom's events too!
      entry.lastActivity = Date.now();

      // Cancel any pending cleanup
      if (entry.cleanupTimeout) {
        clearTimeout(entry.cleanupTimeout);
        entry.cleanupTimeout = null;
      }
    }

    const { room } = entry;

    // Check if this is a reconnection
    const playerManager = room.getPlayerManager();
    const existingPlayer = playerManager.get(user.id);

    if (existingPlayer) {
      // Reconnection
      const reconnected = playerManager.markReconnected(user.id);
      if (!reconnected) {
        return {
          ok: false,
          code: 'RECONNECT_EXPIRED',
          message: 'Reconnection window has expired',
        };
      }

      console.log(`[RoomManager] Player ${user.username} reconnected to room ${instanceId}`);

      // Notify others
      events.broadcast({
        type: 'player:joined',
        player: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
      });
    } else {
      // New player
      const added = room.addPlayer({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
      });

      if (!added) {
        return {
          ok: false,
          code: 'ROOM_FULL',
          message: 'Room is full',
        };
      }

      console.log(`[RoomManager] Player ${user.username} joined room ${instanceId}`);

      // Notify others (excluding the new player, they get state:full)
      events.broadcast({
        type: 'player:joined',
        player: {
          id: user.id,
          username: user.username,
          avatar: user.avatar,
        },
      });
    }

    return {
      ok: true,
      state: room.getState(),
    };
  }

  /**
   * Handle player disconnect.
   * Starts cleanup timer if room becomes empty.
   */
  handleDisconnect(instanceId: string, playerId: string): void {
    const entry = this.rooms.get(instanceId);
    if (!entry) return;

    const { room, events } = entry;
    room.handleDisconnect(playerId);

    // Check if room is now empty
    const playerManager = room.getPlayerManager();
    if (playerManager.connectedCount === 0) {
      this.scheduleCleanup(instanceId);
    }
  }

  /**
   * Handle game action from a player.
   */
  handleAction(instanceId: string, playerId: string, action: ClientMessage): void {
    const entry = this.rooms.get(instanceId);
    if (!entry) {
      console.warn(`[RoomManager] Action for unknown room: ${instanceId}`);
      return;
    }

    entry.lastActivity = Date.now();
    entry.room.handleAction(playerId, action);
  }

  /**
   * Handle GIF search request.
   */
  async handleSearch(instanceId: string, playerId: string, query: string): Promise<void> {
    const entry = this.rooms.get(instanceId);
    if (!entry) return;

    try {
      const gifs = await this.klipyService.search(query);

      entry.events.sendTo(playerId, {
        type: 'search:results',
        gifs,
      });
    } catch (err) {
      console.error(`[RoomManager] Search failed:`, err);
      entry.events.sendTo(playerId, {
        type: 'error',
        code: 'SEARCH_FAILED',
        message: 'Failed to search for GIFs',
      });
    }
  }

  /**
   * Get a room by instance ID.
   */
  getRoom(instanceId: string): GameRoom | null {
    return this.rooms.get(instanceId)?.room ?? null;
  }

  /**
   * Get all room IDs.
   */
  getRoomIds(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Schedule room cleanup after delay.
   */
  private scheduleCleanup(instanceId: string): void {
    const entry = this.rooms.get(instanceId);
    if (!entry) return;

    // Don't schedule if already pending
    if (entry.cleanupTimeout) return;

    console.log(`[RoomManager] Scheduling cleanup for room ${instanceId} in ${this.cleanupDelayMs}ms`);

    entry.cleanupTimeout = setTimeout(() => {
      this.cleanupRoom(instanceId);
    }, this.cleanupDelayMs);
  }

  /**
   * Clean up an empty room.
   */
  private cleanupRoom(instanceId: string): void {
    const entry = this.rooms.get(instanceId);
    if (!entry) return;

    // Double-check room is still empty
    const playerManager = entry.room.getPlayerManager();
    if (playerManager.connectedCount > 0) {
      console.log(`[RoomManager] Room ${instanceId} has players again, cancelling cleanup`);
      entry.cleanupTimeout = null;
      return;
    }

    console.log(`[RoomManager] Cleaning up room ${instanceId}`);
    this.rooms.delete(instanceId);
  }

  /**
   * Force cleanup all rooms (for shutdown).
   */
  close(): void {
    for (const [instanceId, entry] of this.rooms) {
      if (entry.cleanupTimeout) {
        clearTimeout(entry.cleanupTimeout);
      }
      console.log(`[RoomManager] Closing room ${instanceId}`);
    }
    this.rooms.clear();
  }
}
