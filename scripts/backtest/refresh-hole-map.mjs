#!/usr/bin/env node
/**
 * refresh-hole-map.mjs — the ONE entry point that regenerates the Hole Map.
 *
 *   npm run hole-map
 *
 * WHY THIS EXISTS RATHER THAN A COMMAND IN A DOC. The generator takes six flags whose values
 * are load-bearing (which decision record, which fold cells, how many corpus files) and a doc
 * that carries them is a doc that will be pasted with last month's values. The canonical
 * invocation belongs in code where it can be read, diffed and tested. `SCORED-READOUT-SPEC.md`
 * §9bis and `docs/runbooks/baseline-ev-run.md` §11 both point HERE rather than restating it.
 *
 * THE DECISION SOURCE IS AUTO-SELECTED, AND SAID OUT LOUD. The per-decision sidecar
 * (`--decisions-out` from a baseline run) is strictly better than the depth-ablation run rows —
 * see the substitution ledger at the top of `run-hole-map.mjs`. When a sidecar is present this
 * picks it and prints that it did; when it is not, it degrades to the ablation rows and prints
 * THAT. A silent fallback would let the artifact quietly lose a column between runs.
 *
 * Pass through any extra flags: `npm run hole-map -- --max-files 120`.
 */

import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

/** Sidecars in preference order — newest baseline run first. */
const DECISION_SIDECARS = [
  'out/baseline-ev-run1.decisions.jsonl',
  'out/decisions.jsonl',
];
const FALLBACK_DECISIONS = 'out/depth-ablation.json';

const passthrough = process.argv.slice(2);
const has = (name) => passthrough.some((a) => a === `--${name}`);

const args = [
  join(HERE, 'run-hole-map.mjs'),
  '--policy', 'out/behavior-policy.json',
  '--fold-cells', 'out/fold-vs-sizing.json',
  '--fold-fit', 'out/fold-curve-fit.txt',
  '--out', 'out/hole-map.json',
  '--html', 'out/hole-map.html',
];
if (!has('max-files')) args.push('--max-files', '40');

if (!has('decision-records') && !has('decisions')) {
  const sidecar = DECISION_SIDECARS.find((p) => existsSync(join(REPO, p)));
  if (sidecar) {
    console.log(`decision source: PER-DECISION SIDECAR ${sidecar} (preferred)`);
    args.push('--decision-records', sidecar);
  } else {
    console.log(`decision source: ${FALLBACK_DECISIONS} — DEGRADED. No per-decision sidecar on`);
    console.log('  disk, so the per-action EV column stays empty. Produce one with the'
      + ' `--decisions-out`');
    console.log('  flag on a baseline run (docs/runbooks/baseline-ev-run.md §3).');
    args.push('--decisions', FALLBACK_DECISIONS);
  }
}
args.push(...passthrough);

const gen = spawnSync(process.execPath, args, { cwd: REPO, stdio: 'inherit' });
if (gen.status !== 0) process.exit(gen.status ?? 1);

// Restamp immediately. At this instant the verdict is trivially "current", but running the
// checker here means the generation path and the read path produce the banner through the SAME
// code — a divergence between them would be a banner that disagrees with the check.
const chk = spawnSync(
  process.execPath,
  [join(HERE, 'check-hole-map-freshness.mjs')],
  { cwd: REPO, stdio: 'inherit' },
);
process.exit(chk.status === 1 ? 1 : 0);
