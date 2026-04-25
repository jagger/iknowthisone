# Security Model

The game uses a layered security model: Firebase Auth controls identity, RTDB security rules control what clients can read and write, and Cloud Functions add server-side validation above and beyond what rules can express. No single layer is solely responsible for enforcement.

---

## Authentication

### Players

Players use Firebase Anonymous Auth. They have no email or password. The only identity is a Firebase UID (`auth.uid`) generated on the device. This UID persists across page reloads (stored in browser storage by the Firebase SDK) but is lost if the browser's storage is cleared.

Players set a `displayName` via `updateProfile()`, which is stored in the Firebase Auth token but not in RTDB directly (the name is also written to `players/{uid}/name` by the join flow).

**What anonymous auth provides:**
- A stable, per-device UID used by RTDB rules (`auth.uid === $uid`)
- No account creation friction — players are "authenticated" instantly
- No personally identifying information in the auth token

### Admins

The admin panel uses Google OAuth (`GoogleAuthProvider`, `signInWithPopup`). The resulting user has a verified email address. Admin access is gated on:

1. `auth.token.email_verified === true` (Google accounts are always verified)
2. `auth.token.email` in the admin allowlist (checked in both RTDB rules and Cloud Functions)

The allowlist is `['jagger@oznog.org', 'cewhiney08@gmail.com']`, defined in two places:
- `ADMIN_ALLOWLIST` in `functions/src/index.ts` (authoritative — Cloud Functions enforce this)
- `ALLOWLIST` in `src/components/admin/AdminRoute.tsx` (client-side gate for UX only — shows "Access Denied" before even hitting the database)

---

## Firebase RTDB Security Rules

Full rules are in `database.rules.json`. Key decisions explained below.

### Room subtree is public-readable

```json
"$roomCode": {
  ".read": true,
  ...
}
```

Any browser can read any room. This is intentional: the TV display at `/screen/:roomCode` runs without any auth token (it's a display-only view on an unattended TV). The room code itself acts as a capability token — knowing the code is what grants access to the game.

### Player fields are individually write-gated

```json
"players": {
  "$uid": {
    ".write": false,
    "name":           { ".write": "auth != null && auth.uid === $uid" },
    "connected":      { ".write": "auth != null && auth.uid === $uid" },
    "disconnectedAt": { ".write": "auth != null && auth.uid === $uid" }
  }
}
```

`.write: false` at the `$uid` level blocks any client from calling `set()` on the entire player node. Without this, a player could write `{ name: 'x', score: 999, muted: false }` in a single call, and the field-level rules would not protect them (rules are evaluated bottom-up — a write to `$uid` matches the parent rule, not the child rules).

Only three fields are client-writable. Everything else (`score`, `muted`, `hasVoted`, `identityIndex`) is exclusively written by Cloud Functions using the admin SDK, which bypasses all rules.

### Votes are write-once and unreadable

```json
"votes": {
  ".read": false,
  "$uid": {
    ".write": "auth != null && auth.uid === $uid && !data.exists()"
  }
}
```

`!data.exists()` means a vote can only be written if no vote currently exists at that path. Once a vote is cast, it cannot be modified or retracted. The entire `/votes` subtree is read-restricted — clients cannot see how others voted.

### BuzzIn has an atomic state guard

```json
"buzzIn": {
  "$uid": {
    ".write": "auth != null && auth.uid === $uid
      && root.child('rooms').child($roomCode).child('meta').child('state').val() === 'BUZZER_OPEN'
      && root.child('rooms').child($roomCode).child('players').child($uid).child('muted').val() !== true"
  }
}
```

This rule evaluates atomically at write time. A player cannot write to `buzzIn` unless the game is currently in `BUZZER_OPEN` state AND they are not muted. Because RTDB rules are evaluated server-side before the write commits, this gate cannot be bypassed by timing — the write either lands with these conditions true, or it is rejected.

The Cloud Function `onBuzzIn` re-checks both conditions as defence in depth.

### Category choice is constrained to offered options

```json
"categoryChoice": {
  "chosen": {
    ".write": "auth != null && auth.uid === root.child('rooms').child($roomCode).child('categoryChoice').child('chooserId').val()"
  }
}
```

The RTDB rule only verifies the writer is the chooser. The value validation (is the chosen category one of the offered options?) is enforced in `onCategoryChosen`, which reads `categoryChoice/options` and returns early if `chosen` is not in that array. This prevents the picker from forcing an arbitrary category.

### Meta is read-public, write-forbidden (except hostToken)

```json
"meta": {
  "hostToken": { ".read": false },
  ".write": false
}
```

All meta fields are unwritable by clients. `hostToken` gets an additional read restriction — the parent `rooms/$roomCode` is public-readable, but Firebase RTDB's rules correctly strip `.read: false` children from parent snapshots. A browser subscribing to the full room will not receive `hostToken` in its snapshot.

### AdminConfig is allowlist-restricted

```json
"adminConfig": {
  ".read": "auth != null && auth.token.email_verified === true
    && (auth.token.email === 'jagger@oznog.org' || auth.token.email === 'cewhiney08@gmail.com')",
  "words": {
    ".write": "auth != null && auth.token.email_verified === true
      && (auth.token.email === 'jagger@oznog.org' || auth.token.email === 'cewhiney08@gmail.com')"
  }
}
```

This protects the live word list from being read by players (who could pre-learn all possible words) and from being written by anyone except admins. Cloud Functions are unaffected because they use the admin SDK.

---

## Cloud Function Validation

RTDB rules express what data can be written, but they cannot validate complex business logic. Cloud Functions add a second layer:

| Vulnerability | RTDB rule | Cloud Function guard |
|---|---|---|
| Muted player buzzing | `muted !== true` in buzzIn rule | `onBuzzIn` re-checks muted |
| Buzz outside BUZZER_OPEN | `state === 'BUZZER_OPEN'` in buzzIn rule | `onBuzzIn` checks state |
| Picker choosing invalid category | (rule checks writer, not value) | `onCategoryChosen` validates value against options array |
| Player scoring points directly | `.write: false` on player node | N/A — rule is sufficient |
| Non-host starting game | N/A | `startGame` checks `hostId === auth.uid` |
| Re-claiming host | N/A | `claimHost` checks `hostId !== auth.uid` if already set |

---

## Cloud Task Endpoint Protection

Cloud Task HTTP endpoints (`wordTimerTask`, `voteCloseTask`, etc.) are public URLs. Any caller who knows the URL could trigger game transitions. The TASKS_SECRET shared secret prevents this:

```typescript
function verifyTaskSecret(req: Request): boolean {
  return req.headers['x-tasks-secret'] === tasksSecret.value()
}
```

Every task handler calls this at the top and returns 401 if it fails. The secret is stored in Firebase Secret Manager and injected as a runtime environment secret — it is never in source code, build artifacts, or deployment logs.

Even if the secret were leaked, an external caller would also need to know the `roomCode` and any idempotency tokens for their request to have any effect. The task handlers check game state at execution time.

---

## Defence-in-Depth Summary

For each critical game action, there are multiple independent protection layers:

### Buzzing in
1. **RTDB rule:** write to `buzzIn/{uid}` blocked unless `state === 'BUZZER_OPEN'` AND `muted !== true`
2. **Cloud Function:** `onBuzzIn` re-checks both conditions
3. **Race handling:** second simultaneous buzz either blocked by rule (state already changed) or no-oped by function

### Voting
1. **RTDB rule:** write-once per uid per round (`!data.exists()`)
2. **RTDB rule:** `/votes` is not readable — clients never see others' votes
3. **Cloud Function:** `onVoteWritten` tallies from RTDB, not client-supplied counts

### Score manipulation
1. **RTDB rule:** `.write: false` at player node level
2. **RTDB rule:** only `name`, `connected`, `disconnectedAt` are client-writable
3. **Cloud Function:** `pointAwardedTask` re-reads score from RTDB before win check

### Game state
1. **RTDB rule:** `meta/.write: false` — no client write path to state
2. **Cloud Functions:** all state transitions include precondition checks
3. **Cloud Tasks:** idempotency tokens prevent double-execution of delayed transitions

### Admin access
1. **Frontend:** `AdminRoute` checks email before rendering
2. **RTDB rules:** `adminConfig` read/write restricted to allowlist emails
3. **Cloud Functions:** `adminEndGame` verifies email in `ADMIN_ALLOWLIST`

---

## Known Limitations

**Anonymous auth is not persistent across browsers.** If a player opens the game in a different browser (or incognito mode), they get a new UID and appear as a new player. There is no way to link anonymous accounts without upgrading to a full account.

**Room codes are not secret for the TV.** The TV shows the room code prominently and anyone who can see the TV can join. This is intentional — it's a party game. The room code is a capability token, not a secret.

**The admin allowlist is hardcoded.** Adding new admins requires a code change and redeploy. This is acceptable for the current scale but would need a RTDB-backed allowlist for a larger deployment.
