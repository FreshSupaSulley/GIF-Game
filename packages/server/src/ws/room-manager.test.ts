import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RoomManager } from './room-manager';
import type { KlipyService } from '../services/klipy-service';
import type { DiscordUser } from '../auth/discord-auth';
import type { ServerMessage } from '@gif-game/shared';

const createMockUser = (id: string, username: string): DiscordUser => ({
  id,
  username,
  avatar: `https://cdn.discordapp.com/avatars/${id}/avatar.png`,
  discriminator: '0',
  global_name: username,
});

const createMockEvents = () => ({
  broadcast: vi.fn(),
  sendTo: vi.fn(),
});

const createMockKlipyService = () => ({
  search: vi.fn().mockResolvedValue([]),
  random: vi.fn().mockResolvedValue([]),
} as unknown as KlipyService);

describe('RoomManager', () => {
  let roomManager: RoomManager;
  let mockKlipy: KlipyService;

  beforeEach(() => {
    vi.useFakeTimers();
    mockKlipy = createMockKlipyService();
    roomManager = new RoomManager({
      klipyService: mockKlipy,
      cleanupDelayMs: 1000, // Short delay for tests
    });
  });

  afterEach(() => {
    roomManager.close();
    vi.useRealTimers();
  });

  describe('joinRoom', () => {
    it('should create a new room for a new instance', () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();

      const result = roomManager.joinRoom('instance1', user, events);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.state.roomId).toBe('instance1');
        expect(result.state.players['user1']).toBeDefined();
        expect(result.state.players['user1'].username).toBe('TestUser');
      }
    });

    it('should add player to existing room', () => {
      const user1 = createMockUser('user1', 'User1');
      const user2 = createMockUser('user2', 'User2');
      const events = createMockEvents();

      roomManager.joinRoom('instance1', user1, events);
      const result = roomManager.joinRoom('instance1', user2, events);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Object.keys(result.state.players)).toHaveLength(2);
      }
    });

    it('should broadcast player joined to room', () => {
      const user1 = createMockUser('user1', 'User1');
      const user2 = createMockUser('user2', 'User2');
      const events = createMockEvents();

      roomManager.joinRoom('instance1', user1, events);
      roomManager.joinRoom('instance1', user2, events);

      expect(events.broadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'player:joined',
          player: expect.objectContaining({
            id: 'user2',
            username: 'User2',
          }),
        })
      );
    });

    it('should handle reconnection within window', () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();

      // Join initially
      roomManager.joinRoom('instance1', user, events);
      
      // Disconnect
      roomManager.handleDisconnect('instance1', 'user1');
      
      // Reconnect within window
      vi.advanceTimersByTime(500);
      const result = roomManager.joinRoom('instance1', user, events);

      expect(result.ok).toBe(true);
    });

    it('should return room full error when at max players', () => {
      const events = createMockEvents();

      // Fill room (MAX_PLAYERS = 8)
      for (let i = 0; i < 8; i++) {
        const user = createMockUser(`user${i}`, `User${i}`);
        roomManager.joinRoom('instance1', user, events);
      }

      // Try to add one more
      const extraUser = createMockUser('extra', 'ExtraUser');
      const result = roomManager.joinRoom('instance1', extraUser, events);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe('ROOM_FULL');
      }
    });
  });

  describe('handleDisconnect', () => {
    it('should mark player as disconnected', () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();

      roomManager.joinRoom('instance1', user, events);
      roomManager.handleDisconnect('instance1', 'user1');

      const room = roomManager.getRoom('instance1');
      const player = room?.getPlayerManager().get('user1');
      expect(player?.connected).toBe(false);
    });

    it('should schedule cleanup when room becomes empty', () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();

      roomManager.joinRoom('instance1', user, events);
      roomManager.handleDisconnect('instance1', 'user1');

      // Room should still exist
      expect(roomManager.getRoom('instance1')).not.toBeNull();

      // After cleanup delay, room should be removed
      vi.advanceTimersByTime(1500);
      expect(roomManager.getRoom('instance1')).toBeNull();
    });

    it('should cancel cleanup if player reconnects', () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();

      roomManager.joinRoom('instance1', user, events);
      roomManager.handleDisconnect('instance1', 'user1');

      // Reconnect before cleanup
      vi.advanceTimersByTime(500);
      roomManager.joinRoom('instance1', user, events);

      // Wait past original cleanup time
      vi.advanceTimersByTime(1000);
      expect(roomManager.getRoom('instance1')).not.toBeNull();
    });
  });

  describe('handleSearch', () => {
    it('should send search results to player', async () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();
      vi.mocked(mockKlipy.search).mockResolvedValue([
        { id: 'gif1', url: 'url1', thumbnailUrl: 'thumb1', title: 'Cat', width: 200, height: 200 },
      ]);

      roomManager.joinRoom('instance1', user, events);
      await roomManager.handleSearch('instance1', 'user1', 'cat');

      expect(mockKlipy.search).toHaveBeenCalledWith('cat');
      expect(events.sendTo).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          type: 'search:results',
          gifs: expect.arrayContaining([
            expect.objectContaining({ id: 'gif1', title: 'Cat', width: 200, height: 200 }),
          ]),
        })
      );
    });

    it('should send error on search failure', async () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();
      vi.mocked(mockKlipy.search).mockRejectedValue(new Error('API error'));

      roomManager.joinRoom('instance1', user, events);
      await roomManager.handleSearch('instance1', 'user1', 'cat');

      expect(events.sendTo).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          type: 'error',
          code: 'SEARCH_FAILED',
        })
      );
    });
  });

  describe('handleAction', () => {
    it('should pass action to game room', () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();

      roomManager.joinRoom('instance1', user, events);
      
      // This won't actually start the game (need 2 players), but verifies routing
      roomManager.handleAction('instance1', 'user1', { type: 'game:start' });

      // Should have sent an error (not enough players)
      expect(events.sendTo).toHaveBeenCalledWith(
        'user1',
        expect.objectContaining({
          type: 'error',
        })
      );
    });
  });

  describe('getRoom', () => {
    it('should return room if exists', () => {
      const user = createMockUser('user1', 'TestUser');
      const events = createMockEvents();

      roomManager.joinRoom('instance1', user, events);
      expect(roomManager.getRoom('instance1')).not.toBeNull();
    });

    it('should return null if room does not exist', () => {
      expect(roomManager.getRoom('nonexistent')).toBeNull();
    });
  });

  describe('getRoomIds', () => {
    it('should return all room IDs', () => {
      const events = createMockEvents();

      roomManager.joinRoom('instance1', createMockUser('u1', 'U1'), events);
      roomManager.joinRoom('instance2', createMockUser('u2', 'U2'), events);

      expect(roomManager.getRoomIds()).toEqual(['instance1', 'instance2']);
    });
  });
});
