# Surfaces — Sidebar Zones (DCOMP-W5 Overview)

**ID:** `sidebar-zones-overview`
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` — 33-rule doctrine v2 (authoritative)
- `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` — program post-mortem
- `.claude/projects/sidebar-rebuild/` — per-stage artifacts
- `src/contexts/SyncBridgeContext.jsx` + extension code in `ignition-poker-tracker/`
- Per-zone surface artifacts: `sidebar-zone-0.md` through `sidebar-zone-4.md`

**Product line:** Cross-product — extension sidebar surfaces + main-app OnlineView companion (see `online-view.md`).
**Tier placement:** Pro (full sidebar) + a proposed Sidebar-Lite subscription (F-P16).
**Last reviewed:** 2026-04-22 (DCOMP-W5 first integration pass)

---

## Purpose of this document

The sidebar (extension-rendered HUD running over the Ignition client) is a separate surface system from the main app. It has its own 33-rule **doctrine** (Sidebar Rebuild Stage 2 artifact) and its own program history (Sidebar Rebuild SR-0..SR-7 + Sidebar Trust Program STP-1). The main Design Compliance framework (personas + JTBDs + heuristics + audits) was authored for the main app primarily.

DCOMP-W5 integrates the sidebar into the framework:

1. **5 zone-level surface artifacts + 1 overview** (this doc + `sidebar-zone-0.md` through `sidebar-zone-4.md`).
2. **Heuristic cross-map** (this doc §3) shows which Nielsen-10 / Poker-Live-Table / Mobile-Landscape heuristics already have direct doctrine rules, and which are observed informally but un-rule-coded.
3. **Persona / JTBD pointer table** (this doc §2) maps each zone to the personas and JTBDs it serves (consistent with how main-app surfaces document).

The doctrine remains authoritative for sidebar rules. The framework layer adds cross-surface consistency + a common vocabulary for audits that span sidebar + main-app (e.g., the cross-surface finding `2026-04-21-sidebar-tournament-parity` discovery).

**DCOMP-W5 does NOT re-run the Sidebar Rebuild audit.** The sidebar already had 5 months of rigorous audit + rebuild work under SR-0..SR-7 and STP-1. W5 is a documentation-integration pass.

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
