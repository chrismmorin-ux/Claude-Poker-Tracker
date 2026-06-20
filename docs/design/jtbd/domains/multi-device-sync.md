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

## MT-64 — Verify extension capture matches played hands

> When I install the extension and play, I want to confirm it's capturing my hands correctly — that the count I see matches the hands I actually played — so I trust the data before I rely on its reads.

- State: **Proposed** (2026-04-22 OnlineView blind-spot audit, Stage-B finding B2 → WS-081 / DCOMP-W4-A3-F12).
- Primary personas: [Multi-Tabler](../../personas/core/multi-tabler.md), [Hybrid Context-Switch](../../personas/situational/hybrid-context-switch.md), [Rounder](../../personas/core/rounder.md).
- Surfaces: extension sidebar + `OnlineView` (`importedCount` indicator).
- Gap named by B2: the UI shows `importedCount` as a bare number with no way to tell whether it's the *expected* count after a played hand — "we count up therefore it's working" assumes the user knows what count to expect. The job is end-to-end capture verification, not a raw counter.
- Success criterion: after playing N hands, the user can confirm capture is complete/correct (not just that *a* number incremented).
- Failure modes: silent under-capture (dropped frames) reads as success; version-mismatch "continue anyway" masks a broken pipeline (see audit C4) with no capture-integrity signal.

---

## Domain-wide constraints

- Sync must respect offline-first — local always-authoritative during disconnect.
- Conflict resolution (two devices edit the same record) must be designed not tacked on.
- Privacy: sync endpoint sees user data; handling must be auditable.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-06-13 — Added MT-64 (verify extension capture matches played hands) — WS-081 / DCOMP-W4-A3-F12 Stage-B finding B2.
