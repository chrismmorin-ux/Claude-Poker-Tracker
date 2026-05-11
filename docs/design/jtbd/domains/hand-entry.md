# JTBD Domain — Hand Entry

Jobs that capture what happened in a hand — either live (manual taps) or online (auto-capture via sidebar).

**Primary personas:** All live-playing personas; [Multi-Tabler](../../personas/core/multi-tabler.md) and [Online MTT Shark](../../personas/core/online-mtt-shark.md) via auto-capture.

**Surfaces:** `TableView` (action buttons, seat grid), sidebar capture pipeline.

---

## HE-11 — One-tap seat action entry

> When a hand starts, I want to tap a single button per seat-action (fold / check / bet / raise / call), so I don't fall behind.

## HE-12 — Undo / repair a miskeyed action

> When I tap the wrong action, I want to undo or correct it without losing the hand, so data stays clean.

- **Voice-correction sub-flow (2026-05-11, ratified by Gate 2 roundtable `2026-05-11-blindspot-vce`):** When a voice card entry mishears one card (e.g., parser hears "queen of hearts" when hero said "king of hearts"), the correction path is a sub-case of HE-12 — same outcome ("correct without losing the hand"), different mechanic (chip-tap or re-speak-selected-chip instead of action-undo). Specified in `surfaces/voice-card-entry.md` correction-UX section. WS-181 kill criterion (c) revised per Gate 2 finding SC-10: correction requires ≤2 deliberate user actions (was: "≤1 tap" which is unachievable with any standard picker flow).

## HE-13 — Auto-capture via sidebar (online)

> When playing online on Ignition, I want actions captured automatically, so I enter nothing manually.

## HE-14 — Discreet entry that looks like texting

> When at a live table, I want data entry that visually looks like phone use (scrolling, texting), so I don't draw attention.

- See also [H-PLT04](../../heuristics/poker-live-table.md) — Socially discreet.

## HE-15 — Enter a hand post-session from memory

> When I remember a hand after the session ends, I want to enter it from memory with partial data, so the record survives.

## HE-16 — Voice input for action calls

> When my hands are on chips / cards, I want to call actions by voice, so I stay hands-free during action.

- State: **Proposed** (DISC-03). **2026-05-11 clarification:** HE-16 covers *actions* (fold / check / bet / raise / call), NOT cards. Card-entry-by-voice is the separate workstream WS-181 (board + villain showdown) — see HE-NEW-VCE-01. HE-16 is not subsumed by WS-181; it remains Proposed and may be taken up as a follow-on workstream if VCE ships and the grammar / hook infrastructure generalizes. R3 binding on WS-181 (no incremental follow-ups if VCE drops) means HE-16 is gated on VCE shipping first.

## HE-NEW-VCE-01 — Enter newly revealed cards hands-free

> When public cards are revealed (flop dealt, turn dealt, river dealt, or villain rolls hole cards at showdown), I want to record them into the app without looking down at the phone for 10+ seconds — so I stay table-present and don't draw attention to the act of recording.

- State: **Active** (ratified at Gate 2 by roundtable `2026-05-11-blindspot-vce`, Stage B).
- Primary persona: [Between-Hands Chris](../../personas/situational/between-hands-chris.md) — board reveal sits in the 5-15s sub-window at the start of the between-hands interval (before dealer-deal pressure builds).
- Secondary persona: [Mid-Hand Chris](../../personas/situational/mid-hand-chris.md) — when action arrives faster than expected, voice entry must abort cleanly (covered by HE-NEW-VCE-03).
- Tertiary persona: [Ringmaster (home-game host)](../../personas/core/ringmaster-home-host.md) — home tables run slower with higher social cover, so VCE likely passes kill-criteria thresholds for Ringmaster even if marginal for Chris at a casino.
- Surfaces: TableView (board entry — flop, turn, river), ShowdownView (villain hole-card entry at showdown).
- Distinguished from [HE-14](#he-14--discreet-entry-that-looks-like-texting) — HE-14's job is *not drawing attention via extended phone-staring* (visual discretion); HE-NEW-VCE-01's job is *keeping eyes on the table and hands available during a strategically-content-rich card reveal*. The failure modes differ: HE-14 fails when entry is conspicuous; HE-NEW-VCE-01 fails when entry forces a 10-second eyes-down window where Chris misses a timing tell or physical reaction.
- Distinguished from [HE-16](#he-16--voice-input-for-action-calls) — same modality (voice / Web Speech), different vocabulary (cards: 13 ranks × 4 suits + "of") + cadence (reveal-triggered, not decision-triggered) + surface zone (board / villain row, not action button zone).
- Success criteria (deferred to WS-181 kill criteria — Gate 4 ratifies numerically):
  - Per-card accuracy ≥ owner-set threshold at typical poker-room SPL (~70–75 dB).
  - End-to-end entry (PTT-hold → commit) faster than current tap baseline on ≥80% of trials.
  - Misheard card correctable in ≤2 deliberate user actions (revised per Gate 2 SC-10).
  - Zero false-commits: confirmation chips are inert until explicit commit tap.
- Failure modes (from Gate 2 roundtable):
  - Blank or sub-0.5s PTT release → must be a strict no-op (SC-3 CRITICAL).
  - Multi-villain showdown grammar gap → per-villain PTT recommended (SC-7 CRITICAL).
  - Mid-utterance interruption (dealer asks a question) → parser produces N chips for N parsed cards, no auto-commit (SC-6).
  - Mic permission denial → passive non-modal banner, flag stays ON, PTT grayed (E-6).
- Source: re-opened DISC-03; ticket WS-181; Gate 1 audit `audits/2026-05-11-entry-vce.md`; Gate 2 roundtable `roundtables/2026-05-11-blindspot-vce.md`.

## HE-NEW-VCE-03 — Abort a voice entry in progress without side effects

> When I am mid-utterance during a voice card entry and something at the table demands my attention (action arrives, dealer asks a question, villain reveals a tell I want to watch), I want to drop the voice entry instantly with zero residual UI state — no confirmation chips, no partial-board commit, no error toast — so the abort costs me nothing.

- State: **Proposed** (surfaced at Gate 2 roundtable `2026-05-11-blindspot-vce`, Stage B as a gap not covered by HE-12).
- Distinguished from [HE-12](#he-12--undo--repair-a-miskeyed-action) — HE-12 is repair-after-commit (a wrong card was committed and needs correction). HE-NEW-VCE-03 is abort-before-commit (no card was committed; the entry session itself is dropped). The mechanism differs: HE-12 uses the chip-tap / re-speak correction sub-flow; HE-NEW-VCE-03 is a strict no-op on PTT release.
- Primary persona: [Mid-Hand Chris](../../personas/situational/mid-hand-chris.md) — voice entry must not block the action zone if action arrives mid-entry.
- Surfaces: TableView, ShowdownView (both VCE-enabled surfaces).
- Success criteria: PTT release with blank transcript OR sub-0.5s utterance OR explicit cancel gesture = zero UI state change. Action buttons remain reachable in one tap throughout.
- Source: Gate 2 roundtable finding SC-5; specified in WS-181 Gate 4 surface spec.

## HE-17 — Flag a hand for post-session review while still recording it

> When something unusual happens in a hand that I want to think about later, I want to mark it for review in one tap without leaving the live-entry flow, so the thought isn't lost to between-hands cognitive flush.

- State: **Active** (JTBD) / feature gap — no surface serves it today. Surfaced via [blind-spot audit 2026-04-21 table-view §B1](../../audits/2026-04-21-blindspot-table-view.md).
- Primary persona: [Between-hands Chris](../../personas/situational/between-hands-chris.md); secondary: [Mid-hand Chris](../../personas/situational/mid-hand-chris.md) (if the flag is single-tap).
- Success criteria: flag persists with the hand record; can be retrieved via `hand-replay-view` or `analysis-view` filter.
- Distinguished from [SR-26](./session-review.md) (Proposed — flag disagreement + add reasoning): SR-26 is a **review-surface** action performed post-hand with commentary. HE-17 is a **live-surface** single-tap mark with no required metadata. HE-17 is the low-friction entry; SR-26 is the richer annotation that can be added later.
- Primary surface: `TableView` (1-tap mark); retrieval in `hand-replay-view` + `analysis-view`.

## HE-18 — Post a straddle for the current hand

> When a player at my table posts a straddle (UTG or BTN), I want to record it on the current hand before action begins, so the action order, pot, and recommendation engine treat the straddle as the effective last raise. If my table runs a permanent straddle rule, I want to set it once at session start so I don't have to mark every hand.

- State: **Active** — Sprint A2 of WS-002 ships the surface in this session; engine plumbing landed in commit `f3cdb89` (Sprint A1). Surface mechanic revised 2026-05-06 from long-press to context-menu row (long-press collided with the existing right-click / long-press menu trigger; see [`seat-context-menu.md`](../../surfaces/seat-context-menu.md)).
- Primary persona: [Between-hands Chris](../../personas/situational/between-hands-chris.md) (the operating mode); secondary: [Chris (live player)](../../personas/core/chris-live-player.md), [Ringmaster](../../personas/core/ringmaster-home-host.md) (home games run straddles often).
- Owner scope (WS-002 / SPR-010, ratified 2026-05-02): UTG + BTN positions only; UTG > BTN precedence; no re-straddle.
- Action-order rule (Mississippi, owner-clarified 2026-05-06): when a straddle is in play, first to act preflop = next active seat clockwise from the straddler (the straddle "takes the place of the BB" for action-order). UTG straddle → first action UTG+1; BTN straddle → first action SB. Postflop unaffected.
- Success criteria:
  - Right-click / long-press UTG or BTN seat → SeatContextMenu shows a `🎲 Straddle…` row when seat is eligible (no preflop action recorded yet, no existing straddle posted). Tap row → StraddleModal opens.
  - Modal pre-fills amount with session default (if set) or `2 × bb`; user-editable; "Post" / "Cancel."
  - Session-default straddle auto-applies to every hand; per-hand menu row is the override.
  - UTG > BTN precedence: STRADDLE entry already on this hand → row hidden on the other position's menu.
  - Posted straddle is visible in TableHeader (chip with position + amount) and on the straddler's seat ("STR" badge).
  - Undo via existing reset-hand / clear-seat path.
- Failure modes:
  - Row shown after action begins → mitigated by `actionSequence.length === 0` gate in TableView; row not rendered.
  - Row shown on non-eligible seats → mitigated by UTG / BTN-only computation; only those two seats receive the `onStraddle` callback.
  - Both UTG and BTN as session defaults → mitigated by single-radio config UI.
- Distinguished from [HE-11](#he-11--one-tap-seat-action-entry) — straddle is a posted blind before action begins, not a betting decision; from [HE-12](#he-12--undo--repair-a-miskeyed-action) — straddle removal uses the existing undo path.
- Primary surface: `TableView` (context-menu row, modal, header chip, seat badge); session-creation form (optional default).

---

## Domain-wide constraints

- Hand entry must survive phone sleep and return to exact state on unlock (H-PLT05).
- One action entered wrongly cascades to incorrect advice — undo must be robust.
- Entry taps must be within thumb-reach zone for one-handed landscape use.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-05-06 — HE-18 (straddle) added in session-2026-05-06-straddle.
- 2026-05-11 — HE-12 amended with voice-correction sub-flow annotation. HE-16 clarification noting actions-vs-cards distinction. HE-NEW-VCE-01 added (Active, ratified by Gate 2 roundtable `2026-05-11-blindspot-vce`). HE-NEW-VCE-03 added (Proposed). Source: WS-181 Gate 1 + Gate 2.
