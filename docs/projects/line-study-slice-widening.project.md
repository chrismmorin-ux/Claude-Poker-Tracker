---
id: line-study-slice-widening
name: Line Study — Vertical-Slice Widening + Per-Line Expert Audit
status: active
priority: P1
created: 2026-04-22
backlog-id: LSW
---

# Project: Line Study — Vertical-Slice Widening + Per-Line Expert Audit

## Quick Start for New Sessions

1. Read ALL files in `.claude/handoffs/` — check for file conflicts.
2. Read this file — find the current phase (marked with `<- CURRENT`).
3. Read the "Context Files" for that phase.
4. Create/update your handoff file in `.claude/handoffs/`.
5. Execute the checklist items.
6. Update this file and handoff when done.

---

## Overview

The 2026-04-21 Line Study Bucket-Teaching Roundtable shipped a **vertical slice** of bucket-level teaching: primitives (RT-106..RT-118) plus one user-visible bucket-EV panel on one decision node (JT6 donk on the `btn-vs-bb-3bp-ip-wet-t96` line), wired to one archetype toggle. Owner's Q5 decision explicitly deferred widening to a "rolling backlog, SPI-ordered as engine improvements land." This project is that rolling backlog.

Two things run in parallel under this charter:

1. **Per-line Poker-Expert Audit** (new — requested 2026-04-22): every one of the 8 authored lines is walked node-by-node through a six-dimension expert lens (setup realism, villain action realism, `correct` flag accuracy, framework citation quality, copy quality, bucket-teaching readiness). Output is an audit doc per line + a content-fix backlog + a bucket-teaching queue that feeds widening.
2. **Slice widening**: widen `heroHolding` + `correctByArchetype` + bucket-EV coverage from the current 1-of-25-decision-nodes state up to a meaningful fraction (target: every flop decision root + every turn decision where bucket class materially shifts).

**Acceptance Criteria (overall):**
- Every one of 8 lines has a closed expert audit on disk at `docs/design/audits/line-audits/<line-id>.md` with an owner-signed accuracy verdict.
- Every finding at P0 or P1 severity across all 8 audits is either shipped-fixed or explicitly waived with reasoning.
- Bucket-EV teaching is live on all 8 flop decision roots plus every turn decision where the audit flagged bucket-teaching readiness = YES.
- Every decision where archetype materially flips the correct branch has `correctByArchetype` declared.
- The `v1-simplified-ev` caveat is removed from the bucket-EV panel (depth-2 integration landed).
- No regression on the 322 existing postflop + component tests.

---

## Context Files

Read these before starting any phase:

- `CLAUDE.md` — project-level rules, engine guardrails.
- `.claude/context/POKER_THEORY.md` — **mandatory** before authoring or auditing any line commentary.
- `src/utils/postflopDrillContent/lines.js` — authored line content.
- `src/utils/postflopDrillContent/lineSchema.js` — schema validator + `resolveBranchCorrect`.
- `src/utils/postflopDrillContent/drillModeEngine.js` — bucket-EV wrapper.
- `src/utils/postflopDrillContent/bucketTaxonomy.js` — 28 bucket IDs + segmenter mapping.
- `src/utils/postflopDrillContent/archetypeRangeBuilder.js` — fish/reg/pro range reweighter.
- `src/components/views/PostflopDrillsView/LineWalkthrough.jsx` — archetype toolbar.
- `src/components/views/PostflopDrillsView/BucketEVPanel.jsx` — reveal panel.
- `src/components/views/PostflopDrillsView/LineNodeRenderer.jsx` — node renderer + `correctByArchetype` badges.
- `docs/design/audits/line-audits/_TEMPLATE.md` — audit template (authoritative shape for Stream A).
- `docs/projects/line-study.project.md` — original 6-phase charter (closed 2026-04-20).

---

## Streams

**Six** parallel work streams. Stream A runs first and gates Stream B/C on a per-line basis (B/C cannot land on a line until that line's audit closes GREEN/YELLOW without open P0s). Stream G is new (2026-04-22): reactive engine/system upgrades flowing from Stream A's external-validation findings.

| Stream | Status | Description | Gate |
|--------|--------|-------------|------|
| A | [ ] | Per-line expert audits (8 audits, one per line, with mandatory per-node web-research validation) | Starts immediately |
| B | [ ] | `heroHolding` widening (3 tiers: flop roots → turn bucket-shifts → river) | Each line's audit closes without open P0 |
| C | [ ] | `correctByArchetype` widening | Threaded into B commits |
| D | [ ] | Engine accuracy follow-on: depth-2 injection + EV cache | A + B1 + B2 stable |
| E | [ ] | Polish (copy pass, empty-bucket UX, 1600×720 verification) | Rolling |
| G | [ ] | Engine / system upgrades from audit findings (new 2026-04-22) | Opened per-finding by Stream A, each G-* a dedicated session |

---

## Stream A — Per-Line Expert Audit (8–16 sessions) <- CURRENT STREAM

### Goal

For each of 8 authored lines, produce an immutable audit doc that examines every node across **seven** dimensions (setup realism, villain action realism, `correct` flag accuracy, framework citation quality, copy quality, bucket-teaching readiness, **external-validation via mandatory web research per decision node**). Outputs route to:

- Content-fix backlog items (Stream F, opened per audit as needed) — these are cases where our authored content disagrees with external truth.
- **Engine/system upgrade backlog items (Stream G, opened per audit as needed)** — these are cases where external truth disagrees with numbers our *engine* produces (fold curves, archetype multipliers, `HERO_BUCKET_TYPICAL_EQUITY`, `POP_CALLING_RATES`, etc.). Audits are the primary discovery channel for engine improvements — a web-validated disagreement beats any post-hoc feature request.
- Bucket-teaching queue table (feeds Stream B/C per-line prioritization).
- Documented-divergence entries in POKER_THEORY.md §11 when our position is deliberate rather than erroneous.
- Line-level GREEN / YELLOW / RED accuracy verdict.

### Standard of proof — non-negotiable

Per audit, every decision node must carry an external-validation sub-log: at minimum one web-sourced citation per non-obvious claim (correct-branch identification, villain action frequency, bluff-to-value assumption, equity claim, pot-odds / MDF math). POKER_THEORY.md is our prior — it is not external validation. Audits with no web queries fail review. Per-query categorization (A no-disagreement / B content-wrong / C engine-wrong / D intentional-divergence) is required; uncategorized queries also fail review.

### Session budget implication

Previous estimate (one session per line) assumed POKER_THEORY.md + authored-content inspection only. With web-research validation added, each line audit is budgeted at **1–2 sessions**: one structural walk (6 dimensions) + one external-validation pass. For short lines (A7: 2 nodes, A8: 3 nodes) the two passes fold into one session. For longer lines (A2 15 nodes, A1 12 nodes) budget two. Total Stream A budget revised from 8 to **10–14 sessions**.

### Audit order (SPI-proxy: higher-pot + higher-frequency first)

| # | ID | Line ID | Title | Nodes | Decision nodes | Status |
|---|----|---------|-------|-------|----------------|--------|
| 1 | LSW-A1 | `btn-vs-bb-3bp-ip-wet-t96` | BTN vs BB · 3BP · Wet T♥9♥6♠ — villain donks | 12 | 5 | NEXT |
| 2 | LSW-A2 | `btn-vs-bb-srp-ip-dry-q72r` | BTN vs BB · SRP · Dry Q72r | 15 | 6 | NEXT |
| 3 | LSW-A3 | `sb-vs-bb-srp-oop-paired-k77` | SB vs BB · SRP · Paired K♠7♦7♣ | 3 | 2 | COMPLETE 2026-04-22 (renamed CO→SB via LSW-F3 to fix position mismatch) |
| 4 | LSW-A4 | `sb-vs-btn-3bp-oop-wet-t98` | SB vs BTN · 3BP · Wet T♠9♠8♥ | 4 | 2 | NEXT |
| 5 | LSW-A5 | `co-vs-btn-bb-srp-mw-oop` | CO vs BTN + BB · 3-way SRP · Q♥5♠3♦ — hero OOP | 3 | 2 | NEXT |
| 6 | LSW-A6 | `btn-vs-bb-sb-srp-mw-j85` | BTN vs BB + SB · 3-way SRP · J♠8♥5♦ | 10 | 4 | NEXT |
| 7 | LSW-A7 | `utg-vs-btn-squeeze-mp-caller` | UTG open, MP call, BTN squeeze — hero UTG | 2 | 1 | NEXT |
| 8 | LSW-A8 | `utg-vs-btn-4bp-deep` | UTG vs BTN · 4BP · A♠K♦2♠ | 3 | 1 | NEXT |

Totals audited end-of-stream: **52 nodes, 23 decision nodes** (accounting for duplicates: the counts above sum to 52/23 — consistent with global totals 67/25 because two MW lines share some nodes via DAG convergence. Confirm during A1.)

### Per-audit workflow

For each `LSW-A[N]`:

1. Copy `docs/design/audits/line-audits/_TEMPLATE.md` → `docs/design/audits/line-audits/<line-id>.md`.
2. Open `lines.js` at the line's start offset; walk every node sequentially.
3. For each node, fill the six-dimension block from the template. Record findings with file:line anchors.
4. Fill the bucket-teaching queue table for every decision node where dimension 6 is YES or PARTIAL.
5. Render the accuracy verdict (GREEN / YELLOW / RED).
6. Append the backlog proposals (copy-paste block at end of audit).
7. Add an `LSW-F[audit-id]` content-fix batch entry to BACKLOG if any P0/P1 findings exist.

### Stream A acceptance

- 8 audit files exist, one per line, each with a verdict.
- Per-line bucket-teaching queue tables populated (feed Stream B).
- Stream F backlog entries opened for every audit with open P0/P1.

---

## Stream B — `heroHolding` Widening (3 tiers, ~5 sessions total)

Each tier batches multiple lines' decision nodes into a single commit per tier. Tier-gating: within a tier, a line's decision nodes are only authored after that line's audit closes without open P0.

### B1 — Flop decision roots (7 nodes, ~1 session)

Add `heroHolding.combos` + `heroHolding.bucketCandidates` to every flop decision root that isn't already authored (JT6 is done):

| # | Line | Node |
|---|------|------|
| 1 | `btn-vs-bb-srp-ip-dry-q72r` | `flop_root` |
| 2 | `sb-vs-bb-srp-oop-paired-k77` | `flop_root` |
| 3 | `sb-vs-btn-3bp-oop-wet-t98` | `flop_root` |
| 4 | `utg-vs-btn-4bp-deep` | `flop_root` |
| 5 | `btn-vs-bb-sb-srp-mw-j85` | `flop_root` |
| 6 | `co-vs-btn-bb-srp-mw-oop` | `flop_root` |
| 7 | `utg-vs-btn-squeeze-mp-caller` | `pre_root` |

Hero combo + bucket candidates for each pulled from the audit's bucket-teaching queue for that line.

### B2 — Turn decision nodes where bucket class shifts (~8 nodes, ~2 sessions)

Nodes where a turn card peels a flush, completes a draw, pairs the board, or otherwise reshuffles the flop bucket. Exact node list produced by Stream A audits' dimension-6 output.

### B3 — River decision nodes (~10 nodes, ~2 sessions)

River nodes have the narrowest bucket specificity (nut flush vs second flush vs non-nut flush, etc.). Author last, when Stream A has surfaced which river spots materially reward bucket-level teaching.

### Stream B acceptance

- Every flop decision root (8 total) has `heroHolding` declared.
- Every turn node flagged YES by Stream A has `heroHolding` declared.
- Every river node flagged YES by Stream A has `heroHolding` declared.
- `lineSchema.validateLine` passes on all lines.
- `engineAuthoredDrift.test.js` (RT-108) re-baseline if expected; otherwise green.

---

## Stream C — `correctByArchetype` Widening (threaded into B)

No separate tickets — each B tier commit that adds `heroHolding` to a decision also adds `correctByArchetype` to that decision's branches where the audit's bucket-teaching queue declared an archetype split. Audit table is authoritative.

### Stream C acceptance

- Every decision with a non-trivial fish/reg/pro archetype split per the audit has `correctByArchetype` declared.
- `resolveBranchCorrect` fallback (RT-107) continues to hold: decisions without `correctByArchetype` still ship with flat `correct`.

---

## Stream D — Engine Accuracy Follow-On (2–3 sessions)

Deferred from RT-111. Runs after Stream A closes for all 8 lines and Stream B1 + B2 have landed (so the content surface is stable when EV numbers shift).

### D1 — Depth-2 injection (2 sessions)

Replace the coarse `HERO_BUCKET_TYPICAL_EQUITY` table in `drillModeEngine.js` with real per-combo equity computed via `evaluateGameTree` depth-2 rollout.

- Wire the `depth2Eval` parameter through to a `gameTreeEvaluator` call.
- Plumb `bailedOut` from `gameTreeDepth2.js:838-839` to the drill output.
- Remove `'v1-simplified-ev'` caveat when `depth2Eval` was used.
- Regenerate `engineAuthoredDrift` baseline (sentinel constants may move).

### D2 — EV cache with `engineVersion` stamp (1 session)

NEV-12 forward requirement from RT-118: introduce an in-memory EV cache keyed by `(bucketId, archetype, boardHash, pot, engineVersion)`. Invalidate on `engineVersion` mismatch. Stamp version at wrapper entry.

### Stream D acceptance

- `'v1-simplified-ev'` caveat no longer appears on the live panel.
- Cache hit rate >80% on a full LinePicker → every-decision walk (measured once, not regression-gated).
- `engineVersion` bump invalidates cache (unit-tested).
- NEV-12 invariant passes.

---

## Stream E — Polish (rolling, 0 dedicated sessions budgeted)

Threaded into any B or D session:
- Caveat copy pass (user-friendly labels for every caveat).
- Empty-bucket UX: "No combos in this bucket from your range — this bucket doesn't reach this spot."
- Low-sample UX: amber indicator is present; verify at 1600×720 it doesn't crowd the table.
- Archetype toolbar 1600×720 verification after B1 ships (every line now has at least one bucket-EV reveal — stress-test the toggle).

---

## Stream F — Content fixes (one per audit with open P0/P1)

Opened lazily per audit. Each Stream F entry is a single-commit batch applying the audit's P0/P1 findings to `lines.js` (and any framework file if a finding changes framework citation). Closed when the audit's findings table shows all P0/P1 findings as shipped or explicitly waived. **Findings of category B only** (our content was wrong vs external truth). Category-C findings route to Stream G instead.

---

## Stream G — Engine / system upgrades from audit findings (reactive, opened per finding)

**New 2026-04-22.** Stream A's external-validation pass categorizes every query A/B/C/D (see template §7). Category-C findings — external truth disagrees with a number our *engine* produces — do not belong in Stream F (content fixes). They belong here: a dedicated engine-change session with its own test coverage.

Typical Stream G surfaces:

- `POP_CALLING_RATES` (gameTreeConstants.js) — a per-bucket calling rate that solver evidence or pool-study data shows is materially off.
- `HERO_BUCKET_TYPICAL_EQUITY` (drillModeEngine.js) — our coarse v1 equity priors for hero buckets, easy target for audit disagreement.
- `ARCHETYPE_BUCKET_MULTIPLIERS` (archetypeRangeBuilder.js) — our fish/reg/pro bucket deltas.
- Fold-curve shape (gameTreeConstants or empirical-fit output) — logistic params, street-conditional rates.
- `BUCKET_EQUITY_ANCHORS` / `BUCKET_TAXONOMY` — if an audit argues for a bucket split or refinement (e.g., `weakFlush` subdivided by kicker, board-relative `topSet`/`middleSet` we deferred in RT-110).
- Hand-classification code (`handTypeBreakdown.js`, `classifyComboFull`) — if an audit shows a combo is bucketed wrongly on a specific texture.

### Stream G workflow

Each Stream G ticket:

1. Cites the originating audit + finding ID + external-source citation.
2. Proposes the specific engine change (constant, function, taxonomy entry).
3. Adds or updates tests: the prior engine output becomes a failing test, the new output the passing one.
4. Re-baselines `engineAuthoredDrift.test.js` (RT-108) — every Stream G commit shifts drift snapshots.
5. If the change alters authored-line EV materially, adds to the audit's follow-up loop (the audit may need to rerun the affected node).

### Stream G ticket shape

```
LSW-G[N] — [short title]
  Origin: LSW-A[X] finding L-[node-id]-F[k]
  External source: [citation]
  Claim: [what the source says vs what we output]
  Proposed change: [file:symbol + before → after]
  Test: [new or updated test + expected behavior]
  Audit re-run: [yes / no; which nodes]
```

### Stream G acceptance

No fixed acceptance — this stream is open-ended. Closure is per-ticket: test green, audit loop closed, `engineAuthoredDrift` re-baselined.

---

## Phases

Pragmatic sequencing over calendar time:

| Phase | Status | Description | Accept Criteria |
|-------|--------|-------------|-----------------|
| 1 | [ ] | Stream A — 8 audits (seven dimensions, mandatory external validation per decision node) | All 8 audit files exist + signed verdicts + per-node external-validation logs |
| 2 | [ ] | Stream F batches — close all category-B P0/P1 findings (content-wrong) | Every audit's P0/P1 F-table clean |
| 2′ | [ ] | Stream G tickets — close all category-C P0/P1 findings (engine-wrong) | Every audit's category-C findings have shipped G tickets or are deferred with reasoning |
| 3 | [ ] | Stream B1 — flop roots | 7 flop roots authored, tests green |
| 4 | [ ] | Stream B2 — turn bucket-shifts | Flagged turns authored, tests green |
| 5 | [ ] | Stream D1 — depth-2 | `v1-simplified-ev` caveat removed |
| 6 | [ ] | Stream B3 — rivers | Flagged rivers authored, tests green |
| 7 | [ ] | Stream D2 — cache | NEV-12 invariant + engineVersion stamp live |
| 8 | [ ] | Closeout | Verdicts GREEN across all 8 lines; backlog zero-P1 across Stream F and Stream G |

Phase 2 and Phase 3 are partially parallelizable per-line (line-3's audit can close and its B1 node can ship while line-4's audit is still underway). Phase 2′ is dependent per-line on the specific engine change — some Stream G findings (e.g., `POP_CALLING_RATES` tweaks) may span multiple lines and should be batched.

---

## Files This Project Touches

### Audit outputs (new)
- `docs/design/audits/line-audits/_TEMPLATE.md` (created)
- `docs/design/audits/line-audits/btn-vs-bb-3bp-ip-wet-t96.md` (LSW-A1)
- `docs/design/audits/line-audits/btn-vs-bb-srp-ip-dry-q72r.md` (LSW-A2)
- `docs/design/audits/line-audits/sb-vs-bb-srp-oop-paired-k77.md` (LSW-A3; renamed from CO via LSW-F3 on 2026-04-22)
- `docs/design/audits/line-audits/sb-vs-btn-3bp-oop-wet-t98.md` (LSW-A4)
- `docs/design/audits/line-audits/co-vs-btn-bb-srp-mw-oop.md` (LSW-A5)
- `docs/design/audits/line-audits/btn-vs-bb-sb-srp-mw-j85.md` (LSW-A6)
- `docs/design/audits/line-audits/utg-vs-btn-squeeze-mp-caller.md` (LSW-A7)
- `docs/design/audits/line-audits/utg-vs-btn-4bp-deep.md` (LSW-A8)

### Content files (Stream B/C/F)
- `src/utils/postflopDrillContent/lines.js`
- `src/utils/postflopDrillContent/frameworks.js` (only if a finding changes framework citation)
- `src/utils/postflopDrillContent/multiwayFrameworks.js` (only if MW framework nit surfaces)

### Engine (Stream D)
- `src/utils/postflopDrillContent/drillModeEngine.js`
- `src/utils/exploitEngine/gameTreeEvaluator.js` (read-only)
- `src/utils/exploitEngine/gameTreeDepth2.js` (read-only)

### Tests (ongoing)
- `src/utils/postflopDrillContent/__tests__/lines.test.js`
- `src/utils/postflopDrillContent/__tests__/engineAuthoredDrift.test.js`
- `src/utils/postflopDrillContent/__tests__/drillModeEngine.test.js`

---

## Session Log

| Date | Session | Stream | Work Done |
|------|---------|--------|-----------|
| 2026-04-22 | Claude (main) | — | Project charter authored; template created; backlog entries LSW-A1..A8 + LSW-B1..B3 + LSW-D1/D2 + LSW-E placeholder + LSW-F placeholder queued. STATUS.md alert updated. No code changes. |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-22 | Audit runs first, widening follows per-line | Audits may find `correct` flag errors or framework citation issues that would be masked or amplified by ungrounded widening. Content-fix-before-widen avoids having to rework widened content. |
| 2026-04-22 | Audit order is SPI-proxy, not alphabetical | Higher-frequency + higher-pot lines gate more downstream work; failing fast on the biggest lines surfaces systemic issues earlier. |
| 2026-04-22 | Each audit is immutable after close | Same rule as every other audit in `docs/design/audits/`. Follow-up audits create `-v2` files. |
| 2026-04-22 | Stream D parks until A + B1 + B2 land | Depth-2 EV numbers shift sentinel constants the audit evaluated against. Running D earlier would force re-audit. |

---

## Closeout Checklist

Before marking project complete:

- [ ] 8 audit files all CLOSED with GREEN verdicts (or explicit owner-waived YELLOW).
- [ ] Every P0/P1 finding shipped or waived with reasoning in the audit.
- [ ] Every flop decision root has `heroHolding`.
- [ ] Every turn decision flagged dimension-6-YES has `heroHolding`.
- [ ] Every decision with declared archetype split has `correctByArchetype`.
- [ ] `'v1-simplified-ev'` caveat no longer appears.
- [ ] EV cache with `engineVersion` stamp live.
- [ ] All postflop-drill + component + drift tests green.
- [ ] BACKLOG LSW-* all closed or explicitly deferred.
- [ ] STATUS.md updated.
- [ ] MEMORY.md `project_line_study_slice_widening.md` closed summary written.
- [ ] Handoff file marked COMPLETE.
