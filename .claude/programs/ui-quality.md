# Program: UI Quality — RETIRED

**Status:** RETIRED 2026-04-21.
**Superseded by:** [`.claude/programs/design.md`](./design.md).

---

## Why retired

The UI Quality program was reactive — it tracked execution metrics after they manifested as issues (touch targets, component size, design tokens, etc.). It had no governance layer for *preventing* design problems from entering development in the first place.

On 2026-04-21 the Design Program was established, with:
- A `docs/design/` framework (75 files: personas, JTBD atlas, heuristics, surfaces, audits, discovery pipeline, tiers, products, evidence ledger).
- A 5-gate feature lifecycle (`docs/design/LIFECYCLE.md`) that every UX-touching change must pass.
- A 5-stage blind-spot roundtable template (`docs/design/ROUNDTABLES.md`) that hunts gaps in the framework itself.

The Design Program absorbs UI Quality's tactical metrics (as "Execution Indicators" in its Health Criteria table) while adding the governance, gates, and hunt-for-blind-spots mechanisms UI Quality lacked.

## Where to look now

- **All ongoing UI-execution metrics** (viewport rendering, touch targets, component size, action constants, design tokens, staleness indicators, confirmation guards) → `.claude/programs/design.md` "Execution Indicators" table.
- **All ongoing backlog items** from the UI Quality era (RT-37, RT-36, ARCH-003, etc.) → tracked in `.claude/programs/design.md` "Active Backlog Items".
- **Historical roundtable notes** (R3–R7, 2026-04-20 Drills Consolidation) → `.claude/programs/design.md` "History" section (pre-upgrade era).

This file is preserved as a redirect pointer. Do not edit except to update this redirect note if the Design Program's location changes.
