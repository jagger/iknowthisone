import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { httpsCallable } from 'firebase/functions'
import { auth, functions } from '../../firebase'
import { useGameState } from '../../hooks/useGameState'
import { usePlayerRole } from '../../hooks/usePlayerRole'
import { usePresence } from '../../hooks/usePresence'
import PhoneTopBar from './PhoneTopBar'
import LobbyScreen from './LobbyScreen'
import BuzzerScreen from './BuzzerScreen'
import VotingScreen from './VotingScreen'
import SingerScreen from './SingerScreen'
import CategoryPicker from './CategoryPicker'
import CategorySpectatorScreen from './CategorySpectatorScreen'
import GameOverScreen from './GameOverScreen'

const ACTIVE_STATES = ['WORD_REVEAL','BUZZER_OPEN','SINGING','VOTE_CLOSING','MUTED','CATEGORY_PICK','POINT_AWARDED']

export default function PhoneGameView() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [user, setUser] = useState<User | null>(null)
  const [endConfirm, setEndConfirm] = useState(false)
  const endTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const { meta, players, categoryChoice, skipVotes, loading, error } = useGameState(roomCode ?? '')
  const role = usePlayerRole(user?.uid ?? null, meta, players)

  usePresence(roomCode ?? '', user?.uid ?? null)

  const uid = user?.uid ?? ''
  const myPlayer = players[uid]
  const isHost = meta?.hostId === uid
  const connectedPlayers = Object.values(players).filter(p => p.connected !== false)

  const handleEndFirst = () => {
    setEndConfirm(true)
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    endTimerRef.current = setTimeout(() => setEndConfirm(false), 3000)
  }

  const handleEndConfirm = async () => {
    if (endTimerRef.current) clearTimeout(endTimerRef.current)
    setEndConfirm(false)
    try {
      await httpsCallable(functions, 'endGame')({ roomCode: roomCode ?? '' })
    } catch { /* ignore */ }
  }

  if (loading || !user) {
    return (
      <div style={loadingStyle}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 32, letterSpacing: '0.1em' }}>
          {roomCode}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--ink)', opacity: 0.3,
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    )
  }

  if (error || !meta) {
    return (
      <div style={loadingStyle}>
        <div style={{ fontFamily: 'var(--font-body)', color: 'var(--danger)', fontWeight: 700 }}>
          {error ?? 'Room not found'}
        </div>
        <button onClick={() => window.location.href = '/'} style={{ marginTop: 16, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, letterSpacing: '2px', textTransform: 'uppercase', background: 'transparent', border: 'var(--border)', padding: '8px 16px', cursor: 'pointer', borderRadius: 6 }}>
          ← Back to Home
        </button>
      </div>
    )
  }

  const renderScreen = () => {
    switch (role) {
      case 'lobby_host':
      case 'lobby_player':
        return <LobbyScreen meta={meta} players={players} uid={uid} />

      case 'buzzer':
        return <BuzzerScreen meta={meta} roomCode={roomCode ?? ''} uid={uid} muted={false} skipVotes={skipVotes} totalPlayers={connectedPlayers.length} />

      case 'muted_buzzer':
        return <BuzzerScreen meta={meta} roomCode={roomCode ?? ''} uid={uid} muted={true} skipVotes={skipVotes} totalPlayers={connectedPlayers.length} />

      case 'singer':
        return <SingerScreen meta={meta} players={players} />

      case 'voter':
        return <VotingScreen meta={meta} players={players} roomCode={roomCode ?? ''} uid={uid} />

      case 'category_picker':
        return categoryChoice
          ? <CategoryPicker roomCode={roomCode ?? ''} categoryChoice={categoryChoice} />
          : <CategorySpectatorScreen meta={meta} players={players} categoryChoice={null} />

      case 'category_spectator':
        return <CategorySpectatorScreen meta={meta} players={players} categoryChoice={categoryChoice} />

      case 'game_over':
        return <GameOverScreen meta={meta} players={players} roomCode={roomCode ?? ''} uid={uid} />

      default:
        return (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, letterSpacing: '0.1em' }}>
              {meta.currentWord || roomCode}
            </div>
          </div>
        )
    }
  }

  const showEndBtn = isHost && meta && ACTIVE_STATES.includes(meta.state)

  return (
    <div style={containerStyle}>
      <PhoneTopBar player={myPlayer} uid={uid} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {renderScreen()}
        {showEndBtn && (
          <button
            onClick={endConfirm ? handleEndConfirm : handleEndFirst}
            aria-label={endConfirm ? 'Confirm: end the game now' : 'End game (requires confirmation)'}
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '5px 10px',
              minHeight: 44,
              minWidth: 60,
              background: endConfirm ? 'var(--danger)' : 'rgba(0,0,0,0.12)',
              color: endConfirm ? '#fff' : '#888',
              border: endConfirm ? '2px solid var(--danger)' : '2px solid #ccc',
              borderRadius: 6,
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 10,
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: 'pointer',
              transition: 'all 0.15s',
              zIndex: 20,
            }}
          >
            {endConfirm ? 'Confirm end?' : 'End'}
          </button>
        )}
      </div>
    </div>
  )
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--bg)',
  maxWidth: 480,
  margin: '0 auto',
}

const loadingStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
}
