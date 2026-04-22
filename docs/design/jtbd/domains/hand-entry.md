# JTBD Domain — Hand Entry

Jobs that capture what happened in a hand — either live (manual taps) or online (auto-capture via sidebar).

**Primary personas:** All live-playing personas; [Multi-Tabler](../../personas/core/multi-tabler.md) and [Online MTT Shark](../../personas/core/online-mtt-shark.md) via auto-capture.

**Surfaces:** `TableView` (action buttons, seat grid), sidebar capture pipeline.

---

## HE-11 — One-tap seat action entry

> When a hand starts, I want to tap a single button per seat-action (fold / check / bet / raise / call), so I don't fall behind.

## HE-12 — Undo / repair a miskeyed action

> When I tap the wrong action, I want to undo or correct it without losing the hand, so data stays clean.

## HE-13 — Auto-capture via sidebar (online)

> When playing online on Ignition, I want actions captured automatically, so I enter nothing manually.

## HE-14 — Discreet entry that looks like texting

> When at a live table, I want data entry that visually looks like phone use (scrolling, texting), so I don't draw attention.

- See also [H-PLT04](../../heuristics/poker-live-table.md) — Socially discreet.

## HE-15 — Enter a hand post-session from memory

> When I remember a hand after the session ends, I want to enter it from memory with partial data, so the record survives.

## HE-16 — Voice input for action calls

> When my hands are on chips / cards, I want to call actions by voice, so I stay hands-free during action.

- State: **Proposed** (DISC-03).

## HE-17 — Flag a hand for post-session review while still recording it

> When something unusual happens in a hand that I want to think about later, I want to mark it for review in one tap without leaving the live-entry flow, so the thought isn't lost to between-hands cognitive flush.

- State: **Active** (JTBD) / feature gap — no surface serves it today. Surfaced via [blind-spot audit 2026-04-21 table-view §B1](../../audits/2026-04-21-blindspot-table-view.md).
- Primary persona: [Between-hands Chris](../../personas/situational/between-hands-chris.md); secondary: [Mid-hand Chris](../../personas/situational/mid-hand-chris.md) (if the flag is single-tap).
- Success criteria: flag persists with the hand record; can be retrieved via `hand-replay-view` or `analysis-view` filter.
- Distinguished from [SR-26](./session-review.md) (Proposed — flag disagreement + add reasoning): SR-26 is a **review-surface** action performed post-hand with commentary. HE-17 is a **live-surface** single-tap mark with no required metadata. HE-17 is the low-friction entry; SR-26 is the richer annotation that can be added later.
- Primary surface: `TableView` (1-tap mark); retrieval in `hand-replay-view` + `analysis-view`.

---

## Domain-wide constraints

- Hand entry must survive phone sleep and return to exact state on unlock (H-PLT05).
- One action entered wrongly cascades to incorrect advice — undo must be robust.
- Entry taps must be within thumb-reach zone for one-handed landscape use.

## Change log

- 2026-04-21 — Created Session 1b.
