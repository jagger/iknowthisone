import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../../firebase'
import { useAllRooms } from '../../hooks/useAllRooms'
import type { GameState } from '../../types/game'

const STATE_COLORS: Record<GameState, string> = {
  LOBBY:         '#888',
  CATEGORY_PICK: '#0066FF',
  WORD_REVEAL:   '#FF6600',
  BUZZER_OPEN:   '#00BB44',
  SINGING:       '#DDAA00',
  VOTE_CLOSING:  '#9900FF',
  POINT_AWARDED: '#00BB44',
  MUTED:         '#EE2200',
  GAME_OVER:     '#333',
}

function formatElapsed(createdAt: number): string {
  const ms = Date.now() - createdAt
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export default function GameList() {
  const { rooms, loading } = useAllRooms()
  const [ending, setEnding] = useState<Set<string>>(new Set())

  const handleEnd = async (roomCode: string) => {
    setEnding((s) => new Set(s).add(roomCode))
    try {
      await httpsCallable(functions, 'adminEndGame')({ roomCode })
    } finally {
      setEnding((s) => { const n = new Set(s); n.delete(roomCode); return n })
    }
  }

  if (loading) return <div style={emptyStyle}>Loading rooms…</div>
  if (rooms.length === 0) return <div style={emptyStyle}>No active rooms.</div>

  return (
    <table style={tableStyle}>
      <thead>
        <tr>
          {['Room', 'State', 'Players', 'Age', ''].map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rooms.map(({ roomCode, meta, playerCount }) => (
          <tr key={roomCode} style={trStyle}>
            <td style={{ ...tdStyle, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, letterSpacing: '0.1em' }}>
              {roomCode}
            </td>
            <td style={tdStyle}>
              <span style={{ ...badgeStyle, background: STATE_COLORS[meta.state] ?? '#888' }}>
                {meta.state}
              </span>
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>{playerCount}</td>
            <td style={tdStyle}>{meta.createdAt ? formatElapsed(meta.createdAt) : '—'}</td>
            <td style={tdStyle}>
              {meta.state !== 'GAME_OVER' && (
                <button
                  onClick={() => handleEnd(roomCode)}
                  disabled={ending.has(roomCode)}
                  style={endBtnStyle}
                >
                  {ending.has(roomCode) ? '…' : 'End Game'}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
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
const badgeStyle: React.CSSProperties = {
  display: 'inline-block', padding: '2px 8px', color: '#fff', borderRadius: 4,
  fontSize: 11, fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
}
const endBtnStyle: React.CSSProperties = {
  padding: '5px 12px', background: 'var(--danger)', color: '#fff',
  border: '2px solid var(--ink)', fontFamily: 'var(--font-body)', fontWeight: 800,
  fontSize: 12, letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer',
  borderRadius: 4,
}
