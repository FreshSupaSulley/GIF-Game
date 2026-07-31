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
 * Checks if two keyword arrays have any common keywords.
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
