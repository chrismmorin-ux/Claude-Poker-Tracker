# Journey — Briefing Review

**ID:** `briefing-review`
**Last reviewed:** 2026-04-21
**Status:** DOCUMENTED GAP — journey captured because the current state has a broken loop. This file describes the *intended* journey so the gap is visible.

---

## Purpose

The briefing-review journey covers the loop between "the engine notices something noteworthy about a villain's tendency" and "the user acknowledges / accepts / dismisses that note." It spans **three** surfaces today, but the navigation edges connecting them are incomplete.

This journey was documented to close the blind-spot from [2026-04-21 blind-spot audit §D2](../audits/2026-04-21-blindspot-table-view.md) — where a seat-level briefing count is visible but the action surface is in a different view.

---

## Primary JTBD

- `JTBD-SR-23` highlight worst-EV spots (the briefing is the notification; review closes the loop)
- (implicit, candidate CC JTBD) **"resolve a notification in the surface where I noticed it"** — not yet in atlas

## Secondary JTBD along the journey

- `JTBD-MH-03` check bluff-catch frequency on current villain (the briefing often carries the data that serves this)
- `JTBD-PM-07` edit an existing player's record (downstream — a briefing may reveal a tag to add)

## Personas

- [Chris](../personas/core/chris-live-player.md) — primary
- [Between-hands Chris](../personas/situational/between-hands-chris.md) — primary (this is the situation where review is feasible mid-session)
- [Post-session Chris](../personas/situational/post-session-chris.md) — primary (post-session batch review)
- [Rounder](../personas/core/rounder.md), [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — secondary

---

## Entry triggers

- **Live trigger:** analysis pipeline produces a new briefing for a seat's assigned player; per-seat badge count increments on `table-view`.
- **Between-session trigger:** user opens `players-view` between sessions and sees pending briefings in ExploitReviewQueue.
- **Deep-link trigger:** (not yet implemented) user taps a seat badge to jump directly to that player's briefings.

## Exit conditions

- **Success:** all pending briefings for the relevant player(s) are in a non-pending state (accepted / dismissed / snoozed).
- **Abort:** user navigates away mid-review without resolving; badges remain.
- **Partial:** some briefings resolved, some snoozed for later.

---

## Steps (INTENDED — current state has step 2 broken)

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `table-view` | User notices a seat badge with pending count >0 | none | glance ≤1s |
| 2 | `table-view` → `players-view` | **(BROKEN)** User taps badge → navigates to review queue, filtered to that player | `currentScreen=PLAYERS`, filter set | ≤2s (target) — CURRENTLY: no edge exists, user must navigate manually + find player |
| 3 | `players-view` | ExploitReviewQueue renders pending briefings for the seat's player | none | ≤1s |
| 4 | `players-view` | User reads briefing, decides (accept / dismiss / snooze) | `briefing.reviewStatus = <decision>` | ≤3s per briefing |
| 5 | `players-view` | User navigates back to `table-view` | `currentScreen=TABLE`, hand state preserved | ≤1s |
| 6 | `table-view` | Seat badge count decrements | automatic via tendency reload | ≤2s post-navigation |

Total target time (1 player, 1 briefing): **~10 seconds** — currently effectively ~25-40s due to missing deep-link.

---

## Variations

- **Variation A — Post-session batch review.** User enters players-view cold, triages queue sorted by severity. No table-view involvement. Current implementation works for this path.
- **Variation B — Between-hands priority review.** User sees badge mid-session, dips into players-view for one specific player, returns before next deal. **Blocked by step 2** — journey cost too high for between-hands budget (30-90s).
- **Variation C — Multi-player batch.** User sees badges on 3+ seats (fresh session after long break). Wants to clear all. Requires either a "review all pending from current session" filter or repeated step 2-5 loops.

## Failure / abort paths

- **Abort at step 2 (current default):** user sees badge, can't reach review queue without effort, ignores. Badges stack over time → notification fatigue → badges lose signal value.
- **Abort at step 4:** user reads briefing, unsure how to act, snoozes. Snooze must preserve state; resolution must be non-destructive.
- **Abort at step 5:** user navigates away via bottom-nav instead of back button. State should survive; hand state preservation is already in place.

---

## Observations

- **State that crosses surfaces:** `tendencyMap[playerId].briefings[].reviewStatus` is the authoritative state. Both `table-view` (read) and `players-view` (read+write) consume it.
- **Implicit ownership:** the reducer field has no documented owner. The analysis pipeline writes it initially; players-view writes transitions; table-view is read-only. This needs explicit callout in STATE_SCHEMA.
- **Cross-surface nav gap is the load-bearing defect.** Without step 2's edge, Variation B is impossible — which means between-hands-chris's JTBD is only notionally served.
- **Relationship to WEAKNESS_EXPLOIT_MAP deprecation (Phase 5 of Analysis Quality Overhaul):** briefings today are partially driven by the stopgap map. Future work may change briefing composition; the journey is independent of that.

## Linked audits / discoveries

- [AUDIT-2026-04-21-blindspot-table-view §D2](../audits/2026-04-21-blindspot-table-view.md) — surfaces the defect
- [DISC-2026-04-21-briefing-badge-nav](../discoveries/2026-04-21-briefing-badge-nav.md) — the fix proposal

---

## Change log

- 2026-04-21 — Created. Documents an intentionally-incomplete journey to make the cross-surface gap visible.
