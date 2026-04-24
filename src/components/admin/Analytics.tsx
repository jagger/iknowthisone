import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../../firebase'

interface WordStats {
  category: string
  word: string
  attempts: number
  buzzes: number
  skips: number
  timeouts: number
  totalBuzzMs: number
  skipRate: number
  timeoutRate: number
  avgBuzzSec: number
}

type SortKey = 'skipRate' | 'timeoutRate' | 'attempts'

export default function Analytics() {
  const [stats, setStats] = useState<WordStats[]>([])
  const [loading, setLoading] = useState(true)
  const [sortBy, setSortBy] = useState<SortKey>('skipRate')

  useEffect(() => {
    return onValue(ref(db, 'analytics/words'), (snap) => {
      if (!snap.exists()) { setStats([]); setLoading(false); return }
      const val = snap.val() as Record<string, Record<string, {
        attempts?: number; buzzes?: number; skips?: number
        timeouts?: number; totalBuzzMs?: number
      }>>
      const list: WordStats[] = []
      for (const [cat, words] of Object.entries(val)) {
        for (const [word, s] of Object.entries(words)) {
          const attempts = s.attempts ?? 0
          const buzzes   = s.buzzes ?? 0
          const skips    = s.skips ?? 0
          const timeouts = s.timeouts ?? 0
          const totalBuzzMs = s.totalBuzzMs ?? 0
          list.push({
            category:    decodeURIComponent(cat),
            word:        decodeURIComponent(word),
            attempts,
            buzzes,
            skips,
            timeouts,
            totalBuzzMs,
            skipRate:    attempts > 0 ? skips / attempts : 0,
            timeoutRate: attempts > 0 ? timeouts / attempts : 0,
            avgBuzzSec:  buzzes > 0 ? totalBuzzMs / buzzes / 1000 : 0,
          })
        }
      }
      setStats(list)
      setLoading(false)
    })
  }, [])

  if (loading) return <div style={emptyStyle}>Loading analytics…</div>
  if (stats.length === 0) return <div style={emptyStyle}>No data yet — play a game first.</div>

  const sorted = [...stats].sort((a, b) => {
    if (sortBy === 'attempts') return b.attempts - a.attempts
    return b[sortBy] - a[sortBy]
  })

  const pct = (n: number) => `${(n * 100).toFixed(0)}%`
  const danger = (n: number) => n > 0.4 ? 'var(--danger)' : n > 0.2 ? '#FF6600' : undefined

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <span style={labelStyle}>Sort by</span>
        {(['skipRate', 'timeoutRate', 'attempts'] as SortKey[]).map((k) => (
          <button
            key={k}
            onClick={() => setSortBy(k)}
            style={sortBy === k ? activeSortStyle : sortStyle}
          >
            {k === 'skipRate' ? 'Skip Rate' : k === 'timeoutRate' ? 'Timeout Rate' : 'Most Played'}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-body)', fontSize: 12, color: '#999' }}>
          {stats.length} words tracked
        </span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              {['Category', 'Word', 'Plays', 'Buzzes', 'Skips', 'Skip%', 'Timeouts', 'Timeout%', 'Avg Buzz'].map((h) => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ category, word, attempts, buzzes, skips, timeouts, skipRate, timeoutRate, avgBuzzSec }) => (
              <tr key={`${category}/${word}`} style={trStyle}>
                <td style={tdStyle}>{category}</td>
                <td style={{ ...tdStyle, fontWeight: 800 }}>{word}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{attempts}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{buzzes}</td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{skips}</td>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: danger(skipRate) }}>
                  {attempts > 0 ? pct(skipRate) : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>{timeouts}</td>
                <td style={{ ...tdStyle, textAlign: 'center', fontWeight: 700, color: danger(timeoutRate) }}>
                  {attempts > 0 ? pct(timeoutRate) : '—'}
                </td>
                <td style={{ ...tdStyle, textAlign: 'center' }}>
                  {avgBuzzSec > 0 ? `${avgBuzzSec.toFixed(1)}s` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const emptyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', color: '#888', padding: '60px 0', textAlign: 'center',
}
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: '#666',
}
const sortStyle: React.CSSProperties = {
  padding: '6px 16px', background: 'transparent', border: 'var(--border)',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12,
  letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 4,
}
const activeSortStyle: React.CSSProperties = {
  ...sortStyle, background: 'var(--gold)',
}
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)', fontSize: 13,
}
const thStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 11, letterSpacing: '2px',
  textTransform: 'uppercase', padding: '8px 10px', borderBottom: '3px solid var(--ink)',
  textAlign: 'left', whiteSpace: 'nowrap',
}
const trStyle: React.CSSProperties = { borderBottom: '1px solid #e8e0d4' }
const tdStyle: React.CSSProperties = { padding: '8px 10px' }
