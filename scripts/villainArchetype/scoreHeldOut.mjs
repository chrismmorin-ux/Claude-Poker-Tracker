/**
 * scoreHeldOut — the number a Conduct Card competes on.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE QUESTION THE CARD HAS NEVER BEEN ABLE TO ANSWER.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `induce` reports `accuracy = right / covered` over the SAME decisions the tree was grown on.
 * Every accuracy figure ever quoted about this artifact is resubstitution, and a resubstitution
 * figure cannot fall — adding rules can only ever improve it. So the card publishes a quality
 * number that nothing can falsify, which is the WS-291 mechanism in the place it is hardest to
 * see: a figure that looks like evidence and is arithmetic.
 *
 * WS-551 turns this file from a script that PRINTS a number into a module that RETURNS one, so
 * `profileVillain` can stamp it and two cards of the same subject can be ranked on it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY LOG-LOSS, AND WHY IT IS ALWAYS REPORTED AGAINST NAMED BASELINES.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Log-loss is a STRICTLY PROPER scoring rule: the expected score is minimised uniquely by
 * reporting the true distribution. Accuracy is not — it grades the argmax and throws the mix
 * away, which is the one thing the founder explicitly did not want the rule to be.
 *
 * "1.31 bits/decision" is meaningless on its own. Most of a poker decision is decided by what is
 * LEGAL and what is cheap: facing a bet you may fold, facing no bet you may not. So four
 * comparators ride on every score, in increasing strength:
 *
 *   uniform-legal         what the RULES OF POKER allow, uniform over it. Fitted to nothing.
 *                         The pure legality control, and the analytic anchor for the tests.
 *   subject-marginal      his action frequencies, ignoring the situation entirely.
 *   legality-conditioned  his frequencies given only what he may do and whether it costs.
 *   street-x-facing       the coarsest real poker carve.
 *
 * The last three are fitted ON THE SUBJECT, which makes them HARDER to beat than a field
 * marginal would be. That is deliberate: a card that cannot beat the subject's own street x
 * facing table has not described a player, it has described the game.
 *
 * A POPULATION baseline is deliberately NOT one of these, and the reason is not cost. A field
 * MARGINAL is the weakest comparator available — it is not even conditioned on the situation, so
 * beating it would say nothing. The informative version is a population model conditioned on the
 * SAME cells, and that is a corpus LEVEL in the sense of `corpus-transfer-is-earned.md`: the
 * highest transfer burden there is, and its own instrument. `extraBaselines` is the seam it
 * lands through; it needs a second corpus pass over non-subject seats (~9x the labelling cost of
 * one villain) and belongs on node1. Named, costed, and not silently dropped.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE SPLIT IS BY HAND, IN TIME ORDER, IN DISJOINT BLOCKS.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * BY HAND, never by decision. The same holding drives the flop, turn and river of one hand —
 * 2.27 decisions per hand postflop on these subjects. Splitting by decision puts the same
 * holding on both sides and grades the model on rows correlated with its own training set,
 * which inflates the held-out figure by exactly the amount that matters.
 *
 * IN TIME ORDER, using `_backtest.day` — the corpus temporal axis, already parsed
 * (phhAdapter.mjs:179) and already used for drift by `probe-player-drift.mjs:159`. The previous
 * version of this file ordered hands with `[...new Set(ids)].sort()`, and `handId` is a NUMBER
 * (phhAdapter.mjs:185), so the default comparator sorted them as STRINGS: 10 before 9, 100
 * before 2. The "walk-forward" split was walk-forward over a lexicographic scramble. When no
 * day is present anywhere the basis falls back to corpus arrival order and SAYS SO on the
 * result — it never silently pretends to be temporal.
 *
 * IN DISJOINT BLOCKS. One cut gives one number with no spread. Expanding-window fits with
 * ROLLING eval blocks — fit [0, c_i), score [c_i, c_{i+1}) — give several, every held-out hand
 * scored exactly once, so the aggregate is a mean over genuinely disjoint data and the per-block
 * series doubles as the stationarity read the card has never run.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * REFUSING TO PREDICT IS NOT A WAY TO SCORE WELL.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A held-out decision can match no rule. That is the card's hole, and it is a real answer
 * (`ruleMatch.mjs`). But if off-support rows were simply dropped, a card that spoke only in the
 * spots it was sure about would outscore a card that covered everything — refusal would be
 * rewarded. So two numbers are always reported and they answer different questions:
 *
 *   covered   mean bits over the rows the card actually governs. Diagnostic.
 *   complete  mean bits over EVERY held-out row, with off-support rows scored by a DECLARED
 *             fallback (the subject's fit-fold marginal). This is the RANKING number, because
 *             it cannot be improved by refusing.
 *
 * Coverage is reported beside both, and the fallback is named on the result rather than assumed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THIS SCORE IS A COMPARATIVE CLAIM, SO WHERE n CANNOT CARRY IT, IT REFUSES.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Per `.claude/rules/sparsity-refuse-or-shrink.md`: the score RANKS CARDS, so it is a number
 * someone acts on and cites. It therefore refuses rather than shrinking, and the refusal carries
 * a reason from the closed enum below — never a blank, never a small number that reads measured.
 */
import { featureMap } from './induceCore.mjs';
import { assign } from './ruleMatch.mjs';
import { HELD_OUT_REFUSAL_REASONS } from '../../src/utils/standardOfRecord/conductCard.js';

/** Laplace/Jeffreys smoothing, applied identically to every model so it grades none of them. */
export const ALPHA = 0.5;

/** The closed action space. Every model is a distribution over exactly these. */
export const ACTIONS = Object.freeze(['fold', 'call', 'raise', 'bet', 'check']);

/**
 * THE CLOSED ENUM OF REFUSALS. A refusal is a fact with a name, never a missing number.
 * `sparsity-refuse-or-shrink.md`: "The refusal is NAMED, never silent, and carries its reason."
 *
 * RE-EXPORTED, NOT DECLARED (WS-551). The list now lives on the RECORD FORM in
 * `src/utils/standardOfRecord/conductCard.js`, because the card's validator has to refuse a reason
 * that is not on it and a validator holding its own copy of the enum is two representations that
 * never have to agree. `src` must not depend on `scripts`, so the dependency runs this way: the
 * record form owns the vocabulary, this file owns the method.
 */
export const REFUSAL_REASONS = HELD_OUT_REFUSAL_REASONS;
const REFUSAL_SET = new Set(Object.values(REFUSAL_REASONS));
export const isRefusalReason = (r) => REFUSAL_SET.has(r);

/**
 * THE FLOORS ARE CHOSEN, NOT MEASURED, AND THEY SAY SO ON EVERY RESULT.
 *
 * `minFitDecisions` is 8x `induceCore.MIN_RULE_DEFAULT` — below that the tree cannot make more
 * than a split or two and "the card" is not a card. `minEvalHands` and `minEvalDecisions` are the
 * bootstrap's floor: fewer than ~60 hands and the paired interval on the card-vs-control
 * difference is wider than any difference it could report.
 *
 * WHAT WOULD MEASURE THEM (`unmeasured-constants.md` names this as owed work, not a caveat): a
 * power analysis over the corpus — at what eval n does the paired-bootstrap CI on
 * (card - legality) stop straddling zero for a subject whose card is known to carry lift. That
 * is one node1 sweep and it turns three guesses into three measurements.
 */
export const FLOORS = Object.freeze({
  minFitDecisions: 200,
  minEvalHands: 60,
  minEvalDecisions: 100,
  minCoverage: 0.5,
  provenance: 'chosen, not measured — see FLOORS docstring for the power analysis that would fix that',
});

/** Expanding-window fits with rolling, disjoint eval blocks. Every held-out hand scored once. */
export const FOLD_CUTS = Object.freeze([0.5, 0.65, 0.8]);

/** Bootstrap resamples for the paired interval on a difference of two models. */
export const BOOTSTRAP = Object.freeze({ resamples: 2000, seed: 20260551 });

// ── models ────────────────────────────────────────────────────────────────────

/** Tally of actions over a row set. */
export const dist = (rows) => {
  const t = new Map();
  for (const d of rows) t.set(d.action, (t.get(d.action) || 0) + 1);
  return t;
};

/**
 * What the RULES OF POKER allow here. No claim about the player is in this function.
 *
 * `canRaise === false` is the only value that forbids aggression; null means the labeller had no
 * opinion, and inventing one would be a claim. A free fold is legal on most sites and is scored
 * as illegal-but-smoothed rather than as impossible — the alternative is an infinite loss on a
 * sit-out, which grades the disconnect, not the model.
 */
export const legalActions = (d) => {
  const owes = (d.toCallBB ?? 0) > 0;
  const aggression = d.canRaise !== false;
  const set = owes ? ['fold', 'call'] : ['check'];
  if (aggression) set.push(owes ? 'raise' : 'bet');
  return set;
};

/** Uniform over the legal set. Fitted to nothing — the same model for every subject. */
export const uniformLegal = (d) => {
  const t = new Map();
  for (const a of legalActions(d)) t.set(a, 1);
  return t;
};

const legalityCell = (d) => `${(d.toCallBB ?? 0) > 0 ? 'owes' : 'free'}|${d.canRaise ? 'canraise' : 'noraise'}`;
const streetFacing = (d) => `${d.street}|${d.facing}`;

/** A cell model fitted on `fitRows`, backing off to the fit-fold marginal for unseen cells. */
export const cellModel = (fitRows, keyOf) => {
  const m = new Map();
  for (const d of fitRows) {
    const k = keyOf(d);
    if (!m.has(k)) m.set(k, new Map());
    const t = m.get(k);
    t.set(d.action, (t.get(d.action) || 0) + 1);
  }
  const global = dist(fitRows);
  return (d) => m.get(keyOf(d)) || global;
};

/** Probability this model assigns to the action actually taken. */
const pOf = (tally, action, alpha) => {
  const t = tally || new Map();
  const total = ACTIONS.reduce((s, a) => s + (t.get(a) || 0) + alpha, 0);
  if (total <= 0) return 0;
  return ((t.get(action) || 0) + alpha) / total;
};

/** Per-decision negative log2-loss. Returned as an array so a bootstrap can resample it. */
export const bitsPerRow = (rows, tallyFor, alpha = ALPHA) =>
  rows.map((d) => {
    const p = pOf(tallyFor(d), d.action, alpha);
    return p > 0 ? -Math.log2(p) : Infinity;
  });

/** Mean bits per decision. `null` on an empty set — never 0, which reads as a perfect score. */
export const mean = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

export const logLoss = (rows, tallyFor, alpha = ALPHA) => mean(bitsPerRow(rows, tallyFor, alpha));

// ── the split ─────────────────────────────────────────────────────────────────

/**
 * Hand ids in TIME order.
 *
 * `(day, arrival)` — the same key `probe-player-drift.mjs` uses, and the same tie-break: arrival
 * order is preserved by a stable sort, and within one corpus file arrival order IS chronological.
 * `basis` is returned so a consumer can never mistake a fallback for a measurement.
 *
 * @param {Array<{h:Object}>} handsOfVillain in corpus arrival order, from `loadVillain`
 * @returns {{order:string[], basis:'day+arrival'|'arrival', daysPresent:number, days:number}}
 */
export const orderHands = (handsOfVillain) => {
  const rows = handsOfVillain.map(({ h }, i) => ({
    id: String(h.handId ?? i), day: h?._backtest?.day ?? null, i,
  }));
  const daysPresent = rows.filter((r) => r.day != null).length;
  const days = new Set(rows.filter((r) => r.day != null).map((r) => r.day)).size;
  const ordered = daysPresent === rows.length
    ? [...rows].sort((a, b) => (a.day - b.day) || (a.i - b.i))
    : rows;
  const seen = new Set(); const order = [];
  for (const r of ordered) if (!seen.has(r.id)) { seen.add(r.id); order.push(r.id); }
  return {
    order,
    basis: daysPresent === rows.length && rows.length > 0 ? 'day+arrival' : 'arrival',
    daysPresent, days,
  };
};

/** Hand ids in first-appearance order, for callers that hold only the decisions. */
export const arrivalOrder = (decisions) => {
  const seen = new Set(); const order = [];
  for (const d of decisions) {
    const id = String(d.handId);
    if (!seen.has(id)) { seen.add(id); order.push(id); }
  }
  return order;
};

/**
 * Split decisions into a fit block and an eval block at `[from, to)` of the hand order.
 *
 * THE HAND IS THE UNIT. No hand id appears on both sides — that is the property the whole
 * instrument rests on, and `scoreHeldOut.test.js` asserts it directly rather than trusting it.
 */
export const splitByHand = (decisions, order, { fitTo, evalFrom, evalTo }) => {
  const rank = new Map(order.map((id, i) => [id, i]));
  const n = order.length;
  const cut = Math.floor(n * fitTo);
  const from = Math.floor(n * evalFrom);
  const to = evalTo >= 1 ? n : Math.floor(n * evalTo);
  const fitHands = new Set(order.slice(0, cut));
  const evalHands = new Set(order.slice(from, to));
  const where = (d) => rank.get(String(d.handId));
  return {
    fit: decisions.filter((d) => fitHands.has(String(d.handId))),
    evalRows: decisions.filter((d) => evalHands.has(String(d.handId))),
    fitHands, evalHands, cut, from, to, where,
  };
};

// ── scoring one card against one held-out block ───────────────────────────────

/** A rule's action tally, from an explicit `tally` or from the pool it was fitted on. */
const tallyOfRule = (r) => {
  if (r.tally instanceof Map) return r.tally;
  if (Array.isArray(r.tally)) return new Map(r.tally);
  if (Array.isArray(r.pool)) return dist(r.pool);
  return new Map();
};

/** Deterministic digest of a ruleset's predicate set. Scorer-local — NOT `card.rulesetHash`. */
export const rulesDigest = (rules) => {
  const canon = rules.map((r) => (r.predicate || [])
    .map((c) => `${c.feature}|${c.op}|${c.value}|${[...(c.siblings || [])].sort().join(',')}`)
    .join(' AND ')).sort().join('\n');
  let h1 = 0x811c9dc5;
  for (let i = 0; i < canon.length; i++) { h1 ^= canon.charCodeAt(i); h1 = Math.imul(h1, 0x01000193) >>> 0; }
  return `rd-${h1.toString(16).padStart(8, '0')}-${rules.length}`;
};

/**
 * Score ONE ruleset on ONE held-out block, against every baseline.
 *
 * `rules` may be the in-process output of `induce` (which carries `predicate` and `pool`) or any
 * object shaped `{predicate, tally}` — which is what lets two cards from different inducers be
 * scored on the same block and ranked. A ruleset with no machine-evaluable predicate REFUSES
 * with `card-not-evaluable` rather than being scored on its English `when` strings.
 */
export const scoreCard = ({
  rules, fitRows, evalRows, features = featureMap(), alpha = ALPHA,
  floors = FLOORS, extraBaselines = {}, label = 'the card',
}) => {
  const evalHandCount = new Set(evalRows.map((d) => String(d.handId))).size;
  const n = {
    fitDecisions: fitRows.length,
    evalDecisions: evalRows.length,
    evalHands: evalHandCount,
    fitHands: new Set(fitRows.map((d) => String(d.handId))).size,
  };
  const refuse = (reason, detail) => ({ refused: { reason, detail }, n, label });

  if (!fitRows.length || !evalRows.length) {
    return refuse(REFUSAL_REASONS.DEGENERATE_SPLIT,
      `fit ${fitRows.length} decisions, eval ${evalRows.length}`);
  }
  if (fitRows.length < floors.minFitDecisions) {
    return refuse(REFUSAL_REASONS.INSUFFICIENT_FIT,
      `${fitRows.length} fit decisions, floor ${floors.minFitDecisions}`);
  }
  if (evalHandCount < floors.minEvalHands) {
    return refuse(REFUSAL_REASONS.INSUFFICIENT_EVAL_HANDS,
      `${evalHandCount} held-out hands, floor ${floors.minEvalHands}`);
  }
  if (evalRows.length < floors.minEvalDecisions) {
    return refuse(REFUSAL_REASONS.INSUFFICIENT_EVAL_DECISIONS,
      `${evalRows.length} held-out decisions, floor ${floors.minEvalDecisions}`);
  }
  if (!rules || !rules.length) return refuse(REFUSAL_REASONS.NO_INDUCED_RULES, 'the ruleset is empty');
  if (!rules.every((r) => Array.isArray(r.predicate))) {
    return refuse(REFUSAL_REASONS.CARD_NOT_EVALUABLE,
      'at least one rule carries no machine-evaluable predicate — an emitted Conduct Card '
      + 'currently carries only the English `when` string, so a STORED card cannot be scored');
  }

  const { index, offSupport, overlaps } = assign(evalRows, rules, features);
  const tallies = rules.map(tallyOfRule);
  const fallback = dist(fitRows);

  const covered = evalRows.filter((_, i) => index[i] >= 0);
  const coverageShare = evalRows.length ? covered.length / evalRows.length : 0;
  if (coverageShare < floors.minCoverage) {
    return {
      ...refuse(REFUSAL_REASONS.COVERAGE_BELOW_FLOOR,
        `the card governs ${(100 * coverageShare).toFixed(1)}% of held-out decisions, `
        + `floor ${(100 * floors.minCoverage).toFixed(0)}% — below this the score is a measurement `
        + 'of the fallback, not of the card'),
      coverage: { covered: covered.length, offSupport, share: coverageShare },
    };
  }

  // The card as a model. Keyed by POSITION, not by object identity: a caller may pass clones.
  const byRow = new Map();
  evalRows.forEach((d, i) => byRow.set(i, index[i] >= 0 ? tallies[index[i]] : fallback));
  const cardOf = (i) => byRow.get(i);

  const models = {
    'uniform-legal': uniformLegal,
    'subject-marginal': () => fallback,
    'legality-conditioned': cellModel(fitRows, legalityCell),
    'street-x-facing': cellModel(fitRows, streetFacing),
    ...extraBaselines,
  };

  const perRow = { card: evalRows.map((d, i) => {
    const p = pOf(cardOf(i), d.action, alpha);
    return p > 0 ? -Math.log2(p) : Infinity;
  }) };
  for (const [name, m] of Object.entries(models)) perRow[name] = bitsPerRow(evalRows, m, alpha);

  const coveredIdx = evalRows.map((_, i) => i).filter((i) => index[i] >= 0);
  const pick = (xs, idx) => idx.map((i) => xs[i]);
  const complete = {}; const coveredBits = {};
  for (const [k, xs] of Object.entries(perRow)) {
    complete[k] = mean(xs);
    coveredBits[k] = mean(pick(xs, coveredIdx));
  }

  return {
    refused: null,
    label,
    n,
    rulesDigest: rulesDigest(rules),
    ruleCount: rules.length,
    alpha,
    /**
     * COVERAGE, BESIDE THE SCORE AND NEVER INSTEAD OF IT. `complete` is the ranking number
     * precisely because refusing more decisions cannot improve it.
     */
    coverage: {
      evalDecisions: evalRows.length,
      covered: covered.length,
      offSupport,
      overlaps,
      share: coverageShare,
      fallback: 'subject-marginal fitted on the fit fold — off-support rows are SCORED, not dropped',
      rankingMetric: 'bits.complete',
    },
    bits: { complete, covered: coveredBits },
    /** Lift over each baseline, in bits saved per decision. Positive means the card is better. */
    lift: Object.fromEntries(Object.keys(models)
      .map((k) => [k, complete[k] - complete.card])),
    perRow,
    handOf: evalRows.map((d) => String(d.handId)),
    index,
  };
};

// ── uncertainty ───────────────────────────────────────────────────────────────

const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Paired bootstrap, RESAMPLING HANDS.
 *
 * A difference in mean bits with no interval is not a claim — it is the same defect as the
 * in-sample accuracy this file exists to replace, one level up. Hands are the resampling unit for
 * the same reason they are the split unit: decisions inside a hand are not independent.
 *
 * @returns {{diff:number, lo:number, hi:number, pGreater:number, resamples:number, seed:number}}
 */
export const pairedBootstrapByHand = (aBits, bBits, handOf, {
  resamples = BOOTSTRAP.resamples, seed = BOOTSTRAP.seed, level = 0.95,
} = {}) => {
  const groups = new Map();
  handOf.forEach((h, i) => {
    if (!groups.has(h)) groups.set(h, []);
    groups.get(h).push(i);
  });
  const keys = [...groups.keys()];
  const diffOf = (idx) => {
    let s = 0;
    for (const i of idx) s += (aBits[i] - bBits[i]);
    return s;
  };
  const totals = keys.map((k) => ({ sum: diffOf(groups.get(k)), n: groups.get(k).length }));
  const point = totals.reduce((s, t) => s + t.sum, 0) / totals.reduce((s, t) => s + t.n, 0);

  const r = rng(seed);
  const draws = [];
  let greater = 0;
  for (let b = 0; b < resamples; b++) {
    let sum = 0; let cnt = 0;
    for (let j = 0; j < keys.length; j++) {
      const t = totals[Math.floor(r() * keys.length)];
      sum += t.sum; cnt += t.n;
    }
    const v = cnt ? sum / cnt : 0;
    draws.push(v);
    if (v > 0) greater++;
  }
  draws.sort((x, y) => x - y);
  const q = (p) => draws[Math.min(draws.length - 1, Math.max(0, Math.floor(p * draws.length)))];
  const tail = (1 - level) / 2;
  return {
    diff: point, lo: q(tail), hi: q(1 - tail),
    pGreater: greater / resamples, resamples, seed, level, unit: 'hand',
  };
};

// ── the walk-forward ──────────────────────────────────────────────────────────

/**
 * Fit on the past, score on the next block, repeat. Aggregate over disjoint held-out data.
 *
 * `induceFn(fitRows) -> {rules}` is injected so the same instrument scores ANY inducer. That is
 * what makes WS-551's third accept criterion reachable: two cards of the same villain built by
 * different inducers are two `induceFn`s over the same order and the same cuts.
 */
export const scoreWalkForward = ({
  decisions, order, induceFn, cuts = FOLD_CUTS, features = featureMap(),
  alpha = ALPHA, floors = FLOORS, extraBaselines = {}, label = 'the card',
  bootstrap = BOOTSTRAP,
  /**
   * THE BASIS THE ORDER WAS BUILT ON, carried through onto `split` (WS-551).
   *
   * `orderHands` knows whether the sequence is temporal or merely corpus arrival, and until this
   * parameter existed that fact died at the call site — the report said "walk-forward" either way.
   * A card stamping a held-out score has to say which, because a fallback order passing as a
   * temporal one is a walk-forward claim about data that was never in time order.
   */
  basis = null,
}) => {
  const bounds = [...cuts, 1];
  const folds = [];
  for (let i = 0; i < cuts.length; i++) {
    const { fit, evalRows } = splitByHand(decisions, order,
      { fitTo: cuts[i], evalFrom: cuts[i], evalTo: bounds[i + 1] });
    const { rules } = induceFn(fit);
    folds.push({
      cut: cuts[i], evalTo: bounds[i + 1],
      score: scoreCard({ rules, fitRows: fit, evalRows, features, alpha, floors, extraBaselines, label }),
    });
  }

  const scored = folds.filter((f) => !f.score.refused);
  if (!scored.length) {
    // Every fold refused. Report the FIRST fold's reason rather than inventing an aggregate one.
    return {
      refused: folds[0].score.refused,
      folds: folds.map((f) => ({ cut: f.cut, refused: f.score.refused, n: f.score.n })),
      split: { unit: 'hand', cuts, basis, hands: order.length, decisions: decisions.length },
    };
  }

  // Pooled over the union of the disjoint eval blocks — a decision-weighted mean, not a mean of
  // means, because the blocks differ in size and a mean of means would silently reweight them.
  const modelNames = Object.keys(scored[0].score.bits.complete);
  const pooled = { complete: {}, covered: {} };
  const catAll = (which, k) => scored.flatMap((f) => (which === 'complete'
    ? f.score.perRow[k]
    : f.score.perRow[k].filter((_, i) => f.score.index[i] >= 0)));
  for (const k of modelNames) {
    pooled.complete[k] = mean(catAll('complete', k));
    pooled.covered[k] = mean(catAll('covered', k));
  }
  const handOf = scored.flatMap((f) => f.score.handOf);
  const cardBits = catAll('complete', 'card');

  const intervals = {};
  for (const k of modelNames) {
    if (k === 'card') continue;
    intervals[k] = pairedBootstrapByHand(catAll('complete', k), cardBits, handOf, bootstrap);
  }

  const evalDecisions = scored.reduce((s, f) => s + f.score.n.evalDecisions, 0);
  const evalHands = new Set(handOf).size;
  const coveredTotal = scored.reduce((s, f) => s + f.score.coverage.covered, 0);
  const offSupportTotal = scored.reduce((s, f) => s + f.score.coverage.offSupport, 0);

  return {
    refused: null,
    label,
    scoringRule: 'negative log2-loss per decision (strictly proper over the action distribution)',
    unit: 'bits/decision',
    rankingMetric: 'bits.complete.card — lower is better',
    alpha,
    split: {
      unit: 'hand', cuts, basis, hands: order.length, decisions: decisions.length,
      note: 'expanding-window fits, rolling DISJOINT eval blocks — every held-out hand scored once',
    },
    n: { evalDecisions, evalHands, folds: scored.length, refusedFolds: folds.length - scored.length },
    coverage: {
      // Stated here as well as under `n`, so the share can be checked against its own numerator
      // and denominator without a reader having to know they live in two different blocks.
      evalDecisions,
      covered: coveredTotal, offSupport: offSupportTotal,
      share: evalDecisions ? coveredTotal / evalDecisions : 0,
      fallback: scored[0].score.coverage.fallback,
      rankingMetric: 'bits.complete',
    },
    bits: pooled,
    /**
     * The concatenated per-decision bits and the hand each came from, so a CALLER can run the
     * paired bootstrap between two entrants. Not part of the sidecar — `rankCards` reads it and
     * the serializer drops it, because a per-decision array is evidence, not a record.
     */
    perRowBits: Object.fromEntries(modelNames.map((k) => [k, catAll('complete', k)])),
    handOf,
    foldKey: scored.map((f) => `${f.cut}-${f.evalTo}`).join('|'),
    lift: Object.fromEntries(modelNames.filter((k) => k !== 'card')
      .map((k) => [k, pooled.complete[k] - pooled.complete.card])),
    /** The lift with a paired interval over hands. A lift whose interval straddles 0 is not one. */
    liftInterval: intervals,
    /**
     * THE VERDICT AS DATA, ON A CLOSED THREE-VALUE LIST.
     *
     * Carried on the record rather than left to whoever renders it, for the same reason every
     * other figure in this directory is: the page and the run cannot then disagree. Three values
     * and not two — an interval wholly BELOW zero means the BASELINE beat the card, and a
     * better/not-better label would file that under "no lift" and lose it.
     */
    verdict: Object.fromEntries(Object.entries(intervals).map(([k, ci]) => [k,
      ci.lo > 0 ? 'card-better' : (ci.hi < 0 ? 'card-worse' : 'inconclusive')])),
    floors,
    folds: folds.map((f) => ({
      cut: f.cut, evalTo: f.evalTo,
      refused: f.score.refused,
      ruleCount: f.score.ruleCount ?? null,
      rulesDigest: f.score.rulesDigest ?? null,
      n: f.score.n,
      coverage: f.score.refused ? null : {
        covered: f.score.coverage.covered, offSupport: f.score.coverage.offSupport,
        share: f.score.coverage.share,
      },
      bits: f.score.refused ? null : f.score.bits,
    })),
  };
};

/**
 * Rank two or more rulesets on the SAME held-out blocks. WS-551 accept criterion 3.
 *
 * Every entrant is scored on identical folds with identical baselines, so the difference between
 * two entrants is a difference between the CARDS and not between two runs of the harness. The
 * pairwise interval is the paired bootstrap over hands: a ranking whose interval straddles zero
 * is reported as `separated: false` rather than as an order.
 */
export const rankCards = ({ decisions, order, entrants, ...opts }) => {
  const scored = entrants.map(({ name, induceFn }) => ({
    name, result: scoreWalkForward({ decisions, order, induceFn, label: name, ...opts }),
  }));
  const usable = scored.filter((s) => !s.result.refused);
  const ranked = [...usable].sort((a, b) => a.result.bits.complete.card - b.result.bits.complete.card);
  const pairs = [];
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const A = ranked[i].result; const B = ranked[j].result;
      /**
       * A PAIRED comparison needs the two entrants to have been scored on the SAME rows. The
       * folds are set by `order` and `cuts`, never by the ruleset, so they normally are — but an
       * entrant that refused a fold the other kept has a different eval set, and pairing those
       * would compare two different questions. That case reports `paired: null` and says why.
       */
      const paired = A.foldKey === B.foldKey && A.handOf.length === B.handOf.length
        ? pairedBootstrapByHand(B.perRowBits.card, A.perRowBits.card, A.handOf, opts.bootstrap)
        : null;
      pairs.push({
        better: ranked[i].name, worse: ranked[j].name,
        diffBits: B.bits.complete.card - A.bits.complete.card,
        interval: paired,
        separated: paired ? paired.lo > 0 : null,
        note: paired ? null
          : 'the entrants were scored on different folds (one refused where the other did not), '
            + 'so the difference is not a paired comparison and carries no interval',
      });
    }
  }
  return {
    ranked: ranked.map((s) => ({
      name: s.name, bits: s.result.bits.complete.card,
      coverage: s.result.coverage.share, ruleCount: s.result.folds[0]?.ruleCount ?? null,
    })),
    refused: scored.filter((s) => s.result.refused)
      .map((s) => ({ name: s.name, refused: s.result.refused })),
    pairs,
    /** A ranking whose every pairwise interval clears zero. Otherwise the order is not a claim. */
    separated: pairs.length > 0 && pairs.every((p) => p.separated === true),
  };
};

/**
 * THE RECORD FORM — what gets stamped ONTO the card, as `conductCard.score` (v4, WS-551).
 *
 * Strips the per-decision arrays: they are the evidence the interval was computed FROM, not the
 * record. Everything a reader needs to know what the number means rides here — the scoring rule,
 * the ranking metric, the split basis, the floors, the fallback, the bootstrap seed, and the seam
 * note that says this is not the shipped card's own ruleset.
 *
 * It was a sidecar file for exactly as long as the Conduct Card schema had nowhere to put it. A
 * sidecar and a card are two objects that can be separated — copied apart, quoted apart, aged
 * apart — and the figure that RANKS a card is the last thing that should be separable from it.
 * `conductCardProblems` now validates every clause below, which a file beside the card could not
 * be made to satisfy.
 */
export const scoreRecordOf = (report, meta = {}) => {
  const { perRowBits, handOf, foldKey, ...rest } = report;
  void perRowBits; void handOf; void foldKey;
  return {
    kind: 'conduct-card-held-out-score',
    version: 1,
    ...meta,
    ...rest,
    /**
     * THE SEAM, STATED ON THE RECORD RATHER THAN IN A COMMIT MESSAGE.
     *
     * The shipped card is induced on ALL of the subject's decisions, because that is the best
     * description of him available. It therefore CANNOT be scored out of sample — there is no
     * held-out data it has not seen. What is scored here is the same INDUCER at the same sample
     * size, refit on each fit block. `scoredRulesDigest` per fold and `cardRulesetHash` are
     * deliberately different identities so the two objects can never be confused.
     */
    seam: {
      scores: 'the inducer at this n, refit per fold',
      doesNotScore: 'the exact shipped ruleset — no held-out data exists that it has not seen',
      livesOnTheCard: 'stamped as conductCard.score (schema v4, WS-551) and validated by '
        + 'conductCardProblems; `scoredRulesDigest` per fold and the card\'s own rulesetHash are '
        + 'deliberately different identities so the two objects can never be confused',
    },
  };
};

/**
 * The name this function shipped under while the record was a file beside the card. Kept because
 * removing an export is a removal, and a caller that still says `sidecarOf` gets the same object.
 */
export const sidecarOf = scoreRecordOf;

// ── CLI ───────────────────────────────────────────────────────────────────────

const isMain = (() => {
  try {
    const invoked = process.argv[1] ? new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).pathname : '';
    return invoked.endsWith('/scoreHeldOut.mjs');
  } catch { return false; }
})();

if (isMain) {
  const { loadVillain } = await import('./loadVillain.mjs');
  const { enrichDecisions } = await import('./enrichDecisions.mjs');
  const { induce } = await import('./induceCore.mjs');
  const { reachOf } = await import('./heroReach.mjs');

  const villain = process.env.VILLAIN;
  const { pid, decisions, handsOfVillain } = await loadVillain({
    maxFiles: Number(process.env.MAX_FILES || 2000), villain,
  });
  enrichDecisions(decisions);

  const { order, basis, days } = orderHands(handsOfVillain);
  const FEATURES = featureMap();

  const report = scoreWalkForward({
    decisions, order, features: FEATURES, basis,
    induceFn: (fit) => induce(fit),
  });

  console.log(`\nvillain ${pid}`);
  console.log(`${decisions.length} decisions over ${order.length} hands · order basis ${basis}`
    + (basis === 'day+arrival' ? ` (${days} corpus days)` : ' — NO temporal axis, corpus arrival order'));

  if (report.refused) {
    console.log(`\nREFUSED: ${report.refused.reason} — ${report.refused.detail}`);
    process.exit(0);
  }

  console.log(`\nheld out: ${report.n.evalDecisions} decisions over ${report.n.evalHands} hands, `
    + `${report.n.folds} disjoint blocks`);
  console.log(`coverage: ${(100 * report.coverage.share).toFixed(1)}% `
    + `(${report.coverage.offSupport} off-support, scored by the declared fallback)\n`);

  console.log('model                                    bits/decision      lift   95% CI (paired, by hand)');
  // Three verdicts, not two: an interval wholly BELOW zero says the baseline beat the card, which
  // is the most consequential thing this instrument can report.
  for (const [k, v] of Object.entries(report.bits.complete)) {
    if (k === 'card') continue;
    const ci = report.liftInterval[k];
    const verdict = ci.lo > 0 ? '' : (ci.hi < 0 ? '  <- THE CARD IS WORSE' : '  <- straddles zero');
    console.log(`${k.padEnd(38)} ${v.toFixed(4).padStart(10)}  ${ci.diff.toFixed(4).padStart(8)}   `
      + `[${ci.lo.toFixed(4)}, ${ci.hi.toFixed(4)}]${verdict}`);
  }
  console.log(`${'THE CARD'.padEnd(38)} ${report.bits.complete.card.toFixed(4).padStart(10)}`);

  const control = report.liftInterval['uniform-legal'];
  console.log(`\nPre-registered falsifier: the card beats the LEGALITY CONTROL by more than 0.05 `
    + `bits/decision held out, with the paired 95% interval clear of zero.`);
  console.log(`  lift ${control.diff.toFixed(4)}  CI [${control.lo.toFixed(4)}, ${control.hi.toFixed(4)}]  `
    + `${(control.diff > 0.05 && control.lo > 0) ? 'MET.' : 'NOT MET.'}`);

  console.log(`\nper block — the stationarity read this instrument doubles as`);
  for (const f of report.folds) {
    if (f.refused) { console.log(`  cut ${f.cut}: REFUSED ${f.refused.reason}`); continue; }
    console.log(`  fit<${f.cut} score[${f.cut},${f.evalTo})  ${String(f.ruleCount).padStart(3)} rules  `
      + `${f.bits.complete.card.toFixed(4)} bits  coverage ${(100 * f.coverage.share).toFixed(1)}%`);
  }

  /**
   * WHERE THE LIFT ACTUALLY IS — computed on the LAST fold, which has the largest fit block.
   *
   * The aggregate is a mean over every held-out decision, and a mean is exactly the wrong summary
   * for the question anyone has. A small average lift is compatible with two very different
   * worlds: the card knows a little about everything, or it knows a great deal about a handful of
   * spots and nothing about the rest. Only the second is worth acting on.
   *
   * Per-rule attribution is only defined WITHIN one fold — each fold induces its own ruleset — so
   * this section names the fold it came from instead of pooling incomparable rule ids.
   */
  const lastCut = FOLD_CUTS[FOLD_CUTS.length - 1];
  const { fit, evalRows } = splitByHand(decisions, order,
    { fitTo: lastCut, evalFrom: lastCut, evalTo: 1 });
  const { rules } = induce(fit);
  const { index } = assign(evalRows, rules, FEATURES);
  const ruleTallies = rules.map((r) => dist(r.pool));
  const control2 = uniformLegal;

  const perRule = new Map();
  evalRows.forEach((d, i) => {
    const ri = index[i];
    if (ri < 0) return;
    const saved = -Math.log2(pOf(control2(d), d.action, ALPHA))
      - (-Math.log2(pOf(ruleTallies[ri], d.action, ALPHA)));
    if (!perRule.has(ri)) perRule.set(ri, { n: 0, saved: 0 });
    const e = perRule.get(ri); e.n++; e.saved += saved;
  });
  const totalSaved = [...perRule.values()].reduce((s, e) => s + e.saved, 0);
  const ranked = [...perRule.entries()]
    .map(([ri, e]) => ({
      ri, n: e.n, perDec: e.saved / e.n, total: e.saved, share: e.saved / totalSaved,
      when: rules[ri].conds.map((c) => c.value).join(' AND ') || 'everything else',
    }))
    .sort((a, b) => b.total - a.total);

  console.log(`\nPER-RULE LIFT over the legality control — fold fit<${lastCut}, ${rules.length} rules`);
  console.log(`   n   bits/dec   total   share  spot`);
  for (const r of ranked) {
    console.log(`${String(r.n).padStart(5)}  ${r.perDec.toFixed(3).padStart(8)}  `
      + `${r.total.toFixed(1).padStart(6)}  ${(100 * r.share).toFixed(1).padStart(5)}%  ${r.when.slice(0, 72)}`);
  }

  /**
   * THE POOLED-STATISTIC LEAKAGE SHARE — how much of the lift rides on a contaminated feature.
   *
   * Every `str_*` column is derived from `entryWidthOf(decisions)` (enrichDecisions.mjs:56-76),
   * which is fitted over ALL of the subject's decisions — INCLUDING the held-out ones. Those
   * columns are `situation` fields, so the induction may split on them. Any lift concentrated in
   * a rule whose predicate names one is lift that a fold-blind statistic helped produce.
   *
   * This is not the fix — the fix is fold-aware enrichment, named in the WS-551 report. It is the
   * MEASUREMENT of what the defect is currently worth, which is what stops it being a caveat.
   */
  const contaminated = (r) => (r.predicate || [])
    .some((c) => /^str_/.test(c.feature) || c.feature === 'draw_completed');
  const leaky = ranked.filter((r) => contaminated(rules[r.ri]));
  const leakedTotal = leaky.reduce((s, r) => s + r.total, 0);
  console.log(`\nPOOLED-STATISTIC LEAKAGE — lift riding on a str_*/draw_completed condition`);
  console.log(`  ${leaky.length} of ${ranked.length} scored rules, `
    + `${(100 * leakedTotal / totalSaved).toFixed(1)}% of the card's total held-out advantage`);
  console.log(`  those columns come from entryWidthOf(ALL decisions) — enrichDecisions.mjs:56`);

  console.log(`\nLIFT x REACH — who chose the conditions`);
  console.log(`  bits/dec     n  reach   levers`);
  for (const r of ranked.filter((x) => x.perDec > 0).slice(0, 8)) {
    const { reach, levers } = reachOf(rules[r.ri].predicate);
    console.log(`  ${r.perDec.toFixed(3).padStart(7)} ${String(r.n).padStart(5)}  ${reach.padEnd(7)}`
      + ` ${levers.join(', ') || '(none — the deal put him here)'}`);
  }
  void fit;
}
