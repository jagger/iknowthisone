import PlayerBg from '../shared/PlayerBg'
import type { Player } from '../../types/game'

interface Props {
  players: Record<string, Player>
  activeSinger?: string | null
  showVotes?: boolean
}

export default function PlayerGrid({ players, activeSinger, showVotes }: Props) {
  const entries = Object.entries(players).filter(([, p]) => p.connected !== false)

  return (
    <div
      style={{
        background: '#141414',
        padding: '8px 12px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        alignItems: 'center',
        minHeight: 52,
      }}
    >
      {entries.map(([uid, player]) => (
        <PlayerBg
          key={uid}
          identityIndex={player.identityIndex}
          style={{
            borderRadius: 6,
            border: uid === activeSinger ? '2px solid var(--gold)' : '2px solid transparent',
            padding: '3px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: 12,
              color: '#fff',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              whiteSpace: 'nowrap',
            }}
          >
            {player.name}
          </span>
          {showVotes && player.hasVoted && (
            <span style={{ fontSize: 12 }}>✅</span>
          )}
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 13,
              color: '#fff',
              marginLeft: 4,
            }}
          >
            {player.score}
          </span>
        </PlayerBg>
      ))}
    </div>
  )
}
