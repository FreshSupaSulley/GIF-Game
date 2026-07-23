// =============================================================================
// Centralized Constants File
// All magic numbers grouped by domain. Adjust values here only.
// =============================================================================

// -----------------------------------------------------------------------------
// Timing
// -----------------------------------------------------------------------------

/**
 * Time allowed for selecting the first GIF during submission phase.
 * @range 1-60
 * @default 15
 */
export const SUBMISSION_FIRST_GIF_TIME_SECONDS = 15;

/**
 * Additional time added per subsequent GIF selection beyond the first.
 * Combined formula: SUBMISSION_FIRST_GIF_TIME_SECONDS + SUBMISSION_ADDITIONAL_GIF_TIME_SECONDS * (roundCount - 1)
 * @range 1-60
 * @default 10
 */
export const SUBMISSION_ADDITIONAL_GIF_TIME_SECONDS = 10;

/**
 * Default time limit (in seconds) for each player's guessing turn.
 * Configurable by the host between MIN_GUESS_TIME and MAX_GUESS_TIME.
 * @range 10-60
 * @default 30
 */
export const GUESS_TIME_LIMIT_DEFAULT_SECONDS = 30;

/**
 * Duration (in milliseconds) a disconnected player has to reconnect before
 * being treated as permanently removed from the game.
 * @range 5000-120000
 * @default 30000
 */
export const RECONNECT_WINDOW_MS = 30000;

/**
 * Maximum time (in milliseconds) to wait for a response from the KLIPY API
 * before treating the request as failed.
 * @range 1000-10000
 * @default 3000
 */
export const KLIPY_TIMEOUT_MS = 3000;

/**
 * Number of retry attempts when fetching random GIFs from KLIPY for auto-fill
 * scenarios (e.g., submission timeout).
 * @range 1-5
 * @default 3
 */
export const KLIPY_RETRY_COUNT = 3;

// -----------------------------------------------------------------------------
// Scoring
// -----------------------------------------------------------------------------

/**
 * Points awarded per exact keyword match between the player's title guess
 * and the GIF's actual title (after stop-word removal, case-insensitive).
 * @range 1-1000
 * @default 100
 */
export const EXACT_KEYWORD_MATCH_POINTS = 100;

/**
 * Points awarded when no exact keyword matches exist but the semantic
 * similarity between guess and title meets or exceeds the threshold.
 * @range 1-500
 * @default 50
 */
export const SEMANTIC_MATCH_POINTS = 50;

/**
 * Minimum cosine similarity (0.0 to 1.0) between text embeddings of the
 * guess and the GIF title required to award semantic match points.
 * @range 0.0-1.0
 * @default 0.6
 */
export const SEMANTIC_MATCH_THRESHOLD = 0.6;

/**
 * Points awarded when the guesser correctly identifies who submitted the GIF.
 * Only applied in games with more than 2 players.
 * @range 1-100
 * @default 1
 */
export const CORRECT_SUBMITTER_GUESS_POINTS = 1;

// -----------------------------------------------------------------------------
// Limits
// -----------------------------------------------------------------------------

/**
 * Minimum number of players required to start a game.
 * @range 2-8
 * @default 2
 */
export const MIN_PLAYERS = 2;

/**
 * Maximum number of players allowed in a single lobby.
 * @range 2-8
 * @default 8
 */
export const MAX_PLAYERS = 8;

/**
 * Minimum number of rounds configurable by the host.
 * @range 1-10
 * @default 1
 */
export const MIN_ROUNDS = 1;

/**
 * Maximum number of rounds configurable by the host.
 * @range 1-10
 * @default 10
 */
export const MAX_ROUNDS = 10;

/**
 * Default number of rounds when no custom value is set by the host.
 * @range 1-10
 * @default 3
 */
export const DEFAULT_ROUNDS = 3;

/**
 * Minimum guess time limit (in seconds) configurable by the host.
 * @range 10-60
 * @default 10
 */
export const MIN_GUESS_TIME = 10;

/**
 * Maximum guess time limit (in seconds) configurable by the host.
 * @range 10-60
 * @default 60
 */
export const MAX_GUESS_TIME = 60;

/**
 * Maximum number of GIF search results returned from a single KLIPY query.
 * @range 1-100
 * @default 25
 */
export const MAX_SEARCH_RESULTS = 25;

/**
 * Maximum character length for a player's title guess input.
 * @range 1-500
 * @default 200
 */
export const MAX_TITLE_GUESS_LENGTH = 200;

// -----------------------------------------------------------------------------
// Animation
// -----------------------------------------------------------------------------

/**
 * Duration (in milliseconds) for spring-based interactive animations
 * (button presses, card selections).
 * @range 100-500
 * @default 300
 */
export const SPRING_DURATION_MS = 300;

/**
 * Duration (in milliseconds) for phase transition navigation animations.
 * @range 100-500
 * @default 300
 */
export const PHASE_TRANSITION_MS = 300;

/**
 * Duration (in milliseconds) for physics-based emphasis animations
 * (score reveals, winner declarations).
 * @range 200-1000
 * @default 600
 */
export const EMPHASIS_ANIMATION_MS = 600;

/**
 * Maximum time (in milliseconds) before visual feedback appears after a
 * player interaction event.
 * @range 50-200
 * @default 100
 */
export const INTERACTION_FEEDBACK_MS = 100;

/**
 * Duration (in milliseconds) for the GIF reveal entrance animation during
 * the guessing phase.
 * @range 200-1000
 * @default 500
 */
export const REVEAL_ANIMATION_MS = 500;

// -----------------------------------------------------------------------------
// API
// -----------------------------------------------------------------------------

/**
 * Base URL for the KLIPY GIF API.
 * @default "https://api.klipy.com"
 */
export const KLIPY_BASE_URL = 'https://api.klipy.com';

/**
 * Base URL for the Discord API used for OAuth2 token exchange.
 * @default "https://discord.com/api"
 */
export const DISCORD_API_BASE_URL = 'https://discord.com/api';
