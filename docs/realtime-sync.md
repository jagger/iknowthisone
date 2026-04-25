# Real-Time Synchronisation

Every screen in the game is a live view of the Firebase Realtime Database. This document explains how data flows from Cloud Functions through RTDB into both the TV and phone UIs simultaneously, and how player presence is tracked.

---

## The Core Subscription: `useGameState`

Located at `src/hooks/useGameState.ts`. Both `TvGameView` and `PhoneGameView` call this hook with the room code.

```typescript
const { meta, players, categoryChoice, skipVotes, loading, error } = useGameState(roomCode)
```

Internally it does one thing: attaches an `onValue()` listener to `rooms/{roomCode}`.

```typescript
onValue(ref(db, `rooms/${roomCode}`), (snapshot) => {
  const data = snapshot.val()
  setMeta(data.meta)
  setPlayers(data.players ?? {})
  setCategoryChoice(data.categoryChoice ?? null)
  setSkipVotes(data.skipVotes ?? {})
})
```

**Why one subscription, not many?**

A single subscription on the room root is simpler and avoids multiple round-trips. RTDB pushes the full subtree on each change, so the TV and phones receive a consistent snapshot of the whole room state with every update. The alternative — separate subscriptions for `meta`, `players`, `votes` — would arrive as separate events and could cause the UI to render in a transiently inconsistent state (e.g., `state = 'SINGING'` but `activeSinger` not yet updated).

**What fires an update:**

Any write anywhere in the `rooms/{roomCode}` subtree triggers the listener. In practice, major updates happen when Cloud Functions transition the game state (writing `meta`) or when players update presence fields.

---

## How TV and Phone Stay in Lock-Step

```
Cloud Function writes to RTDB
       │
       ▼
RTDB replication (typically <100ms)
       │
       ├─► TV browser onValue() fires
       │     └─► React re-renders TvGameView
       │           └─► New screen displayed
       │
       └─► Phone browser(s) onValue() fires
             └─► React re-renders PhoneGameView
                   └─► usePlayerRole derives new role
                         └─► New screen displayed
```

There is no polling, no manual refresh, no WebSocket management in the app code. All of that is abstracted by the Firebase JS SDK.

**Typical latency:** Under 200ms from Cloud Function write to UI update on a good connection. Players on different devices will each see the update within their own network latency of the RTDB write, so screens may update at slightly different moments — but because state is server-authoritative, there are no conflicts or divergences. Every client converges to the same state.

---

## Player Presence: `usePresence`

Located at `src/hooks/usePresence.ts`. Called by `PhoneGameView` for every connected player.

```typescript
usePresence(roomCode, uid)
```

### How it works

Firebase provides a special RTDB path at `.info/connected` that reflects the client's current connection status. `usePresence` subscribes to this path:

```typescript
onValue(ref(db, '.info/connected'), (snap) => {
  if (snap.val() === true) {
    // We're online — register disconnect handler first, then set connected = true
    const playerConnectedRef = ref(db, `rooms/${roomCode}/players/${uid}/connected`)
    const playerDisconnectedAtRef = ref(db, `rooms/${roomCode}/players/${uid}/disconnectedAt`)

    onDisconnect(playerConnectedRef).set(false)
    onDisconnect(playerDisconnectedAtRef).set(serverTimestamp())

    set(playerConnectedRef, true)
  }
})
```

**The `onDisconnect` pattern** is critical: before setting `connected = true`, the client registers an `onDisconnect` handler with the Firebase server. This handler fires server-side if the client disconnects for any reason — browser close, network drop, phone lock. Because it runs server-side, it fires even if the client can't send a final message.

This means `connected` is never stuck at `true` for a disconnected player. The Firebase server manages the cleanup.

### Explicit disconnect on unmount

When `PhoneGameView` unmounts (the player navigates away), `usePresence` also manually sets `connected = false` and `disconnectedAt = now`. This handles graceful navigation and ensures the disconnect flag is set promptly without waiting for the Firebase connection timeout.

### How disconnect affects the game

**During SINGING:** `onSingerDisconnect` watches `/players/{uid}/connected`. If the active singer disconnects, the function immediately mutes them and moves to `MUTED`, exactly as if the singer had failed the vote. The game continues without stalling.

**During LOBBY/BUZZER_OPEN:** Disconnected players are visually greyed out in `PlayerGrid` but still counted in the room. The `consecutiveNoBuzzCount` logic in `wordTimerTask` uses connected players, so a single-player room with one disconnected player won't endlessly timer-expire.

**Vote threshold:** `onVoteWritten` counts only connected players (excluding the singer) for the voting threshold. A voter who disconnects mid-voting reduces the required majority accordingly.

**Disconnect display window:** `PlayerGrid` greys out players whose `disconnectedAt` timestamp is within the last 2 minutes. After 2 minutes, they stop being rendered. This handles brief connection interruptions gracefully (a phone that momentarily loses signal will show as greyed for 2 minutes then disappear, rather than flickering in and out).

---

## The Vote Privacy Problem

Votes are sensitive — players should not be able to read each other's votes before the round closes, as this would influence voting behaviour.

**Solution:** The RTDB rule sets `.read: false` on `/rooms/{roomCode}/votes`. Clients cannot query this path directly. Only Cloud Functions (admin SDK, which bypasses rules) can read votes.

Clients only learn about voting through two mechanisms:
1. `players/{uid}/hasVoted: true` — set by `onVoteWritten` for each voter. This tells the UI that a player has voted but not how.
2. The state transition itself — `VOTE_CLOSING` and then `POINT_AWARDED` / `MUTED` reveals the outcome.

The TV shows vote progress as anonymous checkmarks (who voted, not how they voted) until the result is announced.

---

## BuzzIn Race Condition Handling

Multiple players could tap the buzzer simultaneously. Two writes to `buzzIn/{uid1}` and `buzzIn/{uid2}` might arrive at the RTDB within milliseconds.

`onBuzzIn` is triggered by each write. The first write to arrive triggers a Cloud Function execution that:
1. Checks `meta.state === 'BUZZER_OPEN'`
2. Atomically sets `activeSinger = uid1` and `state = 'SINGING'`

The second write (from `uid2`) also triggers `onBuzzIn`, but:
- Either the state check fails (`state` is now `'SINGING'`) → function returns immediately
- Or the write is blocked by the RTDB rule (`state !== 'BUZZER_OPEN'`) → write rejected

Because the RTDB rule on `buzzIn` requires `state === 'BUZZER_OPEN'` at write time, and writes are atomic, only the first valid write lands. The second write either lands and is no-oped by the function, or is rejected by the rule. Either way, only one singer is assigned.

---

## Skip Vote Synchronisation

Skip votes are simpler: each player can write `skipVotes/{uid} = true` once. `onSkipVote` counts connected players and checks if all have voted. If so, the timer is shortened to 15 seconds.

Because RTDB writes are ordered, two near-simultaneous skip votes will each trigger `onSkipVote`, but only the one that makes the count reach 100% will trigger the timer change. The function re-counts on each trigger.

---

## Category Choice Synchronisation

Only one player (the round winner) can write `categoryChoice/chosen`. The RTDB rule verifies `auth.uid === categoryChoice/chooserId`. Even if somehow two requests arrived, the write-once nature of the transition (Cloud Function checks state immediately) ensures only one category is ever processed per round.

---

## Rematch Vote Synchronisation

Rematch votes work the same as skip votes: each player writes to `rematchVotes/{uid}`, and `onRematchVote` counts connected players. When the last player votes, the function resets the game to LOBBY. The function is idempotent — if somehow triggered twice (Cloud Function retry), the second call finds `state !== 'GAME_OVER'` and returns immediately.

---

## Cold Join (Rejoining Mid-Game)

If a player closes their browser and reopens it:

1. `NameScreen` pre-fills from `localStorage`
2. `JoinScreen` checks if the player already exists in RTDB (`get(playerRef)`)
3. If they do, only `connected = true` is written (not a new `set` of the whole node)
4. `onPlayerJoin` does **not** re-fire (it's an `onCreate` trigger, not `onWrite`)
5. The player rejoins with their existing score, identity, and muted state intact

This means leaving and rejoining mid-game preserves your score and doesn't create a duplicate player entry.

---

## Admin Panel Real-Time Data

`useAllRooms` subscribes to the entire `/rooms` path. It receives every room with every update. At party scale this is fine (dozens of rooms, each small). A production-scale game would need a separate index or server-side query, but Firebase's RTDB model means there is no server-side filtering available at this path.

The analytics listener in `Analytics.tsx` similarly subscribes to `/analytics/words` for the full dataset. Analytics data is write-heavy (every buzz and timeout) but read only in the admin panel.
