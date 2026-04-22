import type { RoomMeta, Player, CategoryChoice } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
  categoryChoice: CategoryChoice | null
}

export default function CategorySpectatorScreen({ meta, players, categoryChoice }: Props) {
  const picker = meta.activeSinger ? players[meta.activeSinger] : null

  return (
    <div style={screenStyle}>
      <div style={statusStyle}>
        {picker ? `${picker.name} is picking the next category…` : 'Picking next category…'}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        {categoryChoice ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, width: '100%' }}>
            {categoryChoice.options.map((option) => {
              const chosen = categoryChoice.chosen === option
              return (
                <div
                  key={option}
                  style={{
                    padding: '20px 12px',
                    border: 'var(--border)',
                    borderRadius: 8,
                    background: chosen ? 'var(--gold)' : '#e8e4db',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 800,
                    fontSize: 16,
                    textAlign: 'center',
                    opacity: categoryChoice.chosen && !chosen ? 0.4 : 1,
                    transition: 'all 0.15s',
                    color: 'var(--ink)',
                  }}
                >
                  {option}{chosen ? ' ✓' : ''}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ color: '#999', fontFamily: 'var(--font-body)', fontSize: 14 }}>Waiting…</div>
        )}
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
