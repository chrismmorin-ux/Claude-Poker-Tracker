# Gate 2 Blind-Spot Roundtable (scoped) — 2026-08-01 — Seat Stack Ledger

**Gate 1:** [`2026-08-01-entry-seat-stack-ledger.md`](./2026-08-01-entry-seat-stack-ledger.md) — YELLOW (low end)
**Scope:** Stages A and E only. Stages B/C/D waived — see rationale.
**Status:** Complete. Three findings, all resolved into design commitments.

---

## Scoping rationale

PROGRAM.md: *proportional value over governance ceremony.* Gate 1 landed YELLOW on three
dimensions, but two of them (atlas gap, Gate 4 artifact) are **work items, not unknowns** — they
have obvious resolutions and no blind spot to surface. The genuine unknowns are narrow:

- **Stage A** — what the framework cannot see: *silent drift*.
- **Stage E** — heuristic survival of the correction affordance against `mid-hand-chris`.

Stages B (JTBD ratification), C (surface taxonomy) and D (data model) are **waived**: one narrow
JTBD candidate, an extension rather than a new surface, and an additive field. Running them would
produce ceremony, not insight.

---

## Stage A — Blind spot: silent drift

### The failure the framework does not see

Carry-forward is founder-ratified and arithmetically sound. Its blind spot is not arithmetic — it
is **events outside the action sequence**. A rebuy, a top-up between hands, a player standing up
and a new one sitting with a different stack: none of these appear in `actionSequence`, so the
ledger carries forward a number that is simply false, indefinitely, with no signal.

**This is worse than not having the feature.** The founder's ratified posture is that his claims
are *valid until disproven with data*. A drifted ledger disproves a true claim using fiction. The
feature's whole purpose — making claims adjudicable — is inverted into manufacturing false
negatives. A `null` is honest; a confidently wrong `22bb` is not.

### Finding A-1 — The ledger must never be more confident than its provenance

**Resolution (binding): drift must produce abstention, not a wrong verdict.**

Provenance decays with distance from evidence:

| Source | Meaning | Decays to |
|---|---|---|
| `entered` | Founder typed it, or an action proved it | `carried` after the hand it was set |
| `carried` | Derived by arithmetic from a known prior value | `stale` after `STALE_AFTER_HANDS` without confirmation |
| `buyin-default` | Assumed from session buy-in; never observed | `stale` after one orbit |
| `stale` / `unknown` | No admissible basis | — |

Adjudication treats `stale` and `unknown` as **not-checkable → `blocked`**, never `disproven`.
That is the safety property, stated as an invariant:

> **INV-STK-01.** A stack-depth claim may only be *disproven* against a stack whose provenance is
> `entered` or `carried`. Any other provenance yields `blocked`, naming the gap.

This makes the failure mode *abstention*, which is recoverable, rather than *false refutation*,
which corrodes the founder's trust in the whole adjudication layer.

### Finding A-2 — Observed action beats derived ledger (resolves Gate 1 open question 3)

Gate 1 asked whether an all-in contradicting the ledger should auto-correct or merely flag, worrying
that auto-correction means "action data silently rewrites stack data."

**That framing is wrong, and the codebase already contains the correct one.** `poolBaseline.js`
implements a four-level trust hierarchy in which a higher-trust source *dominates* a lower-trust one
as evidence accumulates. Stacks are the same shape:

- An all-in of $340 is **observed evidence** that the seat had $340.
- A carried-forward figure is **derived inference**.

Observed dominates derived. This is not a silent rewrite; it is the trust hierarchy working. So:

**Resolution (binding):** a committed amount exceeding the ledger's figure for that seat
**corrects the ledger and promotes provenance to `entered`**, because the seat's stack is now
evidence-grounded. The correction is recorded, not silent.

This also means the most common drift source — someone having more chips than we thought, revealed
the moment they commit them — **self-heals with zero interaction**. That result carries directly
into Stage E.

### Finding A-3 — Visibility must be passive

Any prompt, badge-with-number, or modal asking the founder to confirm a stack re-imports the entry
cost that carry-forward exists to eliminate, and violates `mid-hand-chris`'s reading budget.

**Resolution (binding):** staleness is shown as a **subtle marker on the seat**, carrying no number
and demanding no response. It is legible if looked at and invisible if not. No prompt, ever.

---

## Stage E — Heuristics: does correction survive `mid-hand-chris`?

`mid-hand-chris`: 3–30s decision window, ~1.5s focused-reading budget, frequently one-handed, full
cognitive load, and an explicit frustration with *layout reflow while trying to read*.

Numeric entry for a nine-seat table fails every one of those constraints. There is no version of
mid-hand numeric stack entry that survives this persona.

### Finding E-1 — Correction is a between-hands affordance, full stop

The tempting compromise — "make it available mid-hand but optional" — is rejected. An affordance
present mid-hand occupies space, invites misgrab (the `AnchorObservationSection` / VRN adjacency
lesson from the sibling surface), and adds a reflow risk during the exact seconds the persona
cannot absorb one.

**Resolution (binding):** the correction affordance exists **only** in the between-hands state.
Mid-hand renders the passive staleness marker (Finding A-3) and nothing else.

This is affordable precisely because of Finding A-2: mid-hand contradictions self-correct from
observed action, so the mid-hand case that would most need correction does not need the affordance.
Rebuys and sit-downs — the cases that do need it — happen between hands by nature.

### Finding E-2 — The affordance must not become a chip-accounting surface

`mid-hand-chris`'s cognitive-load constraint applies in weakened form between hands. A nine-seat
grid of numeric inputs invites the founder to *reconcile*, which is an accounting task the feature
explicitly does not want (Gate 1 non-goal: "estimate with provenance, not an accounting system").

**Resolution (binding):** correction is **per-seat and single-value**, reached from the seat itself.
No all-seats reconciliation view. If the founder wants to fix three seats, that is three deliberate
per-seat acts — which is correct, because each is an independent observation.

---

## Design commitments (binding output)

| ID | Commitment |
|---|---|
| **C-1** | Provenance tiers `entered` / `carried` / `buyin-default` / `stale` / `unknown`, with decay. |
| **C-2** | **INV-STK-01** — only `entered` or `carried` may *disprove* a claim; all else yields `blocked`. |
| **C-3** | Committed amount > ledger ⇒ ledger corrected, provenance promoted to `entered`, correction recorded. |
| **C-4** | Staleness shown as a passive marker with no number and no prompt. |
| **C-5** | Correction affordance is between-hands only; absent mid-hand. |
| **C-6** | Correction is per-seat and single-value. No reconciliation grid. |

---

## Carried to Gate 4

- Marker visual treatment (must survive the panel's ancestor `scale(0.615)` — see VRN-1).
- `STALE_AFTER_HANDS` value. Proposed: one orbit (9 hands) for `carried`, immediate for
  `buyin-default` once the seat has acted in a hand without confirming.

## Deferred / not addressed

- Tournament stacks — separate model, explicitly not merged.
- Online path — stacks derive from capture, not entry; out of scope.
- Multi-way side-pot stack reconstruction beyond the committed-amount check. `calculateSidePots`
  already derives pots without stored stacks; no change proposed.

---

## Sign-off

| Role | Status |
|---|---|
| Roundtable (scoped A+E) | Complete 2026-08-01 |
| Founder ratification | Carry-forward ✅ received. C-1..C-6 pending review. |
