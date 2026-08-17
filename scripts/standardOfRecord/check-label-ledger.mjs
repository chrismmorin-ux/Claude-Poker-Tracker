#!/usr/bin/env node
/**
 * check-label-ledger.mjs — the blocking gate for the Label & Foundation Ledger (WS-445).
 *
 * A new label-shaped input must appear in the ledger, or this fails. Founder decision,
 * 2026-08-16: blocking from day one, additive-only, existing constructs grandfathered.
 *
 * WHY IT IS WIRED ON DAY ONE. `smart-test-runner.sh:22-23` records FIND-086 / WS-431: the
 * Standard-of-Record additive gate existed from WS-329 and was wired NOWHERE, so "registering a
 * schema bought nothing". A gate that runs in no pipeline is a comment with extra steps. This
 * one lands in `smart-test-runner.sh` and `ci.yml` in the same commit that creates it.
 *
 * ─── THE ANTI-ROT CORE ───────────────────────────────────────────────────────
 *
 * `--update` writes newly harvested constructs with `ledger: null`, AND A NULL LEDGER IS ITSELF
 * A VIOLATION. So re-snapshotting records that a construct EXISTS; it never asserts that anyone
 * THOUGHT ABOUT IT. The only way to green this gate is a human writing a `LBL-` row or a
 * reasoned exclusion.
 *
 * That is the direct answer to `faultRegister.test.js:466-467` — *"a generator would just move
 * the drift"* — and it is the property that separates this from a snapshot everybody learns to
 * refresh without reading.
 *
 * ─── WHY A BASELINE DIFF AND NOT A GREP ──────────────────────────────────────
 *
 * The same argument `check-additive.mjs:11-16` makes, inverted. That gate diffs because
 * DELETING a line from an array leaves no token to search for. This one diffs because ADDING a
 * label table leaves no distinctive token either: `IMPACT_MAP`, `REALIZATION_TABLE` and
 * `BUCKET_MIDPOINT` share no lexical marker. The construct has an AST shape and no name.
 *
 * Usage:
 *   node scripts/standardOfRecord/check-label-ledger.mjs                  # check
 *   node scripts/standardOfRecord/check-label-ledger.mjs --update         # re-snapshot
 *   node scripts/standardOfRecord/check-label-ledger.mjs --unledgered     # list what needs a row
 *   node scripts/standardOfRecord/check-label-ledger.mjs --seed-untriaged WS-445
 *
 * Exit codes: 0 clean · 1 violation · 2 internal error.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { harvest, vacuityProblems, ROOTS } from './harvestLabelConstructs.mjs';
import {
  LABEL_LEDGER, isExclusionReason, ledgerSelfCheck,
} from '../../src/utils/standardOfRecord/labelLedger.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'label-harvest-baseline.json');

/**
 * How long a `not-yet-triaged` exclusion may stand. An exception that never expires is how the
 * exclusions list quietly becomes the register — `touch-floor.spec.js:80-82` points the same
 * way with its stale-pin check ("pins may only shrink, never linger").
 */
const UNTRIAGED_MAX_DAYS = 90;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i === -1 ? null : argv[i + 1];
};

// ─── snapshot rows ────────────────────────────────────────────────────────────

/**
 * The baseline row. `line` is deliberately ABSENT: line numbers churn on every edit above a
 * construct, and a gate that produces a diff on every commit trains everyone to run `--update`
 * without reading it. The key is structural (`file::symbol`, or `file::fn#kindN`) and the
 * `shapeDigest` covers key STRUCTURE, never values — editing a number in `REALIZATION_TABLE`
 * must not trip this gate (that is `check-engine-version-bump.mjs`'s job); adding a fourth SPR
 * zone must.
 */
const baselineRow = (r, ledger = null) => ({
  file: r.file,
  symbol: r.symbol,
  kind: r.kind,
  keyPaths: r.keyPaths,
  cellCount: r.cellCount,
  exported: Boolean(r.exported),
  shapeDigest: r.shapeDigest,
  ledger,
});

const snapshot = (rows, prior = {}) => {
  const out = {};
  for (const r of rows) {
    const before = prior[r.key];
    out[r.key] = baselineRow(r, before ? before.ledger : null);
    if (before?.since) out[r.key].since = before.since;
    if (before?.ticket) out[r.key].ticket = before.ticket;
  }
  return out;
};

// ─── the join ─────────────────────────────────────────────────────────────────

const LEDGER_BY_ID = new Map(LABEL_LEDGER.map((e) => [e.labelId, e]));
const CLAIMED_SITES = new Set(LABEL_LEDGER.flatMap((e) => e.sites));

const daysSince = (iso) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / 86_400_000;
};

const compare = (baseline, live, rowsByKey) => {
  const violations = [];

  // 1 — UNLEDGERED CONSTRUCT. Founder decision #3, and the reason the gate exists.
  for (const [key, row] of Object.entries(live)) {
    const base = baseline[key];
    const ledger = base ? base.ledger : null;
    if (ledger == null) {
      violations.push(`UNLEDGERED CONSTRUCT: ${key} (${row.kind}, ${row.cellCount} cells)\n`
        + `      ${row.file}:${rowsByKey.get(key)?.line ?? '?'}\n`
        + '      Add a LABEL_LEDGER row naming its foundation, or mark it '
        + '"EXCLUDED:<reason>" with a reason from EXCLUSION_REASONS.\n'
        + '      --update RECORDS a construct; it does not decide anything about it.');
      continue;
    }
    if (ledger.startsWith('EXCLUDED:')) {
      const reason = ledger.slice('EXCLUDED:'.length);
      // 5 — EXCLUSION MALFORMED
      if (!isExclusionReason(reason)) {
        violations.push(`EXCLUSION MALFORMED: ${key} is excluded as "${reason}", which is not `
          + 'in EXCLUSION_REASONS. An exclusion is a recorded judgment, so its vocabulary is '
          + 'closed.');
        continue;
      }
      if (reason === 'not-yet-triaged') {
        if (!base.ticket) {
          violations.push(`EXCLUSION MALFORMED: ${key} is "not-yet-triaged" with no ticket. `
            + 'That reason is a promise to come back, and a promise with no owner is not one.');
        } else if (base.since && daysSince(base.since) > UNTRIAGED_MAX_DAYS) {
          // 6 — STALE EXCLUSION
          violations.push(`STALE EXCLUSION: ${key} has been "not-yet-triaged" since `
            + `${base.since} (${Math.floor(daysSince(base.since))} days, limit `
            + `${UNTRIAGED_MAX_DAYS}). Triage it or give it a real exclusion reason — an `
            + 'exception that never expires is how the exclusions list becomes the register.');
        }
      }
      continue;
    }
    // 2 — UNKNOWN LEDGER ID
    if (!LEDGER_BY_ID.has(ledger)) {
      violations.push(`UNKNOWN LEDGER ID: ${key} points at "${ledger}", which is not in `
        + 'LABEL_LEDGER. A row was deleted or renamed while the baseline still names it.');
      continue;
    }
    // The row must actually claim this site, or the join is decorative.
    if (!CLAIMED_SITES.has(key)) {
      violations.push(`UNCLAIMED SITE: ${key} points at ${ledger}, but that row's \`sites\` `
        + 'does not list this key. Add it, so the row states what it covers.');
    }
    // 4 — KEY SPACE GREW. Asymmetric ON PURPOSE, and NOT the same semantics as
    // check-additive.mjs: shrinking a key space is fine and re-snapshots freely. This is a
    // LEDGER invariant (a new label needs a decision), not a compatibility one.
    if (base.shapeDigest !== row.shapeDigest) {
      const grew = row.keyPaths.some((depth, i) => {
        const was = base.keyPaths[i] ?? [];
        return depth.some((k) => !was.includes(k));
      }) || row.keyPaths.length > base.keyPaths.length;
      if (grew) {
        violations.push(`KEY SPACE GREW: ${key} gained label(s). Was `
          + `${JSON.stringify(base.keyPaths)}, is now ${JSON.stringify(row.keyPaths)}. `
          + 'A new label is a new decision — re-read the row\'s foundation before re-snapshotting.');
      }
    }
  }

  // 3 — ORPHANED LEDGER ROW: register rot, guarded from the other side.
  for (const entry of LABEL_LEDGER) {
    for (const site of entry.sites) {
      if (live[site]) continue;
      if (entry.status === 'resolved') continue; // deletion IS the resolution
      violations.push(`ORPHANED LEDGER ROW: ${entry.labelId} claims site "${site}", which the `
        + 'harvest no longer produces. Either the construct was deleted (move the row to '
        + 'status "resolved" with its commit and evidence — rows are append-only, never '
        + 'deleted), or a DETECTOR REGRESSED and the gate is about to go green by breaking.');
    }
  }

  return violations;
};

// ─── run ──────────────────────────────────────────────────────────────────────

let result;
try {
  result = harvest(ROOTS);
} catch (err) {
  console.error(`❌ check-label-ledger: harvest failed — ${err.message}`);
  process.exit(2);
}

if (result.parseFailures.length) {
  console.error('❌ check-label-ledger: files failed to parse. A file that cannot be parsed is');
  console.error('   a file that HIDES from the ledger, so this is a failure and not a skip.');
  for (const f of result.parseFailures) console.error(`   - ${f}`);
  process.exit(2);
}

const vacuity = vacuityProblems(result);
if (vacuity.length) {
  console.error('❌ check-label-ledger: HARVEST VACUOUS — the sweep stopped seeing things.');
  console.error('');
  for (const v of vacuity) console.error(`   - ${v}`);
  console.error('');
  console.error('   Narrowing scope is how a ledger goes green without anyone deciding it should.');
  process.exit(1);
}

const rowsByKey = new Map(result.rows.map((r) => [r.key, r]));
const prior = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

if (has('--update') || has('--seed-untriaged')) {
  const seedTicket = valueOf('--seed-untriaged');
  const live = snapshot(result.rows, prior);
  let seeded = 0;
  if (seedTicket) {
    if (!/^WS-\d+$/.test(seedTicket)) {
      console.error('❌ --seed-untriaged requires a WS-NNN ticket that owns the triage.');
      process.exit(2);
    }
    const today = new Date().toISOString().slice(0, 10);
    for (const row of Object.values(live)) {
      if (row.ledger != null) continue;
      row.ledger = 'EXCLUDED:not-yet-triaged';
      row.ticket = seedTicket;
      row.since = today;
      seeded += 1;
    }
  }
  writeFileSync(BASELINE, `${JSON.stringify(live, null, 2)}\n`, 'utf8');
  const nulls = Object.values(live).filter((r) => r.ledger == null).length;
  console.log(`✅ Label-harvest baseline re-snapshotted at ${BASELINE}`);
  console.log(`   ${Object.keys(live).length} constructs.`);
  if (seeded) {
    console.log(`   ${seeded} seeded as EXCLUDED:not-yet-triaged, owned by ${seedTicket}, `
      + `expiring in ${UNTRIAGED_MAX_DAYS} days.`);
  }
  if (nulls) {
    console.log(`   ${nulls} carry ledger: null and WILL STILL FAIL the gate — that is the`);
    console.log('   point. --update records that a construct exists; it does not decide');
    console.log('   anything about it. Write a LABEL_LEDGER row or a reasoned exclusion.');
  }
  console.log('   Review the diff before committing — this file IS the invariant.');
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  console.error(`❌ check-label-ledger: no baseline at ${BASELINE}`);
  console.error('   Create it with --seed-untriaged WS-445, then commit it.');
  process.exit(1);
}

const live = snapshot(result.rows, prior);

if (has('--unledgered')) {
  const pending = Object.entries(live)
    .filter(([k]) => {
      const b = prior[k];
      return !b || b.ledger == null || b.ledger === 'EXCLUDED:not-yet-triaged';
    })
    .map(([k, r]) => ({ k, r, line: rowsByKey.get(k)?.line }));
  console.log(`${pending.length} construct(s) awaiting a ledger decision:\n`);
  for (const { k, r, line } of pending) {
    console.log(`  ${r.file}:${line}  ${r.symbol}  [${r.kind}, ${r.cellCount} cells]`);
    console.log(`     key: ${k}`);
  }
  process.exit(0);
}

const violations = compare(prior, live, rowsByKey);

// The ledger's own blind-spot rule travels with the gate.
const self = ledgerSelfCheck();
violations.push(...self.problems);

if (violations.length) {
  console.error('❌ LABEL LEDGER VIOLATION');
  console.error('');
  for (const v of violations) console.error(`   - ${v}`);
  console.error('');
  console.error('Every discrete key standing between game state and a numeric engine parameter');
  console.error('is a ledger row (POKER_THEORY §17). Prose forbade these in four forms already');
  console.error('and 49 families exist anyway — which is why this is a gate and not a comment.');
  console.error('');
  console.error('   See what needs a decision:  node scripts/standardOfRecord/check-label-ledger.mjs --unledgered');
  console.error('   Legitimate additive change: node scripts/standardOfRecord/check-label-ledger.mjs --update');
  process.exit(1);
}

const byKind = {};
for (const r of result.rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
const untriaged = Object.values(prior)
  .filter((r) => r.ledger === 'EXCLUDED:not-yet-triaged').length;

console.log('✅ Label & Foundation Ledger: OK');
console.log(`   - ${result.rows.length} constructs over ${result.files} files `
  + `(${byKind['keyed-numeric-table'] ?? 0} tables, ${byKind['label-switch'] ?? 0} switches, `
  + `${byKind['label-ternary'] ?? 0} ternaries), all claimed.`);
console.log(`   - ${LABEL_LEDGER.length} ledger rows. ${self.notes.join('; ')}`);
if (untriaged) {
  console.log(`   - ${untriaged} still EXCLUDED:not-yet-triaged — the triage backlog, aging out `
    + `at ${UNTRIAGED_MAX_DAYS} days.`);
}
