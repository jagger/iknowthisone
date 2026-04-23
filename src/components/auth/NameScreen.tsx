import { useState, useEffect } from 'react'
import { signInAnonymously, updateProfile } from 'firebase/auth'
import { useNavigate, useParams } from 'react-router-dom'
import { auth } from '../../firebase'

const STORAGE_KEY = 'ikto_player'

function loadSaved(): { name: string; email: string } {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return { name: '', email: '' }
  }
}

export default function NameScreen() {
  const { roomCode } = useParams<{ roomCode?: string }>()
  const navigate = useNavigate()
  const saved = loadSaved()

  const [name, setName] = useState(saved.name ?? '')
  const [email, setEmail] = useState(saved.email ?? '')
  const [roomInput, setRoomInput] = useState(roomCode ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // If already signed in with a name, skip the form
  useEffect(() => {
    const user = auth.currentUser
    if (user && user.displayName && roomCode) {
      navigate(`/play/${roomCode}`, { replace: true })
    }
  }, [roomCode, navigate])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimName = name.trim()
    const code = (roomCode ?? roomInput).trim().toUpperCase()
    if (!trimName) { setError('Enter your name'); return }
    if (!code) { setError('Enter a room code'); return }

    setLoading(true)
    setError('')
    try {
      const { user } = await signInAnonymously(auth)
      await updateProfile(user, { displayName: trimName })
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: trimName, email: email.trim() }))
      navigate(`/play/${code}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>I KNOW THIS ONE</h1>

        <form onSubmit={handleJoin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={20}
            autoFocus
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          {!roomCode && (
            <input
              type="text"
              placeholder="Room code"
              value={roomInput}
              onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
              maxLength={4}
              style={{ ...inputStyle, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, letterSpacing: '0.2em', textAlign: 'center' }}
            />
          )}
          {roomCode && (
            <div style={roomBadgeStyle}>
              Joining <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, letterSpacing: '0.15em' }}>{roomCode}</span>
            </div>
          )}
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={loading} style={btnStyle}>
            {loading ? 'Joining…' : 'Join Game'}
          </button>
        </form>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
  padding: 24,
}

const cardStyle: React.CSSProperties = {
  width: '100%',
  maxWidth: 340,
  background: 'var(--white)',
  border: 'var(--border)',
  boxShadow: 'var(--shadow-lg)',
  padding: 32,
  borderRadius: 'var(--r)',
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 900,
  fontSize: 26,
  letterSpacing: '0.08em',
  marginBottom: 24,
  textAlign: 'center',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: 'var(--border)',
  borderRadius: 6,
  fontSize: 16,
  fontFamily: 'var(--font-body)',
  background: 'var(--bg)',
  outline: 'none',
}

const roomBadgeStyle: React.CSSProperties = {
  textAlign: 'center',
  padding: '10px 14px',
  background: 'var(--bg)',
  border: 'var(--border)',
  borderRadius: 6,
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 14,
  letterSpacing: '1px',
}

const btnStyle: React.CSSProperties = {
  width: '100%',
  padding: '14px',
  background: 'var(--gold)',
  border: 'var(--border)',
  boxShadow: 'var(--shadow)',
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 16,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  cursor: 'pointer',
  borderRadius: 6,
  marginTop: 4,
}

const errorStyle: React.CSSProperties = {
  color: 'var(--danger)',
  fontFamily: 'var(--font-body)',
  fontSize: 13,
  fontWeight: 600,
  padding: '6px 10px',
  background: '#fee',
  border: '1px solid var(--danger)',
  borderRadius: 4,
}
