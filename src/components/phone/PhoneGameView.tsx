import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { onAuthStateChanged } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { auth } from '../../firebase'
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
import MutedScreen from './MutedScreen'
import GameOverScreen from './GameOverScreen'

export default function PhoneGameView() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => onAuthStateChanged(auth, setUser), [])

  const { meta, players, categoryChoice, loading, error } = useGameState(roomCode ?? '')
  const role = usePlayerRole(user?.uid ?? null, meta, players)

  usePresence(roomCode ?? '', user?.uid ?? null)

  const uid = user?.uid ?? ''
  const myPlayer = players[uid]

  if (loading || !user) {
    return (
      <div style={loadingStyle}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 32, letterSpacing: '0.1em' }}>
          {roomCode}
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
      </div>
    )
  }

  const renderScreen = () => {
    switch (role) {
      case 'lobby_host':
      case 'lobby_player':
        return <LobbyScreen meta={meta} players={players} uid={uid} />

      case 'buzzer':
        return <BuzzerScreen meta={meta} roomCode={roomCode ?? ''} uid={uid} muted={false} />

      case 'muted_buzzer':
        return <BuzzerScreen meta={meta} roomCode={roomCode ?? ''} uid={uid} muted={true} />

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

  return (
    <div style={containerStyle}>
      <PhoneTopBar player={myPlayer} uid={uid} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {renderScreen()}
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
