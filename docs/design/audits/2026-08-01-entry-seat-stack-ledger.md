# Gate 1 Entry — 2026-08-01 — Seat Stack Ledger (cash path)

**Surface (proposed):** `seat-stack-ledger`
**Driver:** VRN claim adjudication (Phase 2) is blocked — stack-depth claims bind to `null`.
**Lifecycle:** [LIFECYCLE.md](../LIFECYCLE.md) Gate 1 of 5.
**Status:** Complete — verdict below.

---

## Feature summary (as proposed)

Track per-seat chip stacks in the **cash** path, so that effective stack, SPR, and stack-depth
claims become computable at any point in a hand.

Entry cost is the whole design problem. Nine seats, live, one-handed, on a phone. Asking for nine
numbers a hand would destroy the capture loop that makes the tracker usable at all. So the
principle is **derive wherever possible, enter only where derivation is impossible**:

1. `seatStacks` ledger in `gameReducer` — `{ [seat]: { amount, source } }`.
2. **Carry-forward** on `NEXT_HAND`: previous amount − committed + won. Pot award is already
   known via `SET_POT_WINNER`.
3. **Seed** a new seat from the session buy-in (`SessionForm` already captures it).
4. **Correction affordance** for drift (rebuy, non-standard sit-down, missed pot).
5. Derived accessors reusing `pushFoldEngine/effectiveStack.js`.
6. Snapshot binding widens: `replaySnapshot` / `handReviewSnapshot` emit real values **with their
   source**. A genuinely unknown seat stays `null`.

**Founder ratification (this session):** *"I always record the winner, carry-forward is fine."*
Carry-forward's load-bearing assumption is therefore explicitly ratified, not inferred.

---

## Output 1 — Scope classification

| Dimension | Classification |
|---|---|
| **Type** | Data-model extension + minimal entry affordance |
| **Product line** | Live cash (primary). Tournament already has its own stack model; **not merged** — see Gap analysis. |
| **Surface count** | 1 extended (`TableView` — entry/correction), 2 corrected (`HeroStateSection`, VRN snapshots) |
| **Reversibility** | High. Additive IDB field, additive reducer state; removing it returns `null` and the binding rule already handles `null`. |
| **Blast radius** | Medium. `gameReducer` is the most-depended-on reducer in the app. |
| **User-visible** | Yes — a new mid-hand/between-hands interaction. Gate 4 artifact required. |

---

## Output 2 — Personas identified

### In scope

| Persona | Relationship |
|---|---|
| [`mid-hand-chris`](../personas/situational/mid-hand-chris.md) | **The binding constraint.** 1.5s focused-reading budget, often one-handed, full cognitive load. Any per-hand stack entry is disqualified by this persona alone. Carry-forward exists to respect it. |
| [`between-hands-chris`](../personas/situational/between-hands-chris.md) | Where correction actually happens — the only moment with slack for numeric entry. |
| [`push-fold-short-stack`](../personas/situational/push-fold-short-stack.md) | **Direct beneficiary.** This situation is *defined* by effective stack, and the cash path cannot currently compute it. |
| [`post-session-chris`](../personas/situational/post-session-chris.md) | Consumes the result — SPR/effective-stack in replay, and VRN claim adjudication. |
| [`chris-live-player`](../personas/core/chris-live-player.md) | Core persona; the ledger is invisible to him when it works. |

### Out of scope (explicit)

- `newcomer`, `apprentice-student` — the ledger is infrastructure, not a taught concept.
- `multi-tabler`, `online-mtt-shark` — online path derives stacks from capture, not entry.

### Persona sufficiency check

**No new persona required.** `mid-hand-chris` already models the time/attention budget precisely
enough to adjudicate the design, and it does so adversarially — it is the reason the obvious design
(prompt for stacks) is wrong. This is the intended use of the cast.

---

## Output 3 — JTBD identified

### Existing entries this touches

| JTBD | Domain | Relationship |
|---|---|---|
| **`MH-07`** Short-stack push/fold with ICM | mid-hand-decision | Depends on effective stack. Today, unreachable on the cash path — the input does not exist. |
| **`TS-37`** Stack-depth strategy zone updated live | tournament-specific | **The atlas gap in one row.** Stack depth is modelled *only* as a tournament concern. Cash stack depth has no entry, which is exactly why nothing was built. |

### Proposed new JTBD (Gate 2 candidate)

| Candidate | Statement |
|---|---|
| **`HE-NEW-STK-01`** Keep stacks current without counting chips | "When I'm recording a live cash hand, I want the app to know roughly what everyone has in front of them without me entering it each hand — so stack-depth reasoning is available without a data-entry tax I'd stop paying by the second orbit." |

**Reading:** warranted and narrow. It is a *hand-entry* job (HE), not a mid-hand-decision job —
the decision jobs (MH-07) already exist and are merely starved of input.

### Not served (explicit non-goals)

- Exact chip-accurate stacks. The ledger is an **estimate with provenance**, not an accounting
  system. A claim adjudicator needs "≈22bb, carried" far more than it needs an exact integer it
  cannot have.
- Tournament stacks — already modelled (`tournamentReducer`, `icmEngine/buildIcmStacks`). **Must
  not be merged**; live and tournament are distinct populations per the standing doctrine.

---

## Output 4 — Gap analysis

| Dimension | Status | Detail |
|---|---|---|
| **Personas** | 🟢 Covered | Cast is sufficient and `mid-hand-chris` is actively adversarial to the naive design. No new persona. |
| **JTBD** | ⚠️ 1 new entry | Stack depth exists in the atlas only as `TS-37` (tournament). Cash has no entry. One narrow HE candidate. |
| **Surfaces** | ⚠️ Extension + 2 corrections | No new surface, but `TableView` gains an affordance and two consumers change behaviour. Gate 4 artifact required. |
| **Heuristics** | ⚠️ Entry-cost risk, mitigated | The `mid-hand-chris` budget is the live risk. Mitigation is carry-forward, whose assumption is founder-ratified this session. Residual risk is *silent drift*, not entry cost. |
| **Tech path** | 🟢 Clear | Arithmetic is derivable from `actionSequence` + `SET_POT_WINNER`, both already single-source-of-truth. `effectiveStackBB` already exists and is correct. |
| **Data model** | ⚠️ Additive, plus a new provenance concept | Additive IDB field (invariant holds) + migration registry entry. The genuinely new idea is **stack provenance** (`entered` / `carried` / `buyin-default` / `unknown`) — a carried value is weaker evidence than an entered one and a grader must be able to tell. |
| **Governance** | 🟢 Compliant | The VRN binding rule ("a field the app does not track is `null`") is *satisfied*, not exceeded — this widens what is tracked. No prior ratification is contradicted. |

### Overall verdict: **YELLOW**

**Rationale:** Nothing is unmodelled — personas are sufficient, the tech path is clear, the data
change is additive, and no ratification is contradicted. But three dimensions carry real (not
cosmetic) work: an atlas gap that explains the feature's absence, a user-visible affordance needing
a Gate 4 artifact, and a new provenance concept that will propagate into every downstream consumer.
That is YELLOW, not GREEN.

**It is at the low end of YELLOW.** The two risks worth a roundtable are narrow and nameable
(below), which is why a *scoped* Gate 2 is proposed rather than the full five stages.

---

## Required follow-ups

1. **Gate 2 — scoped.** Full five-stage roundtable is disproportionate here (PROGRAM.md:
   proportional value over governance ceremony). Two stages carry the risk:
   - **Stage A (blind spot):** *silent drift.* Carry-forward is ratified, but a missed rebuy or a
     player topping up between hands corrupts the ledger with no signal. What makes drift visible
     without nagging? This is the failure mode that makes the whole feature worse than nothing —
     a confidently wrong stack is worse for claim adjudication than a `null`.
   - **Stage E (heuristics):** does the correction affordance survive `mid-hand-chris`, or is it
     strictly a `between-hands-chris` affordance? If the latter, say so and design it out of the
     mid-hand surface entirely.
2. **Gate 4 surface artifact** — `docs/design/surfaces/seat-stack-ledger.md`.
3. **`/decide` ADR** — stack provenance tiers, if Gate 2 ratifies the four-tier model.

---

## Observations without fixes (carried forward)

**Two pre-existing defects found while scoping, both in the target area:**

1. **`deriveEffStackAt` returns 0 for every cash hand.**
   (`src/components/views/HandReplayView/heroStateReplayUtils.js:100`) It reads
   `hand.gameState.players[seat].stack`; nothing in the cash path writes that field — `usePersistence`
   saves `currentStreet`, `dealerButtonSeat`, `mySeat`, `actionSequence`, `absentSeats` and nothing
   else. `HeroStateSection` has therefore shown effective stack `0` on every cash hand, and
   suppressed the SPR zone entirely, because `buildHeroState` gates on `gameState.effStack && …` and
   `0` is falsy. **Failed silently rather than degrading visibly** — the exact failure class
   `INVARIANTS.md` exists to catch.

2. **Two incompatible definitions of "effective stack" in the codebase.** `deriveEffStackAt`
   computes hero's *remaining* stack; `pushFoldEngine/effectiveStack.js::effectiveStackBB` computes
   the correct `min(hero, villain)`. Only the second is right. The first should be deleted onto the
   second rather than fixed in place.

Both are in scope for the implementation that follows and are pinned as regression tests.

---

## Open questions (Gate 2 inputs)

1. **Drift visibility.** What surfaces a stale stack without nagging? Candidate: age/provenance
   marker on the seat rather than a prompt.
2. **Correction affordance placement.** Mid-hand or between-hands only?
3. **All-in reconciliation.** An all-in call caps at the caller's stack. If the ledger says a seat
   has less than it actually shoved, that is *evidence the ledger is wrong* — should a
   contradiction auto-correct the ledger, or only flag it? Auto-correcting is tempting and probably
   right, but it means action data silently rewrites stack data.
4. **Does the ledger ever refuse?** If provenance is `buyin-default` and three orbits have passed,
   is that still admissible for claim adjudication, or should it degrade to `unknown`?

---

## Review sign-off

| Role | Status |
|---|---|
| Gate 1 author | Complete 2026-08-01 |
| Founder ratification (carry-forward) | ✅ Received this session |
| Gate 2 scope | Proposed (Stages A + E), pending founder waiver-or-run |

## Change log

| Date | Change |
|---|---|
| 2026-08-01 | Gate 1 authored. Verdict YELLOW (low end). Two pre-existing defects recorded. |
