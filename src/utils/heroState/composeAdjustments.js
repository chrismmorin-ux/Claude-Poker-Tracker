/**
 * @file HSP-X1 — Adjustment composition rule (SPR-105 / WS-155).
 *
 * Resolves docs/HERO_STATE_DESIGN.md §7.2 open question: how do tendency-
 * adjusted deltas compose when multiple villain tendencies fire on the same
 * hero decision (e.g., "calling station AND short-stacked")?
 *
 * Per-axis composition rules, with poker-theory rationale:
 *
 *   sizingMultiplier — MULTIPLICATIVE WITH CLAMP [0.6, 2.0]
 *     Sizing changes compound when multiple tendencies point the same
 *     direction (calling-station + over-folds-river → larger value sizing).
 *     The clamp prevents the model leaving its locally-linear regime: above
 *     2× pot the fold-to-bet curve is bimodal (snap-fold or snap-call); below
 *     0.6× the hand should generally check rather than block-bet for an
 *     ill-defined reason. 2.0 ceiling derives from POKER_THEORY §3.5
 *     (polarization breaks at overbet); 0.6 floor matches the RIVER_BLOCK_BET
 *     threshold (HERO_STATE_DESIGN §4.5.1). When the clamp engages, the
 *     output is flagged `clamped: true` so consumers can surface the cap.
 *
 *   polarize — OR (any-fires-wins)
 *     Polarization is a range-construction decision, not an intensity dial.
 *     If ANY tendency creates a structural reason to polarize (sticky caller,
 *     capped range, asymmetric fold-equity), polarized construction wins —
 *     there's no symmetric "anti-polarize" force that would cancel it.
 *
 *   bluffFreq — MIN-WINS (most-conservative)
 *     Bluffing has asymmetric loss: a false-positive bluff into a sticky
 *     player costs ~pot; a false-negative (failing to bluff) costs ~edge.
 *     The asymmetric loss function calls for "conservative under uncertainty"
 *     — when one signal says "villain calls too much" and another says
 *     "villain folds too much," the calling-station signal must dominate
 *     because its worst-case error is larger. Direct application of
 *     minimax-regret reasoning, not arbitrary preference.
 *
 *   actionOverride — PRECEDENCE-BY-SEVERITY, CONSERVATISM TIEBREAK
 *     actionOverride is the most consequential adjustment — it discards the
 *     gameTree's primary recommendation. Only the strongest-confidence
 *     tendency should be allowed to overrule the equity-grounded plan.
 *     Conservatism tiebreak: under genuine model uncertainty, the less-
 *     aggressive action has lower max-regret (folding back to a checked-down
 *     spot is recoverable; an erroneous raise commits chips).
 *
 * First-principles guard (POKER_THEORY §7 + exploitEngine/CLAUDE.md):
 * composition rules derive from poker-theory rationale (asymmetric loss,
 * minimax-regret, locally-linear regime bounds) — NOT from code convenience.
 * archetypeId remains OUTPUT-only; composedDelta is itself an OUTPUT of
 * composition over Adjustment[]. Never an input to plan computation.
 */

// Clamp bounds for sizingMultiplier composition. See §7.2 resolution +
// HERO_STATE_DESIGN §4.5.1 for the 0.6/2.0 derivation.
export const SIZING_MULTIPLIER_FLOOR = 0.6;
export const SIZING_MULTIPLIER_CEILING = 2.0;

// Conservatism order for actionOverride tiebreak (least → most aggressive).
// Lower index wins when severity ties.
const ACTION_CONSERVATISM_RANK = {
  fold: 0,
  check: 1,
  call: 2,
  bet: 3,
  raise: 4,
};

const conservatismRank = (action) => {
  const a = String(action || '').toLowerCase();
  return ACTION_CONSERVATISM_RANK[a] ?? 99;
};

/**
 * Compose sizingMultiplier across firing adjustments.
 *
 * @param {Array<object>} adjustments - Adjustment[] with delta.sizingMultiplier on some entries.
 * @returns {{ value: number, clamped: boolean }} - value is the (possibly clamped) product; clamped is true when ceiling/floor engaged.
 */
export const composeSizingMultiplier = (adjustments) => {
  if (!Array.isArray(adjustments) || adjustments.length === 0) {
    return { value: 1.0, clamped: false };
  }
  let product = 1.0;
  let firings = 0;
  for (const a of adjustments) {
    const m = a?.delta?.sizingMultiplier;
    if (typeof m === 'number' && Number.isFinite(m) && m > 0) {
      product *= m;
      firings += 1;
    }
  }
  if (firings === 0) return { value: 1.0, clamped: false };
  if (product > SIZING_MULTIPLIER_CEILING) {
    return { value: SIZING_MULTIPLIER_CEILING, clamped: true };
  }
  if (product < SIZING_MULTIPLIER_FLOOR) {
    return { value: SIZING_MULTIPLIER_FLOOR, clamped: true };
  }
  return { value: product, clamped: false };
};

/**
 * Compose polarize flag across firing adjustments (OR).
 *
 * @param {Array<object>} adjustments
 * @returns {boolean}
 */
export const composePolarize = (adjustments) => {
  if (!Array.isArray(adjustments)) return false;
  return adjustments.some((a) => a?.delta?.polarize === true);
};

/**
 * Compose bluffFreq across firing adjustments (MIN-wins, ignoring null/undefined).
 *
 * @param {Array<object>} adjustments
 * @returns {number|null} - null when no adjustment specifies bluffFreq.
 */
export const composeBluffFreq = (adjustments) => {
  if (!Array.isArray(adjustments)) return null;
  let min = null;
  for (const a of adjustments) {
    const f = a?.delta?.bluffFreq;
    if (typeof f === 'number' && Number.isFinite(f) && f >= 0 && f <= 1) {
      if (min === null || f < min) min = f;
    }
  }
  return min;
};

/**
 * Compose actionOverride across firing adjustments.
 *
 * Precedence by severity (higher severity wins). Tiebreak by conservatism
 * (lower-aggression action wins when severity ties — minimax-regret).
 *
 * @param {Array<object>} adjustments - Each may carry severity/confidence + delta.actionOverride.
 * @returns {string|null}
 */
export const composeActionOverride = (adjustments) => {
  if (!Array.isArray(adjustments)) return null;
  const candidates = [];
  for (const a of adjustments) {
    const override = a?.delta?.actionOverride;
    if (typeof override === 'string' && override.length > 0) {
      const severity = typeof a.severity === 'number' ? a.severity
        : typeof a.confidence === 'number' ? a.confidence
          : 0;
      candidates.push({ action: override, severity });
    }
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    if (b.severity !== a.severity) return b.severity - a.severity;
    // Tiebreak: lower conservatism rank wins (more conservative action).
    return conservatismRank(a.action) - conservatismRank(b.action);
  });
  return candidates[0].action;
};

/**
 * Compose an array of Adjustment[] into a single ComposedDelta.
 *
 * Per-axis rules (see file header for poker-theory derivations):
 *   - sizingMultiplier: multiplicative with clamp [0.6, 2.0] + clamped flag
 *   - polarize: OR
 *   - bluffFreq: MIN-wins (null when none specify)
 *   - actionOverride: precedence-by-severity, conservatism tiebreak
 *
 * Returns a shape stable across degraded states: empty adjustments[] yields
 * `{ sizingMultiplier: 1.0, polarize: false, bluffFreq: null, actionOverride: null, clamped: false, contributingCount: 0 }`.
 *
 * @param {Array<object>} adjustments - From buildAdjustments() in buildHeroState.
 * @returns {{
 *   sizingMultiplier: number,
 *   polarize: boolean,
 *   bluffFreq: number|null,
 *   actionOverride: string|null,
 *   clamped: boolean,
 *   contributingCount: number,
 * }}
 */
export const composeAdjustments = (adjustments) => {
  const list = Array.isArray(adjustments) ? adjustments : [];
  // contributingCount: adjustments whose delta has at least one numeric/flag field set.
  let contributingCount = 0;
  for (const a of list) {
    const d = a?.delta;
    if (!d || typeof d !== 'object') continue;
    if (
      (typeof d.sizingMultiplier === 'number' && Number.isFinite(d.sizingMultiplier))
      || d.polarize === true
      || (typeof d.bluffFreq === 'number' && Number.isFinite(d.bluffFreq))
      || (typeof d.actionOverride === 'string' && d.actionOverride.length > 0)
    ) {
      contributingCount += 1;
    }
  }
  const sizing = composeSizingMultiplier(list);
  return {
    sizingMultiplier: sizing.value,
    polarize: composePolarize(list),
    bluffFreq: composeBluffFreq(list),
    actionOverride: composeActionOverride(list),
    clamped: sizing.clamped,
    contributingCount,
  };
};
