import PlayerBg from '../shared/PlayerBg'
import type { Player } from '../../types/game'

interface Props {
  players: Record<string, Player>
  pointsToWin?: number
}

export default function Scoreboard({ players, pointsToWin }: Props) {
  const sorted = Object.entries(players)
    .sort(([, a], [, b]) => b.score - a.score)

  return (
    <div
      style={{
        border: 'var(--border)',
        boxShadow: 'var(--shadow-lg)',
        background: 'var(--bg)',
        borderRadius: 8,
        overflow: 'hidden',
        minWidth: 240,
      }}
    >
      <div
        style={{
          background: 'var(--ink)',
          color: 'var(--gold)',
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 18,
          letterSpacing: '4px',
          textTransform: 'uppercase',
          padding: '8px 16px',
          textAlign: 'center',
        }}
      >
        Scores{pointsToWin ? ` — First to ${pointsToWin}` : ''}
      </div>
      {sorted.map(([uid, player], i) => (
        <PlayerBg
          key={uid}
          identityIndex={player.identityIndex}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            borderBottom: i < sorted.length - 1 ? 'var(--border)' : 'none',
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: 16,
              color: '#fff',
              textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              minWidth: 0,
            }}
          >
            {player.name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 24,
              color: '#fff',
              textShadow: '2px 2px 0 rgba(0,0,0,0.3)',
            }}
          >
            {player.score}
          </span>
        </PlayerBg>
      ))}
    </div>
  )
}
