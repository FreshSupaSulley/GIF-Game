import { useMemo, useCallback } from 'react';
import { useGameState, useSend } from '../hooks';
import { Button, Card, Avatar } from '../components/ui';

export function ScoreboardView() {
  const { scores, players, isHost } = useGameState();
  const send = useSend();

  // Sort players by score (descending)
  const rankedPlayers = useMemo(() => {
    const playersWithScores = Object.values(players)
      .map(player => ({
        ...player,
        score: scores[player.id] ?? 0,
      }))
      .sort((a, b) => b.score - a.score);

    // Assign ranks (handle ties)
    let currentRank = 1;
    let previousScore = -1;
    
    return playersWithScores.map((player, index) => {
      if (player.score !== previousScore) {
        currentRank = index + 1;
      }
      previousScore = player.score;
      return { ...player, rank: currentRank };
    });
  }, [players, scores]);

  // Find winners (could be ties)
  const winners = rankedPlayers.filter(p => p.rank === 1);
  const winnerNames = winners.map(w => w.username).join(' & ');

  // Handle restart options
  const handlePlayAgain = useCallback(() => {
    send({ type: 'game:playAgain' });
  }, [send]);

  const handleNewGame = useCallback(() => {
    send({ type: 'game:newGame' });
  }, [send]);

  return (
    <div style={styles.container}>
      {/* Winner Banner */}
      <div style={styles.winnerBanner}>
        <span style={styles.trophy}>🏆</span>
        <h1 style={styles.winnerTitle}>
          {winners.length > 1 ? 'Co-Winners!' : 'Winner!'}
        </h1>
        <p style={styles.winnerName}>{winnerNames}</p>
        <p style={styles.winnerScore}>{winners[0]?.score ?? 0} points</p>
      </div>

      {/* Full Scoreboard */}
      <Card style={styles.scoreboardCard}>
        <h2 style={styles.sectionTitle}>Final Standings</h2>
        <div style={styles.scoreList}>
          {rankedPlayers.map((player, index) => (
            <div
              key={player.id}
              style={{
                ...styles.scoreRow,
                backgroundColor: player.rank === 1 
                  ? 'rgba(250, 166, 26, 0.1)' 
                  : index % 2 === 0 
                    ? 'transparent' 
                    : 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <div style={styles.rankBadge}>
                {player.rank === 1 ? '🥇' : player.rank === 2 ? '🥈' : player.rank === 3 ? '🥉' : `#${player.rank}`}
              </div>
              <Avatar src={player.avatar} alt={player.username} size={40} />
              <span style={styles.playerName}>{player.username}</span>
              <span style={styles.playerScore}>{player.score}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Host Controls */}
      {isHost && (
        <Card style={styles.hostControls}>
          <h3 style={styles.controlsTitle}>What's next?</h3>
          <div style={styles.buttonRow}>
            <Button variant="primary" onClick={handlePlayAgain}>
              Play Again (Same Settings)
            </Button>
            <Button variant="secondary" onClick={handleNewGame}>
              New Game
            </Button>
          </div>
        </Card>
      )}

      {/* Non-host waiting message */}
      {!isHost && (
        <p style={styles.waitingText}>Waiting for host to start next game...</p>
      )}
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
  winnerBanner: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  trophy: {
    fontSize: '64px',
    display: 'block',
    marginBottom: '8px',
  },
  winnerTitle: {
    fontSize: '2.5rem',
    fontWeight: 700,
    color: '#FAA61A',
    margin: 0,
    marginBottom: '8px',
  },
  winnerName: {
    fontSize: '1.5rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    marginBottom: '4px',
  },
  winnerScore: {
    fontSize: '1.125rem',
    color: '#a0a0d0',
    margin: 0,
  },
  scoreboardCard: {
    width: '100%',
    maxWidth: '500px',
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    marginBottom: '16px',
    textAlign: 'center',
  },
  scoreList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  scoreRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
  },
  rankBadge: {
    width: '40px',
    textAlign: 'center',
    fontSize: '20px',
  },
  playerName: {
    flex: 1,
    color: '#fff',
    fontWeight: 500,
  },
  playerScore: {
    color: '#5865F2',
    fontWeight: 700,
    fontSize: '1.25rem',
    fontVariantNumeric: 'tabular-nums',
  },
  hostControls: {
    width: '100%',
    maxWidth: '500px',
    textAlign: 'center',
  },
  controlsTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: '#fff',
    margin: 0,
    marginBottom: '16px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  waitingText: {
    color: '#a0a0d0',
    fontSize: '1rem',
    marginTop: '24px',
  },
};
