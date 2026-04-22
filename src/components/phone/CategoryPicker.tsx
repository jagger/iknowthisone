import { useState } from 'react'
import { ref, set, serverTimestamp } from 'firebase/database'
import { db } from '../../firebase'
import type { CategoryChoice } from '../../types/game'

interface Props {
  roomCode: string
  categoryChoice: CategoryChoice
}

export default function CategoryPicker({ roomCode, categoryChoice }: Props) {
  const [chosen, setChosen] = useState<string | null>(categoryChoice.chosen)
  const [submitting, setSubmitting] = useState(false)

  const handlePick = async (option: string) => {
    if (chosen || submitting) return
    setChosen(option)
    setSubmitting(true)
    try {
      await set(ref(db, `rooms/${roomCode}/categoryChoice/chosen`), option)
      await set(ref(db, `rooms/${roomCode}/categoryChoice/chosenAt`), serverTimestamp())
    } catch {
      setChosen(null)
      setSubmitting(false)
    }
  }

  return (
    <div style={screenStyle}>
      <div style={statusStyle}>You scored! Pick the next category</div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            width: '100%',
          }}
        >
          {categoryChoice.options.map((option) => {
            const isPicked = chosen === option
            const isOther = chosen && chosen !== option
            return (
              <button
                key={option}
                onClick={() => handlePick(option)}
                disabled={!!chosen}
                style={{
                  padding: '20px 12px',
                  border: 'var(--border)',
                  boxShadow: isPicked ? 'var(--shadow)' : '3px 3px 0 var(--ink)',
                  background: isPicked ? 'var(--gold)' : 'var(--bg)',
                  borderRadius: 8,
                  fontFamily: 'var(--font-body)',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: chosen ? 'default' : 'pointer',
                  opacity: isOther ? 0.4 : 1,
                  transition: 'all 0.15s',
                  textAlign: 'center',
                }}
              >
                {option}
                {isPicked && ' ✓'}
              </button>
            )
          })}
        </div>
      </div>

      {chosen && (
        <div style={{ padding: '0 20px 40px', textAlign: 'center', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#555' }}>
          {chosen} — starting soon…
        </div>
      )}
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
