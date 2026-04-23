# I Know This One

A browser-based party game. A TV screen shows the game state; players join from their phones using a room code. Players race to buzz in, sing a song containing the revealed word, and earn votes. First to the point threshold wins.

**Live:** https://iknowthisone.jagger.dev

---

## How to Play

1. Open the game on a TV/laptop browser → **Create a Room** → share the screen (or scan the QR code)
2. Players open the game on their phones and enter the room code
3. The host (first player to join) taps **Start Game**
4. A word is revealed — first to buzz in sings a song containing that word
5. Everyone else votes: **Point** (they did it) or **Mute** (they didn't)
6. Reach the point threshold to win

---

## Architecture

```
Browser (TV)          Firebase RTDB              Cloud Functions
─────────────    ←──  /rooms/{code}/meta  ←───   Server-side timers
                ←──  /rooms/{code}/players       Vote arbitration
                ←──  /rooms/{code}/votes         State transitions
                ←──  /rooms/{code}/buzzIn
                ←──  /rooms/{code}/skipVotes

Browser (Phone)  ───► /rooms/{code}/buzzIn       onBuzzIn trigger
                ───► /rooms/{code}/votes         onVoteWritten trigger
                ───► /rooms/{code}/skipVotes     onSkipVote trigger
```

### Game State Machine

```
LOBBY → CATEGORY_PICK → BUZZER_OPEN → SINGING → VOTE_CLOSING
                              ↑              ├── POINT_AWARDED → CATEGORY_PICK
                              │              └── MUTED ──────────────┘
                        Timer expires             (resume timer or all-muted penalty)
                        → new word                
                        5x no buzz → GAME_OVER
```

**All state transitions are authoritative server-side** (Cloud Functions). Client timers are display-only.

### Key Cloud Functions

| Function | Trigger | What it does |
|---|---|---|
| `createRoom` | HTTP callable | Atomic room creation via RTDB transaction |
| `startGame` | HTTP callable | Host-only; draws first word, starts 120s timer |
| `onBuzzIn` | RTDB write | Pauses timer, stores remaining time, opens voting |
| `onVoteWritten` | RTDB write | Closes voting when ≥50% or all have voted |
| `voteCloseTask` | Cloud Task | Tallies votes → POINT_AWARDED or MUTED |
| `wordTimerTask` | Cloud Task | No buzz = draw new word; 5× = GAME_OVER |
| `onSkipVote` | RTDB write | All-player consensus → jump timer to 15s |
| `endGame` | HTTP callable | Host-only emergency end |
| `inactivityTask` | Cloud Task | 30min idle → GAME_OVER |
| `cleanupTask` | Cloud Task | 60min idle → delete room |

### RTDB Structure

```
/rooms/{roomCode}/
  meta/                    Game state, current word, timers, scores metadata
  players/{uid}/           name, score, muted, hasVoted, connected, identityIndex
  votes/{uid}/             value ("point"|"mute") — write-once, CF-only read
  buzzIn/{uid}/            Set to true when player buzzes in
  skipVotes/{uid}/         Set to true when player votes to skip word
  categoryChoice/          chooserId, options[], chosen
```

### Tech Stack

- **Frontend:** React 18 + TypeScript + Vite
- **Realtime state:** Firebase Realtime Database
- **Auth:** Firebase Anonymous Auth (display name set on join)
- **Hosting:** Firebase Hosting at `iknowthisone.jagger.dev`
- **Functions:** Firebase Cloud Functions v2 (Node 20, `us-central1`)
- **Task scheduling:** Google Cloud Tasks queue `game-timers`
- **QR codes:** `qrcode` npm library (client-side)

---

## Local Development

### Prerequisites

- Node 20+
- Firebase CLI: `npm install -g firebase-tools`
- Google Cloud SDK (for Cloud Tasks emulation)

### Setup

```bash
git clone https://github.com/jagger/iknowthisone.git
cd iknowthisone
npm install
cd functions && npm install && cd ..
```

Copy `.env.example` to `.env` (or set Firebase config in `src/firebase.ts`).

```bash
# Start the Vite dev server
npm run dev

# In another terminal: run Firebase emulators
firebase emulators:start

# Functions only
cd functions && npm run serve
```

The app runs at `http://localhost:5173`. The TV view is at `/screen/:roomCode`, phone view at `/play/:roomCode`.

### Build & Deploy

```bash
npm run build                                    # Build frontend
cd functions && npm run build && cd ..          # Build functions
firebase deploy                                  # Deploy everything
firebase deploy --only functions,hosting        # Deploy subset
firebase deploy --only database                 # Deploy DB rules only
```

### Word Categories

Words live in `src/data/words.json` (also copied to `functions/src/words.json` — keep in sync). Each category is an array of single words. Categories are randomly offered to the winner to pick at the start of each round.

---

## Infrastructure Notes

- **Cloud Tasks queue** must exist before deploying functions:
  ```
  gcloud tasks queues create game-timers --location=us-central1
  ```
- **Firebase Blaze plan** required (Cloud Functions needs billing enabled)
- **Database security rules** in `database.rules.json` — votes are write-once and not readable by clients
- **Custom domain** configured in Firebase Hosting console pointing `iknowthisone.jagger.dev` to Firebase

---

## TODO

See [TODO.md](TODO.md) for pending work items.
