import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { useParams } from 'react-router-dom'
import { functions } from '../../firebase'
import PlayerBg from '../shared/PlayerBg'
import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
  uid: string
}

export default function LobbyScreen({ meta, players, uid }: Props) {
  const { roomCode } = useParams<{ roomCode: string }>()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState('')
  const isHost = uid === meta.hostId
  const playerList = Object.entries(players).filter(([, p]) => p.connected !== false)

  const handleStart = async () => {
    setStarting(true)
    setError('')
    try {
      const startGame = httpsCallable<{ roomCode: string }, void>(functions, 'startGame')
      await startGame({ roomCode: roomCode ?? '' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div style={screenStyle}>
      <div style={statusStyle}>Waiting for game to start</div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {playerList.map(([pUid, player]) => (
          <PlayerBg
            key={pUid}
            identityIndex={player.identityIndex}
            style={{
              border: 'var(--border)',
              boxShadow: '3px 3px 0 var(--ink)',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 16 }}>
              {player.name}
            </span>
            {pUid === meta.hostId && (
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontFamily: 'var(--font-body)', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase' }}>
                Host
              </span>
            )}
          </PlayerBg>
        ))}
      </div>

      <div style={actionZoneStyle}>
        {error && <div style={{ color: 'var(--danger)', fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</div>}
        {isHost ? (
          <button
            onClick={handleStart}
            disabled={starting || playerList.length < 2}
            style={{
              ...bigBtnStyle,
              background: playerList.length >= 2 ? 'var(--gold)' : '#ddd',
              color: playerList.length >= 2 ? 'var(--ink)' : '#999',
              cursor: playerList.length >= 2 ? 'pointer' : 'not-allowed',
              boxShadow: playerList.length >= 2 ? 'var(--shadow)' : 'none',
            }}
          >
            {starting ? 'Starting…' : playerList.length < 2 ? 'Need 2+ players' : 'Start Game'}
          </button>
        ) : (
          <div style={{ textAlign: 'center', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, letterSpacing: '2px', textTransform: 'uppercase', color: '#666' }}>
            Waiting for host to start…
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
  gap: 16,
  paddingTop: 16,
}

const statusStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontWeight: 700,
  fontSize: 11,
  letterSpacing: '3px',
  textTransform: 'uppercase',
  color: '#666',
  textAlign: 'center',
}

const actionZoneStyle: React.CSSProperties = {
  padding: '16px 20px 32px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
}

const bigBtnStyle: React.CSSProperties = {
  width: '100%',
  height: 80,
  border: 'var(--border)',
  fontFamily: 'var(--font-body)',
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: '2px',
  textTransform: 'uppercase',
  borderRadius: 8,
  transition: 'transform 0.08s',
}
