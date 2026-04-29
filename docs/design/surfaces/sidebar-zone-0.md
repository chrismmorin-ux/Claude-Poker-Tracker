# Surface — Sidebar Zone 0 (Chrome + Diagnostics)

**ID:** `sidebar-zone-0`
**Zone role:** Top chrome. Session header + tournament log + pipeline health + diagnostics footer. Informational interruption tier (R-3.* can be overwritten by equal or higher tiers — never overwrites active-hand content).
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (hierarchy), §4 (freshness), §7 (invariants); doctrine v8 binding rules — see SHC cross-references below
- `docs/design/surfaces/sidebar-shell-spec.md` §I status (resolved 2026-04-28 via SHC Gate 4 V-status)
- `docs/design/surfaces/sidebar-zones-overview.md` (W5 umbrella + heuristic cross-map)
- `.claude/projects/sidebar-rebuild/04-z0-chrome.md` (SR-4 handoff — Z0-specific rebuild)
- Ignition extension code: `ignition-poker-tracker/render-orchestrator.js`, `side-panel.js` (Z0 diagnostics footer at `side-panel.js:1369-1373, 2288, 2321-2338`)

---

## SHC Shell-Spec Cross-References (added 2026-04-29)

Z0 chrome elements (status indicators, app-bridge badge, pipeline-health strip, recovery banner) implement vocabulary resolved in SHC Gate 4 V-status walkthrough (2026-04-28).

**Concept-classes consumed:**
- **§I status** — CC-A-1 connection-status dot (`#status-dot`), CC-A-3 app-status badge, CC-A-4 pipeline-health strip (`!hasHands` visibility-gated), CC-A-5 recovery banner. 3-axis decomposition (connection-state / app-bridge / pipeline-stage-health) per §I.1.
- **§V color tokens** — `--status-conn-{live,degraded,disconnected,fatal}` + `--status-app-{synced,absent}` + `--status-pipeline-{nominal,failed}`. New `_P.orange_status` Layer 1 primitive (distinct from `_P.orange_deep`) for `--status-app-absent`.
- **§VI density** — Z0 chrome row uses `--zone-chrome-padding`; status bar typography uses `--type-meta-stat` (status text) + `--type-body` (status-bar header). Ambient tier in attention-budget map per §VI.6 across all system states except `fatal-error` and `empty-no-table` where Z0 is PRIMARY.

**Doctrine binding rules:**
- **R-1.6** treatment-type consistency (status uses dot for connection-state; badge for app-bridge; strip for pipeline-stage)
- **R-1.7** strip shape-class (pipeline-strip is canonical example of `strip` shape)
- **R-1.11** status-vocabulary discipline + INV-STATUS-1..5 (binding)
- **R-1.12** density-rhythm + attention-budget (Z0 ambient/PRIMARY tiers per state)
- **R-3.1** recovery banner = emergency interruption-tier (DOM outside `#hud-content`; preempts active-hand)

**INV-* invariants binding on Z0:**
- **INV-STATUS-1** single-writer per Z0 slot (5-writer race documented at `side-panel.js:198-218, :785-794, :1847-1848, :2590-2593, harness.js:81` — must consolidate to one)
- **INV-STATUS-2** severity monotonicity within render frame (closes FM-STATUS-1 silent severity downgrade)
- **INV-STATUS-3** no-lying-status — every `connState.cause` value emits defined dot class (closes FM-STATUS-2 versionMismatch persistence)
- **INV-STATUS-4** connected-waiting escalation (30s timer)
- **INV-STATUS-5** app-bridge staleness clearing (`lastGoodExploits` STATE_FIELD_SCOPES adds `connection:appDisconnected`)

**Currently-shipping bugs documented:**
- **FM-STATUS-1** (silent severity downgrade) — `staleContext` writer at `:1847-1848` overwrites contextDead red dot to yellow in same frame.
- **FM-STATUS-2** (versionMismatch silent persistence) — `:215-217` sets text but NOT className.
- **FM-DENSITY-1** (9px stale-badge font illegible on Galaxy A22 DPR) — `side-panel.html:74` font-size: 9px is sub-WCAG SC 1.4.4 minimum. **Highest priority Gate 5 remediation.**

**Gate 5 co-shipping (from §I.12 + §VI.10):**
- New `shared/render-status.js` module (pure classifier; renderConnectionStatus stays sole IIFE writer)
- 5-writer consolidation
- `staleContext` inline override at `:1847-1848` REMOVED
- `versionMismatch` className fix at `:215-217`
- `--status-*` token entries in `design-tokens.js` + meta file
- `status-registry.test.js`
- `dom-mutation-discipline.test.js` extension
- `STATE_FIELD_SCOPES.md` `lastGoodExploits` clearing-path extension
- ARIA contract per §I.11 (role="status" + aria-live="polite" on status-bar; role="alert" + aria-live="assertive" on recovery banner — only assertive site in sidebar)
- `connectedWaitingTimeout` 30s timer registration

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
