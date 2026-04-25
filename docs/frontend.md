# Frontend Architecture

The frontend is a single React 18 + Vite + TypeScript application served from Firebase Hosting. Both the TV display and the player phones use the same bundle, distinguished purely by route.

---

## Route Map

```
/                          NameScreen          Create or join a room
/join/:roomCode            NameScreen          Join pre-filled with room code (QR scan)
/play/:roomCode            PrivateRoute
                             └─ JoinScreen     Registers player, then renders:
                                  └─ PhoneGameView
/screen/:roomCode          TvGameView          TV display, no auth
/admin                     AdminRoute
                             └─ AdminApp       Admin panel (email-gated)
```

`src/App.tsx` owns the router. `PrivateRoute` and `AdminRoute` are auth guards.

---

## Authentication Flow

### Players (Anonymous Auth)

```
User visits /join/:roomCode or /
       │
       ▼
NameScreen — enters display name
       │
       ├─ "Create Room" path:
       │    createAnonymousUser(displayName) → auth.currentUser
       │    createRoom() Cloud Function → { roomCode }
       │    navigate to /screen/{roomCode}  (opens TV display)
       │    navigate to /play/{roomCode}    (phone view)
       │
       └─ "Join Room" path:
            createAnonymousUser(displayName) → auth.currentUser
            navigate to /play/{roomCode}
                  │
                  ▼
            JoinScreen (PrivateRoute passes through)
            registers player in RTDB → renders PhoneGameView
```

Players use Firebase Anonymous Auth. The `displayName` they enter in NameScreen becomes their in-game name and is set via `updateProfile(auth.currentUser, { displayName })`.

The player's name is persisted to `localStorage` (key: `ikto_player`) so returning to the same browser pre-fills the name field.

### Host Token Flow

When a host creates a room, the `createRoom` Cloud Function returns a `roomCode` and optionally emails a host link. The link is:

```
https://iknowthisone.jagger.dev/play/{roomCode}?hostToken={token}
```

When `JoinScreen` mounts and detects a `hostToken` query parameter, it calls `claimHost({ roomCode, hostToken })`. This sets `meta.hostId` in RTDB, granting the player host controls (start game, end game, etc.).

Without this flow, `meta.hostId` is set automatically by `onPlayerJoin` (via RTDB transaction) to the first player who joins — a fallback for games created and joined on the same device.

### Admins (Google OAuth)

```
User visits /admin
       │
       ▼
AdminRoute — calls onAuthStateChanged
       │
       ├─ Not signed in → shows "Sign in with Google" button
       │    signInWithPopup(auth, googleProvider)
       │    onAuthStateChanged fires again with Google user
       │
       ├─ Signed in but email not in ALLOWLIST → "Access Denied"
       │
       └─ Signed in, email verified, in ALLOWLIST → renders AdminApp
```

---

## Phone Game View

`PhoneGameView` is the root component for all phone screens during a game. It:

1. Subscribes to `useGameState(roomCode)` for live RTDB data
2. Subscribes to `usePresence(roomCode, uid)` for connection management
3. Calls `usePlayerRole(uid, meta, players)` to determine which screen to render
4. Renders a sticky `PhoneTopBar` (player name, score, identity colour) above the screen

### Screen Routing

```
PlayerRole           Component
──────────────────   ─────────────────────────
loading              (spinner)
lobby_host           LobbyScreen (with Start Game button)
lobby_player         LobbyScreen (waiting state)
buzzer               BuzzerScreen
muted_buzzer         BuzzerScreen (button disabled)
singer               SingerScreen
voter                VotingScreen
category_picker      CategoryPicker
category_spectator   CategorySpectatorScreen
game_over            GameOverScreen
```

`usePlayerRole` is a pure function — given the same `(uid, meta, players)` it always returns the same role. This is intentional: the role is entirely derived from server state, never stored locally.

### How `usePlayerRole` Works

The role derivation logic:

1. If `meta` is loading → `'loading'`
2. If `meta.state === 'LOBBY'` → host gets `'lobby_host'`, others `'lobby_player'`
3. If `meta.state === 'CATEGORY_PICK'` → winner (`meta.categoryChoice.chooserId`) gets `'category_picker'`, others `'category_spectator'`
4. If `meta.state` is `WORD_REVEAL` or `BUZZER_OPEN'` → muted players get `'muted_buzzer'`, others `'buzzer'`
5. If `meta.state === 'SINGING'` (or `VOTE_CLOSING'`) → `activeSinger` gets `'singer'`, others get `'voter'`
6. If `meta.state === 'POINT_AWARDED'` or `'MUTED'` → `activeSinger` gets `'singer'`, others get `'voter'` (see note on `POINT_AWARDED` screen)
7. If `meta.state === 'GAME_OVER'` → `'game_over'`

---

## TV Game View

`TvGameView` owns the 16:9 frame (`max-width: 960px`, `aspect-ratio: 16/9`) and routes to the correct TV screen based on `meta.state`. It also generates and displays a QR code pointing to the room's join URL.

### TV Screen Routing

```
GameState            TV Component
──────────────────   ────────────────
LOBBY                Lobby
CATEGORY_PICK        CategoryPickTV
WORD_REVEAL          WordReveal
BUZZER_OPEN          WordReveal       (same component, timer pill appears)
SINGING              Singing
VOTE_CLOSING         VoteClosing      (overlays Singing)
POINT_AWARDED        PointAwarded
MUTED                MutedFlash
GAME_OVER            GameOver
```

The 16:9 fixed-aspect frame is essential — the TV display is designed for a physical screen across a room. The frame prevents layout reflow at different browser window sizes and ensures the room code, word, and player grid are always legible from a distance.

---

## Key UI Components

### `PlayerBg`

The identity system's visual foundation. Every player-coloured surface in the app uses this component:

```
┌─────────────────────────┐
│  background: color      │  ← identity.color (solid)
│  ┌─────────────────┐    │
│  │  SVG pattern    │    │  ← CSS animation, opacity 0.28
│  │  (animated)     │    │
│  └─────────────────┘    │
│       {children}        │  ← content (name, score, checkmark...)
└─────────────────────────┘
```

12 patterns, each with its own animation class: triangles spin, dots pulse large, zigzag slides right, diamonds bob up, stars spin reverse, checks fade in/out, squiggles slide left, crosses pulse, stripes slide right, hexagons bob down, waves bob up, rings pulse.

### `PlayerGrid`

A fixed dark bar at the bottom of all active TV screens. Renders every connected player with their `PlayerBg` tile, name (first name only), and score. Disconnected players within a 2-minute window are shown greyed out. When `showVotes` is true (during `SINGING`), a checkmark appears on tiles of players who have voted. The `activeSinger` gets a gold border.

### `TimerPill`

A rounded pill showing `M:SS` countdown. Derives remaining time from `meta.wordDrawnAt` and `meta.timerDurationMs` on every second tick. Turns red and plays the `timerPulse` CSS animation when ≤30 seconds remain.

### `PhoneTopBar`

A sticky header on every phone screen showing the player's identity colour (via `PlayerBg`), name, and current score. The score updates live as votes resolve.

---

## Admin Panel

Accessed at `/admin`, restricted to the email allowlist.

### `GameList`

Real-time table of all active rooms, powered by `useAllRooms`. Each row shows:
- Room code
- State (colour-coded badge: grey for LOBBY, green for BUZZER_OPEN, yellow for SINGING, red for GAME_OVER, etc.)
- Connected player count
- Age (from `createdAt`)
- "End Game" button (calls `adminEndGame`)

`useAllRooms` subscribes to the entire `/rooms` path and filters/sorts client-side. This is acceptable at party scale (rooms are small, lifetimes are short).

### `WordEditor`

Two-panel editor:
- **Left panel:** category list with add/delete controls
- **Right panel:** word chips for the selected category with add/delete controls

All edits are local state until "Save to Database" is clicked, which calls `set(ref(db, 'adminConfig/words'), words)` — an atomic full replacement. "Reset to Defaults" overwrites RTDB with the static `words.json`.

### `Analytics`

Live table of per-word metrics. Reads from `/analytics/words` via `onValue`. Computes derived rates. Sortable by skip rate, timeout rate, or total plays. Words above 40% skip or timeout rate are highlighted red as candidates for removal from the word list.

---

## Design System

### CSS Custom Properties (`src/styles/tokens.css`)

```css
--font-display: 'Barlow Condensed', sans-serif  /* 900 weight, all headings/words */
--font-body:    'Barlow', sans-serif             /* 700–800 weight, UI text */
--bg:     #F4EFE6   /* cream */
--ink:    #141414   /* near-black */
--gold:   #FFD700   /* primary accent */
--danger: #EE2200   /* mute/fail red */
--border: 3px solid #141414
--shadow: 5px 5px 0 #141414   /* hard drop shadow, no blur */
```

The aesthetic is neo-brutalist: thick borders, hard drop shadows, no border radius on structural elements, cream/ink/gold palette. The look is intentionally game-show.

### Typography Scale

| Context | Font | Size | Weight |
|---|---|---|---|
| Word (TV) | Barlow Condensed | `clamp(70px, 15vw, 165px)` | 900 |
| Room code (TV) | Barlow Condensed | `clamp(60px, 11vw, 120px)` | 900 |
| Word (phone) | Barlow Condensed | `min(15vw, 80px)` | 900 |
| Player name (singer banner) | Barlow Condensed | `clamp(32px, 6vw, 72px)` | 900 |
| Button labels | Barlow | 18px | 800 |
| Status lines | Barlow | 11px, 3px letter-spacing, uppercase | 700 |

### Press Effects

Interactive buttons use a CSS `transform: scale(0.97)` on `:active:not(:disabled)` rather than JavaScript pointer handlers. Two classes are defined in `tokens.css`:
- `.buzz-btn` — the main buzzer button in `BuzzerScreen`
- `.vote-btn` — the point/fail buttons in `VotingScreen`

CSS-driven press effects handle pointer cancel and disabled states correctly without manual cleanup code.

### Word Reveal Animation

The word entry on the TV uses a CSS keyframe animation: `scale(0.5) → scale(1.05) → scale(1.0)` over ~400ms ease-out. This is triggered by the `WORD_REVEAL` state transition re-mounting the word element.

---

## Constants

`src/constants.ts` exports shared values used across multiple components:

```typescript
export const APP_URL = 'https://iknowthisone.jagger.dev'
```

Used by `Lobby.tsx` and `TvGameView.tsx` to generate join URLs and QR codes.
