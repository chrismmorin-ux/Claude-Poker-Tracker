# Surfaces — Sidebar Zones (DCOMP-W5 Overview)

**ID:** `sidebar-zones-overview`
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — doctrine (v8 as of 2026-04-29 — extended via SHC Gate 4 with R-1.6 through R-1.12 binding rules)
- `docs/design/surfaces/sidebar-shell-spec.md` — Shell spec (resolved 2026-04-27 → 2026-04-29 across 6 SHC Gate 4 walkthroughs: §I status + §II freshness + §III confidence + §IV affordance + §V color tokens + §VI density)
- `docs/design/audits/2026-04-27-entry-sidebar-holistic-coherence.md` — SHC Gate 1
- `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` — SHC Gate 2
- `docs/design/audits/2026-04-27-observation-sidebar-coherence-inventory.md` — SHC Gate 3 visual + architectural inventory
- `docs/design/evidence/2026-04-27-sidebar-coherence-baseline.md` — SHC Gate 3 closer
- `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` — program post-mortem
- `.claude/projects/sidebar-rebuild/` — per-stage artifacts
- `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md` — superseded by doctrine v8 binding rules (kept for archival reference only)
- `src/contexts/SyncBridgeContext.jsx` + extension code in `ignition-poker-tracker/`
- Per-zone surface artifacts: `sidebar-zone-0.md` through `sidebar-zone-4.md` (each carries SHC shell-spec cross-references added 2026-04-29)

**Product line:** Cross-product — extension sidebar surfaces + main-app OnlineView companion (see `online-view.md`).
**Tier placement:** Pro (full sidebar) + a proposed Sidebar-Lite subscription (F-P16).
**Last reviewed:** 2026-04-22 (DCOMP-W5 first integration pass); 2026-04-29 (SHC Gate 4 cross-references integrated)

---

## Purpose of this document

The sidebar (extension-rendered HUD running over the Ignition client) is a separate surface system from the main app. It has its own 33-rule **doctrine** (Sidebar Rebuild Stage 2 artifact) and its own program history (Sidebar Rebuild SR-0..SR-7 + Sidebar Trust Program STP-1). The main Design Compliance framework (personas + JTBDs + heuristics + audits) was authored for the main app primarily.

DCOMP-W5 integrates the sidebar into the framework:

1. **5 zone-level surface artifacts + 1 overview** (this doc + `sidebar-zone-0.md` through `sidebar-zone-4.md`).
2. **Heuristic cross-map** (this doc §3) shows which Nielsen-10 / Poker-Live-Table / Mobile-Landscape heuristics already have direct doctrine rules, and which are observed informally but un-rule-coded.
3. **Persona / JTBD pointer table** (this doc §2) maps each zone to the personas and JTBDs it serves (consistent with how main-app surfaces document).

The doctrine remains authoritative for sidebar rules. The framework layer adds cross-surface consistency + a common vocabulary for audits that span sidebar + main-app (e.g., the cross-surface finding `2026-04-21-sidebar-tournament-parity` discovery).

**DCOMP-W5 does NOT re-run the Sidebar Rebuild audit.** The sidebar already had 5 months of rigorous audit + rebuild work under SR-0..SR-7 and STP-1. W5 is a documentation-integration pass.

**SHC (Sidebar Holistic Coherence, 2026-04-27 → 2026-04-29) DOES extend doctrine + author the shell spec.** Gates 1-4 closed: cross-zone design-language audit surfaced D-1..D-5 forensic findings (confidence-render divergence, yellow-token role-overload, staleness-mechanism drift, chevron CSS proliferation, click-affordance bimodality), plus typography ladder + status-vocabulary gaps. Doctrine v3 → v8 added 7 binding rules (R-1.6..R-1.12) and 25 INV-* invariants across 5 concept-class registers. Shell spec `sidebar-shell-spec.md` is now the resolution document for cross-zone vocabulary; per-zone artifacts cross-reference it (sections added 2026-04-29).

---

## §0 — SHC Shell-Spec Cross-References (added 2026-04-29)

This umbrella section consolidates the cross-zone vocabulary resolved across the 6 SHC Gate 4 walkthroughs. Per-zone artifacts (`sidebar-zone-0.md` through `sidebar-zone-4.md`) each carry their own focused cross-reference section pointing to the same shell-spec resolutions for the concept-classes they consume.

### Resolved concept-class registers (six)

The shell spec defines six concept-class registers, each with a fixed vocabulary, ordinal CSS contract, and concept-class-isolated token namespace. Together they define the cross-zone design language.

| § | Concept-class | Register | Token namespace | Render module (Gate 5) |
|---|---------------|----------|-----------------|------------------------|
| §I | **status** | 3-axis: connection-state / app-bridge / pipeline-stage-health | `--status-conn-{live,degraded,disconnected,fatal}` + `--status-app-{synced,absent}` + `--status-pipeline-{nominal,failed}` | `shared/render-status.js` |
| §II | **freshness** | 5-tier: `live` / `aging` / `stale` / `unknown` / `rejected` | `--fresh-tier-{live,aging,stale,unknown,rejected}` | `shared/render-staleness.js` |
| §III | **confidence** | 4-tier: `high` / `medium` / `low` / `unknown` (engine model outputs only — NOT mathematically exact derived values) | `--conf-tier-{high,mid,low,unknown}` | `shared/render-confidence.js` |
| §IV | **affordance** | 6-shape closed enum: `chevron` / `underline` / `pill` / `circle` / `divider` / `decorative-glyph` (4-glyph licensed registry: ★ ♦ ● →); plus `chip` non-interactive sub-form | n/a (uses concept-class shapes + ARIA) | `shared/render-affordance.js` (+ `data-affordance` delegated listener) |
| §V | **color tokens** | Layer-1 module-private primitives + Layer-2 exported semantic tokens (concept-class-isolated naming) | `_P.{color}_{shade}` (private) + verbose-explicit semantic names (e.g., `--action-class-call-bg`, `--qtr-pos`, `--fold-pct-high`) | `design-tokens.js` (single source of truth) |
| §VI | **density** | 3-tier typography: `--type-display` (24px / 1.5rem) / `--type-body` (14px / 0.875rem) / `--type-meta-stat` (11px / 0.6875rem); rem mandate; `.tabular-nums` modifier | `--type-{display,body,meta-stat}` + `--zone-{chrome,advice,content,deep}-padding` + 6-row attention-budget map | `design-tokens.js` typography + spacing scales |

### Doctrine v8 binding rules (added 2026-04-27 → 2026-04-29)

| Rule | Subject | Binds | Concept-class isolation? |
|------|---------|-------|--------------------------|
| **R-1.5** (text amended 2026-04-28) | Drill-down pathway — affordance vocabulary cites shell-spec §IV explicitly | All zones with drill-down (Z2→Z4, Z3 long-press) | n/a |
| **R-1.6** | Cross-zone treatment-type consistency (different render shapes per concept-class — confidence dot ≠ confidence label ≠ confidence opacity) | All zones rendering confidence | §III |
| **R-1.7** | Staleness shape-class consistency (dot OR badge OR strip — never mixed for same data) | Z0 + Z1 + Z3 | §II |
| **R-1.8** | Freshness mechanism declaration — INV-FRESH-1..5 (scope/mechanism/clearing/single-writer/visible-rejection) | Z0 + Z1 freshness signals | §II |
| **R-1.9** | Color-token concept-class isolation — INV-TOKEN-1..5 (no cross-class token reuse — `--m-*` ≠ `--qtr-*` ≠ `--conf-tier-*` ≠ `--fold-pct-*` etc.) | All zones using color tokens | §V |
| **R-1.10** | Affordance vocabulary — INV-AFFORD-1..5 (single affordance per element; reachable click handler; chevron direction vertical-only `▾`/`▴`; ≥44×44 tap target with explicit Class B exceptions) | All zones with click-action elements | §IV |
| **R-1.11** | Status vocabulary discipline — INV-STATUS-1..5 (single-writer per Z0 slot; severity monotonicity; no-lying-status; connected-waiting escalation; app-bridge staleness clearing) | Z0 chrome + status-bar | §I |
| **R-1.12** | Density-rhythm + attention-budget — INV-DENSITY-1..5 (rem mandate; typography ladder; tabular-nums on monospaced numerics; sample-count form `n=N` vs `Nh` discipline; 6-row attention-budget map per system state) | All zones (typography + spacing) | §VI |

### INV-* invariant catalog (25 invariants binding across the sidebar)

Per category, the invariants define the concrete enforceable contracts behind each binding rule:

- **INV-FRESH-1..5** — freshness signals must declare {scope, mechanism, clearing-path, single-writer, visible-rejection-tier} per §II.3 registry
- **INV-TOKEN-1..5** — Layer-1 / Layer-2 token graph; concept-class exclusivity; mirror-lock test; verbose-explicit naming; STYLE_COLORS consolidation in `design-tokens.js`
- **INV-AFFORD-1..5** — single affordance per element; reachable click handler; chevron vertical-only; tap-target ≥44×44 (with documented Class B exceptions); decorative-dot color-class exclusivity
- **INV-STATUS-1..5** — single-writer per slot; severity monotonicity; no-lying-status; connected-waiting 30s escalation; app-bridge staleness clearing via STATE_FIELD_SCOPES
- **INV-DENSITY-1..5** — rem mandate (no px font-size literals); typography ladder (3-tier); tabular-nums on monospaced numerics; sample-count form discipline; attention-budget tier per system state

### Forensics resolved (D-1..D-5 + FM-STATUS-* + FM-DENSITY-*)

| Forensic | Symptom | Resolution path | Sites |
|----------|---------|-----------------|-------|
| **D-1** | Confidence rendered three incompatible ways | V-2 + R-1.6 + extracted `shared/render-confidence.js`; remove `:441-470` opacity classes (§III.5 scope boundary) | `render-orchestrator.js:150-151,169` + `:441-444,450,462,465,470` + `render-tiers.js:67-74` |
| **D-2** | Yellow `#fbbf24` × 7 token roles (M-zone reuse for fold-pct, AF, etc.) | V-color-tokens + R-1.9 + new `--fold-pct-{high,mid,low}` + `--m-*` rename to bundle-isolated naming | `render-street-card.js:908` + multiple sites |
| **D-3** | Staleness mechanism coherence (timer-aging / DOM mutation / SW message — drift between rules) | V-3 + R-1.8 + 1Hz timer through `coordinator.dispatch('adviceAgeBadge', 'tick')` | `side-panel.js:1093-1099, 1369-1373` |
| **D-4** | Chevron CSS class proliferation (4 classes for one concept) | V-affordance + R-1.10 + 4-class collapse to `.affordance-chevron` (D-4 forensic) | 9 emit sites in `render-tiers.js:424,455,478,520,552,577,607,624,653` + `.deep-chevron`, `.collapsible-chevron`, `.pp-chevron`, `.tourney-bar-chevron` |
| **D-5** | Click-affordance bimodality (some elements click via inline `onclick`, others via delegated listener; some have visual affordance, some don't) | V-affordance + R-1.10 + `data-affordance` attribute + single delegated listener pattern (§IV.8) | Cross-cutting across all zones |
| **FM-STATUS-1** | Silent severity downgrade — `staleContext` writer overwrites contextDead red dot to yellow in same frame | V-status + R-1.11 + INV-STATUS-2 monotonicity + `:1847-1848` REMOVED | `side-panel.js:1847-1848` |
| **FM-STATUS-2** | versionMismatch silent persistence (text set, className not) | V-status + R-1.11 + INV-STATUS-3 no-lying-status + className fix | `side-panel.js:215-217` |
| **FM-DENSITY-1** | 9px stale-badge font sub-WCAG SC 1.4.4 (illegible on Galaxy A22 DPR) — **currently shipping accessibility violation, highest Gate 5 priority** | V-density + R-1.12 + INV-DENSITY-1 rem mandate + migrate `font-size: 9px` → `--type-meta-stat` (11px / 0.6875rem) | `side-panel.html:74` |
| **5-writer race for `#status-dot`** | Five writers compete for same DOM slot, no monotonicity, no single-writer discipline | V-status + R-1.11 + INV-STATUS-1 single-writer + 5-writer consolidation to `renderConnectionStatus` IIFE | `side-panel.js:198-218, :785-794, :1847-1848, :2590-2593, harness.js:81` |

### Per-zone shell-spec cross-reference index

Each zone artifact carries a "## SHC Shell-Spec Cross-References (added 2026-04-29)" section enumerating which concept-classes it consumes, which doctrine binding rules + INV-* invariants apply, currently-shipping bugs documented for that zone, and Gate 5 co-shipping items.

| Zone | Shell-spec sections consumed | Primary INV-* bindings | Currently-shipping bugs |
|------|------------------------------|------------------------|-------------------------|
| **Z0** | §I status (canonical) + §V color (`--status-*` tokens) + §VI density (`--zone-chrome-padding`, `--type-meta-stat`) | INV-STATUS-1..5 | FM-STATUS-1, FM-STATUS-2, FM-DENSITY-1, 5-writer race |
| **Z1** | §II freshness (canonical CC-B-1) + §III confidence (when surfaced) + §V color (M-tokens, style-chips) + §VI density (PRIMARY in between-hands) | INV-FRESH-1..5, INV-TOKEN-2, INV-DENSITY-1/3 | (none currently shipping; corpus gaps low-priority) |
| **Z2** | §III confidence (canonical D-1 site) + §IV affordance (action-pill) + §V color (`--action-class-*` cross-cutting) + §VI density (PRIMARY in active-hand-advice) | INV-TOKEN-1..5, INV-AFFORD-1, INV-DENSITY-1/3 | D-1 confidence divergence, `||` vs `??` bug at `:147`, hardcoded 24px at `:400` |
| **Z3** | §IV affordance (chip + glyph registry) + §V color (fold-pct tokens, INV-AFFORD-5 weakness vs reject collision) + §VI density (PRIMARY in active-hand-analyzing) | INV-TOKEN-2, INV-AFFORD-1/3/5, INV-DENSITY-3 | F-A finding (EV bar vs range bar visual collision — documented for future audit) |
| **Z4** | §III confidence (glance tier) + §IV affordance (chevron canonical D-4 site) + §VI density (available-collapsed tier) | INV-AFFORD-1..4, INV-DENSITY-3 | (Model Audit flag-on corpus gap; chevron sub-44 tap-target grandfathered for Gate 5 milestone) |

### Zone-numbering note (cross-cutting)

SHC Gate 3 inventory (`docs/design/audits/2026-04-27-observation-sidebar-coherence-inventory.md`) used a zone-numbering where **Z1 = seat arc** + **Z2 = advice header**. Existing surface artifacts (this doc + per-zone files) use the SR-program rebuild numbering where **Z1 = (consolidated, not standalone)**, **Z2 = Table Read**, **Z3 = Decision / Street Card**. Both reference the same underlying surfaces; the shell-spec concept-class vocabulary is independent of zone-numbering, so cross-references work across both framings. When reading SHC Gate 3 inventory entries, mentally translate Z1-inventory → Z2/Z3-artifact (Table Read + Decision overlap region).

### Gate 5 implementation roadmap (consolidated)

Gate 5 is the multi-PR rollout that ships the doctrine + shell-spec resolutions to code. Highest-priority items (must ship together to avoid stranding tests against unresolved code):

1. **`shared/` module extraction** — `render-confidence.js`, `render-staleness.js`, `render-affordance.js`, `render-status.js` authored as pure classifier modules (cross-product portable per V-3.3 + V-color-tokens.5)
2. **Token migrations** — `--status-*` + `--conf-tier-*` + `--fresh-tier-*` + `--fold-pct-*` + `--action-class-*` entries in `design-tokens.js` + meta file; STYLE_COLORS consolidation
3. **5-writer status consolidation** — `side-panel.js:198-218, :785-794, :1847-1848, :2590-2593, harness.js:81` → single `renderConnectionStatus` IIFE writer
4. **WCAG SC 1.4.4 violation fix** — `side-panel.html:74` 9px → `--type-meta-stat` (currently-shipping a11y issue)
5. **Click-wiring `data-affordance` consolidation** — must precede V-3 staleness implementation per V-affordance Q-2 race-prevention
6. **4-chevron-class collapse** — `.deep-chevron` + `.collapsible-chevron` + `.pp-chevron` + `.tourney-bar-chevron` → `.affordance-chevron` (9 emit sites in `render-tiers.js`)
7. **Test infrastructure** — `freshness-signal-registry.test.js`, `status-registry.test.js`, `dom-mutation-discipline.test.js` extension, mirror-lock test for token cross-product parity, INV-* assertion suites
8. **STATE_FIELD_SCOPES extensions** — `lastGoodExploits` clearing-path on `connection:appDisconnected` (INV-STATUS-5)
9. **R-2.3 timer compliance** — 1Hz stale-advice tick through `coordinator.dispatch('adviceAgeBadge', 'tick')` (no direct DOM mutation)
10. **ARIA contracts per concept-class** — `role="status"` + `aria-live="polite"` on status-bar; `role="alert"` + `aria-live="assertive"` on recovery banner (only assertive site in sidebar); `role="button"` + `aria-expanded`/`aria-controls` on chevrons; `aria-disabled="true"` on stale action pills

---

## §1 — Zone inventory

Sidebar layout is 5 named zones, fixed vertical hierarchy (R-1.1), no runtime reordering (R-1.3). Zone Z1 existed in the pre-rebuild layout but was consolidated into Z0 + Z2 during SR-4 (see `.claude/projects/sidebar-rebuild/04-z*.md` handoffs).

| Zone | Surface artifact | Role |
|------|------------------|------|
| **Z0** — Chrome + Diagnostics | `sidebar-zone-0.md` | Top chrome: session header, tournament log, pipeline health, diagnostics footer. Informational tier. |
| **Z1** — (consolidated) | — | Seat-style badge moved into Z3 scouting panel during SR-4; no standalone Z1 surface. |
| **Z2** — Table Read | `sidebar-zone-2.md` | Pre-hand + between-hands context: pot chip, street indicator, stale-advice fresh-signal, seat activity. Glance-primary. |
| **Z3** — Decision / Street Card | `sidebar-zone-3.md` | Active-hand decision surface: action history, advice, multiway selector, no-aggressor placeholder, sizing presets. Highest-priority zone per interruption discipline (R-3.3). |
| **Z4** — Deep Analysis | `sidebar-zone-4.md` | Post-decision expansion: Model Audit (flag-gated), per-seat villain detail, freshness ledger. Drill-down tier. |

Each zone's surface artifact documents: purpose, JTBDs served, personas served, code paths, FSM lifecycle reference, freshness contract, and known issues per the SR program post-mortem.

---

## §2 — Personas and JTBDs served (by zone)

| Persona | Primary zone(s) | Notes |
|---------|-----------------|-------|
| [Multi-Tabler](../personas/core/multi-tabler.md) | Z3 decision, Z2 table-read | Canonical sidebar persona — glance-every-8s across 4–8 tables. |
| [Online MTT Shark](../personas/core/online-mtt-shark.md) | Z3 decision + Z0 tournament log | Tournament context on Z0 still incomplete vs main-app TournamentView (known parity gap, discovery `2026-04-21-sidebar-tournament-parity`). |
| [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) | Z2 + Z3 + Z4 | Cross-product use; interacts with both sidebar and main-app OnlineView. |
| [Between-hands-Chris](../personas/situational/between-hands-chris.md) | Z2 primary | Between-hands preview during live main-app use — NOT a sidebar user directly, but the persona's cognitive model informed R-3.4 (between-hands has no preemption right). |

**JTBDs served (canonical) — see ATLAS:**
- `JTBD-MH-01` (see recommended action) → Z3 decision zone primary
- `JTBD-MH-03` (bluff-catch frequency) → Z3 + Z4 drill-down
- `JTBD-MH-04` (sizing suggestion tied to calling range) → Z3 sizing-presets
- `JTBD-MH-08` (blockers in fold-equity math) → Z4 detail
- `JTBD-HE-13` (auto-capture) → Z0 pipeline-health indicator
- `JTBD-SR-24` (filter by street/position/opponent-style) → not sidebar — lands in main-app OnlineView

---

## §3 — Heuristic cross-map: framework heuristics ↔ doctrine rules

Where the sidebar doctrine's 33 rules already satisfy a framework heuristic by construction, the cross-map cites the rule. Where the heuristic is observed but un-rule-coded, it's noted as an opportunity for future rule extension (if the sidebar program reactivates).

### Nielsen-10 (H-N*)

| Heuristic | Sidebar doctrine rule(s) | Coverage |
|-----------|--------------------------|----------|
| H-N1 visibility of system status | R-4.1–R-4.5 (freshness contract), R-7.4 (invariant violations observable) | ✓ Direct |
| H-N2 match system and real world | No direct rule; sidebar vocabulary inherits from main-app design tokens | Indirect |
| H-N3 user control + freedom | No sidebar-specific rule; sidebar is display-only, no user actions to undo | N/A (display surface) |
| H-N4 consistency + standards | R-1.1, R-1.3 (zone + position stability); R-1.5 (drill-down pathway uniform vocabulary) | ✓ Direct |
| H-N5 error prevention | R-2.* (FSM lifecycle — prevents classList.toggle leaks); R-5.6 (single-owner-per-slot) | ✓ Direct |
| H-N6 recognition rather than recall | R-1.2 + R-1.5 (spatial memory + glance pathway) | ✓ Direct (core premise) |
| H-N7 flexibility + efficiency | R-1.5 drill-down affordances | Partial |
| H-N8 aesthetic + minimalist | R-1.2 glance test (per-element), R-6.* motion budget | Partial |
| H-N9 recognize/diagnose/recover from errors | R-7.4 emergency badge counter + R-10.1 payload invariants | ✓ Direct |
| H-N10 help + documentation | No direct rule — sidebar is not documented in-product | Gap |

### Poker-Live-Table (H-PLT*)

| Heuristic | Sidebar doctrine rule(s) | Coverage |
|-----------|--------------------------|----------|
| H-PLT-01 glance-readable in <1 second | R-1.2 glance test | ✓ Direct (rule specifically states 1-second threshold) |
| H-PLT-03 dim-light readable | No direct rule; sidebar inherits extension styling | Opportunity |
| H-PLT-04 destructive-action guard | N/A — sidebar is display-only | N/A |
| H-PLT-05 primary content prominence | R-1.1 zone vertical hierarchy | ✓ Direct |

### Mobile-Landscape (H-ML*)

| Heuristic | Sidebar doctrine rule(s) | Coverage |
|-----------|--------------------------|----------|
| H-ML01 discoverability | N/A — sidebar is a single surface, no discovery | N/A |
| H-ML02 density vs chrome | R-1.2 (glance test + per-element footprint constraints) | ✓ Direct |
| H-ML03 thumb reach | N/A — desktop context; no thumb constraints | N/A |
| H-ML06 ≥44×44 touch targets | N/A — desktop context; mouse pointer | N/A |
| H-ML08 inputMode for numeric inputs | N/A — sidebar is display-only | N/A |

Mobile-Landscape heuristics largely don't apply because the sidebar runs in Chrome desktop context. The main-app OnlineView IS subject to all three heuristic sets (covered under `online-view.md`).

---

## §4 — Known issues carried forward from SR / STP programs

The Sidebar Rebuild + Sidebar Trust Program post-mortems (`.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`, `SW_REANIMATION_REPLAY.md`, `STATE_CLEAR_ASYMMETRY.md`) document the 5 symptoms S1–S5 + 8 mechanisms + 11 state-clear asymmetries that the programs resolved. No new issues surface at the W5 documentation pass; each zone's surface artifact references the relevant post-mortem entries where applicable.

Open cross-surface items affecting sidebar:
- **`2026-04-21-sidebar-tournament-parity` discovery** (CAPTURED) — Hybrid / Online MTT Shark tournament-overlay gap. Main app has TournamentView with M-ratio + ICM; sidebar Z0 has a tournament log but no parity indicator.
- **`DCOMP-W4-A2-F10` contracts/tournament-to-table** — documentation of the cross-surface coupling between TournamentContext and TableView/LiveAdviceBar; when authored, mirror the contract entry for sidebar ↔ TournamentContext if applicable.

---

## §5 — Related surfaces

- `online-view.md` — main-app companion to the sidebar (reviewed under DCOMP-W4-A3)
- `table-view.md` — main-app live-entry; shares persona/JTBD vocabulary
- Cross-surface journey `briefing-review.md` — touches both sidebar (Z3 advice) and main-app OnlineView

---

## Change log

- 2026-04-22 — Created (DCOMP-W5 session 1, first integration pass). Cross-maps 33 doctrine rules ↔ 3 heuristic sets; inventories 5 active zones; references SR program post-mortems for open items. 5 zone-level artifacts authored alongside.
- 2026-04-29 — SHC Gate 4 integration pass. Added §0 SHC Shell-Spec Cross-References (umbrella section consolidating the 6 resolved concept-class registers, doctrine v8 binding rules R-1.6..R-1.12, 25 INV-* invariants, D-1..D-5 forensic resolutions + FM-STATUS-* + FM-DENSITY-* currently-shipping bugs, per-zone cross-reference index, zone-numbering disambiguation note, and Gate 5 implementation roadmap). Shell spec `sidebar-shell-spec.md` is now the resolution document for cross-zone vocabulary. Per-zone artifacts (zone-0 through zone-4) each carry their own focused cross-reference sections pointing to the umbrella resolutions for the concept-classes they consume.
