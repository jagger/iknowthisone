import { useParams } from 'react-router-dom'
import { useGameState } from '../../hooks/useGameState'
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
  const { meta, players, categoryChoice, loading, error } = useGameState(roomCode ?? '')

  if (loading) {
    return (
      <div style={wrapStyle}>
        <div style={frameStyle}>
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-display)',
              fontSize: 'clamp(40px, 8vw, 80px)',
              fontWeight: 900,
              letterSpacing: '0.1em',
              color: 'var(--ink)',
            }}
          >
            {roomCode}
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
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-body)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--danger)',
            }}
          >
            {error ?? 'Room not found'}
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
        return <WordReveal meta={meta} players={players} />
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
        <div style={frameStyle}>{renderState()}</div>
      </div>
    </>
  )
}
