#!/usr/bin/env node
/**
 * model-readiness.mjs — evaluate the Model Readiness Gate.
 *
 * The gate (docs/domain/MODEL_READINESS_GATE.md) defines, in advance and in numbers,
 * the point at which the poker model is accurate AND stable enough that the founder
 * should stop building and start studying.
 *
 * DESIGN RULE THAT MATTERS MORE THAN THE MATH: this script must never report a
 * criterion as met when it cannot actually verify it. Criteria that depend on human
 * judgment (what counts as "load-bearing", whether an algorithm is "documented") are
 * read from ledger files with an attestation date, and a STALE attestation FAILS.
 * An optimistic default here would quietly certify a theory nobody checked — the same
 * class of error the gate exists to prevent.
 *
 * USAGE
 *   node scripts/readiness/model-readiness.mjs             human summary
 *   node scripts/readiness/model-readiness.mjs --json      machine-readable
 *   node scripts/readiness/model-readiness.mjs --banner    banner only, when OPEN
 *   node scripts/readiness/model-readiness.mjs --record    append current run to history
 *
 * EXIT CODES  0 = gate OPEN · 1 = gate CLOSED · 2 = evidence missing or stale
 */

import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const p = (...s) => resolve(ROOT, ...s);

const GATE_DOC = 'docs/domain/MODEL_READINESS_GATE.md';
const HISTORY = p('docs/domain/readiness/scorecard-history.yaml');
const OVERTURNS = p('docs/domain/readiness/overturn-ledger.yaml');

// Thresholds — MIRRORED FROM THE GATE DOC. Changing one here without changing it
// there (and recording the founder decision) is exactly the silent-bar-move the doc
// forbids. Keep them together.
const BAR = {
  accuracy: 0.60,
  lift: 0.08,
  calibration: 0.050,
  stableRuns: 3,
  noRegressionRuns: 3,
};

// ---------------------------------------------------------------------------
// Minimal YAML reading. The files here are flat enough not to warrant a dep, but
// that is a constraint on the FILES: keep them simple, or bring in a parser.
// ---------------------------------------------------------------------------
const readScalar = (text, key) => {
  const m = text.match(new RegExp(`^\\s*${key}:\\s*(.+)$`, 'm'));
  if (!m) return null;
  let v = m[1].trim().replace(/\s+#.*$/, '').replace(/^["']|["']$/g, '');
  if (v === 'null' || v === '~' || v === '') return null;
  return v;
};
const num = (v) => (v === null ? null : Number(v));

const daysSince = (isoDate) => {
  if (!isoDate) return Infinity;
  const then = Date.parse(isoDate);
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((Date.now() - then) / 86400000);
};

/** Parse the append-only history into an ordered list of runs (oldest first). */
const parseHistory = (text) => {
  const blocks = text.split(/^\s*-\s+date:/m).slice(1);
  return blocks.map((b) => {
    const body = 'date:' + b;
    return {
      date: readScalar(body, 'date'),
      label: readScalar(body, 'label'),
      source: readScalar(body, 'source'),
      accuracy: num(readScalar(body, 'accuracy')),
      logLoss: num(readScalar(body, 'logLoss')),
      lift: num(readScalar(body, 'lift')),
      worstCalibrationError: num(readScalar(body, 'worstCalibrationError')),
      heroEvEdge: num(readScalar(body, 'heroEvEdge')),
      heroEvCiLow: num(readScalar(body, 'heroEvCiLow')),
    };
  });
};

const check = (id, name, pass, detail, blocking = true) => ({ id, name, pass, detail, blocking });

const evaluate = () => {
  const problems = [];
  const criteria = [];

  if (!existsSync(HISTORY)) {
    return {
      open: false,
      evidenceMissing: true,
      criteria: [],
      problems: [`missing ${HISTORY} — run the backtest and \`--record\` a scorecard first`],
    };
  }

  const runs = parseHistory(readFileSync(HISTORY, 'utf8'));
  const latest = runs[runs.length - 1] || null;
  if (!latest) {
    return { open: false, evidenceMissing: true, criteria: [], problems: ['scorecard-history.yaml has no runs'] };
  }

  // ---- C1 accuracy + lift -------------------------------------------------
  const c1 = latest.accuracy !== null && latest.lift !== null
    && latest.accuracy >= BAR.accuracy && latest.lift >= BAR.lift;
  criteria.push(check('C1', 'Villain prediction accuracy',
    c1,
    `accuracy ${fmtPct(latest.accuracy)} (bar ${fmtPct(BAR.accuracy)}) · lift ${fmtPct(latest.lift)} (bar ${fmtPct(BAR.lift)})`));

  // ---- C2 calibration -----------------------------------------------------
  const c2 = latest.worstCalibrationError !== null
    && latest.worstCalibrationError <= BAR.calibration;
  criteria.push(check('C2', 'Calibration honesty',
    c2,
    `worst bucket error ${fmt3(latest.worstCalibrationError)} (bar ${fmt3(BAR.calibration)})`));

  // ---- C3 hero EV ---------------------------------------------------------
  // Absent instrument => null => FAIL. Never treat "not measured" as "fine".
  const c3 = latest.heroEvEdge !== null && latest.heroEvCiLow !== null && latest.heroEvCiLow > 0;
  criteria.push(check('C3', 'Hero-EV validated',
    c3,
    latest.heroEvEdge === null
      ? 'NO INSTRUMENT — hero decisions have never been scored (WS-287)'
      : `edge ${fmt3(latest.heroEvEdge)}, CI low ${fmt3(latest.heroEvCiLow)} (must exceed 0)`));

  // ---- C4 theory stability (ATTESTED) -------------------------------------
  let c4 = false, c4detail = 'overturn ledger missing';
  if (existsSync(OVERTURNS)) {
    const text = readFileSync(OVERTURNS, 'utf8');
    const reviewed = readScalar(text, 'last_reviewed');
    const staleAfter = num(readScalar(text, 'stale_after_days')) ?? 45;
    const openOverturnable = num(readScalar(text, 'open_findings_that_could_overturn')) ?? 999;
    const age = daysSince(reviewed);
    // Count overturns recorded since the window opened.
    const sinceWindow = runs.length >= BAR.stableRuns ? runs[runs.length - BAR.stableRuns].date : null;
    const overturnDates = [...text.matchAll(/^\s*-\s+date:\s*["']?([\d-]+)/gm)].map(m => m[1]);
    const recentOverturns = sinceWindow
      ? overturnDates.filter(d => d >= sinceWindow).length
      : overturnDates.length;

    if (age > staleAfter) {
      c4detail = `ATTESTATION STALE — last reviewed ${reviewed} (${age}d ago, limit ${staleAfter}d)`;
    } else if (runs.length < BAR.stableRuns) {
      c4detail = `only ${runs.length} run(s) recorded; need ${BAR.stableRuns} to judge stability`;
    } else if (openOverturnable > 0) {
      c4detail = `${openOverturnable} open finding(s) could overturn a documented claim`;
    } else if (recentOverturns > 0) {
      c4detail = `${recentOverturns} overturn(s) inside the last ${BAR.stableRuns}-run window`;
    } else {
      c4 = true;
      c4detail = `no overturns across ${BAR.stableRuns} runs; attested ${reviewed}`;
    }
  }
  criteria.push(check('C4', 'Theory stability', c4, c4detail));

  // ---- C5 doctrine currency ----------------------------------------------
  // Deliberately NOT read from `last_reviewed`. That field is a self-attestation —
  // a reviewer writing today's date beside their own name — and it would have passed
  // this criterion on the day the protocol was 37 days overdue. C5 reads the EVENT
  // LOG date instead, which is the record you cannot satisfy by asserting it, and it
  // fails when the YAML and the event log disagree at all.
  let c5 = false, c5detail = 'overturn ledger missing';
  if (existsSync(OVERTURNS)) {
    const text = readFileSync(OVERTURNS, 'utf8');
    const lastRun = readScalar(text, 'domain_protocol_last_run_per_event_log');
    const drift = num(readScalar(text, 'domain_protocol_drift_days')) ?? 0;
    const staleAfter = num(readScalar(text, 'domain_protocol_stale_after_days')) ?? 21;
    const age = daysSince(lastRun);

    if (!lastRun) {
      c5detail = 'no event-log run date recorded — cannot verify protocol currency';
    } else if (drift > 0) {
      c5detail = `program YAML and event log disagree by ${drift}d — reconcile (WS-268)`;
    } else if (age > staleAfter) {
      c5detail = `domain protocol last ran ${lastRun} (${age}d ago, limit ${staleAfter}d) — /pulse run domain-correctness`;
    } else {
      c5 = true;
      c5detail = `domain protocol ran ${lastRun} (${age}d ago), no YAML/event-log drift`;
    }
  }
  criteria.push(check('C5', 'Doctrine currency', c5, c5detail));

  // ---- C6 no regression ---------------------------------------------------
  let c6 = false, c6detail;
  if (runs.length < BAR.noRegressionRuns) {
    c6detail = `only ${runs.length} run(s) recorded; need ${BAR.noRegressionRuns}`;
  } else {
    const window = runs.slice(-BAR.noRegressionRuns);
    const regressions = [];
    for (let i = 1; i < window.length; i++) {
      const a = window[i - 1], b = window[i];
      if (a.accuracy !== null && b.accuracy !== null && b.accuracy < a.accuracy - 0.005) {
        regressions.push(`accuracy ${fmtPct(a.accuracy)}->${fmtPct(b.accuracy)} (${b.date})`);
      }
      if (a.worstCalibrationError !== null && b.worstCalibrationError !== null
          && b.worstCalibrationError > a.worstCalibrationError + 0.005) {
        regressions.push(`calibration ${fmt3(a.worstCalibrationError)}->${fmt3(b.worstCalibrationError)} (${b.date})`);
      }
    }
    c6 = regressions.length === 0;
    c6detail = c6
      ? `no regression across last ${BAR.noRegressionRuns} runs`
      : `regressed: ${regressions.join('; ')}`;
  }
  criteria.push(check('C6', 'No regression', c6, c6detail));

  return {
    open: criteria.every(c => c.pass),
    evidenceMissing: false,
    latest,
    runCount: runs.length,
    criteria,
    problems,
  };
};

const fmtPct = (v) => (v === null ? 'n/a' : `${(v * 100).toFixed(1)}%`);
const fmt3 = (v) => (v === null ? 'n/a' : v.toFixed(3));

const BANNER = (latest) => `
################################################################
#                                                              #
#              M O D E L   R E A D I N E S S                   #
#                     G A T E   :   O P E N                    #
#                                                              #
#   All six criteria met.                                      #
#   The model is accurate enough and STABLE enough to learn.   #
#                                                              #
#   THIS IS YOUR CUE TO STUDY.                                 #
#                                                              #
#   Sprint composition is HELD until acknowledged.             #
#   Details:     ${GATE_DOC}
#   Acknowledge: /workstream ack WS-286                        #
#                                                              #
################################################################
  latest run: ${latest?.date ?? '?'} — ${latest?.label ?? '?'}
`;

/**
 * Append one run to the append-only history.
 *
 * TWO RULES THIS ENFORCES, both of which are easy to violate by hand and impossible to
 * spot afterwards:
 *
 *   1. METRICS CARRY FORWARD. C1, C2 and C6 all read the LATEST row. A row that
 *      recorded only a hero-EV result would leave accuracy null and fail C1 — reading
 *      as a regression when nothing regressed. So the previous row's metrics are the
 *      defaults and only what is explicitly supplied overrides them. Carried-forward
 *      values are marked in the row, because a metric that was inherited rather than
 *      re-measured must not look like fresh evidence.
 *   2. NO ROW WITHOUT A SOURCE. The file's own header: "A row without a source is not
 *      admissible evidence." Refused rather than defaulted.
 *
 * The history is read by a deliberately simple regex scalar reader, so every value
 * written here stays a flat scalar on its own line and no key is repeated in a block.
 */
const recordRun = (args) => {
  const flag = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 && i + 1 < args.length && !args[i + 1].startsWith('--') ? args[i + 1] : undefined;
  };

  let heroEvEdge = flag('hero-ev');
  let heroEvCiLow = flag('hero-ev-ci-low');
  let decisions = flag('decisions');
  let treatment = flag('treatment');
  let source = flag('source');

  // Reading straight from the instrument's own output beats retyping four numbers.
  const from = flag('from');
  if (from) {
    if (!existsSync(from)) {
      console.error(`--from: no such file: ${from}`);
      process.exit(2);
    }
    const payload = JSON.parse(readFileSync(from, 'utf8'));
    const gate = payload?.report?.gate;
    const head = payload?.report?.arms?.engineRaked;
    if (!gate || !head) {
      console.error(`--from: ${from} does not look like a hero-EV report (no report.gate / report.arms.engineRaked)`);
      process.exit(2);
    }
    heroEvEdge ??= gate.heroEvEdge === null ? 'null' : String(gate.heroEvEdge);
    heroEvCiLow ??= gate.heroEvCiLow === null ? 'null' : String(gate.heroEvCiLow);
    decisions ??= String(head.n);
    treatment ??= payload.report.treatment;
    source ??= from;
  }

  const label = flag('label');
  if (!label) { console.error('--record: --label is required'); process.exit(2); }
  if (!source) {
    console.error('--record: --source is required — a row without a source is not admissible evidence');
    process.exit(2);
  }

  const runs = existsSync(HISTORY) ? parseHistory(readFileSync(HISTORY, 'utf8')) : [];
  const prev = runs[runs.length - 1] || null;

  const pick = (supplied, carried) => (supplied === undefined ? carried : supplied);
  const accuracy = pick(flag('accuracy'), prev?.accuracy ?? null);
  const logLoss = pick(flag('log-loss'), prev?.logLoss ?? null);
  const lift = pick(flag('lift'), prev?.lift ?? null);
  const calib = pick(flag('calibration'), prev?.worstCalibrationError ?? null);

  const carried = [];
  if (flag('accuracy') === undefined && prev) carried.push('accuracy');
  if (flag('log-loss') === undefined && prev) carried.push('logLoss');
  if (flag('lift') === undefined && prev) carried.push('lift');
  if (flag('calibration') === undefined && prev) carried.push('worstCalibrationError');

  const date = flag('date') || new Date().toISOString().slice(0, 10);
  const v = (x) => (x === null || x === undefined || x === 'null' ? 'null' : String(x));

  const block = [
    '',
    `  - date: "${date}"`,
    `    label: ${JSON.stringify(label)}`,
    `    source: ${JSON.stringify(source)}`,
    `    arm: ${JSON.stringify(flag('arm') || 'hero-ev')}`,
    `    decisions: ${v(decisions)}`,
    `    corpus: ${JSON.stringify(flag('corpus') || 'HandHQ online cash, July 2009, 50NL')}`,
    '    metrics:',
    `      accuracy: ${v(accuracy)}`,
    `      logLoss: ${v(logLoss)}`,
    `      lift: ${v(lift)}`,
    `      worstCalibrationError: ${v(calib)}`,
    `      heroEvEdge: ${v(heroEvEdge)}`,
    `      heroEvCiLow: ${v(heroEvCiLow)}`,
    '    notes: >',
    `      ${treatment ? `Treatment: ${treatment}.` : 'Treatment: UNSTATED.'}`,
    carried.length
      ? `      Carried forward unchanged from ${prev.date}: ${carried.join(', ')} — inherited, not re-measured.`
      : '      All metrics measured in this run.',
    '',
  ].join('\n');

  appendFileSync(HISTORY, block);
  console.log(`Appended ${date} — ${label} to ${HISTORY}`);
  if (carried.length) {
    console.log(`  carried forward from ${prev.date}: ${carried.join(', ')}`);
  }
  console.log(`  heroEvEdge=${v(heroEvEdge)}  heroEvCiLow=${v(heroEvCiLow)}`);
};

const main = () => {
  const args = process.argv.slice(2);

  if (args.includes('--record')) {
    recordRun(args);
    return;
  }

  const r = evaluate();

  if (args.includes('--json')) {
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.evidenceMissing ? 2 : (r.open ? 0 : 1));
  }

  if (args.includes('--banner')) {
    if (r.open) console.log(BANNER(r.latest));
    process.exit(r.evidenceMissing ? 2 : (r.open ? 0 : 1));
  }

  if (r.evidenceMissing) {
    console.log('Model Readiness Gate: EVIDENCE MISSING');
    for (const pr of r.problems) console.log(`  - ${pr}`);
    process.exit(2);
  }

  if (r.open) {
    console.log(BANNER(r.latest));
  } else {
    const met = r.criteria.filter(c => c.pass).length;
    console.log(`\nModel Readiness Gate: CLOSED — ${met}/${r.criteria.length} criteria met`);
    console.log(`Stake in the ground: ${GATE_DOC}\n`);
  }

  for (const c of r.criteria) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.id}  ${c.name.padEnd(28)} ${c.detail}`);
  }
  console.log('');
  process.exit(r.open ? 0 : 1);
};

main();
