import { useHintReveal } from '../../hooks/useHintReveal'
import type { RoomMeta } from '../../types/game'

interface Props {
  hint: RoomMeta['hint']
}

export default function HintCard({ hint }: Props) {
  const { showYear, showTitle, titleText } = useHintReveal(hint)
  if (!hint) return null

  return (
    <div
      style={{
        background: 'var(--ink)',
        color: '#fff',
        border: 'var(--border)',
        boxShadow: 'var(--shadow)',
        padding: '8px 18px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        maxWidth: '90%',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 9,
          letterSpacing: '3px',
          textTransform: 'uppercase',
          color: 'var(--gold)',
          marginBottom: 2,
        }}
      >
        Hint
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15, textAlign: 'center' }}>
        {hint.artist}
      </div>
      {showYear && (
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12, color: '#aaa' }}>
          {hint.year}
        </div>
      )}
      {showTitle && (
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 18,
            textAlign: 'center',
            color: 'var(--gold)',
            marginTop: 2,
          }}
        >
          {titleText}
        </div>
      )}
    </div>
  )
}
