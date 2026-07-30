/**
 * heroEvReport.mjs — assemble and render the hero-EV result.
 *
 * Three rules this module enforces structurally rather than by convention:
 *
 *   1. NO FIGURE WITHOUT ITS TREATMENT. The ticket is explicit — "never report a number
 *      without the treatment named". `renderHeroEvReport` throws rather than print an
 *      arm whose `treatment` is missing.
 *   2. THE CONTROL MUST COME OUT AT ZERO. Scoring the behaviour policy against itself
 *      has to yield an edge of exactly zero. It is printed every run, because if it
 *      ever drifts the instrument is manufacturing signal and no other row on the page
 *      means anything.
 *   3. RAKE BOTH WAYS. An edge that survives unraked and vanishes under rake is a
 *      vanished edge, and the run says so rather than quoting the flattering arm.
 */

import { estimateEdge, TREATMENT } from './ipsEstimator.mjs';
import { applyFoldShift } from './behaviorPolicy.mjs';

const CORPUS_CAVEAT =
  'HandHQ online cash, July 2009, numeric stakes (SRC-011). Measures advice against THAT ' +
  'population. Live 1/2 generalisation is an assumption, not a result.';

/** Deterministic always-fold/check policy — one of the two required baselines. */
const passivePolicy = (piOurs) => {
  const out = {};
  for (const a of Object.keys(piOurs)) out[a] = 0;
  if ('fold' in out) out.fold = 1;          // facing a bet: fold
  else if ('check' in out) out.check = 1;   // first to act / checked to: check
  return out;
};

const withNet = (decisions, field) => decisions.map((d) => ({ ...d, netBB: d[field] }));

export const buildHeroEvReport = (run, { foldShiftPp = 13, weightCap = 20 } = {}) => {
  const d = run.decisions;
  const opts = { weightCap };

  const arms = {
    // Headline: the engine's advice, rake-inclusive.
    engineRaked: estimateEdge(d, { ...opts, label: 'engine advice (rake modelled)' }),

    // Same advice, rake removed from the ledger only.
    engineUnraked: estimateEdge(
      withNet(d.filter((x) => Number.isFinite(x.netBBUnraked)), 'netBBUnraked'),
      { ...opts, label: 'engine advice (no rake)' },
    ),

    // Baseline 1 — always fold / always check.
    passive: estimateEdge(
      d.map((x) => ({ ...x, piOurs: passivePolicy(x.piOurs) })),
      { ...opts, label: 'baseline: always fold/check' },
    ),

    // Baseline 2 / CONTROL — population-typical play. Scoring the behaviour policy
    // against itself must give exactly zero. See rule 2 in the header.
    populationControl: estimateEdge(
      d.map((x) => ({ ...x, piOurs: x.piPool })),
      { ...opts, label: 'control: population-typical (must be 0)' },
    ),

    // Sensitivity — the field folds `foldShiftPp` points more often. Founder decision
    // 2026-07-28: certify structure, stress-test the value. C3 passes only if the edge
    // holds here too.
    liveShifted: estimateEdge(
      d.map((x) => ({ ...x, piPool: applyFoldShift(x.piPool, foldShiftPp) })),
      { ...opts, label: `sensitivity: field folds +${foldShiftPp}pp` },
    ),
  };

  const headline = arms.engineRaked;
  const gate = {
    // C3 bar: edge positive with a 95% CI excluding zero, in BOTH the corpus arm and
    // the live-shifted arm (founder decision 2026-07-28).
    heroEvEdge: headline.edgeBB,
    heroEvCiLow: headline.edgeCiLowBB,
    corpusArmPasses: headline.edgeCiLowBB !== null && headline.edgeCiLowBB > 0,
    liveShiftedArmPasses: arms.liveShifted.edgeCiLowBB !== null && arms.liveShifted.edgeCiLowBB > 0,
  };
  gate.c3Passes = gate.corpusArmPasses && gate.liveShiftedArmPasses;

  return {
    caveat: CORPUS_CAVEAT,
    treatment: TREATMENT,
    generatedFrom: {
      config: run.config,
      counters: run.counters,
      integrity: run.integrity,
      runtimeMs: run.runtimeMs ?? null,
    },
    arms,
    gate,
    foldShiftPp,
  };
};

const pct = (x) => (x === null || x === undefined ? '—' : `${(x * 100).toFixed(1)}%`);
const bb = (x) => (x === null || x === undefined ? '—' : x.toFixed(3));

const renderArm = (a) => {
  if (!a.treatment) {
    throw new Error(`hero-EV arm "${a.label}" has no treatment — refusing to render it`);
  }
  if (!a.n) return `  ${String(a.label).padEnd(42)} no scorable decisions`;
  const ci = (a.edgeCiLowBB === null)
    ? 'CI —'
    : `[${bb(a.edgeCiLowBB)}, ${bb(a.edgeCiHighBB)}]`;
  return `  ${String(a.label).padEnd(42)} ${bb(a.edgeBB).padStart(8)} bb   ${ci.padStart(20)}   n=${String(a.n).padStart(5)}  ESS=${String(a.ess).padStart(7)}`;
};

export const renderHeroEvReport = (r) => {
  const L = [];
  L.push('');
  L.push('═'.repeat(94));
  L.push('  HERO-EV — does the engine\'s ADVICE make money?');
  L.push('═'.repeat(94));
  L.push('');
  L.push(`  TREATMENT: ${r.treatment}`);
  L.push('  Read as: "take our advice at this ONE decision, then the hand plays on as it actually did."');
  L.push('');
  // UNITS, stated precisely: the outcome attached to a decision is the whole HAND's
  // net for hero, so the estimand is expected hand value, evaluated at the decision
  // level — not a per-decision increment. A hand with a 30bb swing contributes ±30 to
  // every decision it contains, which is why these magnitudes are hand-scale. Reading
  // them as a winrate would overstate them by roughly the decisions-per-hand factor.
  L.push('  EDGE vs population-typical play — bb per HAND, attributed at the decision level');
  L.push('  ' + '─'.repeat(90));
  for (const key of ['engineRaked', 'engineUnraked', 'passive', 'liveShifted', 'populationControl']) {
    L.push(renderArm(r.arms[key]));
  }
  L.push('');

  const h = r.arms.engineRaked;
  L.push('  WEIGHT DIAGNOSTICS (headline arm)');
  L.push('  ' + '─'.repeat(90));
  if (!h.n) {
    L.push('    No decisions were scored. Everything below is vacuous — see INTEGRITY for why.');
  } else {
    L.push(`    decisions ${h.n}   players ${h.players}   effective sample ${h.ess} (${pct(h.essShare)} of n)`);
    L.push(`    mean weight ${h.meanWeight}   clipped at ${h.weightCap}: ${pct(h.clippedShare)}`);
    L.push(`    plain IPS ${bb(h.valueOursPlainIpsBB)} bb vs self-normalized ${bb(h.valueOursBB)} bb`);
    if (Object.keys(h.skipped || {}).length) L.push(`    unscorable: ${JSON.stringify(h.skipped)}`);
  }
  L.push('');

  // The control is only meaningful once something was scored; an empty run must not
  // print a scary failure banner for a condition it never tested.
  const ctrl = r.arms.populationControl;
  if (ctrl.n) {
    const ctrlOk = ctrl.edgeBB !== null && Math.abs(ctrl.edgeBB) < 1e-6;
    L.push(`  CONTROL ${ctrlOk ? 'OK' : '*** FAILED ***'} — population-typical scored against itself: edge ${bb(ctrl.edgeBB)} bb`);
    if (!ctrlOk) {
      L.push('    The control must be exactly zero. It is not, so the estimator is producing');
      L.push('    signal from nothing and NO figure above is trustworthy.');
    }
  } else {
    L.push('  CONTROL NOT RUN — no decisions were scored.');
  }
  L.push('');

  L.push('  GATE C3');
  L.push('  ' + '─'.repeat(90));
  L.push(`    corpus arm        edge ${bb(r.gate.heroEvEdge)} bb, CI low ${bb(r.gate.heroEvCiLow)}  →  ${r.gate.corpusArmPasses ? 'PASS' : 'FAIL'}`);
  L.push(`    live-shifted arm  CI low ${bb(r.arms.liveShifted.edgeCiLowBB)}  →  ${r.gate.liveShiftedArmPasses ? 'PASS' : 'FAIL'}`);
  L.push(`    C3: ${r.gate.c3Passes ? 'PASS' : 'FAIL'}`);
  L.push('');

  const c = r.generatedFrom.counters;
  L.push('  INTEGRITY');
  L.push('  ' + '─'.repeat(90));
  L.push(`    eval players ${c.evalPlayers}, hands read ${c.handsRead}, checkpoints ${c.checkpoints}`);
  L.push(`    behaviour policy: ${r.generatedFrom.integrity.behaviorPolicy.observations} pool decisions from ` +
         `${r.generatedFrom.integrity.behaviorPolicy.players} POOL players (${r.generatedFrom.integrity.behaviorPolicy.partition})`);
  L.push(`    walk-forward assertions: ${r.generatedFrom.integrity.decisionsChecked ?? '—'}`);
  if (Object.keys(c.outcomeUnresolved || {}).length) L.push(`    outcomes unresolved: ${JSON.stringify(c.outcomeUnresolved)}`);
  if (Object.keys(c.policySkips || {}).length) L.push(`    policy skips: ${JSON.stringify(c.policySkips)}`);
  L.push(`    rake: ${r.generatedFrom.config.rakeConfig ? JSON.stringify(r.generatedFrom.config.rakeConfig) + ' (MODELLED — corpus records none)' : 'none'}`);
  L.push(`    runtime ${((r.generatedFrom.runtimeMs ?? 0) / 1000).toFixed(1)}s`);
  L.push('');
  L.push('─'.repeat(94));
  L.push('  ' + r.caveat);
  L.push('═'.repeat(94));
  return L.join('\n');
};
