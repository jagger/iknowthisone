import { useCountdown } from '../../hooks/useCountdown'

interface Props {
  wordDrawnAt: number | null
  totalSeconds?: number
}

export default function TimerBadge({ wordDrawnAt, totalSeconds = 120 }: Props) {
  const seconds = useCountdown(wordDrawnAt, totalSeconds)
  const urgent = seconds <= 30
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '4px 14px',
        border: 'var(--border)',
        borderRadius: '100px',
        background: urgent ? 'var(--danger)' : 'var(--bg)',
        color: urgent ? '#fff' : 'var(--ink)',
        fontFamily: 'var(--font-display)',
        fontWeight: 900,
        fontSize: 'clamp(20px, 8vw, 32px)',
        boxShadow: 'var(--shadow)',
        animation: urgent ? 'timerPulse 0.4s ease-in-out infinite alternate' : 'none',
        minWidth: '4ch',
        letterSpacing: '0.02em',
      }}
    >
      {mins}:{String(secs).padStart(2, '0')}
    </div>
  )
}
