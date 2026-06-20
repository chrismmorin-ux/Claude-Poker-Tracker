# Blind-Spot Roundtable — 2026-06-19 — All-In Declaration, Side Pots & Multi-Winner Attribution

**Trigger:** Gate 1 YELLOW (`2026-06-19-entry-allin-side-pots.md`) — new interaction patterns + new domain concept (side pots / pot eligibility).
**Voices:** product-ux-engineer (UX/persona/heuristic), failure-engineer (edge-case/data-integrity/cross-surface), general-purpose (external-market lens).
**Method:** ROUNDTABLES.md five stages.
**Overall verdict: RED.** Two independent structural blockers + one pre-existing correctness bug that becomes load-bearing. The all-in *recording* primitive (HE-19) and *optional stack entry* (HE-21) can be designed now; the *multi-winner showdown* (HE-20b) needs a revised interaction + state model before Gate 4, and the pot-accounting foundation must be corrected first.

---

## Feature summary

Declare a bet/raise/call all-in with a custom amount; committed chips split into main + side pots; each pot awarded independently at showdown (winners may differ per pot); optional per-seat stack entry (live or retroactive). All-in declaration = a new affordance on the existing custom-amount sizing entry. Multi-winner attribution supersedes a single-winner model enforced in three places in ShowdownView.

---

## Stage A — Persona sufficiency — ⚠️ Patch
- **A1.** No situational persona covers recording a *multi-player* all-in where hero is not the all-in player (stacked shoves to track before hero's own decision). Patch `ringmaster-in-hand.md` + `between-hands-chris.md` with the multi-all-in cognitive-load note.
- **A2 / external Blind-spot 1.** Missing a **"result-only logger"** archetype. The entire mature tracker market is bankroll-first: many live players just want to log "shoved $300, lost to a set, −$300" and move on. If our cast assumes the analytical hero who reconstructs every street, we miss the user who wants the financial outcome without a per-pot walk. → the all-in flow needs a **degenerate fast path**; per-pot accounting must be opt-in depth, never a gate.

## Stage B — JTBD coverage — ⚠️ Expansion
- **B1.** Decompose **HE-20 → HE-20a** (no side pots → today's one-tap "Won" flow, must stay zero-friction) **+ HE-20b** (per-pot attribution walk). Keeping them merged risks the multi-pot machinery leaking into every showdown.
- **B2.** No JTBD for the **"missed the all-in / don't know if there are side pots"** recovery state — the gap between declaration time (HE-19) and showdown (HE-20). A user who recorded a plain CALL arrives at showdown with no split and no recovery path. Author a retroactive-all-in-clarification job.
- **B3.** HE-21 needs a **partial-stack staleness contract**: what the engine does when some seats have stacks and others don't (infer / degrade / flag).
- **External Blind-spot 2.** Side pots must be **derived from committed amounts, never entered** — no competitor exposes side-pot entry; this matches our own first-principles doctrine (pot structure is an output, not an input). The only showdown input should be "who won," per eligible group; eligibility is derived.

## Stage C — Situational stress — ❌ Fundamental mismatch
- **C1 (CRITICAL).** Multi-way all-in with 3+ unequal stacks needs an N-pot model `pots: [{amount, eligibleSeats}]`, not `{main, side}`. Folded-but-contributed **dead money** must count in the pot total while being excluded from eligibility — using `foldedSeats` for both is wrong in opposite directions.
- **C2 / E4.** All-in toggle adjacent to GO on the custom form is a misclick surface; mid-hand-chris's error tolerance is near-zero and a mis-set flag silently corrupts side-pot math.
- **C3 (the recording model is too thin).** "all-in" is more than one flag:
  - **Short all-in CALL** (stack < amount owed) is **currently unrepresentable** — `match` dispatches the full owed amount; `{raiseTo: stack}` throws because stack < currentBet.
  - **All-in for exactly the current bet** records as a plain CALL — undetectable as all-in.
  - **All-in blind below the BB** — `getSeatContributions` hardcodes `contributions[bbSeat] = bb`, inflating a phantom amount.
  - **Sub-min-raise shove does NOT reopen action** — needs a `reopensAction` signal or street-advance + advisor misfire.
- **C4.** Ringmaster cannot record a multi-shove sequence in ≤2s/interaction via the sizing-editor workflow — needs a batch "ALL IN" affordance.
- **C5 (HIGH).** Hero-already-all-in: advisor keeps emitting future-street advice; with `seatStacks` absent, `effectiveStack=null`/`spr=null` bypass the shove-or-fold guard and produce `betSize = null×fraction → 0`, which the breakeven formula reads as "any fold profitable" — confidently wrong advice. Needs a `heroIsAlreadyAllIn` short-circuit + UI "no more decisions" signal.
- **C-retroactive (HIGH).** Stack entry dispatched *after* Next Hand resets state lands on the **new** hand. Retroactive entry must write to the saved IDB record **by handId** (or be gated to the showdown street before reset).
- **External Blind-spot 3/4.** Opponent-stack tracking is **friction-fatal across the whole market** and largely **redundant** — the all-in amount already reveals the effective stack at the only moment side-pot math needs it. If kept, unit must be **big-blinds / stack-increments**, never exact chips. Speed wins this category (sub-3s capture); a correct-but-slow form loses to approximate-but-fast.

## Stage D — Cross-surface — ⚠️ Partner surfaces need updates
- **D1.** Replay/`replayAnalysis` consumes `calculatePot().total` (scalar) — side pots invisible without explicit support.
- **D2 (HIGH).** **Session P&L double-counts** with two `won` entries per hand — Stats/Sessions aggregate each `won` as a full win. Winner attribution must carry per-pot amounts, and the aggregator must sum per-pot, not per-`won`-entry.
- **D3.** Bayesian range anchor must run on *complete* showdown state, not a partial mid-attribution save (debounce can persist partial state).
- **D4.** **Extension (Ignition) HUD** reads `pot` as a scalar via SyncBridge — keep the scalar `pot`/`total` intact and **add** `pots` alongside; do not replace the scalar (cross-product contract break, no enforcement gate).

## Stage E — Heuristic pre-check — ⚠️ Adjustments
- **E1/E5 (structural).** `anyoneHasWon` global boolean hides all Won buttons after the first winner → second pot's winner unrecordable. Must become a **per-pot completion signal**.
- **E2.** `handleWonSeat` auto-mucks all other seats → obliterates the side-pot winner; the 12s undo toast is a weak net in the post-pot social chaos. Auto-muck must be **pot-eligibility-aware**, not seat-aware.
- **E3.** No "all-in call vs full call" disambiguation at record time → proposed: long-press CALL reveals "Call full ($X) / All-in ($Y)".
- **E6/E7.** First per-seat numeric stack input + winner-overlay Next Hand button must hold ≥44px at the lowest A22 scale factor.

---

## Pre-existing bug discovered (foundation must be fixed first)

**The pot is over-counted on raises.** `calculatePot` / `getSeatContributions` do `total += entry.amount` for RAISE/BET, treating the `raiseTo` value as an increment. When a seat raises after already contributing on that street (re-raise, raise-over-call, blind-then-raise), the pot inflates by `alreadyIn`. The CALL branch already computes the increment correctly; RAISE/BET never did. It's masked today (the test uses a clean raiser with no prior contribution) but becomes load-bearing the moment pots must sum exactly to committed chips. **Any `calculateSidePots` built on `getSeatContributions` inherits the inflation.** Fix `calculatePot` + `getSeatContributions` (`src/utils/potCalculator.js`) and add the missing test before authoring side-pot math.

---

## Required invariants (add to INVARIANTS.md before ship)

- **INV-POT-RAISETO-IS-NOT-INCREMENT** — net contribution from a RAISE = `raiseTo − alreadyIn`, never `+= raiseTo`.
- **INV-POT-CONSERVATION** — `sum(pots[i].amount) === totalContributed` (excluding phantom blind credits); assert inside `calculateSidePots` + fixture (stacks 47/120/200 → main 141 + side 146 = 287).
- **INV-ALLIN-FLAG-ON-ALL-CALLS** — any CALL/RAISE that leaves the seat with 0 behind (or is short of the full bet) carries `allIn: true`, so all-in is detectable from `actionSequence` alone, without `seatStacks`.
- **INV-MULTIWIN-NO-AUTOMUCK** — with ≥2 pots, never auto-muck a seat still eligible for an un-attributed pot.
- **INV-HEROALLIN-ADVISOR-SKIP** — hero all-in → advisor returns a degraded `{bestAction:null, reason:'hero-is-all-in'}`, never a zero/null-size bet candidate.

---

## Overall verdict: RED — with rationale

The HE-19 recording primitive and HE-21 stack entry are designable now. But (1) the showdown's single-winner state model (`anyoneHasWon` + `winnerSeat.find()` + auto-muck-all) is mechanically incompatible with side pots and must be redesigned before Gate 4; and (2) the pot-accounting foundation has a real over-count bug that side-pot math would inherit. Both precede design. The external lens also forces a genuine scope decision on whether opponent-stack tracking belongs in v1 at all (friction-fatal + largely redundant with the all-in amount).

## Required follow-ups

- [ ] **Gate 3 / owner decisions** — (a) opponent-stack tracking: keep optional-light, change unit to BB/increments, or defer? (b) all-in affordance: dedicated "ALL IN" button vs toggle? (c) confirm result-only fast path for all-in hands.
- [ ] **Foundation fix** — correct RAISE/BET over-count in `potCalculator.js` + test, before `calculateSidePots`.
- [ ] **Recording model** — represent short all-in call (`{callAmount, allIn:true}`), all-in-exact-call flag, all-in blind cap, and `reopensAction`.
- [ ] **Showdown redesign** — per-pot winner state replacing the three single-winner globals; pot-eligibility-aware auto-muck; inline eligible-seat context.
- [ ] **Cross-surface** — per-pot P&L attribution (no double-count); keep scalar `pot` + add `pots` for the extension; replay side-pot display; complete-state Bayesian anchoring.
- [ ] **Persona/JTBD patches** — result-only logger note; HE-20 → 20a/20b; retroactive-clarification JTBD; HE-21 staleness contract.
- [ ] **Invariants** — author the five above.

## Change log
- 2026-06-19 — Created. Three-lens roundtable, RED. Pre-existing pot over-count discovered. Five invariants drafted. Owner decisions routed for Gate 3.
