import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useGameState } from '../../hooks/useGameState'
import { generateQR } from '../../utils/qrCode'
import { APP_URL } from '../../constants'
import Lobby from './Lobby'
import WordReveal from './WordReveal'
import Singing from './Singing'
import VoteClosing from './VoteClosing'
import PointAwarded from './PointAwarded'
import MutedFlash from './MutedFlash'
import GameOver from './GameOver'
import CategoryPickTV from './CategoryPickTV'

const frameStyle: React.CSSProperties = {
  width: 'min(960px, 100vw)',
  aspectRatio: '16 / 9',
  border: '4px solid var(--ink)',
  boxShadow: '8px 8px 0 var(--ink)',
  background: 'var(--bg)',
  position: 'relative',
  overflow: 'hidden',
  margin: 'auto',
}

const wrapStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#111',
  padding: 16,
}

export default function TvGameView() {
  const { roomCode } = useParams<{ roomCode: string }>()
  const { meta, players, categoryChoice, skipVotes, loading, error } = useGameState(roomCode ?? '')
  const [qrUrl, setQrUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!roomCode) return
    generateQR(`${APP_URL}/join/${roomCode}`).then(setQrUrl)
  }, [roomCode])

  if (loading) {
    return (
      <div style={wrapStyle}>
        <div style={frameStyle}>
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(40px, 8vw, 80px)',
                fontWeight: 900,
                letterSpacing: '0.1em',
                color: 'var(--ink)',
              }}
            >
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
        </div>
      </div>
    )
  }

  if (error || !meta) {
    return (
      <div style={wrapStyle}>
        <div style={frameStyle}>
          <div
            style={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 18,
                fontWeight: 700,
                color: 'var(--danger)',
              }}
            >
              {error ?? 'Room not found'}
            </div>
            <div style={{ marginTop: 12, fontFamily: 'var(--font-body)', fontSize: 13, color: '#666' }}>Check the room code and try again.</div>
          </div>
        </div>
      </div>
    )
  }

  const renderState = () => {
    switch (meta.state) {
      case 'LOBBY':
        return <Lobby roomCode={roomCode ?? ''} players={players} />
      case 'CATEGORY_PICK':
        return <CategoryPickTV meta={meta} players={players} categoryChoice={categoryChoice} />
      case 'WORD_REVEAL':
      case 'BUZZER_OPEN':
        return <WordReveal meta={meta} players={players} skipVotes={skipVotes} />
      case 'SINGING':
        return <Singing meta={meta} players={players} />
      case 'VOTE_CLOSING':
        return <VoteClosing meta={meta} players={players} />
      case 'POINT_AWARDED':
        return <PointAwarded meta={meta} players={players} />
      case 'MUTED':
        return <MutedFlash meta={meta} players={players} />
      case 'GAME_OVER':
        return <GameOver meta={meta} players={players} />
      default:
        return null
    }
  }

  return (
    <>
      <style>{`.word-slam { animation: wordSlam 400ms ease-out both; }`}</style>
      <div style={wrapStyle}>
        <div style={frameStyle}>
          {renderState()}
          {meta.state !== 'LOBBY' && meta.state !== 'GAME_OVER' && (
            <div style={{ position: 'absolute', bottom: 60, right: 8, display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.75)', border: '2px solid rgba(255,255,255,0.15)', borderRadius: 6, padding: '4px 8px 4px 4px', zIndex: 10 }}>
              {qrUrl && <img src={qrUrl} alt="join QR" style={{ width: 36, height: 36, display: 'block' }} />}
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, color: '#fff', letterSpacing: '0.08em' }}>[Room: {roomCode}]</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
