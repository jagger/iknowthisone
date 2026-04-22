import { useState, useEffect } from 'react'

interface Props {
  wordDrawnAt: number | null
  totalSeconds?: number
}

export default function TimerPill({ wordDrawnAt, totalSeconds = 120 }: Props) {
  const [seconds, setSeconds] = useState(totalSeconds)

  useEffect(() => {
    if (wordDrawnAt === null) {
      setSeconds(totalSeconds)
      return
    }

    const tick = () => {
      const elapsed = (Date.now() - wordDrawnAt) / 1000
      setSeconds(Math.max(0, Math.round(totalSeconds - elapsed)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [wordDrawnAt, totalSeconds])

  const urgent = seconds <= 30
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '6px 20px',
        border: 'var(--border)',
        borderRadius: '100px',
        background: urgent ? 'var(--danger)' : 'var(--bg)',
        color: urgent ? 'var(--white)' : 'var(--ink)',
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: 'clamp(28px, 5vw, 54px)',
        boxShadow: 'var(--shadow)',
        animation: urgent ? 'timerPulse 0.4s ease-in-out infinite alternate' : 'none',
        minWidth: '5ch',
        letterSpacing: '0.02em',
      }}
    >
      {mins}:{String(secs).padStart(2, '0')}
    </div>
  )
}
