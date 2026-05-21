# spotResolver/ — Domain Rules

**MANDATORY**: Before editing ANY file in this directory, read:

1. `.claude/context/POKER_THEORY.md` §7 — first-principles decision modeling.
2. `docs/projects/played-hand-review-protocol.project.md` — HRP project charter.
3. `docs/projects/played-hand-review-protocol/spot-key-spike.md` — feasibility verdict + proposed architecture (this module is its implementation).
4. `docs/design/surfaces/hand-review-modal.md` — the surface spec this module's `SpotMatch` output feeds.
5. `docs/design/surfaces/hand-replay-view.md` — the ReviewPanel ledger-link chip that consumes `SpotMatch.confidence`.

This directory is the **spot-resolution primitive layer** of the Played-Hand Review Protocol (HRP). It owns:

- The 8-dimension played-hand descriptor (`spotKeyExtractor.js`).
- Pure transformations from played decisions to canonical descriptors (`potTypeInference.js`, `boardShorthand.js`, `nodeClassifier.js`).
- The in-memory corpus index of upper-surface reasoning artifacts + LSW line nodes (`corpusIndex.js`), built once at PWA boot.
- The descriptor × corpus → ranked-matches scorer (`matchScorer.js`).
- The `resolveSpot(hand, decisionIndex) → SpotMatch | null` orchestrator (`index.js`).

It does NOT own:

- The hand-review-modal React component or its sub-tabs (Stream U Phases 6-8).
- IDB schema for `hand.flags[]` + `hand.reviewState` (Stream E Phase 5).
- Any UI rendering — the resolver returns artifact IDs + descriptor data; consumers render content.
- Any decision-driving logic — the resolver describes spots, never recommends actions.

## Core principles

### 1. Labels are derived OUTPUTS, never decision INPUTS

The descriptor enums this module produces (`potType: 'srp'|'3bp'|...`, `texture: 'wet'|'medium'|'dry'`, `nodeId: 'flop_root'|'turn_brick_v_calls'|...`, `confidence: 'strong'|'partial'|'no-analog'`) are presentation-only. They MUST NEVER be:

- Used as inputs to villain modeling (range estimation, fold rates).
- Used as inputs to hero advice (action selection, sizing).
- Used as features in any decision-driving computation.

Villain decisions derive from equity, pot odds, SPR, and players remaining per POKER_THEORY.md §7 + `feedback_first_principles_decisions.md`. Spot descriptors are labels that help the consumer (HRP modal) look up a linked theoretical artifact; they are not strategic recommendations.

**Test target**: grep for imports of this module from `src/utils/exploitEngine/` or `src/utils/rangeEngine/` — those imports are forbidden. Only `src/components/views/HandReplayView/` + the planned `src/hooks/useSpotResolver.js` (Stream U) may import.

### 2. Pure-math only

Every function in this directory is a pure transformation: input → output, no side effects. No `fetch`, no `dispatch`, no `localStorage`, no IDB access. `import.meta.glob` IS allowed in `corpusIndex.js` only — it's a build-time mechanism that runs at module-load (PWA boot), not a runtime side effect.

Same input → same output, every time. Tests can rely on deterministic output.

### 3. Calibration constants, not learned weights

`matchScorer.js` per-dimension weights, threshold values (`STRONG_THRESHOLD = 0.875`, `PARTIAL_THRESHOLD = 0.625`), and SPR zone breakpoints are **hand-calibrated constants**. They are NOT learned from production data. Calibration evolves via:

1. Adding a golden-test entry for a played hand that the resolver mislabels.
2. Adjusting thresholds / weights to fix the test.
3. Verifying all existing golden tests still pass.

Never auto-tune from production data — that creates a feedback loop where the resolver's labels become inputs to its own training, drifting away from the descriptive purpose.

### 4. Deterministic-only matching

No fuzzy matching beyond the `partial` confidence bucket. No ML. No probabilistic ranking. The 3-tier confidence ladder (`strong` / `partial` / `no-analog`) is deterministic per the score thresholds in `matchScorer.js`.

If the corpus has no analog for a played decision, the honest answer is `no-analog` — not a stretched-fuzzy match. Per the SPOT-KEY spike §Non-goals (lines 191-194): no fuzzy beyond partial, no MW beyond `srp-3way`/`3bp-3way`, no tournament context.

### 5. HRP is a bridge, not a producer

Per HRP project doc line 30: HRP is a bridge, not a new authoring surface. The resolver's job is to map a played decision to a `{artifactId, confidence}` pair so the consumer can render the LINKED ARTIFACT'S content. The resolver itself never re-derives reasoning or generates new strategy claims.

`SpotMatch.scoredMatches` is a debug/transparency field (for future SR-32 nominate-for-corpus); the consumer's primary path is `{confidence, artifactId, reason?}`.

## Cross-domain import rule

Data flows IN (to spotResolver) from:

- ✅ `src/utils/pokerCore/` — board texture, card parsing, range matrix.
- ✅ `src/utils/positionUtils.js` — position naming.
- ✅ `src/utils/handAnalysis/handTimeline.js` — `buildTimeline(hand)`.
- ✅ `src/utils/postflopDrillContent/lines.js` — LSW corpus (LINES export).
- ✅ `src/utils/postflopDrillContent/lineSchema.js` — POT_TYPES, STREETS enums.
- ✅ `docs/upper-surface/reasoning-artifacts/*.md` — upper-surface corpus via `import.meta.glob`.

Data flows OUT (from spotResolver) to:

- ✅ `src/hooks/useSpotResolver.js` (planned Stream U Phase 6).
- ✅ `src/components/views/HandReplayView/` (planned Stream U Phase 7).
- ❌ `src/utils/exploitEngine/` — FORBIDDEN. Decision engines stay downstream.
- ❌ `src/utils/rangeEngine/` — FORBIDDEN. Same rule.
- ❌ `src/utils/shapeLanguage/` — FORBIDDEN. shapeLanguage is a sibling presentation primitive; no cross-talk between them.

Grep target: `grep -rn "from.*spotResolver" src/utils/exploitEngine src/utils/rangeEngine src/utils/shapeLanguage` must return zero results.

## Deliberate duplication note

`SPR_ZONES` constants (MICRO/LOW/MEDIUM/HIGH/DEEP breakpoints) are duplicated from `src/utils/exploitEngine/gameTreeConstants.js:78-98` per the cross-domain import rule above — spotResolver cannot import from exploitEngine. SPR zones are universal poker concepts (not exploit-engine-specific calibration), and the duplication is 5 constants + 1 small function. A future cleanup could move SPR_ZONES to `pokerCore/` as a neutral domain; until then, this duplication is intentional and explicitly allowed.

## Anti-patterns

### DO NOT use spot-key labels as decision inputs

Stated under principle 1, restated because it's the load-bearing rule. A flag in an exploit recommendation like `if (spotKey.endsWith('flop_root')) foldRate *= 1.1` is a violation of POKER_THEORY.md §7. Decision rates come from equity, pot odds, and SPR — not from descriptor labels.

### DO NOT auto-tune scoring weights from production data

`matchScorer.js` weights + `STRONG_THRESHOLD` / `PARTIAL_THRESHOLD` are calibrated, not learned. Auto-tuning from production data creates a feedback loop: the resolver produces matches, those matches filter into "improved" training data, the scorer drifts toward whatever it was already saying. Calibration is hand-driven via golden tests.

### DO NOT add fuzzy matching beyond the `partial` confidence bucket

The 3-tier ladder is deterministic per the score thresholds. Honest empty-state (`no-analog`) is better than stretched-fuzzy matches. Per spike §Non-goals.

### DO NOT import from `exploitEngine/` / `rangeEngine/` / `shapeLanguage/`

See cross-domain import rule above. CI-grep enforces.

### DO NOT re-derive reasoning in resolveSpot

The resolver maps a played decision to a linked artifact ID. The consumer renders the artifact's content. The resolver itself never:

- Composes claims about villain ranges
- Computes EV or equity (already done upstream in the analysis pipeline)
- Generates strategic recommendations
- Produces narrative text

`SpotMatch.reason?` is descriptor-level ("stack depth differs"), not strategic ("you should fold").

## File map

| File | Purpose |
|------|---------|
| `CLAUDE.md` | This file — domain rules. |
| `index.js` | Public `resolveSpot(hand, decisionIndex) → SpotMatch \| null` orchestrator + re-exports. |
| `potTypeInference.js` | `inferPotType(timeline) → 'srp' \| '3bp' \| '4bp' \| 'limped' \| 'srp-3way' \| '3bp-3way' \| 'srp-4way' \| null`. |
| `boardShorthand.js` | `toBoardShorthand(communityCards) → 'T96ss' \| 'Q72r' \| 'K77'`. |
| `nodeClassifier.js` | `classifyNode(street, actionPrefix, boardTransition) → canonical node_id` ('flop_root', 'turn_brick_v_calls', etc.). |
| `corpusIndex.js` | PWA-boot in-memory index of upper-surface + LSW corpus entries. Memoized. |
| `spotKeyExtractor.js` | `extractDescriptor(hand, decisionIndex) → SpotDescriptor \| null` (8-dim). |
| `matchScorer.js` | `scoreMatch(descriptor, corpusEntry) → {score, differsOn}` + `rankMatches(descriptor, corpus) → scoredMatches[]`. |
| `__tests__/` | Golden-test corpus (30+ synthetic hands with expected resolutions) + per-module unit tests. |

## Future scope

- **HRP Stream E Phase 5** (next sprint): IDB schema bump for `hand.flags[]` + `hand.reviewState` (separate ticket; out of spotResolver scope).
- **HRP Stream U Phase 6+**: `useSpotResolver` React hook + HandReplayView ledger-link chip + HandReviewModal component.
- **SR-32 nominate-for-corpus**: when a `no-analog` decision's spotKey is copied to clipboard, future workflow adds the spot to an authoring queue. spotResolver provides the `spotKey` field today; the queue is out of scope.
- **Corpus growth**: as LSW audit sweep (A1..A8) + upper-surface authoring continues, corpus entries grow. The index regenerates at next PWA build; no resolver code change.
- **Coverage tuning**: if golden-test corpus shows coverage drifts outside the spike's targets (~40-50% strong / ~20-30% partial / ~15-25% no-analog), revisit `STRONG_THRESHOLD` / `PARTIAL_THRESHOLD` in `matchScorer.js` (calibration, not learning).
