# Session Handoff: sr-5-architecture-audit

**Status:** COMPLETE — owner-approved 2026-04-13. Artifacts: `docs/sidebar-rebuild/05-architecture-delta.md` + 16 SR-6.x items in BACKLOG. SR-6.1 handoff opened at `.claude/handoffs/sr-6-rebuild-batch-1.md`. | **Written:** 2026-04-13

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine v2 (sealed).
4. `docs/SIDEBAR_PANEL_INVENTORY.md` — sealed inventory.
5. **All six SR-4 spec files** — these are the authoritative spec surface SR-5 audits the current code against:
   - `docs/sidebar-specs/z0-chrome.md`
   - `docs/sidebar-specs/z1-table-read.md`
   - `docs/sidebar-specs/z2-decision.md`
   - `docs/sidebar-specs/z3-street-card.md`
   - `docs/sidebar-specs/z4-deep-analysis.md`
   - `docs/sidebar-specs/zx-overrides.md`
6. `docs/sidebar-specs/README.md` — spec template + standardized vocabulary (already used; included for cross-reference).
7. Render layer source for the audit (read, do not modify):
   - `ignition-poker-tracker/side-panel/side-panel.js`
   - `ignition-poker-tracker/side-panel/render-orchestrator.js`
   - `ignition-poker-tracker/side-panel/render-street-card.js`
   - `ignition-poker-tracker/side-panel/render-tiers.js`
   - `ignition-poker-tracker/side-panel/render-coordinator.js`
   - `ignition-poker-tracker/side-panel/side-panel.html` (DOM topology)

## Scope

Produce two artifacts:

1. **`docs/sidebar-rebuild/05-architecture-delta.md`** — the architecture audit. For each zone (Z0–Z4, Zx), compare current implementation against the SR-4 spec and document:
   - **Conformance** — which specs the current code already satisfies as-built.
   - **Delta** — concrete gaps between current code and spec, grouped by severity (blocking / behavioral / cosmetic).
   - **Cross-cutting findings** — single-owner state violations, missing renderKey fields, direct DOM toggles, unregistered timers (RT-60), short-circuited FSMs.
   - **Doctrine adherence audit** — for each doctrine rule (R-1.1 through R-7.4), list every site in the current code that violates it, with file:line citations.
2. **Ordered SR-6 rebuild backlog** — written into `.claude/BACKLOG.md` as new SR-6.x items (one per discrete rebuild PR), in dependency order. Each item must have:
   - A clear scope (one zone or one cross-cutting concern per item).
   - Pre-conditions (which prior SR-6 items must ship first).
   - The 4-gate check criteria (which doctrine rules + invariants the PR must satisfy).
   - Estimated complexity (S/M/L).
   - The behind-flag deployment plan (`sidebarRebuild` flag from SR-6 description).

## Carried inputs (from SR-4)

These MUST be enumerated and resolved (or explicitly deferred) by SR-5:

### Open escalations
- **E-2 (Z1 batch):** Rule V seat-arc selection ring is a visual surface not in inventory. Owner decision needed: add as inventory row 1.11 OR fold into 1.1. SR-5 forces the decision (or carries to SR-6 with explicit punt).
- **E-3 (Z2 batch):** S4/02-a (pot chip stale between hands) + S4/02-b (street strip stale between hands) — root-cause hypothesis is that between-hands Zx override fails to blank Z2 live-context-derived elements. SR-5 audit must validate the hypothesis against current code and produce a fix item in the SR-6 backlog.

### Code gaps noted (non-blocking for SR-4, must surface as SR-6 items)
- **X.4c re-enable timer** uses direct `setTimeout` (side-panel.js:172) instead of `coordinator.registerTimer` per RT-60 contract. SR-6 ticket needed.
- (SR-5 audit will surface more — these are the ones already named in SR-4 specs.)

### Corpus gaps (~19 across Z0/Z3/Z4/Zx)
SR-5 produces a **single SR-6 item** for "harness corpus extension" listing every TODO from the spec §7 fields, organized by S-frame:
- **Z0** (1): pipeline-dot tap event against S8/01.
- **Z3** (3): 3.6-villain-postflop, 3.11-multiway-selector, 3.12-no-aggressor.
- **Z4** (4): RT-61 auto-expand before/after, no-plan path, 4.2 one-block path, flag-off absence + flag-on no-audit.
- **Zx** (~12): X.1 mid-hand suppression + single-line merged text, X.3 grace negative path, X.4 implicit-clear + multi-message, X.5 tournament-end + mid-hand level transition, X.5b zone transition, X.5c final-level state, X.5d below-average state, X.5e critical urgency, X.5f far-from-bubble absent state, X.5g no-predictions, X.6 no-villain placeholder + app-disconnected mid-observer.

### Deferred owner decisions
- **0.7 footer placement** (deferred from Z0 batch) — SR-5 must surface for owner decision before any SR-6 PR touches the footer DOM.
- **`sidebarRebuild` feature flag plumbing** — defined in SR-6 description but never implemented; SR-5 produces the first SR-6 ticket for flag introduction.

## Doctrine rules to audit (full enumeration)

Author the §"Doctrine adherence audit" section of `05-architecture-delta.md` as a rule-by-rule sweep. For each rule, list every violating site in current code (file:line) plus the SR-6 fix item that resolves it. Rules to cover:

- **R-1.1 to R-1.5** — fixed zones, spatial stability, no reflow, glance pathway.
- **R-2.1 to R-2.5** — FSM ownership, between-hands semantics, registered timers.
- **R-3.1 to R-3.4** — interruption tier discipline.
- **R-4.x** — placeholder semantics (unknown vs zero).
- **R-5.1 to R-5.4** — single ownership, renderKey discipline.
- **R-7.1 to R-7.4** — three-tier invariants, runtime monitoring (audit counters).

Cross-reference each violation to the spec batch it ties to (e.g., "R-5.1 violation at side-panel.js:1200 — ties to Z4 batch invariant 1 collapsible-state-ownership rule").

## Cross-cutting findings to look for

Based on RT-43 root-cause work and prior roundtables, these are the known-likely audit hits:

1. **Dual state ownership** — module-local vars vs RenderCoordinator. RT-43 closed the headline cases; SR-5 sweeps for residual sites.
2. **Direct DOM mutations bypassing scheduleRender** — any `classList.toggle`, `el.hidden = true`, `el.innerHTML = ...` outside the renderAll path.
3. **Unregistered timers** — every `setTimeout`/`setInterval` outside `coordinator.registerTimer` (RT-60). X.4c is one known site; sweep for others.
4. **renderKey fingerprint gaps** — any state field that drives a visible change but is not in the renderKey hash. Cross-check against every spec §6 update-trigger list.
5. **Short-circuited FSMs** — any path where a renderer infers state from one signal when the spec declares the FSM owns the lifecycle (X.1 is the explicit named case from Zx batch).
6. **Slot-collapse violations** — Z2/Z3 elements that collapse on missing data instead of blanking in place (R-1.3). Z4 + Zx have permitted carve-outs; Z2/Z3 do not.
7. **Stale-tint single-source compliance** — Z2 batch invariant 8 declared one data source, one renderKey field, one 1 Hz timer for the entire stale tint cross-zone contract. Verify the current code does not double up.

## Order of operations

1. Read all files in §"Next session: read this first".
2. Sweep current code for each cross-cutting finding category; record each violation with file:line.
3. For each zone (Z0–Z4, Zx), walk the spec section by section and record per-spec deltas.
4. Synthesize the doctrine audit (rule-by-rule).
5. Draft `docs/sidebar-rebuild/05-architecture-delta.md` with sections: Executive summary → Per-zone deltas → Cross-cutting findings → Doctrine audit → Carried-input dispositions.
6. Convert findings into ordered SR-6.x backlog items in `.claude/BACKLOG.md`.
7. Owner review gate — wait for approval before SR-5 closes.
8. On approval: update `.claude/BACKLOG.md` (SR-5 → COMPLETE, SR-6 → NEXT with first item ready), `.claude/STATUS.md` (SR-5 done, SR-6 active), close this handoff, open `sr-6-rebuild-batch-1.md` kickoff handoff for the first SR-6 item.

## Files this session will modify

- `docs/sidebar-rebuild/05-architecture-delta.md` (new — likely a substantial document, plan for it).
- `.claude/BACKLOG.md` (SR-5 → COMPLETE, SR-6.x items added in dependency order, on approval).
- `.claude/STATUS.md` (on approval).
- `.claude/handoffs/sr-5-architecture-audit.md` (this file → COMPLETE on approval).
- `.claude/handoffs/sr-6-rebuild-batch-1.md` (new, on approval; scope = the first SR-6 item).

## Files this session must NOT modify

- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — sealed at v2.
- `docs/SIDEBAR_PANEL_INVENTORY.md` — sealed.
- `docs/sidebar-specs/*.md` — all six are owner-approved spec surface; no amendments.
- Any code under `ignition-poker-tracker/` — SR-5 is audit-only (read for the audit; no edits). Code changes ship in SR-6 PRs behind the `sidebarRebuild` flag.

## Owner decisions to surface

SR-5 is the right time to force decisions on items the prior batches deferred:

1. **0.7 footer placement** (deferred from Z0).
2. **E-2 Rule V seat-arc ring** (Z1 escalation) — add as 1.11 or fold into 1.1?
3. **`sidebarRebuild` flag scope** — single flag for the entire rebuild OR per-zone sub-flags? (Affects SR-6 ticket granularity.)
4. **SR-6 sequencing preference** — owner picks: ship by zone (Z0 first → Zx last), by severity (blocking deltas first regardless of zone), or by dependency (single-owner state store first, then per-zone PRs)? SR-5 produces the ordered backlog; owner approves the order.

## Known gotchas for SR-5

- **Audit scope creep** — it is tempting to fix violations during the audit. Resist. SR-5 is read-only; fixes ship in SR-6 PRs behind the flag.
- **Spec-vs-code conflict resolution** — when current code does something the spec doesn't cover (or vice versa), default to the spec being authoritative; flag the gap in `05-architecture-delta.md` and propose either a code fix (SR-6) or a spec amendment (R-11). Do not silently extend a spec.
- **Ordering trap** — single-owner state store (RT-43 finishing work) is likely the dependency root for many zone PRs. Sequence accordingly: foundational cross-cutting fixes ship before per-zone refactors.
- **Test harness dependency** — the SR-6 corpus-extension item should ship early so subsequent SR-6 PRs can verify against complete fixtures.
