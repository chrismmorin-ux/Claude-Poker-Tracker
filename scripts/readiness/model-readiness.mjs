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

import { readFileSync, existsSync, appendFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const p = (...s) => resolve(ROOT, ...s);

const GATE_DOC = 'docs/domain/MODEL_READINESS_GATE.md';
const HISTORY = p('docs/domain/readiness/scorecard-history.yaml');
const OVERTURNS = p('docs/domain/readiness/overturn-ledger.yaml');
const OUT_DIR = p('out');

// Thresholds — MIRRORED FROM THE GATE DOC. Changing one here without changing it
// there (and recording the founder decision) is exactly the silent-bar-move the doc
// forbids. Keep them together.
const BAR = {
  accuracy: 0.60,
  lift: 0.08,
  calibration: 0.050,
  stableRuns: 3,
  noRegressionRuns: 3,
  // Contributing PLAYERS required behind the hero-EV interval. Mirrors
  // MIN_CLUSTERS_FOR_CI in scripts/backtest/heroEvReport.mjs — duplicated rather than
  // imported because this checker deliberately depends on nothing but the scorecard files
  // (it must run when the backtest cannot). Kept honest by heroEvAdmissibility.test.js,
  // which asserts the two constants agree.
  heroEvClusters: 30,
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
      // Contributing PLAYERS behind the hero-EV interval. Absent on rows recorded before
      // 2026-07-31, which is why `null` is treated as "unknown, therefore not certifiable"
      // below rather than as "fine" — see C3.
      heroEvClusters: num(readScalar(body, 'heroEvClusters')),
      // The fault register this row's number was computed under. Rows written before
      // 2026-08-16 have none, which is treated as "unknown" and never as "same as mine".
      disclaimerRegisterVersion: readScalar(body, 'disclaimerRegisterVersion'),
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
  //
  // CLUSTER COUNT IS PART OF THE BAR (2026-07-31). The hero-EV CI is a cluster bootstrap
  // over PLAYERS, and below ~30 clusters it under-covers: the interval comes out narrow
  // because the sample is small, not because the estimate is precise. An interrupted run
  // with THREE players produced edge +16.72 with CI [7.52, 23.42] — which the old test
  // (`ciLow > 0`) would have certified. This checker reads the scorecard rather than the
  // report object, so the guard added in heroEvReport does not reach it; the bar has to be
  // restated here, against the recorded cluster count.
  //
  // A row with no `heroEvClusters` is UNKNOWN, and unknown is not certifiable. Rows written
  // before this field existed therefore cannot open the gate — which is correct: nobody
  // knows how many players backed them.
  const clusterBar = BAR.heroEvClusters;
  const c3HasNumbers = latest.heroEvEdge !== null && latest.heroEvCiLow !== null;
  const c3Positive = c3HasNumbers && latest.heroEvCiLow > 0;
  const c3Clusters = latest.heroEvClusters !== null && latest.heroEvClusters >= clusterBar;
  const c3 = c3Positive && c3Clusters;

  let c3Detail;
  if (latest.heroEvEdge === null) {
    c3Detail = 'NO INSTRUMENT — hero decisions have never been scored (WS-287)';
  } else if (!c3Positive) {
    c3Detail = `edge ${fmt3(latest.heroEvEdge)}, CI low ${fmt3(latest.heroEvCiLow)} (must exceed 0)`;
  } else if (latest.heroEvClusters === null) {
    c3Detail = `edge ${fmt3(latest.heroEvEdge)}, CI low ${fmt3(latest.heroEvCiLow)} — but the row `
      + `records no heroEvClusters, so the interval cannot be trusted (bar: ${clusterBar} players)`;
  } else {
    c3Detail = `edge ${fmt3(latest.heroEvEdge)}, CI low ${fmt3(latest.heroEvCiLow)} over `
      + `${latest.heroEvClusters} players (bar: ${clusterBar})`;
  }
  criteria.push(check('C3', 'Hero-EV validated', c3, c3Detail));

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
    unrecorded: unrecordedHeroEvEvidence(latest),
  };
};

/**
 * Hero-EV artifacts on disk that the scorecard has not been told about.
 *
 * WHY THIS EXISTS — the failure it caught on the day it was written (2026-08-16).
 *
 * The gate's stated design rule is that it must never report a criterion as MET when it
 * cannot verify it. That rule held. Nothing guarded the INVERSE, and the inverse is just
 * as damaging: for ~20 days the gate reported C3 as failing on `edge 12.042, CI low
 * -7.597` — the 2026-07-28 SMOKE run, 9 contributing players — while
 * `out/hero-ev-300p.json` had been sitting on disk since 2026-08-07 reading
 * `c3Passes: true, admissible: true, clusters: 278`. C5 did the same thing over the same
 * window against a protocol that had actually run.
 *
 * A criterion failing on superseded evidence looks EXACTLY like a criterion that is
 * honestly failing. That is the whole problem: there is no visible difference, so nobody
 * looks. The scorecard is hand-appended, has no producer and no freshness check, and the
 * SessionStart hook fails open by design — so a gate frozen on stale rows is silent in
 * every channel that was supposed to report it.
 *
 * DELIBERATELY ADVISORY. This function CANNOT change a verdict, and must never be made
 * able to. `--record --from` is still the only path from an artifact to the scorecard,
 * and it still refuses inadmissible reports. Auto-adopting a number found on disk would
 * be a way to open the gate as a side effect of writing a file, which is precisely the
 * silent-bar-move the gate doc forbids. This only ever says: LOOK, and names the command.
 *
 * Depends on nothing: if `out/` is absent or unreadable this returns [] and the checker
 * behaves exactly as before, preserving the rule that it must run when the backtest cannot.
 */
export const unrecordedHeroEvEvidence = (latest, outDir = OUT_DIR) => {
  try {
    if (!existsSync(outDir)) return [];
    const found = [];
    for (const name of readdirSync(outDir)) {
      // Completed artifacts only. `.partial` files say of themselves that they are not a
      // validated result, and a partial is the one thing that must never look like evidence.
      if (!name.startsWith('hero-ev-') || !name.endsWith('.json')) continue;
      let payload;
      try {
        payload = JSON.parse(readFileSync(resolve(outDir, name), 'utf8'));
      } catch { continue; }
      const adm = payload?.report?.admissibility;
      const gate = payload?.report?.gate;
      if (!adm || adm.admissible !== true || !gate) continue;

      // A NUMBER IS ONLY COMPARABLE TO ONE COMPUTED UNDER THE SAME KNOWN FAULTS.
      //
      // This guard exists because the first version of this detector was WRONG in exactly
      // the way it was built to prevent, within an hour of being written. It flagged
      // out/hero-ev-300p.json (edge 5.26, CI low +2.13, 278 players) as evidence that a
      // recorded FAILURE "may be stale" — but that artifact ran under FR-1+746d7b4aaea4,
      // which predates FAULT-untaxed-fold-branch (confirmed 2026-08-15: the fold branch of
      // every postflop EV paid an unraked pot). The corrected run at 308 players read
      // edge 2.27, CI [-1.17, +5.56]. The old number was not better evidence; it was
      // inflated by a fault. Pointing at it would have argued the founder OUT of an honest
      // failure and into a contaminated pass — the precise inversion of this file's purpose.
      //
      // So: an artifact stamped under a different register than the recorded row is not
      // "newer evidence", it is "not comparable", and this detector says nothing about it.
      // Unknown on either side is also not a match — absence is never treated as agreement.
      const artifactRegister = payload?.run?.replicationStamp?.disclaimerRegisterVersion ?? null;
      const rowRegister = latest?.disclaimerRegisterVersion ?? null;
      if (!artifactRegister || !rowRegister || artifactRegister !== rowRegister) continue;

      // Same field names the `--record --from` path reads, so this can never disagree
      // with what recording would actually put in the scorecard.
      const edge = num(gate.heroEvEdge ?? null);
      const ciLow = num(gate.heroEvCiLow ?? null);
      const clusters = num(adm.clusters ?? null);
      if (ciLow === null || clusters === null) continue;

      // Would this artifact clear C3 on its own terms?
      const wouldPass = ciLow > 0 && clusters >= BAR.heroEvClusters;
      if (!wouldPass) continue;

      // Already the row we are reading? Then it is recorded, not unrecorded.
      const sameAsRow = latest
        && latest.heroEvClusters === clusters
        && latest.heroEvCiLow !== null
        && Math.abs(latest.heroEvCiLow - ciLow) < 1e-6;
      if (sameAsRow) continue;

      found.push({ file: `out/${name}`, edge, ciLow, clusters });
    }
    // Most clusters first — the strongest evidence is the one worth looking at.
    return found.sort((a, b) => b.clusters - a.clusters);
  } catch {
    return [];
  }
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
  let heroEvClusters = flag('hero-ev-clusters');
  let decisions = flag('decisions');
  let treatment = flag('treatment');
  let source = flag('source');
  let registerVersion = flag('register-version');

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
    // AN INADMISSIBLE REPORT MUST NOT REACH THE SCORECARD. The scorecard is the evidence
    // the readiness gate reads; letting a partial or an under-clustered run in makes every
    // downstream check argue with a number that was never certifiable. The report says of
    // itself whether it may be quoted, so honour that here rather than re-deriving it.
    //
    // Deliberately NOT overridable by a flag. If a run is worth recording, it is worth
    // finishing — and the one escape hatch that would get used in a hurry is the one that
    // would put an untrustworthy row in front of a decision to stop building and study.
    const adm = payload?.report?.admissibility;
    if (adm && adm.admissible === false) {
      console.error(`--from: refusing to record an INADMISSIBLE report (${from}).`);
      for (const b of adm.blockers ?? []) console.error(`    ${b.code}: ${b.detail}`);
      console.error(`    contributing players ${adm.clusters} (bar: ${adm.minClustersForCI})`);
      console.error('  Re-run to completion with enough players, then record.');
      process.exit(2);
    }
    if (!adm) {
      // Pre-2026-07-31 reports have no admissibility block. Warn rather than refuse: the
      // row will simply carry no cluster count and therefore cannot open C3.
      console.error(`--from: WARNING — ${from} predates the admissibility block; `
        + 'heroEvClusters will be unknown and C3 cannot pass from this row.');
    }

    heroEvEdge ??= gate.heroEvEdge === null ? 'null' : String(gate.heroEvEdge);
    heroEvCiLow ??= gate.heroEvCiLow === null ? 'null' : String(gate.heroEvCiLow);
    // The cluster count IS the interval's credibility, so it travels with it.
    heroEvClusters ??= head.players === null || head.players === undefined
      ? 'null' : String(head.players);
    decisions ??= String(head.n);
    treatment ??= payload.report.treatment;
    source ??= from;
    // WHICH FAULT REGISTER THIS RAN UNDER. Recorded because a number is only comparable to
    // another number computed under the same set of known faults. On 2026-08-16 the two
    // hero-EV artifacts on disk carried FR-1+746d7b4aaea4 and FR-1+bb7d37d9aeac: the older
    // one predates FAULT-untaxed-fold-branch (confirmed 2026-08-15, "the fold branch of
    // every postflop EV paid an unraked pot"), and it read edge 5.26 / CI low +2.13 where
    // the corrected run read 2.27 / -1.17. Same instrument, same bar, opposite verdict.
    // Without this field the scorecard cannot tell those two apart.
    registerVersion ??= payload?.run?.replicationStamp?.disclaimerRegisterVersion ?? undefined;
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
    // The interval is a cluster bootstrap over players; without this number the row cannot
    // say whether its own CI is believable, so C3 treats its absence as unknown.
    `      heroEvClusters: ${v(heroEvClusters)}`,
    // Flat scalar on its own line, per the simple-reader constraint at the top of this file.
    `    disclaimerRegisterVersion: ${JSON.stringify(registerVersion ?? null)}`,
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

  // Loud, and above the exit — a stale FAILURE is indistinguishable from an honest one,
  // so the only defence is to say so where the failure is being read.
  if (r.unrecorded.length) {
    const c3 = r.criteria.find((c) => c.id === 'C3');
    console.log('\n  ' + '!'.repeat(76));
    console.log(`  !!  UNRECORDED EVIDENCE — ${r.unrecorded.length} admissible hero-EV artifact(s) on disk`);
    console.log(`  !!  would clear C3, and the scorecard has not been told about them.`);
    if (c3 && !c3.pass) {
      console.log(`  !!  C3 is currently reported FAILING on the row above. That failure may be STALE.`);
    }
    console.log('  ' + '!'.repeat(76));
    for (const u of r.unrecorded) {
      console.log(`     ${u.file}  edge ${fmt3(u.edge)}  CI low ${fmt3(u.ciLow)}  ${u.clusters} players`);
    }
    console.log('\n     Recording is still a deliberate act — this check cannot do it for you:');
    console.log(`       node scripts/readiness/model-readiness.mjs --record --from ${r.unrecorded[0].file} \\`);
    console.log('         --label "<what this run was>" --source "<WS-id / commit>"');
  }

  console.log('');
  process.exit(r.open ? 0 : 1);
};

// Importable for tests: without this guard, ing this module runs the CLI and
// calls process.exit inside the test runner. See __tests__/modelReadinessStaleness.test.js.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
