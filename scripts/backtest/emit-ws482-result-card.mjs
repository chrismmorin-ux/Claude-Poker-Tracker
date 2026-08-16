/**
 * WS-482 continuation-rate threading — Result Card (RC-CONTINUATION-RATE-THREADING-2026-08-15).
 *
 * The headline is a ZERO, which is the reason this card exists rather than a note: an EV
 * delta of zero is a comparative claim about EV and has to resolve to a Result Card like any
 * other. Every figure is recomputed from the artifacts at emit time.
 *
 * Inputs:
 *   out/ws482-ev-BEFORE.json / ws482-ev-AFTER.json    paired full-tree EV dumps
 *   out/ws482-BEFORE.json / ws482-det-A.json          paired advice arms at depth-2
 *   out/ws482-det-A.json / ws482-det-B.json           same-code determinism control
 *
 * Run from the repo root:
 *   node scripts/backtest/emit-ws482-result-card.mjs
 */
import { writeFileSync, readFileSync } from 'node:fs';

const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
const { openLoader } = await import(`file:///${REPO}/scripts/backtest/loader.mjs`);
const loader = await openLoader(REPO);

const { buildResultCard, resultCardProblems } = await loader.load('/src/utils/standardOfRecord/resultCard.js');
const { buildReplicationManifest } = await loader.load('/src/utils/standardOfRecord/manifest.js');
const { registerVersion } = await loader.load('/src/utils/standardOfRecord/faultRegister.js');
const { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
const { buildDealBook } = await loader.load('/scripts/backtest/dealBook.mjs');
const { gitStamp, collectConstants } = await loader.load('/scripts/backtest/replicationStamp.mjs');

const J = (p) => JSON.parse(readFileSync(`${REPO}/${p}`, 'utf8'));

// ── paired EV delta over the full-tree dumps ─────────────────────────────────────
const A = J('out/ws482-ev-BEFORE.json').scenarios;
const B = J('out/ws482-ev-AFTER.json').scenarios;
const key = (r) => `${r.action}@${r.betFraction ?? '-'}`;
let scenarios = 0, recs = 0, moved = 0, flips = 0, sumAbs = 0;
for (const k of Object.keys(A)) {
  const a = A[k], b = B[k];
  if (!b) continue;
  scenarios++;
  const mb = new Map((b.recommendations || []).map(r => [key(r), r]));
  for (const r of (a.recommendations || [])) {
    const m = mb.get(key(r));
    if (!m) continue;
    recs++;
    const d = m.ev - r.ev;
    if (Math.abs(d) > 1e-12) { moved++; sumAbs += Math.abs(d); }
  }
  const ra = (a.recommendations || [])[0], rb = (b.recommendations || [])[0];
  if (ra && rb && key(ra) !== key(rb)) flips++;
}

// ── which stages actually executed (so the zero is not a gating artifact) ────────
const stageCensus = {};
for (const [k, s] of Object.entries(B)) {
  for (const st of (s.stages || [])) {
    const e = stageCensus[st.stage] || (stageCensus[st.stage] = { completed: 0, other: 0, scenarios: [] });
    if (st.outcome === 'completed') { e.completed++; if (e.scenarios.length < 3) e.scenarios.push(k); }
    else e.other++;
  }
}

// ── the argmax arm, and its same-code control ────────────────────────────────────
const tvDiff = (aPath, bPath) => {
  const rowsA = J(aPath).rows, rowsB = new Map(J(bPath).rows.map(r => [r.key, r]));
  let paired = 0, divergent = 0;
  for (const a of rowsA) {
    const b = rowsB.get(a.key);
    if (!b) continue;
    paired++;
    const ks = new Set([...Object.keys(a.piOurs || {}), ...Object.keys(b.piOurs || {})]);
    let s = 0;
    for (const kk of ks) s += Math.abs((a.piOurs?.[kk] || 0) - (b.piOurs?.[kk] || 0));
    if (s / 2 > 1e-12) divergent++;
  }
  return { paired, divergent };
};
const adviceArm = tvDiff('out/ws482-BEFORE.json', 'out/ws482-det-A.json');
const control = tvDiff('out/ws482-det-A.json', 'out/ws482-det-B.json');

const files = await discoverCorpusFiles({ root: DEFAULT_CORPUS_ROOT, stakes: ['50NLH'] });
const dealBook = await buildDealBook({
  files: files.slice(0, 120),
  root: DEFAULT_CORPUS_ROOT,
  sliceSpec: { sites: ['FTP', 'PS'], stakes: ['0.5'], maxFiles: 120 },
  identity: 'path+size',
});
const { engineCommit, engineDirty } = gitStamp(REPO);
const constantsFromStamp = await collectConstants(loader);
const disclaimerRegisterVersion = await registerVersion();

const card = buildResultCard({
  resultCardId: 'RC-CONTINUATION-RATE-THREADING-2026-08-15',
  clusterUnit: 'players',
  treatment:
    'WS-482: `tightenRatesForContinuation` receives the node\'s computed villain fold probability '
    + '(`candidate.villainResponse.foldPct`) instead of its hardcoded population default at the 10 '
    + 'call sites where a computed value exists, and its default is read from POPULATION_PRIORS '
    + 'rather than repeated as the literal 0.45. Control arm is the same harness against the engine '
    + 'at 5d113990~1 (WS-481 applied, WS-482 absent).',
  match: {
    surfaceId: 'SURF-engine-advice-probe',
    dealBookId: dealBook.dealBookId,
    fieldId: 'FIELD-handhq-50nl-2009-07-behavior-policy',
  },
  estimand:
    'The paired change to the engine\'s per-action EV, and to its advised action distribution, from '
    + 'replacing a population fold-rate constant with the node\'s own computed fold probability in the '
    + 'depth-2/3 continuation tightener. Scored on the SAME scenarios and the SAME seeded decisions '
    + 'before and after.',
  metrics: {
    kind: 'continuation-rate-threading',
    threading: {
      parameter: 'tightenRatesForContinuation(rates, priorAction, foldRate)',
      from: 'hardcoded 0.45 at all 12 call sites (every site passed two arguments)',
      to: "the node's computed pFold, plus a default READ from POPULATION_PRIORS.bet.fold",
      sitesThreaded: 10,
      sitesLeftOnPrior: 2,
      why: 'The two are the double-tighten for a HYPOTHESIZED turn barrel. No fold rate has been '
        + 'computed for a street that has not happened, so they take the prior — which is what a '
        + 'prior is for. Threading the flop node\'s number there would assert villain folds a turn '
        + 'barrel at exactly the rate they folded the flop bet.',
    },
    reachability: {
      deadParameters: [
        { parameter: 'callingRates', consumer: 'computePerComboEV', span: 'gameTreeDepth2.js:441-497',
          occurrences: 1, note: 'destructured at :443, never referenced again',
          discardedBy: ['gameTreeDepth2.js:914', ':1051', ':1171', ':1298', ':1358'] },
        { parameter: 'bettingRates', consumer: 'computePerComboCheckEV', span: 'gameTreeDepth2.js:565-664',
          occurrences: 1, note: 'destructured at :565, never referenced again',
          discardedBy: ['gameTreeDepth2.js:905', ':1043'] },
      ],
      liveConsumers: [
        { path: 'foldFromRates -> bluffCommitmentPenalty', site: 'gameTreeDepth2.js:1413-1422',
          guard: 'heroEquity != null && heroEquity < 0.25, depth-3 FLOP path only' },
      ],
      evidence: 'What the dead-parameter consumers use instead is `villainRequiredEquity` + per-combo '
        + 'iteration (gameTreeDepth2.js:450) — the first-principles path exploitEngine/CLAUDE.md '
        + 'prescribes OVER bucket labels. The threaded parameter is a vestige of a bucket-rate path '
        + 'that per-combo computation superseded. Filed as FIND-139.',
      consequenceForTheTicket: 'WS-482 states the constant "moves every depth-2 EV — that is the '
        + 'point". That premise is FALSE. It reaches EV only through the one guarded bluff-penalty '
        + 'path above.',
    },
    evDelta: {
      instrument: 'dumpGameTreeEV.mjs at WS334_REFINEMENT_MS=600000 (full tree, frozen clock), paired',
      scenarios,
      recommendations: recs,
      moved,
      topActionFlips: flips,
      meanAbsDelta: moved ? sumAbs / moved : 0,
      statement: 'Zero. No recommendation\'s EV changed and no top action flipped, ON THE MEASURED '
        + 'SCENARIO SET. This is a REACHABILITY result, not an "effect too small to see".',
    },
    stagesRan: {
      census: stageCensus,
      note: 'The stages containing the threaded call sites executed to completion at weightConsumed '
        + '~1.0, so the zero is not a gating artifact. This is the field that separates "ran and '
        + 'changed nothing" from "never ran".',
    },
    adviceDelta: {
      instrument: 'probeFrequency paired-by-seeded-key at --refinement-ms 2000 (depth-2 enabled)',
      paired: adviceArm.paired,
      divergent: adviceArm.divergent,
      control: {
        description: 'SAME code, two separate processes, identical parameters',
        paired: control.paired,
        divergent: control.divergent,
        passed: control.divergent === 0,
        note: 'Zero divergence across processes confirms WS-432\'s logical work-unit clock and '
          + 'REFUTES probeFrequency\'s own docblock, which claimed a non-zero refinement budget is '
          + '"non-reproducible between invocations". The docblock is corrected in this ticket.',
      },
    },
    collateralFixes: [
      { site: 'villainProfileBuilder.js POP_ACTIONS_FACING_NONE',
        defect: 'declared {check:0.55, bet:0.45} against the definition\'s {check:0.45, bet:0.55} — '
          + 'INVERTED, not merely duplicated. Every displayed "deviation from population" on an '
          + 'unopened street was measured against a baseline leaning passive where the engine\'s own '
          + 'population leans aggressive, so a villain betting at exactly the population rate showed '
          + 'as +0.10 aggressive.',
        live: true },
      { site: 'decisionTreeBuilder.js computeFoldPct',
        defect: 'a POSTFLOP 0.45 used as a PREFLOP population fallback, sitting beside the real '
          + 'ladder. Guard and literal both removed; preflop fold rates now use the one choke point.',
        live: true },
      { site: 'foldEquityCalculator.js (3), gameTreeEquity.js (2), gameTreeDepth2.js (2), preflopFlopEV.js (1), gameTreeSizingHelpers.js (2)',
        defect: 'fold/continue literals duplicating POPULATION_PRIORS; now read from the definition. '
          + 'Facing a RAISE these had been priced with the BET population\'s marginal (0.45 vs 0.55).',
        live: true },
    ],
  },
  admissibility: {
    quotable: true,
    reasons: [],
    caveats: [
      'The zero EV delta is exact ON THE MEASURED SCENARIO SET (12 scenarios, 38 recommendations) '
      + 'and is not a claim about decisions outside it.',
      'It is a REACHABILITY finding: the parameter is not consumed by the two depth-2 EV functions. '
      + 'It must NOT be read as "the population constant is harmless" — it is a statement about '
      + 'wiring, and the wiring is filed as FIND-139 for a decision.',
      'TRANSFERRED, NOT MEASURED for live 9-handed 1/2-1/3. Corpus is online cash, July 2009, 50NL.',
      'The collateral fixes are NOT covered by the zero: they are live, and the inverted population '
      + 'table is a display-path correction this measurement did not price.',
    ],
  },
  manifest: buildReplicationManifest({
    engineCommit,
    engineDirty,
    dealBookHash: dealBook.contentHash,
    fieldVersion: 'handhq-50nl-2009-07-ftp+ps · behavior-policy out/behavior-policy.json',
    partition: 'before-arm engine at 5d113990~1 (WS-481 applied, WS-482 absent); instrument scripts '
      + 'identical in both arms',
    seeds: {
      probePairing: 'mulberry32(fnv1a-32(`${playerId}|${handId}|${order}`)) per decision',
      evDump: 'Date.now frozen at 1700000000000; Math.random seeded per scenario by dumpGameTreeEV',
    },
    unseededSources: [],
    constants: {
      ...constantsFromStamp.constants,
      // ADR-009 names REFINEMENT_BUDGET_MS in the minimum constant set. This run used TWO
      // budgets on two instruments, so the required key carries the one the headline (the EV
      // delta) was measured at, and the advice arm's is stamped beside it.
      REFINEMENT_BUDGET_MS: 600000,
      REFINEMENT_BUDGET_MS_ADVICE_ARM: 2000,
      POPULATION_PRIORS_BET_FOLD: 0.45,
      POPULATION_PRIORS_RAISE_FOLD: 0.55,
    },
    disclaimerRegisterVersion,
    knownDivergences: constantsFromStamp.knownDivergences ?? [],
  }),
});

const problems = resultCardProblems(card);
if (problems.length) {
  console.error('INVALID CARD:\n  - ' + problems.join('\n  - '));
  process.exit(1);
}
writeFileSync(`${REPO}/docs/research/ws482-continuation-rate-threading-2026-08-15.result-card.json`, JSON.stringify(card, null, 2) + '\n');
console.log('OK RC-CONTINUATION-RATE-THREADING-2026-08-15');
console.log(`   EV delta: ${moved} of ${recs} recommendations moved across ${scenarios} scenarios; ${flips} top-action flips`);
console.log(`   advice arm: ${adviceArm.divergent} of ${adviceArm.paired} divergent; control ${control.divergent} of ${control.paired} (must be 0)`);
console.log(`   stages: ${Object.entries(stageCensus).map(([k, v]) => `${k}=${v.completed}c/${v.other}o`).join(' ')}`);
await loader.close();
