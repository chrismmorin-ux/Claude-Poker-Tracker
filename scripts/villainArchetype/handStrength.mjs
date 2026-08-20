/**
 * handStrength — what his range can MAKE and what it can DRAW to, at every decision.
 *
 * FOUNDER, 2026-08-19: *"HIS HAND STRENGTH MATTERS, and we can calculate the combinatorics for
 * it."* Then, on the first version: *"We need to add in the backdoor flush draws, runner runner
 * straight draws, and differentiate between gutshots and double gutshots and when the villain is
 * drawing to the top end of a straight or the bottom. These differences matter and affect villain
 * betting and calling patterns. AND reflect that bottom pair beats a draw because its a made
 * hand."*
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * TWO DIMENSIONS, NOT ONE LADDER. This is the correction that mattered most.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The first version returned ONE tier per combo, so bottom pair and a flush draw competed for
 * the same slot and whichever the code checked first won. That is not how a hand works. A hand
 * has a made class and, independently, a draw — and the pair-plus-draw combination is among the
 * strongest things in hold'em while being invisible to a single ladder. Bottom pair with no draw
 * outranks a naked draw at showdown because it is already a hand; a naked draw outranks it in
 * equity with cards to come. A collapsed ladder has to lie about one of those.
 *
 * So `classify` returns `{ made, draw, nut, blocker }` and every share is reported on its own
 * axis. Nothing is forced to rank against something it is not comparable to.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE CANONICAL AXIS IS THE PERCENTILE. The named classes are a LABEL LAYER on top of it.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * FOUNDER, 2026-08-19: *"we have canonical axis for hands and board strength don't we? the
 * always rising equity of any given hand? Why aren't we using this? Its our defined canonical
 * measure."*
 *
 * Right, and the first version of this file did not use it - it invented a second strength
 * vocabulary, which is the parallel-taxonomy failure this same session had already flagged
 * against `situationKey`. POKER_THEORY 15.1 settles it: the ordering is BOARD-CONDITIONAL and
 * no global monotone embedding exists (AK beats 22 on an ace-high board and loses to it on a
 * deuce-high one), but the PERCENTILE - rank within this board's own universe - is normalised
 * and therefore comparable across boards. 15.2 goes further and says the axis and the EV curve
 * are both already in the repo and "the pieces have simply never been joined."
 *
 * So `pct` below is `handEvaluator.comboStrengthPercentile`, verified to zero divergence, and it
 * is the backbone. The made/draw names remain because a percentile cannot tell you a hand is a
 * flush draw: the percentile ranks CURRENT showdown strength, so a naked nut-flush draw sits
 * near the bottom of it while being one of the best hands to hold. Draws are a second axis, not
 * a competing one.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE DRAW DETAIL EARNS ITS COST.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Each distinction below changes what a villain does, which is the only test that matters:
 *
 *   nut vs non-nut flush draw   the nut draw can stack off; the third-nut draw is the hand that
 *                               goes broke, and good players play them differently
 *   OESD vs double-gutshot      same eight outs, but the double-gutshot is disguised and its
 *                               completions do not look like straights to the opponent
 *   gutshot TOP vs BOTTOM end   drawing to the idiot end is a fold to a big bet and a call to a
 *                               small one; drawing to the nut end is the reverse
 *   backdoor flush / runner     the reason a hand continues on the flop with no made value at all
 *                               and the reason it can bet a turn that "changed nothing"
 *   ace blocker                 the hand that can bluff a completed flush, because it holds the
 *                               card the caller needs
 *
 * None of these existed in the schema, so none of the patterns keyed on them could be found.
 * Feeding the shares alongside the rest of the row is what lets an analyst find them
 * (founder: *"They will find it if it is included alongside the rest of the data."*).
 */
import { enumerateCombos, createRange, rangeIndex } from '../../src/utils/pokerCore/rangeMatrix.js';
import { bestFiveFromSeven, handCategory, computeBoardPercentileTable } from '../../src/utils/pokerCore/handEvaluator.js';
import { parseCard, encodeCard } from '../../src/utils/pokerCore/cardParser.js';

/** Made classes, strongest first. A made hand is never ranked against a draw. */
export const MADE = Object.freeze([
  'straight-plus', 'set-or-two-pair', 'overpair', 'top-pair', 'middle-pair', 'bottom-pair',
  'underpair', 'no-pair',
]);
/** Draw classes, strongest first. `none` includes hands with a made class and no draw. */
export const DRAWS = Object.freeze([
  'flush-draw', 'oesd', 'double-gutshot', 'gutshot', 'backdoor-flush', 'runner-straight', 'none',
]);

const VALUE_MADE = Object.freeze(['straight-plus', 'set-or-two-pair', 'overpair', 'top-pair']);
const REAL_DRAW = Object.freeze(['flush-draw', 'oesd', 'double-gutshot', 'gutshot']);
const BACKDOOR = Object.freeze(['backdoor-flush', 'runner-straight']);

const RANK_OF = (c) => Math.floor(c / 4);
const SUIT_OF = (c) => c % 4;

/** `parseCard` speaks the glyph alphabet directly — rewriting suits to letters breaks it. */
export const encodeCardStr = (c) => {
  const p = parseCard(c);
  return p ? encodeCard(p.rank, p.suit) : -1;
};

/** Every rank that would complete a 5-straight, using at least one of HIS cards. */
const straightOuts = (mine, boardRanks) => {
  const all = new Set([...mine, ...boardRanks]);
  const outs = new Set();
  for (let lo = -1; lo <= 8; lo++) {
    const window = [];
    for (let r = lo; r < lo + 5; r++) window.push(r === -1 ? 12 : r);
    const have = window.filter((r) => all.has(r));
    const missing = window.filter((r) => !all.has(r));
    // Four of the five present, and at least one of the four is his.
    if (have.length === 4 && have.some((r) => mine.has(r))) outs.add(missing[0]);
  }
  return outs;
};

/**
 * Four consecutive ranks held, using at least one of his cards.
 *
 * This is what separates an open-ender from a double gutshot, and the first version got it
 * wrong by testing the SPREAD OF THE OUTS instead: JT on 9-8-2 has outs Q and 7, five ranks
 * apart, and was called a double gutshot. It is the textbook open-ender. Both hands have eight
 * outs and they are not the same hand — the double gutshot's completions do not look like a
 * straight to the opponent, which is exactly why the distinction changes what a villain does.
 */
const fourConsecutive = (mine, boardRanks) => {
  const all = new Set([...mine, ...boardRanks]);
  if (all.has(12)) all.add(-1);                       // the ace plays low
  for (let lo = -1; lo <= 9; lo++) {
    let run = true; let usesMine = false;
    for (let r = lo; r < lo + 4; r++) {
      if (!all.has(r)) { run = false; break; }
      if (mine.has(r) || (r === -1 && mine.has(12))) usesMine = true;
    }
    if (run && usesMine) return true;
  }
  return false;
};

/** Three of a 5-window present with at least one of his — a runner-runner straight. */
const hasRunnerStraight = (mine, boardRanks) => {
  const all = new Set([...mine, ...boardRanks]);
  for (let lo = -1; lo <= 8; lo++) {
    const window = [];
    for (let r = lo; r < lo + 5; r++) window.push(r === -1 ? 12 : r);
    const have = window.filter((r) => all.has(r));
    if (have.length === 3 && have.some((r) => mine.has(r))) return true;
  }
  return false;
};

/** The high rank of a 5-window starting at `lo` (lo = -1 is the wheel, whose high is the five). */
const windowHigh = (lo) => (lo === -1 ? 3 : lo + 4);

/** Every 5-window, as {ranks, high}. Computed once; the ace plays both ends. */
const WINDOWS = (() => {
  const out = [];
  for (let lo = -1; lo <= 8; lo++) {
    const ranks = [];
    for (let r = lo; r < lo + 5; r++) ranks.push(r === -1 ? 12 : r);
    out.push({ ranks, high: windowHigh(lo) });
  }
  return out;
})();

/**
 * Does this out give him the BEST straight anyone could hold — the nut end?
 *
 * THE FIRST VERSION COMPARED HIS OUT TO HIS OWN OTHER OUTS, which answers nothing: it asked
 * "is this my higher end" when the question is "does anybody beat me when it lands". Measured
 * failure: 98 on Q-J-2 came back nut-end, but the ten gives him 8-9-T-J-Q while anyone holding
 * A-K has Broadway. He is drawing dead to the idiot end and the label said the opposite — which
 * inverts the read, because drawing to the nut end is a call to a big bet and drawing to the
 * idiot end is a fold to the same bet.
 *
 * The correct test: after the out lands, the best straight ANY two hole cards could make is the
 * highest window the board covers three of. His is the highest window the board plus his own two
 * cards covers entirely. He has the nuts only if those are equal.
 */
const outMakesNuts = (out, mine, boardRanks) => {
  const boardAfter = new Set([...boardRanks, out]);
  if (boardAfter.has(12)) boardAfter.add(-1);
  const withMine = new Set([...boardAfter, ...mine]);
  if (withMine.has(12)) withMine.add(-1);

  let hisHigh = -99;
  let anyHigh = -99;
  for (const w of WINDOWS) {
    // He needs the whole window between the board and his two cards.
    if (w.ranks.every((r) => withMine.has(r) || (r === 12 && withMine.has(-1)))) {
      hisHigh = Math.max(hisHigh, w.high);
    }
    // An opponent supplies at most two cards, so the board must already cover three.
    const covered = w.ranks.filter((r) => boardAfter.has(r)).length;
    if (covered >= 3) anyHigh = Math.max(anyHigh, w.high);
  }
  return hisHigh >= anyHigh;
};

/**
 * WHAT THE DRAW IS WORTH WHEN IT LANDS — and whether it is still second best when it does.
 *
 * FOUNDER, 2026-08-19: *"A villain who can improve to the nut straight behaves differently when
 * the nut straight is beaten by a flush. Or a draw to a full house on a flush draw, where the
 * villain could find himself with a hidden full house against an opponent who hit their A-high
 * flush, absolute cooler potential."*
 *
 * Knowing he holds a nut straight draw is not enough, because "nut straight" is only the nuts on
 * a board where nothing better completes. Three cases the taxonomy could not previously tell
 * apart, and they demand opposite play:
 *
 *   CLEAN     the draw lands and nothing on the board beats it. Stack off.
 *   VULNERABLE the draw lands and a better hand completes on the same card - a straight on a
 *             three-flush board, or anything on a paired board. This is the hand that pays off.
 *   COOLER    he is the one holding the redraw: a set or two pair when the flush completes makes
 *             a full house, and the opponent with the ace-high flush cannot fold. The money in
 *             this cell is not his draw's equity, it is the OPPONENT's confidence.
 *
 * Categorical rather than enumerated, deliberately. The exact version - re-score every combo on
 * every completed board - costs roughly 1,100 evaluations per out per decision and would not
 * finish; this reads the board's own structure, which is what a player reads.
 */
const boardRedrawRisk = (board) => {
  const suits = [0, 0, 0, 0]; const rankCount = new Map();
  for (const c of board) {
    suits[SUIT_OF(c)]++;
    rankCount.set(RANK_OF(c), (rankCount.get(RANK_OF(c)) || 0) + 1);
  }
  return {
    flushPossible: Math.max(...suits) >= 3,
    paired: [...rankCount.values()].some((n) => n >= 2),
  };
};

/**
 * Classify one combo against one board.
 * @returns {{made:string, draw:string, blocker:boolean}}
 */
export const classify = (c1, c2, board, boardRanksDesc) => {
  const cat = handCategory(bestFiveFromSeven([c1, c2, ...board]));
  const r1 = RANK_OF(c1); const r2 = RANK_OF(c2);
  const mine = new Set([r1, r2]);
  const distinct = [...new Set(boardRanksDesc)];

  // ── made class ────────────────────────────────────────────────────────────
  let made;
  if (cat !== 'High Card' && cat !== 'Pair') {
    made = (cat === 'Two Pair' || cat === 'Three of a Kind') ? 'set-or-two-pair' : 'straight-plus';
  } else {
    const hits = [r1, r2].filter((r) => distinct.includes(r));
    if (r1 === r2) {
      made = Math.max(r1, r2) > distinct[0] ? 'overpair' : 'underpair';
    } else if (hits.length) {
      const i = distinct.indexOf(Math.max(...hits));
      made = i === 0 ? 'top-pair' : (i === distinct.length - 1 ? 'bottom-pair' : 'middle-pair');
    } else {
      made = 'no-pair';
    }
  }

  // ── flush draws, and the ace blocker ──────────────────────────────────────
  const suits = [0, 0, 0, 0];
  for (const c of [c1, c2, ...board]) suits[SUIT_OF(c)]++;
  const boardSuits = [0, 0, 0, 0];
  for (const c of board) boardSuits[SUIT_OF(c)]++;
  const toCome = 5 - board.length;

  let draw = 'none';
  const fourSuit = suits.indexOf(4);
  const threeSuit = suits.indexOf(3);
  const usesHis = (s) => SUIT_OF(c1) === s || SUIT_OF(c2) === s;

  let nut = false;
  if (toCome >= 1 && fourSuit >= 0 && usesHis(fourSuit)) {
    draw = 'flush-draw';
    const aceOfSuit = encodeCard(12, fourSuit);
    nut = (c1 === aceOfSuit || c2 === aceOfSuit);
  }

  // ── straight draws ────────────────────────────────────────────────────────
  if (draw === 'none' && toCome >= 1) {
    const outs = straightOuts(mine, boardRanksDesc);
    if (outs.size >= 2) {
      // Two live out-ranks. Four consecutive held ranks means an open-ender; otherwise the gaps
      // are separated and it is a double gutshot with the same out count and a different look.
      draw = fourConsecutive(mine, boardRanksDesc) ? 'oesd' : 'double-gutshot';
    } else if (outs.size === 1) {
      draw = 'gutshot';
    }
    // NUT-NESS APPLIES TO EVERY STRAIGHT DRAW, not just gutshots. An open-ender has two ends and
    // they are frequently not equal: 76 on 9-8-2 makes the nuts with a five and is dominated by
    // any Q-J when the ten lands. Recording only the type would merge those two hands.
    if (outs.size) nut = [...outs].some((o) => outMakesNuts(o, mine, boardRanksDesc));
  }

  // ── backdoor equity: the reason a hand continues with nothing yet ──────────
  if (draw === 'none' && toCome >= 2) {
    if (threeSuit >= 0 && usesHis(threeSuit) && boardSuits[threeSuit] >= 1) draw = 'backdoor-flush';
    else if (hasRunnerStraight(mine, boardRanksDesc)) draw = 'runner-straight';
  }

  // The ace of a suit three-or-more on the board: the card that blocks the nut flush, and the
  // hand that can credibly bluff a completed one.
  const boardFlushSuit = boardSuits.findIndex((n) => n >= 3);
  const blocker = boardFlushSuit >= 0
    && (c1 === encodeCard(12, boardFlushSuit) || c2 === encodeCard(12, boardFlushSuit));

  /**
   * Is the completed hand still beatable, and is HE the one holding the redraw?
   * A straight that lands on a three-flush board is not the nuts however nut its end was, and a
   * set on that same board is drawing to a full house that beats the flush.
   */
  const risk = boardRedrawRisk(board);
  let hitQuality = 'none';
  if (draw === 'flush-draw') hitQuality = risk.paired ? 'vulnerable' : (nut ? 'clean' : 'vulnerable');
  else if (draw === 'oesd' || draw === 'double-gutshot' || draw === 'gutshot') {
    hitQuality = (risk.flushPossible || risk.paired) ? 'vulnerable' : (nut ? 'clean' : 'vulnerable');
  }
  // He holds the redraw: a set or two pair on a board where a flush or straight can complete
  // makes a full house that beats the hand the opponent is drawing to.
  const cooler = made === 'set-or-two-pair' && (risk.flushPossible || board.length < 5);

  return { made, draw, nut, blocker, hitQuality, cooler };
};

const FULL = (() => { const r = createRange(); r.fill(1); return r; })();

const rangeFromCells = (cells) => {
  const r = createRange();
  const R = '23456789TJQKA';
  for (const [label, w] of cells) {
    const m = /^([2-9TJQKA])([2-9TJQKA])([so])?$/.exec(label);
    if (m) r[rangeIndex(R.indexOf(m[1]), R.indexOf(m[2]), m[3] === 's')] = w;
  }
  return r;
};

/**
 * The made/draw distribution of his range at one decision.
 *
 * @param {Object} d           a labelled decision
 * @param {Function} widthFor  (decision) -> {cells} | null, supplied by the caller so this
 *                             module never reaches for a chart file of its own
 */
export const strengthAt = (d, widthFor) => {
  if (!Array.isArray(d.boardCards) || d.boardCards.length < 3) return null;
  const board = d.boardCards.map(encodeCardStr);
  if (board.some((c) => c < 0)) return null;

  let range; let basis;
  if (d.position === 'BB' && d.preflopPotType === 'limped pot') {
    range = FULL; basis = 'exact';
  } else {
    const got = widthFor ? widthFor(d) : null;
    if (!got) return null;
    range = rangeFromCells(got.cells); basis = 'assumed';
  }

  const boardRanks = board.map(RANK_OF).sort((a, b) => b - a);
  const combos = enumerateCombos(range, board);
  // THE CANONICAL AXIS, one enumeration per board rather than one per combo.
  const pctTable = computeBoardPercentileTable(board);
  const comboKey = (a, b) => (a < b ? a * 52 + b : b * 52 + a);
  let pctSum = 0; const pctVals = [];
  const made = {}; const draw = {};
  for (const m of MADE) made[m] = 0;
  for (const t of DRAWS) draw[t] = 0;
  let total = 0; let blockers = 0; let nuts = 0; let cleanHit = 0; let vulnHit = 0; let coolers = 0;
  // COUNTED, never subtracted. `air` used to be no-pair minus the draw sums, which treats
  // two independent axes as one partition and double-subtracts any combo carrying two
  // kinds of draw. It was negative on 60% of postflop rows and shipped to the page.
  let airCombos = 0;

  for (const c of combos) {
    const k = classify(c.card1, c.card2, board, boardRanks);
    made[k.made] += c.weight;
    draw[k.draw] += c.weight;
    if (k.blocker) blockers += c.weight;
    if (k.nut && REAL_DRAW.includes(k.draw)) nuts += c.weight;
    if (k.hitQuality === 'clean') cleanHit += c.weight;
    else if (k.hitQuality === 'vulnerable') vulnHit += c.weight;
    if (k.cooler) coolers += c.weight;
    if (k.made === 'no-pair' && k.draw === 'none') airCombos += c.weight;
    const pct = pctTable.get(comboKey(c.card1, c.card2));
    if (pct != null) { pctSum += pct * c.weight; pctVals.push([pct, c.weight]); }
    total += c.weight;
  }
  if (!total) return null;

  const norm = (o) => {
    const out = {};
    for (const key of Object.keys(o)) out[key] = +(o[key] / total).toFixed(4);
    return out;
  };
  const mp = norm(made); const dp = norm(draw);
  const sum = (obj, keys) => +keys.reduce((a, k) => a + (obj[k] || 0), 0).toFixed(4);

  // Weighted quantiles on the canonical axis. The MEDIAN says where his range sits on this
  // board; the top decile says how much of it is genuinely strong. Both are board-normalised,
  // so unlike a raw category share they are comparable from one board to the next.
  pctVals.sort((a, b) => a[0] - b[0]);
  const quantile = (q) => {
    let acc = 0; const target = q * total;
    for (const [v, w] of pctVals) { acc += w; if (acc >= target) return v; }
    return pctVals.length ? pctVals[pctVals.length - 1][0] : null;
  };

  return {
    basis,
    // ── the canonical axis (POKER_THEORY 15.1) ──
    pctMean: +(pctSum / total).toFixed(2),
    pctMedian: +quantile(0.5).toFixed(2),
    pctTop10: +quantile(0.9).toFixed(2),
    // ── the readable label layer ──
    made: mp,
    draw: dp,
    // Headline shares, each on its own axis so nothing is ranked against something it is not
    // comparable to.
    value: sum(mp, VALUE_MADE),               // top pair or better
    anyPair: +(1 - mp['no-pair']).toFixed(4), // any made pair, incl. bottom pair - a made hand
    realDraw: sum(dp, REAL_DRAW),             // a draw with 8+ outs, or a live gutshot
    backdoor: sum(dp, BACKDOOR),              // the reason a hand continues with nothing yet
    nutDraw: +(nuts / total).toFixed(4),      // drawing to the best hand of its type
    // What the draw is worth when it lands, which is not the same as how good the draw is.
    drawClean: +(cleanHit / total).toFixed(4),      // completes to a hand nothing on this board beats
    drawVulnerable: +(vulnHit / total).toFixed(4),  // completes into a board where better also completes
    cooler: +(coolers / total).toFixed(4),          // HE holds the redraw - full house over a flush
    blocker: +(blockers / total).toFixed(4),  // holds the ace of a 3-flush board
    // No pair AND no draw of any kind - a disjoint count, so it is a share and cannot be
    // negative. This is the direct input to a bluff-frequency read.
    air: +(airCombos / total).toFixed(4),
    combos: combos.length,
  };
};
