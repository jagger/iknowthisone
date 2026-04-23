import type { RoomMeta } from '../../types/game'

interface Props {
  meta: RoomMeta
}

export default function MutedScreen({ meta }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', justifyContent: 'center', gap: 16, padding: '20px' }}>
      <div style={{ fontSize: 64 }}>❌</div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 32,
          letterSpacing: '0.06em',
          textAlign: 'center',
          color: 'var(--danger)',
        }}
      >
        You failed!
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: '15vw',
          letterSpacing: '0.06em',
          color: 'var(--ink)',
          textAlign: 'center',
        }}
      >
        {meta.currentWord.toUpperCase()}
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: '#666', letterSpacing: '2px', textTransform: 'uppercase', textAlign: 'center' }}>
        Wait for the next singer
      </div>
    </div>
  )
}
