# Feature Lifecycle — Design Program Gates

Every UX-touching change flows through five gates. Gates 1, 4, and 5 are mandatory. Gates 2 and 3 are conditional (triggered by Gate 1's findings or Gate 2's verdict).

---

## Overview

```
┌─────────────┐    ┌──────────────────┐    ┌─────────────┐    ┌──────────┐    ┌────────────────┐
│  1. Entry   │──▶ │  2. Blind-Spot   │──▶ │ 3. Research │──▶ │  4. Design │──▶ │ 5. Implementation│
│ (mandatory) │    │   (conditional)  │    │ (conditional)│   │ (mandatory)│   │  (mandatory)    │
└─────────────┘    └──────────────────┘    └─────────────┘    └──────────┘    └────────────────┘
      │                    │                      │                 │                    │
      ▼                    ▼                      ▼                 ▼                    ▼
 Scope defined         GREEN/YELLOW/          Gap closed:       Surfaces,            Code + tests
 Personas mapped       RED verdict on         new persona?      journeys,            reference audit
 JTBD mapped           persona/JTBD/          new JTBD?         audits,              or spec ID in
 Gap analysis          heuristic gaps         new evidence?     specs                commits/PRs
```

## Gate 1 — Entry (mandatory)

**Trigger**: any work item entering NEXT (backlog tier) that is classified as UX-touching.

**Inputs:**
- Proposed change (prose description).
- Affected surfaces (if known).

**Required outputs:**
1. **Scope classification**:
   - Surface-bound fix (existing surface, fixing or adjusting).
   - Surface addition (new view, new panel, new widget).
   - Cross-surface journey change.
   - Product-line expansion (main-app + sidebar).
2. **Personas identified**: list of core + situational personas relevant. Explicit check: *"Does our current cast actually cover this feature, or do we need a new persona?"*
3. **JTBD identified**: list of JTBD IDs the change serves. Explicit check: *"Does any proposed outcome not map to an existing JTBD?"*
4. **Gap analysis output**:
   - GREEN: all personas + JTBDs exist and fit.
   - YELLOW: 1–2 gaps (specific persona or JTBD missing).
   - RED: feature targets a persona / outcome space we haven't modeled at all.

**Gate passes when**: output is documented. YELLOW and RED outputs trigger Gate 2.

**Gate fails when**: scope is "we'll figure it out in code" — blocked until entry artifact exists.

---

## Gate 2 — Blind-Spot Roundtable (conditional)

**Trigger**: Gate 1 YELLOW or RED output, OR new-surface creation, OR owner flags the work for scrutiny, OR cadence says it's time.

**Process**: See [ROUNDTABLES.md](./ROUNDTABLES.md) for the full template. Five stages:

- **Stage A — Persona sufficiency**: who would plausibly use this who we haven't modeled?
- **Stage B — JTBD coverage**: what outcomes would users want from this that aren't in the atlas?
- **Stage C — Situational stress**: walk each applicable situational persona through the feature. Does any situation break?
- **Stage D — Cross-product / cross-surface**: does this affect sidebar? Other surfaces? Other flows?
- **Stage E — Heuristic pre-check**: Nielsen + poker-live-table + mobile-landscape. Any obvious violations?

**Output:**
- GREEN: proceed to Gate 4 (skip Gate 3 unless specifically flagged).
- YELLOW: Gate 3 required with scope = patch the specific gaps identified.
- RED: Gate 3 required with scope = substantial expansion (new persona, new JTBD domain, etc.).

**Bypass policy**: owner may skip Gate 2 for small surface-bound fixes. Skip must be logged with rationale.

---

## Gate 3 — Research (conditional)

**Trigger**: Gate 2 output is YELLOW or RED.

**Process**:
- Market / competitive research (web, documentation, competitor products).
- Internal observation (use the app as the unmodeled persona would).
- Evidence gathering (owner interview, telemetry, usage data if available).
- Persona expansion: author new persona(s) in `personas/core/` or `personas/situational/`.
- JTBD expansion: author new domain or JTBD entries in `jtbd/`.
- Evidence LEDGER: log what was observed.

**Output**: updated framework artifacts. Gate 2 is re-run against the updated framework; output must be GREEN to proceed.

**Bypass policy**: not applicable. Gate 3 exists specifically to close gaps.

---

## Gate 4 — Design (mandatory)

**Trigger**: Gate 2 GREEN (post-research if applicable).

**Required outputs depend on change type:**

**Surface-bound fix:**
- Update the surface artifact's "Known issues" section.
- If fix is non-trivial (severity ≥ 2), author or update an audit in `audits/`.

**Surface addition (new view or major widget):**
- Author new surface artifact in `surfaces/` BEFORE code is written.
- Author journey if cross-surface.
- Author design spec (inline in surface artifact or separate spec doc).

**Cross-surface journey change:**
- Update affected surfaces.
- Author or update journey in `journeys/`.
- Author audit in `audits/` if existing behavior changes materially.

**Product-line expansion:**
- Update `products/*.md`.
- Audit both product lines.

**Gate passes when**: design artifacts exist and are linked from the work item.

**Gate fails when**: code starts without a surface artifact. Any code written in this state is rolled back or paused until Gate 4 completes.

---

## Gate 5 — Implementation (mandatory)

**Trigger**: Gate 4 complete.

**Requirements**:
- Commit messages reference audit-id, surface-id, or spec-id.
- PR description links to audit or spec.
- Tests verify the behavior specified in Gate 4.
- Visual verification on reference + minimum viewport before merge (dev server + device or Playwright when available).
- Post-merge: surface artifact's "Known issues" section updated to reflect closure.

**Gate passes when**: code + tests merged + surface artifact reflects shipped behavior.

---

## Bypass log

When a gate is bypassed, append to `.claude/programs/design.md` or a dedicated log file with:

```
YYYY-MM-DD — bypass of Gate N on work item [X]
Reason: [explicit rationale]
Approved by: [owner]
Follow-up required: [what, by when]
```

A pattern of bypasses without follow-up is itself a signal that the program needs adjustment.

---

## Applying gates to different change sizes

| Change size | Gates hit |
|-------------|-----------|
| Typo fix in a label | None (not UX-touching) |
| Reorder menu items | 1, 4, 5 |
| Add new menu action | 1, 4, 5 (Gate 2 if adds new interaction pattern) |
| New panel in existing view | 1, 2, 4, 5 |
| New routed view | 1, 2, (3), 4, 5 |
| Feature targeting unserved persona | 1, 2, 3, 4, 5 |
| Cross-product feature (main + sidebar) | 1, 2, (3), 4, 5 |

---

## Worked examples

### Example 1: F1 (Clear Player menu reorder) — retrospective

- **Gate 1**: Scope = surface-bound fix. Personas = Seat-swap Chris, Chris (core), Weekend Warrior, etc. JTBD = PM-01. Gap = none (all covered). **GREEN.**
- **Gate 2**: Skipped (surface-bound, no new interaction pattern).
- **Gate 3**: Not triggered.
- **Gate 4**: `surfaces/seat-context-menu.md` updated. Audit finding F1 in player-selection audit. **Done.**
- **Gate 5**: Commit references F1. Tests updated. 28/28 passing. **Done.**

### Example 2: Hypothetical "Coach Dashboard" feature — prospective

- **Gate 1**: Scope = surface addition (new route, new UI). Persona = Coach. JTBD = CO-48–53. Gap = Coach persona exists but *no surfaces serve coaching JTBDs today* (domain has 0 surfaces). **YELLOW.**
- **Gate 2**: Triggered. Stage A: Are there non-Coach personas that would also use this? (E.g., peer-review among Apprentices?) Stage B: Are CO-48..53 complete? Stage C: Coach's primary situation (coach-review-session) — does the dashboard work for that? Stage D: Cross-product — does this affect sidebar? Stage E: Nielsen/PLT/ML pre-check. Output probably YELLOW: add "peer review" sub-persona if it emerges; verify annotation pattern.
- **Gate 3**: Research triggered — competitive review of coaching tools (Run It Once, Upswing, etc.); owner interview on intended model.
- **Gate 4**: Author `surfaces/coach-dashboard.md`, `surfaces/student-hand-queue.md`, `journeys/coach-review.md`. Spec the interaction model.
- **Gate 5**: Implement with tests + visual verification.

### Example 3: Hypothetical "Add dark mode" feature

- **Gate 1**: Scope = cross-surface (affects every view). Personas = all. JTBD = CC-81 (accessibility, already proposed). Gap = none (existing JTBD covers it). **GREEN.**
- **Gate 2**: Triggered because cross-product (main + sidebar). Stage A: does every persona actually benefit, or are dark-mode preferences venue-correlated? Stage D: does sidebar need its own palette or share? Probably YELLOW (need platform-level heuristic update).
- **Gate 3**: Research: competitor dark modes, accessibility contrast requirements.
- **Gate 4**: Update `heuristics/mobile-landscape.md` if new dark-mode heuristic emerges. Update each surface artifact's "known behavior" with dark-mode notes.
- **Gate 5**: Implement. Visual verification on every surface.

---

## Change log

- 2026-04-21 — Created. Part of Design Program establishment.
