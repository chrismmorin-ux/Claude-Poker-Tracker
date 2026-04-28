# Sidebar Coherence Baseline — Consolidated Evidence

**Date:** 2026-04-27
**Author:** Claude (main)
**Working project name:** Sidebar Holistic Coherence (SHC)
**Gate:** 3 (Research) — deliverable #6, **closes Gate 3**
**Scope:** Scope A locked (fluent-user / training-cost only).
**Status:** DRAFT — pending owner review

---

## Purpose

This document is the **single citation point** for any future work on the sidebar shell spec. It consolidates the three research strands of Gate 3 into one indexed reference:

1. **Competitive baseline** (deliverable #3) — what the market does about status semantics, affordance vocabulary, density rhythm.
2. **Visual baseline** (deliverable #4) — what our sidebar actually renders.
3. **Architectural baseline** (deliverable #5) — how each rendered signal is computed, triggered, cleared, and timed.

Gate 4 shell-spec authoring should cite this document as its evidence anchor; future audits cross-checking shell-spec compliance should benchmark against the visual + architectural baselines here.

---

## Three load-bearing findings

### Finding 1 — Our confidence treatment is *worse than market norm*

D-1 forensics: we render `mq.overallSource` three different ways within one product (Z2 unified header dot at `render-orchestrator.js:150-151,169`; Z2 context strip opacity at `:441-444,450,462,465,470`; Z4 glance dot+`n=` label at `render-tiers.js:67-74`). All three consume the **same upstream data**.

Competitive review: **no competitor in PT4 / Hand2Note / NoteCaddy / DriveHUD / GTO Wizard ships all three patterns in one product.** Hand2Note has the most explicit treatment (configurable opacity-by-sample + inline `(n)` text + threshold-suppression) but each is *user-selected*, not silently combined. We accidentally combined all three.

**Implication for Gate 4 shell spec:** This is the lowest-cost fix — pure render-layer consolidation, no upstream-data work. A single `confidence-treatment(mq, sampleSize)` helper picks one shape and renders it everywhere. The Hand2Note precedent argues for **two-tier typographic ladder** (value font ≠ sample-count font) as the discriminator that doesn't compete for any other channel.

Citations:
- Visual: `2026-04-27-observation-sidebar-coherence-inventory.md` §CC-C-1, CC-C-2, CC-C-3 + Cross-cutting Finding F-1.
- Architectural: same document Part 2 §CC-C — Architectural finding C-A.
- Competitive: `LEDGER.md` EVID-2026-04-27-COMP-H2N + EVID-2026-04-27-COMP-CROSS-PATTERNS Pattern 3.

### Finding 2 — Freshness/staleness is a category-leading discipline; we must invent vocabulary

Competitive review: **none of PT4 / Hand2Note / NoteCaddy / DriveHUD shows a freshness signal at all** (LEDGER COMP-CROSS-PATTERNS Pattern 1). GTO Wizard sidesteps the problem (deterministic solver, not sampled estimates). The HUD market's implicit model is "data is whatever the last imported hand made it; user diagnoses drift by noticing counts not advancing."

Our sidebar already has freshness signals (Z0 pipeline-health, Z2 stale-advice badge, Z3 placeholder text). **This is category-leading discipline.** R-1.7 (staleness shape-class consistency) is doctrine; the shell spec must define the *positive vocabulary* (which shape-class for which mechanism).

The architectural pass exposes that this is the harder problem than it looks. Three mechanisms with three independent clearing models:

| Signal | Compute | Clear | Mechanism |
|---|---|---|---|
| Z0 disconnect dot (CC-B-2) | Connection callback | Connection re-established | State-event-driven |
| Z2 stale-advice badge (CC-B-1) | `computeAdviceStaleness()` `side-panel.js:1058`; `_receivedAt` age > 10s OR street-mismatch | Fresh advice push OR street alignment (`badge.remove()`) | **Timer-driven (1Hz refresh)** |
| Z3 "Waiting…" placeholder (CC-B-3) | Per-render absence-of-data | New advice arrival | State-derived |
| Two-phase staleContext clear (`side-panel.js:536-548`) | 60s → `staleContext = true`; 120s → `currentLiveContext = null` | New live-context push (resets `_receivedAt`) | **Data-clearing timer that surfaces visually only by changing what other renderers can read** |

R-1.7 *Caveat* in doctrine v3 anticipated this — confirmed here with code citations.

**Implication for Gate 4 shell spec:** R-1.7 alone is insufficient. The shell spec must specify, per signal, the **mechanism class** (state-event-driven / timer-driven / state-derived / data-clearing-timer) so two zones using the same shape-class don't diverge in clearing behavior. Sentinel test: a user seeing one zone "stale" and another "live" for the same fact would be a spec-compliant outcome under R-1.7 alone — and a user-experience violation.

Citations:
- Visual: `2026-04-27-observation-sidebar-coherence-inventory.md` §CC-B-1 through CC-B-4 + Cross-cutting Finding F-2.
- Architectural: same document Part 2 §CC-B — Architectural finding B-A.
- Doctrine: `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.7 + *Caveat*.
- Competitive: `LEDGER.md` EVID-2026-04-27-COMP-CROSS-PATTERNS Pattern 1 + Pattern 2.

### Finding 3 — Color-semantic isolation must come from the shell spec; market mostly tolerates the violation

D-2 forensics: `#fbbf24` (yellow) serves 7 design-token roles (`design-tokens.js:31, 47, 48, 61, 62, 77, 94`) plus 2 status-dot uses (Z0 disconnect at `side-panel.js:213`; pipeline-health waiting at `render-orchestrator.js:1339`). Inventory-pass widening: `m-green/m-yellow/m-red` token bundle (intended for tournament M-ratio) is **reused for fold-percentage gradient at `render-street-card.js:908`** — token-name vs use-site mismatch.

Competitive review: PT4 / Hand2Note / DriveHUD all use **per-stat user-configured color thresholds** — same color means context-dependent things across cells of the same product. **Market norm tolerates this.** GTO Wizard is the sole counter-example: red=bet/raise, green=check/call, black=not-in-range, white=marginal — strictly semantic, never decorative, same hue means same thing in matrix + breakdown + trainer feedback.

Doctrine v3 deferred token-semantic isolation to the shell spec under Option II — §10 retained un-amended. **This finding ratifies that deferral as correct** (the substantive concern is real; the doctrine-level rule was the wrong frame). Shell spec carries it as **positive vocabulary**: every color token maps to exactly one concept-class within the sidebar.

GTO Wizard's white-as-marginal is a candidate addition to the shell-spec status-color vocabulary — clean encoding of "this is uncertain, use judgment" that doesn't compete with the red/yellow/green positive/marginal/negative axis.

**Implication for Gate 4 shell spec:** Color-semantic isolation is a Gate 4 deliverable, not a backlog item. The cleanup is non-trivial (every token reuse is a render-site that may need a new token) but the **forensic basis is settled** and the **competitive precedent (GTO Wizard) is documented**.

Citations:
- Architectural: `2026-04-27-observation-sidebar-coherence-inventory.md` Part 2 §CC-C — Architectural finding C-C + §CC-F — Architectural finding F-A + Cross-cutting Finding F-3.
- Doctrine: `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §11 v3 amendment log (Option II deferral rationale).
- Competitive: `LEDGER.md` EVID-2026-04-27-COMP-GTOWIZARD (color discipline) + EVID-2026-04-27-COMP-CROSS-PATTERNS Pattern 5 + Vocabulary Divergence A.

---

## Five secondary findings (for shell-spec scope)

### Finding 4 — Affordance vocabulary discipline is bimodal in our codebase

Some clickable elements over-signpost (chevron + clickable header → CC-D-1, CC-D-2). Some clickable elements under-signpost (seat-arc circle, stat-chip pin → CC-D-5, CC-D-6). Plus chevron *direction* differs across sections (down=collapsed in CC-D-1; right=collapsed in CC-D-2).

Competitive parallel: GTO Wizard is the standout for affordance discipline (hover=preview, click=filter, hotkeys mirror clickable affordances). Trackers all mix-and-match per panel. **CC-91 (predictable affordance vocabulary) cannot be served until our internal bimodality is reconciled.**

Citations: inventory §CC-D + Cross-cutting Finding F-5; LEDGER COMP-GTOWIZARD + COMP-CROSS-PATTERNS Vocabulary Divergence E.

### Finding 5 — Two writers contend for `#status-dot` className

`buildStatusBar()` (`render-orchestrator.js:1324`) returns `dotClass`; `renderConnectionStatus()` (`side-panel.js:198-218`) also writes `dot.className` directly. Per-render order matters; race risk acknowledged in code comments but not asserted by tests. Doctrine R-2.3 was authored to prevent this class of risk for `classList.toggle` outside FSM transitions; same risk class on a per-render path.

**Implication:** Shell spec should declare single-writer ownership for each status indicator. Gate 4 may reasonably require a refactor that consolidates the writer (likely simpler than threading `connState` through `buildStatusBar()`).

Citations: inventory Part 2 §CC-A — Architectural finding A-A.

### Finding 6 — Lexical inconsistency in sample-size display

`n=45` (Z2 unified header + Z4 glance) vs `45h` (Z3 stat chips). Same shape-class (text suffix), different lexical form. Lower priority than D-1/D-2/D-3 but still part of the fluency-acquiring tax.

Citations: inventory §CC-C-1, CC-C-3, CC-C-4 + Cross-cutting Finding F-6.

### Finding 7 — `betweenHands` and `staleContextTimeout` screenshots are visually identical

Two distinct *mechanisms* (state === COMPLETE vs `currentLiveContext` nulled by 120s timer) produce the same *visual presentation*. User cannot distinguish "between hands, fresh" from "stale context, just timed out." Possible spec gap surfaced by the architectural pass.

**Implication:** Gate 4 may decide stale-but-was-live deserves a distinct visual signal (small "session timed out — last data N minutes ago" badge?) — or may decide the conflation is acceptable. Surface either way.

Citations: inventory Cross-cutting Finding F-8.

### Finding 8 — Decorative-vs-semantic glyph vocabulary is unbounded

Star (hero), diamond (blocker), bullet ●, chevrons (▴ ▸), arrow (→), card-suit glyphs (♠ ♥ ♣ ♦). No enumeration; new panels can invent. Not a violation today but a drift risk; shell spec should enumerate licensed glyphs.

Citations: inventory Cross-cutting Finding F-7.

---

## Index of source documents

This baseline cites the following as authoritative:

### Gate 3 deliverables (this project)

- **#1 Persona:** `docs/design/personas/situational/sidebar-fluency-acquiring.md` — the user this work defends.
- **#2 JTBDs:** `docs/design/jtbd/domains/cross-cutting.md` §CC-90 (system-recognition), §CC-91 (affordance vocabulary), §CC-92 (panel-blame / data-provenance), §CC-93 (trust-the-stack / cross-product).
- **#3 Competitive review:** `docs/design/evidence/LEDGER.md` entries EVID-2026-04-27-COMP-{PT4, H2N, NOTECADDY, DRIVEHUD, GTOWIZARD, CROSS-PATTERNS}.
- **#4 Visual layer + #5 Architectural layer:** `docs/design/audits/2026-04-27-observation-sidebar-coherence-inventory.md` (consolidated).
- **#6 This baseline:** `docs/design/evidence/2026-04-27-sidebar-coherence-baseline.md`.

### Doctrine + audit anchors

- **Gate 1 entry:** `docs/design/audits/2026-04-27-entry-sidebar-holistic-coherence.md` (RED verdict + framework gap finding).
- **Gate 2 blindspot:** `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` (Scope A locked + outside-lens additions A5 / B5 / B6 + E5 forensics).
- **Doctrine v3:** `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §1 R-1.6 (treatment-type consistency) + R-1.7 (staleness shape-class consistency, with mechanism *Caveat*) + §11 v3 amendment log.
- **Doctrine amendment proposal:** `.claude/projects/sidebar-rebuild/08-doctrine-amendment-proposal-r16-r17-r18.md` (Option II authoritative record).

### Source-of-truth code anchors

- **Confidence treatment (D-1):** `ignition-poker-tracker/side-panel/render-orchestrator.js:150-151, 169` (Z2 header dot); `:441-444, 450, 462, 465, 470` (Z2 context strip opacity); `ignition-poker-tracker/side-panel/render-tiers.js:67-74` (Z4 glance dot+label).
- **Color-token roles (D-2):** `ignition-poker-tracker/shared/design-tokens.js:31, 47, 48, 61, 62, 77, 94` (yellow `#fbbf24` × 7 token roles); `ignition-poker-tracker/side-panel/side-panel.js:213` (status-dot disconnect); `ignition-poker-tracker/side-panel/render-orchestrator.js:1339` (pipeline-health waiting); `ignition-poker-tracker/side-panel/render-street-card.js:908` (M-tokens reused for fold% gradient).
- **Staleness mechanisms (D-3):** `ignition-poker-tracker/side-panel/render-orchestrator.js:1324-1342` (Z0 status); `ignition-poker-tracker/side-panel/side-panel.js:198-218` (connection dot); `:1058-1099` (Z2 stale-advice + 1Hz timer); `:536-548` (two-phase staleContext clear).
- **Status-dot dual-writer:** `ignition-poker-tracker/side-panel/render-orchestrator.js:1324` + `ignition-poker-tracker/side-panel/side-panel.js:198`.
- **Style colors:** `ignition-poker-tracker/shared/stats-engine.js:327-335` (categorical Fish/LAG/TAG/Nit/LP/Reg/Unknown).

### Failure-library historical context

- `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md` — S1–S5 symptoms + M1–M8 mechanisms (the structural baseline this design-language pass sits on top of).
- `.claude/failures/STATE_CLEAR_ASYMMETRY.md` — 11 state-clear asymmetries (informs the architectural pass on why clearing-condition discipline matters).
- `.claude/failures/SW_REANIMATION_REPLAY.md` — service-worker replay incidents (informs why staleness signals are harder than they look).

---

## What this baseline does NOT contain

- **No proposed shell-spec content.** Gate 4 work; this is the evidence base, not the design.
- **No prescription on what colors / shapes / token names to use.** Findings 1–3 set up the *problem*; Gate 4 picks the solution.
- **No backlog ranking of remediation work.** Gate 5 + Gate 4 together produce a remediation plan; this baseline is upstream of that.
- **No verification that Gate 3 deliverables are owner-approved.** Status is DRAFT for #4 + #5 + #6; #1 + #2 + #3 also DRAFT pending owner pass.
- **No telemetry / direct-observation evidence for the fluency-acquiring persona.** SFA1–SFA4 caveats remain proto. This baseline is necessary but not sufficient; post-launch instrumentation will close the loop.

---

## Confidence and limitations

| Source strand | Confidence | Limitation |
|---|---|---|
| Visual catalog (#4) | Medium-high for cataloged signals | Pre-existing screenshots used; no live `npm run harness` walk this session. CSS file not directly inspected. `render-street-card.js` not exhaustively traced. |
| Architectural map (#5) | High for cited line numbers; medium for inter-zone interactions | Did not trace dynamic interactions (clicks, hand-boundary, table-switch end-to-end). Did not verify RT-60 / SR-6.x clearing contracts haven't drifted post-cutover. |
| Competitive review (#3) | Medium for PT4 / Hand2Note / GTO Wizard (official docs); low for DriveHUD (404'd pages); medium for NoteCaddy (older docs) | Synthesis from web sources, not direct product use. No primary observation. |
| Three load-bearing findings | High | Each rests on multiple independent sources (forensics + code + competitive). |

**Gating question for Gate 4:** Is the evidence base sufficient to author the shell spec? **Yes** — the three load-bearing findings (D-1, D-2, D-3) are settled; the secondary findings are scoped; the competitive precedents are documented. Owner-approval pass is the only remaining Gate 3 work.

---

## Change log

- 2026-04-27 — Created. Gate 3 deliverable #6, **closes Gate 3**. Consolidates competitive review (#3, in LEDGER.md) + visual catalog (#4) + architectural map (#5, both in companion inventory audit). Three load-bearing findings indexed for Gate 4 shell-spec authoring; five secondary findings listed for shell-spec scope.
