# ADR-008: Range Lab Undo Stack — Per-Stroke Granularity

## Status
Accepted

## Date
2026-05-20

## Context

Range Lab (RL) paint actions are destructive — each cell tap overwrites a per-combo weight (cell toggle from empty → 100%, or 100% → empty, or weight-slider commit). Without an undo affordance, any misclick costs the user paint state they cannot recover. Gate 2 Blind-Spot Roundtable Stage E (`docs/design/audits/2026-05-20-blindspot-range-lab.md`) flagged H-N03 (undo) as a required surface element and routed the granularity decision to this ADR.

Two designs were enumerated by the Range-Paint Interaction Designer voice:

1. **Per-stroke undo** — Each individual cell action (tap-to-toggle, slider-apply) = one entry on the undo stack. Cmd-Z reverses one cell at a time.
2. **Per-session undo** — Each "Start paint" → "Finalize paint" session = one entry. Cmd-Z reverses the full session block.

The choice interacts with ADR-007 (Paint Primitive): per-stroke granularity assumes each tap/long-press-apply is an atomic action — which ADR-007 establishes — so the two ADRs compose cleanly. Per-stroke also interacts with WS-055 (Gate 4 surface spec) cell-rendering: each undo entry must capture sufficient state to render the prior cell state correctly.

## Decision

**Use per-stroke undo.**

- **Undo stack scope:** session-scoped (cleared on app reload, paint mode exit, OR explicit "Clear all" — see below). Persistence across sessions is not in v1 scope.
- **One entry per atomic action:**
  - Tap-to-include → 1 entry (records: `cellId, priorWeight: 0, newWeight: 1`)
  - Tap-to-exclude → 1 entry (records: `cellId, priorWeight: prevW, newWeight: 0`)
  - Long-press → slider → Apply → 1 entry (records: `cellId, priorWeight: prevW, newWeight: appliedW`)
  - Long-press → slider → Cancel → 0 entries (cancel is non-mutating)
- **Stack depth:** unbounded within session memory (typical paint session is < 200 strokes; 200 × ~32 bytes per entry = ~6KB — trivial)
- **Cmd-Z keybinding:** undo (per H-N03 standard; matches Anki/Figma/Photoshop convention)
- **Cmd-Shift-Z keybinding:** redo (per standard convention)
- **Redo stack:** populated by undo actions; cleared on any new mutation

**"Clear all" stays OUT of the undo stack.** It is a separate destructive action with confirmation modal (per Gate 2 E-A3 "destructive confirmation"). Intent: "Clear all" requires explicit user authorization; it is not undo-recoverable accidentally. This trades one capability (undoing a clear) for one safety property (a confirmed clear is committed).

## Alternatives Considered

### Per-session undo

- **Pros:**
  - Simpler implementation — track one snapshot per session, not per stroke
  - Smaller memory footprint (one entry per paint session vs N entries per session)
  - Aligns with mental model "I painted a range, then changed my mind" (full-session undo)
- **Cons:**
  - Loses ability to roll back single misclicks within a session — H-PLT06 misclick absorption fails for in-session errors
  - User who paints 47 cells, accidentally toggles one off, cannot recover the one cell without losing the other 46
  - Forces users to be careful at fine granularity OR accept silent loss when they're not — both bad UX
  - "Session" boundary is ambiguous — when does a session start/end? Auto-finalize on timeout? Explicit Save? Each option is a new UX decision to defer
  - Misalignment with industry-standard tools (Anki, Figma, Photoshop, etc. all do per-stroke)

### Hybrid (per-stroke within session + per-session as a separate "restore session" affordance)

- **Pros:** Both granularities available
- **Cons:** Two undo concepts to teach; UI gains a second undo control; the per-session restore is best handled by explicit `Save` checkpoints, not by a parallel undo system

### Time-based undo (group all strokes within a 1-second window into one entry)

- **Pros:** Reduces stack noise for rapid multi-stroke painting
- **Cons:** "1 second" is arbitrary; rapid users get coarser granularity than they expect; H-PLT06 fails if the misclick is followed by a deliberate action within the window

## Consequences

### Positive
- Granular misclick recovery (H-PLT06 absorbed)
- Matches industry-standard tool vocabulary (Anki, Figma, Photoshop) — zero cognitive cost for users
- Composes cleanly with ADR-007 paint primitive (each atomic action = 1 entry)
- Trivial memory footprint at typical session size
- Redo support comes "for free" from the standard stack-based pattern

### Negative
- More entries to scroll through if user is undoing a large block — though Cmd-Z hold-to-repeat works
- Slightly more implementation complexity than per-session (each action emits an entry vs one snapshot per session)
- Edge case: if user enables long-press → slider, scrubs the slider extensively, then cancels — the scrubbing during slider drag is NOT undo-recoverable because slider-cancel is non-mutating. This is intentional (scrubbing is exploration, not commitment) but worth surfacing in Gate 4 spec.

### Mitigations
- "Clear all" confirmation modal handles the one case where per-stroke undo isn't enough (large-scale wipe must be confirmed)
- Redo via Cmd-Shift-Z recovers from over-eager undo
- Stack depth unbounded within session, so users never hit a "lost too far back" wall during normal use

## References

- Gate 1 audit: [`../design/audits/2026-04-22-entry-range-lab.md`](../design/audits/2026-04-22-entry-range-lab.md) (lists undo as Phase-0 prerequisite via H-N03)
- Gate 2 audit: [`../design/audits/2026-05-20-blindspot-range-lab.md`](../design/audits/2026-05-20-blindspot-range-lab.md) Stage E (E-A2 undo stack design, E-A3 "Clear all" destructive confirmation)
- Companion ADR: [`./ADR-007-rl-paint-primitive.md`](./ADR-007-rl-paint-primitive.md) — defines atomic actions that this stack tracks
- Surface this will be cited from: [`../design/surfaces/postflop-drills.md`](../design/surfaces/postflop-drills.md) — Gate 4 Range Lab section (WS-055, forthcoming)
- Heuristic refs: H-N03 (undo), H-PLT06 (misclick absorption), H-N04 (consistency with industry tools)
- Sprint: SPR-094. Ticket: WS-203.
- Founder-ratified at SPR-094 plan-mode (2026-05-20): per-stroke undo per Gate 2 recommendation; per-session alternative explicitly rejected.
