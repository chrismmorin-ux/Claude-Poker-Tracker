# Surface — Sidebar Zone 1 (Table Read)

**ID:** `sidebar-zone-1`
**Zone role:** Pre-hand + between-hands table context. Pot chip, street indicator, seat activity, stale-advice freshness signal. Glance-primary for the "what's happening at the table right now" question.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (hierarchy), §3 (interruption discipline — R-3.4 between-hands is informational), §4 (freshness); doctrine v8 binding rules — see SHC cross-references below
- `docs/design/surfaces/sidebar-shell-spec.md` §II freshness + §III confidence + §V color tokens + §VI density (resolved 2026-04-27/28 via SHC Gate 4)
- `docs/design/surfaces/sidebar-zones-overview.md` (W5 umbrella)
- `.claude/handoffs/sr-4-z1-table-read.md` (SR-4 handoff)

---

## SHC Shell-Spec Cross-References (added 2026-04-29)

Z1 Table Read elements (pot chip, street indicator, seat-activity badges, stale-advice freshness signal, between-hands content) implement vocabulary resolved across multiple SHC Gate 4 walkthroughs.

**Concept-classes consumed:**
- **§II freshness** — stale-advice freshness signal (CC-B-1 stale-advice badge per §II.3 registry); `live`/`aging`/`stale`/`unknown` 4-tier register; rejected tier reserved for SW-replay rejection. Mechanism = timer-driven-aging per `coordinator.scheduleTimer('adviceAgeBadge', ...)` 1Hz refresh at `side-panel.js:1093-1099`.
- **§III confidence** — when villain-style confidence indicators surface in Table Read (e.g., per-seat style-tag confidence dot), they consume `--conf-tier-*` tokens via `shared/render-confidence.js`.
- **§V color tokens** — pot chip + street pill use `--type-body` typography + `--m-zone-*` tokens (when tournament context); style-chip migration per §V.4 affects seat-activity badges (Fish→hot-pink, LAG→deep-orange, TAG→cyan-teal, LP→violet).
- **§VI density** — Z1 row uses `--zone-advice-padding` (in SHC inventory framing where Z1 = seat arc) OR `--zone-content-padding` for Table Read mid-zone. PRIMARY tier in `between-hands` and `between-hands-tournament` states per §VI.6 attention-budget map.

**Doctrine binding rules:**
- **R-1.6** treatment-type consistency (style-chips use categorical badge shape; freshness uses dot or badge per R-1.7)
- **R-1.7** staleness shape-class (stale-advice badge)
- **R-1.8** freshness-mechanism declaration + INV-FRESH-1..5
- **R-1.9** color-token concept-class isolation (style-chip migration; M-token bundle rename)
- **R-1.12** density-rhythm + attention-budget (Z1 PRIMARY in between-hands states)
- **R-3.4** between-hands content is informational tier (no preemption right over active-hand)

**INV-* invariants binding on Z1:**
- **INV-FRESH-1..5** — stale-advice signal must declare scope/mechanism/clearing/single-writer/visible-rejection per §II.3 registry
- **INV-TOKEN-2** — concept-class exclusivity (style-chip Fish hex `#f472b6` distinct from `--qtr-neg`)
- **INV-DENSITY-1** — typography uses rem (no px font-size literals)
- **INV-DENSITY-3** — sample-count uses `Nh` form for raw observation count (no dot pairing); `n=N` reserved for §III.4 confidence-dot pairing only

**Cross-cutting note (zone-numbering):** SHC Gate 3 inventory uses zone-numbering where Z1 = seat arc + Z2 = advice header. This artifact's Z1 framing (Table Read = pot/street/seat-activity) overlaps with SHC's Z1 + Z2 partial. Both reference the same underlying surfaces; concept-class vocabulary in shell spec is independent of zone-numbering.

**Gate 5 co-shipping items relevant to this zone:**
- Style-chip hue migration per §V.4 (Fish/LAG/TAG/LP get new V-1-safe hex)
- Stale-advice 1Hz timer R-2.3 compliance — route through `coordinator.dispatch('adviceAgeBadge', 'tick')` instead of direct DOM mutation (per §II.9 V-3 co-shipping #2)
- `freshness-signal-registry.test.js` registers `advice-age` signal entry
- Mirror-lock test for style-chip token cross-product parity

**Product line:** Sidebar
**Tier placement:** Pro (full Z1)
**Last reviewed:** 2026-04-22 (DCOMP-W5)

---

## Purpose

Z1 is between Z0 chrome and Z1 decision zone. When hand is active, Z1 shows pot + street + seat-activity context — supplemental to Z1's decision content. Between hands, Z1 can show residual table data (between-hands-chris persona need). Per R-3.4, between-hands content is `informational` and has no right to preempt active-hand Z1/Z3 when a new hand starts.

## JTBD served

- `JTBD-MH-09` pot-size-and-street awareness
- `JTBD-MH-13` seat-activity read (who is in / folded / absent)
- Persona-lens: between-hands-chris's "check a leaked hand stat" — informational overlay here, not decision here

## Personas served

- [Between-hands-Chris](../personas/situational/between-hands-chris.md) — informational panel user
- [Multi-Tabler](../personas/core/multi-tabler.md) — glance-every-8s pot + street check

## Elements (per SR pre-cutover audit)

- 2.7 Pot chip (between-hands blank state verified by test, not harness screenshot — low-priority gap)
- 2.10 Stale-advice indicator (logic pinned; long-stale corpus frame missing)
- Additional: street indicator, seat-activity row (populated from SyncBridge tendencyMap)

## FSM / lifecycle

Between-hands state: per R-3.4, Z1 MAY show between-hands content but must NOT preempt when active-hand content for Z3 arrives. Z1's pot chip is explicitly blanked between hands (verified by test — low-priority harness-screenshot gap noted in SR-7 audit).

## Freshness contract

Per R-4.1–R-4.5. The stale-advice indicator at 2.10 is the canonical freshness surfacer for Z3's advice content (Z1 renders the indicator, Z3 renders the advice it annotates). `computeAdviceStaleness` utility is the single source of truth (established in SR program cutover).

## Known issues carried forward

- **2.7 pot chip between-hands** — low-priority corpus gap (test-verified, harness-screenshot-missing)
- **2.10 stale-advice long-stale** — corpus frame missing for >60s stale state

## Heuristic alignment

- H-N1 visibility of system status — stale-advice indicator is the premier example
- H-N4 consistency + standards — pot chip format stable across hands
- H-PLT-01 glance-readable — pot chip + street indicator are glance-optimized
- H-PLT-05 primary content prominence — Z1 prominence yields to Z3 active-hand (R-3.4 interruption discipline)

## Change log

- 2026-04-22 — Created (DCOMP-W5).
