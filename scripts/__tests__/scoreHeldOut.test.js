/**
 * scoreHeldOut.test.js — WS-551.
 *
 * KNOWN ANSWERS, NOT PLAUSIBILITY CHECKS. Every assertion below is an analytic value computed in
 * the test from the definition of the scoring rule, never a figure copied out of a run. DEC-053:
 * validation of our own math uses ground truth that is not our own code.
 *
 * The synthetic subjects are generated from a stated policy, so the entropy floor of each is
 * known before the scorer runs. That is what makes "the card scores at the floor" a test rather
 * than an observation.
 */
import { describe, it, expect } from 'vitest';
import {
  ALPHA, ACTIONS, FLOORS, REFUSAL_REASONS, isRefusalReason,
  legalActions, uniformLegal, dist, logLoss, bitsPerRow, mean,
  orderHands, arrivalOrder, splitByHand, scoreCard, scoreWalkForward,
  pairedBootstrapByHand, rulesDigest, sidecarOf,
} from '../villainArchetype/scoreHeldOut.mjs';

// ── the synthetic world ───────────────────────────────────────────────────────

/**
 * A decision with just enough of the real schema for the feature map to be well defined.
 *
 * `facing` and `street` are the two features these tests condition on; every other situation
 * column is left absent, which makes it read `-` and therefore untestable by the induction. That
 * is deliberate — the synthetic subject's policy is exactly the one the test states, with no
 * accidental extra structure for a tree to find.
 */
const decision = ({ handId, order = 1, street = 'flop', facing = 'a bet', action, toCallBB = 5, canRaise = true }) => ({
  handId, order, street, facing, action, toCallBB, canRaise,
});

/** A feature map over just the columns these tests use, so the predicates below are exact. */
const FEATURES = {
  street: (d) => (d.street == null ? null : `street = ${d.street}`),
  facing: (d) => (d.facing == null ? null : `facing = ${d.facing}`),
};

const eqCond = (feature, value) => ({ feature, op: 'eq', value, siblings: [] });

/**
 * A deterministic subject: facing a bet he always folds, facing no bet he always checks.
 * Entropy of his policy is exactly zero, so a card that reproduces it scores zero bits at
 * alpha = 0 — the entropy floor, computed from the definition and not from a run.
 */
const deterministicSubject = (hands) => {
  const rows = [];
  for (let h = 0; h < hands; h++) {
    rows.push(decision({ handId: `H${String(h).padStart(4, '0')}`, order: 1, facing: 'a bet', action: 'fold', toCallBB: 5 }));
    rows.push(decision({ handId: `H${String(h).padStart(4, '0')}`, order: 2, facing: 'no bet', action: 'check', toCallBB: 0 }));
  }
  return rows;
};

/** The two rules that describe him perfectly, as a card would carry them. */
const perfectCard = () => [
  { predicate: [eqCond('facing', 'facing = a bet')], tally: new Map([['fold', 1000]]) },
  { predicate: [eqCond('facing', 'facing = no bet')], tally: new Map([['check', 1000]]) },
];

const splitAll = (rows) => {
  const order = arrivalOrder(rows);
  return splitByHand(rows, order, { fitTo: 0.5, evalFrom: 0.5, evalTo: 1 });
};

// ── known-answer anchors ──────────────────────────────────────────────────────

describe('the scoring rule, against analytic values', () => {
  it('a card that predicts a deterministic subject perfectly scores at the entropy floor', () => {
    const rows = deterministicSubject(200);
    const { fit, evalRows } = splitAll(rows);
    const r = scoreCard({
      rules: perfectCard(), fitRows: fit, evalRows, features: FEATURES, alpha: 0,
    });
    expect(r.refused).toBeNull();
    // H(p) = 0 for a point mass. Not "close to zero" — exactly zero.
    expect(r.bits.complete.card).toBe(0);
    expect(r.bits.covered.card).toBe(0);
    expect(r.coverage.share).toBe(1);
  });

  it('the same card under Laplace smoothing scores the analytic smoothed value, not zero', () => {
    const rows = deterministicSubject(200);
    const { fit, evalRows } = splitAll(rows);
    const r = scoreCard({ rules: perfectCard(), fitRows: fit, evalRows, features: FEATURES, alpha: ALPHA });
    // p = (k + a) / (k + 5a) with k = 1000, a = 0.5 -> the same for both rules.
    const expected = -Math.log2((1000 + ALPHA) / (1000 + ACTIONS.length * ALPHA));
    expect(r.bits.complete.card).toBeCloseTo(expected, 12);
    expect(r.bits.complete.card).toBeGreaterThan(0);
  });

  it('a card that predicts uniformly over the legal set scores EXACTLY the legality control', () => {
    const rows = deterministicSubject(200);
    const { fit, evalRows } = splitAll(rows);
    // Facing a bet with a raise available: {fold, call, raise}. Facing no bet: {check, bet}.
    const uniformCard = [
      { predicate: [eqCond('facing', 'facing = a bet')],
        tally: new Map([['fold', 1], ['call', 1], ['raise', 1]]) },
      { predicate: [eqCond('facing', 'facing = no bet')],
        tally: new Map([['check', 1], ['bet', 1]]) },
    ];
    const r = scoreCard({ rules: uniformCard, fitRows: fit, evalRows, features: FEATURES, alpha: ALPHA });
    expect(r.bits.complete.card).toBeCloseTo(r.bits.complete['uniform-legal'], 12);
    expect(r.lift['uniform-legal']).toBeCloseTo(0, 12);
  });

  it('the legality control equals the value computed from the legal-set size', () => {
    const owes = decision({ handId: 'H1', action: 'fold', toCallBB: 5, canRaise: true });
    const free = decision({ handId: 'H1', order: 2, facing: 'no bet', action: 'check', toCallBB: 0, canRaise: true });
    expect(legalActions(owes).sort()).toEqual(['call', 'fold', 'raise']);
    expect(legalActions(free).sort()).toEqual(['bet', 'check']);
    // p = (1 + a) / (L + 5a)
    const analytic = (L) => -Math.log2((1 + ALPHA) / (L + ACTIONS.length * ALPHA));
    expect(bitsPerRow([owes], uniformLegal, ALPHA)[0]).toBeCloseTo(analytic(3), 12);
    expect(bitsPerRow([free], uniformLegal, ALPHA)[0]).toBeCloseTo(analytic(2), 12);
  });

  it('log-loss is a PROPER rule: reporting the true mix beats any distortion of it', () => {
    // A subject who folds 70% and calls 30%, facing a bet. The truthful report must win.
    const rows = [];
    for (let h = 0; h < 200; h++) {
      rows.push(decision({ handId: `H${h}`, action: h % 10 < 7 ? 'fold' : 'call' }));
    }
    const truthful = () => new Map([['fold', 700], ['call', 300]]);
    const overconfident = () => new Map([['fold', 950], ['call', 50]]);
    const underconfident = () => new Map([['fold', 500], ['call', 500]]);
    const t = logLoss(rows, truthful, ALPHA);
    expect(t).toBeLessThan(logLoss(rows, overconfident, ALPHA));
    expect(t).toBeLessThan(logLoss(rows, underconfident, ALPHA));
    // and it sits at the plug-in entropy of the true mix
    const H = -(0.7 * Math.log2(0.7) + 0.3 * Math.log2(0.3));
    expect(t).toBeCloseTo(H, 2);
  });
});

// ── the split, and the leakage guards ─────────────────────────────────────────

describe('the split is by hand, in time order', () => {
  it('no hand id lands on both sides of the split', () => {
    const rows = deterministicSubject(300);
    const { fit, evalRows } = splitAll(rows);
    const fitIds = new Set(fit.map((d) => d.handId));
    const evalIds = new Set(evalRows.map((d) => d.handId));
    expect(fitIds.size).toBeGreaterThan(0);
    expect(evalIds.size).toBeGreaterThan(0);
    for (const id of evalIds) expect(fitIds.has(id)).toBe(false);
    expect(fit.length + evalRows.length).toBe(rows.length);
  });

  it('LEAKAGE GUARD: every decision of a held-out hand is held out, not just some of them', () => {
    // The failure this catches is a split by DECISION wearing a split-by-hand name: the flop
    // decision of hand X in the fit block and its river decision in the eval block. 2.27
    // decisions per hand share one holding, so that inflates the score by exactly the amount
    // that matters.
    const rows = deterministicSubject(300);
    const { fit, evalRows } = splitAll(rows);
    const byHand = new Map();
    for (const d of rows) byHand.set(d.handId, (byHand.get(d.handId) || 0) + 1);
    const fitPer = new Map(); const evalPer = new Map();
    for (const d of fit) fitPer.set(d.handId, (fitPer.get(d.handId) || 0) + 1);
    for (const d of evalRows) evalPer.set(d.handId, (evalPer.get(d.handId) || 0) + 1);
    for (const [id, total] of byHand) {
      const inFit = fitPer.get(id) || 0;
      const inEval = evalPer.get(id) || 0;
      expect(inFit === total || inEval === total).toBe(true);
    }
  });

  it('orders hands by corpus day, NOT by the default lexicographic sort of a numeric id', () => {
    // `handId` is a Number (phhAdapter.mjs:185). `[...ids].sort()` compares them as STRINGS,
    // so 10 sorts before 9 and 100 before 2. The previous version of this file did exactly that
    // and called the result walk-forward.
    const handsOfVillain = [
      { h: { handId: 100, _backtest: { day: 3 } } },
      { h: { handId: 9, _backtest: { day: 1 } } },
      { h: { handId: 10, _backtest: { day: 2 } } },
    ];
    const { order, basis, days } = orderHands(handsOfVillain);
    expect(basis).toBe('day+arrival');
    expect(days).toBe(3);
    expect(order).toEqual(['9', '10', '100']);
    // the bug it replaces, stated so the regression is unmistakable
    expect([100, 9, 10].map(String).sort()).toEqual(['10', '100', '9']);
  });

  it('says so when there is no temporal axis instead of pretending the split is walk-forward', () => {
    const handsOfVillain = [
      { h: { handId: 7 } }, { h: { handId: 3, _backtest: { day: 2 } } }, { h: { handId: 5 } },
    ];
    const { order, basis } = orderHands(handsOfVillain);
    expect(basis).toBe('arrival');
    expect(order).toEqual(['7', '3', '5']);
  });

  it('LEAKAGE GUARD: the scored ruleset was fitted on rows disjoint from the ones it is scored on', () => {
    const rows = deterministicSubject(400);
    const order = arrivalOrder(rows);
    const seenFits = [];
    const report = scoreWalkForward({
      decisions: rows, order, features: FEATURES,
      induceFn: (fit) => {
        seenFits.push(new Set(fit.map((d) => d.handId)));
        return { rules: perfectCard() };
      },
      floors: { ...FLOORS, minEvalHands: 10, minEvalDecisions: 20, minFitDecisions: 20 },
    });
    expect(report.refused).toBeNull();
    // Each fold's eval hands must be absent from the fit set that produced its rules.
    report.folds.forEach((f, i) => {
      const evalHandIds = new Set();
      const { evalRows } = splitByHand(rows, order, { fitTo: f.cut, evalFrom: f.cut, evalTo: f.evalTo });
      for (const d of evalRows) evalHandIds.add(d.handId);
      for (const id of evalHandIds) expect(seenFits[i].has(id)).toBe(false);
    });
    // and every held-out hand is scored exactly once across the disjoint blocks
    const allEval = report.folds.reduce((s, f) => s + f.n.evalHands, 0);
    expect(allEval).toBe(Math.floor(order.length * (1 - 0.5)));
  });
});

// ── refusal ───────────────────────────────────────────────────────────────────

describe('refusal, because this score is a comparative claim', () => {
  it('refuses on a thin eval block with a reason from the closed enum', () => {
    const rows = deterministicSubject(20); // 20 hands, 40 decisions
    const { fit, evalRows } = splitAll(rows);
    const r = scoreCard({ rules: perfectCard(), fitRows: fit, evalRows, features: FEATURES });
    expect(r.refused).not.toBeNull();
    expect(isRefusalReason(r.refused.reason)).toBe(true);
    expect(r.bits).toBeUndefined();          // no number that reads measured
  });

  it('names insufficient-eval-hands specifically, not a generic failure', () => {
    // 400 hands -> 400 fit decisions (clears the fit floor) and 200 held-out hands, so the
    // eval-hand floor is the ONLY one that can fire. Checks the reason, not merely that it refused.
    const rows = deterministicSubject(400);
    const { fit, evalRows } = splitAll(rows);
    const r = scoreCard({
      rules: perfectCard(), fitRows: fit, evalRows, features: FEATURES,
      floors: { ...FLOORS, minEvalHands: 500 },
    });
    expect(r.refused.reason).toBe(REFUSAL_REASONS.INSUFFICIENT_EVAL_HANDS);
  });

  it('refuses a ruleset with no machine-evaluable predicate — a STORED Conduct Card', () => {
    // An emitted card carries `when` (an English string) and no `predicate`. This is the
    // refusal that makes that fact impossible to miss rather than a silent zero score.
    const rows = deterministicSubject(300);
    const { fit, evalRows } = splitAll(rows);
    const storedCardRules = [
      { ruleId: 'r-abc', when: 'facing = a bet', n: 100, actions: [{ action: 'fold', k: 100 }] },
    ];
    const r = scoreCard({ rules: storedCardRules, fitRows: fit, evalRows, features: FEATURES });
    expect(r.refused.reason).toBe(REFUSAL_REASONS.CARD_NOT_EVALUABLE);
  });

  it('refuses when the card governs too little of the held-out block to be what is measured', () => {
    const rows = deterministicSubject(300);
    const { fit, evalRows } = splitAll(rows);
    const halfCard = [{ predicate: [eqCond('facing', 'facing = a bet')], tally: new Map([['fold', 100]]) }];
    const r = scoreCard({
      rules: halfCard, fitRows: fit, evalRows, features: FEATURES,
      floors: { ...FLOORS, minCoverage: 0.75 },
    });
    expect(r.refused.reason).toBe(REFUSAL_REASONS.COVERAGE_BELOW_FLOOR);
    expect(r.coverage.share).toBeCloseTo(0.5, 6);
  });

  it('every reason the module can emit is on the closed list', () => {
    for (const v of Object.values(REFUSAL_REASONS)) expect(isRefusalReason(v)).toBe(true);
    expect(isRefusalReason('because it felt wrong')).toBe(false);
    expect(Object.isFrozen(REFUSAL_REASONS)).toBe(true);
  });
});

// ── coverage: refusing more decisions must not be a way to score better ───────

describe('coverage is counted, and refusing is not rewarded', () => {
  const rows = deterministicSubject(400);
  const { fit, evalRows } = splitAll(rows);

  /** Covers everything, and is imperfect in the free half. */
  const broadCard = [
    { predicate: [eqCond('facing', 'facing = a bet')], tally: new Map([['fold', 90], ['call', 10]]) },
    { predicate: [eqCond('facing', 'facing = no bet')], tally: new Map([['check', 60], ['bet', 40]]) },
  ];
  /** Speaks only where it is certain. Perfect there, silent everywhere else. */
  const narrowCard = [
    { predicate: [eqCond('facing', 'facing = a bet')], tally: new Map([['fold', 1000]]) },
  ];

  it('counts off-support decisions rather than dropping them', () => {
    const r = scoreCard({ rules: narrowCard, fitRows: fit, evalRows, features: FEATURES });
    expect(r.coverage.evalDecisions).toBe(evalRows.length);
    expect(r.coverage.covered + r.coverage.offSupport).toBe(evalRows.length);
    expect(r.coverage.offSupport).toBe(evalRows.length / 2);
    expect(r.coverage.share).toBeCloseTo(0.5, 6);
    expect(r.coverage.overlaps).toBe(0);
  });

  it('a card that refuses more looks better on `covered` and NOT on the ranking metric', () => {
    const broad = scoreCard({ rules: broadCard, fitRows: fit, evalRows, features: FEATURES });
    const narrow = scoreCard({ rules: narrowCard, fitRows: fit, evalRows, features: FEATURES });
    expect(broad.refused).toBeNull();
    expect(narrow.refused).toBeNull();

    // On covered-only the narrow card wins, because it only ever speaks where it is certain.
    expect(narrow.bits.covered.card).toBeLessThan(broad.bits.covered.card);
    // On the ranking metric — every held-out row, off-support scored by the declared fallback —
    // the broad card wins. That is the whole point of `complete`.
    expect(broad.bits.complete.card).toBeLessThan(narrow.bits.complete.card);
    expect(broad.coverage.rankingMetric).toBe('bits.complete');
  });

  it('names its fallback rather than applying one silently', () => {
    const r = scoreCard({ rules: narrowCard, fitRows: fit, evalRows, features: FEATURES });
    expect(r.coverage.fallback).toMatch(/subject-marginal/);
    expect(r.coverage.fallback).toMatch(/not dropped/);
  });
});

// ── baselines, lift, uncertainty ──────────────────────────────────────────────

describe('the score never travels without its baselines', () => {
  it('reports all four named baselines and a lift against each', () => {
    const rows = deterministicSubject(400);
    const { fit, evalRows } = splitAll(rows);
    const r = scoreCard({ rules: perfectCard(), fitRows: fit, evalRows, features: FEATURES });
    for (const k of ['uniform-legal', 'subject-marginal', 'legality-conditioned', 'street-x-facing']) {
      expect(typeof r.bits.complete[k]).toBe('number');
      expect(typeof r.lift[k]).toBe('number');
    }
    // A perfect card must beat the pure legality control on a subject with real structure.
    expect(r.lift['uniform-legal']).toBeGreaterThan(0.05);
  });

  it('an extra baseline can be injected — the seam a population model lands through', () => {
    const rows = deterministicSubject(400);
    const { fit, evalRows } = splitAll(rows);
    const fieldMarginal = () => new Map([['fold', 50], ['call', 25], ['check', 20], ['bet', 5]]);
    const r = scoreCard({
      rules: perfectCard(), fitRows: fit, evalRows, features: FEATURES,
      extraBaselines: { 'population-marginal': fieldMarginal },
    });
    expect(typeof r.bits.complete['population-marginal']).toBe('number');
    expect(typeof r.lift['population-marginal']).toBe('number');
  });

  it('the paired bootstrap resamples HANDS and is deterministic under its seed', () => {
    const handOf = ['A', 'A', 'B', 'B', 'C', 'C', 'D', 'D'];
    const worse = [2, 2, 2, 2, 2, 2, 2, 2];
    const better = [1, 1, 1, 1, 1, 1, 1, 1];
    const a = pairedBootstrapByHand(worse, better, handOf, { resamples: 500, seed: 7 });
    const b = pairedBootstrapByHand(worse, better, handOf, { resamples: 500, seed: 7 });
    expect(a.diff).toBeCloseTo(1, 12);
    expect(a.unit).toBe('hand');
    expect(a).toEqual(b);
    expect(a.lo).toBeCloseTo(1, 12);
    expect(a.pGreater).toBe(1);
  });

  it('a lift that is really zero produces an interval that straddles zero', () => {
    const handOf = Array.from({ length: 200 }, (_, i) => `H${Math.floor(i / 2)}`);
    // Symmetric noise: the two models are equally good.
    const a = handOf.map((_, i) => (i % 2 ? 1.2 : 0.8));
    const b = handOf.map((_, i) => (i % 2 ? 0.8 : 1.2));
    const r = pairedBootstrapByHand(a, b, handOf, { resamples: 800, seed: 11 });
    expect(r.diff).toBeCloseTo(0, 6);
    expect(r.lo).toBeLessThanOrEqual(0);
    expect(r.hi).toBeGreaterThanOrEqual(0);
  });
});

// ── the walk-forward and the record it produces ───────────────────────────────

describe('the walk-forward, and the record it writes', () => {
  const rows = deterministicSubject(600);
  const order = arrivalOrder(rows);
  const report = scoreWalkForward({
    decisions: rows, order, features: FEATURES,
    induceFn: () => ({ rules: perfectCard() }),
  });

  it('aggregates over disjoint blocks and pools by decision, not by fold', () => {
    expect(report.refused).toBeNull();
    expect(report.n.folds).toBe(3);
    const perFold = report.folds.map((f) => f.n.evalDecisions);
    expect(perFold.reduce((s, x) => s + x, 0)).toBe(report.n.evalDecisions);
    // pooled = total bits / total decisions, so it must lie within the per-fold range
    const lo = Math.min(...report.folds.map((f) => f.bits.complete.card));
    const hi = Math.max(...report.folds.map((f) => f.bits.complete.card));
    expect(report.bits.complete.card).toBeGreaterThanOrEqual(lo - 1e-9);
    expect(report.bits.complete.card).toBeLessThanOrEqual(hi + 1e-9);
  });

  it('carries a THREE-value verdict, so "the baseline beat the card" cannot be filed as "no lift"', () => {
    expect(report.verdict['uniform-legal']).toBe('card-better');
    for (const v of Object.values(report.verdict)) {
      expect(['card-better', 'card-worse', 'inconclusive']).toContain(v);
    }
    // a weaker card against a baseline it genuinely loses to must read `card-worse`, never
    // `inconclusive` — that distinction is the whole reason the field has three values
    const feeble = () => ({
      rules: [
        { predicate: [eqCond('facing', 'facing = a bet')], tally: new Map([['call', 100]]) },
        { predicate: [eqCond('facing', 'facing = no bet')], tally: new Map([['bet', 100]]) },
      ],
    });
    const bad = scoreWalkForward({ decisions: rows, order, features: FEATURES, induceFn: feeble });
    expect(bad.verdict['uniform-legal']).toBe('card-worse');
  });

  it('carries the ranking metric, the split basis, the floors and the seed on its face', () => {
    expect(report.rankingMetric).toMatch(/complete/);
    expect(report.scoringRule).toMatch(/proper/);
    expect(report.split.unit).toBe('hand');
    expect(report.floors.provenance).toMatch(/chosen, not measured/);
    expect(report.liftInterval['uniform-legal'].seed).toBe(20260551);
  });

  it('the sidecar drops the per-decision evidence and states the seam', () => {
    const side = sidecarOf(report, { subjectId: 'TESTVILLAIN' });
    expect(side.perRowBits).toBeUndefined();
    expect(side.handOf).toBeUndefined();
    expect(side.subjectId).toBe('TESTVILLAIN');
    expect(side.kind).toBe('conduct-card-held-out-score');
    expect(side.seam.doesNotScore).toMatch(/shipped ruleset/);
    // it must survive a round trip through JSON — it is written to disk
    expect(() => JSON.parse(JSON.stringify(side))).not.toThrow();
  });

  it('two rulesets scored on the same folds are directly comparable', () => {
    const weaker = () => ({
      rules: [
        { predicate: [eqCond('facing', 'facing = a bet')], tally: new Map([['fold', 60], ['call', 40]]) },
        { predicate: [eqCond('facing', 'facing = no bet')], tally: new Map([['check', 60], ['bet', 40]]) },
      ],
    });
    const b = scoreWalkForward({ decisions: rows, order, features: FEATURES, induceFn: weaker });
    expect(b.refused).toBeNull();
    expect(report.bits.complete.card).toBeLessThan(b.bits.complete.card);
    // identical folds, so the comparison is paired
    expect(report.foldKey).toBe(b.foldKey);
    expect(report.n.evalDecisions).toBe(b.n.evalDecisions);
    const paired = pairedBootstrapByHand(b.perRowBits.card, report.perRowBits.card, report.handOf,
      { resamples: 400, seed: 3 });
    expect(paired.lo).toBeGreaterThan(0);
  });

  it('a ruleset digest identifies the SPOT SET and is not the card contentHash', () => {
    const a = rulesDigest(perfectCard());
    const b = rulesDigest([...perfectCard()].reverse());
    expect(a).toBe(b);                       // order-independent
    expect(a).toMatch(/^rd-[0-9a-f]{8}-2$/); // and visibly not a sha256 card hash
  });
});

// ── small guarantees the rest depends on ──────────────────────────────────────

describe('primitives', () => {
  it('mean of an empty set is null, never zero', () => {
    expect(mean([])).toBeNull();
    expect(logLoss([], () => new Map())).toBeNull();
  });

  it('dist counts actions and nothing else', () => {
    const t = dist([{ action: 'fold' }, { action: 'fold' }, { action: 'call' }]);
    expect(t.get('fold')).toBe(2);
    expect(t.get('call')).toBe(1);
    expect(t.get('raise')).toBeUndefined();
  });

  it('a free fold is smoothed rather than infinite — it grades the disconnect, not the model', () => {
    const freeFold = decision({ handId: 'H1', facing: 'no bet', action: 'fold', toCallBB: 0 });
    expect(legalActions(freeFold)).not.toContain('fold');
    const bits = bitsPerRow([freeFold], uniformLegal, ALPHA)[0];
    expect(Number.isFinite(bits)).toBe(true);
    expect(bits).toBeCloseTo(-Math.log2(ALPHA / (2 + ACTIONS.length * ALPHA)), 12);
  });
});
