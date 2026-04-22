import { useEffect, useRef } from 'react'
import TimerPill from './TimerPill'
import PlayerGrid from './PlayerGrid'
import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function WordReveal({ meta, players }: Props) {
  const wordRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = wordRef.current
    if (!el) return
    el.classList.remove('word-slam')
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add('word-slam')
      })
    })
  }, [meta.currentWord])

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
          padding: '0 5%',
        }}
      >
        {/* Category chip */}
        {meta.currentCategory && (
          <div
            style={{
              background: 'var(--gold)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow)',
              padding: '4px 16px',
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}
          >
            {meta.currentCategory}
          </div>
        )}

        {/* Word */}
        <div
          ref={wordRef}
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(70px, 15vw, 165px)',
            letterSpacing: '0.06em',
            lineHeight: 1,
            color: 'var(--ink)',
            textAlign: 'center',
          }}
        >
          {meta.currentWord.toUpperCase()}
        </div>

        {/* Timer */}
        {meta.state === 'BUZZER_OPEN' && (
          <TimerPill wordDrawnAt={meta.wordDrawnAt} totalSeconds={120} />
        )}

        {/* Point value badge if > 1 */}
        {meta.wordPointValue > 1 && (
          <div
            style={{
              background: 'var(--danger)',
              color: 'var(--white)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow)',
              padding: '4px 16px',
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: '2px',
              textTransform: 'uppercase',
            }}
          >
            Worth {meta.wordPointValue} points!
          </div>
        )}
      </div>

      <PlayerGrid players={players} />
    </div>
  )
}
