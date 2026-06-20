# Audit — 2026-06-19 — Entry — All-In Declaration, Side Pots & Engine Integration

**Scope:** Recording an all-in bet/raise/call with a custom amount; deriving main + side pots from committed chips; attributing each pot's winner at showdown; optional per-seat stack entry (live or retroactive); and making the exploit engine all-in-aware (fold equity, SPR, contested pot, tree pruning, range freeze).
**Auditor:** Claude (main), session 2026-06-19.
**Method:** LIFECYCLE.md Gate 1 — scope classification, persona check, JTBD check, gap analysis.
**Status:** Open — **YELLOW** → triggers Gate 2 (Blind-Spot Roundtable) before Gate 4.
**Owner decisions (2026-06-19 conversation):** build all at once (recording + side pots + full engine integration); cash games first; the declared all-in amount is the load-bearing input — never block on stack data; per-seat stack sizes are optional enrichment, enterable live or retroactively before the hand is saved, sharpening side-pot precision and SPR when present.

---

## Executive summary

This is the feature the straddle build (2026-05-06) explicitly deferred — its "Out of scope" line named "all-in straddles." An all-in is not just another amounted bet: it caps a player's contribution, which splits the previously-single pot into main + side pots, breaks the showdown's single-winner-or-chop assumption (different pots can have different winners), and perturbs three of the four first-principles decision inputs the exploit engine reasons with (POKER_THEORY §7.1). It also introduces the app's **first per-seat stack/chip input**.

Every persona is already in the cast — no new persona. But the feature introduces **new interaction patterns** (all-in declaration, multi-winner pot attribution, per-seat stack entry) and a **new domain concept** (side pots / pot eligibility) that the JTBD atlas does not yet model. That is a YELLOW gap: it does not need a new persona or research domain, but it does need a Gate 2 roundtable to stress the multi-way / short-call / live-speed edges before the design is fixed. Verdict: **YELLOW**.

---

## Scope classification

**Cross-surface journey change** (not a simple surface-bound extension). The change touches the full hand lifecycle:
- `table-view` — all-in declaration affordance (on the existing custom-amount sizing entry), side-pot pot badge, optional per-seat stack entry.
- `showdown-view` — per-pot winner attribution (supersedes the single-winner `.find()` + chop model), retroactive stack entry window.
- `hand-replay-view` — side-pot display in review.
- Engine (no surface, but load-bearing): `exploitEngine/` live-advice path becomes all-in-aware.
- Persistence: hand record gains `seatStacks` + `pots` (DB v27 → v28, additive).

No new routed view. No new product line (cash main-app only; sidebar/online out of scope this pass). One new small affordance class (all-in toggle on the sizing entry) and one genuinely new concept (side pots).

## Personas check

Every relevant persona is in the existing cast. **No new persona required.**

| Persona | Relevance | In cast? |
|---|---|---|
| chris-live-player | core; declares/records all-ins every live session | ✅ |
| mid-hand-chris | situational; the all-in-declaration moment is an in-flow action — speed constraint binds | ✅ |
| between-hands-chris | situational; per-pot winner attribution + retroactive stack entry happen here (30–90s window) | ✅ |
| ringmaster-home-host | home games run frequent all-ins; host records others' shoves | ✅ |
| rounder, weekend-warrior, circuit-grinder, hybrid-semi-pro | live-table users facing all-ins in their pool | ✅ |
| apprentice-student | reviews all-in hands in replay (side-pot display) | ✅ |

## JTBD check

The hand-entry (HE-*) and mid-hand (MH-*) domains exist but do not model all-ins, side pots, pot eligibility, or stack tracking. Authored inline below (Gate 1 framework expansion); whether any decompose further is a Gate 2 Stage B question.

**HE-19 — Record an all-in and the resulting side pots** *(new)*
> When a player goes all-in for a custom amount and others keep playing, I want to record the shove and have the app split the committed chips into the correct main and side pots, so the pot figures stay right when stacks are unequal. The declared amount is enough — I should never be blocked for not knowing exact stacks.
- **State:** Active (this build). **Primary persona:** mid-hand-chris (declares), chris-live-player (records).
- **Success criteria:** all-in declared in ≤2 taps from the sizing entry; pots split correctly for N-way unequal stacks; works from the declared amount alone; a short all-in *call* (for less than owed) is recordable, not just a shove.
- **Distinguished from:** HE-11 (one-tap action — all-in is an amounted action with a cap flag), HE-18 (straddle — a posted blind, not a cap).

**HE-20 — Attribute each side pot's winner at showdown** *(new)*
> When a hand with side pots reaches showdown, I want to award each pot to its eligible winner — which may differ per pot — so the result and bankroll math are correct when a short stack wins the main pot but loses the side.
- **State:** Active. **Primary persona:** between-hands-chris.
- **Success criteria:** each pot awards independently among only its eligible seats; single-pot hands keep today's one-tap flow unchanged; chop within a pot still supported.
- **Distinguished from:** HE-11/HE-12; extends the existing showdown "pick winner" interaction from one global winner to per-pot.

**HE-21 — Record player stack sizes (optional, non-blocking)** *(new)*
> When I'm tracking diligently, I want to note players' chip stacks — live or right after the hand before it saves — so side pots and SPR-based advice get sharper. When I don't, everything still works.
- **State:** Active. **Primary persona:** chris-live-player (diligent mode), between-hands-chris (retroactive).
- **Success criteria:** stack entry is never required by any recording path; enterable live and retroactively before the hand commits; when present, feeds effective-stack/SPR and exact side-pot caps.
- **Distinguished from:** HE-19 (the all-in amount is the cap; stacks are independent enrichment).

**MH (mid-hand advice) — no new JTBD, correctness extension.** Existing MH-01/MH-04/MH-09 (recommended action / sizing vs calling range / SPR cues) must remain *correct* when a villain is all-in: fold equity against an all-in seat is zero, the contested pot is the side pot hero can win, SPR collapses, and future streets are a runout not a decision tree. This is a correctness obligation on served JTBDs, not a new job — but it is the load-bearing reason the engine work ships in the same effort.

## Gap analysis output

**YELLOW** — all personas exist; new interaction patterns + a new domain concept (side pots / eligibility) introduced. Triggers Gate 2.

| Dimension | Status | Notes |
|---|---|---|
| Persona coverage | GREEN | Every relevant persona already in cast |
| JTBD coverage | YELLOW | 3 new JTBDs (HE-19/20/21) authored; side-pot/eligibility is a new concept the atlas didn't model — Gate 2 Stage B confirms decomposition |
| Heuristic pre-check | YELLOW | New affordance on the live-cadence surface (H-PLT01 one-tap, H-PLT06 misclick absorption); multi-winner attribution adds showdown steps (H-N03 undo, H-N05 error prevention); first per-seat numeric stack input (H-ML06 touch target) — Gate 2 Stage E |
| Cross-surface | YELLOW | Touches table-view + showdown-view + hand-replay + engine + persistence; single-winner assumption lives in 3 places — Gate 2 Stage D confirms the ripple set |
| Autonomy red lines | GREEN | No engagement-pressure, no graded work, no demographic targeting; user-initiated entry only |

## Required follow-ups

- [ ] **Gate 2 (Blind-Spot Roundtable)** — scope: multi-way all-in with 3 unequal stacks (multiple side pots); short all-in call (capped call); sub-min-raise shove that does NOT reopen action vs one that does; hero-all-in vs villain-all-in; live-table speed of the all-in affordance; retroactive stack entry across phone-sleep; the engine's correctness obligation on MH-* advice.
- [ ] **Gate 4** — update `surfaces/table-view.md`, `surfaces/showdown-view.md`, `surfaces/hand-replay-view.md` after Gate 2 verdict.

## Change log

- 2026-06-19 — Created. HE-19/20/21 authored inline. Owner approved the all-at-once / cash-first / amount-is-load-bearing scope. Verdict YELLOW → Gate 2 next.
