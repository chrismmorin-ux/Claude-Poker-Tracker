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

import { estimateEdge, TREATMENT, DEFAULT_BOOTSTRAP_SEED } from './ipsEstimator.mjs';
import { applyFoldShift } from './behaviorPolicy.mjs';
import { buildResultCard, resultCardProblems } from '../../src/utils/standardOfRecord/resultCard.js';
import { buildReplicationManifest } from '../../src/utils/standardOfRecord/manifest.js';

const CORPUS_CAVEAT =
  'HandHQ online cash, July 2009, numeric stakes (SRC-011). Measures advice against THAT ' +
  'population. Live 1/2 generalisation is an assumption, not a result.';

/**
 * Schema version of the emitted report. Bump on any breaking change to the shape.
 * Consumers should refuse a version they do not understand rather than duck-type it.
 *
 * v2 (WS-322) — ADDITIVE. The report gained a `resultCard` block conforming to the ADR-009
 * Standard of Record. Every pre-existing field is unchanged and in the same place, so
 * `model-readiness.mjs` and `scorecard-history.yaml` read exactly what they read before.
 */
export const HERO_EV_SCHEMA_VERSION = 2;

/**
 * The estimand, stated in words.
 *
 * ADR-009's AS-710 turns on two instruments measuring THE SAME QUANTITY — corpus substitution
 * at a one-decision horizon, and the population simulator over a full hand. Their agreement is
 * what licenses a total-EV claim, and agreement is meaningless unless both name what they are
 * estimating. The units subtlety is load-bearing and already documented in `renderHeroEvReport`:
 * the outcome attached to a decision is the WHOLE HAND's net for hero, so these are hand-scale
 * magnitudes, and reading them as a winrate overstates them by the decisions-per-hand factor.
 */
const HERO_EV_ESTIMAND =
  'Expected hand value for hero in bb, attributed at the decision level, relative to '
  + 'population-typical play on the same decision. NOT a per-decision increment and NOT a winrate.';

/**
 * Minimum contributing PLAYERS before a confidence interval may be believed.
 *
 * The CI is a cluster bootstrap over players (`ipsEstimator.clusterBootstrapCI`), which is
 * the right design — decisions inside one player are not independent. But a bootstrap can
 * only resample the clusters it has. With k=3, 2000 resamples explore about ten distinct
 * multisets, so the bootstrap distribution is severely under-dispersed and the interval
 * comes out narrow because the sample is small, not because the estimate is precise.
 *
 * Observed live 2026-07-31: an interrupted run with THREE contributing players reported
 * edge +16.72 bb, CI [7.52, 23.42], and `c3Passes: true` — on a gate that decides whether
 * the founder stops building and starts studying. Nothing was wrong with the arithmetic;
 * the sample simply could not support the claim, and nothing in the artifact said so.
 *
 * 30 follows the ordinary convention for cluster-robust inference (below roughly 30-50
 * clusters, asymptotic and naive-bootstrap intervals under-cover and corrections are
 * expected). It is a JUDGEMENT CALL, deliberately named, exported, and stamped into every
 * report as `minClustersForCI` so a consumer can see which bar was applied. Moving it is a
 * `/decide`, not an edit.
 */
export const MIN_CLUSTERS_FOR_CI = 30;

/** The control is scored against itself; anything but zero means manufactured signal. */
const CONTROL_TOLERANCE_BB = 1e-6;

/**
 * Decide whether this report may be QUOTED, and say why not when it may not.
 *
 * Computed once here so that every consumer — the readiness gate, a dashboard, a future
 * FSA surface — inherits one verdict instead of each re-deriving the rules and one of them
 * getting it wrong. This is the same principle the promoted data-source registry applies to
 * every other number in the repo: an artifact states its own scope and limits.
 */
const assessAdmissibility = (run, arms) => {
  const clusters = arms.engineRaked.players ?? 0;
  const blockers = [];
  const warnings = [];

  if (run.complete === false) {
    blockers.push({
      code: 'INCOMPLETE_RUN',
      detail: `Run did not finish (${run.decisionsScored ?? arms.engineRaked.n} decisions scored). `
        + 'EVAL players are processed sequentially, so a partial is a biased subsample of the '
        + 'first players, not a random one.',
    });
  }

  if (!arms.engineRaked.n) {
    blockers.push({ code: 'NO_DECISIONS', detail: 'No decisions were scored; every figure is vacuous.' });
  }

  if (clusters < 2) {
    blockers.push({
      code: 'NO_CI_POSSIBLE',
      detail: `Only ${clusters} contributing player(s). A cluster bootstrap needs at least 2 and returns null below that.`,
    });
  } else if (clusters < MIN_CLUSTERS_FOR_CI) {
    blockers.push({
      code: 'TOO_FEW_CLUSTERS',
      detail: `${clusters} contributing players is below the ${MIN_CLUSTERS_FOR_CI}-cluster bar. `
        + 'The bootstrap cannot represent between-player variance at this k, so a narrow CI '
        + 'reflects sample size rather than precision. Between-player variance is the dominant '
        + 'term in this estimate — it is what moved the edge across earlier runs at fixed n.',
    });
  }

  const ctrl = arms.populationControl;
  if (ctrl.n && (ctrl.edgeBB === null || Math.abs(ctrl.edgeBB) >= CONTROL_TOLERANCE_BB)) {
    blockers.push({
      code: 'CONTROL_DRIFT',
      detail: `Control scored ${ctrl.edgeBB} bb against itself; it must be 0. The estimator is `
        + 'manufacturing signal and no figure in this report means anything.',
    });
  }

  if (arms.engineRaked.n && arms.engineRaked.essShare !== null && arms.engineRaked.essShare < 0.2) {
    warnings.push({
      code: 'LOW_ESS',
      detail: `Effective sample is ${arms.engineRaked.ess} (${(arms.engineRaked.essShare * 100).toFixed(1)}% of n). `
        + 'Importance weights are concentrated; the interval is wider than n suggests.',
    });
  }

  return {
    admissible: blockers.length === 0,
    blockers,
    warnings,
    clusters,
    minClustersForCI: MIN_CLUSTERS_FOR_CI,
    complete: run.complete !== false,
  };
};

/** Deterministic always-fold/check policy — one of the two required baselines. */
const passivePolicy = (piOurs) => {
  const out = {};
  for (const a of Object.keys(piOurs)) out[a] = 0;
  if ('fold' in out) out.fold = 1;          // facing a bet: fold
  else if ('check' in out) out.check = 1;   // first to act / checked to: check
  return out;
};

const withNet = (decisions, field) => decisions.map((d) => ({ ...d, netBB: d[field] }));

/**
 * Map this run onto a Result Card (ADR-009).
 *
 * Almost nothing here is new information — `treatment`, `admissibility` and the arms already
 * existed and were already the right objects. What the Result Card adds is the MATCH (which
 * surface, against which Deal Book, against which Field) and the replication manifest, which
 * is what lets this figure be compared to another one and re-derived later.
 *
 * Returns `{ resultCard, resultCardProblems }` rather than throwing. A run that produced a
 * real measurement must still write its artifact when the stamp is incomplete — a smoke run
 * with no Deal Book is a legitimate thing to do — and the problems list says exactly why the
 * card is not quotable. That mirrors how `admissibility` already works: compute the verdict,
 * state the blockers, never silently suppress the arithmetic.
 */
const buildCardFor = (run, arms, headline) => {
  const stamp = run.replicationStamp ?? null;
  if (!stamp) {
    return {
      resultCard: null,
      resultCardProblems: [
        'no replication stamp on the run — this figure cannot be replicated and must not be '
        + 'quoted. Pass a Deal Book and stamp via run-hero-ev.mjs to produce a Result Card.',
      ],
    };
  }

  try {
    const manifest = buildReplicationManifest(stamp);
    const resultCard = buildResultCard({
      resultCardId: `RC-hero-ev-${stamp.dealBookHash.replace('sha256:', '').slice(0, 8)}-${stamp.engineCommit.slice(0, 8)}`,
      match: {
        surfaceId: run.surfaceId ?? 'engine-read',
        dealBookId: run.dealBook?.dealBookId ?? null,
        fieldId: run.fieldId ?? 'pool-mined-behavior-policy',
      },
      estimand: HERO_EV_ESTIMAND,
      treatment: TREATMENT,
      metrics: {
        edgeBB: headline.edgeBB,
        edgeCiLowBB: headline.edgeCiLowBB,
        edgeCiHighBB: headline.edgeCiHighBB,
        n: headline.n,
        ess: headline.ess,
        players: headline.players,
        controlEdgeBB: arms.populationControl.edgeBB,
        liveShiftedCiLowBB: arms.liveShifted.edgeCiLowBB,
      },
      // PLAYERS, not hands. The CI is a cluster bootstrap over players because decisions
      // inside one player are not independent (POKER_THEORY 14.3).
      clusterUnit: 'players',
      admissibility: assessAdmissibility(run, arms),
      manifest,
    });
    return { resultCard, resultCardProblems: [] };
  } catch (err) {
    // The card could not be built. Say why, in the artifact, rather than omitting it.
    const partial = { ...stamp };
    return {
      resultCard: null,
      resultCardProblems: [err?.message || String(err), ...resultCardProblems({ manifest: partial })],
    };
  }
};

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
  const admissibility = assessAdmissibility(run, arms);

  const gate = {
    // C3 bar: edge positive with a 95% CI excluding zero, in BOTH the corpus arm and
    // the live-shifted arm (founder decision 2026-07-28).
    heroEvEdge: headline.edgeBB,
    heroEvCiLow: headline.edgeCiLowBB,
    corpusArmPasses: headline.edgeCiLowBB !== null && headline.edgeCiLowBB > 0,
    liveShiftedArmPasses: arms.liveShifted.edgeCiLowBB !== null && arms.liveShifted.edgeCiLowBB > 0,
  };

  // ADMISSIBILITY GATES THE VERDICT, not just the commentary. Before this, `c3Passes` was
  // computed purely from the two CI signs, so an interrupted 3-player run reported PASS on
  // the criterion that decides whether the founder stops building. A consumer reading
  // `c3Passes` must never have to ALSO know to check the player count — that is precisely
  // the knowledge that fails to travel.
  gate.c3Passes = admissibility.admissible && gate.corpusArmPasses && gate.liveShiftedArmPasses;
  gate.admissible = admissibility.admissible;
  gate.blockedBy = admissibility.blockers.map((b) => b.code);
  // Preserved so the underlying arithmetic is still visible when admissibility blocks it —
  // suppressing the number entirely would hide a trend that is worth watching across runs.
  gate.armsWouldPass = gate.corpusArmPasses && gate.liveShiftedArmPasses;

  const card = buildCardFor(run, arms, headline);

  return {
    schemaVersion: HERO_EV_SCHEMA_VERSION,
    caveat: CORPUS_CAVEAT,
    treatment: TREATMENT,
    admissibility,
    // ADR-009 Standard of Record (WS-322). Additive — everything below this line predates it
    // and is unchanged.
    resultCard: card.resultCard,
    resultCardProblems: card.resultCardProblems,
    // Provenance, stamped so a downstream consumer can trace this artifact without
    // re-deriving it. Source ids are the promoted registry's (docs/provenance/).
    provenance: {
      sources: ['SRC-012', 'SRC-015'],
      corpus: 'HandHQ online cash, July 2009, numeric stakes',
      reference: run.integrity?.reference ?? null,
      partition: run.integrity?.behaviorPolicy?.partition ?? null,
      behaviorPolicyObservations: run.integrity?.behaviorPolicy?.observations ?? null,
      behaviorPolicyPlayers: run.integrity?.behaviorPolicy?.players ?? null,
      rakeModelled: run.config?.rakeIsModelled ?? null,
      complete: run.complete !== false,
    },
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

  const adm = r.admissibility;
  if (adm && !adm.admissible) {
    // The arithmetic verdict is shown, then explicitly overruled. Printing a bare FAIL
    // would hide a positive trend; printing a bare PASS would licence quoting a number the
    // sample cannot support. Say both, in that order.
    L.push('');
    L.push(`    *** NOT ADMISSIBLE — C3 CANNOT PASS FROM THIS RUN ***`);
    L.push(`    (the two arms above would${adm && r.gate.armsWouldPass ? '' : ' not'} pass on CI sign alone; that is not sufficient)`);
    for (const b of adm.blockers) L.push(`      - ${b.code}: ${b.detail}`);
    L.push(`    contributing players ${adm.clusters} (bar: ${adm.minClustersForCI})`);
    L.push(`    C3: FAIL (inadmissible)`);
  } else {
    L.push(`    contributing players ${adm ? adm.clusters : '—'} (bar: ${adm ? adm.minClustersForCI : '—'})`);
    L.push(`    C3: ${r.gate.c3Passes ? 'PASS' : 'FAIL'}`);
  }
  for (const w of (adm?.warnings ?? [])) L.push(`      ! ${w.code}: ${w.detail}`);
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
  L.push('  STANDARD OF RECORD (ADR-009)');
  L.push('  ' + '─'.repeat(90));
  if (r.resultCard) {
    const m = r.resultCard.manifest;
    L.push(`    Result Card ${r.resultCard.resultCardId}`);
    L.push(`    engine ${m.engineCommit.slice(0, 12)}${m.engineDirty ? ' (DIRTY TREE — the commit does not identify the code that ran)' : ''}`);
    L.push(`    deal book ${r.resultCard.match.dealBookId} ${m.dealBookHash.slice(0, 20)}…`);
    L.push(`    cluster unit ${r.resultCard.clusterUnit}   seeds ${JSON.stringify(m.seeds)}`);
    if (m.unseededSources.length) {
      L.push(`    NOT bit-reproducible — ${m.unseededSources.length} unseeded source(s):`);
      for (const s of m.unseededSources) L.push(`      - ${s.source} (${s.mechanism})`);
    }
  } else {
    L.push('    *** NO RESULT CARD — this figure is not replicable and must not be quoted ***');
    for (const p of (r.resultCardProblems ?? [])) L.push(`      - ${p}`);
  }
  L.push('');
  L.push('─'.repeat(94));
  L.push('  ' + r.caveat);
  L.push('═'.repeat(94));
  return L.join('\n');
};
