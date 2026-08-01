/**
 * Stop words to ignore when extracting keywords for scoring.
 * Includes articles, prepositions, conjunctions, and common filler words.
 */
export const STOP_WORDS = new Set([
  // Articles
  'a', 'an', 'the',
  
  // Prepositions
  'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'up', 'down',
  'into', 'onto', 'upon', 'out', 'off', 'over', 'under', 'about', 'through',
  'between', 'among', 'after', 'before', 'during', 'without', 'within',
  'along', 'across', 'behind', 'below', 'beneath', 'beside', 'besides',
  'beyond', 'near', 'toward', 'towards', 'around', 'against', 'above',
  
  // Conjunctions
  'and', 'or', 'but', 'nor', 'so', 'yet', 'for', 'because', 'although',
  'though', 'while', 'if', 'unless', 'until', 'when', 'where', 'whether',
  'as', 'than', 'that', 'which', 'who', 'whom', 'whose',
  
  // Pronouns
  'i', 'me', 'my', 'mine', 'myself',
  'you', 'your', 'yours', 'yourself', 'yourselves',
  'he', 'him', 'his', 'himself',
  'she', 'her', 'hers', 'herself',
  'it', 'its', 'itself',
  'we', 'us', 'our', 'ours', 'ourselves',
  'they', 'them', 'their', 'theirs', 'themselves',
  'this', 'that', 'these', 'those',
  'what', 'whatever', 'whatsoever',
  
  // Common verbs (be, have, do)
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'having',
  'do', 'does', 'did', 'doing', 'done',
  
  // Auxiliaries and modals
  'can', 'could', 'may', 'might', 'must', 'shall', 'should', 'will', 'would',
  
  // Common adverbs
  'not', 'no', 'yes', 'just', 'only', 'very', 'really', 'too', 'also',
  'now', 'then', 'here', 'there', 'always', 'never', 'sometimes', 'often',
  'still', 'already', 'ever', 'even', 'much', 'more', 'most', 'less', 'least',
  
  // Common filler words
  'like', 'get', 'got', 'getting', 'gonna', 'gotta', 'wanna',
  'oh', 'ah', 'um', 'uh', 'hmm', 'huh', 'wow', 'oops', 'hey', 'hi', 'hello',
  'ok', 'okay', 'well', 'right', 'yeah', 'yep', 'nope',
  
  // GIF-specific common words (often in titles but not meaningful)
  'gif', 'gifs', 'giphy', 'tenor', 'animated', 'animation', 'meme', 'reaction',
]);

/**
 * Extracts meaningful keywords from text by:
 * 1. Converting to lowercase
 * 2. Removing punctuation and special characters
 * 3. Splitting into words
 * 4. Filtering out stop words
 * 5. Filtering out very short words (1-2 chars)
 * 
 * @param text - The text to extract keywords from
 * @returns Array of lowercase keywords
 */
export function extractKeywords(text: string): string[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  return text
    .toLowerCase()
    // Replace punctuation and special chars with spaces
    .replace(/[^\w\s]/g, ' ')
    // Split on whitespace
    .split(/\s+/)
    // Filter out stop words and short words
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

/**
 * Checks if two keyword arrays have any common keywords (exact match).
 * @param keywords1 - First array of keywords
 * @param keywords2 - Second array of keywords
 * @returns Array of matching keywords
 */
export function findMatchingKeywords(
  keywords1: string[],
  keywords2: string[]
): string[] {
  const set2 = new Set(keywords2);
  return keywords1.filter((kw) => set2.has(kw));
}

/**
 * Calculates Levenshtein distance between two strings.
 * Used for fuzzy/partial matching.
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Checks if two words are a partial match.
 * Returns true if:
 * - One word starts with the other (prefix match, min 3 chars)
 * - Words are within edit distance of 1-2 depending on length (typo tolerance)
 * - One word contains the other (substring match, min 4 chars for contained word)
 */
export function isPartialMatch(word1: string, word2: string): boolean {
  // Exact match
  if (word1 === word2) return true;
  
  const shorter = word1.length <= word2.length ? word1 : word2;
  const longer = word1.length <= word2.length ? word2 : word1;
  
  // Prefix match: if shorter word (3+ chars) is prefix of longer
  if (shorter.length >= 3 && longer.startsWith(shorter)) {
    return true;
  }
  
  // Substring match: if shorter word (4+ chars) is contained in longer
  if (shorter.length >= 4 && longer.includes(shorter)) {
    return true;
  }
  
  // Typo tolerance based on word length
  // Short words (3-4 chars): allow 1 edit
  // Medium words (5-7 chars): allow 1-2 edits
  // Long words (8+ chars): allow 2 edits
  const maxDistance = shorter.length <= 4 ? 1 : shorter.length <= 7 ? 2 : 2;
  
  // Only check edit distance for words of similar length (within 2 chars)
  if (Math.abs(word1.length - word2.length) <= 2) {
    const distance = levenshteinDistance(word1, word2);
    if (distance <= maxDistance) {
      return true;
    }
  }
  
  return false;
}

/**
 * Finds partial matches between keyword arrays.
 * Returns matches with their match quality (exact vs partial).
 */
export interface PartialMatchResult {
  guessWord: string;
  matchedWord: string;
  isExact: boolean;
}

export function findPartialMatches(
  guessKeywords: string[],
  targetKeywords: string[]
): PartialMatchResult[] {
  const results: PartialMatchResult[] = [];
  const usedTargetWords = new Set<string>();
  
  for (const guessWord of guessKeywords) {
    // First try exact match
    const exactMatch = targetKeywords.find(
      (tw) => tw === guessWord && !usedTargetWords.has(tw)
    );
    
    if (exactMatch) {
      results.push({ guessWord, matchedWord: exactMatch, isExact: true });
      usedTargetWords.add(exactMatch);
      continue;
    }
    
    // Then try partial match
    const partialMatch = targetKeywords.find(
      (tw) => !usedTargetWords.has(tw) && isPartialMatch(guessWord, tw)
    );
    
    if (partialMatch) {
      results.push({ guessWord, matchedWord: partialMatch, isExact: false });
      usedTargetWords.add(partialMatch);
    }
  }
  
  return results;
}
