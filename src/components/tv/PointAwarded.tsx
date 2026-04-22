import PlayerBg from '../shared/PlayerBg'
import type { RoomMeta, Player } from '../../types/game'

interface Props {
  meta: RoomMeta
  players: Record<string, Player>
}

export default function PointAwarded({ meta, players }: Props) {
  const singer = meta.activeSinger ? players[meta.activeSinger] : null

  return (
    <PlayerBg
      identityIndex={singer?.identityIndex ?? 0}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        animation: 'flashIn 2s ease-in-out forwards',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 'clamp(60px, 14vw, 160px)',
          color: '#fff',
          textShadow: '4px 4px 0 rgba(0,0,0,0.3)',
          letterSpacing: '0.04em',
          lineHeight: 1,
        }}
      >
        +{meta.wordPointValue}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 'clamp(32px, 7vw, 80px)',
          color: '#fff',
          textShadow: '3px 3px 0 rgba(0,0,0,0.3)',
          letterSpacing: '0.06em',
        }}
      >
        {singer?.name ?? ''}
      </div>
    </PlayerBg>
  )
}
