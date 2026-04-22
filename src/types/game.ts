export type GameState =
  | 'LOBBY'
  | 'CATEGORY_PICK'
  | 'WORD_REVEAL'
  | 'BUZZER_OPEN'
  | 'SINGING'
  | 'VOTE_CLOSING'
  | 'POINT_AWARDED'
  | 'MUTED'
  | 'GAME_OVER'

export interface RoomMeta {
  state: GameState
  currentWord: string
  currentCategory: string
  activeSinger: string | null
  wordDrawnAt: number | null
  singingStartedAt: number | null
  voteCloseTriggeredAt: number | null
  wordMuteCount: number
  wordPointValue: number
  pointsToWin: number
  hostId: string
  createdAt: number
  wordTimerTaskName?: string
  voteCloseTaskName?: string
  usedWords: Record<string, string[]>
}

export interface Player {
  name: string
  score: number
  muted: boolean
  hasVoted: boolean
  connected: boolean
  identityIndex: number
}

export interface CategoryChoice {
  chooserId: string
  options: string[]
  chosen: string | null
  chosenAt: number | null
}

export interface RoomData {
  meta: RoomMeta
  players: Record<string, Player>
  categoryChoice?: CategoryChoice
}

export type PlayerRole =
  | 'lobby_host'
  | 'lobby_player'
  | 'buzzer'
  | 'muted_buzzer'
  | 'singer'
  | 'voter'
  | 'category_picker'
  | 'category_spectator'
  | 'game_over'
  | 'loading'

export interface PlayerIdentity {
  color: string
  shade: string
  pattern: PatternType
  label: string
}

export type PatternType =
  | 'triangles'
  | 'dots'
  | 'zigzag'
  | 'diamonds'
  | 'stars'
  | 'checks'
  | 'squiggles'
  | 'crosses'
  | 'stripes'
  | 'hexagons'
  | 'waves'
  | 'rings'

export const PLAYER_IDENTITIES: PlayerIdentity[] = [
  { color: '#FF2D78', shade: '#CC0050', pattern: 'triangles',  label: 'Pink'    },
  { color: '#0066FF', shade: '#0040BB', pattern: 'dots',       label: 'Blue'    },
  { color: '#00BB44', shade: '#008830', pattern: 'zigzag',     label: 'Green'   },
  { color: '#FF6600', shade: '#CC4400', pattern: 'diamonds',   label: 'Orange'  },
  { color: '#9900FF', shade: '#6600CC', pattern: 'stars',      label: 'Purple'  },
  { color: '#00AAAA', shade: '#007777', pattern: 'checks',     label: 'Teal'    },
  { color: '#DDAA00', shade: '#AA7700', pattern: 'squiggles',  label: 'Yellow'  },
  { color: '#EE2200', shade: '#BB1100', pattern: 'crosses',    label: 'Red'     },
  { color: '#00AAFF', shade: '#0077CC', pattern: 'stripes',    label: 'Cyan'    },
  { color: '#DD00AA', shade: '#AA0077', pattern: 'hexagons',   label: 'Magenta' },
  { color: '#55BB00', shade: '#338800', pattern: 'waves',      label: 'Lime'    },
  { color: '#FF8800', shade: '#CC5500', pattern: 'rings',      label: 'Amber'   },
]
