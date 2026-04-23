import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function MutedFlash({ meta, players }: Props) {
  const singer = meta.activeSinger ? players[meta.activeSinger] : null

  if (meta.allMutedPenalty) {
    return (
      <div style={{ height: '100%', background: '#141414', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(48px, 9vw, 100px)', color: '#fff', letterSpacing: '0.06em', textAlign: 'center', lineHeight: 1 }}>
          EVERYONE<br />FAILED
        </div>
        <div style={{ background: 'var(--danger)', border: 'var(--border)', boxShadow: 'var(--shadow)', padding: '10px 28px', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'clamp(18px, 3.5vw, 32px)', letterSpacing: '2px', textTransform: 'uppercase', color: '#fff' }}>
          All players lose {meta.allMutedPenalty} point{meta.allMutedPenalty !== 1 ? 's' : ''}!
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'clamp(12px, 2vw, 18px)', letterSpacing: '3px', textTransform: 'uppercase', color: '#555', marginTop: 8 }}>
          A new word is coming…
        </div>
      </div>
    )
  }

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
      <div style={{ fontSize: 'clamp(48px, 10vw, 100px)' }}>❌</div>
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
          {singer.name} failed
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
