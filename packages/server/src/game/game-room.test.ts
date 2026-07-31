import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GameRoom, type GameRoomEvents } from './game-room';

function createMockEvents(): GameRoomEvents & {
  broadcasts: any[];
  sent: Map<string, any[]>;
} {
  const broadcasts: any[] = [];
  const sent = new Map<string, any[]>();
  return {
    broadcasts,
    sent,
    broadcast(msg) {
      broadcasts.push(msg);
    },
    sendTo(playerId, msg) {
      const list = sent.get(playerId) ?? [];
      list.push(msg);
      sent.set(playerId, list);
    },
  };
}

function makePlayer(id: string) {
  return { id, username: `user_${id}`, avatar: `avatar_${id}` };
}

describe('GameRoom', () => {
  let room: GameRoom;
  let events: ReturnType<typeof createMockEvents>;

  beforeEach(() => {
    events = createMockEvents();
    room = new GameRoom({ roomId: 'room1', instanceId: 'instance1', events });
  });

  describe('addPlayer', () => {
    it('adds a player and sets them as host', () => {
      const added = room.addPlayer(makePlayer('p1'));
      expect(added).toBe(true);
      expect(room.getState().hostId).toBe('p1');
    });

    it('first player becomes host, subsequent do not', () => {
      room.addPlayer(makePlayer('p1'));
      room.addPlayer(makePlayer('p2'));
      expect(room.getState().hostId).toBe('p1');
    });

    it('initializes score to 0 for new player', () => {
      room.addPlayer(makePlayer('p1'));
      expect(room.getState().scores['p1']).toBe(0);
    });
  });

  describe('handleAction - config:update', () => {
    beforeEach(() => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('other'));
    });

    it('host can update config in lobby', () => {
      room.handleAction('host', { type: 'config:update', key: 'roundCount', value: 5 });
      expect(room.getState().config.roundCount).toBe(5);
      expect(events.broadcasts.length).toBeGreaterThan(0);
    });

    it('non-host cannot update config', () => {
      room.handleAction('other', { type: 'config:update', key: 'roundCount', value: 5 });
      expect(room.getState().config.roundCount).toBe(3); // unchanged
      const errors = events.sent.get('other') ?? [];
      expect(errors[0]?.code).toBe('NOT_HOST');
    });

    it('rejects invalid config values', () => {
      room.handleAction('host', { type: 'config:update', key: 'roundCount', value: 99 });
      expect(room.getState().config.roundCount).toBe(3); // unchanged
      const errors = events.sent.get('host') ?? [];
      expect(errors[0]?.code).toBe('INVALID_CONFIG');
    });
  });

  describe('handleAction - game:start', () => {
    it('host can start game with enough players', () => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleAction('host', { type: 'game:start' });
      expect(room.getPhase()).toBe('submission');
    });

    it('non-host cannot start game', () => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleAction('p2', { type: 'game:start' });
      expect(room.getPhase()).toBe('lobby');
      const errors = events.sent.get('p2') ?? [];
      expect(errors[0]?.code).toBe('NOT_HOST');
    });

    it('cannot start with fewer than MIN_PLAYERS', () => {
      room.addPlayer(makePlayer('host'));
      room.handleAction('host', { type: 'game:start' });
      expect(room.getPhase()).toBe('lobby');
      const errors = events.sent.get('host') ?? [];
      expect(errors[0]?.code).toBe('NOT_ENOUGH_PLAYERS');
    });

    it('cannot start from non-lobby phase', () => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleAction('host', { type: 'game:start' });
      expect(room.getPhase()).toBe('submission');

      // Try starting again
      events.sent.clear();
      room.handleAction('host', { type: 'game:start' });
      const errors = events.sent.get('host') ?? [];
      expect(errors[0]?.code).toBe('WRONG_PHASE');
    });
  });

  describe('handleAction - gif:select / gif:deselect', () => {
    beforeEach(() => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleAction('host', { type: 'game:start' });
    });

    it('allows GIF selection during submission phase', () => {
      room.handleAction('p2', {
        type: 'gif:select',
        gifId: 'gif1',
        gifUrl: 'http://example.com/gif1.gif',
        title: 'Funny cat',
      });

      const state = room.getState();
      expect(state.submissions['p2']?.gifs).toHaveLength(1);
    });

    it('allows GIF deselection during submission phase', () => {
      room.handleAction('p2', {
        type: 'gif:select',
        gifId: 'gif1',
        gifUrl: 'http://example.com/gif1.gif',
        title: 'Funny cat',
      });
      room.handleAction('p2', { type: 'gif:deselect', gifId: 'gif1' });

      const state = room.getState();
      expect(state.submissions['p2']?.gifs).toHaveLength(0);
    });

    it('rejects selection in wrong phase', () => {
      room.resetToLobby(false);
      room.handleAction('p2', {
        type: 'gif:select',
        gifId: 'gif1',
        gifUrl: 'http://example.com/gif1.gif',
        title: 'Test',
      });
      const errors = events.sent.get('p2') ?? [];
      const lastError = errors[errors.length - 1];
      expect(lastError?.code).toBe('WRONG_PHASE');
    });
  });

  describe('handleDisconnect', () => {
    it('promotes new host when host disconnects', () => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleDisconnect('host');

      expect(room.getState().hostId).toBe('p2');
      const hostChangedMsg = events.broadcasts.find((m) => m.type === 'player:host-changed');
      expect(hostChangedMsg?.newHostId).toBe('p2');
    });

    it('broadcasts player:left', () => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleDisconnect('p2');

      const leftMsg = events.broadcasts.find((m) => m.type === 'player:left');
      expect(leftMsg?.playerId).toBe('p2');
    });
  });

  describe('resetToLobby', () => {
    it('resets scores and transitions to lobby', () => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleAction('host', { type: 'game:start' });
      room.resetToLobby(false);

      expect(room.getPhase()).toBe('lobby');
      expect(room.getState().scores['host']).toBe(0);
    });

    it('preserves config when requested', () => {
      room.addPlayer(makePlayer('host'));
      room.addPlayer(makePlayer('p2'));
      room.handleAction('host', { type: 'config:update', key: 'roundCount', value: 7 });
      room.handleAction('host', { type: 'game:start' });
      room.resetToLobby(true);

      expect(room.getState().config.roundCount).toBe(7);
    });
  });
});
