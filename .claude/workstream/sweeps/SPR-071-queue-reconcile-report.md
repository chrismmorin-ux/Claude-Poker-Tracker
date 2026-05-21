# SPR-071 Queue Reconciliation Sweep Report

**Date:** 2026-05-11
**Sprint:** SPR-071 (WS-179)
**Scope:** All P≥15 unclaimed tickets (43 items)
**Disposition taxonomy:** SHIPPED-elsewhere / SUPERSEDED / LEGITIMATE-BACKLOG / NEEDS-RESCOPE / PAUSED-INDEFINITELY
**Retention policy:** In-place with status:done + done_provenance (mirrors WS-038 pattern)

## Summary

| Disposition | Count | Action |
|---|---|---|
| SHIPPED-elsewhere | 3 | status:done + done_provenance with evidence |
| SUPERSEDED | 2 | status:done + supersession pointer |
| LEGITIMATE-BACKLOG | 22 | status:backlog + freshness stamp 2026-05-11 |
| NEEDS-RESCOPE | 4 | status:backlog + rescope direction in note |
| PAUSED-INDEFINITELY | 12 | status:backlog + P-score reset 15→8 (P2→P3) |

**Zero src/ diff** (queue-state-only sweep).
**Category retitling:** 13 "ready-to-start" tickets retitled to project-anchored categories (`range-lab`, `played-hand-review-protocol`).

## Per-ticket detail

### SHIPPED-elsewhere (3)

| ID | Title | Evidence |
|---|---|---|
| WS-021 | Cross-anchor invalidation atomicity test (EAL-G5-CA) | `src/utils/anchorLibrary/primitiveValidity.js` + `primitiveValidity.test.js` ship cross-anchor ripple (Commit 4 2026-04-25 per `src/utils/anchorLibrary/index.js`); `src/utils/anchorLibrary/CLAUDE.md §4` pins I-EAL-9 invariant. |
| WS-024 | Tier 1 simulator scenarios for 4 seed anchors (EAL-G5-T1) | 4 seed-anchor scenario tests at `src/utils/anchorLibrary/__tests__/{fishOvercallTurnDoubleBarrel,lagOverbluffRiverProbe,nitOverfoldRiver4flush,tagOverfoldFlopDonk}.test.js`; 3 simulator primitives at `__sim__/scenarios/{floatVsRangeBettor,riverBluffPruning,turnBarrelExtension}.js`; runner + synthetic-villain harness shipped. |
| WS-061 | Corpus scaling (US-1) | `docs/upper-surface/reasoning-artifacts/` ships 15 artifacts (accept-criterion threshold met exactly); ~50 companion files across `audits/` + `comparisons/` + `drill-cards/`; `RUBRIC.md` + `RUBRIC-CHANGELOG.md` records v2.2 governance. |

### SUPERSEDED (2)

| ID | Title | Superseded by |
|---|---|---|
| WS-049 | Playwright print-to-PDF snapshot tests (PRF-G5-PDF) | PRF-G5-WR writer-registry pattern + per-card snapshot expansion. New cards add their snapshots incrementally (`tests/playwright/printable-refresher.spec.js-snapshots`); there is no one-time sweep ticket. |
| WS-075 | Clear All Seats button height ≥44px (DCOMP-W4-A1-F7) | `docs/design/surfaces/table-build.md` — TableBuildView replaces the seat-assignment grid wholesale per Gate 4 ratification 2026-04-26. Founder explicitly accepted supersession in original accept-criterion. |

### LEGITIMATE-BACKLOG (22)

**MPMF cluster (6):** WS-027 (Q7 legal), WS-030 (Stripe), WS-031 (PaywallGate), WS-032 (BillingSettings), WS-033 (PostHog), WS-036 (H-SC01 test). All carry pre-existing `blocked_by_note` triggering soft-block damping in `/next` (0.25×). MPMF Gate 4 surfaces (S1..S6 + J1..J4) enumerated in project doc but no individual queue tickets.

**PIO (1):** WS-164 (multi-attribute ranking + scoring). Structural blocker WS-163 cleared at SPR-049/050; soft-block on Table-Build Gate 5 keeps surface wire-in deferred but core utility ships.

**Shape Language (5):** WS-039 (Gate 4 — now unblocked by WS-038 close at SPR-069), WS-040 (Stream D), WS-041 (Stream B1), WS-042 (Stream B2), WS-043 (Stream B3). Dependency chain intact.

**Printable Refresher (1):** WS-047 (Phase A preflop cards). Phase B (6 math cards) shipped via `src/utils/printableRefresher/manifests/prf-math-*.json`; preflop manifests not yet authored.

**Range Lab (5):** WS-053..057 (Gate 2/3/4 + Phase 1/2). Project at Gate 1 CLOSED; Gate 2 is next. Drills Consolidation "HOLD" referenced in project doc is moot — Drills Consolidation was REJECTED 2026-04-22 (`status: rejected` in `drills-consolidation.project.md`). Retitled `ready-to-start` → `range-lab`.

**HRP (1):** WS-067 (Gate 4 specs). Project doc lists Phase 3 as "NEXT <- CURRENT"; HRP-E-TREE-EXPOSE shipped 2026-04-29 (commit ef81ef6) demonstrates ongoing activity. Stale "PAUSED" status_note from 2026-05-01 migration removed. Retitled `ready-to-start` → `played-hand-review-protocol`.

**DCOMP-W4 (1):** WS-079 (sidebar↔OnlineView contract). `docs/design/contracts/sidebar-to-online-view.md` does not exist; companion contracts (persisted-hand-schema.md, tournament-to-table.md) live in that directory.

**LSW (2):** WS-087 (turn decision nodes — gated on Stream A audit close + WS-086), WS-092 (HERO_BUCKET_TYPICAL_EQUITY board-conditioning — gated on solver access).

### NEEDS-RESCOPE (4)

| ID | Title | Rescope direction |
|---|---|---|
| WS-020 | Hook-hoisting race test (EAL-G5-HH) | EAL Stream D shipped at SPR-066; test premise now testable but specific test not authored. Needs: which concrete race to reproduce, how to fail-loud if persistence-hook double-loads, which surface combination triggers worst case. |
| WS-023 | Per-seed-anchor snapshot tests (EAL-G5-SS) | EAL Stream B matcher infra ships; RT-108 pattern needs application to per-seed-anchor matcher output. Distinct from WS-024 (which tests SIMULATOR; this would test MATCHER+APPLIER). |
| WS-025 | 9 autonomy red lines in-app assertions (EAL-G5-RL) | AP-PIO-04 + AP-06 forbidden-pattern enforcement DOM-asserted in CalibrationDashboardView S22 ship; the 9 distinct red-line test assertions have NOT been cataloged into a registry. Needs: enumerate 9 red lines as test IDs, decide single suite vs partition across surfaces. |
| WS-074 | Coordinate with exploit-deviation on AssumptionCard (HRP-COORD-MH12) | No `AssumptionCard*` component exists. Convert to checklist note on HRP-G4-SPEC (WS-067) + exploit-deviation Gate 4 — coordination ticket without scope shouldn't anchor a sprint. |

### PAUSED-INDEFINITELY (12) — P-score reset 15→8 (P2→P3)

| ID | Title | Why paused |
|---|---|---|
| WS-029 | Ignition-mode surface design (MPMF-G4-IM) | Conditional on Q3 re-verdict + Q7 legal scoping; project Phase 1 explicitly excludes Ignition-mode scope. |
| WS-068 | Stream E spotResolver (HRP-E-RESOLVER) | Downstream of WS-067 Gate 4 specs (unscheduled). Retitled `ready-to-start` → `played-hand-review-protocol`. |
| WS-069 | Stream E IDB schema (HRP-E-SCHEMA) | Same — downstream of WS-067. Retitled. |
| WS-070 | Stream U HandBrowser (HRP-U-BROWSER) | Downstream of WS-067 + WS-069. Retitled. |
| WS-071 | Stream U hand-review-modal (HRP-U-MODAL) | Downstream of WS-067 + WS-068. Retitled. |
| WS-072 | Stream U ShowdownView producer (HRP-U-SHOWDOWN) | Downstream of WS-067 + WS-069. Retitled. |
| WS-073 | Stream U polish (HRP-U-POLISH) | Downstream of WS-071. Retitled. |
| WS-097 | LSW-P3 authored plans on flop roots | Deferred to LSW-v2 per project doc line 73. LSW-v2 not ticketed. |
| WS-098 | LSW-P6 audit dimension 8 | Deferred to LSW-v2 (downstream of WS-097). |
| WS-108 | Content+SW throttle coordination (RT-84) | Owner: "mitigated in practice once RT-68 ships." |
| WS-109 | CAPTURED_HANDS migration validateHandForRelay (RT-86) | Owner: "One-time migration path — defer." |
| WS-110 | QuotaExceededError silent swallow (RT-87) | Owner: "Rare in practice — defer until observed." |

## Effects on /next composition

**Before sweep:** 43 unclaimed P≥15 items competing for ranking. Soft-block damping applied to 5 MPMF items (P=22 → P=5.5). 13 items in `ready-to-start` category obscured their actual project provenance. 5 stale tickets (WS-021, WS-024, WS-049, WS-061, WS-075) anchored false candidates.

**After sweep:**
- 5 items retired (status:done): WS-021, WS-024, WS-049, WS-061, WS-075
- 12 items deprioritized to P3=8: WS-029, WS-068..073, WS-097, WS-098, WS-108..110
- 4 items kept at P=15 but flagged NEEDS-RESCOPE: WS-020, WS-023, WS-025, WS-074
- 22 items confirmed LEGITIMATE-BACKLOG with refreshed freshness stamps
- 13 items retitled from `ready-to-start` to `range-lab` (5) / `played-hand-review-protocol` (8)

**Net P≥15 unclaimed candidate set after sweep:** 26 items (down from 43).

## Cross-references

- WS-179 (this sprint's anchor ticket)
- SPR-069 close-out: "Recommended /workstream reconcile sweep as separate ticket"
- SPR-068 composition_notes: "WS-080/105/135/159 likely also stale"
- SPR-067 partial precedent: "Index drift cleared 2026-05-10 SPR-067 reconcile sweep" markers in WS-029/077/078/105/106/107 status_notes
- WS-038 done_provenance template (mirror pattern for SHIPPED-elsewhere disposition)

## Verification

- Zero src/ diff (queue-state-only).
- 43 queue YAML files modified; queue-index.yaml updated for 5 status:done flips.
- This report serves as the audit table for the sweep; one row per ticket processed.

## Followups (not in this sweep's scope)

1. **MPMF Gate 4 surface ticketing:** S1..S6 + J1..J4 enumerated in project doc but no individual queue tickets exist. Either create them as backlog items or accept that MPMF cluster stays soft-blocked until the surfaces ship outside the queue.
2. **LSW-v2 charter:** WS-097/WS-098 deferred there; no charter exists. Either author it or fold those tickets into v1 closeout.
3. **Table-Build Gate 5 ticketing:** WS-164 soft-blocks on it; the project exists at `docs/projects/table-build/` but Gate 5 isn't ticketed.
4. **NEEDS-RESCOPE follow-through:** WS-020/023/025/074 each carry a concrete rescope direction in their status_notes; whichever surface them at /next next should resolve into actionable tickets first.
5. **P<15 unclaimed pass:** This sweep was scoped P≥15. P3=8 items (~43 more) may have similar drift but compose-pressure is minimal.
