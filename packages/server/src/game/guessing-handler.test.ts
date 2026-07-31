import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GuessingHandler } from './guessing-handler';
import type { MysteryPoolEntry, GameConfig, SelectedGif } from '@gif-game/shared';
import type { EmbeddingService } from '../scoring';
import { GUESS_TIME_LIMIT_DEFAULT_SECONDS } from '@gif-game/shared';

const createMockGif = (id: string, title: string): SelectedGif => ({
  id,
  url: `https://example.com/${id}.gif`,
  thumbnailUrl: `https://example.com/${id}_thumb.gif`,
  title,
});

const createMockPool = (...entries: Array<[string, string, string]>): MysteryPoolEntry[] =>
  entries.map(([gifId, title, submitterId]) => ({
    gif: createMockGif(gifId, title),
    submitterId,
    resolved: false,
  }));

const createConfig = (overrides?: Partial<GameConfig>): GameConfig => ({
  roundCount: 3,
  guessTimeLimit: 30,
  submissionTimeLimit: 45,
  queryGuessEnabled: false,
  ...overrides,
});

describe('GuessingHandler', () => {
  let handler: GuessingHandler;
  let mockEmbeddingService: EmbeddingService;

  beforeEach(() => {
    handler = new GuessingHandler(createConfig());
    mockEmbeddingService = {
      isReady: () => true,
      computeSimilarity: vi.fn().mockResolvedValue(0.5),
      computeEmbedding: vi.fn(),
      dispose: vi.fn(),
    };
  });

  describe('initialization', () => {
    it('should set up turn order with all players', () => {
      const pool = createMockPool(['gif1', 'Happy Cat', 'player1']);
      const players = ['player1', 'player2', 'player3'];
      
      handler.initialize(pool, players);
      const state = handler.getTurnState();
      
      expect(state.turnOrder).toHaveLength(3);
      expect(new Set(state.turnOrder)).toEqual(new Set(players));
    });

    it('should set first GIF as current', () => {
      const pool = createMockPool(
        ['gif1', 'Happy Cat', 'player1'],
        ['gif2', 'Funny Dog', 'player2']
      );
      
      handler.initialize(pool, ['player1', 'player2']);
      
      expect(handler.getTurnState().currentGifIndex).toBe(0);
      expect(handler.getCurrentGif()?.gif.id).toBe('gif1');
    });

    it('should set a guesser who is not the submitter', () => {
      const pool = createMockPool(['gif1', 'Happy Cat', 'player1']);
      
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      
      const guesser = handler.getCurrentGuesser();
      expect(guesser).not.toBe('player1'); // Not the submitter
      expect(['player2', 'player3']).toContain(guesser);
    });
  });

  describe('isCurrentGuesser', () => {
    it('should return true for current guesser', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      
      const guesser = handler.getCurrentGuesser()!;
      expect(handler.isCurrentGuesser(guesser)).toBe(true);
    });

    it('should return false for other players', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      
      // player1 is submitter so can't be guesser
      expect(handler.isCurrentGuesser('player1')).toBe(false);
    });
  });

  describe('guessSubmitter', () => {
    it('should accept valid submitter guess', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      const guesser = handler.getCurrentGuesser()!;
      
      const result = handler.guessSubmitter(guesser, 'player1');
      expect(result.ok).toBe(true);
      expect(handler.getTurnState().submitterGuess).toBe('player1');
    });

    it('should reject guess from non-current player', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      
      const result = handler.guessSubmitter('player1', 'player2'); // player1 is submitter, not guesser
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Not your turn');
    });

    it('should reject duplicate submitter guess', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessSubmitter(guesser, 'player1');
      const result = handler.guessSubmitter(guesser, 'player2');
      
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Submitter already guessed');
    });

    it('should skip submitter guess in 2-player games', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      const result = handler.guessSubmitter(guesser, 'player1');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Submitter guess skipped in 2-player games');
    });

    it('should reject invalid player ID', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      const guesser = handler.getCurrentGuesser()!;
      
      const result = handler.guessSubmitter(guesser, 'nonexistent');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Invalid player ID');
    });
  });

  describe('guessTitle', () => {
    it('should accept valid title guess', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      const result = handler.guessTitle(guesser, 'Happy Cat');
      expect(result.ok).toBe(true);
      expect(handler.getTurnState().titleGuess).toBe('Happy Cat');
    });

    it('should trim whitespace', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessTitle(guesser, '  Happy Cat  ');
      expect(handler.getTurnState().titleGuess).toBe('Happy Cat');
    });

    it('should reject empty title', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      const result = handler.guessTitle(guesser, '   ');
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Title cannot be empty');
    });

    it('should reject guess from non-current player', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      
      const result = handler.guessTitle('player1', 'Happy Cat'); // player1 is submitter
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Not your turn');
    });

    it('should reject duplicate title guess', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessTitle(guesser, 'First guess');
      const result = handler.guessTitle(guesser, 'Second guess');
      
      expect(result.ok).toBe(false);
      expect(result.error).toBe('Title already guessed');
    });
  });

  describe('isTurnComplete', () => {
    it('should return false when no guesses made', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      
      expect(handler.isTurnComplete()).toBe(false);
    });

    it('should return false with only submitter guess', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessSubmitter(guesser, 'player1');
      expect(handler.isTurnComplete()).toBe(false);
    });

    it('should return false with only title guess in 3+ player game', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessTitle(guesser, 'Happy Cat');
      expect(handler.isTurnComplete()).toBe(false);
    });

    it('should return true with both guesses in 3+ player game', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessSubmitter(guesser, 'player1');
      handler.guessTitle(guesser, 'Happy Cat');
      expect(handler.isTurnComplete()).toBe(true);
    });

    it('should return true with only title guess in 2-player game', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessTitle(guesser, 'Happy Cat');
      expect(handler.isTurnComplete()).toBe(true);
    });
  });

  describe('scoreTurn', () => {
    it('should return score breakdown', async () => {
      const pool = createMockPool(['gif1', 'Happy Dancing Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3'], mockEmbeddingService);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessSubmitter(guesser, 'player1');
      handler.guessTitle(guesser, 'Happy Cat');
      
      const score = await handler.scoreTurn();
      
      expect(score).not.toBeNull();
      expect(score!.playerId).toBe(guesser);
      expect(score!.gifTitle).toBe('Happy Dancing Cat');
      expect(score!.guess).toBe('Happy Cat');
      expect(score!.submitterGuessCorrect).toBe(true); // Correct submitter
      expect(score!.exactKeywords).toContain('happy');
      expect(score!.exactKeywords).toContain('cat');
    });

    it('should return null if no guesses made', async () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      
      const score = await handler.scoreTurn();
      expect(score).toBeNull();
    });
  });

  describe('advanceTurn', () => {
    it('should move to next guesser for same GIF', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      const firstGuesser = handler.getCurrentGuesser()!;
      
      // Complete the turn
      handler.guessSubmitter(firstGuesser, 'player1');
      handler.guessTitle(firstGuesser, 'Happy Cat');
      
      const result = handler.advanceTurn();
      
      expect(result.hasNext).toBe(true);
      expect(result.nextGifIndex).toBe(0); // Same GIF
      expect(handler.getCurrentGuesser()).not.toBe(firstGuesser);
    });

    it('should move to next GIF when all guessers done', () => {
      const pool = createMockPool(
        ['gif1', 'Cat', 'player1'],
        ['gif2', 'Dog', 'player2']
      );
      // Only 2 players, so only 1 guesser per GIF
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessTitle(guesser, 'Cat');
      const result = handler.advanceTurn();
      
      expect(result.hasNext).toBe(true);
      expect(result.nextGifIndex).toBe(1);
    });

    it('should signal phase complete when all GIFs done', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      const guesser = handler.getCurrentGuesser()!;
      
      handler.guessTitle(guesser, 'Cat');
      const result = handler.advanceTurn();
      
      expect(result.hasNext).toBe(false);
      expect(result.phaseComplete).toBe(true);
    });

    it('should re-randomize turn order for new GIF', () => {
      const pool = createMockPool(
        ['gif1', 'Cat', 'player4'], // player4 is submitter, so only player1-3 guess
        ['gif2', 'Dog', 'player4']
      );
      const players = ['player1', 'player2', 'player3', 'player4'];
      handler.initialize(pool, players);
      
      const firstOrder = [...handler.getTurnState().turnOrder];
      
      // Complete all guessers for first GIF (3 guessers since player4 is submitter)
      for (let i = 0; i < 3; i++) {
        const guesser = handler.getCurrentGuesser();
        if (guesser) {
          handler.guessSubmitter(guesser, 'player1');
          handler.guessTitle(guesser, 'Cat');
          handler.advanceTurn();
        }
      }
      
      const secondOrder = handler.getTurnState().turnOrder;
      
      // Turn orders should still contain same players
      expect(new Set(secondOrder)).toEqual(new Set(firstOrder));
    });
  });

  describe('handleTimeout', () => {
    it('should auto-submit empty guesses and advance', () => {
      const pool = createMockPool(
        ['gif1', 'Cat', 'player1'],
        ['gif2', 'Dog', 'player2']
      );
      handler.initialize(pool, ['player1', 'player2', 'player3']);
      
      const result = handler.handleTimeout();
      
      // After timeout, we advance to next turn (not phase complete since there are more GIFs/guessers)
      expect(result.hasNext).toBe(true);
    });
  });

  describe('getGuessTimeLimit', () => {
    it('should return config time limit', () => {
      const handler = new GuessingHandler(createConfig({ guessTimeLimit: 45 }));
      expect(handler.getGuessTimeLimit()).toBe(45);
    });

    it('should return default when not set', () => {
      const handler = new GuessingHandler({
        roundCount: 3,
        submissionTimeLimit: 45,
      } as GameConfig);
      expect(handler.getGuessTimeLimit()).toBe(GUESS_TIME_LIMIT_DEFAULT_SECONDS);
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const pool = createMockPool(['gif1', 'Cat', 'player1']);
      handler.initialize(pool, ['player1', 'player2']);
      
      handler.reset(createConfig());
      
      expect(handler.getCurrentGif()).toBeNull();
      expect(handler.getCurrentGuesser()).toBeNull();
      expect(handler.getTurnState().turnOrder).toEqual([]);
    });
  });
});
