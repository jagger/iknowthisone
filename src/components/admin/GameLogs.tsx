import { useEffect, useState } from 'react'
import { ref, onValue } from 'firebase/database'
import { db } from '../../firebase'
import { useGameLogIndex } from '../../hooks/useGameLogIndex'

interface LogEvent {
  key: string
  ts: number
  type: string
  actorUid?: string
  state?: string
  data?: Record<string, unknown>
}

function formatTime(ts: number): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleTimeString()
}

function downloadEventLog(roomCode: string, events: LogEvent[]): void {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const date = new Date().toISOString().slice(0, 10)
  const a = document.createElement('a')
  a.href = url
  a.download = `gamelog-${roomCode}-${date}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export default function GameLogs() {
  const { entries, loading, error } = useGameLogIndex()
  const [selected, setSelected] = useState<string | null>(null)
  const [events, setEvents] = useState<LogEvent[]>([])
  const [eventsLoading, setEventsLoading] = useState(false)

  useEffect(() => {
    if (!selected) {
      setEvents([])
      return
    }
    setEventsLoading(true)
    return onValue(ref(db, `gameLogs/${selected}/events`), (snap) => {
      if (!snap.exists()) {
        setEvents([])
        setEventsLoading(false)
        return
      }
      const val = snap.val() as Record<string, Omit<LogEvent, 'key'>>
      const list: LogEvent[] = Object.entries(val).map(([key, data]) => ({ key, ...data }))
      list.sort((a, b) => (a.ts ?? 0) - (b.ts ?? 0))
      setEvents(list)
      setEventsLoading(false)
    })
  }, [selected])

  if (loading) return <div style={emptyStyle}>Loading game logs…</div>
  if (error) return <div style={{ ...emptyStyle, color: 'var(--danger)' }}>Error: {error}</div>
  if (entries.length === 0) return <div style={emptyStyle}>No game logs yet.</div>

  return (
    <div style={{ display: 'flex', gap: 24 }}>
      <table style={{ ...tableStyle, flex: '0 0 320px' }}>
        <thead>
          <tr>
            {['Room', 'Created'].map((h) => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(({ key, roomCode, createdAt }) => (
            <tr
              key={key}
              onClick={() => {
                setSelected(roomCode)
                setEvents([])
                setEventsLoading(true)
              }}
              style={{ ...trStyle, cursor: 'pointer', background: selected === roomCode ? 'var(--gold)' : 'transparent' }}
            >
              <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, letterSpacing: '0.08em' }}>
                {roomCode}
              </td>
              <td style={tdStyle}>{createdAt ? new Date(createdAt).toLocaleString() : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ flex: 1, minWidth: 0 }}>
        {!selected && <div style={emptyStyle}>Select a game to view its event log.</div>}
        {selected && eventsLoading && <div style={emptyStyle}>Loading events…</div>}
        {selected && !eventsLoading && events.length === 0 && <div style={emptyStyle}>No events recorded.</div>}
        {selected && !eventsLoading && events.length > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => downloadEventLog(selected, events)}
                style={downloadButtonStyle}
              >
                Download Log
              </button>
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto', border: 'var(--border)', borderRadius: 8 }}>
              {events.map((e) => (
                <div key={e.key} style={eventRowStyle}>
                  <span style={eventTimeStyle}>{formatTime(e.ts)}</span>
                  <span style={eventTypeStyle}>{e.type}</span>
                  {e.actorUid && <span style={eventMetaStyle}>uid:{e.actorUid.slice(0, 6)}</span>}
                  {e.data && (
                    <pre style={eventDataStyle}>{JSON.stringify(e.data)}</pre>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

const emptyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', color: '#888', padding: '40px 0', textAlign: 'center',
}
const tableStyle: React.CSSProperties = {
  width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-body)',
}
const thStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13, letterSpacing: '2px',
  textTransform: 'uppercase', padding: '8px 12px', borderBottom: '3px solid var(--ink)',
  textAlign: 'left',
}
const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #ddd',
}
const tdStyle: React.CSSProperties = {
  padding: '10px 12px', fontSize: 14, verticalAlign: 'middle',
}
const eventRowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'baseline', gap: 10, padding: '6px 12px',
  borderBottom: '1px solid #eee', fontFamily: 'monospace', fontSize: 12, flexWrap: 'wrap',
}
const eventTimeStyle: React.CSSProperties = {
  color: '#888', flexShrink: 0, minWidth: 90,
}
const eventTypeStyle: React.CSSProperties = {
  fontWeight: 700, flexShrink: 0,
}
const eventMetaStyle: React.CSSProperties = {
  color: '#666', flexShrink: 0,
}
const eventDataStyle: React.CSSProperties = {
  margin: 0, color: '#555', whiteSpace: 'pre-wrap', wordBreak: 'break-all', flexBasis: '100%',
}
const downloadButtonStyle: React.CSSProperties = {
  padding: '10px 20px', background: 'var(--gold)', border: 'var(--border)',
  boxShadow: 'var(--shadow)', fontFamily: 'var(--font-body)', fontWeight: 800,
  fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6,
}
