# Data Model

All live game data lives in Firebase Realtime Database (RTDB). The TypeScript types in `src/types/game.ts` are the canonical definitions; this document explains what each field means and when it changes.

---

## RTDB Schema

```
/
├── rooms/
│   └── {roomCode}/            e.g. "LOVE-3847"
│       ├── meta/              RoomMeta — game state, written by Cloud Functions only
│       ├── players/           Record<uid, Player>
│       │   └── {uid}/
│       ├── votes/             Record<uid, Vote> — write-once, hidden from clients
│       │   └── {uid}/
│       ├── buzzIn/            Record<uid, true> — cleared after each round
│       │   └── {uid}/
│       ├── categoryChoice/    CategoryChoice
│       ├── skipVotes/         Record<uid, true> — cleared after each word
│       │   └── {uid}/
│       └── rematchVotes/      Record<uid, true> — cleared on rematch
│           └── {uid}/
│
├── adminConfig/
│   └── words/                 Record<category, string[]>  — editable via admin panel
│
└── analytics/
    └── words/
        └── {encodedCategory}/
            └── {encodedWord}/   WordAnalytics
```

---

## `RoomMeta`

Written exclusively by Cloud Functions (admin SDK bypasses RTDB rules). Clients subscribe to this but cannot write it.

```typescript
interface RoomMeta {
  state: GameState            // Current state machine position
  currentWord: string         // The word players must sing
  currentCategory: string     // Category the word was drawn from
  activeSinger: string | null // uid of the player currently singing
  
  // Timestamps (Unix ms)
  wordDrawnAt: number | null          // When the current word was revealed
  singingStartedAt: number | null     // When the singer buzzed in
  voteCloseTriggeredAt: number | null // When voteCloseTask was enqueued
  createdAt: number                   // Room creation time

  // Scoring
  wordPointValue: number  // Points this word is currently worth (starts at 1, escalates)
  pointsToWin: number     // Score threshold to win (default: 10)
  wordMuteCount: number   // Times this word has muted a singer (same as pointValue - 1)

  // Host
  hostId: string | null   // uid of the room host

  // Word tracking
  usedWords: Record<string, string[]>  // Words already drawn per category this game

  // Timer state (used when resuming after a MUTED round)
  timerDurationMs?: number    // Full duration for this timer run (ms)
  timerRemainingMs?: number   // How much time was left when the word was muted

  // Cloud Task names (for cancellation)
  wordTimerTaskName?: string      // Name of the pending wordTimerTask
  voteCloseTaskName?: string      // Name of the pending voteCloseTask

  // Game-over metadata
  consecutiveNoBuzzCount?: number  // Increments when timer expires with no buzz
  gameOverReason?: string          // 'no_buzz' if nobody buzzed 5 times in a row

  // All-muted state
  allMutedPenalty?: number         // Point penalty applied when everyone is muted

  // Inactivity detection
  inactivityToken?: string         // Rotated on every state change; matched by inactivityTask
}
```

### Key field interactions

**`wordPointValue` and `wordMuteCount`** are always equal after `MUTED` transitions. `wordPointValue` starts at 1. Each time the word leads to a `MUTED` outcome, both increment by 1. When a singer finally gets the point, they receive `wordPointValue` points and both fields reset on the next word.

**`timerRemainingMs`** is the clock snapshot taken when `onBuzzIn` fires (i.e., when the word was successfully buzzed). It is used by `mutedTransitionTask` to resume the timer at the remaining time rather than restarting at 120 seconds. Minimum 15 seconds is enforced.

**`wordTimerTaskName` and `voteCloseTaskName`** are Cloud Tasks task names. Cloud Tasks supports cancellation by name if the task hasn't yet executed. These are stored so that `endGame()` and `onBuzzIn` can cancel a pending timer before it fires.

---

## `Player`

```typescript
interface Player {
  name: string           // Display name, set at join
  score: number          // Current point total
  muted: boolean         // Disqualified for this word (cannot buzz in)
  hasVoted: boolean      // Has submitted a vote this round
  connected: boolean     // Live presence flag
  identityIndex: number  // 0–11; indexes into PLAYER_IDENTITIES array
  disconnectedAt?: number // Unix ms of last disconnect (for display greyout window)
}
```

### Write permissions

| Field | Who writes it |
|---|---|
| `name` | Player (client), on join |
| `connected`, `disconnectedAt` | Player (client), via `usePresence` hook |
| `score`, `muted`, `hasVoted`, `identityIndex` | Cloud Functions only |

The RTDB rule sets `.write: false` at the `/players/{uid}` node level, then grants client write access only to the three specific leaf paths above. This means a client cannot `set()` the whole player node to inject arbitrary fields like `score` or `muted`.

### `identityIndex`

Assigned by `onPlayerJoin` using the formula:
```
identityIndex = existingPlayerCount % 12
```
This cycles through the 12 identities as players join, ensuring colours are distributed evenly in small games and repeat in large groups. The identity array (`PLAYER_IDENTITIES`) in `src/types/game.ts` maps indices to `{ color, shade, pattern, label }`.

---

## `Vote`

```typescript
interface Vote {
  value: 'point' | 'fail'
  votedAt: ServerTimestamp
}
```

Stored at `/rooms/{roomCode}/votes/{uid}`. The RTDB rule is write-once per uid per round (uses `!data.exists()` to prevent modification). The entire `/votes` path has `.read: false` — clients cannot read votes. Only Cloud Functions (admin SDK) count them.

Each player only ever knows their own vote was submitted (via the `hasVoted` flag set on their player record by `onVoteWritten`). Aggregate results are only revealed implicitly through the state transition.

---

## `CategoryChoice`

```typescript
interface CategoryChoice {
  chooserId: string       // uid of the player picking
  options: string[]       // 4 randomly selected categories
  chosen: string | null   // Written by picker; triggers onCategoryChosen
  chosenAt: number | null // Timestamp of the choice
}
```

`options` is an array of category strings. The RTDB rule for `categoryChoice/chosen` verifies both that the writer's uid matches `chooserId` AND that the written value exists in `options`. This prevents the picker from writing an arbitrary category not in the offered set.

`CategoryChoice` is reset to `null` at the start of every new word (cleared in `categoryRevealTask`).

---

## `PlayerIdentity`

```typescript
interface PlayerIdentity {
  color: string    // Vivid base colour (e.g. '#FF2D78')
  shade: string    // Darker variant for banners/shadows
  pattern: PatternType
  label: string    // Human name (e.g. 'Pink')
}
```

12 identities defined as a constant array in `src/types/game.ts`. Patterns are SVG overlays rendered by `PlayerBg` at ~28% opacity on top of the identity colour. Each pattern has its own CSS animation (spin, pulse, slide, bob) making each player's background subtly alive.

---

## `GameState` enum

```typescript
type GameState =
  | 'LOBBY'
  | 'CATEGORY_PICK'
  | 'WORD_REVEAL'
  | 'BUZZER_OPEN'
  | 'SINGING'
  | 'VOTE_CLOSING'
  | 'POINT_AWARDED'
  | 'MUTED'
  | 'GAME_OVER'
```

See the [State Machine document](./game-state-machine.md) for full transition logic.

---

## Analytics Schema

```
/analytics/words/{encodedCategory}/{encodedWord}/
  attempts:    number   // Total times this word appeared (BUZZER_OPEN)
  buzzes:      number   // Times a player buzzed in
  totalBuzzMs: number   // Sum of buzz response times (ms from wordDrawnAt to buzzIn)
  skips:       number   // Times skip consensus was reached
  timeouts:    number   // Times timer expired without a buzz
```

Keys are `encodeURIComponent(category)` and `encodeURIComponent(word)` to handle RTDB's restriction on special characters in paths.

**Derived metrics** (computed in the Analytics component):
- `skipRate = skips / attempts`
- `timeoutRate = timeouts / attempts`
- `avgBuzzSec = (totalBuzzMs / buzzes) / 1000`

Words with `skipRate > 0.4` or `timeoutRate > 0.4` are flagged red in the admin dashboard as candidates for removal.

---

## Admin Config Schema

```
/adminConfig/words/
  {category}: string[]   // e.g. "Animals": ["dog", "cat", "whale", ...]
```

This is the live word list. If it exists in RTDB, Cloud Functions use it exclusively. If it doesn't exist (or hasn't been saved via the admin panel), Cloud Functions fall back to `src/data/words.json`.

Read and write access is restricted to email-verified users on the admin allowlist (`jagger@oznog.org`, `cewhiney08@gmail.com`). Cloud Functions read via admin SDK, bypassing these rules entirely.

---

## Room Code Format

Room codes are 4 uppercase letters (e.g. `LMFP`, `TRQV`), excluding the characters `I` and `O` to avoid confusion with `1` and `0` on physical screens. Generated in `src/utils/roomCode.ts` using `Math.random()` and validated for uniqueness via an RTDB transaction in `createRoom`.
