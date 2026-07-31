import { useState, useCallback, useEffect } from 'react';
import { useGameState, useSend, useSubscription, useDiscordUser } from '../hooks';
import { Button, Card, Input, GifCard, Timer, PlayerBadge, LoadingSpinner } from '../components/ui';
import { proxyGifUrl } from '../utils';
import type { GifResult } from '@gif-game/shared';

export function SubmissionView() {
  const { config, players, hostId, state } = useGameState();
  const user = useDiscordUser();
  const send = useSend();

  const [searchQuery, setSearchQuery] = useState('');
  const [lastSearchQuery, setLastSearchQuery] = useState(''); // Track query that produced current results
  const [searchResults, setSearchResults] = useState<GifResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [timerMs, setTimerMs] = useState(0);

  const roundCount = config?.roundCount ?? 3;
  const submissionTimeLimit = (config?.submissionTimeLimit ?? 45) * 1000;

  // Get current player's submission
  const mySubmission = user ? state?.submissions[user.id] : null;
  const selectedGifs = mySubmission?.gifs ?? [];
  const isFinalized = mySubmission?.finalized ?? false;

  // Subscribe to search results
  useSubscription('search:results', useCallback((msg) => {
    setSearchResults(msg.gifs);
    setIsSearching(false);
  }, []));

  // Subscribe to timer ticks
  useSubscription('timer:tick', useCallback((msg) => {
    if (msg.phase === 'submission') {
      setTimerMs(msg.remainingMs);
    }
  }, []));

  // Handle search
  const handleSearch = useCallback(() => {
    if (searchQuery.trim().length < 2) return;
    setIsSearching(true);
    setLastSearchQuery(searchQuery.trim()); // Remember the query
    send({ type: 'gif:search', query: searchQuery.trim() });
  }, [send, searchQuery]);

  // Search on Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  // Handle GIF selection - include the query used to find it
  const handleSelectGif = useCallback((gif: GifResult) => {
    if (isFinalized || selectedGifs.length >= roundCount) return;

    // Check if already selected
    if (selectedGifs.some(g => g.id === gif.id)) return;

    send({
      type: 'gif:select',
      gifId: gif.id,
      gifUrl: gif.url,
      title: gif.title,
      query: lastSearchQuery, // Include the search query
    });
  }, [send, isFinalized, selectedGifs, roundCount, lastSearchQuery]);

  // Handle GIF deselection
  const handleDeselectGif = useCallback((gifId: string) => {
    if (isFinalized) return;
    send({ type: 'gif:deselect', gifId });
  }, [send, isFinalized]);

  // Check if all players have finalized
  const allFinalized = Object.values(state?.submissions ?? {}).every(s => s.finalized);

  // If finalized, show waiting state
  if (isFinalized) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Submissions Complete!</h1>
        <p style={styles.subtitle}>Waiting for other players...</p>

        <Card style={styles.waitingCard}>
          <Timer remainingMs={timerMs} totalMs={submissionTimeLimit} label="Time Remaining" />

          <div style={styles.playerStatus}>
            {Object.values(players).map((player) => {
              const submission = state?.submissions[player.id];
              const done = submission?.finalized ?? false;
              return (
                <div key={player.id} style={styles.playerStatusRow}>
                  <PlayerBadge
                    avatar={player.avatar}
                    username={player.username}
                    isHost={player.id === hostId}
                    size="small"
                  />
                  <span style={{ color: done ? '#43B581' : '#a0a0a0' }}>
                    {done ? '✓ Ready' : 'Selecting...'}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Select Your GIFs</h1>
      <p style={styles.subtitle}>
        Search and select {roundCount} GIF{roundCount > 1 ? 's' : ''} for others to guess
      </p>

      {/* Timer */}
      <Card style={styles.timerCard}>
        <Timer remainingMs={timerMs} totalMs={submissionTimeLimit} />
      </Card>

      {/* Selected GIFs */}
      <Card style={styles.selectedCard}>
        <h2 style={styles.sectionTitle}>
          Your Selection ({selectedGifs.length}/{roundCount})
        </h2>
        <div style={styles.selectedGrid}>
          {selectedGifs.map((gif) => (
            <GifCard
              key={gif.id}
              src={proxyGifUrl(gif.url)}
              title={gif.title}
              selected
              onClick={() => handleDeselectGif(gif.id)}
              size="medium"
            />
          ))}
          {Array.from({ length: roundCount - selectedGifs.length }).map((_, i) => (
            <div key={`empty-${i}`} style={styles.emptySlot}>
              <span style={styles.emptyText}>?</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Search */}
      <Card style={styles.searchCard}>
        <div style={styles.searchRow}>
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for GIFs..."
            fullWidth
          />
          <Button onClick={handleSearch} disabled={searchQuery.length < 2 || isSearching}>
            {isSearching ? <LoadingSpinner size={16} /> : 'Search'}
          </Button>
        </div>

        {/* Search Results */}
        <div style={styles.resultsGrid}>
          {searchResults.map((gif) => {
            const isSelected = selectedGifs.some(g => g.id === gif.id);
            const canSelect = !isSelected && selectedGifs.length < roundCount;
            return (
              <GifCard
                key={gif.id}
                src={proxyGifUrl(gif.thumbnailUrl || gif.url)}
                title={gif.title}
                selected={isSelected}
                onClick={canSelect ? () => handleSelectGif(gif) : undefined}
                size="small"
              />
            );
          })}
          {searchResults.length === 0 && !isSearching && (
            <p style={styles.noResults}>Search for GIFs to get started!</p>
          )}
        </div>
      </Card>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#fff',
    margin: 0,
    marginBottom: '8px',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#a0a0d0',
    margin: 0,
    marginBottom: '16px',
  },
  timerCard: {
    marginBottom: '16px',
    minWidth: '200px',
    textAlign: 'center',
  },
  selectedCard: {
    width: '100%',
    maxWidth: '600px',
    marginBottom: '16px',
  },
  sectionTitle: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    marginBottom: '12px',
  },
  selectedGrid: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  emptySlot: {
    width: 150,
    height: 150,
    borderRadius: '8px',
    border: '2px dashed rgba(255, 255, 255, 0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: '48px',
    color: 'rgba(255, 255, 255, 0.2)',
  },
  searchCard: {
    width: '100%',
    maxWidth: '600px',
  },
  searchRow: {
    display: 'flex',
    gap: '12px',
    marginBottom: '16px',
  },
  resultsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    justifyContent: 'center',
    maxHeight: '300px',
    overflowY: 'auto',
  },
  noResults: {
    color: '#a0a0a0',
    textAlign: 'center',
    padding: '24px',
  },
  waitingCard: {
    width: '100%',
    maxWidth: '400px',
    textAlign: 'center',
  },
  playerStatus: {
    marginTop: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  playerStatusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
};
