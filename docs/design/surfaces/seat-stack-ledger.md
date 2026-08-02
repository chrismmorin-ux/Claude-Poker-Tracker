# Surface — Seat Stack Ledger

**ID:** `seat-stack-ledger`
**Status:** Gate 4 authored 2026-08-01. Ledger core implemented; wiring + affordance in progress.
**Gate 1:** [`2026-08-01-entry-seat-stack-ledger.md`](../audits/2026-08-01-entry-seat-stack-ledger.md) — YELLOW
**Gate 2:** [`2026-08-01-blindspot-seat-stack-ledger.md`](../audits/2026-08-01-blindspot-seat-stack-ledger.md) — scoped (A+E), commitments C-1..C-6
**Consumer surface:** [`voice-reasoning-notes`](./voice-reasoning-notes.md) — the driver for this work

---

## Purpose

Make effective stack, SPR, and stack depth computable on the **live cash** path, so stack-depth
reasoning stops binding to `null`.

**Non-goals (explicit):**
- **Not chip accounting.** An estimate with provenance, not a reconciliation ledger. "≈22bb,
  carried" is more useful to a consumer than an exact integer nobody at a live table can supply.
- **Not tournament stacks.** Already modelled (`tournamentReducer`, `icmEngine/buildIcmStacks`).
  Distinct populations; never merged.
- **Not a data-entry surface.** If it costs a number per seat per hand, it will be abandoned by the
  second orbit and is therefore worthless.

---

## Founder ratifications (binding)

| ID | Statement |
|---|---|
| **S1** | *"I always record the winner, carry-forward is fine."* — 2026-08-01. This is what makes the carry-forward arithmetic load-bearing rather than speculative. |

---

## The core model — estimate with provenance

Entry cost forbids asking for nine numbers a hand, so most values are **derived**. A derived value
is weaker evidence than an observed one, and every consumer must be able to tell which it has.

| Source | Meaning | Admissible? |
|---|---|---|
| `entered` | Founder typed it, or an action proved it | ✅ |
| `carried` | Arithmetic from a known prior value | ✅ |
| `buyin-default` | Assumed from session buy-in; never observed | ❌ |
| `stale` | Too far from its last observation | ❌ |
| `unknown` | No basis at all | ❌ |

**Decay (C-1).** `entered` → `carried` after the hand it was observed in. `carried` → `stale` after
one orbit (`STALE_AFTER_HANDS = 9`). `buyin-default` → `stale` after a single hand.

**`observedAtHand` records the last time the stack was EVIDENCE-GROUNDED, not the last time
arithmetic touched it.** Carry-forward preserves it. Conflating the two would make a stack nobody
has looked at in fifty hands read as freshly carried, forever.

### INV-STK-01 — the safety property (C-2)

> A stack-depth claim may only be **disproven** against a stack whose provenance is `entered` or
> `carried`. Any other provenance yields **`blocked`**, naming the gap.

The founder's posture is that his claims stand until disproven *with data*. Refuting a true claim
with a drifted number inverts the entire purpose of adjudication. **Drift must produce abstention,
never a false refutation.** A `null` is honest; a confidently wrong `22bb` is not.

### Observed beats derived (C-3)

A seat that commits more than the ledger credits it with has proved the ledger wrong. The ledger is
raised to the committed amount and promoted to `entered`.

This is not action data "silently rewriting" stack data — it is the same trust hierarchy
`poolBaseline.js` already applies to population stats, where a higher-trust source dominates a
lower-trust one. It also means **the most common drift source self-heals with zero interaction**:
someone having more chips than we thought is revealed the moment they commit them.

`calculateSidePots`' `isEstimated` flag gates this. When a bet/raise lacked an amount, contributions
are unreliable and are not treated as observations; affected seats degrade to `stale` rather than
propagating a corrupted number as `carried`.

---

## Effective stack — one definition

`effectiveStackAt` is the single definition: `min(hero, deepest live opponent)`.

Multiway is bounded by the **deepest** opponent, not the shallowest — hero can still play his whole
stack against whoever covers him, and a short third player does not cap what is at stake against the
deep one.

**Supersedes `heroStateReplayUtils.deriveEffStackAt`,** which computed hero's *remaining* stack and
called it effective stack. Different quantity; not the one any strategy consumer wants.

---

## Interaction (C-5, C-6)

| State | Affordance |
|---|---|
| **Mid-hand** | Passive staleness marker on the seat. No number, no prompt, no entry. |
| **Between hands** | Per-seat single-value correction, reached from the seat itself. |

`mid-hand-chris` has a ~1.5s focused-reading budget, is frequently one-handed, and lists *layout
reflow while trying to read* as a named frustration. There is no version of mid-hand numeric entry
for nine seats that survives this persona, and a "present but optional" compromise is rejected — it
occupies space, invites misgrab (the VRN / AnchorObservation adjacency lesson), and risks reflow in
exactly the seconds the persona cannot absorb one.

**No all-seats reconciliation grid** (C-6). Correcting three seats is three deliberate per-seat
acts, because each is an independent observation. A grid invites reconciliation, which is the
accounting task this surface explicitly refuses.

---

## Verification

| Area | Checks |
|---|---|
| Ledger arithmetic | Carry-forward across an orbit; split pots; all-ins; chip conservation |
| **Provenance decay** | Each tier's expiry; staleness measured from observation not arithmetic |
| **INV-STK-01** | Stale/buy-in/unknown never admissible; abstention over guessing |
| Contradiction | Over-commit corrects and promotes; under-commit does nothing; estimated hands ignored |
| Effective stack | Heads-up min; multiway deepest-opponent bound; weakest-source reporting |
| Regression | `deriveEffStackAt` deleted onto `effectiveStackAt`; SPR zone renders for cash hands |

---

## Known issues

**[STK-1] `deriveEffStackAt` returns 0 for every cash hand — pre-existing, found at Gate 1.**
(`src/components/views/HandReplayView/heroStateReplayUtils.js:100`) It reads
`hand.gameState.players[seat].stack`; nothing in the cash path writes that field. `HeroStateSection`
has therefore shown effective stack `0` and suppressed the SPR zone entirely on every cash hand,
because `buildHeroState` gates on `gameState.effStack && …` and `0` is falsy. Failed silently rather
than degrading visibly. Fixed as part of this surface's implementation.

---

## Implementation status

| Piece | Status |
|---|---|
| `src/utils/seatStacks/stackLedger.js` | ✅ 32 tests |
| `src/utils/seatStacks/handSettlement.js` | ✅ 7 tests |
| `gameReducer` wiring (seed / reconcile / carry-forward / decay) | ✅ 12 tests |
| `useGameHandlers.nextHand` settles before clearing the sequence | ✅ |
| Persistence — additive `seatStacks` + `handNumber` on the hand record | ✅ |
| Snapshot binding (`replaySnapshot`) | ✅ |
| `deriveEffStackAt` deleted onto `effectiveStackAt` (STK-1) | ✅ |
| Snapshot binding (`handReviewSnapshot`) | ✅ |
| `useSeatStackLedger` — seeding + C-3 self-healing reconciliation | ✅ |
| Correction affordance (between-hands, C-5/C-6) | ✅ 9 tests |

Values still START inadmissible (`buyin-default`) and become admissible only once a seat's action
proves a real number or the founder enters one. That ordering is intended — the ledger earns
admissibility from evidence rather than beginning trusted.

**[STK-2] Empty-input guard, found in test.** The correction field committed `Number('') === 0` on a
stray confirm. Zero is both a legitimate stack and the strongest provenance, so a blank confirm wrote
"this seat is stacked off" as an *observation* — which would then confidently disprove claims. Empty
input is now rejected before any coercion. Same `Number(null/'')` trap as the `sprFrom`/`toBigBlinds`
bug caught earlier; it is worth assuming this coercion is wrong wherever absence is meaningful.
