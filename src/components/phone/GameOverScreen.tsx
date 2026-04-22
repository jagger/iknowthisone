import { useState } from 'react'
import { ref, set } from 'firebase/database'
import { db } from '../../firebase'
import Scoreboard from '../tv/Scoreboard'
import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
  roomCode: string
  uid: string
}

export default function GameOverScreen({ meta, players, roomCode, uid }: Props) {
  const [voted, setVoted] = useState(false)
  const winner = Object.entries(players).sort(([, a], [, b]) => b.score - a.score)[0]

  const handleRematch = async () => {
    if (voted) return
    setVoted(true)
    await set(ref(db, `rooms/${roomCode}/rematchVotes/${uid}`), true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', alignItems: 'center', gap: 20, padding: '24px 20px 40px', overflowY: 'auto' }}>
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(28px, 10vw, 48px)', letterSpacing: '0.06em', textAlign: 'center' }}>
        {winner?.[1]?.name ?? '?'} wins! 🏆
      </div>

      <Scoreboard players={players} pointsToWin={meta.pointsToWin} />

      <button
        onClick={handleRematch}
        disabled={voted}
        style={{
          width: '100%',
          height: 80,
          background: voted ? '#ddd' : 'var(--gold)',
          color: voted ? '#999' : 'var(--ink)',
          border: 'var(--border)',
          boxShadow: voted ? 'none' : 'var(--shadow)',
          borderRadius: 10,
          fontFamily: 'var(--font-body)',
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          cursor: voted ? 'default' : 'pointer',
          marginTop: 'auto',
        }}
      >
        {voted ? 'Rematch vote sent ✓' : 'Rematch'}
      </button>
    </div>
  )
}
