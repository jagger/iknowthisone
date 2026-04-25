import PlayerBg from '../shared/PlayerBg'
import PlayerGrid from './PlayerGrid'
import type { RoomMeta, Player } from '../../types/game'
import { PLAYER_IDENTITIES } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function Singing({ meta, players }: Props) {
  if (!meta.activeSinger) return null
  const singer = meta.activeSinger ? players[meta.activeSinger] : null
  const singerIdentity = singer?.identityIndex ?? 0
  const identity = PLAYER_IDENTITIES[singerIdentity]

  const eligibleVoters = Object.entries(players).filter(
    ([uid, p]) => uid !== meta.activeSinger && p.connected !== false,
  )
  const votedCount = eligibleVoters.filter(([, p]) => p.hasVoted).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '3% 5%', gap: 16, background: identity.color }}>
        {/* Word */}
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(42px, 8vw, 96px)',
            letterSpacing: '0.06em',
            color: '#fff',
            textShadow: '3px 3px 0 rgba(0,0,0,0.25)',
            textAlign: 'center',
          }}
        >
          {meta.currentWord.toUpperCase()}
        </div>

        {/* Singer banner */}
        <div
          style={{
            background: identity.shade,
            border: '3px solid rgba(0,0,0,0.3)',
            boxShadow: '4px 4px 0 rgba(0,0,0,0.3)',
            borderRadius: 8,
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '1.8em' }}>🎤</span>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(32px, 6vw, 72px)',
              color: '#fff',
              textShadow: '2px 2px 0 rgba(0,0,0,0.3)',
              letterSpacing: '0.04em',
            }}
          >
            {singer?.name ?? '…'} is singing!
          </span>
        </div>

        {/* Vote progress */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'center',
            marginTop: 'auto',
            maxWidth: '90%',
          }}
        >
          {eligibleVoters.map(([uid, player]) => (
            <div key={uid} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <PlayerBg
                identityIndex={player.identityIndex}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 6,
                  border: 'var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {player.hasVoted && (
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#00BB44', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#fff', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓</span>
                  </div>
                )}
              </PlayerBg>
              <span style={{ fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 800 }}>
                {player.name.split(' ')[0]}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 11,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#666',
          }}
        >
          {votedCount} of {eligibleVoters.length} voted
        </div>
      </div>

      <PlayerGrid players={players} activeSinger={meta.activeSinger} showVotes />
    </div>
  )
}
