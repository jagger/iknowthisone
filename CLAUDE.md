# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**I Know This One** — a browser-based party game. A TV screen shows the game state; players join from their phones using a 4-letter room code. Players race to buzz in, sing a song containing the revealed word, and earn votes. First to the point threshold wins.

The spec lives in `iknowthisone-spec.md`. The project has not been scaffolded yet.

---

## Tech Stack

- **Frontend:** React + Vite (single app, route-based TV vs. phone views)
- **Realtime state:** Firebase Realtime Database (RTDB)
- **Auth:** Firebase Email/Password
- **Hosting:** Firebase Hosting
- **Backend logic:** Firebase Cloud Functions (Node.js) — timers and vote arbitration run server-side only
- **QR codes:** `qrcode` npm library (client-side)

## Commands (once scaffolded)

```bash
npm run dev         # Local dev server (Vite)
npm run build       # Production build
npm run preview     # Preview production build locally
firebase emulators:start   # Run Firebase emulators (RTDB + Functions + Auth)
cd functions && npm run serve   # Functions only
```

---

## Architecture

### Route / View Split

Both TV and phone are served from the same React app using different routes:

- `/screen/:roomCode` — TV display (16:9 locked frame, read-only, no auth required)
- `/login` — Firebase Auth login/register
- `/join/:roomCode` — Join a room (post-auth); accepts `?redirect=` param for QR scan flow
- `/play/:roomCode` — Phone game view (auth required)

The `/join` route guard and post-auth redirect logic must preserve the `roomCode` through login/register so QR scans don't drop users at a home screen.

### Game State Machine

States live in `/rooms/{roomCode}/meta/state` (Firebase RTDB) and drive all views:

```
LOBBY → CATEGORY_PICK → WORD_REVEAL → BUZZER_OPEN → SINGING → VOTE_CLOSING
                                                                    ├─► POINT_AWARDED → CATEGORY_PICK
                                                                    └─► MUTED → BUZZER_OPEN (timer reset)
Timer expires with no buzz → WORD_REVEAL (new word)
Any player hits pointsToWin → GAME_OVER
```

**Critical:** Client timers are display-only. All authoritative transitions are made by Cloud Functions.

### Cloud Functions (all in `functions/index.js`)

| Function | Trigger | Responsibility |
|---|---|---|
| `createRoom` | HTTP call | Atomic room creation via RTDB transaction (prevents duplicate codes) |
| `onBuzzIn` | `activeSinger` written | Pauses timer, opens voting, clears previous votes |
| `onVoteWritten` | `/votes/{uid}` written | Checks ≥50% threshold → sets `VOTE_CLOSING` |
| `onVoteClose` | Cloud Task (30s delay) | Tallies votes → `POINT_AWARDED` or `MUTED` |
| `onWordTimer` | Cloud Task (120s delay) | Draws new word if no buzz; resets timer |
| `onGameStateChange` | `state` written | Orchestrates: clears votes, assigns categories, checks win condition |

Scheduled functions use Cloud Tasks (enqueue at future timestamp), not polling.

### Key Hooks

- `useGameState(roomCode)` — subscribes to RTDB and returns live room state
- `usePlayerRole(uid, gameState)` — derives which phone view to render from uid + current state

### RTDB Schema (abbreviated)

```
/rooms/{roomCode}/
  meta/          — state, currentWord, activeSinger, timers, wordPointValue
  players/{uid}/ — name, score, muted, hasVoted, connected, identityIndex
  votes/{uid}/   — value ("point"|"mute"), votedAt  [write-once; hidden from clients]
  categoryChoice/ — chooserId, options[], chosen
```

Votes are **not** readable by clients — Cloud Functions aggregate them. Only `hasVoted` is exposed.

### Security Rules (`database.rules.json`)

- Players write only to their own `/players/{uid}`
- `/votes/{uid}` is write-once per player per round
- `/meta` and state transitions are Cloud Function (admin SDK) only
- `categoryChoice` writable only by the player whose uid matches `chooserId`

---

## UI Design System

**Aesthetic:** Neo-brutalist game show. Cream background, near-black ink, hard drop shadows, thick borders.

### Design Tokens (`src/styles/tokens.css`)

```css
--font-display: 'Barlow Condensed', sans-serif;  /* 900 weight */
--font-body:    'Barlow', sans-serif;
--bg:     #F4EFE6;
--ink:    #141414;
--gold:   #FFD700;
--danger: #EE2200;
--border: 3px solid #141414;
--r:      12px;
--shadow: 5px 5px 0 #141414;
```

### Player Identity System

Each player gets a color + SVG pattern assigned by the Cloud Function at join time (`identityIndex` in RTDB). The `PlayerBg` component renders: colored div → animated SVG pattern at ~28% opacity → content. Identity list is in the spec (12 colors × patterns). This replaces avatars on all player-facing surfaces.

### TV Screen

Fixed 16:9 frame (`max-width: 960px`, `aspect-ratio: 16/9`). The current word is always the dominant element. Player grid lives in a dark (`#141414`) gutter at the bottom, consistent across all active states. Timer pill turns `--danger` red and pulses under 30 seconds.

### Phone Screen

Single-action-per-screen. Player's identity color as sticky top bar. Primary action in bottom 35% (thumb zone). Buttons use hard `--shadow`, scale 0.97 on press. After voting, buttons replace with "Vote submitted ✓" text.

### Typography Scale

| Element | Font | Size | Weight |
|---|---|---|---|
| Word (TV) | Barlow Condensed | `clamp(70px, 15vw, 165px)` | 900 |
| Room code (TV) | Barlow Condensed | `clamp(60px, 11vw, 120px)` | 900 |
| Word (phone) | Barlow Condensed | `15vw` | 900 |
| Button label | Barlow | `18px` | 800 |
| Status line | Barlow | `11px` | 700, letter-spacing 3px, uppercase |

Word reveal animation: `scale(0.5 → 1.05 → 1.0)`, 400ms ease-out.

---

## Word Data

Static JSON at `src/data/words.json` — single dictionary words per category, minimum 20 per category. When a category is exhausted, reshuffle and redraw. No database needed for word storage.

---

## Deployment

Firebase Spark plan covers typical party use (no Cloud Functions). Upgrade to Blaze when adding Functions (required by Firebase). Cost at party scale is negligible (< $0.10/session).
