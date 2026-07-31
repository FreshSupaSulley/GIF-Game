import type { PlayerSubmission, MysteryPoolEntry } from '@gif-game/shared';

export interface PoolBuildResult {
  ok: boolean;
  pool?: MysteryPoolEntry[];
  error?: string;
}

/**
 * Builds and shuffles the mystery pool from all player submissions.
 * Ensures no two consecutive entries come from the same submitter (when possible).
 */
export class MysteryPoolBuilder {
  /**
   * Builds the mystery pool from player submissions.
   * @param submissions - Map of playerId -> PlayerSubmission
   * @param roundCount - Expected number of GIFs per player
   * @returns Shuffled mystery pool or an error
   */
  buildPool(
    submissions: Map<string, PlayerSubmission>,
    roundCount: number
  ): PoolBuildResult {
    const playerCount = submissions.size;

    if (playerCount < 2) {
      return { ok: false, error: 'Need at least 2 players to build pool' };
    }

    // Collect all entries
    const entries: MysteryPoolEntry[] = [];

    for (const [, submission] of submissions) {
      if (!submission.finalized) {
        return { ok: false, error: `Player ${submission.playerId} has not finalized` };
      }

      for (const gif of submission.gifs) {
        entries.push({
          gif,
          submitterId: submission.playerId,
          resolved: false,
        });
      }
    }

    // Validate pool size
    const expectedSize = playerCount * roundCount;
    if (entries.length !== expectedSize) {
      return {
        ok: false,
        error: `Pool size ${entries.length} does not match expected ${expectedSize}`,
      };
    }

    // Shuffle with constraints
    const shuffled =
      playerCount === 2
        ? this.alternatingShuffleTwoPlayers(entries)
        : this.constrainedShuffle(entries);

    return { ok: true, pool: shuffled };
  }

  /**
   * For 2 players: alternates entries from each player.
   * Ensures the guesser always gets the other player's GIF.
   */
  private alternatingShuffleTwoPlayers(entries: MysteryPoolEntry[]): MysteryPoolEntry[] {
    const byPlayer = new Map<string, MysteryPoolEntry[]>();

    for (const entry of entries) {
      const list = byPlayer.get(entry.submitterId) ?? [];
      list.push(entry);
      byPlayer.set(entry.submitterId, list);
    }

    const players = [...byPlayer.keys()];
    const listA = this.fisherYatesShuffle([...(byPlayer.get(players[0]) ?? [])]);
    const listB = this.fisherYatesShuffle([...(byPlayer.get(players[1]) ?? [])]);

    // Interleave
    const result: MysteryPoolEntry[] = [];
    const maxLen = Math.max(listA.length, listB.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < listA.length) result.push(listA[i]);
      if (i < listB.length) result.push(listB[i]);
    }

    return result;
  }

  /**
   * For 3+ players: shuffles with the constraint that no two consecutive entries
   * are from the same submitter. Uses a greedy approach with backtracking.
   */
  private constrainedShuffle(entries: MysteryPoolEntry[]): MysteryPoolEntry[] {
    // Group by submitter
    const byPlayer = new Map<string, MysteryPoolEntry[]>();
    for (const entry of entries) {
      const list = byPlayer.get(entry.submitterId) ?? [];
      list.push(entry);
      byPlayer.set(entry.submitterId, list);
    }

    // Shuffle each group
    for (const [key, list] of byPlayer) {
      byPlayer.set(key, this.fisherYatesShuffle([...list]));
    }

    // Greedy interleave: always pick from the player with the most remaining entries
    // that isn't the same as the last placed entry
    const result: MysteryPoolEntry[] = [];
    const remaining = new Map<string, MysteryPoolEntry[]>(byPlayer);
    let lastSubmitter: string | null = null;

    while (result.length < entries.length) {
      // Get candidates (different from last submitter, with remaining entries)
      let candidates = [...remaining.entries()]
        .filter(([id, list]) => list.length > 0 && id !== lastSubmitter)
        .sort((a, b) => b[1].length - a[1].length);

      // If no valid candidate (would create consecutive), pick any remaining
      if (candidates.length === 0) {
        candidates = [...remaining.entries()]
          .filter(([, list]) => list.length > 0)
          .sort((a, b) => b[1].length - a[1].length);
      }

      if (candidates.length === 0) break;

      const [submitterId, list] = candidates[0];
      const entry = list.shift()!;
      result.push(entry);
      lastSubmitter = submitterId;
    }

    return result;
  }

  /** Fisher-Yates shuffle. */
  private fisherYatesShuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}

/**
 * Standalone function to build the mystery pool.
 * Convenience wrapper around MysteryPoolBuilder.
 */
export function buildPool(
  submissions: Map<string, PlayerSubmission>,
  roundCount: number
): PoolBuildResult {
  const builder = new MysteryPoolBuilder();
  return builder.buildPool(submissions, roundCount);
}
