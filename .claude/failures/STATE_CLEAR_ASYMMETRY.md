# STATE_CLEAR_ASYMMETRY

**Status:** RESOLVED 2026-04-16 (STP-1, R-8.1 + STATE_FIELD_SCOPES.md).

## Pattern

`RenderCoordinator._state` in `ignition-poker-tracker/side-panel/render-coordinator.js`
accumulates fields whose values belong to one of five scopes: session, perTable,
perHand, derived, monotonic. Every lifecycle reset path (`clearForTableSwitch`,
the hand-new block in `handleLiveContext`, the stale-context timeout) must clear
the fields whose scope it owns. Writes outside the constructor happen in many
push handlers; clears are concentrated in a handful of lifecycle paths. When a
new field is added to `_state` without a matching clear, it silently survives
the lifecycle boundary — if the field participates in an invariant check, the
invariant arms after the first boundary and fires on every subsequent render
until the session ends.

## Symptoms

- **RT-66 badge showing "213 state invariant violations in the last 30s"** after
  ~500 s of sidebar uptime. Investigation showed the violations were R5
  (advice-street / live-context-street mismatch) firing ~every 30 s — one per
  render cycle after the first table-grace expiry.
- Two observability bugs stacked on top: the counter was actually lifetime, not
  30 s (R-7.3), and the diag dump the badge pointed at didn't contain the
  referenced fields (R-7.4). Those hid how long the asymmetry had been present.

## Root cause

`clearForTableSwitch` (render-coordinator.js) nulled 10 of the 11 fields that
participate in invariant R5's preconditions, but missed `advicePendingForStreet`.
Once `advicePendingForStreet` held a stale street name, R5 evaluated
`advicePendingForStreet === currentLiveContext.currentStreet` as false on every
subsequent render because the live context had been nulled. R5 fires once per
render; the badge surfaces it once per 30 s; the diag counter incremented once
per fire.

Audit of the rest of the coordinator turned up **10 additional asymmetries of
the same class**, latent but not armed in the current session's event sequence:

- `lastGoodExploits`, `lastGoodWeaknesses`, `lastGoodBriefings`,
  `lastGoodObservations` — stale exploit/weakness/briefing data for the prior
  table's seat layout
- `lastHandCount`, `cachedSeatStats`, `cachedSeatMap`, `hasTableHands` — stale
  hand snapshot with different seats at the new table
- `lastPipeline`, `cachedDiag`, `recoveryMessage`, `swFallbackState` — stale
  status banners (later reclassified session-scoped after audit, not cleared
  but explicitly documented)

## Fix

Structural, not patch-based:

1. **`STATE_FIELD_SCOPES.md`** — declarative registry. Every `_state` field
   declares a scope (session / perTable / perHand / derived / monotonic) with
   set-paths, clear-paths, and intent. Single source of truth for which
   lifecycle owns which field.
2. **`state-clear-symmetry.test.js`** — parses `STATE_FIELD_SCOPES.md` and
   `render-coordinator.js`, asserts every perTable field is cleared in
   `clearForTableSwitch`, every perHand field is cleared in the hand-new
   block, session/monotonic/derived fields are not cleared. Source-level pin
   fails on unregistered fields and on scope/code disagreement.
3. **Doctrine rule R-8.1** — every write to `this._state.X` outside the
   constructor must have a matching clear in the scope's owning path.
   Enforced by the test above.
4. **Observability rules R-7.3 (honest) and R-7.4 (complete)** — the rendered
   counter must equal the state value it claims to report, and any "see X for
   details" path must have a completeness test asserting X actually contains
   the referenced details. These are general; they were added in the same
   program because the asymmetry would have been caught sooner if the badge
   and diag dump had not themselves been broken.
5. **Payload invariants R11, R12 + `validateLiveContext` topology checks
   (R-10.1)** — defense in depth. The original R5 symptom was the
   downstream tell of an upstream invariant that nothing was checking.

## Generalisation

Any long-lived object that holds fields tagged by scope (session, per-resource,
per-transaction) needs:

- an explicit registry of scope per field,
- clear paths keyed on scope, not on incident-driven ad-hoc nulls,
- a test that cross-references the registry and the code so the registry can't
  lie.

The failure mode is not "someone forgot to clear a field." It's "the codebase
has no mechanism to notice a missing clear." The fix is the mechanism.

Companion rule: every user-surfaced counter or status string that references
state must have a rendered-text-contract test (R-7.3), and every "see
diagnostics" affordance must have a completeness test (R-7.4). Without both,
an asymmetry can remain observationally invisible indefinitely.

## Related

- `.claude/failures/SW_REANIMATION_REPLAY.md` — sibling sidebar failure mode
  (MV3 lifecycle reanimation replay). Different mechanism, same class of
  invisibility pre-STP-1.
- `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` — the prior program that
  claimed full audit coverage; STP-1 is the amendment that makes the claim
  defensible.
- `SYSTEM_MODEL.md` §4.1 invariants I-OBS-HONEST, I-OBS-COMPLETE, I-STATE-SYM,
  I-INV-PAYLOAD and §4.2 failure mode registry.
- `ignition-poker-tracker/side-panel/STATE_FIELD_SCOPES.md` — the registry.
- `ignition-poker-tracker/docs/SIDEBAR_DESIGN_PRINCIPLES.md` — rules R-7.3,
  R-7.4, R-8.1, R-10.1.
- STP-1 plan: `C:\Users\chris\.claude\plans\cryptic-booping-yao.md`.
