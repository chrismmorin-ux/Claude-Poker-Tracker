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

## HE-22 — Accept or override a proposed action

> When the app proposes the action it thinks I'm about to record, I want to accept it in one tap or override it just as fast, so a suggestion never costs me more than it saves.

**Authored:** 2026-07-31 (TVR Gate 3, `WS-312` R2) to close Gate 2 finding B1 (RED).

**Why this is a distinct job.** The atlas already covers *entering* (HE-11), *correcting* (HE-12) and *being advised* (the MH domain). Advice is **inert** — it renders an opinion and never touches the input. Pre-arming is a third category: the app pre-commits, on the user's behalf, to a value that is one tap from being written. Its success criteria are not derivable from the other three.

**The load-bearing question.** *Does a pre-armed wrong default get committed more often than an un-armed one?* If yes, the feature trades data quality for speed and should not ship. This job exists to make that question answerable rather than assumed.

### Dimensions
- **Frequency:** every seat-action, if pre-arming is always on.
- **Time budget:** the same sub-second budget as HE-11 — a proposal that needs reading has already failed.
- **Reversibility:** covered by HE-12, but a pre-arm makes one specific error *cheaper to make*, so undo alone is not a sufficient answer.

### Applicable personas
[mid-hand-chris](../../personas/situational/mid-hand-chris.md) (primary), [glance-return-chris](../../personas/situational/glance-return-chris.md) (**most at risk** — on return the pre-arm may reflect a state not yet re-read), [newcomer-first-hand](../../personas/situational/newcomer-first-hand.md) (cannot distinguish *proposed* from *recorded*), [ringmaster-in-hand](../../personas/situational/ringmaster-in-hand.md) (PROTO).

### Success criteria
- The proposed action is identifiable **without reading a label** — by position, colour and weight.
- Accepting costs exactly one tap; overriding costs exactly one tap. **Neither is privileged in cost, only in salience.**
- The proposed state is visually distinguishable from the recorded state by a treatment used nowhere else on the surface.
- Override rate is measurable, and a rising override rate is treated as evidence the proposal is wrong — not as user error.

### Failure modes
- **The proposal was committed without being read.** The defining failure. A user in a hurry taps the salient thing; if the salient thing was wrong, the read is now wrong and nothing signalled it.
- **Proposal mistaken for a recording.** User believes the action is already entered, moves on, and the seat is never recorded.
- **Rare actions become expensive.** If salience is bought by shrinking the alternatives, the app gets worse at capturing exactly the out-of-character events that reads are made of. See the binding constraint below.
- **Proposal churn.** A proposal that changes between glance-away and glance-back is worse than none — the user's spatial memory now points at the wrong control.

### Binding constraints
- **Never auto-commit.** This is a tracker; for villains it records what happened. A proposal may adjust **prominence and ordering only** (founder-ratified 2026-07-31; confirm-to-advance explicitly rejected).
- **Never shrink an alternative to make the proposal prominent** (Gate 2 amendment C2-A). All action targets stay equal-area and above the touch floor — measured as **rendered** size, not declared (see `WS-316`).
- **Hero vs villain asymmetry.** For hero, an engine recommendation is a legitimate basis for a proposal. For a villain, the only legitimate basis is population frequency — the engine's opinion about what a villain *should* do must never shape what gets recorded as what they *did*.

### Surfaces involved
`TableView` / `CommandStrip` action buttons and sizing presets. Sidebar (online) is auto-capture and out of scope.

### Related JTBD
HE-11 (the entry it accelerates), HE-12 (the recovery when it is wrong), HE-23 (the orbit-level goal it serves), MH-02 (advice freshness — a stale proposal is worse than a stale opinion).

## HE-23 — Record a full orbit without falling behind the dealer

> When a betting round is being dealt, I want to have the whole orbit recorded by the time action closes, so I'm never reconstructing from memory and never holding up the table.

**Authored:** 2026-07-31 (TVR Gate 3, `WS-312` R3) to close Gate 2 finding B2.

**Why this is a distinct job.** HE-11 is scoped to a *single seat-action*. But the existing accelerators — orbit tap-ahead, `Rest Fold`, `Fold to X`, `Check All` — all operate on **runs of seats**, and none of them has a job of its own; they were built as HE-11 optimisations. The unit the user actually experiences success or failure in is the **orbit**, and optimising a per-seat metric against a per-orbit goal is how you ship a faster button and a slower hand.

**Measured today:** a routine preflop orbit is already ~4 taps (orbit tap-ahead → sizing preset → call → batch fold). **The preflop path is close to optimal.** The cost lives postflop — where card entry is suspected to dominate and is currently unmeasured — and in re-orientation after look-aways.

### Dimensions
- **Unit of success:** the orbit, not the tap.
- **Hard deadline:** action closing on the street. Missing it means reconstructing from memory (HE-15's job, at much lower fidelity) or slowing the game.
- **Interruption profile:** many look-aways per orbit (see [glance-return-chris](../../personas/situational/glance-return-chris.md)).

### Applicable personas
[mid-hand-chris](../../personas/situational/mid-hand-chris.md), [glance-return-chris](../../personas/situational/glance-return-chris.md), [ringmaster-in-hand](../../personas/situational/ringmaster-in-hand.md) (PROTO), [multi-tabler](../../personas/core/multi-tabler.md) (live-analogue only).

### Success criteria
- The orbit is complete when action closes, with no seat left unrecorded.
- **Total taps and total wall-clock seconds per orbit** are the metrics — not taps per seat.
- Recovery from a look-away costs no measurable time.
- Batch shortcuts remain available without pre-commitment ambiguity (the `+N` fold-preview badge pattern already established by AUDIT-2026-04-21-TV F2).

### Failure modes
- **Falling behind and reconstructing.** The silent quality failure: the data still exists, but it is remembered rather than observed.
- **Holding up the table.** The social failure. For a host ([ringmaster](../../personas/core/ringmaster-home-host.md)) this is disqualifying.
- **Abandoning the orbit.** User gives up on the street and the hand is partially recorded — worse than not recording it, because it looks complete downstream.
- **Optimising the wrong segment.** Making preflop faster while postflop and player entry remain the real cost.

### Non-goals
- Does not require one tap per seat. A single tap covering five folds is *better* against this job, provided its scope is visible before commitment.

### Surfaces involved
`TableView` (orbit strip, batch controls, action buttons, card selector).

### Related JTBD
HE-11 (composes into this), HE-12, HE-15 (the fallback when this job fails), HE-22.

---

## Domain-wide constraints

- Hand entry must survive phone sleep and return to exact state on unlock (H-PLT05).
- One action entered wrongly cascades to incorrect advice — undo must be robust.
- Entry taps must be within thumb-reach zone for one-handed landscape use.

## Change log

- 2026-04-21 — Created Session 1b.
- 2026-05-06 — HE-18 (straddle) added in session-2026-05-06-straddle.
- 2026-07-31 — **HE-22 + HE-23 added** by TVR Gate 3 (`WS-312`), closing blind-spot findings B1 (RED — no job for app-proposed input) and B2 (no orbit-level job). **ID note:** HE-19/HE-20a/HE-20b/HE-21 were allocated to the all-in / side-pot family by `audits/2026-06-19-blindspot-allin-side-pots.md` and are referenced in `CommandStrip.jsx`, but were never written into this file — which is why the 2026-07-31 roundtable initially proposed the already-taken HE-19/HE-20. **Those four still need writing up here**; until then this domain's ID space is not self-describing and the next author will hit the same collision.
- 2026-05-11 — HE-12 amended with voice-correction sub-flow annotation. HE-16 clarification noting actions-vs-cards distinction. HE-NEW-VCE-01 added (Active, ratified by Gate 2 roundtable `2026-05-11-blindspot-vce`). HE-NEW-VCE-03 added (Proposed). Source: WS-181 Gate 1 + Gate 2.
