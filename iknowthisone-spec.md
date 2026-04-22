# I Know This One — Game Specification

**Version:** 0.3  
**Date:** 2026-04-22  
**Status:** Draft

---

## 1. Overview

I Know This One is a browser-based party game for groups. A TV or computer monitor displays the main game screen. Each player joins from their phone using a short room code. A random word is revealed and players race to buzz in, sing a song containing that word, and earn votes from the group. First player to reach the point threshold wins.

---

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend (TV screen) | React + Vite | Component model suits multi-state game UI |
| Frontend (Phone client) | React + Vite (same app, different routes) | Single codebase, route-based views |
| Real-time state | Firebase Realtime Database | Sub-100ms latency, serverless, GCP-native, no WebSocket server to manage |
| Auth | Firebase Email/Password Auth | Players register with email + display name; persistent identity across sessions |
| Hosting | Firebase Hosting | Free tier generous; CDN-backed static delivery |
| Backend logic (timers, arbitration) | Firebase Cloud Functions (Node.js) | Enforces server-side timer authority; prevents client cheating |
| Word/category data | JSON bundled with app | No DB needed for static content |
| QR code generation | `qrcode` npm library (client-side) | Generates join QR on TV lobby screen; no server needed |
| Cost at low usage | ~$0/month | Firebase Spark plan covers typical party use; upgrade to Blaze only when Cloud Functions are added |

### Why Firebase over Cloud Run + WebSockets
Cloud Run requires a persistent WebSocket server process, billing per instance-hour, and more operational overhead. Firebase Realtime Database is purpose-built for low-latency state sync across many concurrent clients with no server to manage — exactly what a buzzer game needs.

---

## 3. Concurrent Games

The architecture supports unlimited simultaneous games with no additional infrastructure. Each game is isolated under `/rooms/{roomCode}/` in the RTDB. Cloud Functions are stateless and scoped to the `roomCode` in their trigger path — a Function handling a buzz in Room ABCD has no knowledge of Room WXYZ.

The one requirement for concurrent safety is **atomic room code generation**. A naive read-then-write could produce duplicate codes if two players create rooms at the same millisecond. This is prevented with a Firebase transaction:

```javascript
// Cloud Function: createRoom
const codeRef = db.ref(`rooms/${candidateCode}`);
await db.ref().transaction(root => {
  if (root?.rooms?.[candidateCode]) return; // abort — code taken
  root.rooms[candidateCode] = initialRoomState;
  return root;
});
```

If the transaction aborts (collision), the function retries with a new code. At 26⁴ = 456,976 possible 4-letter codes, collisions are negligible at party scale but the transaction guarantees correctness regardless.

---

## 4. Game Configuration (Defaults)

| Setting | Default | Configurable? |
|---|---|---|
| Points to win | 10 | Yes — host sets before game starts |
| Word timer | 120 seconds | No |
| Post-50%-vote close window | 30 seconds | No |
| Category countdown display | 5 seconds | No |
| Minimum players to start | 2 | No (host decides when to start) |
| Maximum players | Unlimited | N/A |

---

## 5. Game State Machine

States are stored in Firebase and drive all client views.

```
LOBBY
  └─► CATEGORY_PICK       (triggered after a point is scored; skip on first word)
        └─► WORD_REVEAL
              └─► BUZZER_OPEN       (2-min main timer running)
                    └─► SINGING     (timer paused; voting open)
                          ├─► VOTE_CLOSING   (≥50% voted; 30-sec window)
                          │     ├─► POINT_AWARDED  ──► CATEGORY_PICK
                          │     └─► MUTED           ──► BUZZER_OPEN (timer restarts)
                          └─► (timer expires with no buzz) ──► WORD_REVEAL (new word drawn)
```

### State Definitions

**LOBBY**  
Players join using the room code. Names are entered. The host's phone shows a "Start Game" button once at least 2 players are present. All phones show a waiting screen with player list.

**CATEGORY_PICK**  
Triggered after every point scored. The point-scorer's phone shows 4 category buttons. The TV shows the scorer's name and 4 category tiles. A 5-second countdown begins the moment the scorer taps their choice. The TV highlights the chosen category and counts down. Other players see the TV reflect the choice in real time.

**WORD_REVEAL**  
A random word is drawn from the selected category and displayed large on the TV. Phones show the word and a "BUZZ IN" button. Main 2-minute timer starts.

**BUZZER_OPEN**  
Timer counting down on TV. Any unbuzzed, unmuted player can buzz in. First buzz wins.

**SINGING**  
Timer pauses. Singer's name shown prominently on TV. All other players' phones show two buttons: ✅ Point and 🔇 Mute. Singer's phone shows "You're singing!" with the word displayed. TV shows player list with ✅ as each player submits a vote (not revealing which way they voted).

**VOTE_CLOSING**  
Triggered when ≥50% of eligible voters have voted. A 30-second countdown appears on TV and all phones. Remaining voters can still vote.

**POINT_AWARDED**  
Majority of votes (or tie) went to Point. Singer earns `+wordPointValue` points (minimum 1; increases by 1 for each mute on this word). Scoreboard updates on TV. Singer's phone transitions to CATEGORY_PICK flow.

**MUTED**  
Majority voted Mute. Singer is muted for the remainder of the current word (cannot buzz in again for this word). Their phone shows a "You've been muted" state. `wordMuteCount` increments by 1 and `wordPointValue` increases by 1 — the word is now worth more. Main timer restarts from 120 seconds. All non-muted players' phones re-show the BUZZ IN button. TV briefly displays the new point value ("This word is now worth 2 points!").

> A player accumulates mutes across rounds. Each mute only applies to the current word — they are cleared at WORD_REVEAL.

---

## 6. Firebase Realtime Database Schema

```json
/rooms/{roomCode}/
  meta:
    createdAt: timestamp
    hostId: uid                    // First player to create the room
    pointsToWin: 10
    state: "LOBBY"                 // Current game state (enum)
    currentWord: "LOVE"
    currentCategory: "Emotions"
    activeSinger: uid | null
    wordDrawnAt: timestamp | null  // Server timestamp for timer calculation
    singingStartedAt: timestamp | null
    voteCloseTriggeredAt: timestamp | null
    wordMuteCount: 0               // Number of mutes on the current word; resets on new word
    wordPointValue: 1              // Current point value = 1 + wordMuteCount

  players/{uid}:
    name: "Rob"
    score: 0
    muted: false                   // Muted for current word only
    hasVoted: false                // Whether they voted this round
    connected: true                // Firebase presence

  votes/{uid}:                     // Keyed by voter uid; written once per round
    value: "point" | "mute"
    votedAt: timestamp

  categoryChoice:                  // Written by point-scorer during CATEGORY_PICK
    chooserId: uid
    options: ["Animals", "80s Music", "Emotions", "Food"]
    chosen: null | "Emotions"
    chosenAt: timestamp | null
```

> Votes are **not** readable by clients directly — a Cloud Function aggregates and resolves them. This enforces anonymous voting while allowing the ✅ presence indicator (keyed on `hasVoted`, not vote value).

---

## 7. Client Views

### 7.1 TV / Main Screen (`/screen/:roomCode`)

| Game State | Display |
|---|---|
| LOBBY | Room code (large), QR code linking to `https://iknowthisone.web.app/join/{roomCode}` (pre-fills room code on scan), scrolling player join list |
| CATEGORY_PICK | "Scoring player's name is picking a category…" + 4 tiles, chosen tile highlights + 5-sec countdown |
| WORD_REVEAL | Category label, word (large), 2-min countdown timer |
| BUZZER_OPEN | Word, ticking timer |
| SINGING | Word, singer name ("🎤 Rob is singing!"), player grid with ✅ as votes arrive |
| VOTE_CLOSING | Same as SINGING + 30-sec closing timer overlay |
| POINT_AWARDED | Confetti-style flash, "+1 Rob", updated scoreboard |
| MUTED | "Muted! Timer restarting…", muted player name shown |
| GAME_OVER | Winner announcement, final scoreboard, rematch button |

### 7.2 Phone — Auth & Lobby (`/login` → `/join` → `/play/:roomCode`)

- **Login screen:** Email address + password fields. "Create account" link for new users (email + display name + password). Firebase Email/Password Auth.
- After login, player enters a room code manually or scans the QR code on the TV — scanning opens `https://iknowthisone.web.app/join/{roomCode}` with the code pre-filled so no typing is needed
- **QR auth redirect:** If a player scans the QR before they have an account, the room code is preserved in the URL (e.g. `/login?redirect=/join/ABCD`). After login or registration completes, the app reads the `redirect` param and routes them directly into the room — they are never dropped at a home screen. This must be handled in the `/join/:roomCode` route guard and the post-auth redirect logic.
- Waiting room: player list (display names), "Waiting for host to start…"
- Host sees "Start Game" button (sends `state = WORD_REVEAL` transition)

### 7.3 Phone — Buzzer (`BUZZER_OPEN` state)

- Word displayed
- Large "🎤 BUZZ IN" button (disabled if player is muted this word)
- Muted players see "You are muted this round" with the word still visible

### 7.4 Phone — Voting (`SINGING` / `VOTE_CLOSING` state)

- Word displayed
- Singer's name displayed
- Two large buttons: ✅ **Point** and 🔇 **Mute**
- After voting: buttons grey out, confirmation shown ("Vote submitted"), timer visible during VOTE_CLOSING
- Muted players see the same voting screen — they can vote, they just can't buzz in

### 7.5 Phone — Singing (`SINGING` state, for the active singer)

- Word displayed large
- "You're up! Sing a song with this word."
- Live count: "X of Y players have voted" (no vote values shown)

### 7.6 Phone — Category Picker (`CATEGORY_PICK` state, for point-scorer)

- "You scored! Pick the next category:"
- 4 large tappable category buttons
- Once tapped: confirmed view, 5-sec countdown shown

### 7.7 Phone — Spectator during Category Pick (everyone else)

- "Rob is picking the next category…"
- Shows the 4 options greyed out; chosen category highlights when picked

---

## 8. UI Design

### 8.1 Aesthetic Direction

**Neo-brutalist game show.** Warm cream background, near-black ink, hard drop shadows, no border-radius softness — every element is bolted to the page like a sticker. The typography is Barlow Condensed at maximum weight, all-caps, tracking wide. Gold (`#FFD700`) is the only accent on the global chrome; player color identities supply all other color.

The design is intentionally loud and physical. Borders are thick. Shadows are hard offsets, not blurs. The word should feel like it was stamped onto the screen.

### 8.2 Design Tokens

```css
/* Typography */
--font-display: 'Barlow Condensed', sans-serif;   /* 900 weight — word reveals, room codes, scores */
--font-body:    'Barlow', sans-serif;              /* 400/600/800 — instructions, labels, player names */

/* Palette */
--bg:     #F4EFE6;   /* Warm cream — global background */
--ink:    #141414;   /* Near-black — borders, text, shadows */
--gold:   #FFD700;   /* Primary accent — nav bar, category chips, CTA highlight */
--danger: #EE2200;   /* Timer urgent state */
--white:  #FFFFFF;

/* Borders & shadows */
--border: 3px solid #141414;
--r:      12px;
--shadow: 5px 5px 0 #141414;    /* Hard offset — used on cards, buttons, TV frame */
```

### 8.3 Player Color Identity System

Each player is assigned a color identity on join (first-come, first-served from the list below). The identity consists of a primary color, a darker shade for pattern strokes, and an animated SVG pattern. This replaces avatars — every surface belonging to a player (lobby chip, player grid cell, phone header) is rendered as a `PlayerBg` with their identity.

```javascript
const PLAYER_IDENTITIES = [
  { color: "#FF2D78", shade: "#CC0050", pattern: "triangles",  label: "Pink"    },
  { color: "#0066FF", shade: "#0040BB", pattern: "dots",       label: "Blue"    },
  { color: "#00BB44", shade: "#008830", pattern: "zigzag",     label: "Green"   },
  { color: "#FF6600", shade: "#CC4400", pattern: "diamonds",   label: "Orange"  },
  { color: "#9900FF", shade: "#6600CC", pattern: "stars",      label: "Purple"  },
  { color: "#00AAAA", shade: "#007777", pattern: "checks",     label: "Teal"    },
  { color: "#DDAA00", shade: "#AA7700", pattern: "squiggles",  label: "Yellow"  },
  { color: "#EE2200", shade: "#BB1100", pattern: "crosses",    label: "Red"     },
  { color: "#00AAFF", shade: "#0077CC", pattern: "stripes",    label: "Cyan"    },
  { color: "#DD00AA", shade: "#AA0077", pattern: "hexagons",   label: "Magenta" },
  { color: "#55BB00", shade: "#338800", pattern: "waves",      label: "Lime"    },
  { color: "#FF8800", shade: "#CC5500", pattern: "rings",      label: "Amber"   },
];
```

Patterns are animated SVG overlays (spinning, pulsing, sliding) rendered at ~28% opacity on the shade color. The `PlayerBg` wrapper component handles this: colored `div` background → SVG pattern layer → `z-index: 1` content on top.

The identity index is stored in `players/{uid}/identityIndex` and assigned by the Cloud Function at join time, cycling through the list in join order.

### 8.4 TV Screen Design

The TV screen is a 16:9 frame (`max-width: 960px`, `aspect-ratio: 16/9`) with a 4px ink border and `8px 8px 0 #141414` hard shadow.

**Layout principles:**
- Cream background everywhere — contrast comes from ink borders and player color, not a dark background.
- The current word is always the biggest element on screen, readable from across the room.
- Player grid sits at the bottom of the frame in a dark (`#141414`) gutter — consistent across all active-game states.
- Timer is ink-bordered pill, turns `--danger` red and pulses under 30 seconds.

**State-specific treatments:**

| State | Visual treatment |
|---|---|
| LOBBY | Left panel: room code in Barlow Condensed 900 at `~11vw`, letter-spacing wide. Right panel: scrollable player chips (each a `PlayerBg` with name + initial), QR code at bottom. |
| WORD_REVEAL | Category shown in gold chip above. Word slams in with `scale(0.5→1.05→1.0)`, 400ms ease-out. Timer pill below. |
| BUZZER_OPEN | Word stays large center. Timer ticks. Player grid shows all eligible players. Under 30s: timer goes red + pulses. |
| SINGING | Word in upper third. Singer name center in large Barlow Condensed with their `PlayerBg` color behind it. Player grid below shows ✅ as votes land. |
| VOTE_CLOSING | Same as SINGING + 30-sec countdown ring overlay on singer panel. |
| POINT_AWARDED | Full-bleed flash of singer's player color, 100ms hold → fade. "+N [Name]" in massive type. Scoreboard update. |
| MUTED | Full-bleed flash of `--danger` red. 🔇 large. "Worth X points now." Timer restart. |
| GAME_OVER | Winner's `PlayerBg` as full background. Winner name fills screen. Final scoreboard as ink-bordered card. |

### 8.5 Phone Screen Design

The phone uses the same cream + ink + gold tokens as the TV. It is **single-action-per-screen**.

**Layout:**
- Full-bleed cream background, sticky top bar in player's identity color (their `PlayerBg`).
- Status line (what's happening) at top in small caps, letter-spaced.
- Primary action in the bottom 35% — thumb zone.

**Button treatments:**

| Button | Style |
|---|---|
| BUZZ IN | Full-width, tall (80px+), gold background (`#FFD700`), ink border, `--shadow`. Scale 0.97 on press. |
| ✅ Point | Half-width, `#00BB44` background, ink border, `--shadow`. |
| 🔇 Mute | Half-width, `#EE2200` background, ink border, `--shadow`. |
| Category tiles | 2×2 grid, cream background, ink border. Tapped tile: gold background + `--shadow`. |
| Start Game (host) | Full-width, gold, ink border, `--shadow`. |
| Disabled / muted | Greyed out (`#ccc` background, `#999` text), no shadow, no press effect. |

After voting both buttons replace with "Vote submitted ✓" in ink on cream — no color change, just confirmation text.

### 8.6 Animated Pattern Keyframes

All pattern animations are CSS keyframes. Required set:

```css
@keyframes spin       { to { transform: rotate(360deg); } }
@keyframes spinR      { to { transform: rotate(-360deg); } }
@keyframes pulseBig   { from { transform: scale(0.75); } to { transform: scale(1.15); } }
@keyframes slideRight { from { transform: translateX(-24px); } to { transform: translateX(24px); } }
@keyframes slideLeft  { from { transform: translateX(24px); } to { transform: translateX(-24px); } }
@keyframes bobUp      { from { transform: translateY(12px); } to { transform: translateY(-12px); } }
@keyframes bobDown    { from { transform: translateY(-12px); } to { transform: translateY(12px); } }
@keyframes fadeCheck  { from { opacity: 0.04; } to { opacity: 0.22; } }
```

### 8.7 Typography Scale

| Element | Font | Size | Weight |
|---|---|---|---|
| Word (TV) | Barlow Condensed | `clamp(70px, 15vw, 165px)` | 900 |
| Room code (TV) | Barlow Condensed | `clamp(60px, 11vw, 120px)` | 900 |
| Singer name (TV) | Barlow Condensed | `8vw` | 900 |
| Timer (TV) | Barlow Condensed | `clamp(28px, 5vw, 54px)` | 900 |
| Category chip | Barlow | `12px` | 800, letter-spacing 3px |
| Player names (TV grid) | Barlow | `~12px` | 800 |
| Word (phone) | Barlow Condensed | `15vw` | 900 |
| Button label (phone) | Barlow | `18px` | 800 |
| Status line (phone) | Barlow | `11px` | 700, letter-spacing 3px, uppercase |

---

## 9. Round Flow (Step by Step)

1. Host taps **Start Game** → `state = WORD_REVEAL`, first word drawn from default category
2. Word shown on TV, 2-min timer starts (`wordDrawnAt = serverTimestamp()`)
3. A player taps **Buzz In** → `activeSinger = uid`, `singingStartedAt = serverTimestamp()`, `state = SINGING`
4. All other phones switch to voting view; TV shows singer name + vote progress
5. As votes arrive, `hasVoted` flags update; ✅ appears next to voter names on TV
6. Cloud Function monitors vote count:
   - When `votedCount / eligibleVoters >= 0.5` → set `voteCloseTriggeredAt`, `state = VOTE_CLOSING`
7. After 30 seconds OR all players voted (whichever first), Cloud Function tallies:
   - **Point votes > Mute votes** (or tie) → `state = POINT_AWARDED`, singer score += `wordPointValue`
   - **Mute votes > Point votes** → singer `muted = true`, `wordMuteCount += 1`, `wordPointValue += 1`, `state = MUTED`, timer restarts
8. **If POINT_AWARDED:** Cloud Function sets `state = CATEGORY_PICK`, generates 4 random category options
9. Point-scorer picks category → 5-sec countdown → `state = WORD_REVEAL`, new word drawn from chosen category
10. **If MUTED:** `state = BUZZER_OPEN`, `wordDrawnAt` reset to now (fresh 2-min timer), votes cleared
11. **If timer expires (2 min, no buzz):** Cloud Function draws new word, resets timer, stays in `BUZZER_OPEN`
12. **If any player hits `pointsToWin`:** `state = GAME_OVER`

---

## 10. Server-Side Timer Arbitration (Cloud Functions)

Client-side timers are display-only. All authoritative time checks run in Cloud Functions triggered by database writes.

| Function | Trigger | Action |
|---|---|---|
| `onBuzzIn` | `activeSinger` written | Pause timer, open voting, clear previous votes |
| `onVoteWritten` | `/votes/{uid}` written | Check if ≥50% threshold met; if so set VOTE_CLOSING + timestamp |
| `onVoteClose` (scheduled) | 30s after `voteCloseTriggeredAt` | Tally votes, resolve POINT or MUTE, update scores |
| `onWordTimer` (scheduled) | 120s after `wordDrawnAt` with no buzz | Draw new word, reset timer |
| `onGameStateChange` | `state` written | Orchestrate transitions (clear votes, assign categories, check win condition) |

Scheduled functions use Firebase's `setTimeout`-style Cloud Task pattern (enqueue a task at a future timestamp) rather than polling.

---

## 11. Word & Category Data

Bundled as a static JSON file in the app. No database needed. See `words.json` for the full word list.

Words must be single dictionary words (no phrases). Minimum 20 words per category recommended before launch. When a category is exhausted mid-session, reshuffle and redraw from that category.

---

## 12. Presence & Reconnection

Firebase Realtime Database's built-in `.info/connected` presence is used to track active connections. When a player disconnects:

- Their `connected` flag is set to `false` via an `onDisconnect` handler
- They are excluded from eligible voter count while disconnected
- They can rejoin using the same room code — their Firebase Auth UID is stable across sessions so their score and name are automatically restored on reconnect

If the player who was singing disconnects mid-vote, their turn is forfeit — voting closes immediately and Mute is applied by default (no point awarded to a disconnected player).

---

## 13. Rematch & Restart Flow

**Rematch (all players):** After GAME_OVER, any player can tap **Rematch**. When all connected players have tapped Rematch (or a 30-second timeout passes and majority have), the room resets:

- Scores zeroed
- State → LOBBY
- Room code is preserved
- The player who originally started the game retains host status (identified by `hostId` in `meta`)

**Host solo restart:** If no rematch vote is started within 60 seconds of GAME_OVER, the host's phone shows a **Restart Game** button. Tapping it resets the room to LOBBY state regardless of whether other players have acted. This allows the host to reset from the TV/computer without needing all players to participate.

---

## 14. Project Structure

```
iknowthisone/
  firebase.json
  database.rules.json       // RTDB security rules
  functions/
    index.js                // All Cloud Functions
    package.json
  src/
    main.jsx
    firebase.js             // Firebase init + exports
    data/
      words.json
    components/
      tv/
        Lobby.jsx
        WordReveal.jsx
        Singing.jsx
        VoteClosing.jsx
        Scoreboard.jsx
        GameOver.jsx
      phone/
        LoginScreen.jsx
        RegisterScreen.jsx
        JoinScreen.jsx
        BuzzerScreen.jsx
        VotingScreen.jsx
        SingerScreen.jsx
        CategoryPicker.jsx
        MutedScreen.jsx
    hooks/
      useGameState.js       // Firebase RTDB listener
      usePlayerRole.js      // Derives current view from uid + game state
    utils/
      roomCode.js           // Atomic 4-letter code generator (Firebase transaction)
      wordDraw.js           // Category-aware word selection
      qrCode.js             // QR code generation helper (wraps qrcode library)
    styles/
      tokens.css            // Design tokens (CSS variables)
      global.css            // Base reset + font imports
```

---

## 15. Firebase Security Rules (RTDB)

Key principles:
- Players can only write to their own `/players/{uid}` node
- Only Cloud Functions (admin SDK) can write game state transitions
- Votes are write-once per player per round (enforced by rules + Cloud Function clearing)
- Room metadata is readable by all, writable only by Cloud Functions

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": true,
        "players": {
          "$uid": {
            ".write": "auth.uid === $uid"
          }
        },
        "votes": {
          "$uid": {
            ".write": "auth.uid === $uid && !data.exists()"
          }
        },
        "meta": {
          ".write": false
        },
        "categoryChoice": {
          ".write": "auth.uid === data.child('chooserId').val()"
        }
      }
    }
  }
}
```

---

## 16. Estimated GCP Cost

| Tier | Usage | Estimated Cost |
|---|---|---|
| Firebase Spark (free) | Up to 1GB RTDB storage, 10GB/month transfer, 125K Cloud Function invocations/month | $0/month |
| Firebase Blaze (pay-as-you-go) | Typical party session (10 players, 60 rounds): ~5,000 function invocations, ~50MB data | < $0.10/session |

Recommend starting on Spark. Upgrade to Blaze only when Cloud Functions are added (Functions require Blaze, but cost at party-game scale is negligible).

---

## 17. Open Questions / Future Scope

- **Content packs:** Seasonal or themed word packs (Halloween, Sports, Movies) as additional JSON bundles
- **Custom words:** Host ability to add their own words in the lobby
- **Profanity filter:** Optional toggle for family mode
- **Scoring variants:** Bonus points for fast buzzes, streak bonuses
- **Spectator mode:** Watch-only view for players who join after game starts
- **Persistent leaderboard:** Optional Firebase Firestore integration for cross-session scores
