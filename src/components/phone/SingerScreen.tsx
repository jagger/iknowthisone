import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function SingerScreen({ meta, players }: Props) {
  if (!meta.activeSinger) return null
  const eligible = Object.entries(players).filter(
    ([uid, p]) => uid !== meta.activeSinger && p.connected !== false,
  )
  const votedCount = eligible.filter(([, p]) => p.hasVoted).length

  return (
    <div style={screenStyle}>
      <div style={statusStyle}>You're up! Sing it!</div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '0 20px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'min(18vw, 96px)',
            letterSpacing: '0.06em',
            color: 'var(--ink)',
            textAlign: 'center',
            lineHeight: 1,
          }}
        >
          {meta.currentWord.toUpperCase()}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: '#666', letterSpacing: '2px', textTransform: 'uppercase' }}>
          Sing a song that contains this word
        </div>
      </div>

      <div style={{ padding: '16px 20px 40px', textAlign: 'center' }}>
        <div
          style={{
            border: 'var(--border)',
            borderRadius: 10,
            padding: '16px',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 15,
          }}
        >
          {votedCount} of {eligible.length} player{eligible.length !== 1 ? 's' : ''} voted
        </div>
      </div>
    </div>
  )
}

const screenStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', height: '100%' }

const statusStyle: React.CSSProperties = {
  padding: '12px 20px 0',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#666',
  textAlign: 'center',
}
