# I Know This One — Technical Documentation

**I Know This One** is a real-time multiplayer party game. A TV screen shows a word; players race to buzz in on their phones and sing a song containing that word. Other players vote on whether the singer succeeded. First to the point threshold wins.

---

## Documentation Index

| Document | What it covers |
|---|---|
| [Architecture Overview](./architecture.md) | System topology, tech stack, how the pieces fit |
| [Game State Machine](./game-state-machine.md) | Every state, every transition, what triggers each |
| [Data Model](./data-model.md) | Full RTDB schema, TypeScript types, field semantics |
| [Cloud Functions Reference](./cloud-functions.md) | Every function: trigger, inputs, RTDB writes, side effects |
| [Frontend Architecture](./frontend.md) | Routing, auth guards, component tree, TV vs. phone split |
| [Real-Time Synchronisation](./realtime-sync.md) | Hooks, presence, how TV and phones stay in lock-step |
| [Security Model](./security.md) | Auth layers, RTDB rules, defence-in-depth |

---

## Quick Orientation

```
Browser (TV)          Browser (Phone ×N)         Cloud
─────────────         ──────────────────         ───────────────────────
TvGameView            PhoneGameView              Cloud Functions
  └─ reads RTDB         └─ reads RTDB              └─ writes RTDB
     (reactive)            (reactive)               └─ enqueues tasks
                           └─ writes RTDB         Cloud Tasks queue
                              (player actions)       └─ HTTP → functions
```

The client **never** drives game state. It writes player actions (buzz, vote, skip) and the server drives all transitions. Every state in `meta.state` is written exclusively by Cloud Functions.
