# Architecture Overview

## System Topology

```
┌──────────────────────────────────────────────────────────────────┐
│  Client Layer                                                    │
│                                                                  │
│   TV Browser              Phone Browsers (N players)            │
│   ─────────               ──────────────────────────            │
│   /screen/:roomCode       /play/:roomCode                       │
│   Read-only listener      Read listener + targeted writes        │
│   No auth required        Firebase Anonymous Auth                │
└──────────────────────────┬─────────────────────────────────────┘
                           │ RTDB onValue() subscriptions
                           ▼
┌──────────────────────────────────────────────────────────────────┐
│  Firebase Realtime Database                                      │
│                                                                  │
│   /rooms/{roomCode}/                                             │
│     meta/          ← Cloud Functions write only                  │
│     players/       ← Players write name/connected fields         │
│     votes/         ← Players write once per round                │
│     buzzIn/        ← Players write once per round                │
│     skipVotes/     ← Players write once per word                 │
│     categoryChoice/← Picker writes chosen field                  │
│                                                                  │
│   /adminConfig/words/   ← Admin writes via WordEditor            │
│   /analytics/words/     ← Cloud Functions write                  │
└───────────────────┬──────────────────────────────────────────────┘
                    │ Database triggers (onCreate/onWrite)
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  Firebase Cloud Functions (Node.js, 2nd Gen)                     │
│                                                                  │
│   Callable (HTTPS):        RTDB Triggers:                        │
│   createRoom               onPlayerJoin                          │
│   claimHost                onBuzzIn                              │
│   startGame                onVoteWritten                         │
│   endGame / restartGame    onCategoryChosen                      │
│   adminEndGame             onSingerDisconnect                    │
│                            onSkipVote                            │
│                            onRematchVote                         │
│                            onGameStateChange                     │
│                                                                  │
│   Cloud Task endpoints:    Scheduled:                            │
│   wordTimerTask            scheduledCleanup (every 6h)           │
│   voteCloseTask                                                  │
│   pointAwardedTask                                               │
│   mutedTransitionTask                                            │
│   allMutedTask                                                   │
│   categoryRevealTask                                             │
│   inactivityTask                                                 │
│   cleanupTask                                                    │
└───────────────────┬──────────────────────────────────────────────┘
                    │ enqueueTask()
                    ▼
┌──────────────────────────────────────────────────────────────────┐
│  Google Cloud Tasks  (queue: game-timers)                        │
│                                                                  │
│  Schedules future HTTP calls back into Cloud Functions.          │
│  All task endpoints verify X-Tasks-Secret header.               │
│  Cloud Tasks retries on failure — functions implement            │
│  idempotency guards to handle duplicate executions.             │
└──────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 18 + Vite + TypeScript | SPA, fast HMR, type safety |
| Realtime state | Firebase Realtime Database (RTDB) | Push-based; clients subscribe, no polling |
| Auth | Firebase Anonymous Auth (players) + Google OAuth (admins) | Zero-friction join for players |
| Hosting | Firebase Hosting | CDN-backed, instant cache invalidation |
| Backend | Firebase Cloud Functions v2 (Node.js 20) | Triggered by RTDB writes; no always-on server |
| Timers | Google Cloud Tasks | Reliable delayed execution with retries |
| Email | Resend | Host link delivery with hostToken |
| QR codes | `qrcode` npm library | Client-side, no external service |

---

## Fundamental Design Principles

### 1. Server-Authoritative State

The game state machine lives entirely in Cloud Functions. Clients **never** write to `meta/`. Every state transition (e.g., `BUZZER_OPEN → SINGING`) is performed by a Cloud Function that:

1. Validates the preconditions (correct state, correct actor)
2. Writes the new state atomically
3. Enqueues any necessary follow-up tasks

This means a client with a broken connection, a slow phone, or a malicious script cannot advance the game state.

### 2. Reactive UI

Both the TV and phone UIs are entirely reactive — they subscribe to the RTDB room node and re-render whenever it changes. There are no local state machines in the frontend; the component tree is a pure function of `(state, players, uid)`.

### 3. Idempotent Cloud Tasks

Cloud Tasks guarantees at-least-once delivery. Every task handler checks whether it is still relevant before acting (e.g., "is state still `BUZZER_OPEN`? Does `wordDrawnAt` still match?") and silently no-ops if the condition has already been superseded. This means retries are harmless.

### 4. Two Routes, One App

The same React bundle serves both the TV display (`/screen/:roomCode`) and the phone game (`/play/:roomCode`). There is no separate app or native client. Route-based splitting keeps deployment simple and the codebase unified.

---

## Room Lifecycle

```
createRoom() called
       │
       ▼
Room node created in RTDB
state = LOBBY
       │
       ├─ Players join (/play/:roomCode)
       │   Each write triggers onPlayerJoin
       │
       ▼
startGame() called by host
       │
       ▼
Word drawn, state = WORD_REVEAL → BUZZER_OPEN
wordTimerTask enqueued (120s)
       │
       └─ Game loop runs (see State Machine doc)
              │
              ▼
        state = GAME_OVER
              │
              ├─ Rematch: all players vote → back to LOBBY
              │
              └─ No rematch: room sits in GAME_OVER
                     │
                     ▼  (2h later via scheduledCleanup)
              Room node deleted
```

---

## Word Data Pipeline

Words are stored as a `Record<category, string[]>` in two places:

1. **`src/data/words.json`** — static fallback bundled with the app
2. **`adminConfig/words` in RTDB** — live override, editable via the admin panel

At runtime, Cloud Functions call `getActiveWords()` which reads from RTDB first and falls back to the static JSON. This means an admin can add, remove, or edit words without a code deploy. The static file is the "factory default."

Analytics for each word (buzz time, skip rate, timeout rate) accumulate at `/analytics/words/{encodedCategory}/{encodedWord}/` and are displayed in the admin panel.

---

## Deployment

```bash
npm run build                 # Build React frontend → dist/
firebase deploy               # Deploys: hosting + functions + database rules
firebase deploy --only hosting    # Frontend only
firebase deploy --only functions  # Functions only
firebase deploy --only database   # Rules only
```

Secrets (`TASKS_SECRET`, `RESEND_API_KEY`) are stored in Firebase Secret Manager and accessed via `defineSecret()`. They are never in source code or environment files.
