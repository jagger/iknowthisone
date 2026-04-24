import { type ReactNode, useEffect, useState } from 'react'
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth, googleProvider } from '../../firebase'

const ALLOWLIST = ['jagger@oznog.org', 'cewhiney08@gmail.com']

type AuthState = 'loading' | 'signed-out' | 'wrong-email' | 'ok'

export default function AdminRoute({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>('loading')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u)
      if (!u || u.isAnonymous) {
        setState('signed-out')
      } else if (!ALLOWLIST.includes(u.email ?? '')) {
        setState('wrong-email')
      } else {
        setState('ok')
      }
    })
  }, [])

  if (state === 'loading') return null

  if (state === 'signed-out') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>ADMIN</h1>
          <p style={subtitleStyle}>Sign in with an authorised Google account</p>
          <button onClick={() => signInWithPopup(auth, googleProvider)} style={btnGoldStyle}>
            Sign in with Google
          </button>
        </div>
      </div>
    )
  }

  if (state === 'wrong-email') {
    return (
      <div style={pageStyle}>
        <div style={cardStyle}>
          <h1 style={titleStyle}>ACCESS DENIED</h1>
          <p style={subtitleStyle}>{user?.email}</p>
          <button onClick={() => signOut(auth)} style={btnOutlineStyle}>
            Sign out
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'var(--bg)', padding: 24,
}
const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 360, background: 'var(--white)',
  border: 'var(--border)', boxShadow: 'var(--shadow-lg)', padding: 40, borderRadius: 'var(--r)',
  display: 'flex', flexDirection: 'column', gap: 16,
}
const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 32,
  letterSpacing: '0.08em', textAlign: 'center', margin: 0,
}
const subtitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 14, color: '#666',
  textAlign: 'center', margin: 0,
}
const btnGoldStyle: React.CSSProperties = {
  width: '100%', padding: '14px', background: 'var(--gold)', border: 'var(--border)',
  boxShadow: 'var(--shadow)', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 15,
  letterSpacing: '2px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 6,
}
const btnOutlineStyle: React.CSSProperties = {
  width: '100%', padding: '12px', background: 'transparent', border: 'var(--border)',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, cursor: 'pointer', borderRadius: 6,
}
