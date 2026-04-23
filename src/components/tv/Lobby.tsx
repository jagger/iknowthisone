import { useState, useEffect } from 'react'
import { generateQR } from '../../utils/qrCode'
import PlayerBg from '../shared/PlayerBg'
import type { Player } from '../../types/game'

interface Props {
  roomCode: string
  players: Record<string, Player>
}

const APP_URL = 'https://iknowthisone.jagger.dev'

export default function Lobby({ roomCode, players }: Props) {
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const joinUrl = `${APP_URL}/join/${roomCode}`

  useEffect(() => {
    generateQR(joinUrl).then(setQrUrl)
  }, [joinUrl])

  const playerList = Object.entries(players).filter(([, p]) => p.connected !== false)

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Left panel — room code */}
      <div
        style={{
          flex: '0 0 55%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '6% 8%',
          borderRight: 'var(--border)',
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: '4px',
            textTransform: 'uppercase',
            marginBottom: 8,
            color: 'var(--ink)',
          }}
        >
          Room code
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(20px, 3.8vw, 42px)',
            letterSpacing: '0.12em',
            lineHeight: 1,
            color: 'var(--ink)',
          }}
        >
          {roomCode}
        </div>
        <div
          style={{
            marginTop: 16,
            fontFamily: 'var(--font-body)',
            fontWeight: 600,
            fontSize: 14,
            color: '#666',
          }}
        >
          join at {APP_URL.replace('https://', '')}
        </div>
        <div style={{ marginTop: 24 }}>
          <span
            style={{
              display: 'inline-block',
              background: 'var(--gold)',
              border: 'var(--border)',
              boxShadow: 'var(--shadow)',
              padding: '4px 14px',
              fontFamily: 'var(--font-body)',
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}
          >
            {playerList.length} player{playerList.length !== 1 ? 's' : ''} joined
          </span>
        </div>
      </div>

      {/* Right panel — player list + QR */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '5% 6%',
          gap: 12,
          overflowY: 'auto',
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          {playerList.map(([uid, player]) => (
            <PlayerBg
              key={uid}
              identityIndex={player.identityIndex}
              style={{
                borderRadius: 8,
                border: 'var(--border)',
                boxShadow: '3px 3px 0 var(--ink)',
                padding: '8px 14px',
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-body)',
                  fontWeight: 800,
                  fontSize: 16,
                  color: '#fff',
                  textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
                }}
              >
                {player.name}
              </span>
            </PlayerBg>
          ))}
          {playerList.length === 0 && (
            <div style={{ color: '#999', fontFamily: 'var(--font-body)', fontSize: 14 }}>
              Waiting for players…
            </div>
          )}
        </div>
        {qrUrl && (
          <div style={{ marginTop: 'auto', alignSelf: 'flex-end', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 11, letterSpacing: '4px', textTransform: 'uppercase', color: 'var(--ink)', marginBottom: 4 }}>
              JOIN
            </div>
            <img
              src={qrUrl}
              alt={`QR code for ${joinUrl}`}
              style={{
                width: 160,
                border: 'var(--border)',
                boxShadow: '4px 4px 0 var(--ink)',
                display: 'block',
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
