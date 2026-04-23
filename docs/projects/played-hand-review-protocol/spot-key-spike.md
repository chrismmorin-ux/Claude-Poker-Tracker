# HRP-SPOT-KEY — Feasibility Spike

**Date:** 2026-04-23
**Project:** Played-Hand Review Protocol (HRP), Gate 4 prerequisite
**Author:** Claude (main)
**Status:** DRAFT — pending owner review

---

## Purpose

Gate 2 roundtable identified **spot-key resolution** (JTBD SR-29) as the non-trivial technical invariant underpinning HRP. Before Gate 4 surface specs proceed, we need empirical evidence that a played decision *can* be mapped to its canonical theoretical analog at useful coverage. This spike is that evidence.

The feasibility question: *given the existing hand schema + board-texture + position helpers, and the existing upper-surface + LSW corpus, what fraction of typical played decisions can we resolve to a canonical teaching node, and what engineering investment is required?*

---

## Corpus snapshot (what we match INTO)

### Upper-Surface reasoning artifacts

6 canonical artifact files in `docs/upper-surface/reasoning-artifacts/`:

- `btn-vs-bb-3bp-ip-wet-t96-flop_root.md`
- `btn-vs-bb-srp-ip-dry-q72r-river_after_turn_checkback.md`
- `btn-vs-bb-srp-ip-dry-q72r-turn_brick.md`
- `co-vs-btn-bb-srp-mw-oop-flop_root.md`
- `sb-vs-btn-3bp-oop-wet-t98-river_after_turn_call.md`
- `utg-vs-btn-4bp-deep-flop_root.md`

ID encoding: `<hero-pos>-vs-<villain-pos>-<pot-type>-<ip/oop>-<texture>-<board-shorthand>-<node-name>`

Sample §1 "Spot" section dimensions (from `btn-vs-bb-3bp-ip-wet-t96-flop_root.md`): position pair, pot type, effective stack, pot at node, texture class, board specifics, IP/OOP, SPR bucket, action context.

### LSW line-study nodes

8 lines in `src/utils/postflopDrillContent/lines.js` totaling **~76 decision+terminal nodes**:

| Line | Nodes |
|---|---|
| `btn-vs-bb-srp-ip-dry-q72r` | 15 |
| `btn-vs-bb-3bp-ip-wet-t96` | 14 |
| `btn-vs-bb-sb-srp-mw-j85` | 11 |
| `sb-vs-bb-srp-oop-paired` | 9 |
| `sb-vs-btn-3bp-oop-wet` | 9 |
| `co-vs-btn-bb-srp-mw-oop` | 8 |
| `utg-vs-btn-4bp-deep` | 5 |
| `utg-facing-squeeze` | 5 |

Within a line, node identifiers are semantic: `flop_root`, `turn_brick_v_checkraises`, `river_after_turn_call`, `terminal_callcatch_win`. Schema v3 enforces `POT_TYPES = ['srp', '3bp', '4bp', 'limped', 'srp-3way', '3bp-3way', 'srp-4way']`, `STREETS = ['flop', 'turn', 'river']`, `DECISION_KINDS = ['standard', 'bluff-catch', 'thin-value']`.

### Total corpus

**~82 teaching nodes** (6 upper-surface + ~76 LSW). Pilot-phase — corpus is young. Coverage grows as LSW audit sweep (A1..A8) + upper-surface authoring continues.

---

## Played-hand data model (what we match FROM)

### Dimensions extractable from a played decision

| Dimension | Source | Extraction |
|---|---|---|
| Street | `gameState.actionSequence[].street` | **Free** |
| Hero position | `positionUtils.getPositionName(heroSeat, buttonSeat)` | **Free** |
| Villain position | `positionUtils.getPositionName(villainSeat, buttonSeat)` | **Free** |
| IP/OOP vs villain | `positionUtils.isInPosition(heroSeat, villainSeat, buttonSeat)` | **Free** |
| Board texture class | `boardTexture.analyzeBoardTexture()` → `{texture: 'wet'|'medium'|'dry', isPaired, flushDraw, ...}` | **Free** — matches upper-surface encoding verbatim |
| Effective stack | `gameState.effectiveStack` | **Free** |
| SPR bucket | `(effective − currentBet) / pot` mapped to MICRO/LOW/MEDIUM/HIGH/DEEP per `potCalculator.js` | **Free** |
| Action prefix per street | `buildTimeline(hand)` ordered per-action tuples | **Free** |
| Specific board cards | `gameState.communityCards[]` | **Free** |
| Hero combo | `cardState.heroHoleCards` | **Free** |
| **Pot type (SRP/3BP/4BP)** | Must count preflop raises (0=SRP, 1=3BP, 2+=4BP); no production helper today | **~20 LoC new** |
| **Board shorthand (T96ss, Q72r)** | Must generate from sorted ranks + suitedness; no production helper | **~10 LoC new** |
| **Node ID (flop_root / turn_brick_v_calls / …)** | Must classify decision point by street + action history + board transition | **~100 LoC new** |
| Villain range estimate | Not persisted on hand record | **Not available — see §6** |

### Key finding: texture vocabulary already matches

`boardTexture.js:84` returns `texture ∈ {'wet', 'medium', 'dry'}` — **exact match** to upper-surface encoding. This is the single biggest free win: no conversion layer required for the texture dimension.

### Key finding: position vocabulary already matches

`positionUtils.POSITION_NAMES = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP1', 'MP2', 'HJ', 'CO']` — matches upper-surface `BTN/BB/CO/SB/UTG` naming verbatim. Zero-conversion join.

---

## Encoding mismatch — quantified

Per dimension in the upper-surface canonical ID format:

| Field | Directly extractable? | Missing helper | Effort |
|---|---|---|---|
| `<hero-pos>` | ✅ | — | 0 |
| `<villain-pos>` | ✅ | — | 0 |
| `<pot-type>` | ⚠️ | `countRaisesPreflop(timeline) → potType` | ~20 LoC |
| `<ip/oop>` | ✅ | — | 0 |
| `<texture>` | ✅ | — | 0 |
| `<board-shorthand>` | ⚠️ | `boardShorthand(cards) → 'T96ss'` | ~10 LoC |
| `<node-id>` | ❌ | `classifyNode(timeline, street, board) → 'flop_root'/'turn_brick_v_calls'/…` | ~100 LoC |

**Extraction tier (zero new code): ~70% of dimensions.**
**Shallow conversion (~30 LoC): +20%.**
**Hard conversion (~100 LoC): +10% (node classification).**

---

## Coverage estimate for typical played hand

Against the current 82-node corpus, expected resolution for a typical Chris cash-game decision:

- **Strong match (all dimensions agree with an authored node):** ~40–50% of decision points. Caveat: heavily weighted toward common spots (SRP + 3BP, BTN/BB and CO/BB, dry/wet/paired textures). Edge stacks (deep 4BP, 200bb+) under-represented.
- **Partial match (match on position pair + pot type + texture + street; differs on board specifics or node classification):** ~20–30%. Still pedagogically useful — hero sees *a* theoretical analog with a "partial — differs on X" indicator.
- **No analog:** ~15–25%. Typical causes: multiway (only 2 MW lines in LSW), tournament context (corpus is cash-focused), unusual pot types (limped, 3bp-4way), deep stacks. Honest empty-state UX required (matches Gate 2 Stage C rule 4).

**These estimates will improve** as the LSW audit sweep + upper-surface authoring program continue. HRP doesn't need 100% coverage to be useful — it needs honest confidence reporting + a graceful empty state.

---

## The villain-range blocker — investigated

The empirical survey flagged "villain range not persisted on hand record" as a gap. Re-investigated:

- **Live play:** `rangeEngine/` computes `villainRange` as a 169-combo `Float64Array`. This IS available *at decision time*.
- **Persistence:** hand records do not persist computed ranges — only actions.
- **Replay reconstruction:** `useHandReplayAnalysis` (`src/hooks/useHandReplayAnalysis.js`) already *reconstructs* villain range per decision point via `narrowByBoard` + tendency priors. Reconstructed, not persisted, but available at render time.

**Implication for HRP:** not a blocker for v1. HRP renders the **linked artifact's assertions** about villain range (§2 of the reasoning artifact), not a re-derived range. The artifact says "BB 3bet range is ~80 combos, filtered to donk-subset ~25–30." That's what hero sees. The *played-hand's* computed villain range is a separate fidelity check (Gate 2 Stage C rule 5: "linked artifact's audit state visible") but doesn't gate v1.

For SR-33 (dispute claim) activation later, the reconstructed range could be compared against the artifact's assertion to flag mismatches. Out of v1 scope; architected-for.

---

## Proposed architecture — `spotResolver` module

```
src/utils/spotResolver/
├── CLAUDE.md                  # module rules (no writes to hand records, pure functions)
├── index.js                   # public API: resolveSpot(hand, decisionIndex) → SpotMatch
├── spotKeyExtractor.js        # extract 8-dim spot descriptor from hand + decisionIndex
├── potTypeInference.js        # preflop-raise-count → 'srp'/'3bp'/'4bp'/'limped'  (~20 LoC)
├── boardShorthand.js          # card list → 'T96ss'/'Q72r'/'K77s' (~10 LoC)
├── nodeClassifier.js          # street + action prefix + board transition → canonical node_id (~100 LoC)
├── corpusIndex.js             # in-memory index of upper-surface + LSW nodes, built at PWA load
├── matchScorer.js             # descriptor × corpus → [SpotMatch{confidence: 'strong'|'partial'|'none', reasons: []}]
└── __tests__/                 # golden-test corpus: 30+ synthetic played hands with expected resolutions
```

Public API shape:

```javascript
// returns:
// { matches: [{ artifactId, confidence, differsOn: [], source: 'upper-surface'|'lsw' }], spotKey: '...' }
resolveSpot(hand, decisionIndex)
```

**Module rules (CLAUDE.md to author):**
- Pure functions; no side effects.
- No writes to hand records.
- Corpus index built once at PWA boot from `lines.js` + a manifest of upper-surface filenames (filename-as-key parsing is enough — no need to load artifact content for indexing).
- Imports pokerCore only; no dependency on exploitEngine or rangeEngine.
- Coordinates with exploit-deviation project if MH-12 also builds a spot resolver — single source of truth preferred.

**Total engine spec size:** ~200 LoC of pure utilities + ~150 LoC test golden corpus. 1–2 sessions of focused work.

---

## Risks + mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Node classification (`classifyNode`) produces wrong canonical IDs, silently mapping hero to wrong analog | Medium | Confidence indicator mandatory (Gate 2 rule). Golden test corpus of 30+ hand/expected-node pairs. Manual sample review before release |
| LSW node ID conventions drift as authoring continues | Medium | `nodeClassifier.js` tests against live `lines.js`; CI fails if a node is renamed without the classifier being updated |
| Upper-surface filenames drift (renamed, deleted) | Low | Manifest file regenerated at build time; stale references surface as "no analog" rather than broken links |
| Corpus coverage too low for v1 to feel useful | Medium | Ship v1 anyway; the empty state is the loop-closer (SR-32 nominate-for-corpus) — low coverage IS the product's call-to-action |
| Shared-infra tension with exploit-deviation's live-cited MH-12 | Low | Coordinate via handoff; if both projects need a resolver, consolidate to `spotResolver/` before either ships |

---

## Verdict + recommendation

**Feasibility: GREEN.** The mapping is ~70% free from existing helpers (`positionUtils`, `boardTexture`, `buildTimeline`, `potCalculator`), ~20% shallow-build (pot type + shorthand, ~30 LoC), ~10% hard (node classifier, ~100 LoC). Corpus coverage for typical played spots lands ~60–70% confident-or-partial — honest empty state covers the rest. Texture and position vocabularies already match upper-surface encoding verbatim — the single biggest de-risking fact.

**Recommended path:**

1. **Proceed to Gate 4 surface specs** without blocking on spotResolver implementation — the spec can reference the resolver's API shape (defined above) without waiting for code.
2. **Author spotResolver as a separate engineering sub-project** — parallel to Gate 4 spec work. Two sessions: (a) extractor + shorthand + pot-type inference + corpus index (b) node classifier + golden test corpus.
3. **Coordinate with exploit-deviation** — if MH-12's live-citation work needs spot resolution, merge into a single module rather than forking.

**Non-goals for v1:**
- Fuzzy matching beyond the `partial` confidence bucket. Keep it deterministic; no ML.
- Multi-way resolution beyond `srp-3way` + `3bp-3way`. MW lines in LSW are sparse; deep MW is "no analog."
- Tournament context beyond cash-analog mapping. Corpus is cash-focused; tournaments mostly return "no analog."

---

## Sign-off

**Author:** Claude (main), 2026-04-23.
**Verdict:** GREEN — feasible at useful coverage with ~200 LoC engineering investment.
**Unblocks:** Gate 4 surface specs (can reference API shape without waiting on implementation).
**Owner review requested:** accept feasibility verdict? prioritize spotResolver implementation before or in parallel with Gate 4 specs?

---

## Change log

- 2026-04-23 — Created. Empirical corpus + hand-schema survey. GREEN feasibility verdict.
