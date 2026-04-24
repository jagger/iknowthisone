import { useState, useEffect } from 'react'
import { ref, set, serverTimestamp } from 'firebase/database'
import { db } from '../../firebase'
import type { RoomMeta, Player } from '../../types/game'

const VOTE_DELAY_MS = 5000

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
  roomCode: string
  uid: string
}

export default function VotingScreen({ meta, players, roomCode, uid }: Props) {
  const [voting, setVoting] = useState(false)
  const [countdown, setCountdown] = useState(0)
  const hasVoted = players[uid]?.hasVoted ?? false
  const singer = meta.activeSinger ? players[meta.activeSinger] : null

  useEffect(() => {
    if (!meta.singingStartedAt) { setCountdown(0); return }
    const elapsed = Date.now() - (meta.singingStartedAt as number)
    if (elapsed >= VOTE_DELAY_MS) { setCountdown(0); return }
    setCountdown(Math.ceil((VOTE_DELAY_MS - elapsed) / 1000))
    const id = setInterval(() => {
      const e = Date.now() - (meta.singingStartedAt as number)
      if (e >= VOTE_DELAY_MS) { setCountdown(0); clearInterval(id) }
      else setCountdown(Math.ceil((VOTE_DELAY_MS - e) / 1000))
    }, 200)
    return () => clearInterval(id)
  }, [meta.singingStartedAt])

  const handleVote = async (value: 'point' | 'fail') => {
    if (voting || hasVoted || countdown > 0) return
    setVoting(true)
    try {
      await set(ref(db, `rooms/${roomCode}/votes/${uid}`), {
        value,
        votedAt: serverTimestamp(),
      })
    } catch {
      setVoting(false)
    }
  }

  return (
    <div style={screenStyle}>
      <div style={statusStyle}>
        {meta.state === 'VOTE_CLOSING' ? 'Voting closes soon!' : 'Cast your vote'}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '0 20px' }}>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'min(15vw, 80px)',
            letterSpacing: '0.06em',
            color: 'var(--ink)',
            textAlign: 'center',
          }}
        >
          {meta.currentWord.toUpperCase()}
        </div>
        {singer && (
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: '#555' }}>
            🎤 {singer.name} is singing
          </div>
        )}
      </div>

      <div style={actionZoneStyle}>
        {hasVoted ? (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 18, letterSpacing: '2px', padding: '24px 0', border: 'var(--border)', borderRadius: 10, background: 'var(--bg)' }}>
            Vote submitted ✓
          </div>
        ) : countdown > 0 ? (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 48, letterSpacing: '0.05em', padding: '16px 0', color: 'var(--ink)' }}>
            {countdown}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => handleVote('point')}
              disabled={voting}
              aria-label="Vote: they sang it correctly, award a point"
              onPointerDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
              onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              style={{ ...voteBtnStyle, background: '#00BB44' }}
            >
              ✅ Point
            </button>
            <button
              onClick={() => handleVote('fail')}
              disabled={voting}
              aria-label="Vote: they failed, mute them this round"
              onPointerDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)' }}
              onPointerUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              onPointerLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)' }}
              style={{ ...voteBtnStyle, background: 'var(--danger)' }}
            >
              ❌ Fail
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const screenStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
}

const statusStyle: React.CSSProperties = {
  padding: '12px 20px 0',
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#666',
  textAlign: 'center',
}

const actionZoneStyle: React.CSSProperties = {
  padding: '16px 20px 40px',
}

const voteBtnStyle: React.CSSProperties = {
  flex: 1,
  height: 80,
  color: '#fff',
  border: 'var(--border)',
  boxShadow: 'var(--shadow)',
  borderRadius: 10,
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 18,
  cursor: 'pointer',
  transition: 'transform 0.08s',
}
