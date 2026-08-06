#!/usr/bin/env node
/**
 * cwos-closure-guard-lint — refuse a sixth hand-rolled closure guard (WS-561).
 *
 * WHY A LINT AND NOT A DATA CHECK
 *
 * WS-561's fix makes the closure writers value-aware, which is tolerance. The
 * run-028 failure pass raised the right objection to tolerance: a tolerant
 * reader SUPPRESSES the signal that would reveal drift. If a future script
 * hand-rolls the old presence-guard again, it silently drops values exactly as
 * before, and nothing errors — the failure is invisible for quarters and found
 * by accident.
 *
 * So the invariant guards the GUARD, not the data. Checking the data would be
 * wrong: null-shaped items are legal (they arrive via migration, and
 * cwos-adopt-install.js already treats `completed_at: null` as the canonical
 * pre-closure form), so flagging them would fail on correct input forever.
 * What must never recur is the presence-test itself.
 *
 * THE ANTIPATTERN
 *
 *     if (!/^completed_at:/m.test(patched)) { ...insert... }
 *
 * That asks whether the KEY exists, not whether it has a VALUE. Five sites
 * carried it; two were byte-for-byte copies. Route through
 * cwos-utils.upsertYAMLScalarField instead.
 *
 * Usage:  cwos-closure-guard-lint [--dir <path>] [--json]
 *
 * exit 0 — clean · 1 — violations · 2 — bad args
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

// The fields whose absence-vs-null distinction actually cost data.
const GUARDED_FIELDS = ['completed_at', 'completion_commit', 'closed_by_event', 'started_at', 'claimed_at'];

// A regex-literal presence test against one of those keys, anchored at line
// start — i.e. exactly the shape that shipped the bug. Matches both
// `!/^completed_at:/m.test(x)` and `/^completed_at:/m.test(x) === false`.
const ANTIPATTERN = new RegExp(
  `/\\^(?:${GUARDED_FIELDS.join('|')}):[^/]*/m\\s*\\.\\s*test\\s*\\(`,
  'g'
);

// The helper's own file legitimately reasons about these shapes.
const EXEMPT = new Set([
  'kit/scripts/lib/cwos-utils.js',
  'kit/scripts/cwos-closure-guard-lint.js',
  'kit/scripts/cwos-closure-backfill.js',
]);

function walk(dir, out = []) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '__tests__') continue;
      walk(full, out);
    } else if (e.isFile() && e.name.endsWith('.js')) {
      out.push(full);
    }
  }
  return out;
}

function scan(rootDir) {
  const scriptsDir = path.join(rootDir, 'kit', 'scripts');
  const violations = [];
  let filesScanned = 0;

  for (const file of walk(scriptsDir)) {
    const rel = path.relative(rootDir, file).replace(/\\/g, '/');
    if (EXEMPT.has(rel)) continue;
    filesScanned++;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!/completed_at|completion_commit|closed_by_event|started_at|claimed_at/.test(text)) continue;

    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      ANTIPATTERN.lastIndex = 0;
      if (ANTIPATTERN.test(lines[i])) {
        violations.push({ file: rel, line: i + 1, snippet: lines[i].trim().slice(0, 100) });
      }
    }
  }

  return { ok: violations.length === 0, files_scanned: filesScanned, violation_count: violations.length, violations };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    process.stdout.write(
      'cwos-closure-guard-lint — refuse a hand-rolled closure presence-guard (WS-561)\n\n' +
      'usage: cwos-closure-guard-lint [--dir <path>] [--json]\n\n' +
      '  --dir <path>  repo root (default: cwd)\n' +
      '  --json        machine-readable report\n' +
      '  -h, --help    print this usage and exit without acting\n\n' +
      'Flags `!/^completed_at:/m.test(...)`-style guards, which test key presence\n' +
      'rather than value and silently drop writes on null-scaffolded items.\n' +
      'Use cwos-utils.upsertYAMLScalarField instead.\n\n' +
      'exit 0 — clean · 1 — violations · 2 — bad args\n'
    );
    process.exit(0);
  }
  for (const a of args) {
    if (a.startsWith('--') && a !== '--dir' && a !== '--json') {
      process.stderr.write(`cwos-closure-guard-lint: unknown flag: ${a}\n`);
      process.exit(2);
    }
  }

  const di = args.indexOf('--dir');
  const rootDir = path.resolve(di !== -1 && args[di + 1] ? args[di + 1] : process.cwd());
  const result = scan(rootDir);

  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (result.ok) {
    process.stdout.write(`closure-guard-lint: ${result.files_scanned} script(s) scanned — no presence-guards on closure fields\n`);
  } else {
    process.stderr.write(`closure-guard-lint: ${result.violation_count} presence-guard(s) on closure fields\n`);
    for (const v of result.violations) {
      process.stderr.write(`  ${v.file}:${v.line}\n    ${v.snippet}\n`);
    }
    process.stderr.write('\nThese test whether the KEY exists, not whether it has a VALUE, so they\n');
    process.stderr.write('silently skip items that scaffold the field as null. Use\n');
    process.stderr.write('cwos-utils.upsertYAMLScalarField(content, key, value, { after }).\n');
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();

module.exports = { scan };
