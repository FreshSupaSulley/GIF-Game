import { describe, it, expect } from 'vitest';
import { MysteryPoolBuilder } from './mystery-pool-builder';
import type { PlayerSubmission, SelectedGif } from '@gif-game/shared';

function makeGif(id: string): SelectedGif {
  return {
    id,
    url: `http://example.com/${id}.gif`,
    thumbnailUrl: `http://example.com/${id}_thumb.gif`,
    title: `GIF ${id}`,
  };
}

function makeSubmission(playerId: string, gifCount: number): PlayerSubmission {
  return {
    playerId,
    gifs: Array.from({ length: gifCount }, (_, i) => makeGif(`${playerId}_g${i}`)),
    finalized: true,
  };
}

describe('MysteryPoolBuilder', () => {
  let builder: MysteryPoolBuilder;

  beforeEach(() => {
    builder = new MysteryPoolBuilder();
  });

  describe('buildPool', () => {
    it('builds a pool with correct size for 2 players, 3 rounds', () => {
      const submissions = new Map([
        ['p1', makeSubmission('p1', 3)],
        ['p2', makeSubmission('p2', 3)],
      ]);

      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(true);
      expect(result.pool).toHaveLength(6); // 2 players * 3 rounds
    });

    it('builds a pool with correct size for 4 players, 2 rounds', () => {
      const submissions = new Map([
        ['p1', makeSubmission('p1', 2)],
        ['p2', makeSubmission('p2', 2)],
        ['p3', makeSubmission('p3', 2)],
        ['p4', makeSubmission('p4', 2)],
      ]);

      const result = builder.buildPool(submissions, 2);
      expect(result.ok).toBe(true);
      expect(result.pool).toHaveLength(8); // 4 players * 2 rounds
    });

    it('alternates submitters for 2-player games', () => {
      const submissions = new Map([
        ['p1', makeSubmission('p1', 3)],
        ['p2', makeSubmission('p2', 3)],
      ]);

      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(true);

      // Check alternating pattern
      const pool = result.pool!;
      for (let i = 1; i < pool.length; i++) {
        expect(pool[i].submitterId).not.toBe(pool[i - 1].submitterId);
      }
    });

    it('avoids consecutive same-submitter for 3+ players', () => {
      const submissions = new Map([
        ['p1', makeSubmission('p1', 3)],
        ['p2', makeSubmission('p2', 3)],
        ['p3', makeSubmission('p3', 3)],
      ]);

      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(true);

      const pool = result.pool!;
      for (let i = 1; i < pool.length; i++) {
        expect(pool[i].submitterId).not.toBe(pool[i - 1].submitterId);
      }
    });

    it('returns error for less than 2 players', () => {
      const submissions = new Map([['p1', makeSubmission('p1', 3)]]);
      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('at least 2');
    });

    it('returns error if a player has not finalized', () => {
      const sub = makeSubmission('p1', 3);
      sub.finalized = false;
      const submissions = new Map([
        ['p1', sub],
        ['p2', makeSubmission('p2', 3)],
      ]);

      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not finalized');
    });

    it('returns error on pool size mismatch', () => {
      const submissions = new Map([
        ['p1', makeSubmission('p1', 2)], // only 2, expecting 3
        ['p2', makeSubmission('p2', 3)],
      ]);

      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('does not match');
    });

    it('all entries are marked as unresolved', () => {
      const submissions = new Map([
        ['p1', makeSubmission('p1', 3)],
        ['p2', makeSubmission('p2', 3)],
      ]);

      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(true);
      for (const entry of result.pool!) {
        expect(entry.resolved).toBe(false);
      }
    });

    it('preserves all GIFs in the pool', () => {
      const submissions = new Map([
        ['p1', makeSubmission('p1', 3)],
        ['p2', makeSubmission('p2', 3)],
        ['p3', makeSubmission('p3', 3)],
      ]);

      const result = builder.buildPool(submissions, 3);
      expect(result.ok).toBe(true);

      const allGifIds = result.pool!.map((e) => e.gif.id).sort();
      const expectedIds = [
        ...submissions.get('p1')!.gifs.map((g) => g.id),
        ...submissions.get('p2')!.gifs.map((g) => g.id),
        ...submissions.get('p3')!.gifs.map((g) => g.id),
      ].sort();

      expect(allGifIds).toEqual(expectedIds);
    });
  });
});

// Need this import for beforeEach
import { beforeEach } from 'vitest';
