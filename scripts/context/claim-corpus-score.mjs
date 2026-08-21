#!/usr/bin/env node
/**
 * claim-corpus-score.mjs — score the adjudicated sample, and refuse when it cannot.
 *
 * THIS SCRIPT WILL NOT PRINT A RATE IT IS NOT ENTITLED TO PRINT. Four gates, each
 * from a specific finding of the 2026-08-20 design-critique or of the two failed runs
 * that followed it, and each one refuses rather than degrades:
 *
 *   G1 — CONTROL CATCH. Seeded false claims are hidden in every packet. An arm that
 *        misses one is not measuring anything, and a verifier that returns HELD
 *        unconditionally is indistinguishable from a working one. Below 100%, that
 *        arm's numbers are withheld.
 *   G2 — INTER-JUDGE AGREEMENT. Two arms score the same claims. Cohen's kappa is
 *        reported BEFORE any rate, because a detector cannot beat its own label
 *        noise. Below the stated floor the sample cannot support the falsifier.
 *   G3 — COVERAGE. Every sampled claim needs a verdict from both arms. A gate that
 *        passes on a partial set is the failure this repo has already recorded.
 *   G4 — DERIVATION CONSISTENCY. The brief (§3) makes `verdict` a mechanical function
 *        of (substance, citation). An arm whose stated verdict contradicts its own two
 *        axes did not apply the rubric, and a rubric nobody applied cannot be the
 *        explanation for agreement OR for disagreement. NEW IN RUN 3.
 *
 * THE FOUR-VALUED RUBRIC — `scripts/context/claim-judge-brief.md` §2-3.
 * Runs 1 and 2 were adjudicated with no written definition of what "the claim" was.
 * Judges chose per case whether it meant the CITATION or the ASSERTION the citation
 * supported, and chose opposite ways on comparable cases. Kappa went 0.460 -> 0.081.
 * The claim unit is now fixed as the ASSERTION, with the citation as its support, and
 * `CITE-WRONG` — substance holds, citation misplaced — exists so that the two run-2
 * disagreement classes have somewhere to land that is neither HELD nor REFUTED.
 *
 * WHY G1 NOW ACCEPTS `CITE-WRONG` AS A CATCH, pre-registered before run 3 was scored:
 * a seeded control is a planted false CITATION attached to a plausible sentence. Under
 * a four-valued rubric a judge that locates real support for the sentence elsewhere and
 * returns CITE-WRONG has *correctly applied the rubric* and has detected the plant. The
 * property G1 exists to test is "does this arm detect a planted falsehood, or does it
 * rubber-stamp" — and the rubber stamp returns HELD. So the catch criterion is
 * `verdict !== 'HELD'`, and the per-control breakdown is printed so the loosening is
 * visible rather than buried. Requiring exactly REFUTED would penalise correct rubric
 * application, which would make the gate measure compliance with the old rubric.
 *
 * AND IT IS NOT AN ACCURACY RATE. `.claude/projects/accuracy-program-handoff.md:265-267`
 * is explicit: the judge is the same model whose error rate is the object of study, so
 * the output is AGREEMENT WITH AN UNVALIDATED JUDGE until a human-adjudicated subsample
 * calibrates it. The label is printed on every figure, not in a footnote, because a
 * number that escapes its caveat is the WS-291 mechanism.
 *
 * Usage:
 *   node scripts/context/claim-corpus-score.mjs
 *   node scripts/context/claim-corpus-score.mjs --verdicts verdicts-run3
 */

import fs from 'node:fs';
import path from 'node:path';

const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', '..',
);
const E = path.join(REPO_ROOT, '.claude', 'workstream', 'evidence');

const KAPPA_FLOOR = 0.70;   // research-scientist's rewritten AS-CRP-4
const CATS = ['HELD', 'CITE-WRONG', 'REFUTED', 'UNRESOLVABLE'];

/** The brief's §3 derivation table, as code. The judges do not get to freelance it. */
function derive(substance, citation) {
  if (substance === 'FALSE') return 'REFUTED';
  if (substance === 'UNKNOWN') return 'UNRESOLVABLE';
  if (substance === 'HOLDS') return citation === 'MISPLACED' ? 'CITE-WRONG' : 'HELD';
  return null;
}

/** Collapse to the substance axis: does the assertion hold, ignoring where it was cited? */
function substanceOf(verdict) {
  if (verdict === 'HELD' || verdict === 'CITE-WRONG') return 'HOLDS';
  if (verdict === 'REFUTED') return 'FALSE';
  return 'UNKNOWN';
}

function wilson(k, n) {
  if (!n) return [0, 0];
  const z = 1.96, p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const s = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - s) / d), Math.min(1, (c + s) / d)];
}

function kappa(pairs, cats) {
  const n = pairs.length;
  if (!n) return NaN;
  let agree = 0;
  const mA = {}, mB = {};
  for (const c of cats) { mA[c] = 0; mB[c] = 0; }
  for (const [a, b] of pairs) {
    if (a === b) agree++;
    mA[a] = (mA[a] || 0) + 1;
    mB[b] = (mB[b] || 0) + 1;
  }
  const po = agree / n;
  const pe = cats.reduce((s, c) => s + ((mA[c] || 0) / n) * ((mB[c] || 0) / n), 0);
  return pe === 1 ? NaN : (po - pe) / (1 - pe);
}

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(E, 'claim-sample-manifest.json'), 'utf8'));
  const sample = fs.readFileSync(path.join(E, 'claim-sample.jsonl'), 'utf8')
    .trim().split('\n').map((l) => JSON.parse(l));
  const byId = new Map(sample.map((r) => [r.claim_id, r]));
  const controls = new Map((manifest.seeded_controls || []).map((c) => [c.claim_id, c]));

  const verdictDir = arg('verdicts', 'verdicts');
  const dir = path.join(E, verdictDir);
  const arms = { A: new Map(), B: new Map() };
  const rowsByArm = { A: new Map(), B: new Map() };
  const seen = { A: new Set(), B: new Set() };
  const briefHashes = new Set();
  for (const f of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    if (!f.endsWith('.json')) continue;
    const v = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    const arm = v.arm || (f.includes('-A') ? 'A' : 'B');
    seen[arm].add(v.packet);
    if (v.brief_sha256) briefHashes.add(v.brief_sha256);
    for (const d of v.verdicts) {
      arms[arm].set(d.claim_id, d.verdict);
      rowsByArm[arm].set(d.claim_id, d);
    }
  }

  const line = (s = '') => console.log(s);
  line('CLAIM-SURVIVAL BASELINE — retrospective, fresh-context judged');
  line(`  corpus ${manifest.corpus_sha256.slice(0, 12)}…  seed ${manifest.seed}  ` +
       `${manifest.n_drawn} claims / ${manifest.artifacts} transcripts`);
  line(`  verdict set: ${verdictDir}`);
  line(`  packets returned: A ${seen.A.size}/${manifest.packets}   B ${seen.B.size}/${manifest.packets}`);
  line(`  rubric: four-valued — scripts/context/claim-judge-brief.md §2-3`);
  line();

  // ── G0: one brief, both arms. The run-2 defect, made mechanically visible. ─────
  line('G0  ONE BRIEF, BOTH ARMS');
  if (!briefHashes.size) {
    line('    no brief_sha256 recorded — cannot verify the arms shared a brief. WARN.');
  } else if (briefHashes.size === 1) {
    line(`    all arms report brief ${[...briefHashes][0].slice(0, 12)}…  PASS`);
  } else {
    line(`    ${briefHashes.size} DIFFERENT briefs reported — the arms are not comparable. FAIL`);
    for (const h of briefHashes) line(`        ${h}`);
  }
  line();

  // ── G4: did each arm actually apply the derivation table? ─────────────────────
  line('G4  DERIVATION CONSISTENCY — verdict must follow from the arm\'s own two axes');
  const derivOk = {};
  for (const a of ['A', 'B']) {
    const rows = [...rowsByArm[a].values()];
    const axesGiven = rows.filter((r) => r.substance && r.citation);
    const bad = axesGiven.filter((r) => derive(r.substance, r.citation) !== r.verdict);
    const citeWrongNoLoc = rows.filter((r) => r.verdict === 'CITE-WRONG' && !r.actual_location);
    // A row with no axes cannot contradict the table, so "zero contradictions" would
    // pass vacuously for an arm that simply omitted them. Require the axes as well —
    // a gate that passes on an empty set is a failure this repo has already recorded.
    derivOk[a] = rows.length > 0 && axesGiven.length === rows.length &&
                 bad.length === 0 && citeWrongNoLoc.length === 0;
    line(`    arm ${a}: ${axesGiven.length}/${rows.length} rows carry both axes; ` +
         `${bad.length} contradict the table; ${citeWrongNoLoc.length} CITE-WRONG without a location` +
         `  ${derivOk[a] ? 'PASS' : 'FAIL'}`);
    for (const r of bad.slice(0, 8)) {
      line(`        ${r.claim_id}: ${r.substance}/${r.citation} -> should be ` +
           `${derive(r.substance, r.citation)}, got ${r.verdict}`);
    }
    for (const r of citeWrongNoLoc.slice(0, 8)) {
      line(`        ${r.claim_id}: CITE-WRONG with no actual_location — brief §3 makes it mandatory`);
    }
  }
  line();

  // ── G1: control catch ──────────────────────────────────────────────────
  line('G1  SEEDED CONTROLS — planted false citations; caught = verdict is NOT "HELD"');
  line('    (CITE-WRONG counts as a catch under the four-valued rubric — see header.)');
  const armOk = {};
  for (const arm of ['A', 'B']) {
    const got = [...controls.keys()].filter((id) => arms[arm].has(id));
    const caught = got.filter((id) => arms[arm].get(id) !== 'HELD');
    armOk[arm] = got.length > 0 && caught.length === got.length;
    line(`    arm ${arm}: ${caught.length}/${got.length} caught  ${armOk[arm] ? 'PASS' : (got.length ? 'FAIL — this arm is withheld' : 'no data')}`);
    for (const id of got) {
      const v = arms[arm].get(id);
      const mark = v === 'HELD' ? 'MISSED' : '  ok  ';
      line(`        ${mark} ${id} (${controls.get(id).control}) -> ${v}`);
    }
  }
  line();

  // ── G2/G3: paired coverage and agreement ───────────────────────────────
  const realIds = sample.map((r) => r.claim_id);
  const paired = realIds
    .filter((id) => arms.A.has(id) && arms.B.has(id))
    .map((id) => [arms.A.get(id), arms.B.get(id), id]);

  line('G3  COVERAGE');
  line(`    real claims with BOTH arms: ${paired.length}/${realIds.length}`);
  const complete = paired.length === realIds.length;
  line(`    ${complete ? 'PASS' : 'PARTIAL — figures below are provisional and labelled as such'}`);
  line();

  line('G2  INTER-JUDGE AGREEMENT (on real claims only; controls excluded)');
  const k = kappa(paired.map(([a, b]) => [a, b]), CATS);
  const rawAgree = paired.filter(([a, b]) => a === b).length;
  line(`    raw agreement  ${rawAgree}/${paired.length}` +
       (paired.length ? `  (${((100 * rawAgree) / paired.length).toFixed(1)}%)` : ''));
  line(`    Cohen's kappa (4-valued, THE GATE)  ${Number.isFinite(k) ? k.toFixed(3) : 'n/a'}   ` +
       `floor ${KAPPA_FLOOR}  ${Number.isFinite(k) ? (k >= KAPPA_FLOOR ? 'PASS' : 'BELOW FLOOR') : ''}`);

  // Diagnostic: where does the disagreement live — the assertion, or its support?
  const subPairs = paired.map(([a, b]) => [substanceOf(a), substanceOf(b)]);
  const kSub = kappa(subPairs, ['HOLDS', 'FALSE', 'UNKNOWN']);
  const subAgree = subPairs.filter(([a, b]) => a === b).length;
  line(`    substance-axis kappa (diagnostic, NOT the gate)  ${Number.isFinite(kSub) ? kSub.toFixed(3) : 'n/a'}` +
       `   raw ${subAgree}/${paired.length}`);
  line('      If substance kappa is high and the 4-valued gate is low, the judges agree');
  line('      about what is TRUE and disagree about where it is CITED — which is exactly');
  line('      the split CITE-WRONG was added to separate, and it is then a rubric-');
  line('      application problem, not a claim-checking problem.');

  if (paired.length) {
    const dis = paired.filter(([a, b]) => a !== b);
    if (dis.length) {
      line(`    ${dis.length} disagreement(s) — these are the human-adjudication queue:`);
      const shape = {};
      for (const [a, b, id] of dis) {
        const r = byId.get(id);
        const key = [a, b].sort().join(' vs ');
        shape[key] = (shape[key] || 0) + 1;
        line(`      ${id.padEnd(22)} A=${a.padEnd(12)} B=${b.padEnd(12)} ${r ? r.cited_path : ''}`);
      }
      line('    disagreement shapes:');
      for (const [s, n] of Object.entries(shape).sort((x, y) => y[1] - x[1])) {
        line(`      ${String(n).padStart(3)}  ${s}`);
      }
    }
  }
  line();

  const blocked = !armOk.A || !armOk.B || !Number.isFinite(k) || k < KAPPA_FLOOR ||
                  !complete || !derivOk.A || !derivOk.B || briefHashes.size > 1;

  // ── the figure, with its label attached ────────────────────────────────
  line('SURVIVAL — AGREEMENT WITH AN UNVALIDATED JUDGE, NOT AN ACCURACY RATE');
  line('  (the judge is the same model whose error rate is the object of study;');
  line('   accuracy-program-handoff.md:265-267. A human-adjudicated subsample is');
  line('   required before any of this may be cited as a rate.)');
  line();
  for (const arm of ['A', 'B']) {
    if (!armOk[arm]) { line(`  arm ${arm}: WITHHELD — failed the control gate`); continue; }
    const vs = realIds.filter((id) => arms[arm].has(id)).map((id) => arms[arm].get(id));
    const c = Object.fromEntries(CATS.map((x) => [x, vs.filter((v) => v === x).length]));
    line(`  arm ${arm}: held ${c.HELD}  cite-wrong ${c['CITE-WRONG']}  refuted ${c.REFUTED}` +
         `  unresolvable ${c.UNRESOLVABLE}   (n=${vs.length})`);

    // Substance survival — the assertion was true, wherever it was cited from.
    const subOk = c.HELD + c['CITE-WRONG'];
    const subDen = subOk + c.REFUTED;
    const [lo, hi] = wilson(subOk, subDen);
    line(`      SUBSTANCE survival (held+cite-wrong)/(…+refuted) = ` +
         `${subDen ? ((100 * subOk) / subDen).toFixed(1) : '—'}%` +
         `  95% CI [${(100 * lo).toFixed(1)}, ${(100 * hi).toFixed(1)}]`);

    // Citation accuracy — of the assertions that were true, how many pointed correctly.
    const [clo, chi] = wilson(c.HELD, subOk);
    line(`      CITATION accuracy  held/(held+cite-wrong)      = ` +
         `${subOk ? ((100 * c.HELD) / subOk).toFixed(1) : '—'}%` +
         `  95% CI [${(100 * clo).toFixed(1)}, ${(100 * chi).toFixed(1)}]`);
    line('      UNRESOLVABLE is reported separately and never folded into either.');
  }
  line();

  // ── which route resolved the claim — feeds the next run's brief ────────
  const routes = {};
  for (const a of ['A', 'B']) {
    for (const r of rowsByArm[a].values()) {
      if (!r.route) continue;
      routes[r.route] = (routes[r.route] || 0) + 1;
    }
  }
  if (Object.keys(routes).length) {
    line('ROUTE THAT RESOLVED THE CLAIM (both arms pooled)');
    line('  Run 2 found working-tree routes after run 1 called them unrecoverable. This');
    line('  counts which ones actually carried weight, so the next brief can be aimed.');
    for (const [r, n] of Object.entries(routes).sort((x, y) => y[1] - x[1])) {
      line(`    ${String(n).padStart(4)}  ${r}`);
    }
    line();
  }

  // ── the four-cell table: the thing the whole design was about ──────────
  line('PROVENANCE x VERDICT — does not-opening-the-file predict being wrong?');
  line('  This is the design\'s actual question. Provenance came from the transcript;');
  line('  the judges never saw it. Agreed claims only.');
  line();
  const cells = {};
  for (const [a, b, id] of paired) {
    if (a !== b) continue;                       // agreed claims only
    const r = byId.get(id);
    if (!r) continue;
    const key = r.provenance;
    cells[key] = cells[key] || Object.fromEntries(CATS.map((x) => [x, 0]));
    cells[key][a]++;
  }
  line('    provenance    held  cite-wrong  refuted  unres.   refuted-share  substance-survival');
  for (const p of ['read', 'push', 'neither']) {
    const c = cells[p] || Object.fromEntries(CATS.map((x) => [x, 0]));
    const den = c.HELD + c['CITE-WRONG'] + c.REFUTED;
    line(`    ${p.padEnd(12)} ${String(c.HELD).padStart(5)} ${String(c['CITE-WRONG']).padStart(11)} ` +
         `${String(c.REFUTED).padStart(8)} ${String(c.UNRESOLVABLE).padStart(7)}   ` +
         `${den ? ((100 * c.REFUTED) / den).toFixed(1) + '%' : '—'}`.padEnd(16) +
         `${den ? ((100 * (den - c.REFUTED)) / den).toFixed(1) + '%' : '—'}`);
  }
  line();
  if (blocked) {
    line('STATUS: PROVISIONAL. One or more gates did not pass — see above. These figures');
    line('may not be cited, and per ADR-009 no Result Card may be stamped from them.');
  } else {
    line('STATUS: gates passed. Still not a rate — the human-adjudicated subsample is');
    line('the remaining precondition, and the `claimKind` schema decision blocks the card.');
  }
}

main();
