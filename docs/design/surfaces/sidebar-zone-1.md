# Surface — Sidebar Zone 1 (Table Read)

**ID:** `sidebar-zone-1`
**Zone role:** Pre-hand + between-hands table context. Pot chip, street indicator, seat activity, stale-advice freshness signal. Glance-primary for the "what's happening at the table right now" question.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 (hierarchy), §3 (interruption discipline — R-3.4 between-hands is informational), §4 (freshness)
- `docs/design/surfaces/sidebar-zones-overview.md` (W5 umbrella)
- `.claude/handoffs/sr-4-z1-table-read.md` (SR-4 handoff)

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
