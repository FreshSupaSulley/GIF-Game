import type { Player } from '@gif-game/shared';
import { MAX_PLAYERS, RECONNECT_WINDOW_MS } from '@gif-game/shared';

/**
 * Manages players within a single game room.
 * Handles join/leave, disconnection tracking, and host promotion.
 */
export class PlayerManager {
  private players: Map<string, Player> = new Map();
  private nextJoinOrder = 0;

  /** Returns all players (connected and disconnected). */
  getAll(): Record<string, Player> {
    return Object.fromEntries(this.players);
  }

  /** Returns a single player by ID, or undefined if not found. */
  get(playerId: string): Player | undefined {
    return this.players.get(playerId);
  }

  /** Returns only currently connected players. */
  getConnected(): Player[] {
    return [...this.players.values()].filter((p) => p.connected);
  }

  /** Returns the current player count (including disconnected within window). */
  get count(): number {
    return this.players.size;
  }

  /** Returns the count of connected players. */
  get connectedCount(): number {
    return this.getConnected().length;
  }

  /**
   * Adds a new player to the room.
   * @returns true if the player was added, false if room is full or player already exists.
   */
  addPlayer(player: Omit<Player, 'connected' | 'disconnectedAt' | 'joinOrder'>): boolean {
    if (this.players.has(player.id)) {
      return false;
    }

    if (this.players.size >= MAX_PLAYERS) {
      return false;
    }

    this.players.set(player.id, {
      ...player,
      connected: true,
      disconnectedAt: null,
      joinOrder: this.nextJoinOrder++,
    });

    return true;
  }

  /**
   * Removes a player entirely from the room.
   * Use this for permanent removal (e.g., after reconnect window expired).
   */
  removePlayer(playerId: string): void {
    this.players.delete(playerId);
  }

  /**
   * Marks a player as disconnected with a timestamp.
   * The player remains in the room for the reconnect window.
   */
  markDisconnected(playerId: string): void {
    const player = this.players.get(playerId);
    if (player) {
      player.connected = false;
      player.disconnectedAt = Date.now();
    }
  }

  /**
   * Marks a player as reconnected, clearing the disconnection timestamp.
   * @returns true if the player was found and reconnected, false otherwise.
   */
  markReconnected(playerId: string): boolean {
    const player = this.players.get(playerId);
    if (!player) {
      return false;
    }

    // Check if the reconnect window has expired
    if (
      player.disconnectedAt !== null &&
      Date.now() - player.disconnectedAt > RECONNECT_WINDOW_MS
    ) {
      return false;
    }

    player.connected = true;
    player.disconnectedAt = null;
    return true;
  }

  /**
   * Promotes a new host when the current host disconnects or leaves.
   * Selects the connected player with the lowest join order.
   * @returns The new host's player ID, or null if no connected players remain.
   */
  promoteHost(currentHostId: string): string | null {
    const connected = this.getConnected().filter((p) => p.id !== currentHostId);

    if (connected.length === 0) {
      return null;
    }

    // Sort by join order (ascending) and pick the first
    connected.sort((a, b) => a.joinOrder - b.joinOrder);
    return connected[0].id;
  }

  /**
   * Removes players whose reconnect window has expired.
   * @returns Array of removed player IDs.
   */
  pruneExpired(): string[] {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, player] of this.players) {
      if (
        !player.connected &&
        player.disconnectedAt !== null &&
        now - player.disconnectedAt > RECONNECT_WINDOW_MS
      ) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.players.delete(id);
    }

    return expired;
  }
}
