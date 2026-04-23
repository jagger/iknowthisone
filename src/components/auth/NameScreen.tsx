import { useState, useEffect } from 'react'
import { signInAnonymously, updateProfile } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { auth, functions } from '../../firebase'

const STORAGE_KEY = 'ikto_player'

function loadSaved(): { name: string; email: string } {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  catch { return { name: '', email: '' } }
}

type Mode = 'choose' | 'create' | 'join'

export default function NameScreen() {
  const { roomCode: codeParam } = useParams<{ roomCode?: string }>()
  const [searchParams] = useSearchParams()
  const hostTokenParam = searchParams.get('hostToken')
  const navigate = useNavigate()
  const saved = loadSaved()

  const [mode, setMode] = useState<Mode>(codeParam ? 'join' : 'choose')
  const [name, setName] = useState(saved.name ?? '')
  const [email, setEmail] = useState(saved.email ?? '')
  const [roomInput, setRoomInput] = useState(codeParam ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const user = auth.currentUser
    if (user?.displayName && codeParam) navigate(`/play/${codeParam}`, { replace: true })
  }, [codeParam, navigate])

  const signIn = async () => {
    const trimName = name.trim()
    if (!trimName) { setError('Enter your name'); return null }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ name: trimName, email: email.trim() }))
    const { user } = await signInAnonymously(auth)
    await updateProfile(user, { displayName: trimName })
    return user
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await signInAnonymously(auth)
      const createRoom = httpsCallable<Record<string, never>, { roomCode: string; hostToken: string }>(functions, 'createRoom')
      const { data } = await createRoom({})
      const trimEmail = email.trim()
      if (trimEmail) {
        const hostLink = `https://iknowthisone.jagger.dev/join/${data.roomCode}?hostToken=${data.hostToken}`
        window.location.href = `mailto:${trimEmail}?subject=Your%20host%20link%20for%20I%20Know%20This%20One&body=Join%20as%20host%3A%20${encodeURIComponent(hostLink)}`
      }
      navigate(`/screen/${data.roomCode}`, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    const code = (codeParam ?? roomInput).trim()
    if (!code) { setError('Enter a room code'); return }
    setLoading(true); setError('')
    try {
      const user = await signIn()
      if (!user) { setLoading(false); return }
      const dest = hostTokenParam
        ? `/play/${code}?hostToken=${hostTokenParam}`
        : `/play/${code}`
      navigate(dest, { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>I KNOW THIS ONE</h1>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
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
        </div>

        {mode === 'choose' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
            <button onClick={() => setMode('create')} style={btnGoldStyle}>
              Create a room
            </button>
            <button onClick={() => setMode('join')} style={btnOutlineStyle}>
              Join a room
            </button>
          </div>
        )}

        {mode === 'create' && (
          <form onSubmit={handleCreate} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {error && <div style={errorStyle}>{error}</div>}
            <button type="submit" disabled={loading} style={btnGoldStyle}>
              {loading ? 'Creating…' : 'Create Room'}
            </button>
            <button type="button" onClick={() => { setMode('choose'); setError('') }} style={btnOutlineStyle}>
              ← Back
            </button>
          </form>
        )}

        {mode === 'join' && (
          <form onSubmit={handleJoin} style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {codeParam ? (
              <div style={roomBadgeStyle}>
                Joining <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, letterSpacing: '0.15em' }}>{codeParam}</span>
              </div>
            ) : (
              <input
                type="text"
                placeholder="Room code"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                maxLength={20}
                style={{ ...inputStyle, fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24, letterSpacing: '0.2em', textAlign: 'center' }}
              />
            )}
            {error && <div style={errorStyle}>{error}</div>}
            <button type="submit" disabled={loading} style={btnGoldStyle}>
              {loading ? 'Joining…' : 'Join Game'}
            </button>
            {!codeParam && (
              <button type="button" onClick={() => { setMode('choose'); setError('') }} style={btnOutlineStyle}>
                ← Back
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)', padding: 24,
}
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 340, background: 'var(--white)',
  border: 'var(--border)', boxShadow: 'var(--shadow-lg)', padding: 32, borderRadius: 'var(--r)',
}
const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26,
  letterSpacing: '0.08em', marginBottom: 20, textAlign: 'center',
}
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 14px', border: 'var(--border)', borderRadius: 6,
  fontSize: 16, fontFamily: 'var(--font-body)', background: 'var(--bg)', outline: 'none',
}
const btnGoldStyle: React.CSSProperties = {
  width: '100%', padding: '14px', background: 'var(--gold)', border: 'var(--border)',
  boxShadow: 'var(--shadow)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 16,
  letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6,
}
const btnOutlineStyle: React.CSSProperties = {
  width: '100%', padding: '12px', background: 'transparent', border: 'var(--border)',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer', borderRadius: 6,
}
const roomBadgeStyle: React.CSSProperties = {
  textAlign: 'center', padding: '10px 14px', background: 'var(--bg)',
  border: 'var(--border)', borderRadius: 6, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14,
}
const errorStyle: React.CSSProperties = {
  color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600,
  padding: '6px 10px', background: '#fee', border: '1px solid var(--danger)', borderRadius: 4,
}
