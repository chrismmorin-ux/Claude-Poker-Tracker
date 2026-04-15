# Session Handoff: sr-4-z0-chrome

**Status:** COMPLETE — Z0 chrome batch owner-approved 2026-04-13. Spec at `docs/sidebar-specs/z0-chrome.md`. Owner decisions: `settings.debugDiagnostics` flag name approved; 0.7 footer placement deferred to SR-5; slot-collapse exception approved; 0.7/0.8 diagnostics co-trigger approved; 3 corpus TODOs accepted for SR-6. Z1 handoff opened at `.claude/handoffs/sr-4-z1-table-read.md`. | **Written:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — **doctrine v2**. Cite rule numbers in every spec.
4. `docs/SIDEBAR_PANEL_INVENTORY.md` — Z0 section (rows 0.1–0.9) + §Glance Pathways + §Cross-cutting resolutions.
5. `docs/sidebar-specs/README.md` — spec template + drill-down vocabulary (already scaffolded).

## Scope

Write `docs/sidebar-specs/z0-chrome.md` — per-element specs for every Z0 row with a non-`delete` verdict.

Rows to spec (from inventory §Z0):
- **0.1** Pipeline dot (keep; absorbs 0.5 refresh as conditional render when non-green)
- **0.2** "N hands captured" label (keep; verify against 0.5 invalid state)
- **0.4** App-state badge (keep)
- **0.6** "show tournament log" link (conditional-render — hide when `lastGoodTournament == null`)
- **0.7** "show diagnostics" link (keep behind debug flag; paired with 4.3 on same setting)
- **0.8** Invariant violation "!" badge (keep; 30s auto-decay, emergency tier)
- **0.9** Pipeline health strip (keep; informational tier)

Deleted/merged (omit with one-line note in batch file):
- 0.3 hand count pill — deleted (duplicate of 0.2)
- 0.5 refresh button — merged into 0.1 as conditional visual

## Order of operations

1. Read all files listed in "Next session: read this first."
2. Draft `docs/sidebar-specs/z0-chrome.md`:
   - One section per kept row in inventory-row order.
   - Use the 8-field template from `docs/sidebar-specs/README.md` verbatim.
   - End with a **Batch invariants** section covering: Z0 always-visible (all tiers render at top-of-panel), fixed row heights, left-to-right slot order, debug-flag gating for 0.7.
3. Flag any row where a spec field cannot be authored without re-opening an inventory verdict — do NOT silently amend. Escalate per R-11.
4. Owner review gate — wait for approval before writing Z1 batch.
5. On approval, update `.claude/BACKLOG.md` (SR-4 progress note — 1/6 batches done), `.claude/STATUS.md`, and open `sr-4-z1-table-read.md` handoff.

## Known gotchas for Z0

- **0.1 merged state**: the pipeline dot now carries dual duty (health + refresh). Spec must choose a single affordance from the vocabulary — likely **tap target** when non-green (invokes refresh), glance-only when green. Call this out.
- **0.7 / 4.3 paired debug flag**: one setting enables both. Name the setting key in the spec (check `side-panel.js` for the existing flag name, don't invent one).
- **0.8 emergency tier + 30s decay**: the fake-clock corpus S6 is authoritative for decay timing. Spec's render-lifecycle section must cite S6.
- **0.9 is informational not emergency**: it describes *layer* health, not alerts. Do not upgrade tier.
- **Hand-count 0.2 "invalid when 0 hands and no table"**: the inventory flagged this as redundant with 0.5 (pipeline health strip showing PROBE idle). Decide in spec whether 0.2 hides in that state or keeps showing "0 captured" — the doctrine R-1.3 (no reflow) implies it keeps rendering but with "0". Document the choice.

## Deliverables checklist

- [ ] `docs/sidebar-specs/z0-chrome.md` drafted (7 spec sections + batch invariants).
- [ ] Every spec has a complete §3 glance pathway (all 4 sub-fields).
- [ ] Every spec cites at least one doctrine rule in §2.
- [ ] Every spec cites at least one S-frame in §7.
- [ ] No spec re-opens an inventory verdict without R-11 escalation.
- [ ] Owner review requested.

## Files this session will modify

- `docs/sidebar-specs/z0-chrome.md` (new)
- `.claude/BACKLOG.md` (SR-4 progress note on approval)
- `.claude/STATUS.md` (active session + recently completed on approval)
- `.claude/handoffs/sr-4-z0-chrome.md` (this file → COMPLETE on approval)
- `.claude/handoffs/sr-4-z1-table-read.md` (new, on approval)

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine is sealed at v2. Any change requires R-11.
- `docs/SIDEBAR_PANEL_INVENTORY.md` — verdicts sealed. Escalate any needed correction.
- `docs/sidebar-specs/README.md` — template is sealed for the duration of SR-4 unless the drill-down vocabulary proves insufficient (then amend, don't work around).
- Any code under `ignition-poker-tracker/` — SR-4 is spec-only.
