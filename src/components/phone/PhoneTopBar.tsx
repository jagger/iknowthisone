import PlayerBg from '../shared/PlayerBg'
import type { Player } from '../../types/game'

interface Props {
  player: Player | undefined
  uid: string
}

export default function PhoneTopBar({ player }: Props) {
  if (!player) return <div style={{ height: 48, background: 'var(--ink)' }} />

  return (
    <PlayerBg
      identityIndex={player.identityIndex}
      style={{
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 800,
          fontSize: 15,
          color: '#fff',
          textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        {player.name}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 20,
          color: '#fff',
          textShadow: '1px 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        {player.score} pts
      </span>
    </PlayerBg>
  )
}
