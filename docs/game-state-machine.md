# Game State Machine

The game's authoritative state lives at `/rooms/{roomCode}/meta/state`. Every UI screen — on both TV and phone — is a pure rendering of this value combined with the players map. Clients never write to `state`; all transitions are made by Cloud Functions.

---

## State Diagram

```
                    ┌─────────┐
         createRoom │  LOBBY  │ startGame()
         ──────────►│         │──────────────────────────────┐
                    └─────────┘                              │
                                                             ▼
                    ┌─────────────┐    5s Cloud Task    ┌───────────┐
          ◄─────────│ CATEGORY_   │◄────────────────────│ CATEGORY_ │
          point     │   PICK      │   onCategoryChosen  │   PICK    │
          awarded,  └─────────────┘                     └─────────▲─┘
          no win                                                   │
             │                                           category  │
             │                                           picked    │
             │                                                     │
             │                5s Cloud Task                        │
             │     ┌─────────────────────────────────────┐        │
             │     │       categoryRevealTask             │        │
             │     ▼                                      │        │
             │  ┌─────────────┐                          │        │
             │  │ WORD_REVEAL │  (brief display state)    │        │
             │  └──────┬──────┘                          │        │
             │         │ immediately                      │        │
             │         ▼                                  │        │
             │  ┌─────────────┐   120s timer expires ──►WORD_REVEAL│
             │  │ BUZZER_OPEN │──────────────────────────(new word) │
             │  └──────┬──────┘                                    │
             │         │ player buzzes in                          │
             │         ▼                                           │
             │  ┌─────────────┐                                   │
             │  │   SINGING   │◄──────────────────────────────────┘
             │  └──────┬──────┘  (no, wrong state branch above)
             │         │ ≥50% vote OR all voted
             │         ▼
             │  ┌──────────────┐
             │  │ VOTE_CLOSING │  (30s window, or 2s if all voted)
             │  └──────┬───────┘
             │         │ voteCloseTask fires
             │    ┌────┴────┐
             │    │         │
             │  pass      fail
             │    │         │
             │    ▼         ▼
             │  ┌───────┐  ┌──────────────┐
             │  │POINT_ │  │    MUTED     │ (2s flash)
             │  │AWARD- │  └──────┬───────┘
             │  │  ED   │         │ mutedTransitionTask
             │  └───┬───┘         │ (timer resumes from remaining time)
             │      │             ▼
             │      │       BUZZER_OPEN ──────────────────────► (loop)
             │      │
             │  ┌───┘ win condition met?
             │  │
             │  no ──► CATEGORY_PICK (loop, via pointAwardedTask)
             │
             └──► GAME_OVER ──────────────────────────────────────────►
                      │
                      │ all players vote rematch
                      ▼
                   LOBBY
```

---

## States

### `LOBBY`

**What players see:** TV shows room code and QR code. Phones show player list.

**Entry conditions:** Room created (`createRoom`) or rematch vote consensus reached.

**Exit condition:** Host calls `startGame()` (requires ≥2 connected players).

**What happens on exit:** First word is drawn from active word list. State transitions `LOBBY → WORD_REVEAL → BUZZER_OPEN` in a single function call. `wordTimerTask` is enqueued for 120 seconds.

---

### `WORD_REVEAL`

**What players see:** TV displays the word with a reveal animation (scale 0.5 → 1.05 → 1.0). Timer pill not yet visible. Players see the word on their phones.

**Duration:** Transient — the game moves immediately to `BUZZER_OPEN` in the same `startGame()` / `categoryRevealTask` function call. This state exists so the TV animation plays before the buzzer opens.

**Why separate from BUZZER_OPEN:** The animation needs a brief window where buzzing is not yet possible. The state change itself is the signal to play the animation.

---

### `BUZZER_OPEN`

**What players see:** TV shows word + countdown timer. Phones show the "🎤 I Know That One!" button (disabled if muted). Skip vote button visible.

**Duration:** Up to 120 seconds (or `timerRemainingMs` if resuming after a mute).

**Exit conditions:**
- A player buzzes in → `onBuzzIn` fires → `SINGING`
- Timer expires → `wordTimerTask` fires → new `WORD_REVEAL` (same or different word after counter increment)
- All players vote to skip → `onSkipVote` fires → timer shortened to 15s → `WORD_REVEAL`

**Non-obvious details:**
- The RTDB rule on `buzzIn/{uid}` only allows writes when `state === 'BUZZER_OPEN'` AND the player is not muted, making the state gate atomic.
- `onBuzzIn` cancels the `wordTimerTask` by name before transitioning, preventing a double-fire after a buzz.
- `consecutiveNoBuzzCount` increments each time the timer expires with no buzz. At 5, the game ends (`GAME_OVER` with `gameOverReason: 'no_buzz'`).

---

### `SINGING`

**What players see:** TV shows singer's name + word on the singer's identity colour. Phones show vote buttons (with 5-second lockout). Singer's phone shows the word large.

**Duration:** Until a majority of eligible voters have voted.

**Exit conditions:**
- All eligible voters have voted → `onVoteWritten` transitions to `VOTE_CLOSING` immediately (2s close delay)
- ≥50% of eligible voters have voted → `onVoteWritten` transitions to `VOTE_CLOSING` (30s close delay)
- Active singer's connection drops → `onSingerDisconnect` → `MUTED` (treated as an automatic fail)

**Eligible voters:** All connected players whose uid is not `activeSinger`. Disconnected players are excluded from the threshold calculation so a single dropout doesn't stall the vote indefinitely.

**Vote lockout:** The 5-second lockout is enforced client-side only (calculated from `meta.singingStartedAt`). It exists to prevent accidental instant-votes, not as a security mechanism — the RTDB write-once rule is the actual enforcement.

---

### `VOTE_CLOSING`

**What players see:** TV overlays the Singing view with a pulsing countdown. Phones still show votes if the player hasn't voted yet.

**Duration:** 2 seconds (if all voted) or 30 seconds (if majority threshold triggered).

**Purpose:** Gives late voters a final window. The UI communicates urgency ("Voting closes soon!").

**Exit condition:** `voteCloseTask` HTTP endpoint fires → tallies votes → either `POINT_AWARDED` or `MUTED`.

**Vote tally logic:**
- Counts `point` votes vs `fail` votes across all submitted `votes/{uid}` entries
- If `point` ≥ `fail` → singer wins → `POINT_AWARDED`
- If `fail` > `point` → singer fails → `MUTED`

---

### `POINT_AWARDED`

**What players see:** TV shows a full-screen celebration with singer's colour, "+N points", name. Phones show "Point Awarded!" confirmation.

**Duration:** 2 seconds (until `pointAwardedTask` fires).

**What happens:** Singer's score incremented by `wordPointValue` in RTDB. `pointAwardedTask` then checks the win condition.

**Win check:** `pointAwardedTask` re-reads the current score from RTDB (not from the task payload) to avoid a race where a manual score adjustment or retry might use a stale value. If `currentScore >= pointsToWin`, state → `GAME_OVER`. Otherwise state → `CATEGORY_PICK`.

---

### `CATEGORY_PICK`

**What players see:** TV and phones both show a 2×2 grid of category options. The round winner is the picker. Non-pickers see the grid but can't interact.

**Duration:** Until the picker taps a category (no timeout — game waits indefinitely).

**Exit condition:** Picker writes to `categoryChoice/chosen` → `onCategoryChosen` validates the choice against the offered options → `categoryRevealTask` enqueued for 5 seconds.

**Category options:** 4 categories chosen randomly from the active word list, excluding the category just played (to force variety).

---

### `MUTED`

**What players see:** TV shows a red flash: "❌ {Singer} failed" or (if all players are muted) "EVERYONE FAILED". Lasts 2 seconds.

**Duration:** 2 seconds until `mutedTransitionTask` or `allMutedTask` fires.

**Two sub-cases:**

**Normal mute:** Singer is flagged `muted: true`. `wordMuteCount` and `wordPointValue` increment (+1 to both, so a word becomes worth more points each time it stumps players). `mutedTransitionTask` resumes the timer at `timerRemainingMs` (minimum 15 seconds) and transitions to `BUZZER_OPEN`.

**All-muted condition:** If muting the singer would result in every connected player being muted (nobody left to sing), the system:
1. Applies a points penalty to all players: `floor(connectedCount / 4) + 1`
2. Resets all `muted` flags
3. Draws a new word from a different category
4. Transitions via `allMutedTask` (10s) back to `BUZZER_OPEN`

This prevents deadlock and adds drama.

---

### `GAME_OVER`

**What players see:** TV shows winner's name, colour, and final scores. Phones show "Rematch?" button.

**Entry conditions:**
- A player's score reaches `pointsToWin` (default: 10)
- `consecutiveNoBuzzCount` reaches 5 (nobody buzzes 5 words in a row)
- Host calls `endGame()` or `adminEndGame()`

**Exit condition:** All connected players write to `rematchVotes/{uid}` → `onRematchVote` resets the entire room (scores, muted flags, used words, votes) and returns to `LOBBY`.

---

## Word Point Value Escalation

`wordPointValue` starts at 1 and increments by 1 each time the word defeats a singer (transitions to `MUTED` or the singer disconnects mid-round). This is tracked in `meta.wordPointValue` and displayed as a badge on the TV ("Worth 3 points!"). When the word is finally sung correctly, the winner earns the accumulated value. A fresh word always starts at 1.

---

## Consecutive No-Buzz Counter

`meta.consecutiveNoBuzzCount` increments each time `wordTimerTask` fires and no player has buzzed in. It resets to 0 whenever any player buzzes in (`onBuzzIn`). At 5, `wordTimerTask` transitions to `GAME_OVER` with `gameOverReason: 'no_buzz'`. The TV shows "Nobody buzzed in 5 times in a row!" This prevents games from stalling forever if players aren't engaged.

---

## Inactivity Timeout

Every state transition triggers `onGameStateChange`, which:
1. Generates a new `inactivityToken` (random string)
2. Enqueues `inactivityTask` with that token for 30 minutes

`inactivityTask` checks whether `meta.inactivityToken` still matches its payload. If 30 minutes pass with no state change, the token still matches and the game is ended. If any state change occurred in that window, the token has been replaced and the task no-ops.

This means an abandoned game (players close their browsers mid-game) will auto-terminate 30 minutes later.
