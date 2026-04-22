import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function MutedFlash({ meta, players }: Props) {
  const singer = meta.activeSinger ? players[meta.activeSinger] : null

  return (
    <div
      style={{
        height: '100%',
        background: 'var(--danger)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        animation: 'flashIn 2s ease-in-out forwards',
      }}
    >
      <div style={{ fontSize: 'clamp(48px, 10vw, 100px)' }}>🔇</div>
      {singer && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(28px, 6vw, 64px)',
            color: 'var(--white)',
            letterSpacing: '0.04em',
          }}
        >
          {singer.name} muted
        </div>
      )}
      <div
        style={{
          background: '#fff',
          border: 'var(--border)',
          boxShadow: 'var(--shadow)',
          padding: '6px 20px',
          fontFamily: 'var(--font-body)',
          fontWeight: 800,
          fontSize: 'clamp(14px, 2.5vw, 24px)',
          letterSpacing: '2px',
          textTransform: 'uppercase',
        }}
      >
        Worth {meta.wordPointValue} points now!
      </div>
    </div>
  )
}
