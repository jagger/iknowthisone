import { useState, useEffect } from 'react'
import Singing from './Singing'
import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function VoteClosing({ meta, players }: Props) {
  const [seconds, setSeconds] = useState(30)

  useEffect(() => {
    if (!meta.voteCloseTriggeredAt) return
    const tick = () => {
      const elapsed = (Date.now() - meta.voteCloseTriggeredAt!) / 1000
      setSeconds(Math.max(0, Math.round(30 - elapsed)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [meta.voteCloseTriggeredAt])

  return (
    <div style={{ position: 'relative', height: '100%' }}>
      <Singing meta={meta} players={players} />
      <div
        style={{
          position: 'absolute',
          top: 12,
          right: 16,
          background: 'var(--danger)',
          color: 'var(--white)',
          border: 'var(--border)',
          boxShadow: 'var(--shadow)',
          borderRadius: '100px',
          padding: '4px 18px',
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 'clamp(20px, 4vw, 42px)',
          animation: 'timerPulse 0.4s ease-in-out infinite alternate',
        }}
      >
        {seconds}s
      </div>
    </div>
  )
}
