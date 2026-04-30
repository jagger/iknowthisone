import { useEffect, useRef, useState } from 'react'
import TimerPill from './TimerPill'
import PlayerGrid from './PlayerGrid'
import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
  skipVotes?: Record<string, boolean>
}

export default function WordReveal({ meta, players, skipVotes = {} }: Props) {
  const connectedCount = Object.values(players).filter(p => p.connected !== false).length
  const skipCount = Object.keys(skipVotes).length
  const wordRef = useRef<HTMLDivElement>(null)
  const [hintElapsed, setHintElapsed] = useState(0)

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

  // Tick elapsed time when a hint is active
  useEffect(() => {
    if (!meta.hint?.startedAt) {
      setHintElapsed(0)
      return
    }
    setHintElapsed(Date.now() - meta.hint.startedAt)
    const id = setInterval(() => {
      setHintElapsed(Date.now() - meta.hint!.startedAt)
    }, 500)
    return () => clearInterval(id)
  }, [meta.hint?.startedAt])

  const hint = meta.hint ?? null
  const showYear = hint && hintElapsed >= 5000
  const showTitle = hint && hintElapsed >= 15000
  const titleText = hint && hintElapsed >= 25000 ? hint.fullTitle : hint?.partialTitle

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
            wordBreak: 'break-word',
            overflowWrap: 'break-word',
          }}
        >
          {meta.currentWord.toUpperCase()}
        </div>

        {/* Timer */}
        {meta.state === 'BUZZER_OPEN' && (
          <TimerPill wordDrawnAt={meta.wordDrawnAt} totalSeconds={Math.round((meta.timerDurationMs ?? 120000) / 1000)} />
        )}

        {/* Skip vote progress (only while no hint yet) */}
        {meta.state === 'BUZZER_OPEN' && skipCount > 0 && !hint && (
          <div
            style={{
              background: 'rgba(0,0,0,0.08)',
              border: '2px solid #ccc',
              padding: '3px 12px',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: '#777',
            }}
          >
            ⏩ Skip {skipCount}/{connectedCount}
          </div>
        )}

        {/* Progressive hint card */}
        {hint && (
          <div
            style={{
              background: 'var(--ink)',
              color: '#fff',
              border: 'var(--border)',
              boxShadow: 'var(--shadow)',
              padding: '10px 24px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              minWidth: 260,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 10,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                color: 'var(--gold)',
                marginBottom: 4,
              }}
            >
              Hint
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 18, textAlign: 'center' }}>
              {hint.artist}
            </div>
            {showYear && (
              <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: '#aaa' }}>
                {hint.year}
              </div>
            )}
            {showTitle && (
              <div
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 900,
                  fontSize: 22,
                  textAlign: 'center',
                  color: 'var(--gold)',
                  marginTop: 4,
                }}
              >
                {titleText}
              </div>
            )}
          </div>
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
