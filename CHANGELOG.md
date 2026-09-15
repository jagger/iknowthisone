# Changelog

## 2026-09-14

- Redesigned the landing screen (`NameScreen`) into a two-step flow: `/` now shows only "Create Room" / "Join Room" buttons, with each choice revealing just the fields it needs (email-only for create, name + room code for join) instead of rendering all fields at once. Fixes the duplicate-looking "Create Room" screen reported in #8.
