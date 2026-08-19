/**
 * enrichDecisions — everything that has to happen to a loaded decision BEFORE it is induced on.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS IS A MODULE, AND NOT A BLOCK INSIDE THE PROCEDURE.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * It used to live inside `profileVillain`, and its own docstring said the point of filling
 * strength before induction was that *"the inducer and the leaf dumps both see them"*. The leaf
 * dumps never did. `dumpLeaf` loads, induces, and writes — it never ran this step — so its rows
 * carried empty `str_*` columns and the inducer split them differently.
 *
 * The consequence is worse than a cosmetic difference, because of what the leaves are FOR. A
 * leaf dump is the brief handed to an agent that is asked to explain a spot, and `buildDossier`
 * matches that explanation back to a rule by its condition string. Measured on villain 2: of
 * nine rules requiring an explanation, four had no leaf with the same population at all, and two
 * pairs of different rules collided onto one file. So the gate that refuses to ship an
 * unexplained rule could be satisfied by an explanation of a DIFFERENT spot — a check that
 * passes while the thing it checks is wrong, which is the failure mode every gate here exists
 * to prevent.
 *
 * One enrichment, two callers, and the leaves are the dossier's leaves by construction. Same
 * argument as `loadVillain`: four call sites and one of them wrong is a copy problem.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT IT ADDS, IN ORDER, BECAUSE EACH STEP NEEDS THE ONE BEFORE IT.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 *   1. THE ASSUMED HALF OF HAND STRENGTH. The labeller already computed the EXACT arm — big
 *      blind in a limped pot, where his range is every hand and the board is the whole answer.
 *      This arm needs his MEASURED entry widths, which only exist after a full pass over his
 *      hands, so it cannot happen in the labeller. Widths are measured from his own decisions;
 *      only the ORDERING that fills them is a convention, and every row it touches is stamped
 *      `assumed` so the two arms can never be pooled by accident.
 *
 *   2. BACK-PROPAGATION — what the new card DID to his range, not merely what his range is.
 *      FOUNDER, 2026-08-19: *"nut changing turns and rivers when draws being made being a
 *      completely different situation"*, and *"back propogated"*. A distribution read one street
 *      at a time cannot see the event that matters: a turn completing the flush changes his
 *      range ASYMMETRICALLY. The quantity is the DELTA, and it exists only once the streets of
 *      one hand are joined. Deltas are computed against the previous street OF THE SAME HAND,
 *      never against a pooled average — two decisions on different boards share no baseline.
 *
 *   3. TERMINAL-ACTION INFERENCE, which needs both of the above.
 */
import { strengthAt } from './handStrength.mjs';
import { fillToWidth } from './buildRangeCharts.mjs';
import { annotate } from './rangeInference.mjs';

const STREET_ORDER = { flop: 0, turn: 1, river: 2 };

/**
 * His measured entry width per spot, as a function that hands back a filled range for one
 * decision. Below 25 observations the spot yields nothing rather than a shape fitted to noise.
 */
const entryWidthOf = (decisions) => {
  const bucket = new Map();
  const add = (key, hit) => {
    if (!bucket.has(key)) bucket.set(key, { k: 0, n: 0 });
    const b = bucket.get(key); b.n++; if (hit) b.k++;
  };
  for (const d of decisions) {
    if (d.street !== 'preflop') continue;
    if (d.firstIn === true && d.canRaise) add(`open-${d.position}@${d.seatsDealt}`, d.action === 'raise');
    else if (d.raisesFaced === 1) add('vs-raise', d.action === 'call' || d.action === 'raise');
    else if (d.raisesFaced === 0 && (d.limpersAhead ?? 0) > 0) add('iso', d.action !== 'fold');
  }
  const eqKey = (pos) => (pos === 'SB' ? 'SB' : pos === 'BB' ? 'BB'
    : (pos === 'BTN' || pos === 'CO') ? 'LATE' : pos === 'HJ' ? 'MIDDLE' : 'EARLY');
  return (d) => {
    const key = d.iAmLastPreflopAggressor ? `open-${d.position}@${d.seatsDealt}` : 'vs-raise';
    const b = bucket.get(key) || bucket.get('vs-raise');
    if (!b || b.n < 25 || !b.k) return null;
    return { cells: fillToWidth(b.k / b.n, eqKey(d.position)).cells, basis: 'assumed' };
  };
};

/**
 * Mutates `decisions` in place — they are the same objects the caller induces on, and copying
 * them would reintroduce exactly the two-populations problem this module exists to close.
 *
 * @param {Array} decisions from `loadVillain`
 * @returns {{strengthFilled:number, deltasFilled:number, inference:Object}}
 */
export const enrichDecisions = (decisions) => {
  const entryWidth = entryWidthOf(decisions);

  let strengthFilled = 0;
  for (const d of decisions) {
    if (d.strength) continue;
    const s = strengthAt(d, entryWidth);
    if (s) { d.strength = s; strengthFilled++; }
  }

  const byHandStreet = new Map();
  for (const d of decisions) {
    if (!d.strength) continue;
    if (!byHandStreet.has(d.handId)) byHandStreet.set(d.handId, []);
    byHandStreet.get(d.handId).push(d);
  }
  let deltasFilled = 0;
  for (const rows of byHandStreet.values()) {
    rows.sort((a, b) => (STREET_ORDER[a.street] ?? 9) - (STREET_ORDER[b.street] ?? 9) || a.order - b.order);
    let prev = null;
    for (const d of rows) {
      if (prev && prev.street !== d.street && prev.strength.basis === d.strength.basis) {
        d.strengthDelta = {
          pct: +(d.strength.pctMean - prev.strength.pctMean).toFixed(2),
          value: +(d.strength.value - prev.strength.value).toFixed(4),
          draw: +(d.strength.realDraw - prev.strength.realDraw).toFixed(4),
          // A card that removes far more draw than it adds value is a BRICK for his range; one
          // that converts draw into value is a card that got there. The sign is the story.
          completed: (prev.strength.realDraw - d.strength.realDraw) > 0.05
            && (d.strength.value - prev.strength.value) > 0.02,
        };
        deltasFilled++;
      }
      if (prev === null || prev.street !== d.street) prev = d;
    }
  }

  const inference = annotate(decisions);
  return { strengthFilled, deltasFilled, inference };
};
