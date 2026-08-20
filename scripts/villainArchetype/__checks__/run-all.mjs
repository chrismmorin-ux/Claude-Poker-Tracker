/**
 * Run every known-answer check in this directory.
 *
 * WHY THIS FILE DID NOT EXIST UNTIL NOW, WHICH IS THE POINT.
 * Six check files lived here, each one written because a real bug reached a real number, and
 * each one documented in `docs/villain-archetype/CONTINUATION.md` with the line "Run them; they
 * have caught real bugs." Nothing ran them. Not `npm test`, not `preflight`, not CI — grep for
 * `__checks__` across package.json, the CI workflow and the test runner returns nothing but
 * that documentation line. A check that only runs when someone remembers it is a check that
 * runs after the bug ships, not before.
 *
 * Each check is a standalone script that exits non-zero on failure. This runs them in a child
 * process each, so one crash cannot take the rest down with it, and reports every result rather
 * than stopping at the first failure — a run that stops early hides how much is broken.
 */
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const only = process.argv[2] ?? null;

const files = readdirSync(here)
  .filter((f) => f.endsWith('.check.mjs'))
  .filter((f) => !only || f.includes(only))
  .sort();

if (!files.length) {
  console.error(only ? `no check matches "${only}"` : 'no *.check.mjs files found');
  process.exit(1);
}

const results = [];
for (const f of files) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, [join(here, f)], { encoding: 'utf8' });
  const secs = (Date.now() - t0) / 1000;
  const passed = r.status === 0;
  results.push({ file: f, passed, secs, status: r.status });
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${f.padEnd(34)} ${secs.toFixed(1)}s`);
  if (!passed) {
    // The whole output, not a summary. A failing known-answer check is telling you a specific
    // number is wrong, and the number is in the output.
    process.stdout.write(r.stdout ?? '');
    process.stderr.write(r.stderr ?? '');
  }
}

const bad = results.filter((r) => !r.passed);
console.log(`\n${results.length - bad.length}/${results.length} check file(s) passed`);
if (bad.length) console.log(`failing: ${bad.map((r) => r.file).join(', ')}`);
process.exit(bad.length ? 1 : 0);
