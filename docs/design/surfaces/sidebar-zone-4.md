# Surface — Sidebar Zone 4 (Deep Analysis)

**ID:** `sidebar-zone-4`
**Zone role:** Post-decision drill-down tier. Model Audit (flag-gated), per-seat villain detail on expand, freshness ledger. Drill-down interruption tier — lower than Z3 decision, higher than Z0 chrome.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (R-1.5 drill-down pathway — text amended 2026-04-28 to cite §IV explicitly), §7 (invariant surfacing); doctrine v8 binding rules — see SHC cross-references below
- `docs/design/surfaces/sidebar-shell-spec.md` §III confidence + §IV affordance + §VI density
- `docs/design/surfaces/sidebar-zones-overview.md`
- `.claude/projects/sidebar-rebuild/04-z4-deep-analysis.md` (SR-4 handoff)
- Extension code: `side-panel.js:1325-1329` (Model Audit DOM insert/remove, flag-gated)

---

## SHC Shell-Spec Cross-References (added 2026-04-29)

Z4 Deep Analysis elements (More Analysis collapsible, Villain Range / Fold Curve / Model Audit sub-sections, Z4 glance tier confidence dot + label) implement vocabulary resolved across V-2/V-affordance/V-density walkthroughs.

**Concept-classes consumed:**
- **§III confidence** — Z4 glance-confidence dot + n=N label at `render-tiers.js:67-74` is one of three D-1 forensic sites (resolved by V-2). Migrates to `shared/render-confidence.js` extracted module per §III.6. `n=N` form pairing with confidence dot per §III.4 + INV-DENSITY-3.
- **§IV affordance** — chevron expand/collapse vocabulary closes R-1.5 dangling SR-4-spec-index reference. `.deep-chevron` class at `render-tiers.js:424,455,478,520,552,577,607,624,653` (9 sites) consolidates to one `.affordance-chevron` class per V-affordance D-4 forensics. Chevron direction VERIFIED at `side-panel.html:1266` (`.deep-section.open .deep-chevron { transform: rotate(180deg) }` — `▾` collapsed / `▴` expanded contract is uniform across codebase). ARIA mandate: `role="button"` + `aria-expanded="true|false"` + `aria-controls="[expansion-slot-id]"`.
- **§VI density** — `--type-meta-stat` for confidence labels and sample counts; `--zone-deep-padding` for sub-section inner padding. **available-collapsed** tier in most system states per §VI.6 attention-budget map (Z4 is drill-down; not primary attention).

**Doctrine binding rules:**
- **R-1.5 (text amended 2026-04-28)** — drill-down affordance vocabulary cites shell-spec §IV explicitly (closes the dangling SR-4-spec-index reference)
- **R-1.10** affordance vocabulary + INV-AFFORD-1..5 (chevron is canonical Class A visual-affordance-required)
- **R-1.12** density-rhythm (Z4 available-collapsed tier; --type-meta-stat for confidence labels)
- **R-3.5** drill-down interruption tier (Z4 is lower than Z3 decision; higher than Z0 chrome)

**INV-* invariants binding on Z4:**
- **INV-AFFORD-1** chevron is single affordance per element (no over-signposting)
- **INV-AFFORD-2** chevron has reachable click handler (no lying affordances)
- **INV-AFFORD-3** chevron direction vertical only — `▾`/`▴` (verified)
- **INV-AFFORD-4** chevron tap-target = full header row (not glyph alone); ≥44×44 — currently grandfathered for sub-44 elements with explicit Gate 5 milestone
- **INV-DENSITY-3** sample-count `n=N` form bound to confidence-dot pairing per §III.4

**Cross-zone observations (from SHC inventory):**
- Z4 glance-confidence dot is the third D-1 forensic site (CC-C-3) — resolved by V-2 extracted module.
- Z4 chevron direction was apparent CC-D-2 inconsistency in Gate 3 inventory; V-affordance V-afford.3 verification confirmed CSS contract uniform; "inconsistency" was observational drift, not real CSS divergence.

**Gate 5 co-shipping items relevant to this zone:**
- Migrate 9 emit sites in `render-tiers.js` to `renderChevron(opts)` helper from `shared/render-affordance.js`
- 4-chevron-class collapse: `.deep-chevron` + `.collapsible-chevron` + `.pp-chevron` + `.tourney-bar-chevron` → `.affordance-chevron`
- `data-affordance="chevron" data-affordance-target="..."` attributes per V-affordance §IV.8 single-delegated-listener pattern
- Z4 confidence-dot HTML migrates to `renderConfidenceBadge()` helper from `shared/render-confidence.js`
- Tap-target full-row enforcement (header is the tap target; chevron glyph alone is ≤12px and below floor)

**Product line:** Sidebar
**Tier placement:** Pro + flag-gated "debug diagnostics" features
**Last reviewed:** 2026-04-22 (DCOMP-W5)

---

## Purpose

Z4 is the drill-down zone. When a Multi-Tabler or Online MTT Shark wants more detail than Z3's summary — why did the advice say fold, what's villain's weighted range, what's the blocker math — Z4 is where that expansion lives. Per R-1.5, drill-down affordances in Z3 route here.

## JTBD served

- `JTBD-MH-08` blockers in fold-equity math (expanded detail)
- `JTBD-SR-*` per-seat villain detail (shared with OnlineView SeatDetailPanel)
- Debug-oriented: Model Audit (flag-gated via `settings.debugDiagnostics`)

## Personas served

- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — detail-seeker
- [Coach](../personas/core/coach.md) — when reviewing in a coaching session (though Coach canonical surface is main-app)
- Debug users with `settings.debugDiagnostics` enabled

## Elements (per SR pre-cutover audit)

- 4.3 Model Audit (flag-off absence pinned by test; flag-on visual gap — low-priority)
- Villain range expansion
- Freshness ledger (per-element last-update timestamps for diagnostic review)

## FSM / lifecycle

Z4 content is lazy-rendered on drill-down trigger from Z3. Per R-1.5, the expansion location defaults to "in place" (Z4 is the in-place expansion zone for Z3 elements) — not modal, not navigation.

Model Audit is DOM-inserted/removed by `side-panel.js:1325-1329` based on `settings.debugDiagnostics`. Orthogonal to `sidebarRebuild` flag.

## Interruption discipline

Z4 is `drill-down` tier. Lower than Z3 `decision`. Higher than Z0 `informational`. Between-hand events never preempt Z4 while a drill-down is open.

## Known issues carried forward

- **4.3 Model Audit flag-on** — visual gap (flag-off absence pinned by test, flag-on corpus frame missing)
- Cross-surface: the in-sidebar drill-down and OnlineView SeatDetailPanel diverged during the sidebar rebuild; parity not explicitly contracted (partial W4-A3-F10 coverage)

## Heuristic alignment

- H-N6 recognition rather than recall — Z4 is the recall-to-detail expansion zone
- H-N7 flexibility + efficiency — power-user drill-down
- H-N10 help + documentation — Model Audit is debug-internal, not user-docs

## Change log

- 2026-04-22 — Created (DCOMP-W5).
