import { describe, it, expect, beforeEach } from 'vitest';
import { SubmissionHandler } from './submission-handler';
import { createDefaultConfig } from './config';
import type { SelectedGif } from '@gif-game/shared';

function makeGif(id: string): SelectedGif {
  return {
    id,
    url: `http://example.com/${id}.gif`,
    thumbnailUrl: `http://example.com/${id}_thumb.gif`,
    title: `GIF ${id}`,
  };
}

describe('SubmissionHandler', () => {
  let handler: SubmissionHandler;

  beforeEach(() => {
    handler = new SubmissionHandler(createDefaultConfig()); // roundCount = 3
  });

  describe('selectGif', () => {
    it('allows selecting a GIF', () => {
      const result = handler.selectGif('p1', makeGif('g1'));
      expect(result.ok).toBe(true);
      expect(handler.getPlayerSubmission('p1')?.gifs).toHaveLength(1);
    });

    it('rejects duplicate GIF ID', () => {
      handler.selectGif('p1', makeGif('g1'));
      const result = handler.selectGif('p1', makeGif('g1'));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('already selected');
    });

    it('auto-finalizes when roundCount reached', () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.selectGif('p1', makeGif('g2'));
      handler.selectGif('p1', makeGif('g3'));

      const submission = handler.getPlayerSubmission('p1');
      expect(submission?.finalized).toBe(true);
    });

    it('rejects selection after finalization', () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.selectGif('p1', makeGif('g2'));
      handler.selectGif('p1', makeGif('g3')); // auto-finalized

      const result = handler.selectGif('p1', makeGif('g4'));
      expect(result.ok).toBe(false);
      expect(result.error).toContain('finalized');
    });

    it('rejects when max GIFs reached (before auto-finalize)', () => {
      // With roundCount=3, after 3 it auto-finalizes, so can't exceed
      handler.selectGif('p1', makeGif('g1'));
      handler.selectGif('p1', makeGif('g2'));
      handler.selectGif('p1', makeGif('g3'));
      const result = handler.selectGif('p1', makeGif('g4'));
      expect(result.ok).toBe(false);
    });
  });

  describe('deselectGif', () => {
    it('removes a selected GIF', () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.selectGif('p1', makeGif('g2'));
      const result = handler.deselectGif('p1', 'g1');
      expect(result.ok).toBe(true);
      expect(handler.getPlayerSubmission('p1')?.gifs).toHaveLength(1);
    });

    it('rejects deselection after finalization', () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.selectGif('p1', makeGif('g2'));
      handler.selectGif('p1', makeGif('g3')); // auto-finalized
      const result = handler.deselectGif('p1', 'g1');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('finalization');
    });

    it('rejects deselection of non-existent GIF', () => {
      handler.selectGif('p1', makeGif('g1'));
      const result = handler.deselectGif('p1', 'g99');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('not found');
    });

    it('returns error for player with no submission', () => {
      const result = handler.deselectGif('unknown', 'g1');
      expect(result.ok).toBe(false);
    });
  });

  describe('finalize', () => {
    it('manually finalizes a submission', () => {
      handler.selectGif('p1', makeGif('g1'));
      const result = handler.finalize('p1');
      expect(result.ok).toBe(true);
      expect(handler.getPlayerSubmission('p1')?.finalized).toBe(true);
    });

    it('rejects finalization with no GIFs', () => {
      // Force creation of empty submission
      handler.selectGif('p1', makeGif('g1'));
      handler.deselectGif('p1', 'g1');
      const result = handler.finalize('p1');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('no GIFs');
    });

    it('rejects double finalization', () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.finalize('p1');
      const result = handler.finalize('p1');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('Already finalized');
    });
  });

  describe('handleTimeout', () => {
    it('auto-fills remaining slots and finalizes', async () => {
      handler.selectGif('p1', makeGif('g1')); // 1 of 3
      // p2 has nothing

      const getRandomGifs = async (count: number) =>
        Array.from({ length: count }, (_, i) => makeGif(`random_${i}`));

      const autoFilled = await handler.handleTimeout(['p1', 'p2'], getRandomGifs);

      expect(autoFilled.get('p1')).toBe(2); // needed 2 more
      expect(autoFilled.get('p2')).toBe(3); // needed all 3
      expect(handler.getPlayerSubmission('p1')?.finalized).toBe(true);
      expect(handler.getPlayerSubmission('p2')?.finalized).toBe(true);
      expect(handler.getPlayerSubmission('p1')?.gifs).toHaveLength(3);
      expect(handler.getPlayerSubmission('p2')?.gifs).toHaveLength(3);
    });

    it('skips already finalized players', async () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.selectGif('p1', makeGif('g2'));
      handler.selectGif('p1', makeGif('g3')); // auto-finalized

      const getRandomGifs = async (count: number) =>
        Array.from({ length: count }, (_, i) => makeGif(`random_${i}`));

      const autoFilled = await handler.handleTimeout(['p1'], getRandomGifs);

      expect(autoFilled.has('p1')).toBe(false);
    });
  });

  describe('allFinalized', () => {
    it('returns true when all players are finalized', () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.selectGif('p1', makeGif('g2'));
      handler.selectGif('p1', makeGif('g3'));
      handler.selectGif('p2', makeGif('g4'));
      handler.selectGif('p2', makeGif('g5'));
      handler.selectGif('p2', makeGif('g6'));

      expect(handler.allFinalized(['p1', 'p2'])).toBe(true);
    });

    it('returns false when any player is not finalized', () => {
      handler.selectGif('p1', makeGif('g1'));
      expect(handler.allFinalized(['p1', 'p2'])).toBe(false);
    });
  });

  describe('reset', () => {
    it('clears all submissions', () => {
      handler.selectGif('p1', makeGif('g1'));
      handler.reset(createDefaultConfig());
      expect(handler.getPlayerSubmission('p1')).toBeUndefined();
    });
  });
});
