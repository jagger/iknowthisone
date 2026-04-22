import { useState } from 'react'
import { ref, set } from 'firebase/database'
import { db } from '../../firebase'
import type { RoomMeta } from '../../types/game'

interface Props {
  meta: RoomMeta
  roomCode: string
  uid: string
  muted: boolean
}

export default function BuzzerScreen({ meta, roomCode, uid, muted }: Props) {
  const [buzzing, setBuzzing] = useState(false)

  const handleBuzz = async () => {
    if (buzzing || muted) return
    setBuzzing(true)
    try {
      await set(ref(db, `rooms/${roomCode}/buzzIn/${uid}`), true)
    } catch {
      setBuzzing(false)
    }
  }

  return (
    <div style={screenStyle}>
      <div style={statusStyle}>
        {muted ? 'You are muted this round' : 'First to buzz in wins!'}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
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
          {meta.currentWord}
        </div>
      </div>

      <div style={actionZoneStyle}>
        <button
          onClick={handleBuzz}
          disabled={muted || buzzing}
          onPointerDown={(e) => { if (!muted) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
          onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
          style={{
            width: '100%',
            height: 88,
            background: muted ? '#ccc' : 'var(--gold)',
            color: muted ? '#999' : 'var(--ink)',
            border: 'var(--border)',
            boxShadow: muted ? 'none' : 'var(--shadow)',
            borderRadius: 10,
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 22,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            cursor: muted ? 'not-allowed' : 'pointer',
            transition: 'transform 0.08s',
          }}
        >
          {muted ? '🔇 Muted this round' : '🎤 Buzz In'}
        </button>
      </div>
    </div>
  )
}

const screenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

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

const actionZoneStyle: React.CSSProperties = {
  padding: '16px 20px 40px',
}
