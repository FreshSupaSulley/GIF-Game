import type { ScoreBreakdown } from '@gif-game/shared';
import {
  EXACT_KEYWORD_MATCH_POINTS,
  SEMANTIC_MATCH_POINTS,
  SEMANTIC_MATCH_THRESHOLD,
  CORRECT_SUBMITTER_GUESS_POINTS,
} from '@gif-game/shared';
import { extractKeywords, findMatchingKeywords } from './keywords';
import type { EmbeddingService } from './embedding-service';

export interface ScoringInput {
  playerId: string;
  gifTitle: string;
  titleGuess: string;
  /** The player ID they guessed as submitter (null if skipped in 2-player games) */
  submitterGuess: string | null;
  /** The actual submitter's player ID */
  actualSubmitter: string;
  /** Number of players in the game (used to determine if submitter guess is skipped) */
  playerCount: number;
  /** The search query used to find this GIF (optional, for bonus scoring) */
  query?: string;
  /** The player's guess of what query was used (optional) */
  queryGuess?: string;
}

export interface ExactMatchResult {
  matchedKeywords: string[];
  points: number;
}

export interface SemanticMatchResult {
  similarity: number;
  points: number;
}

/**
 * Scores a title guess using exact keyword matching.
 * Case-insensitive, ignores stop words.
 * 
 * @param guess - The player's title guess
 * @param gifTitle - The actual GIF title
 * @returns Object with matched keywords and points
 */
export function scoreExactMatch(guess: string, gifTitle: string): ExactMatchResult {
  const guessKeywords = extractKeywords(guess);
  const titleKeywords = extractKeywords(gifTitle);
  
  const matchedKeywords = findMatchingKeywords(guessKeywords, titleKeywords);
  const points = matchedKeywords.length * EXACT_KEYWORD_MATCH_POINTS;
  
  return {
    matchedKeywords,
    points,
  };
}

/**
 * Scores a title guess using semantic similarity (embedding cosine similarity).
 * Only applied when there are no exact keyword matches.
 * 
 * @param guess - The player's title guess
 * @param gifTitle - The actual GIF title
 * @param embeddingService - Service for computing text embeddings
 * @returns Object with similarity score and points
 */
export async function scoreSemanticMatch(
  guess: string,
  gifTitle: string,
  embeddingService: EmbeddingService | null
): Promise<SemanticMatchResult> {
  // If no embedding service available, return 0
  if (!embeddingService) {
    return { similarity: 0, points: 0 };
  }

  try {
    const similarity = await embeddingService.computeSimilarity(guess, gifTitle);
    const points = similarity >= SEMANTIC_MATCH_THRESHOLD ? SEMANTIC_MATCH_POINTS : 0;
    
    return {
      similarity,
      points,
    };
  } catch {
    // Graceful fallback: if embedding fails, return 0
    return { similarity: 0, points: 0 };
  }
}

/**
 * Full scoring function that combines submitter guess, exact match, semantic match,
 * and bonus query matching.
 * 
 * Scoring rules:
 * - Correct submitter guess: CORRECT_SUBMITTER_GUESS_POINTS (skipped in 2-player games)
 * - Exact keyword matches (title): EXACT_KEYWORD_MATCH_POINTS per keyword
 * - Semantic match (title): SEMANTIC_MATCH_POINTS if similarity >= threshold AND no exact matches
 * - Query keyword matches: EXACT_KEYWORD_MATCH_POINTS per keyword (bonus, uses queryGuess)
 * - Query semantic match: SEMANTIC_MATCH_POINTS if similarity >= threshold AND no query keyword matches
 * 
 * @param input - Scoring input containing guess details
 * @param embeddingService - Optional embedding service for semantic scoring
 * @returns Full score breakdown
 */
export async function scoreGuess(
  input: ScoringInput,
  embeddingService: EmbeddingService | null
): Promise<ScoreBreakdown> {
  const { playerId, gifTitle, titleGuess, submitterGuess, actualSubmitter, playerCount, query, queryGuess } = input;

  // Submitter guess scoring (skipped in 2-player games)
  let submitterGuessCorrect: boolean | null = null;
  let submitterPoints = 0;
  
  if (playerCount > 2 && submitterGuess !== null) {
    submitterGuessCorrect = submitterGuess === actualSubmitter;
    submitterPoints = submitterGuessCorrect ? CORRECT_SUBMITTER_GUESS_POINTS : 0;
  }

  // Exact keyword matching against title
  const exactMatch = scoreExactMatch(titleGuess, gifTitle);

  // Semantic matching against title (only if no exact matches)
  let semanticResult: SemanticMatchResult = { similarity: 0, points: 0 };
  if (exactMatch.matchedKeywords.length === 0) {
    semanticResult = await scoreSemanticMatch(titleGuess, gifTitle, embeddingService);
  }

  // Query-based scoring (bonus points for guessing the search query)
  // Only score if both query exists AND player provided a queryGuess
  let queryKeywords: string[] = [];
  let queryMatchPoints = 0;
  let querySemanticScore = 0;
  let querySemanticPoints = 0;

  if (query && queryGuess) {
    // Score the player's queryGuess against the actual query
    const queryExactMatch = scoreExactMatch(queryGuess, query);
    queryKeywords = queryExactMatch.matchedKeywords;
    queryMatchPoints = queryExactMatch.points;

    // Semantic matching against query (only if no query keyword matches)
    if (queryKeywords.length === 0) {
      const querySemanticResult = await scoreSemanticMatch(queryGuess, query, embeddingService);
      querySemanticScore = querySemanticResult.similarity;
      querySemanticPoints = querySemanticResult.points;
    }
  }

  const totalPoints = submitterPoints + exactMatch.points + semanticResult.points + queryMatchPoints + querySemanticPoints;

  return {
    playerId,
    gifTitle,
    guess: titleGuess,
    submitterGuessCorrect,
    submitterPoints,
    exactKeywords: exactMatch.matchedKeywords,
    exactMatchPoints: exactMatch.points,
    semanticScore: semanticResult.similarity,
    semanticPoints: semanticResult.points,
    queryUsed: query,
    queryKeywords,
    queryMatchPoints,
    querySemanticScore,
    querySemanticPoints,
    totalPoints,
  };
}
