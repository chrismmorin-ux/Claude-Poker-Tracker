/**
 * drillModeEngine.js — drill-mode engine for `bucket-ev-panel-v2`.
 *
 * Post-LSW-G4-IMPL-Commit-5 (2026-04-22) this file hosts the villain-first
 * engine surface for Line Study's decision panel:
 *
 *   - `DOMINATION_GROUPS` + `computeDominationMap` + `classifyDomination` +
 *     `listDominationGroupMeta` / `dominationGroupMetaFor` — the
 *     per-villain-group range decomposition shipped in LSW-G5/G5.1/G5.2.
 *   - `GROUP_CALL_RATES` + `computeDecomposedActionEVs` +
 *     `computeValueBeatRatio` + `computeBucketEVsV2` — the v2 orchestrator
 *     shipped in Commit 2 that replaces v1's coarse-prior pipeline.
 *
 * INV-08.a exception: `postflopDrillContent → exploitEngine` imports are
 * permitted only through this module's contract (see
 * `.claude/context/INVARIANTS.md`).
 *
 * Pure module (import-only). Async because MC equity computation is async.
 *
 * Historical note: v1 (RT-111, 2026-04-21) shipped a different analysis
 * surface (`HERO_BUCKET_TYPICAL_EQUITY` / `DEFAULT_ACTIONS` /
 * `villainFoldRateFromComposition` / `evaluateDrillNode` /
 * `computePinnedComboEV`). That pipeline was deleted in Commit 5 after the
 * LSW audit sweep surfaced pervasive errors — see the Commit 5 deletion
 * rationale comment below.
 */

import { isKnownArchetype } from './archetypeRangeBuilder';
import { handVsRange } from '../pokerCore/monteCarloEquity';
import { segmentRange } from '../exploitEngine/rangeSegmenter';
import { createRange, rangeIndex } from '../pokerCore/rangeMatrix';
import { analyzeBoardTexture } from '../pokerCore/boardTexture';

// =============================================================================
// LSW-G4-IMPL Commit 5 (2026-04-22) — v1 analysis pipeline deleted
// =============================================================================
//
// The following exports were removed in Commit 5 of the bucket-ev-panel-v2
// migration because the LSW audit sweep surfaced pervasive errors in the
// v1 pipeline that consumed them:
//
//   - HERO_BUCKET_TYPICAL_EQUITY — coarse bucket-level equity priors that
//     were archetype-invariant and board-invariant, driving systematic EV
//     miscalibration (S1, LSW-G1 category-C deferral).
//   - DEFAULT_ACTIONS — hero action set used by the v1 BucketEVPanel.
//   - villainFoldRateFromComposition — aggregate fold rate derivation
//     (v2 uses per-group fold rates from GROUP_CALL_RATES instead).
//   - evaluateDrillNode — v1 drill-mode evaluator with the v1-simplified-ev
//     caveat. Replaced by computeBucketEVsV2 + computeDecomposedActionEVs.
//   - computePinnedComboEV — v1 pinned-combo EV helper. Functionality
//     absorbed into computeBucketEVsV2 via the per-group equity path.
//
// See docs/design/surfaces/bucket-ev-panel-v2.md + handoff series
// lsw-g4-impl-commit{1..5}.md for the full migration record.

// =============================================================================
// LSW-G5 — domination map (surface audit S6)
// =============================================================================
//
// Pinned-combo EV (H2) answers "what's my overall equity vs villain's range."
// The domination map answers "what's my equity vs each component of villain's
// range, and am I dominating / dominated / crushing?" This is the second of
// the two halves of the first-principles teaching payload: knowing your
// weighted average is useful; knowing which villain hands you're beating vs
// losing to is actionable (it tells you what you'd lose to if you barrel the
// turn and what you'd get paid by if you value bet the river).
//
// Design: segment villain's range on the board, group by hand-type into
// poker-familiar categories, compute per-group equity via MC, classify as
// crushed / dominated / neutral / favored / dominating based on equity
// thresholds. Rows sorted by group weight descending so the heaviest villain
// region appears first.
//
// Granularity note: `overpair` is split out from the standard HAND_TYPE_GROUPS
// `topPair` grouping because for hero's top pair on most boards, the split
// is pedagogically critical — vs overpair hero is dominated; vs same-TP the
// answer depends on kicker. Merging them hides the distinction.

// LSW-G5.1 (2026-04-22): precision-split the domination taxonomy so each
// meaningful hand class is its own row. Rationale: on future streets, more
// cards come — the equity delta between a nut flush draw and a gutshot is
// ~6%/trial vs ~4%/trial and the nut card also BLOCKS villain's nut-flush
// bluff-catching. Collapsing all draws into one row erases the planning
// signal the student needs. "Overcards" splits by high card because an A
// blocks villain's best bluffs (and best bluff-catching calls), while a
// K-high hand's equity profile is different (more domination by AK, less
// blocker pressure). Pair tier splits by kicker strength because vs hero's
// TP, TPTK-vs-TP-weak is a ~20-point equity swing.
//
// Pair+draw composite classification (e.g., "middle pair with BDFD +
// gutshot") is still collapsed under the primary made-hand shape — the
// classifier returns strongest-first. Surfacing pair+draw as its own row
// requires two-dimensional hand classification and is deferred to a v3
// enhancement. Students looking at a middlePair row should mentally note
// that some combos in that region have draws on top.
//
// Helper predicate for rank-filtered overcards groups. Returns true when the
// combo's higher hole card matches one of the target ranks.
const highCardIn = (ranks) => (c) => {
  const r = Math.max(c.card1 >> 2, c.card2 >> 2);
  return ranks.includes(r);
};

// LSW-G5.2 (2026-04-22): pair+draw composite filters. Relies on the
// `drawFeatures` sidecar now attached to each segmentRange combo.
// Hierarchy is mutually exclusive so pair+draw combos are counted in
// exactly one composite group: FD takes priority over OESD takes priority
// over gutshot. Bare-pair groups (no draw at all) take an inverse filter
// so they exclude any combo counted in a composite.
const hasAnyDirectDraw = (c) =>
  !!(c.drawFeatures && (c.drawFeatures.hasFlushDraw
    || c.drawFeatures.hasOESD
    || c.drawFeatures.hasGutshot));
const hasFlushDraw = (c) => !!(c.drawFeatures && c.drawFeatures.hasFlushDraw);
const hasOesdOnly = (c) =>
  !!(c.drawFeatures && c.drawFeatures.hasOESD && !c.drawFeatures.hasFlushDraw);
const hasGutshotOnly = (c) =>
  !!(c.drawFeatures && c.drawFeatures.hasGutshot
    && !c.drawFeatures.hasOESD && !c.drawFeatures.hasFlushDraw);
const noDirectDraw = (c) => !hasAnyDirectDraw(c);

// Composite filter + type list helper: pair+draw rows apply to all
// pair-tier handTypes so the disclosure doesn't explode into
// middlePair+FD, bottomPair+FD, topPair+FD, etc. — instead the student
// sees "Pair + Flush Draw (any pair tier)" as a single row with the
// weightPct aggregate, and the sub-composition (which pair tier) is
// visible via the individual bare-pair rows.
const ALL_PAIR_TYPES = ['overpair', 'topPairGood', 'topPairWeak', 'middlePair', 'bottomPair', 'weakPair'];

const DOMINATION_GROUPS = Object.freeze([
  { id: 'premium',         label: 'Premium (SF / Quads / Boat)', definition: 'Straight flush, quads, or full house — almost always a call + raise region.', types: ['straightFlush', 'quads', 'fullHouse'] },
  { id: 'nutFlush',        label: 'Nut Flush',                   definition: 'A flush using the ace of the board-suit — unbeatable by another flush.', types: ['nutFlush'] },
  { id: 'secondFlush',     label: 'K-high Flush',                definition: 'A flush with K-high — loses only to the nut flush.', types: ['secondFlush'] },
  { id: 'weakFlush',       label: 'Low Flush',                   definition: 'A flush below K-high — can be outflushed by stronger flushes.', types: ['weakFlush'] },
  { id: 'nutStraight',     label: 'Nut Straight',                definition: 'The highest possible straight on this board.', types: ['nutStraight'] },
  { id: 'nonNutStraight',  label: 'Non-nut Straight',            definition: 'A straight that is not the best possible — loses to higher straights.', types: ['nonNutStraight'] },
  { id: 'set',             label: 'Set',                         definition: 'Three of a kind using a pocket pair — top of the value region.', types: ['set'] },
  { id: 'trips',           label: 'Trips',                       definition: 'Three of a kind using one hole card + a paired board rank.', types: ['trips'] },
  { id: 'twoPair',         label: 'Two Pair',                    definition: 'Two pairs using both hole cards with the board.', types: ['twoPair'] },
  // LSW-G5.2: pair-tier groups split by draw presence. Composite rows
  // aggregate across all pair tiers (so one "Pair+FD" row, not six) —
  // keeps the disclosure readable. Bare-pair rows use a noDirectDraw
  // filter so they exclude combos counted in a composite row (no
  // double-counting; sum of weightPct across pair-family rows equals
  // the range's total pair-tier fraction).
  { id: 'pairPlusFD',      label: 'Pair + Flush Draw',           definition: 'A pair plus a direct flush draw — semi-bluff jamming region.', types: ALL_PAIR_TYPES, comboFilter: hasFlushDraw },
  { id: 'pairPlusOesd',    label: 'Pair + OESD',                 definition: 'A pair plus an open-ended straight draw — high-equity barreling region.', types: ALL_PAIR_TYPES, comboFilter: hasOesdOnly },
  { id: 'pairPlusGutshot', label: 'Pair + Gutshot',              definition: 'A pair plus a gutshot straight draw — pot-control region.', types: ALL_PAIR_TYPES, comboFilter: hasGutshotOnly },
  { id: 'overpair',        label: 'Overpair',                    definition: 'A pocket pair larger than every board card.', types: ['overpair'], comboFilter: noDirectDraw },
  { id: 'tpStrong',        label: 'Top Pair Strong Kicker',      definition: 'Top pair with a strong kicker (A/K usually).', types: ['topPairGood'], comboFilter: noDirectDraw },
  { id: 'tpWeak',          label: 'Top Pair Weak Kicker',        definition: 'Top pair with a weak kicker — beaten by same TP + better kicker.', types: ['topPairWeak'], comboFilter: noDirectDraw },
  { id: 'middlePair',      label: 'Middle Pair',                 definition: 'A pair using the middle board card.', types: ['middlePair'], comboFilter: noDirectDraw },
  { id: 'bottomPair',      label: 'Bottom Pair',                 definition: 'A pair using the lowest board card.', types: ['bottomPair'], comboFilter: noDirectDraw },
  { id: 'weakPair',        label: 'Underpair (below board)',     definition: 'A pocket pair below the lowest board card.', types: ['weakPair'], comboFilter: noDirectDraw },
  { id: 'comboDraw',       label: 'Combo Draw (FD + straight)',  definition: 'Flush draw + straight draw on the same hand — highest-equity semi-bluff region.', types: ['comboDraw'] },
  { id: 'nutFlushDraw',    label: 'Nut Flush Draw',              definition: 'Flush draw using the nut-suit card — best FD, also blocks villain nut flush.', types: ['nutFlushDraw'] },
  { id: 'nonNutFlushDraw', label: 'Non-nut Flush Draw',          definition: 'A flush draw that would not make the nut flush.', types: ['nonNutFlushDraw'] },
  { id: 'oesd',            label: 'Open-Ended Straight Draw',    definition: 'Four consecutive cards — 8 outs to a straight.', types: ['oesd'] },
  { id: 'gutshot',         label: 'Gutshot',                     definition: 'Inside straight draw — 4 outs to a straight.', types: ['gutshot'] },
  { id: 'overcardsAx',     label: 'Overcards (Ax)',              definition: 'Two unpaired overcards with an ace — bluffs with blocker pressure on villain nut calls.', types: ['overcards'], comboFilter: highCardIn([12]) },
  { id: 'overcardsKx',     label: 'Overcards (Kx)',              definition: 'Two unpaired overcards with a king — bluffs with moderate blocker value.', types: ['overcards'], comboFilter: highCardIn([11]) },
  { id: 'overcardsQxJx',   label: 'Overcards (Qx / Jx)',         definition: 'Two unpaired overcards headed by Q or J — lower blocker value, still live to pair.', types: ['overcards'], comboFilter: highCardIn([10, 9]) },
  { id: 'overcardsOther',  label: 'Overcards (other)',           definition: 'Two unpaired overcards below J-high — rare; minimal equity.', types: ['overcards'], comboFilter: (c) => {
    const r = Math.max(c.card1 >> 2, c.card2 >> 2);
    return r < 9;  // Shouldn't trigger on most boards — included for completeness
  } },
  { id: 'backdoorCombo',   label: 'Backdoor Combo (BDFD+BDSD)',  definition: 'Air with both backdoor flush and backdoor straight potential.', types: ['airBackdoorCombo'] },
  { id: 'backdoorFlush',   label: 'Backdoor Flush Draw Only',    definition: 'Air with backdoor flush draw only — runner-runner flush potential.', types: ['airBackdoorFlush'] },
  { id: 'backdoorStraight',label: 'Backdoor Straight Draw Only', definition: 'Air with backdoor straight draw only — runner-runner straight potential.', types: ['airBackdoorStraight'] },
  { id: 'air',             label: 'Air',                         definition: 'No pair, no draw, no showdown value — pure high-card.', types: ['air'] },
]);

/**
 * Public accessor for DOMINATION_GROUPS — used by the v2 panel's GlossaryBlock
 * to surface definitions + labels for currently-rendered groups.
 *
 * Returns an array of `{ id, label, definition }` without the internal
 * `types` / `comboFilter` plumbing. Separate export from the raw internal
 * array to keep consumers from reaching into engine internals.
 */
export const listDominationGroupMeta = () =>
  DOMINATION_GROUPS.map(({ id, label, definition }) => ({ id, label, definition }));

/**
 * Find a single DOMINATION_GROUPS metadata entry by id. Returns null when
 * the id isn't in the taxonomy (so callers can fall back to bucketTaxonomy
 * for BUCKET_TAXONOMY keys that don't match DOMINATION_GROUPS ids).
 */
export const dominationGroupMetaFor = (groupId) => {
  const g = DOMINATION_GROUPS.find((x) => x.id === groupId);
  if (!g) return null;
  return { id: g.id, label: g.label, definition: g.definition };
};

/**
 * Classify hero's equity vs a specific villain-hand-type group into a
 * teaching-friendly label. Thresholds tuned for how poker players talk
 * about domination / freerolling vs a range slice.
 */
export const classifyDomination = (equity) => {
  if (!Number.isFinite(equity)) return 'unknown';
  if (equity < 0.20) return 'crushed';
  if (equity < 0.40) return 'dominated';
  if (equity < 0.60) return 'neutral';
  if (equity < 0.80) return 'favored';
  return 'dominating';
};

/**
 * Build a 169-cell partial range from a set of segmentation combos matching
 * the target hand-types. Each cell's weight is the sum of `combo.weight` for
 * live combos in that cell that classify into one of the target types. This
 * preserves per-cell weight semantics so `handVsRange` sees villain's ranges
 * as weighted.
 */
const partialRangeFromCombos = (combos, targetTypes, comboFilter = null) => {
  const grid = createRange();
  const targets = new Set(targetTypes);
  for (const c of combos) {
    if (!targets.has(c.handType)) continue;
    if (comboFilter && !comboFilter(c)) continue;
    const r1 = c.card1 >> 2;
    const r2 = c.card2 >> 2;
    const suited = (c.card1 & 3) === (c.card2 & 3);
    const idx = rangeIndex(Math.max(r1, r2), Math.min(r1, r2), suited);
    grid[idx] += c.weight;
  }
  return grid;
};

/**
 * Compute hero's domination map vs villain's range grouped by hand-type.
 *
 * @param {{
 *   pinnedCombo: { card1: number, card2: number } | null,
 *   villainRange: Float64Array,    // 169-cell base villain range
 *   board: number[],               // 3-5 encoded cards
 *   boardTexture?: object | null,
 *   trialsPerGroup?: number,       // MC trials per group (default 250)
 * }} args
 * @returns {Promise<Array<{
 *   id: string,
 *   label: string,
 *   equity: number,
 *   weightPct: number,
 *   sampleSize: number,
 *   relation: 'crushed' | 'dominated' | 'neutral' | 'favored' | 'dominating',
 * }> | null>}
 */
export const computeDominationMap = async ({
  pinnedCombo,
  villainRange,
  board,
  boardTexture = null,
  trialsPerGroup = 250,
}) => {
  if (!pinnedCombo
      || !Number.isFinite(pinnedCombo.card1)
      || !Number.isFinite(pinnedCombo.card2)
      || pinnedCombo.card1 === pinnedCombo.card2) {
    return null;
  }
  if (!villainRange || !Array.isArray(board) || board.length < 3 || board.length > 5) {
    return null;
  }
  if (board.includes(pinnedCombo.card1) || board.includes(pinnedCombo.card2)) {
    return null;
  }

  const tx = boardTexture || analyzeBoardTexture(board);
  // Hero's cards are dead — segmenter dead-card arg excludes hero-blocked
  // villain combos so equity math doesn't double-count.
  const seg = segmentRange(villainRange, board, [pinnedCombo.card1, pinnedCombo.card2], tx);
  const total = seg.totalWeight;
  if (total <= 0) return [];

  // Run MC per group in parallel.
  const heroCards = [pinnedCombo.card1, pinnedCombo.card2];
  const jobs = DOMINATION_GROUPS.map(async (group) => {
    const grid = partialRangeFromCombos(seg.combos, group.types, group.comboFilter);
    let groupWeight = 0;
    let groupCount = 0;
    const targetTypes = new Set(group.types);
    for (const c of seg.combos) {
      if (!targetTypes.has(c.handType)) continue;
      if (group.comboFilter && !group.comboFilter(c)) continue;
      groupWeight += c.weight;
      groupCount++;
    }
    const weightPct = total > 0 ? (groupWeight / total) * 100 : 0;
    if (groupWeight <= 0) {
      return {
        id: group.id,
        label: group.label,
        equity: 0,
        weightPct: 0,
        sampleSize: 0,
        relation: 'empty',
      };
    }
    const { equity } = await handVsRange(heroCards, grid, board, { trials: trialsPerGroup });
    return {
      id: group.id,
      label: group.label,
      equity,
      weightPct,
      sampleSize: groupCount,
      relation: classifyDomination(equity),
    };
  });
  const results = await Promise.all(jobs);
  // Sort heaviest-first (most frequent villain regions top), drop empty groups.
  return results
    .filter((r) => r.relation !== 'empty')
    .sort((a, b) => b.weightPct - a.weightPct);
};

// =============================================================================
// LSW-G4-IMPL Commit 2 — engine v2 for bucket-ev-panel-v2
// =============================================================================
//
// Per the v2 spec (`docs/design/surfaces/bucket-ev-panel-v2.md`), the panel
// rewrite requires two new engine functions:
//
//  - `computeDecomposedActionEVs`: for each hero action and each villain
//    DOMINATION_GROUP, compute the per-group EV contribution. Produces the
//    `perGroupContribution` array that drives P2's WeightedTotalTable.
//  - `computeBucketEVsV2`: orchestrator that joins `computeDominationMap`
//    with per-group EV computation, picks the best action, and returns the
//    `ComputeBucketEVsV2Output` shape (decomposition + actionEVs +
//    recommendation + valueBeatRatio for bluff-catch/thin-value +
//    confidence + optional errorState).
//
// These are NEW exports alongside the v1 `computeBucketEVs` (in BucketEVPanel.jsx)
// and the existing `evaluateDrillNode` / `computePinnedComboEV` here.
// v1 remains unchanged until Commit 5 of the migration path deletes it.
//
// Per-group fold rate. DOMINATION_GROUPS are finer-grained than the segmenter
// hand-types POP_CALLING_RATES is keyed by — split groups like `overcardsAx`,
// `pairPlusFD`, `pairPlusOesd` don't have direct entries. `GROUP_CALL_RATES`
// is a v2 prior table with coarse population-anchored call frequencies per
// group. Depth-2 integration (LSW-D1) will replace these with empirical
// fit from observed fold curves.

export const GROUP_CALL_RATES = Object.freeze({
  // Made-hand region — calls nearly always
  premium:          0.98,
  nutFlush:         0.98,
  secondFlush:      0.92,
  weakFlush:        0.85,
  nutStraight:      0.95,
  nonNutStraight:   0.88,
  set:              0.95,
  trips:            0.92,
  twoPair:          0.82,
  // Pair tier split by draw presence
  pairPlusFD:       0.78,
  pairPlusOesd:     0.65,
  pairPlusGutshot:  0.55,
  overpair:         0.75,
  tpStrong:         0.65,
  tpWeak:           0.48,
  middlePair:       0.35,
  bottomPair:       0.22,
  weakPair:         0.18,
  // Direct draws (equity + fold-to-barrel dynamics)
  comboDraw:        0.80,
  nutFlushDraw:     0.65,
  nonNutFlushDraw:  0.52,
  oesd:             0.48,
  gutshot:          0.22,
  // Overcards split by blocker rank
  overcardsAx:      0.18,
  overcardsKx:      0.12,
  overcardsQxJx:    0.08,
  overcardsOther:   0.05,
  // Backdoor-only air
  backdoorCombo:    0.15,
  backdoorFlush:    0.10,
  backdoorStraight: 0.08,
  // Pure air
  air:              0.02,
});

/**
 * Look up per-group call rate, defaulting to 0.3 when the group is unknown
 * (shouldn't happen with current DOMINATION_GROUPS but is defensive against
 * future taxonomy expansions landing before this table updates).
 */
const groupCallRate = (groupId) => {
  const r = GROUP_CALL_RATES[groupId];
  if (Number.isFinite(r)) return r;
  return 0.3;
};

/**
 * Compute per-group per-action EV contributions.
 *
 * For each hero action × each villain DOMINATION_GROUP:
 *  - bet of size B into pot P:
 *      perGroupEV = foldRate × P + (1 - foldRate) × [equity × (P + 2B) - B]
 *      where foldRate = 1 - GROUP_CALL_RATES[group]
 *  - check:
 *      perGroupEV = equity × P   (showdown at current pot)
 *  - call / fold / raise / jam: v1 flag unsupported with ev=0
 *
 * Totals across groups: totalEV = Σ (weightPct_g / 100) × perGroupEV_g
 *
 * @param {{
 *   decomposition: Array<{ id, label, equity, weightPct, sampleSize, relation }>,
 *   heroActions: Array<{ label, kind, betFraction? }>,
 *   pot: number,
 * }} args
 * @returns {Array<{
 *   actionLabel: string,
 *   kind: string,
 *   betFraction?: number,
 *   perGroupContribution: Array<{ groupId: string, ev: number, weightTimesEV: number }>,
 *   totalEV: number,
 *   totalEVCI: { low: number, high: number },
 *   isBest: boolean,
 *   unsupported?: boolean,
 * }>}
 */
export const computeDecomposedActionEVs = ({ decomposition, heroActions, pot }) => {
  if (!Array.isArray(decomposition)) {
    throw new Error('computeDecomposedActionEVs: decomposition must be an array');
  }
  if (!Array.isArray(heroActions) || heroActions.length === 0) {
    throw new Error('computeDecomposedActionEVs: heroActions must be a non-empty array');
  }
  if (!Number.isFinite(pot) || pot < 0) {
    throw new Error('computeDecomposedActionEVs: pot must be a non-negative finite number');
  }

  const actionEVs = heroActions.map((action) => {
    const perGroupContribution = [];
    let totalEV = 0;
    let unsupported = false;

    if (action.kind === 'bet' || action.kind === 'raise' || action.kind === 'jam') {
      const betFrac = Number.isFinite(action.betFraction) ? action.betFraction : 0.75;
      const betSize = pot * betFrac;
      for (const group of decomposition) {
        const foldRate = 1 - groupCallRate(group.groupId);
        const eq = Number.isFinite(group.heroEquity) ? group.heroEquity : 0;
        // EV of bet vs this group:
        //   fold:  +pot
        //   call:  equity × (pot + 2B) − B
        const ev = foldRate * pot + (1 - foldRate) * (eq * (pot + 2 * betSize) - betSize);
        const weight = group.weightPct / 100;
        const contrib = weight * ev;
        totalEV += contrib;
        perGroupContribution.push({
          groupId: group.groupId,
          ev,
          weightTimesEV: contrib,
        });
      }
    } else if (action.kind === 'check') {
      for (const group of decomposition) {
        const eq = Number.isFinite(group.heroEquity) ? group.heroEquity : 0;
        const ev = eq * pot; // showdown at current pot
        const weight = group.weightPct / 100;
        const contrib = weight * ev;
        totalEV += contrib;
        perGroupContribution.push({
          groupId: group.groupId,
          ev,
          weightTimesEV: contrib,
        });
      }
    } else if (action.kind === 'fold') {
      // Folding = 0 EV by definition (no money gained or lost beyond what's
      // already in the pot, which is sunk).
      for (const group of decomposition) {
        perGroupContribution.push({
          groupId: group.groupId,
          ev: 0,
          weightTimesEV: 0,
        });
      }
      totalEV = 0;
    } else if (action.kind === 'call') {
      // v1 ship does not model an explicit call action (villain acted first —
      // hero's only EV question is whether the immediate pot-odds work). This
      // path exists so authored `heroActions` including 'call' don't crash;
      // a future extension computes call-EV properly.
      for (const group of decomposition) {
        perGroupContribution.push({
          groupId: group.groupId,
          ev: 0,
          weightTimesEV: 0,
        });
      }
      unsupported = true;
    } else {
      // Unknown kind — mark unsupported; caller can extend.
      for (const group of decomposition) {
        perGroupContribution.push({
          groupId: group.groupId,
          ev: 0,
          weightTimesEV: 0,
        });
      }
      unsupported = true;
    }

    // Confidence interval — rough ±5% MC band propagated from domination
    // equity samples. Per-row equity CI is not tracked here; v1 ships a
    // constant band until LSW-D1 integrates per-group MC variance.
    const totalEVCI = { low: totalEV - 0.5, high: totalEV + 0.5 };

    return {
      actionLabel: action.label,
      kind: action.kind,
      betFraction: action.betFraction,
      perGroupContribution,
      totalEV,
      totalEVCI,
      isBest: false, // set below after ranking
      ...(unsupported ? { unsupported: true } : {}),
    };
  });

  // Rank by totalEV (supported actions only); mark best.
  const supported = actionEVs.filter((a) => !a.unsupported);
  if (supported.length > 0) {
    const bestEV = Math.max(...supported.map((a) => a.totalEV));
    for (const a of supported) {
      if (a.totalEV === bestEV) { a.isBest = true; break; }
    }
  }

  return actionEVs;
};

/**
 * Compute value-vs-beat ratio for bluff-catch / thin-value variants.
 * Splits the decomposition into "hero beats" (relation ∈ {favored, dominating})
 * and "hero loses to" (relation ∈ {crushed, dominated}) weight totals.
 *
 * For bluff-catch: `valueWeight` is villain's value region; `bluffOrPayWeight`
 * is the bluff region (hero beats these).
 * For thin-value: `valueWeight` is hands that beat hero; `bluffOrPayWeight`
 * is hands hero beats (villain calls with worse).
 *
 * Returns null when decomposition is empty or all groups are neutral.
 */
export const computeValueBeatRatio = (decomposition) => {
  if (!Array.isArray(decomposition) || decomposition.length === 0) return null;
  let valueWeight = 0;
  let bluffOrPayWeight = 0;
  for (const group of decomposition) {
    if (group.relation === 'crushed' || group.relation === 'dominated') {
      valueWeight += group.weightPct;
    } else if (group.relation === 'favored' || group.relation === 'dominating') {
      bluffOrPayWeight += group.weightPct;
    }
    // neutral groups contribute to neither side
  }
  if (valueWeight === 0 && bluffOrPayWeight === 0) return null;
  const ratio = bluffOrPayWeight > 0 ? valueWeight / bluffOrPayWeight : Infinity;
  return { valueWeight, bluffOrPayWeight, ratio };
};

/**
 * v2 orchestrator for bucket-ev-panel-v2. Single-villain (HU) scope in v1
 * ship; multi-villain support via `perVillainDecompositions` is a future
 * extension blocked on LSW-G6.
 *
 * @param {{
 *   nodeId: string,
 *   lineId: string,
 *   street: 'flop' | 'turn' | 'river',
 *   board: number[],              // encoded cards (3-5)
 *   pot: number,
 *   effStack?: number,
 *   villains: Array<{ position: string, baseRange: Float64Array }>,
 *   heroView: { kind: 'single-combo' | 'combo-set' | 'range-level', combos?: Array<{card1, card2}> | Array<string>, ... },
 *   decisionKind?: 'standard' | 'bluff-catch' | 'thin-value',
 *   actionHistory?: Array<object>,
 *   heroActions: Array<{ label: string, kind: string, betFraction?: number }>,
 *   decisionStrategy?: 'pure' | 'mixed',
 *   archetype: 'reg' | 'fish' | 'pro',
 *   mcTrials?: number,
 *   timeBudgetMs?: number,
 * }} input
 * @returns {Promise<{
 *   decomposition: Array<object>,
 *   actionEVs: Array<object>,
 *   recommendation: { actionLabel: string, authoredReason?: string, templatedReason?: string },
 *   valueBeatRatio: object | null,
 *   streetNarrowing: Array<object> | null,
 *   confidence: { mcTrials: number, populationPriorSource: string, archetype: string, caveats: string[] },
 *   perVillainDecompositions: Array | null,
 *   cascadingFoldProbability: number | null,
 *   errorState: object | null,
 * }>}
 */
export const computeBucketEVsV2 = async (input) => {
  const startTime = Date.now();
  // Validate the minimum required fields. Fail fast with errorState so the
  // panel renders a banner (P1 F03 rule) rather than crashing.
  if (!input || typeof input !== 'object') {
    return bucketEVsV2Error('engine-internal', 'Missing input object', 'input is null/undefined');
  }
  const { board, pot, villains, heroView, heroActions, archetype, decisionKind = 'standard',
          mcTrials = 500, timeBudgetMs = 400, actionHistory = null } = input;

  if (!Array.isArray(board) || board.length < 3 || board.length > 5) {
    return bucketEVsV2Error('malformed-hero', 'Board must have 3-5 cards',
      `board was ${JSON.stringify(board)}`);
  }
  if (!Number.isFinite(pot) || pot < 0) {
    return bucketEVsV2Error('engine-internal', 'Invalid pot',
      `pot was ${pot} (expected non-negative finite number)`);
  }
  if (!Array.isArray(villains) || villains.length === 0) {
    return bucketEVsV2Error('range-unavailable', 'No villain in input',
      'villains array was empty or missing');
  }
  if (villains.length > 1) {
    // MW path deferred to LSW-G6. Not a panel-blocking error — surface a
    // structured message so the panel can render the cascading-deferred
    // banner without routing through the error path.
    return bucketEVsV2Error('engine-internal', 'Multiway not yet supported',
      `villains.length was ${villains.length}; MW engine is LSW-G6`,
      'Wait for LSW-G6 multiway engine to ship, or use an HU line.');
  }
  if (!heroView || !['single-combo', 'combo-set', 'range-level'].includes(heroView.kind)) {
    return bucketEVsV2Error('malformed-hero', 'heroView.kind invalid',
      `heroView was ${JSON.stringify(heroView)}`);
  }
  if (!Array.isArray(heroActions) || heroActions.length === 0) {
    return bucketEVsV2Error('engine-internal', 'heroActions empty',
      'heroActions array missing or empty');
  }
  if (!isKnownArchetype(archetype)) {
    return bucketEVsV2Error('engine-internal', 'Unknown archetype',
      `archetype was '${archetype}'`);
  }

  // v1 ship: single-combo heroView supported. combo-set and range-level stub
  // with errorState (implemented in v1.1 + v1.1 respectively).
  if (heroView.kind !== 'single-combo') {
    return bucketEVsV2Error('engine-internal', `heroView.kind '${heroView.kind}' not yet supported`,
      'single-combo is the only v1-ship mode; combo-set and range-level are v1.1+',
      'Use heroView.kind = "single-combo" for now.');
  }

  const pinnedCombo = heroView.combos?.[0];
  if (!pinnedCombo || !Number.isFinite(pinnedCombo.card1) || !Number.isFinite(pinnedCombo.card2)) {
    return bucketEVsV2Error('malformed-hero', 'Pinned combo invalid',
      `heroView.combos[0] was ${JSON.stringify(pinnedCombo)}`);
  }

  const villain = villains[0];
  if (!villain.baseRange) {
    return bucketEVsV2Error('range-unavailable', 'Villain range missing',
      `villains[0].baseRange is not set`);
  }

  // 1. Compute decomposition (per-group equity + weight + relation).
  let decomposition;
  try {
    const map = await computeDominationMap({
      pinnedCombo,
      villainRange: villain.baseRange,
      board,
      trialsPerGroup: Math.min(Math.floor(mcTrials / 2), 500),
    });
    if (!map) {
      return bucketEVsV2Error('engine-internal', 'Domination map could not be computed',
        'computeDominationMap returned null — check input validity');
    }
    decomposition = map.map((g) => ({
      groupId: g.id,
      groupLabel: g.label,
      weightPct: g.weightPct,
      heroEquity: g.equity,
      heroEquityCI: {
        low: Math.max(0, g.equity - 0.05),
        high: Math.min(1, g.equity + 0.05),
        method: 'mc',
      },
      relation: g.relation,
      comboCount: g.sampleSize,
    }));
  } catch (err) {
    return bucketEVsV2Error('engine-internal', 'Domination map threw',
      err.message || String(err), 'Retry · Check line authoring');
  }

  // Time budget check — depth-2 integration respects this in a later commit.
  // v1 just logs a soft caveat if we're over.
  const caveats = ['synthetic-range', 'v1-simplified-ev'];
  if (Date.now() - startTime > timeBudgetMs) {
    caveats.push('time-budget-soft');
  }

  // 2. Compute per-action EVs from the decomposition.
  const actionEVs = computeDecomposedActionEVs({
    decomposition,
    heroActions,
    pot,
  });

  // 3. Pick the best supported action. Template a one-line reason by
  // decisionKind. Authored reasons (line content) override templates at
  // render time (see v2 spec recommendation field).
  const best = actionEVs.find((a) => a.isBest) || actionEVs[0];
  const templatedReason = templateReasonForAction(best, decisionKind);

  // 4. valueBeatRatio — only populated for bluff-catch / thin-value.
  const valueBeatRatio = (decisionKind === 'bluff-catch' || decisionKind === 'thin-value')
    ? computeValueBeatRatio(decomposition)
    : null;

  // 5. streetNarrowing — ordered array of narrowing events (axis 5). v1 ship
  // emits the array only when `actionHistory` is present. Actual range
  // narrowing is applied by the caller-upstream (content layer); engine
  // surfaces the audit trail.
  let streetNarrowing = null;
  if (Array.isArray(actionHistory) && actionHistory.length > 0) {
    streetNarrowing = actionHistory.map((e) => ({
      street: e.street,
      actor: e.actor,
      action: e.action,
      sizing: e.sizing,
      narrowingSpec: e.narrowingSpec || { kind: 'keep-continuing-vs-action' },
      // priorWeight / narrowedWeight filled once the narrower engine ships;
      // placeholder values keep the shape stable for panel consumers.
      priorWeight: 100,
      narrowedWeight: 100,
    }));
  }

  return {
    decomposition,
    actionEVs,
    recommendation: {
      actionLabel: best?.actionLabel ?? '',
      templatedReason,
      // authoredReason undefined; content layer sets when node authors it.
    },
    valueBeatRatio,
    streetNarrowing,
    confidence: {
      mcTrials,
      populationPriorSource: 'GROUP_CALL_RATES + archetypeRangeBuilder',
      archetype,
      caveats,
    },
    perVillainDecompositions: null, // MW deferred to LSW-G6
    cascadingFoldProbability: null,
    errorState: null,
  };
};

/**
 * Helper to produce a uniform error return. Fills the rest of the
 * `ComputeBucketEVsV2Output` shape with null/empty so consumers can
 * safely access any field without branching on errorState first.
 */
const bucketEVsV2Error = (kind, userMessage, diagnostic, recovery = null) => ({
  decomposition: [],
  actionEVs: [],
  recommendation: { actionLabel: '', templatedReason: '' },
  valueBeatRatio: null,
  streetNarrowing: null,
  confidence: {
    mcTrials: 0,
    populationPriorSource: '',
    archetype: '',
    caveats: [],
  },
  perVillainDecompositions: null,
  cascadingFoldProbability: null,
  errorState: { kind, userMessage, diagnostic, ...(recovery ? { recovery } : {}) },
});

/**
 * Templated one-line reason for the best action, shaped by `decisionKind`.
 * Authored reasons in line content take precedence at render time; this
 * is the fallback when no authored copy exists.
 */
const templateReasonForAction = (best, decisionKind) => {
  if (!best || best.unsupported) {
    return '';
  }
  const label = best.actionLabel;
  const ev = best.totalEV.toFixed(2);
  if (decisionKind === 'bluff-catch') {
    return `Correct: ${label}. Your hand beats villain's bluff region and loses to the value region — the math works as a call-or-fold decision (+${ev}bb).`;
  }
  if (decisionKind === 'thin-value') {
    return `Correct: ${label}. Villain's range contains more hands that beat you than hands that pay — ${label} is the traceable answer at +${ev}bb.`;
  }
  // standard
  return `Correct: ${label} at +${ev}bb — weighted across villain's decomposition, this is the highest-EV option.`;
};
