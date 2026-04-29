# Surface — Sidebar Zone 2 (Decision)

**ID:** `sidebar-zone-2`
**Zone role:** Active-hand decision surface (advice + sizing presets + recommendation reasoning). Top of the decision-tier stack per R-3.3 interruption discipline — only other decision-tier events may preempt Z2 when a hand is active.
**Related docs:**
- `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1, §3 (R-3.3 interruption discipline), §5 (render contract — single-owner-per-slot); doctrine v8 binding rules — see SHC cross-references below
- `docs/design/surfaces/sidebar-shell-spec.md` §III confidence (V-2 RESOLVED 2026-04-27) + §IV affordance + §V color tokens + §VI density
- `docs/design/surfaces/sidebar-zones-overview.md`
- `.claude/handoffs/sr-4-z2-decision.md` (SR-4 handoff)
- Extension code: `ignition-poker-tracker/render-orchestrator.js` (routes advice content into Z2)

---

## SHC Shell-Spec Cross-References (added 2026-04-29)

Z2 Decision elements (action-recommendation badge, EV display, villain headline, confidence dot, sample count, sizing presets) implement vocabulary resolved across V-2/V-affordance/V-color-tokens/V-density walkthroughs.

**Concept-classes consumed:**
- **§III confidence** — confidence dot at `render-orchestrator.js:150-151, 169` (Z2 unified header) — D-1 forensics canonical site. Migrates to `shared/render-confidence.js` extracted module per §III.6. 4-tier register `high/medium/low/unknown`. Sample count `n=N` form (paired with dot per §III.4 + INV-DENSITY-3). Z2 context-strip opacity classes (`conf-player`/`conf-mixed`/`conf-population`) at `:441-444, 450, 462, 465, 470` REMOVED per §III.5 scope boundary (confidence applies to engine model outputs only, NOT mathematically exact derived values like equity / pot odds / SPR).
- **§IV affordance** — action-recommendation pill (CALL/BET/RAISE/FOLD) per §IV.1; `pill` shape with click-action interaction outcome. ARIA contract: `role="button"` + `aria-label` + `aria-disabled="true"` when advice is stale.
- **§V color tokens** — `--conf-tier-{high,mid,low,unknown}` for confidence dot; **`--action-class-{call,bet,raise,fold}-{bg,text,base}`** (V-affordance §IV.11 cross-cutting amendment — categorical concept-class, NOT ordinal `--qtr-*` reuse).
- **§VI density** — `--type-display` for action-word (24px → 1.5rem, currently HARDCODED at `side-panel.html:400` — Gate 5 migration); `--type-body` for villain headline + EV; `--type-meta-stat` for confidence label + sample count. **PRIMARY tier in `active-hand-advice` state per §VI.6 attention-budget map.**

**Doctrine binding rules:**
- **R-1.6** treatment-type consistency (confidence dot is canonical D-1 forensic; resolved by V-2)
- **R-1.9** color-token concept-class isolation (action-pill colors get distinct concept-class from quality-tier)
- **R-1.10** affordance vocabulary (action-pill is licensed shape; ARIA mandate per shape)
- **R-1.12** density-rhythm + attention-budget (PRIMARY tier in active-hand-advice)
- **R-3.3** interruption discipline (Z2 decision-tier; only other decision-tier events preempt)

**INV-* invariants binding on Z2:**
- **INV-TOKEN-1..5** — confidence colors via `--conf-tier-*` tokens; action-class colors distinct from `--qtr-*`
- **INV-AFFORD-1** — action pill is the click-action affordance; no over-signposting (no chevron + pill on same element)
- **INV-DENSITY-1** — `--type-display` uses rem; HARDCODED 24px at `:400` migrates to token
- **INV-DENSITY-3** — `n=N` form bound to confidence-dot pairing per §III.4

**Currently-shipping bugs documented:**
- **D-1 (resolved by V-2)** — confidence rendered three incompatible ways at `render-orchestrator.js:150-151, 169` + `:441-444, 450` + `render-tiers.js:70-74`. Pure render-layer divergence; same upstream `mq.overallSource`. Lowest-cost forensic to fix (no upstream changes).
- **render-orchestrator.js:147 `||` vs `??` bug** (per §III.7 forbidden pattern #6) — `(pinnedData?.sampleSize) || advice.villainSampleSize` causes wrong sample substitution when `sampleSize === 0`.

**Gate 5 co-shipping items relevant to this zone:**
- New `shared/render-confidence.js` module per §III.6 (path amended 2026-04-28 to `shared/`)
- Z2 context-strip opacity classes deleted; equity / pot-odds / SPR render at full opacity always (§III.5 scope boundary)
- `confidence-dot green/yellow/red` color-literal CSS replaced with `conf-tier-{high,mid,low,unknown}` ordinal classes
- `--action-class-*` concept-class entries in `design-tokens.js` (V-affordance §IV.11 cross-cutting)
- `render-orchestrator.js:147` `||` → `??` fix
- 24px action-word migration from inline literal to `--type-display` token (rem)

**Product line:** Sidebar (primary) + cross-surface JTBD mirrors on main-app TableView (LiveAdviceBar)
**Tier placement:** Pro
**Last reviewed:** 2026-04-22 (DCOMP-W5)

---

## Purpose

Z2 is what the sidebar is *for*. The primary decision-support surface during active play. Multi-Tabler's glance-every-8s lands here; Online MTT Shark's live decision feed lives here. Z1 (Table Read) exists to support Z2; Z3 (Street Card) renders the spatial hand-state companion below Z2.

## JTBD served

- `JTBD-MH-01` see the recommended action for the current street ← **primary JTBD for sidebar**
- `JTBD-MH-03` check bluff-catch frequency on current villain
- `JTBD-MH-04` sizing suggestion tied to villain's calling range
- `JTBD-MH-07` short-stack push/fold with ICM (tournament context — currently partial, cross-surface parity item)

## Personas served

- [Multi-Tabler](../personas/core/multi-tabler.md) — primary; glance-every-8s
- [Online MTT Shark](../personas/core/online-mtt-shark.md) — primary decision feed
- [Hybrid Semi-Pro](../personas/core/hybrid-semi-pro.md) — cross-format

## Elements

- Advice text (primary recommendation with confidence + reasoning)
- Sizing presets (bet-size suggestions with EV annotations)
- Recommendation reasoning (expandable on drill-down affordance per R-1.5 → routes to Z4)
- Pot chip (between-hands blank state verified by test — low-priority harness-screenshot gap per SR-7)

## FSM / lifecycle

Per R-2.* doctrine: every Z2 element has an explicit statechart. No `classList.toggle` or ad-hoc visibility flips outside declared transitions. `render-orchestrator.js` owns the reduce-state-to-DOM step. Stage 4 spec at `sr-4-z2-decision.md` defines transitions.

## Interruption discipline (critical)

Per R-3.3: Z2 holds the `decision` tier. Only another `decision`-tier event may overwrite Z2's content. Between-hands (Z1), diagnostics (Z0), informational deep-dive (Z4) all have strictly lower tier and must route to a non-conflicting zone or drop — never overwrite Z2.

## Freshness contract

Z2's advice content IS the `stale-advice` subject. `computeAdviceStaleness` watches Z2's render payload; stale signal surfaces in Z1 (freshness indicator) not Z2 itself — Z2 stays stable per R-1.2 glance test. If advice is stale, Z1 surfaces the signal, Z2 keeps rendering the last-good advice with visual staleness decoration (not removal).

## Known issues carried forward

- **2.7 pot chip between-hands** — low-priority corpus gap (test-verified, harness-screenshot-missing)
- Cross-surface coupling with main-app TableView LiveAdviceBar — no contract doc today; mirrors W4-A2-F10 tournament-to-table contract pattern

## Heuristic alignment

- H-N1 visibility of system status — advice + sizing presets, stale-signal via Z1
- H-N4 consistency + standards — advice format stable across streets
- H-N6 recognition rather than recall — spatial memory of Z2 position is a core design premise
- H-PLT-01 glance-readable — R-1.2 glance test is Z2's primary compliance gate
- H-PLT-05 primary content prominence — Z2 holds this by R-3.3 interruption tier

## Related surfaces

- `table-view.md` — TableView's LiveAdviceBar mirrors Z2 advice content
- `online-view.md` — OnlineView's SeatDetailPanel is the post-hand review mirror
- `sidebar-zone-3.md` — Street Card renders below Z2 with hand spatial state

## Change log

- 2026-04-22 — Created (DCOMP-W5).
