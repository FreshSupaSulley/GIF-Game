import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PlayerManager } from './player-manager';

function makePlayer(id: string, overrides?: Partial<{ username: string; avatar: string }>) {
  return {
    id,
    username: overrides?.username ?? `user_${id}`,
    avatar: overrides?.avatar ?? `avatar_${id}`,
  };
}

describe('PlayerManager', () => {
  let manager: PlayerManager;

  beforeEach(() => {
    manager = new PlayerManager();
  });

  describe('addPlayer', () => {
    it('adds a player successfully', () => {
      const result = manager.addPlayer(makePlayer('p1'));
      expect(result).toBe(true);
      expect(manager.count).toBe(1);
    });

    it('rejects duplicate player IDs', () => {
      manager.addPlayer(makePlayer('p1'));
      const result = manager.addPlayer(makePlayer('p1'));
      expect(result).toBe(false);
      expect(manager.count).toBe(1);
    });

    it('enforces MAX_PLAYERS limit (8)', () => {
      for (let i = 0; i < 8; i++) {
        expect(manager.addPlayer(makePlayer(`p${i}`))).toBe(true);
      }
      expect(manager.addPlayer(makePlayer('p8'))).toBe(false);
      expect(manager.count).toBe(8);
    });

    it('sets connected to true and disconnectedAt to null', () => {
      manager.addPlayer(makePlayer('p1'));
      const player = manager.get('p1');
      expect(player?.connected).toBe(true);
      expect(player?.disconnectedAt).toBeNull();
    });

    it('assigns incrementing join order', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.addPlayer(makePlayer('p2'));
      manager.addPlayer(makePlayer('p3'));
      expect(manager.get('p1')?.joinOrder).toBe(0);
      expect(manager.get('p2')?.joinOrder).toBe(1);
      expect(manager.get('p3')?.joinOrder).toBe(2);
    });
  });

  describe('removePlayer', () => {
    it('removes an existing player', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.removePlayer('p1');
      expect(manager.count).toBe(0);
      expect(manager.get('p1')).toBeUndefined();
    });

    it('does nothing for non-existent player', () => {
      manager.removePlayer('nonexistent');
      expect(manager.count).toBe(0);
    });
  });

  describe('markDisconnected / markReconnected', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      manager.addPlayer(makePlayer('p1'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('marks a player as disconnected', () => {
      manager.markDisconnected('p1');
      const player = manager.get('p1');
      expect(player?.connected).toBe(false);
      expect(player?.disconnectedAt).toBe(Date.now());
    });

    it('reconnects within the window', () => {
      manager.markDisconnected('p1');
      vi.advanceTimersByTime(15000); // 15s < 30s window
      const result = manager.markReconnected('p1');
      expect(result).toBe(true);
      const player = manager.get('p1');
      expect(player?.connected).toBe(true);
      expect(player?.disconnectedAt).toBeNull();
    });

    it('rejects reconnection after window expires', () => {
      manager.markDisconnected('p1');
      vi.advanceTimersByTime(31000); // 31s > 30s window
      const result = manager.markReconnected('p1');
      expect(result).toBe(false);
      const player = manager.get('p1');
      expect(player?.connected).toBe(false);
    });

    it('returns false for unknown player reconnect', () => {
      const result = manager.markReconnected('unknown');
      expect(result).toBe(false);
    });
  });

  describe('promoteHost', () => {
    it('promotes lowest join order connected player', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.addPlayer(makePlayer('p2'));
      manager.addPlayer(makePlayer('p3'));

      const newHost = manager.promoteHost('p1');
      expect(newHost).toBe('p2');
    });

    it('skips disconnected players', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.addPlayer(makePlayer('p2'));
      manager.addPlayer(makePlayer('p3'));
      manager.markDisconnected('p2');

      const newHost = manager.promoteHost('p1');
      expect(newHost).toBe('p3');
    });

    it('returns null when no connected players remain', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.addPlayer(makePlayer('p2'));
      manager.markDisconnected('p2');

      const newHost = manager.promoteHost('p1');
      expect(newHost).toBeNull();
    });

    it('returns null when only the current host exists', () => {
      manager.addPlayer(makePlayer('p1'));
      const newHost = manager.promoteHost('p1');
      expect(newHost).toBeNull();
    });
  });

  describe('pruneExpired', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('removes players past the reconnect window', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.addPlayer(makePlayer('p2'));
      manager.markDisconnected('p1');

      vi.advanceTimersByTime(31000);
      const expired = manager.pruneExpired();

      expect(expired).toEqual(['p1']);
      expect(manager.count).toBe(1);
      expect(manager.get('p1')).toBeUndefined();
    });

    it('does not prune players within the window', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.markDisconnected('p1');

      vi.advanceTimersByTime(15000);
      const expired = manager.pruneExpired();

      expect(expired).toEqual([]);
      expect(manager.count).toBe(1);
    });

    it('does not prune connected players', () => {
      manager.addPlayer(makePlayer('p1'));
      vi.advanceTimersByTime(60000);
      const expired = manager.pruneExpired();
      expect(expired).toEqual([]);
    });
  });

  describe('getConnected / connectedCount', () => {
    it('returns only connected players', () => {
      manager.addPlayer(makePlayer('p1'));
      manager.addPlayer(makePlayer('p2'));
      manager.addPlayer(makePlayer('p3'));
      manager.markDisconnected('p2');

      expect(manager.connectedCount).toBe(2);
      const connected = manager.getConnected();
      expect(connected.map((p) => p.id)).toEqual(['p1', 'p3']);
    });
  });
});
