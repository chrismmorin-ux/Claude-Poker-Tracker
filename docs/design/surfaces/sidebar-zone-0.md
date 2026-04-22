# Surface — Sidebar Zone 0 (Chrome + Diagnostics)

**ID:** `sidebar-zone-0`
**Zone role:** Top chrome. Session header + tournament log + pipeline health + diagnostics footer. Informational interruption tier (R-3.* can be overwritten by equal or higher tiers — never overwrites active-hand content).
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (hierarchy), §4 (freshness), §7 (invariants)
- `docs/design/surfaces/sidebar-zones-overview.md` (W5 umbrella + heuristic cross-map)
- `.claude/projects/sidebar-rebuild/04-z0-chrome.md` (SR-4 handoff — Z0-specific rebuild)
- Ignition extension code: `ignition-poker-tracker/render-orchestrator.js`, `side-panel.js` (Z0 diagnostics footer at `side-panel.js:1369-1373, 2288, 2321-2338`)

**Product line:** Sidebar (cross-product via OnlineView companion)
**Tier placement:** Pro (full Z0) + Sidebar-Lite (stripped Z0 — session header only)
**Last reviewed:** 2026-04-22 (DCOMP-W5)

---

## Purpose

Z0 is the fixed top-of-sidebar chrome strip. Session identity + diagnostic honesty. Does NOT carry advice or decision content — that's Z3's zone. Per R-3.4, Z0 is `informational` and has no preemption right over active-hand zones.

## JTBD served

- `JTBD-HE-13` auto-capture status (pipeline health indicator)
- `JTBD-TS-35..37` tournament awareness (partial — tournament log exists; full parity gap tracked by `sidebar-tournament-parity` discovery)

## Personas served

- [Online MTT Shark](../personas/core/online-mtt-shark.md) — tournament log
- [Multi-Tabler](../personas/core/multi-tabler.md) — session identification across tables

## Elements (per SR pre-cutover audit 07-pre-cutover-audit.md)

- 0.1 Session header
- 0.2 Extension version
- 0.3 Connection state indicator
- 0.6 Tournament log (no explicit corpus frame — flagged low-priority by SR audit)
- 0.7 Diagnostics link (flag-gated via `settings.debugDiagnostics`)
- 0.9 Pipeline health (all-green state uncovered in corpus — flagged low-priority)

## FSM / lifecycle

Z0 elements are mostly stateless display — session header derives from SyncBridgeContext. Diagnostics footer is flag-gated at `settings.debugDiagnostics`; absent when flag off (harness-tested). No FSM per the doctrine — Z0 is `informational` tier (R-3.*).

## Freshness contract

Per R-4.1–R-4.5: every Z0 indicator that changes on data update must carry a freshness signal. Pipeline health indicator displays `green/amber/red` based on last-capture-within-N-seconds threshold. Tournament log timestamp visible on hover.

## Known issues carried forward

- **0.6 tournament log** — no explicit audit corpus frame (SR-7 pre-cutover flagged as low-priority)
- **0.7 diagnostics link flag-on** — corpus gap (only flag-off DOM-absence verified)
- **0.9 pipeline health all-green** — corpus gap (intermediate + error states pinned; all-green state uncovered)
- **Cross-product parity gap** (`sidebar-tournament-parity` discovery) — Z0 tournament log is logging-only; main-app TournamentView has M-ratio + ICM. Hybrid / Online MTT Shark persona expects parity.

## Heuristic alignment

Per `sidebar-zones-overview.md` §3:
- H-N1 visibility of system status — pipeline health indicator satisfies directly
- H-N4 consistency + standards — fixed position per R-1.1 / R-1.3
- H-N9 recognize/diagnose/recover — diagnostics link + flag-gated footer satisfy directly
- H-PLT-01 glance-readable — session header satisfies (R-1.2 glance test)
- H-N10 help + documentation — gap; Z0 has no in-product documentation

## Potentially missing

- Tournament parity panel (cross-product discovery item)
- In-product documentation for diagnostics output (currently console-only)

## Change log

- 2026-04-22 — Created (DCOMP-W5).
