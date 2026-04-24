import { useState } from 'react'
import { signOut } from 'firebase/auth'
import { auth } from '../../firebase'
import GameList from './GameList'
import WordEditor from './WordEditor'
import Analytics from './Analytics'

type Tab = 'games' | 'words' | 'analytics'

const TABS: { id: Tab; label: string }[] = [
  { id: 'games',     label: 'Games'       },
  { id: 'words',     label: 'Word Editor' },
  { id: 'analytics', label: 'Analytics'   },
]

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>('games')
  const user = auth.currentUser

  return (
    <div style={pageStyle}>
      <div style={headerStyle}>
        <span style={titleStyle}>ADMIN</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={emailStyle}>{user?.email}</span>
          <button onClick={() => signOut(auth)} style={signOutStyle}>Sign out</button>
        </div>
      </div>

      <div style={tabBarStyle}>
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              ...tabStyle,
              background: tab === id ? 'var(--gold)' : 'transparent',
              borderBottom: tab === id ? '3px solid var(--gold)' : '3px solid transparent',
              marginBottom: tab === id ? -3 : 0,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={contentStyle}>
        {tab === 'games'     && <GameList />}
        {tab === 'words'     && <WordEditor />}
        {tab === 'analytics' && <Analytics />}
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh', background: 'var(--bg)', padding: '0 0 40px',
}
const headerStyle: React.CSSProperties = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  padding: '16px 32px', borderBottom: 'var(--border)', background: 'var(--white)',
}
const titleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, letterSpacing: '0.1em',
}
const emailStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)', fontSize: 13, color: '#666',
}
const signOutStyle: React.CSSProperties = {
  padding: '6px 14px', background: 'transparent', border: 'var(--border)',
  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 12,
  letterSpacing: '1px', textTransform: 'uppercase', cursor: 'pointer', borderRadius: 4,
}
const tabBarStyle: React.CSSProperties = {
  display: 'flex', gap: 0, padding: '0 32px',
  borderBottom: 'var(--border)', background: 'var(--white)',
}
const tabStyle: React.CSSProperties = {
  padding: '12px 24px', border: 'none', cursor: 'pointer',
  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16,
  letterSpacing: '0.06em', textTransform: 'uppercase',
}
const contentStyle: React.CSSProperties = {
  padding: '28px 32px',
}
