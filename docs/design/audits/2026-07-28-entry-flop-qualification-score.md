# Gate 1 Entry — 2026-07-28 — Flop Qualification Score (FQS)

**Feature working name:** Flop Qualification Score (FQS) — a memorisable mental-math chain that converts a flop plus a preflop configuration into a precise, decidable number at the table.
**Proposed by:** Owner, 2026-07-28 — *"paired board, 7s. that's a ___ score and our multiplier for CO v BTN 3bp. plus an ___ and two toned so we… until we get to a precise accounting of either our equity or fold/continue/bluff range… the player arrives at the numbers in a concise way and then the decision is clear."*
**Explicitly scoped by owner as:** poker mechanics, **not** player tendencies. The individual-hand layer "rolls in" afterwards.
**Gate:** 1 (Entry) — mandatory.
**Next gate:** 2 (Blind-Spot Roundtable) — **required** per verdict below.
**Status:** OPEN. **No production code written.** Audit-only per `docs/design/LIFECYCLE.md` Gate 1 contract.
**Design research (candidate grammars, graded):** published artifact, 6 candidates A–F worked on one constant hand. Not a repo file — see "Discoverability gap" below.

---

## Feature summary (as proposed)

A composition grammar the owner can execute in his head: read the flop, produce a number, apply a configuration modifier, apply texture modifiers, arrive at a continue / fold / bluff frequency precise enough to make the decision obvious. The app's role is to deliver the same number with its derivation visible, and to grade the owner's own chain against engine truth over time.

Gate 1's job is not "can we compute a number" — the engine already computes better numbers than any mental chain will. Gate 1's job is **whose job is this, is it in our framework, and is the precision claim backed by anything.** That last question is where the findings concentrate.

---

## Critical scope-shaping discoveries

### Discovery 1 — The existing `wetScore` is not a weak version of FQS; it is wrong-signed for this use. **Headline finding.**

`pokerCore/boardTexture.js` produces a 0–100 additive score. On the owner's own example board it computes:

```
 30  baseline
−20  paired
+ 0  flush draw      ← requires 3 of a suit; two-tone earns nothing
+ 0  straight possible
+ 0  connectedness
+ 0  broadway
 ───
 10  → band "dry"
```

Three failures compound:

1. **Two-tone is invisible.** `flushDraw` requires `maxSuitFreq >= 3`. A two-tone flop scores identically to rainbow except for dodging the `−15` rainbow penalty. `774ss` → 10, `774r` → −5. The 3-band bucket then puts both in `dry` and erases even that.
2. **One axis conflates two opposed strategic quantities.** `774ss` and `K72r` both read `dry`, but a low paired board favours the capped caller's small pairs while a broadway-dry board favours the 3-bettor's overpairs. Assigning them the same band is not imprecise, it is **directionally wrong for one of them.**
3. **Nothing has ever been fit.** `boardTexture.calibration.test.js` asserts labels and ordering only ("JT9 wetter than A72"). The `30` baseline and every weight are hand-authored. No test compares any of it to equity or fold outcomes.

Consequence for scope: FQS is **not** "surface `wetScore` better". Building on it inherits a sign error.

### Discovery 2 — The vocabulary the owner described already exists; the numbers behind it do not.

`spotResolver/spotKeyExtractor.js:92` already builds exactly the sentence in the owner's request:

```
CO-vs-BTN-3bp-oop-dry-774ss-flop_root
   position × pot type × IP/OOP × texture × board × node
```

But `skillAssessment/solverBaselines.js` — the file holding the actual fold-to-c-bet numbers — is keyed on 8 axes that **do not include pot type**. There is no 3-bet-pot entry to look up. Nearest real data: `flop:dry:BIG_BLIND:def:oop:bet:vsBet:pfc` = 0.55 fold, `SMALL_BLIND` = 0.50 — single-raised pots only.

So the "multiplier for CO v BTN 3bp" the owner named has no backing datum anywhere in the repo. It is the single largest missing input.

### Discovery 3 — The grammar has a proven precedent in this codebase, on the preflop side.

`drillContent/shapes.js` (1,186 lines) is the same structure applied to preflop hand-vs-hand: **shape → lane → signed modifier deltas → calibrated equity band.** Every band is verified against exact enumeration by `shapesCatalog.test.js`. `PreflopDrillsView/RecipeMode.jsx` is a working UI that walks the owner through that chain step by step and scores each step independently.

FQS is the flop analog of a pattern already built, already calibrated, and already taught. This materially lowers the design risk and should anchor the Gate 2 discussion.

Note `shapes.js` also carries a `__coherence__` block flagging itself as `pending-absorption` — failure mode #1, "concept exists, surface never consumes it," with `expectedConsumers: ['hook.live-action-advisor', 'surface.extension-sidebar']` and a deadline of **2026-07-01 (now passed)**. FQS is the second instance of the same pattern unless its live consumer is specified at Gate 4.

### Discovery 4 — The calibration target is contested, and that is a design decision, not a detail.

`POKER_THEORY.md §9` documents six places where this project **deliberately** diverges from solver baseline to serve the live pool (§9.1 BB donk frequency in 3BP on middling boards; §9.2 live BB flat range; §9.3 SB flat-call of a 3-bet; §9.4 value-heavy small-sizing donk composition; §9.5, §9.6). The target student is a live-pool player.

Calibrating FQS against Monte Carlo over `archetypeRanges.js` yields solver-ish numbers. Calibrating against the live pool yields different numbers. **Which one FQS teaches is a first-class choice that must be made explicitly at Gate 2**, not discovered later from a residual. Tracked as AS-4 below at HIGH severity.

### Discovery 5 — FQS is engine-adjacent and inherits the first-principles guardrails.

Any FQS coefficient is a constant that shapes a decision. `CLAUDE.md` and `POKER_THEORY.md §7.5` bind: derive from equity / pot odds / SPR / players-remaining, never from position or bucket labels directly. A `× 0.87 for 3bp OOP` coefficient is precisely the shape §7.5 warns about — it is acceptable **only** if computed from the real ranges (`archetypeRanges.js` holds them) rather than authored by feel. §7.5's decision table must be run per coefficient and the answers recorded.

---

## Output 1 — Scope classification

**New capability, new surface, cross-product.** Not surface-bound. It touches:

- a new numeric primitive (the score itself) in `pokerCore/`
- a live consumer (`LiveAdviceBar` / `useLiveActionAdvisor`)
- a study consumer (Postflop Drills, in the `RecipeMode` shape)
- a print consumer (`PrintableRefresherView` — the pocket card; see WS-048)
- a calibration harness with no current home

Per `LIFECYCLE.md`, new-surface creation independently triggers Gate 2 regardless of the gap verdict.

## Output 2 — Personas identified

| Persona | Fit | Note |
|---|---|---|
`chris-live-player` (core) | **Primary** | The requester. Live 9-handed, memory-and-pattern limits are the product's whole premise. |
`rounder` | Primary | Same live context, higher volume — most exposed to a chain that is slow. |
`scholar-drills-only` | Secondary | Wants the drill (candidate F) and the printable card, may never use the live surface. |
`apprentice-student` | Secondary | The chain is teachable in a way engine output is not. |
`weekend-warrior` | Secondary | Lowest tolerance for memorisation; the 8-vs-16-anchor decision is decided by this persona's ceiling. |
`circuit-grinder`, `hybrid-semi-pro` | Tertiary | Likely already have their own heuristics; FQS competes with an incumbent. |

**Persona-sufficiency check: PASS.** No new persona required. `chris-live-player` and `weekend-warrior` bracket the memorisation trade cleanly.

## Output 3 — JTBDs identified

**Nearest existing (none a clean fit):**

| ID | Title | Why it isn't the job |
|---|---|---|
| DS-51 | Understand villain's range shape on any flop before deciding | Active, closest. But it is about *comprehension of a range*, delivered by the app. FQS is about *the owner producing a number himself*. |
| DS-60 | Carry-the-reference-offline (physical laminated study artifact) | The printable-card delivery path, and PRF/WS-048 territory. A lookup card is not a derivation chain. |
| MH-01 | See the recommended action for the current street | App tells the owner. FQS is the inverse direction. |
| MH-10 | Plain-English "why" for a recommendation | Explanation after the fact, not derivation before it. |
| DS-44 | Correct-answer reasoning (not just score) | Covers the *grading* half (candidate F) well. |
| DS-56 | Calibration check (blind probe after self-reported fluency) | Proposed. Genuinely adjacent to F's per-step error tracking. |

**Genuine gap:** nothing in the atlas covers *"derive the decision number myself, at the table, without the app, and know how wrong I am."* The self-sufficiency and the error-awareness are both absent. That is one proposed JTBD (ID **not** reserved here — per the ATLAS DS-registry note, IDs are reserved at Gate 3).

**JTBD-coverage check: PARTIAL.** The delivery halves are covered (DS-60 print, DS-44/DS-56 grading, MH-01 live). The core job is greenfield.

## Output 4 — Gap analysis verdict

| Axis | Verdict | Reason |
|---|---|---|
| Persona coverage | 🟢 GREEN | Existing personas sufficient and they bracket the key trade. |
| JTBD coverage | 🟡 YELLOW | Delivery covered; the central "derive it myself" job absent. |
| Framework / doctrine | 🟡 YELLOW | §7.5 applies per coefficient; §9 makes the calibration target a live choice. |
| Evidence backing the precision claim | 🔴 **RED** | No FQS coefficient can currently be sourced. `wetScore` is unfit; `solverBaselines` has no pot-type axis. |
| Existing-code foundation | 🟢 GREEN | `shapes.js` + `RecipeMode` are a working, calibrated precedent. |

### Overall Gate 1 verdict: 🟡 **YELLOW** with one RED sub-finding.

YELLOW rather than RED overall because the personas hold, a proven structural precedent exists in-repo, and the missing piece is evidence rather than conception. The RED sub-finding is narrow and specific: **every number in the design research is currently a placeholder, and no mechanism exists to replace any of them with a measured value.** Gate 2 must treat the calibration harness as the gating deliverable, not as follow-on tooling.

---

## Labeled assumption register (AS-N)

House format per `system/decisions.md`. Every load-bearing claim carries a falsification threshold and a window. **None of these is currently verified.**

```yaml
assumptions:
  - id: AS-1
    type: empirical
    claim: "Two axes (structural tilt, dynamism) are sufficient to reach the target precision; no third board axis is required."
    falsifies_if:
      threshold: "best-fit 2-axis model leaves residual >±5pp on >20% of a random 500-flop sample against MC ground truth"
      window: "first calibration harness run"
    revisit: "at harness v1"
    status: unverified
    severity: high

  - id: AS-2
    type: structural
    claim: "Pot-type configuration (SRP / 3BP / 4BP) acts multiplicatively on continue frequency rather than additively."
    falsifies_if:
      threshold: "an additive pot-type term achieves lower held-out RMSE than a multiplicative one across all three pot types"
      window: "first calibration harness run"
    revisit: "at harness v1"
    status: unverified
    severity: medium

  - id: AS-3
    type: empirical
    claim: "Eight anchor flops cover the flop space densely enough that nearest-anchor interpolation error stays below modifier granularity (≈2pp)."
    falsifies_if:
      threshold: "mean nearest-anchor error >4pp on a random 500-flop sample"
      window: "first calibration harness run"
    revisit: "at harness v1"
    status: unverified
    severity: high
    note: "This is the 8-vs-16-anchor decision. It is an owner usability call bounded by a measurable number — decide the ceiling, then let the measurement pick the count."

  - id: AS-4
    type: doctrinal
    claim: "Monte Carlo equity over archetypeRanges.js is an adequate calibration target for a heuristic aimed at a live pool that POKER_THEORY.md §9 documents as deliberately divergent from solver baseline."
    falsifies_if:
      threshold: "for >=2 of the six §9 documented divergences, the MC-derived FQS number and the live-pool-correct number differ by >6pp"
      window: "before any coefficient is authored"
    revisit: "Gate 2"
    status: unverified
    severity: high
    note: "Highest-consequence assumption here. If false, FQS teaches solver-correct numbers to a player facing a pool that does not play that way — and the error is invisible because the calibration harness would report agreement with its own target."

  - id: AS-5
    type: empirical
    claim: "A 3-step chain is executable at live-table pace without displacing the owner's other reads."
    falsifies_if:
      threshold: "median time-to-number >8s, or owner reports the chain crowded out a villain read, across the first 200 logged live spots"
      window: "first 200 live spots after any live surface ships"
    revisit: "at 200 spots"
    status: unverified
    severity: medium

  - id: AS-6
    type: empirical
    claim: "Continue *frequency* is the right output quantity, rather than a hand-tier threshold or a raw equity number."
    falsifies_if:
      threshold: "in the graded drill, threshold-form answers score >10pp more accurate than frequency-form on the same spots"
      window: "first 300 graded drill attempts"
    revisit: "at drill v1 + 300 attempts"
    status: unverified
    severity: medium

  - id: AS-7
    type: empirical
    claim: "Two-tone warrants a distinct term — i.e. boardTexture.js omitting it is a real error, not a defensible simplification."
    falsifies_if:
      threshold: "MC shows |Δ continue frequency (774ss vs 774r)| < 2pp"
      window: "first calibration harness run — this is the cheapest test in the register and should run first"
    revisit: "at harness v1"
    status: unverified
    severity: low
    note: "Cheap, fast, and diagnostic of the whole approach. If two-tone genuinely does not matter, Discovery 1's premise weakens and candidate A becomes more viable."

  - id: AS-8
    type: structural
    claim: "FQS coefficients can be computed from archetypeRanges.js + equity/pot-odds/SPR rather than authored, satisfying POKER_THEORY.md §7.5."
    falsifies_if:
      threshold: ">=1 coefficient required by the shipped grammar has no derivation path from game state and must be hand-authored"
      window: "coefficient authoring pass"
    revisit: "Gate 4"
    status: unverified
    severity: high
    note: "If this fails for the pot-type multiplier specifically, FQS is in direct tension with the codebase's stated anti-pattern and needs an ADR to proceed."
```

---

## Overt grading of the proposed strategy

The design research recommends **candidate C (anchor-and-adjust) with candidate B's two axes used to place the anchors, delivered through E (visible derivation receipt) and verified by F (per-step graded drill).** Graded against what would actually move each mark:

| Criterion | Grade | What holds it there | What would raise it |
|---|---|---|---|
| Fit to the owner's stated request | **A** | The request described anchor-plus-modifier composition almost verbatim; C is that structure. | — |
| Structural precedent in-repo | **A** | `shapes.js` + `RecipeMode` are the same grammar, calibrated and taught. | — |
| Precision, *as currently evidenced* | **F** | Zero coefficients sourced. Every number is a placeholder. | The harness (F) existing and reporting one measured error bar. |
| Precision ceiling, *if calibrated* | **B** | Anchor interpolation caps it; engine MC would remain strictly better. | More anchors (AS-3) — at a usability cost. |
| Calibration target correctness | **D** | AS-4 unresolved. Calibrating against the wrong target is worse than not calibrating, because the harness would report success. | An explicit Gate 2 decision on solver-vs-live-pool, recorded as an ADR. |
| Doctrine compliance (§7.5) | **C** | The pot-type multiplier is exactly the shape §7.5 warns about. Ranges to derive it honestly do exist. | Running §7.5's table per coefficient and recording the answers (AS-8). |
| Live-surface viability | **C** | AS-5 untested. The live bar is already dense — Rows 1, 1.5, 1.75, 2, 3, 6 are occupied. | A real estate pass at Gate 4 plus timing data. |
| Risk of becoming another orphaned concept | **C** | `shapes.js` is `pending-absorption` past its 2026-07-01 deadline. Same authorship pattern, same risk. | Naming the live consumer at Gate 4 as a gate condition, not an intention. |
| Reversibility | **A** | Pure additive modules, no schema or migration. Deletable. | — |

**Composite read: strong concept, proven structure, no evidence.** The honest summary is that the strategy is well-founded on everything except the one axis it is being sold on — precision. The correct next build is not the grammar; it is the harness that would let any grammar earn the claim.

**What we are explicitly NOT claiming:** that FQS will beat the engine's own numbers (it will not — it trades accuracy for portability); that any coefficient shown in the design research is correct; that three bands or two axes is settled; that the live pool and solver agree.

---

## Discoverability gap surfaced by this session (separate finding)

The owner reported difficulty locating existing visual and interactive reference material. Confirmed — it is real and it is a documentation gap, not a missing-assets problem:

| What | Where | Count | Referenced from |
|---|---|---|---|
| Interactive 3D / research instruments | `prototypes/` | 4 HTML | 6 audit + project + queue files. **Absent from `CLAUDE.md`. No README.** |
| Sidebar prototype | `docs/sidebar-prototype.html` | 1 | `docs/sidebar-*` specs |
| Design-audit evidence screenshots | `docs/design/audits/evidence/` | 16 PNG | Cited inline in audits |
| Line-audit evidence | `docs/design/audits/line-audits/evidence/` | 30 PNG | Cited inline in line audits |
| Playwright visual baselines | `tests/playwright/*-snapshots/` | 46 PNG | Convention only |
| Stray screenshot | `screenshots/` | 1 PNG | **Nothing — orphan** |
| Ignition visual harness | `npm run harness` in `ignition-poker-tracker/` | live | ignition `CLAUDE.md` ✅ |
| Published design artifacts (incl. this session's FQS research) | **claude.ai only — not in the repo** | — | **Nothing** |

There are **no 3D asset files** (`.glb` / `.gltf` / `.obj`) — the 3D work is two runtime canvas prototypes, not stored models.

Two of these matter beyond tidiness:

1. `prototypes/projection-explorer-gate3.html` is the **Gate 3 gating deliverable for the Projection Explorer project** and `.claude/projects/projection-explorer.md` records it as *blocked on the owner running it against a real backup*. A live blocker sits in a directory nothing points at.
2. Design research published as an artifact leaves no repo trace. This document is the corrective for the FQS research specifically; the general fix is that generated design work lands in `docs/design/` and the artifact is the *view*, not the record.

**Fix applied this session:** `prototypes/README.md` index authored; `CLAUDE.md` Docs section extended with a Visual & Interactive Reference block pointing at all seven locations.

**Also noted, not fixed:** `system/constraints.md` is still entirely template placeholders (`HC-001 <!-- e.g., ... -->`, `WA-001`). The methodical-assumptions machinery exists and is unpopulated — which is a plausible reason the project does not *feel* like it has one. Populating it is owner-facing work, not something to fill in speculatively.

---

## Evidence LEDGER (Gate 1)

- 2026-07-28 — `wetScore` traced on the owner's example board (`774ss`): computes 10 → `dry`; two-tone contributes 0 because `flushDraw` requires `maxSuitFreq >= 3`. `774r` computes −5 → also `dry`. Distinction real in the score, erased by the band. Read from `pokerCore/boardTexture.js:36-84`.
- 2026-07-28 — `boardTexture.calibration.test.js` read in full: 11 tests, all label/ordering assertions. **Zero** equity or outcome comparisons. The score has never been fit.
- 2026-07-28 — `solverBaselines.js` read in full: 8-axis keys, **no pot-type axis**. Nearest real OOP-dry data is SRP-only (BB 0.55 / SB 0.50 fold-to-cbet). No 3BP entry exists.
- 2026-07-28 — `spotKeyExtractor.js:92` confirmed to build `heroPos:vs:villainPos:potType:ipOop:texture:boardShorthand:nodeId` — the owner's requested vocabulary already exists at key level.
- 2026-07-28 — `drillContent/shapes.js` + `RecipeMode.jsx` confirmed as a working shape→lane→modifier→band precedent, bands verified against exact enumeration. Also confirmed `__coherence__.status: pending-absorption` with a passed 2026-07-01 integration deadline.
- 2026-07-28 — Visual-asset inventory run across the repo: 96 PNG in 6 locations, 9 HTML in 4, **0** 3D model files.
- PENDING — every AS-N above. No calibration data exists. The cheapest first test is AS-7.

## Required follow-ups (to close Gate 1 → Gate 2)

- [ ] **Gate 2 Blind-Spot Roundtable** — required (new surface, plus YELLOW verdict). Scope below.
- [ ] **Owner decision on AS-4 (calibration target: solver vs live pool).** Blocking — no coefficient should be authored before this is recorded, ideally as an ADR in `system/decisions.md`.
- [ ] **Owner decision on the anchor-count ceiling (AS-3).** Not "how many anchors" but "how many will you actually carry" — the measurement then picks the count.
- [ ] Run AS-7 (two-tone Δ) as a standalone probe. Cheapest test in the register; diagnostic of Discovery 1's premise.
- [ ] Run `POKER_THEORY.md §7.5`'s computed-vs-lookup table per proposed coefficient; record answers against AS-8.
- [ ] Name the live consumer explicitly before Gate 4, as a gate condition — the `shapes.js` orphaning pattern is the specific risk.
- [ ] Reconcile against **WS-048** (*Phase C: Texture-Equity + Exceptions Codex*, deferred 2026-06-13) — the printable-card expression of this idea already exists as a queue item and should not be built twice.

## Open questions for owner (before Gate 2)

1. **Calibration target (AS-4).** Solver-correct, or live-pool-correct? They differ, `§9` says the pool diverges deliberately, and this choice determines every number FQS will ever teach.
2. **Anchor-count ceiling (AS-3).** How many reference boards will you genuinely hold without a card in your pocket?
3. **Output form (AS-6).** Frequency (`continue 54%`), threshold (`continue tier 3+`), or both — frequency is checkable, threshold is executable.
4. **Which usability elements from the design research read as clear versus fussy** — particularly element 05 (multiplier coefficients), which is mathematically right for the pot-type effect and the slowest thing on the list to do in your head.

## Links

- Design research (6 graded candidates, one constant hand): published artifact, 2026-07-28. Record of record is this document.
- Code read: `pokerCore/boardTexture.js` · `pokerCore/__tests__/boardTexture.calibration.test.js` · `exploitEngine/villainDecisionModel.js:74` · `exploitEngine/gameTreeSizingHelpers.js:26` · `postflopDrillContent/frameworks.js` · `postflopDrillContent/rangeVsBoard.js` · `postflopDrillContent/archetypeRanges.js` · `drillContent/shapes.js` · `PreflopDrillsView/RecipeMode.jsx` · `skillAssessment/solverBaselines.js` · `spotResolver/spotKeyExtractor.js` · `spotResolver/boardShorthand.js`
- Doctrine: `POKER_THEORY.md` §3.1–3.3, §6.1–6.4, §7.5, §7.6, §9 · `CLAUDE.md` first-principles guardrail
- Related queue: **WS-048** (deferred) · **WS-234** (PJX Gate 3, referenced re: prototype discoverability)
- Lifecycle: `docs/design/LIFECYCLE.md` Gate 1 contract · `docs/design/ROUNDTABLES.md` for Gate 2

## Change log

- 2026-07-28 — Gate 1 Entry authored. Verdict 🟡 YELLOW with one 🔴 RED sub-finding (evidence). 8 labeled assumptions registered, all `unverified`. Strategy graded overtly. Discoverability gap surfaced and partially fixed. No production code written.
