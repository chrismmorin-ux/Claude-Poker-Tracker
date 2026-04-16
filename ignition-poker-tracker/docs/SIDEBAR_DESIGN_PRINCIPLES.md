# SIDEBAR_DESIGN_PRINCIPLES.md

Doctrine rules for the Ignition sidebar. Each rule is enforced by a named
test or inline source pin. New rules MUST be added here with a named test
before they are cited as the rationale for a code change.

This file was created as part of STP-1 (Sidebar Trust Program phase 2) after
the rules were found scattered across source comments and MEMORY.md pointers
to a non-existent file. Rules R-1.* through R-6.* codify the SR-0 → SR-8
program's conclusions as they were applied in-code; R-7.* through R-10.*
are the STP-1 additions.

## Rule index

| Rule | Topic | Enforced by |
|---|---|---|
| R-2.3 | DOM-mutation discipline (FSM-routed) | `dom-mutation-discipline.test.js` |
| R-5.1 | Single-owner slot rendering | source comments + panel contracts |
| R-5.2 | Cross-panel wrapper attribute allowance (RT-72) | `spec-meta-discipline.test.js` baseline |
| R-5.6 | FSM-output exclusivity | `cross-panel-invariant-coverage.test.js`, `zx-overrides.test.js` |
| R-6.1 | Motion floor ≥200 ms fade | `motion-budget.test.js` |
| R-6.2 | Motion ceiling ≤300 ms transition | `motion-budget.test.js` |
| R-6.3 | prefers-reduced-motion zeroes duration | `motion-budget.test.js` |
| R-7.2 | Cross-panel invariants pre-dispatch + RT-66 badge | `cross-panel-invariant-coverage.test.js`, `render-coordinator.test.js` RT-70 |
| R-7.3 | Observability honesty (rendered text ≡ state) | `rendered-text-contract.test.js` |
| R-7.4 | Observability completeness (escape-hatch payload) | `diagnostics-dump.test.js` |
| R-8.1 | State-clear symmetry | `state-clear-symmetry.test.js` |
| R-10.1 | Payload-level invariants on incoming wire messages | `wire-schemas.test.js`, `state-invariants.test.js` R11/R12, `payload-fuzz.test.js` |
| RT-60 | Timer registration contract | `timer-discipline.test.js` |
| RT-66 | Invariant-violation surfacing via badge + diagnostics | `render-coordinator.test.js`, `diagnostics-dump.test.js` |

## STP-1 additions

### R-7.3 — Observability Honesty

Every user-surfaced string that references state must have a
rendered-text-contract test binding the string to the state value.

Applies to: badge tooltips, status text, stale indicators, and any template
literal containing `${snap.` or `${coordinator.get(`.

**Rationale.** Pre-STP-1 the RT-66 badge tooltip read "`${snap.lastViolationCount}`
state invariant violation(s) in the last 30s" but `lastViolationCount` was a
lifetime accumulator, not a 30 s window. The label and the data drifted apart
silently for the lifetime of the sidebar rebuild program.

**Enforcement.** `side-panel/__tests__/rendered-text-contract.test.js` pins
the badge tooltip to `snap.violationCount30s`, asserts the lifetime counter
is NOT read for the 30 s label, and enumerates every `${snap.X}` reference
against `buildSnapshot`'s exposed fields.

### R-7.4 — Observability Completeness

Every "see X for details" path must have a completeness test asserting X
actually contains the referenced details.

Applies to: `runDiagnostics` (the RT-66 badge points at "copy diagnostics for
details"), future copy/export paths, any surfaced "open the log" affordance.

**Rationale.** Pre-STP-1 the diagnostic dump did not include the
`pipelineEvents` ring buffer, `lastViolationCount`, `lastViolationAt`, or
`hasTableHands` — exactly the fields the badge pointed at. The promise was
unfulfilled for the lifetime of the feature.

**Enforcement.** `side-panel/__tests__/diagnostics-dump.test.js` parses
`runDiagnostics` and pins every promised section header and field label.

### R-8.1 — State-Clear Symmetry

Every `this._state.X = Y` write outside the `RenderCoordinator` constructor
must have a matching clear in the path that owns its declared scope
(table-switch, hand-new, or stale-timeout).

Declared scope lives in `side-panel/STATE_FIELD_SCOPES.md`. Each field must
appear in exactly one scope (session / perTable / perHand / derived /
monotonic). Per-hand fields are naturally also cleared by table-switch; the
relaxed collision test allows this overlap.

**Rationale.** Pre-STP-1 `clearForTableSwitch` missed `advicePendingForStreet`.
Probe-flake → tableGrace → clearForTableSwitch with `advicePendingForStreet`
still set armed R5 permanently (observed: 213 lifetime violations in one
session over 500 s). An audit of the rest of the coordinator surfaced 10
more asymmetries of the same class.

**Enforcement.** `side-panel/__tests__/state-clear-symmetry.test.js` parses
`STATE_FIELD_SCOPES.md` and `render-coordinator.js`, asserts every perTable
field is cleared in `clearForTableSwitch`, every perHand field is cleared
in the hand-new block (or via FSM fan-out), and session fields are NOT
cleared (catches accidental over-clearing).

### R-10.1 — Payload Invariants

Every incoming wire message must have a schema validator that checks
topology, not just field types. For `push_live_context`, disjoint-set
(`activeSeatNumbers ∩ foldedSeats = ∅`) and membership (`heroSeat ∈ active
∪ folded`) invariants are required. R11 and R12 are the coordinator-level
equivalents (defense in depth for any internal code path that constructs
a liveContext locally).

**Rationale.** Pre-STP-1, `validateLiveContext` only checked that
`currentStreet` was a string. In production the capture pipeline emitted
`activeSeatNumbers=[9,1,2,3,5,6,7,8]` with `foldedSeats=[2,3,6,9]`
(four-seat overlap) and `heroSeat=4` in neither set. No validator or
invariant surfaced it.

**Enforcement.**
- `shared/__tests__/wire-schemas.test.js` — payload-rejection cases.
- `side-panel/__tests__/state-invariants.test.js` — R11 / R12 unit tests.
- `side-panel/__tests__/payload-fuzz.test.js` — adversarial corpus with
  both wire-layer and coordinator-layer assertions.

## Reading the existing rules

R-2.3 / R-5.* / R-6.* are enforced in-code; read the test files cited in
the index to see the exact contract. This file does not duplicate them —
the source of truth for each is the test, not the prose.

## Adding a new rule

1. Write the test that enforces it.
2. Add a row to the index table above with the rule number and test file.
3. Add a short-form section explaining the rationale and citing the
   incident/observation that motivated the rule.
4. Cite the rule number in the source-comment at the code site it governs.
