# Changelog

Dated, human-readable log of notable changes to this project. Newest entries
at the top. See `CLAUDE.md` for the convention this file follows.

## 2026-09-15

- Fixed: the Skip counter on TV and phone screens showed all connected
  players as the denominator, but the backend now only requires non-muted
  players to reach skip consensus (see 2026-09-14 entry below) — the
  displayed fraction could look like it completed "early." Both now exclude
  muted players to match (`src/components/tv/WordReveal.tsx`,
  `src/components/phone/PhoneGameView.tsx`).
- Fixed: the `identityIndex` join transaction didn't check whether it
  actually committed before reading its result, so it could produce a
  `NaN`/colliding index under heavy simultaneous-join contention. Now
  retries a few times and falls back to a deterministic per-player index if
  the transaction never commits (`functions/src/index.ts`, `onPlayerJoin`).
- Fixed: `hintTask`'s early-return paths (hint already showing, or no hint
  data for the word) didn't clear their own pending task-name field on
  `meta`, and the 5-consecutive-no-buzz `GAME_OVER` path didn't cancel any
  still-pending hint tasks — both harmless in practice but inconsistent
  bookkeeping, now cleaned up.

## 2026-09-14

- Fixed: skip-vote hint consensus could become permanently unreachable once
  any player was muted for a word — the backend counted muted players toward
  the required unanimous vote, but the phone UI hides their Skip button, so
  consensus could never be reached. Muted players are now excluded from the
  consensus denominator (`functions/src/index.ts`, `onSkipVote`).
- Fixed: `identityIndex` (player color/pattern) assignment on join was a
  read-then-write race — two players joining at nearly the same time could
  be assigned the same identity. Now allocated via an atomic RTDB
  transaction, matching the existing `hostId` claim pattern
  (`functions/src/index.ts`, `onPlayerJoin`).
- Added: hints now also auto-reveal at 50% and 25% of the word timer
  remaining, independent of skip-vote consensus (which still reveals a hint
  immediately on unanimous skip). Implemented as two additional Cloud Tasks
  scheduled alongside the existing word timer, reusing the existing hint
  data lookup and phone/TV rendering (`functions/src/index.ts`: `hintTask`,
  `scheduleHintTasks`, `pickHint`).
- Added this changelog.

## Earlier (from git history)

- 2026-09-14 — Show song hints and countdown timer on phone screens; add
  game-action logging for alpha troubleshooting.
- 2026-09-13 — Fix TV frame overflow on short/landscape windows; surface
  `useAllRooms` errors in admin dashboard.
- 2026-05-03 — Guard against undefined `identityIndex` in `PlayerBg` to
  prevent a white-screen crash.
- 2026-04-30 — v0.9: song hint system, word editor overhaul, word examples
  data; QR clipping and blank-screen-race fixes.
- 2026-04-24–04-25 — Admin page (game monitor, word editor, analytics);
  security hardening pass; accessibility/touch-target polish.
- 2026-04-22–04-23 — Initial full implementation: all game phases, anonymous
  auth, skip consensus, host controls, scheduled DB cleanup.
