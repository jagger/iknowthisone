import PlayerBg from '../shared/PlayerBg'
import PlayerGrid from './PlayerGrid'
import type { RoomMeta, Player, CategoryChoice } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
  categoryChoice: CategoryChoice | null
}

export default function CategoryPickTV({ meta, players, categoryChoice }: Props) {
  const picker = meta.activeSinger ? players[meta.activeSinger] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 24,
          padding: '4% 6%',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 'clamp(14px, 2.5vw, 24px)',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            textAlign: 'center',
          }}
        >
          {picker ? (
            <>
              <PlayerBg
                identityIndex={picker.identityIndex}
                style={{
                  display: 'inline-block',
                  borderRadius: 6,
                  border: 'var(--border)',
                  padding: '2px 12px',
                  marginRight: 8,
                }}
              >
                <span style={{ color: '#fff', fontWeight: 900 }}>{picker.name}</span>
              </PlayerBg>
              is picking the next category…
            </>
          ) : (
            'Picking next category…'
          )}
        </div>

        {categoryChoice && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
              width: '100%',
              maxWidth: 520,
            }}
          >
            {categoryChoice.options.map((option) => {
              const chosen = categoryChoice.chosen === option
              return (
                <div
                  key={option}
                  style={{
                    padding: '16px 12px',
                    border: 'var(--border)',
                    boxShadow: chosen ? 'var(--shadow)' : '3px 3px 0 var(--ink)',
                    background: chosen ? 'var(--gold)' : 'var(--bg)',
                    fontFamily: 'var(--font-body)',
                    fontWeight: 800,
                    fontSize: 'clamp(14px, 2.5vw, 22px)',
                    textAlign: 'center',
                    letterSpacing: '1px',
                    opacity: categoryChoice.chosen && !chosen ? 0.4 : 1,
                    transition: 'all 0.2s',
                    borderRadius: 4,
                  }}
                >
                  {option}
                  {chosen && <span style={{ marginLeft: 8 }}>✓</span>}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <PlayerGrid players={players} />
    </div>
  )
}
