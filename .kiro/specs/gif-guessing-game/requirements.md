# Requirements Document

## Introduction

A multiplayer GIF guessing game built as a Discord Activity using the Embedded App SDK. Players join a lobby, submit their favorite GIFs to a mystery pool, then take turns guessing who submitted each GIF and its original title. The game features a minimalistic UI inspired by Balatro, Rhythm Heaven, and WarioWare with bouncy animations and snappy interactions. The game is played entirely within Discord, leveraging Discord's built-in infrastructure (voice channels, presence, identity) rather than building custom alternatives.

## Glossary

- **Activity**: A web application embedded in an iframe within Discord using the Embedded App SDK, playable in voice channels, text channels, or DMs
- **Lobby**: A waiting room where players gather before a game starts, managed by a single Host
- **Host**: The player who created the Lobby and has permission to configure game rules
- **Player**: Any participant in the Lobby, including the Host
- **Round_Count**: The number of guessing rounds in a game, configurable by the Host (default: 3)
- **Submission_Phase**: The phase where each Player selects GIFs equal to the Round_Count
- **Submission_Time_Limit**: The total submission timer calculated as 15 seconds for the first GIF plus 10 seconds for each additional GIF (formula: 15 + 10 * (Round_Count - 1))
- **Mystery_Pool**: The combined collection of all submitted GIFs, anonymized and shuffled
- **Guessing_Phase**: The phase where Players are cycled through and presented GIFs to guess
- **GIF_Title**: The title or name metadata associated with a GIF on KLIPY
- **Exact_Match**: A guess that contains the exact keywords from the GIF_Title
- **Semantic_Match**: A guess that is semantically similar to the GIF_Title but does not contain exact keywords
- **GIF_Provider**: The KLIPY API service that provides GIF search and metadata
- **Scorer**: The system component responsible for evaluating guesses and awarding points
- **Constants_File**: A centralized configuration file containing all magic numbers, thresholds, timing values, point values, and configurable parameters with clear naming and documentation

## Requirements

### Requirement 1: Lobby Creation and Management

**User Story:** As a player, I want to create and join game lobbies within Discord, so that I can play with friends in voice or text channels.

#### Acceptance Criteria

1. WHEN a user launches the Activity, THE Activity SHALL create a new Lobby and assign the launching user as the Host
2. WHEN a user joins an existing Activity session that has fewer than 8 Players, THE Activity SHALL add the user to the current Lobby as a Player
3. WHILE the game is in the Lobby state, THE Activity SHALL display all connected Players in the Lobby with their Discord avatar and username
4. WHILE the game is in the Lobby state, THE Host SHALL be able to start the game when at least 2 Players are present
5. IF a Player disconnects during the Lobby state, THEN THE Activity SHALL remove the Player from the Lobby and update the displayed player list for all remaining Players within 2 seconds
6. THE Activity SHALL support a minimum of 2 Players and a maximum of 8 Players per Lobby
7. IF a user attempts to join a Lobby that already contains 8 Players, THEN THE Activity SHALL reject the join request and display a message indicating the Lobby is full

### Requirement 2: Host Configuration

**User Story:** As a host, I want to configure the game rules before starting, so that I can customize the experience for my group.

#### Acceptance Criteria

1. WHILE the game is in the Lobby state, THE Activity SHALL display a configuration panel to the Host
2. WHILE the game is in the Lobby state, THE Activity SHALL allow the Host to set the Round_Count between 1 and 10 (inclusive), with a default of 3
3. THE Activity SHALL calculate the Submission_Time_Limit using the formula: 15 seconds for the first GIF plus 10 seconds for each additional GIF (15 + 10 * (Round_Count - 1)), resulting in a default of 35 seconds for 3 rounds
4. WHILE the game is in the Lobby state, THE Activity SHALL display the calculated Submission_Time_Limit to all Players based on the current Round_Count
5. WHILE the game is in the Lobby state, THE Activity SHALL allow the Host to set a guessing time limit between 10 seconds and 60 seconds (inclusive), with a default of 30 seconds
6. WHILE the game is in the Lobby state, THE Activity SHALL display the current configuration values to all Players in the Lobby
7. WHEN the Host changes a configuration value, THE Activity SHALL update the displayed configuration for all Players within 500ms
8. IF a Player who is not the Host attempts to modify a configuration value, THEN THE Activity SHALL reject the change and maintain the current configuration
9. IF the Host sets a configuration value outside the allowed range, THEN THE Activity SHALL reject the input and display an error message indicating the valid range for that setting

### Requirement 3: GIF Search and Discovery

**User Story:** As a player, I want to search for GIFs by keyword, so that I can find and submit my favorite GIFs.

#### Acceptance Criteria

1. WHILE the game is in the Submission_Phase, THE Activity SHALL provide a search input that queries the KLIPY API when the Player has entered at least 2 characters
2. WHEN a Player enters a search query, THE Activity SHALL display a grid of up to 25 matching GIF results with preview thumbnails
3. IF KLIPY fails to respond within 3 seconds or returns an HTTP error status, THEN THE Activity SHALL display an error message indicating the search is temporarily unavailable and allow the Player to retry
4. THE Activity SHALL retrieve and store the GIF_Title metadata from KLIPY for each selected GIF; IF the GIF_Title is empty or absent, THEN THE Activity SHALL store the value "Untitled GIF" as the GIF_Title

### Requirement 4: GIF Submission Phase

**User Story:** As a player, I want to select my favorite GIFs during the submission phase, so that they enter the mystery pool for others to guess.

#### Acceptance Criteria

1. WHEN the Host starts the game, THE Activity SHALL transition all Players to the Submission_Phase
2. THE Activity SHALL require each Player to submit exactly Round_Count GIFs during the Submission_Phase
3. THE Activity SHALL display a progress indicator showing the number of GIFs a Player has submitted out of the required Round_Count (e.g., "2 / 3 GIFs selected")
4. WHEN a Player selects a GIF and the Player's submission count is less than Round_Count, THE Activity SHALL add the GIF to the Player's submission list with a bouncy confirmation animation
5. IF a Player attempts to select a GIF when their submission count already equals Round_Count, THEN THE Activity SHALL reject the selection and display a message indicating the maximum has been reached
6. WHILE a Player's submission count is less than Round_Count, THE Activity SHALL allow the Player to remove a previously selected GIF from their submission list
7. WHEN a Player's submission count reaches Round_Count, THE Activity SHALL automatically finalize the Player's submissions and transition the Player to a waiting state
8. WHEN all Players have finalized their submissions before the Submission_Time_Limit expires, THE Activity SHALL skip the remaining timer and immediately combine all submissions into the Mystery_Pool
9. IF the Submission_Time_Limit expires and a Player has submitted fewer than Round_Count GIFs, THEN THE Activity SHALL fill the Player's remaining slots with random GIFs from KLIPY on behalf of that Player
10. THE Activity SHALL display a waiting state showing each Player's submission status as either complete or in-progress, without revealing which GIFs were chosen

### Requirement 5: Mystery Pool Construction

**User Story:** As a player, I want submitted GIFs to be pooled anonymously, so that the guessing phase is fair and unpredictable.

#### Acceptance Criteria

1. WHEN the Submission_Phase ends, THE Activity SHALL shuffle all submitted GIFs into a randomized Mystery_Pool such that no two consecutive entries are from the same submitter when the pool contains GIFs from 3 or more Players
2. THE Activity SHALL associate each GIF in the Mystery_Pool with its submitter's Player ID and SHALL NOT transmit submitter identity to other Players' clients until the corresponding guess turn is resolved
3. THE Activity SHALL store the GIF_Title for each entry in the Mystery_Pool for scoring purposes
4. THE Activity SHALL verify the total Mystery_Pool size equals Player_Count multiplied by Round_Count before transitioning to the Guessing_Phase
5. IF the Mystery_Pool size does not equal Player_Count multiplied by Round_Count, THEN THE Activity SHALL prevent transition to the Guessing_Phase and display an error message indicating the pool is incomplete

### Requirement 6: Guessing Phase Cycling

**User Story:** As a player, I want to take turns guessing GIFs that I did not submit, so that the game is fair and engaging.

#### Acceptance Criteria

1. WHEN the Guessing_Phase begins, THE Activity SHALL cycle through each Player in a randomized turn order, completing one full cycle (each Player takes one turn) per round for a total of Round_Count rounds
2. WHEN it is a Player's turn, THE Activity SHALL present a GIF from the Mystery_Pool that the Player did not submit
3. WHEN a GIF is presented to the guessing Player, THE Activity SHALL display the GIF with a reveal animation (bouncy entrance effect) lasting no longer than 500ms
4. WHILE it is not a Player's turn, THE Activity SHALL display the current GIF, the active Player's remaining guess time, and whether the active Player has completed the submitter guess and the title guess to all other Players as spectators
5. WHEN the guessing time limit expires for the title guess, THE Activity SHALL auto-submit whatever text the Player has typed so far as their title guess answer
6. WHEN the guessing time limit expires for the submitter guess, THE Activity SHALL auto-submit a randomly selected Player from the lobby (excluding the guesser) as the submitter guess answer
7. THE Activity SHALL present exactly one GIF per Player per round, exhausting all GIFs in the Mystery_Pool across all Round_Count rounds before ending the Guessing_Phase
8. IF no GIF remains in the Mystery_Pool that the current Player did not submit, THEN THE Activity SHALL skip that Player's turn and advance to the next Player in the turn order

### Requirement 7: Submitter Guess

**User Story:** As a player, I want to guess who submitted each GIF, so that I can earn points for knowing my friends' taste.

#### Acceptance Criteria

1. IF the game has more than 2 Players, WHEN a Player is presented a GIF during the Guessing_Phase, THE Activity SHALL prompt the Player to guess which other Player submitted the GIF
2. WHILE the submitter guess prompt is displayed, THE Activity SHALL display a list of all other Players (excluding the guesser) as selectable options
3. WHEN the Player selects the correct submitter, THE Scorer SHALL award the Player 1 point for the correct submitter guess
4. IF the game has exactly 2 Players, THEN THE Activity SHALL skip the submitter guess and proceed directly to the title guess
5. WHEN the Player selects an incorrect submitter, THE Scorer SHALL award zero points and THE Activity SHALL reveal the correct submitter to all Players
6. WHEN a submitter guess is resolved (correct or incorrect), THE Activity SHALL display the result (correct or incorrect with the actual submitter identity) to all Players before proceeding to the title guess

### Requirement 8: Title Guess and Scoring

**User Story:** As a player, I want to guess the GIF's title and be scored on accuracy, so that the game rewards both exact knowledge and close guesses.

#### Acceptance Criteria

1. THE Activity SHALL prompt the guessing Player to type a free-text guess of the GIF_Title, accepting between 1 and 200 characters
2. WHEN the Player submits a title guess, THE Scorer SHALL perform a case-insensitive comparison of the guess keywords against the stored GIF_Title keywords, ignoring common stop words (articles, prepositions, conjunctions)
3. WHEN the guess contains one or more exact keywords from the GIF_Title, THE Scorer SHALL award 100 points per matched keyword
4. IF no exact keyword match is found AND the text embedding similarity score between the guess and the GIF_Title meets or exceeds a threshold of 0.6 (on a 0.0 to 1.0 scale), THEN THE Scorer SHALL award 50 points for the semantic match
5. IF no exact keyword match is found AND the text embedding similarity score is below 0.6, THEN THE Scorer SHALL award 0 points and display the correct GIF_Title to the guessing Player
6. WHEN a guess has been scored, THE Activity SHALL display the scoring breakdown (matched keywords, exact match points, and semantic match points) to all Players within 2 seconds, accompanied by an animated point reveal

### Requirement 9: Score Tracking and Winner Declaration

**User Story:** As a player, I want to see a running scoreboard and a final winner, so that the game feels competitive and conclusive.

#### Acceptance Criteria

1. THE Activity SHALL maintain a cumulative score for each Player across all rounds, starting at 0 at the beginning of the game
2. THE Activity SHALL display a live scoreboard visible to all Players, updated within 200ms after each turn completes, showing each Player's username, current score, and rank position in descending score order
3. WHEN all rounds are exhausted (Mystery_Pool is empty), THE Activity SHALL transition to an end-game state
4. WHEN the Activity transitions to the end-game state, THE Activity SHALL declare the Player with the highest cumulative score as the winner
5. IF two or more Players are tied for the highest score, THEN THE Activity SHALL declare all tied Players as co-winners
6. WHEN the Activity transitions to the end-game state, THE Activity SHALL display a final results screen showing all Players ranked by score in descending order with animated score reveals
7. WHEN the results screen is displayed, THE Host SHALL have the option to start a new game (returning all current Players to the Lobby with the previous configuration preserved) or return to the Lobby (resetting configuration to defaults)

### Requirement 10: UI/UX Design Language

**User Story:** As a player, I want a minimalistic yet energetic interface, so that the game feels polished and fun without visual clutter.

#### Acceptance Criteria

1. THE Activity SHALL use a visual design limited to a maximum of 5 primary colors, using bold geometric shapes and flat or minimally-shaded elements to reduce visual clutter
2. THE Activity SHALL apply spring-based animations (duration between 200ms and 500ms) to interactive elements (button presses, card selections, reveals)
3. THE Activity SHALL apply transition animations between game phases under 300ms for navigation and under 600ms for physics-based emphasis animations
4. THE Activity SHALL provide visual feedback for all player interactions within 100ms of the interaction event
5. THE Activity SHALL use a minimum body text size of 16px and maintain a minimum contrast ratio of 4.5:1 between text and background elements for readability within the Discord iframe
6. THE Activity SHALL render without content clipping, overlapping interactive elements, or loss of functionality within the Discord Activity iframe at viewport widths from 320px to 1920px across desktop and mobile Discord clients
7. IF the user's system has prefers-reduced-motion enabled, THEN THE Activity SHALL disable spring and transition animations and apply instant state changes instead

### Requirement 11: Discord Integration

**User Story:** As a player, I want the game to leverage Discord's platform features natively, so that it feels like a seamless part of the Discord experience without redundant custom infrastructure.

#### Acceptance Criteria

1. THE Activity SHALL authenticate players via the Discord Embedded App SDK OAuth2 flow, requesting the `identify` scope to obtain user identity
2. THE Activity SHALL retrieve each Player's Discord username and avatar from the SDK for display in-game
3. WHEN the Discord Embedded App SDK signals the ready event, THE Activity SHALL render the game interface and signal readiness back to the SDK within 5 seconds of iframe load
4. IF the Activity iframe is closed by all Players, THEN THE Activity SHALL terminate the game session and release server-side resources (WebSocket connections, in-memory game state) within 30 seconds
5. THE Activity SHALL launch and allow full gameplay (lobby creation, GIF submission, guessing, scoring) in Discord voice channels, text channels, and DMs without feature degradation
6. IF OAuth2 authentication fails or the Player denies the authorization request, THEN THE Activity SHALL display an error message indicating the authorization requirement and prevent access to game features
7. THE Activity SHALL rely on Discord's built-in voice channel infrastructure for voice communication and SHALL NOT implement custom voice or audio features
8. THE Activity SHALL use Discord's presence system to detect which Players are in the same voice channel for Activity discovery

### Requirement 12: Real-Time Multiplayer Synchronization

**User Story:** As a player, I want all game state changes to be synchronized in real time, so that all players see the same thing simultaneously.

#### Acceptance Criteria

1. THE Activity SHALL maintain a single authoritative game state on the server and deliver state updates to all connected Players via WebSocket connections
2. WHEN a game state change occurs (phase transition, guess submission, score update), THE Activity SHALL broadcast the update to all Players within 200ms
3. IF a Player disconnects during the Guessing_Phase, THEN THE Activity SHALL skip that Player's remaining turns and continue the game for remaining Players
4. IF a Player disconnects during the Submission_Phase, THEN THE Activity SHALL wait until the Submission_Time_Limit expires and auto-fill that Player's remaining GIF slots with random GIFs from KLIPY
5. IF a Player reconnects within 30 seconds of disconnecting, THEN THE Activity SHALL send the full current game state to the reconnecting Player and restore their active participation (including pending turns if in Guessing_Phase)
6. IF a Player does not reconnect within 30 seconds of disconnecting, THEN THE Activity SHALL treat the Player as permanently removed for the remainder of the current game
7. IF the Host disconnects and does not reconnect within 30 seconds, THEN THE Activity SHALL promote the next connected Player (by join order) to Host and notify all Players of the Host change
8. WHEN a Player disconnects or reconnects, THE Activity SHALL notify all other connected Players of the Player's connection status change within 200ms

### Requirement 13: Centralized Constants and Configuration

**User Story:** As a developer, I want all magic numbers and configurable values in a centralized constants file, so that tuning game parameters is straightforward and consistent.

#### Acceptance Criteria

1. THE Activity SHALL store all configurable values (timing thresholds, point values, player limits, animation durations, retry counts, and API timeouts) in a single centralized Constants_File
2. THE Constants_File SHALL use descriptive naming for each constant that clearly communicates its purpose (e.g., SUBMISSION_FIRST_GIF_TIME_SECONDS, EXACT_KEYWORD_MATCH_POINTS, MAX_PLAYERS_PER_LOBBY)
3. THE Constants_File SHALL include inline documentation for each constant describing its purpose, valid range, and default value
4. WHEN a game parameter needs to be adjusted, THE Activity SHALL require modification only in the Constants_File without changes to business logic files
5. THE Constants_File SHALL group constants by domain (timing, scoring, limits, API configuration, animation) with clear section separation
