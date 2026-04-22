# JTBD Domain — Multi-Device / Sync

Jobs involving data crossing devices — phone-to-desktop, backup, restore.

**Primary personas:** [Rounder](../../personas/core/rounder.md), [Hybrid](../../personas/core/hybrid-semi-pro.md), [Coach](../../personas/core/coach.md), [Analyst](../../personas/core/analyst-api-user.md).

**Surfaces:** sync layer (largely not implemented — Firebase PAUSED).

---

## MT-60 — Phone-to-desktop instant sync

> When I enter a hand on phone, I want it available on desktop within seconds, so review is seamless.

- State: Paused (Firebase cloud sync).

## MT-61 — Cloud backup on phone death

> When my phone dies, I want my data already backed up, so I don't lose sessions.

- State: Paused.

## MT-62 — Offline-first at signal-less casino

> When playing at a casino with poor connectivity, I want local-first entry that syncs later, so I never wait for the network.

- Active (IndexedDB primary; no sync needed when offline).

## MT-63 — New-device full restore <60s

> When I set up on a new device, I want full restore in under a minute, so setup isn't a barrier.

- State: Paused.

---

## Domain-wide constraints

- Sync must respect offline-first — local always-authoritative during disconnect.
- Conflict resolution (two devices edit the same record) must be designed not tacked on.
- Privacy: sync endpoint sees user data; handling must be auditable.

## Change log

- 2026-04-21 — Created Session 1b.
