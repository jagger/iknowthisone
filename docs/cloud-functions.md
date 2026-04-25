# Cloud Functions Reference

All functions are defined in `functions/src/index.ts` and deployed to `us-central1`. The codebase uses Firebase Cloud Functions v2 (2nd Gen).

---

## Callable Functions

These are invoked directly from the client using `httpsCallable(functions, 'functionName')`. They require a valid Firebase Auth token.

---

### `createRoom`

**Trigger:** HTTPS Callable  
**Auth:** Required (any authenticated user)

**What it does:**

1. Generates a 4-character room code candidate
2. Uses an RTDB transaction on `/rooms/{code}` to ensure uniqueness — retries up to 10 times with new candidates if a collision is found
3. Writes the initial room structure:
   - `meta.state = 'LOBBY'`
   - `meta.hostToken` = 8-character cryptographically random token (`crypto.randomBytes`)
   - `meta.pointsToWin = 10`
   - `meta.hostId = null` (set later by `claimHost`)
   - `meta.createdAt = now`
4. If `email` is provided in the request body, sends a host link email via Resend containing `https://iknowthisone.jagger.dev/play/{roomCode}?hostToken={hostToken}`

**Returns:** `{ roomCode: string }`

**Why `hostToken` is separate from `hostId`:** The token is generated at room creation and embedded in a link (or QR code). `hostId` is only set when the host actually visits the link and calls `claimHost`. This decouples room creation from host presence — a room can be created in advance and the host joins later.

---

### `claimHost`

**Trigger:** HTTPS Callable  
**Auth:** Required

**What it does:**

1. Reads `meta.hostToken` and `meta.hostId` from RTDB
2. If `hostId` is already set to a different uid, throws `permission-denied` (prevents re-claiming)
3. If `hostToken` matches the request payload's `hostToken`, sets `meta.hostId = auth.uid`

**Returns:** `{ ok: true }`

**Called by:** `JoinScreen.tsx` on mount, if a `hostToken` query parameter is present in the URL.

---

### `startGame`

**Trigger:** HTTPS Callable  
**Auth:** Required; host only (`meta.hostId === auth.uid`)

**Guards:**
- `meta.state !== 'LOBBY'` → error
- Fewer than 2 connected players → error

**What it does:**

1. Calls `getActiveWords()` to load the live word list
2. Picks an initial category randomly from available categories
3. Draws the first word from that category
4. Transitions: `LOBBY → WORD_REVEAL → BUZZER_OPEN` in one write
5. Sets `wordDrawnAt = now`, `timerDurationMs = 120000`
6. Enqueues `wordTimerTask` for 120 seconds
7. Resets `consecutiveNoBuzzCount = 0`, `usedWords = {}`

**Returns:** `{ ok: true }`

---

### `endGame`

**Trigger:** HTTPS Callable  
**Auth:** Required; host only

**What it does:**

1. Cancels pending `wordTimerTaskName` and `voteCloseTaskName` (Cloud Tasks cancellation by name)
2. Sets `meta.state = 'GAME_OVER'`

**Returns:** `{ ok: true }`

---

### `adminEndGame`

**Trigger:** HTTPS Callable  
**Auth:** Required; email-verified + in `ADMIN_ALLOWLIST`

Identical to `endGame` but skips the host check. Used by the admin panel to terminate any active room.

---

### `restartGame`

**Trigger:** HTTPS Callable  
**Auth:** Required; host only

**What it does:**

1. Cancels pending tasks
2. Resets all player scores to 0, `muted: false`, `hasVoted: false`
3. Clears `categoryChoice`, `votes`, `buzzIn`, `skipVotes`, `rematchVotes`
4. Resets `usedWords = {}`, `consecutiveNoBuzzCount = 0`, `allMutedPenalty = null`
5. Sets `meta.state = 'LOBBY'`

**Returns:** `{ ok: true }`

---

## RTDB Triggers

These fire automatically when data is written to RTDB. They use the Firebase Admin SDK and bypass security rules.

---

### `onPlayerJoin`

**Trigger:** `onCreate` at `/rooms/{roomCode}/players/{uid}`  
**Fires when:** A new player node is created (first join only, not reconnects)

**What it does:**

1. Counts existing players to assign `identityIndex = count % 12`
2. Writes server-controlled fields via admin SDK:
   - `score = 0`, `muted = false`, `hasVoted = false`, `joinedAt = now`
   - `identityIndex` = assigned value
3. Atomically assigns host via RTDB transaction on `meta.hostId`:
   - If `hostId` is currently `null`, sets it to the joining uid
   - If `hostId` is already set, no-ops
   - Transaction semantics guarantee only one concurrent join can win the host role

**Why `set` from client is insufficient:** The player node is first written by `JoinScreen` (which sets `name` and `connected`). `onPlayerJoin` then overlays the server-controlled fields. RTDB rules block the client from writing `score`, `muted`, etc. directly.

---

### `onBuzzIn`

**Trigger:** `onCreate` at `/rooms/{roomCode}/buzzIn/{uid}`  
**Fires when:** A player writes `buzzIn/{uid} = true`

**Guards:**
- `meta.state !== 'BUZZER_OPEN'` → return (RTDB rule also blocks this at the write level)
- Player is muted → return (RTDB rule also blocks this)

**What it does:**

1. Calculates time remaining: `timerRemainingMs = timerDurationMs - (now - wordDrawnAt)`
2. Cancels `wordTimerTaskName` (Cloud Tasks cancellation)
3. Clears `buzzIn`, `skipVotes`, and all `votes`
4. Resets `hasVoted = false` on all players
5. Sets `activeSinger = uid`, `state = 'SINGING'`, `singingStartedAt = now`
6. Updates analytics: increments `attempts`, `buzzes`, adds buzz response time to `totalBuzzMs`

**Why the RTDB rule and the function guard both check state:** Defence in depth. The RTDB rule (checking `state === 'BUZZER_OPEN'`) prevents the write from landing at all. The function guard provides a secondary check in case of eventual consistency edge cases.

---

### `onVoteWritten`

**Trigger:** `onWrite` at `/rooms/{roomCode}/votes/{uid}`  
**Fires when:** Any vote is created (write-once rule means it won't fire on modification)

**Guards:**
- Vote data doesn't exist (cleared vote path) → return
- `meta.state !== 'SINGING'` → only mark `hasVoted`, don't trigger close

**What it does:**

1. If `meta.state === 'SINGING'`, marks voter's `hasVoted = true`
2. Counts eligible voters: connected players who are not `activeSinger`
3. Counts how many have voted
4. **All eligible voted:** enqueues `voteCloseTask` with 2s delay, sets `state = 'VOTE_CLOSING'`, records `voteCloseTriggeredAt`
5. **Majority voted (≥50%):** same as above but 30s delay

**The 30s window:** When majority threshold is reached, a 30-second closing window opens to give late voters a final chance. This prevents a 3-person game where 2 people vote "fail" from instantly closing before the third person gets a chance.

---

### `onCategoryChosen`

**Trigger:** `onWrite` at `/rooms/{roomCode}/categoryChoice/chosen`  
**Fires when:** The picker writes their category choice

**Guards:**
- `chosen` is falsy → return
- `meta.state !== 'CATEGORY_PICK'` → return
- `chosen` not in `categoryChoice/options` → return (prevents forcing an arbitrary category)

**What it does:**

Reads `meta` and `categoryChoice/options` in parallel, validates, then enqueues `categoryRevealTask` for 5 seconds.

**The 5-second delay** gives the TV and phones time to animate the category selection before the new word appears.

---

### `onSingerDisconnect`

**Trigger:** `onWrite` at `/rooms/{roomCode}/players/{uid}/connected`  
**Fires when:** Any player's `connected` field changes

**Guards:**
- Changed uid is not `activeSinger` → return
- New value is not `false` → return (reconnects are ignored)
- `meta.state` is not in `['SINGING', 'VOTE_CLOSING']` → return

**What it does:**

Treats a mid-round disconnect as an automatic fail:
1. Mutes the singer: `players/{uid}/muted = true`
2. Increments `wordMuteCount` and `wordPointValue`
3. Sets `state = 'MUTED'`
4. Enqueues `mutedTransitionTask` for 2 seconds

**Why this matters:** Without this trigger, a disconnecting singer would freeze the game at `SINGING` indefinitely — votes would be cast but no resolution would occur because the vote threshold might never be reached with the singer excluded.

---

### `onSkipVote`

**Trigger:** `onCreate` at `/rooms/{roomCode}/skipVotes/{uid}`  
**Fires when:** A player votes to skip the current word

**Guards:**
- `meta.state !== 'BUZZER_OPEN'` → return
- Not all connected players have voted to skip → return (unanimous consent required)

**What it does:**

1. Cancels the current `wordTimerTask`
2. Increments skip analytics for the word
3. Enqueues a new `wordTimerTask` for **15 seconds** (fast timeout — the skip is the transition)

**Why 15s not instant:** Keeps the buzzer open briefly rather than snapping immediately to a new word. Players can still buzz in during those 15 seconds. The skip simply shortens the remaining wait.

---

### `onRematchVote`

**Trigger:** `onCreate` at `/rooms/{roomCode}/rematchVotes/{uid}`  
**Fires when:** A player votes for a rematch

**Guards:**
- `meta.state !== 'GAME_OVER'` → return
- Not all connected players have voted → return (unanimous consent required)

**What it does:**

Performs a full game reset inline (same logic as `restartGame`): scores, muted, votes, usedWords, tasks all cleared. Returns to `LOBBY`.

---

### `onGameStateChange`

**Trigger:** `onWrite` at `/rooms/{roomCode}/meta/state`  
**Fires on:** Every state change except transitions to `GAME_OVER`

**What it does:**

1. Generates a new `inactivityToken` (random string)
2. Enqueues `inactivityTask` with that token for 30 minutes

**Why on every state change:** The `inactivityToken` pattern is a lightweight way to detect inactivity without polling. The token in the task payload must match the current token in RTDB. Because the token rotates on every state change, any pending `inactivityTask` from before the last change will no-op when it fires.

---

## Cloud Task Handlers

These are HTTPS endpoints called exclusively by Google Cloud Tasks. All require the `X-Tasks-Secret` header.

The `enqueueTask(name, body, delaySeconds)` helper:
- Posts to `https://{region}-{project}.cloudfunctions.net/{name}`
- Sets `X-Tasks-Secret` header
- Schedules execution at `now + delaySeconds`
- Returns the task name (stored in RTDB for later cancellation)

---

### `wordTimerTask`

**Delay:** 120 seconds (or `timerRemainingMs` when resuming after mute, minimum 15s)  
**Payload:** `{ roomCode, wordDrawnAt }`

**Guards:**
- `meta.state !== 'BUZZER_OPEN'` → no-op
- `meta.wordDrawnAt !== payload.wordDrawnAt` → no-op (stale task from a previous word)

**What it does (normal timeout):**

1. Increments `consecutiveNoBuzzCount`
2. If count reaches 5: sets `state = 'GAME_OVER'`, `gameOverReason = 'no_buzz'`
3. Otherwise:
   - Resets all `muted` flags to false
   - Draws a new word from active word list (respects `usedWords` per category)
   - Sets `state = 'WORD_REVEAL'` then `'BUZZER_OPEN'` in one write
   - Enqueues new `wordTimerTask` for 120s
   - Increments analytics: `attempts + 1`, `timeouts + 1`

---

### `voteCloseTask`

**Delay:** 2 seconds (all voted) or 30 seconds (majority voted)  
**Payload:** `{ roomCode }`

**Guards:**
- `meta.state !== 'VOTE_CLOSING'` → no-op

**What it does:**

1. Reads all `/votes` entries
2. Counts `point` vs `fail` votes
3. Clears all votes and `hasVoted` flags (cleanup)
4. **If points ≥ fails:**
   - Increments singer's score by `wordPointValue`
   - Sets `state = 'POINT_AWARDED'`
   - Enqueues `pointAwardedTask` for 2 seconds
5. **If fails > points:**
   - Checks if muting the singer means all players are muted
   - **All-muted branch:** sets `allMutedPenalty`, resets all `muted`, sets `state = 'MUTED'`, enqueues `allMutedTask` for 10s
   - **Normal mute:** sets singer `muted = true`, increments `wordMuteCount`/`wordPointValue`, sets `state = 'MUTED'`, enqueues `mutedTransitionTask` for 2s

---

### `pointAwardedTask`

**Delay:** 2 seconds  
**Payload:** `{ roomCode, winnerId }`

**Guards:**
- `meta.state !== 'POINT_AWARDED'` → no-op

**What it does:**

1. **Re-reads `players/{winnerId}/score` from RTDB** (does not trust payload value — prevents stale win checks from Cloud Tasks retries)
2. **If score ≥ `meta.pointsToWin`:** sets `state = 'GAME_OVER'`
3. **Otherwise:**
   - Picks 4 random categories (excluding current)
   - Sets `state = 'CATEGORY_PICK'`
   - Writes `categoryChoice = { chooserId: winnerId, options: [...], chosen: null, chosenAt: null }`

---

### `mutedTransitionTask`

**Delay:** 2 seconds  
**Payload:** `{ roomCode, now }`

**Guards:**
- `meta.state !== 'MUTED'` → no-op

**What it does:**

1. Calculates resume duration: `Math.max(15000, meta.timerRemainingMs ?? 120000)`
2. Sets `state = 'WORD_REVEAL'` then `'BUZZER_OPEN'` with updated `wordDrawnAt = now`
3. Enqueues `wordTimerTask` for the calculated resume duration

---

### `allMutedTask`

**Delay:** 10 seconds  
**Payload:** `{ roomCode }`

**Guards:**
- `meta.state !== 'MUTED'` → no-op
- `meta.allMutedPenalty` not set → no-op

**What it does:**

1. Picks a new category (excluding current), draws a new word
2. Resets all `muted` flags to false
3. Clears `allMutedPenalty`, `wordMuteCount`, resets `wordPointValue = 1`
4. Transitions to `BUZZER_OPEN` with fresh `wordDrawnAt`
5. Enqueues `wordTimerTask` for 120s

---

### `categoryRevealTask`

**Delay:** 5 seconds  
**Payload:** `{ roomCode, category }`

**Guards:**
- `meta.state !== 'CATEGORY_PICK'` → no-op

**What it does:**

1. Draws a word from `category` (respecting `usedWords`)
2. Resets all `muted` and `hasVoted` flags
3. Clears `categoryChoice`, `votes`, `buzzIn`, `skipVotes`
4. Resets `wordMuteCount = 0`, `wordPointValue = 1`, `consecutiveNoBuzzCount = 0`
5. Transitions: `CATEGORY_PICK → WORD_REVEAL → BUZZER_OPEN`
6. Sets `wordDrawnAt = now`, `timerDurationMs = 120000`
7. Enqueues `wordTimerTask` for 120s

---

### `inactivityTask`

**Delay:** 30 minutes  
**Payload:** `{ roomCode, inactivityToken }`

**Guards:**
- `meta.inactivityToken !== payload.inactivityToken` → no-op (game has been active since this task was enqueued)
- `meta.state === 'GAME_OVER'` → no-op

**What it does:**

Sets `meta.state = 'GAME_OVER'` to terminate an abandoned game.

---

### `cleanupTask`

**Delay:** 2 hours after `GAME_OVER`  
**Payload:** `{ roomCode }`

Deletes the entire room node from RTDB if the room is still in `GAME_OVER` state.

---

### `scheduledCleanup`

**Trigger:** Cloud Scheduler, every 6 hours  

Scans all rooms and deletes:
- Rooms in `GAME_OVER` state older than 2 hours
- Any room older than 48 hours (safety net for stuck rooms)

---

## Secret Management

Two secrets are stored in Firebase Secret Manager:

| Secret name | Used by |
|---|---|
| `TASKS_SECRET` | All Cloud Task endpoints (verify header) and all triggers/callables that enqueue tasks |
| `RESEND_API_KEY` | `createRoom` (email delivery) |

Both are accessed via `defineSecret('NAME')` from `firebase-functions/params`. Functions declare which secrets they need in their options object (`secrets: [tasksSecret]`), causing Firebase to inject them as environment secrets at deploy time.

The `TASKS_SECRET` is a shared secret between the Cloud Tasks enqueuer and the HTTP handlers — similar to a webhook signing secret. It prevents external callers from triggering game transitions by hitting the task endpoint URLs directly.
