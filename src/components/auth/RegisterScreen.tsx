import { useState } from 'react'
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { auth } from '../../firebase'

export default function RegisterScreen() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') ?? '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Display name is required'); return }
    setError('')
    setLoading(true)
    try {
      const { user } = await createUserWithEmailAndPassword(auth, email, password)
      await updateProfile(user, { displayName: name.trim() })
      navigate(redirect)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <h1 style={titleStyle}>Create Account</h1>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Display name (shown in game)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={20}
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Password (min 6 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={inputStyle}
          />
          {error && <div style={errorStyle}>{error}</div>}
          <button type="submit" disabled={loading} style={btnPrimaryStyle}>
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link
            to={`/login?redirect=${encodeURIComponent(redirect)}`}
            style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}
          >
            ← Back to sign in
          </Link>
        </div>
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
  maxWidth: 360,
  background: 'var(--white)',
  border: 'var(--border)',
  boxShadow: 'var(--shadow-lg)',
  padding: 32,
  borderRadius: 'var(--r)',
}

const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 900,
  fontSize: 28,
  letterSpacing: '0.1em',
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

const btnPrimaryStyle: React.CSSProperties = {
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
