import PlayerBg from '../shared/PlayerBg'
import Scoreboard from './Scoreboard'
import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function GameOver({ meta, players }: Props) {
  const winner = Object.entries(players).sort(([, a], [, b]) => b.score - a.score)[0]
  const [, winnerPlayer] = winner ?? [null, null]
  const noBuzz = meta.gameOverReason === 'no_buzz'

  return (
    <PlayerBg
      identityIndex={winnerPlayer?.identityIndex ?? 0}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '5%',
      }}
    >
      {noBuzz && (
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 'clamp(12px, 2vw, 18px)', letterSpacing: '3px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)', textAlign: 'center' }}>
          Nobody buzzed in 5 times in a row!
        </div>
      )}
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 'clamp(48px, 10vw, 110px)',
          color: '#fff',
          textShadow: '4px 4px 0 rgba(0,0,0,0.3)',
          letterSpacing: '0.04em',
          textAlign: 'center',
          lineHeight: 1,
        }}
      >
        {noBuzz ? 'Game Over' : `${winnerPlayer?.name ?? '?'} wins!`}
      </div>

      {!noBuzz && (
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: '3px',
            textTransform: 'uppercase',
            color: '#fff',
            textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
          }}
        >
          🏆 {winnerPlayer?.score} points
        </div>
      )}

      <Scoreboard players={players} pointsToWin={meta.pointsToWin} />

      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: '2px',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.7)',
        }}
      >
        Players: tap Rematch on your phone
      </div>
    </PlayerBg>
  )
}
