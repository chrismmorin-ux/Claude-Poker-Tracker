/**
 * archetypeRanges.js — canonical preflop ranges keyed by (position, action, vs?).
 *
 * These are the "given ranges" the postflop drill assumes. The drill stops
 * before player behavior modeling: it asks "given this standard range, how
 * does it connect to this flop?" not "given THIS player, what range?"
 *
 * Source baselines: GTO Wizard / PokerCoaching 9-max cash 100bb. Exact chart
 * composition is not the test — the scenarioValidator only asserts numeric
 * claims that flow from whatever grid we return, so drift in a range's
 * composition moves the numbers but never breaks truth.
 *
 * ───────────────────────────────────────────────────────────────────
 * DIVERGENCE FROM `rangeEngine/populationPriors.js` (INTENTIONAL)
 * ───────────────────────────────────────────────────────────────────
 * `rangeEngine/populationPriors.js` defines BAYESIAN PRIORS — probabilistic
 * per-hand weights for a typical live-1/2 player in a given position, used
 * as the starting point for Bayesian updates from observed actions. Those
 * are population averages with soft weights.
 *
 * This file defines PEDAGOGICAL ARCHETYPES — deterministic ranges for
 * specific preflop contexts (BB flat vs BTN open, CO 3bet vs MP open, etc.)
 * that a coaching tool would call canonical. They're used only by the
 * postflop drill to set up teaching scenarios. They're not Bayesian priors
 * and they're not consumed by the exploit/range engines.
 *
 * Keeping these separate is deliberate: the engines' priors are tuned for
 * inference; the drill's archetypes are tuned for teaching. Merging them
 * would couple two distinct calibration loops.
 *
 * Pure module — no state, no network, no async.
 */

import { PREFLOP_CHARTS, parseRangeString, createRange } from '../pokerCore/rangeMatrix';

// ---------- Named preset ranges ----------

// Cold-call ranges vs a specific opener (defender's flat range, no 3bet portion)
// Reasonable live 100bb baselines — premiums and some broadway/suited connector
// hands that flat rather than 3bet in position. Keys use PREFLOP_CHARTS names
// (UTG, UTG+1, MP1, MP2, HJ, CO, BTN, SB, BB).
const CALL_RANGES = {
  // BB defending vs various opens (widest caller of all positions)
  'BB_vs_UTG':    '22-JJ,A2s-AJs,K9s+,Q9s+,J9s+,T8s+,97s+,86s+,75s+,64s+,54s,ATo-AQo,KTo+,QTo+,JTo,T9o',
  'BB_vs_UTG+1':  '22-JJ,A2s-AJs,K9s+,Q9s+,J9s+,T8s+,97s+,86s+,75s+,64s+,54s,ATo-AQo,KTo+,QTo+,JTo,T9o',
  'BB_vs_MP1':    '22-JJ,A2s-AJs,K8s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,64s+,53s+,43s,A8o-AQo,K9o+,Q9o+,J9o+,T9o,98o',
  'BB_vs_MP2':    '22-JJ,A2s-AJs,K8s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,64s+,53s+,43s,A8o-AQo,K9o+,Q9o+,J9o+,T9o,98o',
  'BB_vs_HJ':     '22-JJ,A2s-AJs,K7s+,Q8s+,J8s+,T8s+,97s+,86s+,75s+,64s+,53s+,43s,A6o-AQo,K8o+,Q9o+,J9o+,T9o,98o',
  'BB_vs_CO':     '22-JJ,A2s-AJs,K5s+,Q7s+,J7s+,T7s+,96s+,86s+,75s+,64s+,53s+,43s,A5o-AQo,K8o+,Q8o+,J8o+,T8o+,97o+,87o',
  'BB_vs_BTN':    '22-JJ,A2s-AJs,K2s+,Q4s+,J6s+,T6s+,96s+,85s+,74s+,63s+,53s+,42s+,32s,A2o-AQo,K5o+,Q7o+,J7o+,T7o+,97o+,86o+,75o+,65o',
  'BB_vs_SB':     '22-JJ,A2s-AJs,K2s+,Q2s+,J2s+,T5s+,95s+,84s+,74s+,63s+,53s+,42s+,32s,A2o-AQo,K2o+,Q5o+,J7o+,T7o+,96o+,86o+,75o+,65o',
  // BTN cold-call vs CO open (mixed strategy — mostly pairs + suited hands)
  'BTN_vs_CO':    '22-JJ,ATs-AQs,A5s,KTs+,QTs+,J9s+,T9s,98s,87s,76s,65s,ATo+,KJo+,QJo',
  'BTN_vs_HJ':    '22-JJ,ATs-AQs,A5s,KTs+,QTs+,J9s+,T9s,98s,87s,76s,ATo+,KJo+,QJo',
  'BTN_vs_MP1':   '22-TT,ATs-AJs,KTs+,QTs+,JTs,T9s,98s,87s,76s,AJo-AQo,KQo',
  'BTN_vs_MP2':   '22-TT,ATs-AJs,KTs+,QTs+,JTs,T9s,98s,87s,76s,AJo-AQo,KQo',
  // SB flat vs BTN (rare — mostly 3bet or fold; narrow call range)
  'SB_vs_BTN':    '22-JJ,ATs-AQs,A5s-A2s,KTs+,QTs+,JTs,T9s,98s,AJo-AQo',
  // BTN calling a BB 3-bet (used by the btn-vs-bb-3bp-ip-wet-t96 line).
  // Semantically a "call-of-3bet" range rather than cold-call; kept in the
  // same table for v1 to avoid a schema expansion. Excludes the 4bet portion
  // (AKs, AKo, QQ+ 4bet instead) and the true junk that folds.
  'BTN_vs_BB':    '22-JJ,ATs-AQs,A5s-A4s,KTs+,QTs+,JTs,T9s,98s,AJo-AQo,KQo',
};

// 3bet ranges (in-position and out-of-position) — linear + polar mix
// Value portion: top pairs + premium broadways; bluff portion: blocker hands
const THREEBET_RANGES = {
  'BB_vs_BTN':    'TT+,AJs+,KQs,A5s-A2s,AQo+,KQo',
  'BB_vs_CO':     'TT+,AJs+,KQs,A5s-A3s,AQo+',
  'BB_vs_MP1':    'JJ+,AKs,AQs,AKo',
  'BB_vs_MP2':    'JJ+,AKs,AQs,AKo',
  'BB_vs_HJ':     'JJ+,AKs,AQs,AKo',
  'BB_vs_UTG':    'QQ+,AKs,AKo',
  'BB_vs_UTG+1':  'QQ+,AKs,AKo',
  'BTN_vs_CO':    'TT+,AQs+,A5s-A4s,AQo+',
  'BTN_vs_HJ':    'TT+,AQs+,A5s-A4s,AQo+',
  'BTN_vs_MP1':   'JJ+,AKs,AQs,AKo',
  'BTN_vs_MP2':   'JJ+,AKs,AQs,AKo',
  'SB_vs_BTN':    'TT+,AJs+,KQs,A5s-A3s,AJo+,KQo',
  'CO_vs_MP1':    'JJ+,AQs+,AKo',
  'CO_vs_MP2':    'JJ+,AQs+,AKo',
  'CO_vs_HJ':     'JJ+,AQs+,AKo',
  'MP1_vs_UTG':   'QQ+,AKs,AKo',
  'MP2_vs_UTG':   'QQ+,AKs,AKo',
};

// 4bet ranges (narrower — value + a few blocker bluffs)
const FOURBET_RANGES = {
  'UTG_vs_MP1':   'KK+,AKs',
  'UTG_vs_MP2':   'KK+,AKs',
  'UTG_vs_BB':    'QQ+,AKs,AKo',
  'CO_vs_BTN':    'QQ+,AKs,A5s',
  'BTN_vs_BB':    'QQ+,AKs,A5s,AKo',
};

// ---------- Position normalization ----------

const POSITION_ALIASES = {
  EP: 'UTG', UTG0: 'UTG', UTG1: 'UTG+1',
  MP: 'MP1', LJ: 'MP2',
  LATE: 'BTN',
};

const normPosition = (pos) => POSITION_ALIASES[pos] || pos;

// ---------- Public API ----------

/**
 * Resolve a preflop context into a weighted range grid.
 *
 * @param {Object} ctx
 * @param {string} ctx.position         — e.g. 'BTN', 'UTG', 'BB'
 * @param {('open'|'call'|'threeBet'|'fourBet'|'limp')} ctx.action
 * @param {string} [ctx.vs]              — opposing position (needed for call/3bet/4bet)
 * @returns {Float64Array} 169-cell range grid (0..1 weights)
 *
 * Throws if the combination has no defined archetype. This is intentional —
 * the drill's content curation should only reference combos with ranges.
 */
export const archetypeRangeFor = ({ position, action, vs } = {}) => {
  if (!position || !action) {
    throw new Error(`archetypeRangeFor: position and action are required`);
  }
  const pos = normPosition(position);
  const opp = vs ? normPosition(vs) : null;

  if (action === 'open') {
    const chart = PREFLOP_CHARTS[pos];
    if (!chart) throw new Error(`No open chart for position ${position}`);
    // Return a copy — callers should not mutate shared chart instances.
    const out = createRange();
    out.set(chart);
    return out;
  }

  if (action === 'limp') {
    // Approximate limp range — small pairs + suited broadways + suited connectors.
    // Conservative live 1/2 limp shape.
    return parseRangeString('22-88,A2s-A9s,KTs+,QTs+,JTs,T9s,98s,87s,76s,KJo,QJo');
  }

  const key = opp ? `${pos}_vs_${opp}` : null;
  if (action === 'call') {
    const str = CALL_RANGES[key];
    if (!str) throw new Error(`No call range for ${key}`);
    return parseRangeString(str);
  }
  if (action === 'threeBet') {
    const str = THREEBET_RANGES[key];
    if (!str) throw new Error(`No 3bet range for ${key}`);
    return parseRangeString(str);
  }
  if (action === 'fourBet') {
    const str = FOURBET_RANGES[key];
    if (!str) throw new Error(`No 4bet range for ${key}`);
    return parseRangeString(str);
  }

  throw new Error(`archetypeRangeFor: unknown action '${action}'`);
};

/**
 * List every (position, action, vs?) context we have an archetype for.
 * Used by the Explorer UI to populate dropdowns and by the validator test
 * to iterate every defined preset.
 *
 * @returns {Array<{ position, action, vs?, label }>}
 */
export const listArchetypeContexts = () => {
  const out = [];

  for (const position of Object.keys(PREFLOP_CHARTS)) {
    out.push({ position, action: 'open', label: `${position} open` });
  }

  const pushKey = (key, action, verb) => {
    const [pos, vs] = key.split('_vs_');
    out.push({ position: pos, action, vs, label: `${pos} ${verb} vs ${vs}` });
  };

  for (const k of Object.keys(CALL_RANGES))     pushKey(k, 'call',      'call');
  for (const k of Object.keys(THREEBET_RANGES)) pushKey(k, 'threeBet',  '3bet');
  for (const k of Object.keys(FOURBET_RANGES))  pushKey(k, 'fourBet',   '4bet');

  return out;
};

/**
 * Produce a short label for a context — used on chips/cards in the UI.
 */
export const contextLabel = ({ position, action, vs } = {}) => {
  if (!position || !action) return '—';
  if (action === 'open') return `${position} open`;
  if (action === 'limp') return `${position} limp`;
  const verb = action === 'threeBet' ? '3bet'
            : action === 'fourBet'  ? '4bet'
            : action;
  return vs ? `${position} ${verb} vs ${vs}` : `${position} ${verb}`;
};
