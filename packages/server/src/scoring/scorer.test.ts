import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreExactMatch, scoreSemanticMatch, scoreGuess } from './scorer';
import type { EmbeddingService } from './embedding-service';
import {
  EXACT_KEYWORD_MATCH_POINTS,
  SEMANTIC_MATCH_POINTS,
  SEMANTIC_MATCH_THRESHOLD,
  CORRECT_SUBMITTER_GUESS_POINTS,
} from '@gif-game/shared';

describe('scoreExactMatch', () => {
  it('should score 100 points per matching keyword', () => {
    const result = scoreExactMatch('happy cat', 'happy cat dancing');
    expect(result.matchedKeywords).toEqual(['happy', 'cat']);
    expect(result.points).toBe(2 * EXACT_KEYWORD_MATCH_POINTS);
  });

  it('should be case-insensitive', () => {
    const result = scoreExactMatch('HAPPY Cat', 'Happy CAT dancing');
    expect(result.matchedKeywords).toEqual(['happy', 'cat']);
    expect(result.points).toBe(2 * EXACT_KEYWORD_MATCH_POINTS);
  });

  it('should filter out stop words', () => {
    const result = scoreExactMatch('the happy cat', 'a happy cat');
    expect(result.matchedKeywords).toEqual(['happy', 'cat']);
    expect(result.points).toBe(2 * EXACT_KEYWORD_MATCH_POINTS);
  });

  it('should return 0 for no matches', () => {
    const result = scoreExactMatch('sad dog', 'happy cat');
    expect(result.matchedKeywords).toEqual([]);
    expect(result.points).toBe(0);
  });

  it('should handle empty strings', () => {
    expect(scoreExactMatch('', 'happy cat').points).toBe(0);
    expect(scoreExactMatch('happy cat', '').points).toBe(0);
  });

  it('should match single keyword', () => {
    const result = scoreExactMatch('cat', 'funny cat meme');
    expect(result.matchedKeywords).toEqual(['cat']);
    expect(result.points).toBe(EXACT_KEYWORD_MATCH_POINTS);
  });
});

describe('scoreSemanticMatch', () => {
  let mockEmbeddingService: EmbeddingService;

  beforeEach(() => {
    mockEmbeddingService = {
      isReady: () => true,
      computeSimilarity: vi.fn(),
      computeEmbedding: vi.fn(),
      dispose: vi.fn(),
    };
  });

  it('should return semantic points when similarity >= threshold', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockResolvedValue(SEMANTIC_MATCH_THRESHOLD);
    const result = await scoreSemanticMatch('happy cat', 'joyful feline', mockEmbeddingService);
    expect(result.similarity).toBe(SEMANTIC_MATCH_THRESHOLD);
    expect(result.points).toBe(SEMANTIC_MATCH_POINTS);
  });

  it('should return 0 points when similarity < threshold', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockResolvedValue(0.5);
    const result = await scoreSemanticMatch('happy cat', 'sad dog', mockEmbeddingService);
    expect(result.similarity).toBe(0.5);
    expect(result.points).toBe(0);
  });

  it('should return 0 when no embedding service', async () => {
    const result = await scoreSemanticMatch('happy cat', 'joyful feline', null);
    expect(result.similarity).toBe(0);
    expect(result.points).toBe(0);
  });

  it('should return 0 on embedding error', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockRejectedValue(new Error('ONNX error'));
    const result = await scoreSemanticMatch('happy cat', 'joyful feline', mockEmbeddingService);
    expect(result.similarity).toBe(0);
    expect(result.points).toBe(0);
  });

  it('should award points at exactly the threshold', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockResolvedValue(0.6);
    const result = await scoreSemanticMatch('cats', 'felines', mockEmbeddingService);
    expect(result.points).toBe(SEMANTIC_MATCH_POINTS);
  });

  it('should not award points just below threshold', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockResolvedValue(0.59);
    const result = await scoreSemanticMatch('cats', 'dogs', mockEmbeddingService);
    expect(result.points).toBe(0);
  });
});

describe('scoreGuess', () => {
  let mockEmbeddingService: EmbeddingService;

  beforeEach(() => {
    mockEmbeddingService = {
      isReady: () => true,
      computeSimilarity: vi.fn().mockResolvedValue(0.5), // Below threshold by default
      computeEmbedding: vi.fn(),
      dispose: vi.fn(),
    };
  });

  it('should combine exact match and submitter guess points', async () => {
    const result = await scoreGuess({
      playerId: 'player1',
      gifTitle: 'happy dancing cat',
      titleGuess: 'happy cat',
      submitterGuess: 'player2',
      actualSubmitter: 'player2',
      playerCount: 3,
    }, mockEmbeddingService);

    expect(result.exactKeywords).toEqual(['happy', 'cat']);
    expect(result.exactMatchPoints).toBe(2 * EXACT_KEYWORD_MATCH_POINTS);
    expect(result.submitterGuessCorrect).toBe(true);
    expect(result.submitterPoints).toBe(CORRECT_SUBMITTER_GUESS_POINTS);
    expect(result.semanticPoints).toBe(0); // Not applied when exact matches exist
    expect(result.totalPoints).toBe(2 * EXACT_KEYWORD_MATCH_POINTS + CORRECT_SUBMITTER_GUESS_POINTS);
  });

  it('should skip submitter guess in 2-player games', async () => {
    const result = await scoreGuess({
      playerId: 'player1',
      gifTitle: 'happy cat',
      titleGuess: 'happy cat',
      submitterGuess: null,
      actualSubmitter: 'player2',
      playerCount: 2,
    }, mockEmbeddingService);

    expect(result.submitterGuessCorrect).toBeNull();
    expect(result.submitterPoints).toBe(0);
  });

  it('should use semantic scoring when no exact matches', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockResolvedValue(0.7);
    
    const result = await scoreGuess({
      playerId: 'player1',
      gifTitle: 'happy cat',
      titleGuess: 'joyful feline', // No keyword overlap
      submitterGuess: 'player2',
      actualSubmitter: 'player3', // Wrong guess
      playerCount: 3,
    }, mockEmbeddingService);

    expect(result.exactKeywords).toEqual([]);
    expect(result.exactMatchPoints).toBe(0);
    expect(result.semanticScore).toBe(0.7);
    expect(result.semanticPoints).toBe(SEMANTIC_MATCH_POINTS);
    expect(result.submitterGuessCorrect).toBe(false);
    expect(result.submitterPoints).toBe(0);
    expect(result.totalPoints).toBe(SEMANTIC_MATCH_POINTS);
  });

  it('should not use semantic scoring when exact matches exist', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockResolvedValue(0.9);
    
    const result = await scoreGuess({
      playerId: 'player1',
      gifTitle: 'happy cat dancing',
      titleGuess: 'happy feline', // 'happy' matches
      submitterGuess: null,
      actualSubmitter: 'player2',
      playerCount: 3,
    }, mockEmbeddingService);

    expect(result.exactKeywords).toEqual(['happy']);
    expect(result.exactMatchPoints).toBe(EXACT_KEYWORD_MATCH_POINTS);
    expect(result.semanticScore).toBe(0); // Not computed
    expect(result.semanticPoints).toBe(0);
  });

  it('should award 0 points for completely wrong guess', async () => {
    vi.mocked(mockEmbeddingService.computeSimilarity).mockResolvedValue(0.3);
    
    const result = await scoreGuess({
      playerId: 'player1',
      gifTitle: 'happy cat',
      titleGuess: 'sad dog',
      submitterGuess: 'player2',
      actualSubmitter: 'player3',
      playerCount: 3,
    }, mockEmbeddingService);

    expect(result.totalPoints).toBe(0);
  });

  it('should return correct player ID and guesses in breakdown', async () => {
    const result = await scoreGuess({
      playerId: 'player-abc',
      gifTitle: 'original title',
      titleGuess: 'my guess',
      submitterGuess: 'player-xyz',
      actualSubmitter: 'player-xyz',
      playerCount: 4,
    }, mockEmbeddingService);

    expect(result.playerId).toBe('player-abc');
    expect(result.gifTitle).toBe('original title');
    expect(result.guess).toBe('my guess');
  });

  it('should work without embedding service', async () => {
    const result = await scoreGuess({
      playerId: 'player1',
      gifTitle: 'happy cat',
      titleGuess: 'sad dog', // No keyword match
      submitterGuess: 'player2',
      actualSubmitter: 'player2',
      playerCount: 3,
    }, null);

    expect(result.semanticScore).toBe(0);
    expect(result.semanticPoints).toBe(0);
    expect(result.submitterGuessCorrect).toBe(true);
    expect(result.totalPoints).toBe(CORRECT_SUBMITTER_GUESS_POINTS);
  });
});
