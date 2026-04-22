import type { RoomMeta, Player, PlayerRole } from '../types/game'

export function usePlayerRole(
  uid: string | null,
  meta: RoomMeta | null,
  players: Record<string, Player>,
): PlayerRole {
  if (!uid || !meta) return 'loading'

  const state = meta.state
  const me = players[uid]

  if (state === 'LOBBY') {
    return uid === meta.hostId ? 'lobby_host' : 'lobby_player'
  }

  if (state === 'GAME_OVER') return 'game_over'

  if (state === 'CATEGORY_PICK') {
    return meta.activeSinger === uid ? 'category_picker' : 'category_spectator'
  }

  if (state === 'SINGING' || state === 'VOTE_CLOSING' || state === 'POINT_AWARDED') {
    if (meta.activeSinger === uid) return 'singer'
    return 'voter'
  }

  if (state === 'BUZZER_OPEN' || state === 'WORD_REVEAL' || state === 'MUTED') {
    if (me?.muted) return 'muted_buzzer'
    return 'buzzer'
  }

  return 'loading'
}
