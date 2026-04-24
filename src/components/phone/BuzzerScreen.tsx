import { useState } from 'react'
import { ref, set } from 'firebase/database'
import { db } from '../../firebase'
import type { RoomMeta } from '../../types/game'

interface Props {
  meta: RoomMeta
  roomCode: string
  uid: string
  muted: boolean
  skipVotes: Record<string, boolean>
  totalPlayers: number
}

export default function BuzzerScreen({ meta, roomCode, uid, muted, skipVotes, totalPlayers }: Props) {
  const [buzzing, setBuzzing] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const hasSkipped = skipped || !!skipVotes[uid]
  const skipCount = Object.keys(skipVotes).length

  const handleBuzz = async () => {
    if (buzzing || muted) return
    setBuzzing(true)
    try {
      await set(ref(db, `rooms/${roomCode}/buzzIn/${uid}`), true)
    } catch {
      setBuzzing(false)
    }
  }

  const handleSkip = async () => {
    if (hasSkipped) return
    setSkipped(true)
    try {
      await set(ref(db, `rooms/${roomCode}/skipVotes/${uid}`), true)
    } catch {
      setSkipped(false)
    }
  }

  return (
    <div style={screenStyle}>
      <div style={statusStyle}>
        {muted ? 'You failed — sit this one out' : 'First to buzz in wins!'}
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'min(15vw, 80px)',
            letterSpacing: '0.06em',
            color: 'var(--ink)',
            textAlign: 'center',
          }}
        >
          {meta.currentWord.toUpperCase()}
        </div>
      </div>

      <div style={actionZoneStyle}>
        <button
          onClick={handleBuzz}
          disabled={muted || buzzing}
          aria-label={muted ? 'Failed this round — cannot buzz in' : 'Buzz in — I know this one'}
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
            fontSize: 18,
            letterSpacing: '2px',
            textTransform: 'uppercase',
            cursor: muted ? 'not-allowed' : 'pointer',
            transition: 'transform 0.08s',
          }}
        >
          {muted ? '❌ Failed this round' : '🎤 I Know That One!'}
        </button>
        {!muted && (
          <button
            onClick={handleSkip}
            disabled={hasSkipped}
            aria-label={hasSkipped ? `Skip voted, ${skipCount} of ${totalPlayers} agree` : 'Vote to skip this word'}
            style={{
              position: 'absolute',
              bottom: 44,
              right: 20,
              padding: '8px 16px',
              minHeight: 44,
              background: hasSkipped ? '#ddd' : 'transparent',
              color: hasSkipped ? '#999' : '#888',
              border: '2px solid ' + (hasSkipped ? '#ccc' : '#ccc'),
              borderRadius: 6,
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: hasSkipped ? 'default' : 'pointer',
            }}
          >
            {hasSkipped ? `Skip ${skipCount}/${totalPlayers}` : 'Skip ⏩'}
          </button>
        )}
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
  position: 'relative',
}
