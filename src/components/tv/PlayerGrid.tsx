import PlayerBg from '../shared/PlayerBg'
import type { Player } from '../../types/game'

interface Props {
  players: Record<string, Player>
  activeSinger?: string | null
  showVotes?: boolean
}

const TWO_MIN = 2 * 60 * 1000

export default function PlayerGrid({ players, activeSinger, showVotes }: Props) {
  const now = Date.now()
  const entries = Object.entries(players).filter(([, p]) =>
    p.connected !== false || !p.disconnectedAt || (now - p.disconnectedAt < TWO_MIN),
  )

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
      {entries.map(([uid, player]) => {
        const inactive = player.connected === false
        return (
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
              opacity: inactive ? 0.35 : 1,
              transition: 'opacity 0.4s',
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
        )
      })}
    </div>
  )
}
