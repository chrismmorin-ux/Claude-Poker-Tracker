/**
 * rulesetCoverage — the villain's ruleset, and how much of him it actually accounts for.
 *
 * TWO DIFFERENT QUESTIONS, KEPT APART, because collapsing them is how a ruleset flatters
 * itself:
 *
 *   COVERAGE  — of all the decisions this player made, how many does some rule even SPEAK to?
 *               A decision no rule addresses is not evidence for anything.
 *   ACCURACY  — of the decisions a rule speaks to, how often was the rule right?
 *
 * AND THE CONTROL THAT MAKES ACCURACY MEAN ANYTHING. This player folds about 86% of the
 * time. "Always fold" therefore scores 86% and knows nothing. Every rule is scored against
 * the majority action IN ITS OWN CONTEXT, and the number that matters is the LIFT over that
 * baseline. A rule with 95% accuracy and zero lift has discovered that people fold a lot.
 *
 * WHAT A RULE MAY PREDICT. Only an action, from observables. A rule cannot predict fold-vs-play
 * where the answer depends on hole cards we never see — that is a FREQUENCY claim, not a
 * prediction, and those are reported separately rather than being scored as if they were
 * predictions. Conflating the two would let "I fold 87% of first-in spots" masquerade as an
 * 87%-accurate rule when it predicts nothing about any individual hand.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;

/**
 * The ruleset, in the order it is applied. First match governs the decision.
 *
 * `kind: 'predict'` — states which action follows, and is scored.
 * `kind: 'frequency'` — states a rate; the action depends on cards we cannot see, so it is
 *                       reported as a rate and never scored as a prediction.
 */
export const RULESET = [
  {
    id: 'R1', kind: 'predict',
    prose: 'When I decide to come in first, I raise. I do not limp.',
    when: (d) => d.street === 'preflop' && d.firstIn && d.facing === 'no raise'
      && (d.action === 'raise' || d.action === 'call'),
    predict: () => 'raise',
    origin: 'explainer batch-06/15, verified',
  },
  {
    id: 'R2', kind: 'frequency',
    prose: 'When nobody has entered, I play about one hand in eight — but twice as often '
      + 'with two players behind me as with five.',
    when: (d) => d.street === 'preflop' && d.firstIn && d.facing === 'no raise',
    rate: (d) => d.action !== 'fold',
    split: (d) => d.opponentsLive == null ? null : `${d.opponentsLive} behind`,
    origin: 'explainer batch-15 "never opens early" — narrowed by verification',
  },
  {
    id: 'R3', kind: 'predict',
    prose: 'Facing a raise I never just call. I fold, or I put in a re-raise.',
    when: (d) => d.street === 'preflop' && (d.facing === 'a raise' || d.facing === 'a 3-bet')
      && d.action !== 'fold',
    predict: () => 'raise',
    origin: 'explainer batches 08/09/10/11 — the most-repeated rule in the study',
  },
  {
    id: 'R4', kind: 'frequency',
    prose: 'I fold most raises, and I fold them more often when players are still behind me '
      + 'than when the action closes on me.',
    when: (d) => d.street === 'preflop' && (d.facing === 'a raise' || d.facing === 'a 3-bet'),
    rate: (d) => d.action === 'fold',
    split: (d) => d.closesAction == null ? null : (d.closesAction ? 'action closes on me' : 'players still behind'),
    origin: 'explainer batch-06 — the "regardless of everything" claim, corrected',
  },
  {
    id: 'R5', kind: 'frequency',
    prose: 'The price does move me. I continue a quarter of the time when it is cheap and '
      + 'almost never when it is steep.',
    when: (d) => d.potOddsNeeded != null && d.toCallBB > 0,
    rate: (d) => d.action !== 'fold',
    split: (d) => d.potOddsNeeded < 0.25 ? 'under 25%'
      : d.potOddsNeeded < 0.30 ? '25-30%'
        : d.potOddsNeeded < 0.35 ? '30-35%'
          : d.potOddsNeeded < 0.42 ? '35-42%' : 'over 42%',
    origin: 'REVERSES the earlier "price does not move me" reading',
  },
  {
    id: 'R6', kind: 'predict',
    prose: 'If I raised before the flop and it is checked to me, I bet.',
    when: (d) => d.street === 'flop' && d.iAmLastPreflopAggressor && d.facing === 'no bet',
    predict: () => 'bet',
    origin: 'explainer batches 02/03/04 — every batch that saw the spot',
  },
  {
    id: 'R7', kind: 'frequency',
    prose: 'I bet the flop, and when I am called I give up on the turn about half the time.',
    when: (d) => d.street === 'turn' && d.iAmLastPreflopAggressor && d.facing === 'no bet',
    rate: (d) => d.action === 'bet',
    origin: 'catalogue rule tn-give-up-when-called, SUPPORTED (67.7% -> 45.8%)',
  },
  {
    id: 'R8', kind: 'frequency',
    prose: 'If I did not raise before the flop, I fold to the first bet I face — and the '
      + 'cheaper it is, the more likely I am to stay.',
    when: (d) => d.street !== 'preflop' && !d.iAmLastPreflopAggressor && d.facing === 'a bet',
    rate: (d) => d.action === 'fold',
    split: (d) => d.potOddsNeeded == null ? null
      : d.potOddsNeeded < 0.28 ? 'cheap (<28%)' : 'standard or worse (>=28%)',
    origin: 'explainer batches 05/07/08/10/12 — independently in five batches',
  },
  {
    id: 'R9', kind: 'frequency',
    prose: 'Once I have called a bet, I am far more likely to call the next one too.',
    when: (d) => d.street !== 'preflop' && d.facing === 'a bet',
    rate: (d) => d.action !== 'fold',
    origin: 'catalogue rule dr-one-street-only, REFUTED in the opposite direction',
  },
];

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

const counts = new Map();
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    for (const pid of Object.values(h.seatPlayers || {})) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
}
const pid = TARGET || [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

const decisions = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
    if (seat) decisions.push(...labelDecisions(h, seat));
  }
}

const pct = (k, n) => (n ? (k / n) * 100 : 0);

// ── per-rule evaluation ──────────────────────────────────────────────────────
const results = [];
for (const r of RULESET) {
  const pool = decisions.filter(r.when);
  if (!pool.length) { results.push({ ...r, n: 0 }); continue; }

  if (r.kind === 'predict') {
    const right = pool.filter(d => r.predict(d) === d.action);
    // The control: always guess this context's most common action.
    const tally = new Map();
    for (const d of pool) tally.set(d.action, (tally.get(d.action) || 0) + 1);
    const majority = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    results.push({
      ...r, n: pool.length, correct: right.length,
      accuracy: pct(right.length, pool.length),
      baseline: pct(majority[1], pool.length),
      baselineAction: majority[0],
      exceptions: pool.filter(d => r.predict(d) !== d.action),
    });
  } else {
    const k = pool.filter(r.rate).length;
    const splits = [];
    if (r.split) {
      const g = new Map();
      for (const d of pool) {
        const s = r.split(d); if (s == null) continue;
        if (!g.has(s)) g.set(s, { k: 0, n: 0 });
        const x = g.get(s); x.n++; if (r.rate(d)) x.k++;
      }
      for (const [name, x] of g) if (x.n >= 10) splits.push({ name, k: x.k, n: x.n, rate: pct(x.k, x.n) });
    }
    results.push({ ...r, n: pool.length, k, rate: pct(k, pool.length), splits });
  }
}

// ── coverage of the whole player ─────────────────────────────────────────────
const governed = new Set();
for (const r of RULESET) for (const d of decisions.filter(r.when)) governed.add(d);
const predictPool = decisions.filter(d => RULESET.some(r => r.kind === 'predict' && r.when(d)));
const predictedRight = predictPool.filter(d => {
  const r = RULESET.find(x => x.kind === 'predict' && x.when(d));
  return r && r.predict(d) === d.action;
});

// Global control: predict the single most common action everywhere.
const globalTally = new Map();
for (const d of decisions) globalTally.set(d.action, (globalTally.get(d.action) || 0) + 1);
const globalMajority = [...globalTally.entries()].sort((a, b) => b[1] - a[1])[0];

console.log(`VILLAIN ${pid}`);
console.log(`${counts.get(pid)} hands · ${decisions.length} decisions\n`);
console.log('COVERAGE');
console.log(`  decisions some rule speaks to : ${governed.size}/${decisions.length} = ${pct(governed.size, decisions.length).toFixed(1)}%`);
console.log(`  decisions a rule PREDICTS     : ${predictPool.length}/${decisions.length} = ${pct(predictPool.length, decisions.length).toFixed(1)}%`);
console.log(`  of those, predicted correctly : ${predictedRight.length}/${predictPool.length} = ${pct(predictedRight.length, predictPool.length).toFixed(1)}%`);
console.log(`\n  CONTROL — always guess "${globalMajority[0]}": ${pct(globalMajority[1], decisions.length).toFixed(1)}% of all decisions.`);
console.log('  Any accuracy below that number is worse than knowing nothing.\n');

for (const r of results) {
  console.log('='.repeat(94));
  console.log(`${r.id}  [${r.kind}]  "${r.prose}"`);
  console.log(`     origin: ${r.origin}`);
  if (!r.n) { console.log('     NO DECISIONS MATCH — untestable on this villain.\n'); continue; }
  if (r.kind === 'predict') {
    const lift = r.accuracy - r.baseline;
    console.log(`     ${r.correct}/${r.n} correct = ${r.accuracy.toFixed(1)}%`);
    console.log(`     baseline (always "${r.baselineAction}") = ${r.baseline.toFixed(1)}%   LIFT ${lift >= 0 ? '+' : ''}${lift.toFixed(1)}pp`
      + `${Math.abs(lift) < 0.05 ? '  <- the rule IS the baseline; it adds nothing' : ''}`);
    if (r.exceptions.length) {
      const shown = r.exceptions.filter(d => d.handKnown);
      console.log(`     exceptions: ${r.exceptions.length}`
        + (shown.length ? ` — cards shown on ${shown.length}: ${shown.slice(0, 10).map(d => d.holeCards.join('')).join(' ')}` : ' — no cards ever shown'));
    }
  } else {
    console.log(`     ${r.k}/${r.n} = ${r.rate.toFixed(1)}%   (a rate, not a prediction)`);
    for (const s of r.splits || []) console.log(`        ${s.name.padEnd(26)} ${s.rate.toFixed(1).padStart(5)}%  (${s.k}/${s.n})`);
  }
  console.log('');
}

mkdirSync('.tmp-arch', { recursive: true });
writeFileSync('.tmp-arch/ruleset.json', JSON.stringify({
  pid, hands: counts.get(pid), decisions: decisions.length,
  coverage: {
    governed: governed.size, predictPool: predictPool.length,
    predictedRight: predictedRight.length,
    globalBaselineAction: globalMajority[0],
    globalBaseline: pct(globalMajority[1], decisions.length),
  },
  rules: results.map(r => ({
    id: r.id, kind: r.kind, prose: r.prose, origin: r.origin, n: r.n,
    accuracy: r.accuracy ?? null, baseline: r.baseline ?? null,
    baselineAction: r.baselineAction ?? null,
    rate: r.rate ?? null, splits: r.splits ?? null,
    exceptions: r.exceptions ? r.exceptions.length : null,
    exceptionCards: r.exceptions ? r.exceptions.filter(d => d.handKnown).map(d => d.holeCards.join('')) : null,
  })),
}, null, 1));
console.log('wrote .tmp-arch/ruleset.json');
