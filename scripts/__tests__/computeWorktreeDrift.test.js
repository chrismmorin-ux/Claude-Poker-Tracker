/**
 * WS-595 — the staleness gate was blind to the working tree, which is where specs are authored.
 *
 * The defect these cover: `missingScriptsAtCommit`'s `stale` set and the `localCodeDigest` pair
 * both asked "would cm-node1 run different code than I am looking at" by comparing the pinned
 * commit against `HEAD`. HEAD is not what anyone is looking at. An edit that is saved but not
 * committed is identical at both commits, so both gates passed it.
 *
 * Measured on the run that produced this fix: WS-594 requires artifacts carrying
 * `totals.budgetGated`, a field that existed only in the working-tree copy of
 * `probe-depth2-coverage.mjs` (blob a93cd980). At cm-node1's HEAD (446ab938) and G16's HEAD
 * (b5e54400) the blob was 5f8bf40c in both — so `stale` was empty and the job submitted clean.
 * It would have run to completion and written artifacts that cannot satisfy the item.
 *
 * `sees nothing when the pinned commit and HEAD agree` is the control: it asserts the blindness
 * directly, so this file fails if someone reverts the gate to a commit-to-commit comparison.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

const require_ = createRequire(import.meta.url);
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const MODULE = path.join(REPO_ROOT, 'kit/scripts/cwos-fleet-compute.js');

const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** A throwaway repo with an entry script that imports a helper — a two-file closure. */
function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wsdrift-'));
  git(dir, 'init', '-q');
  git(dir, 'config', 'user.email', 't@example.com');
  git(dir, 'config', 'user.name', 'test');
  fs.writeFileSync(path.join(dir, 'probe.mjs'), "import './helper.mjs';\nconsole.log('v1');\n");
  fs.writeFileSync(path.join(dir, 'helper.mjs'), "export const K = 1;\n");
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'c1');
  return { dir, c1: git(dir, 'rev-parse', 'HEAD') };
}

const { worktreeDrift } = require_(MODULE);

/** The repo root is injected — vitest workers forbid `process.chdir`, which is why it is a param. */
const driftIn = (dir, commit, steps) => worktreeDrift(commit, steps, dir);

const STEPS = [{ name: 's', cmd: 'node', args: ['probe.mjs', '--boards', '60'] }];

describe('WS-595 — worktreeDrift sees what a commit-to-commit gate cannot', () => {
  it('flags an UNCOMMITTED edit to a closure file, and names the right remedy', () => {
    const { dir, c1 } = makeRepo();
    fs.writeFileSync(path.join(dir, 'helper.mjs'), "export const K = 2;\n");

    const out = driftIn(dir, c1, STEPS);
    expect(out.ok).toBe(true);
    expect(out.drift).toEqual([{ file: 'helper.mjs', kind: 'uncommitted' }]);
  });

  it('the control: the pinned commit and HEAD are IDENTICAL for that file', () => {
    // This is the blindness itself. If this assertion ever fails, the scenario above stopped
    // being the one WS-595 was about and the regression test is no longer guarding anything.
    const { dir, c1 } = makeRepo();
    fs.writeFileSync(path.join(dir, 'helper.mjs'), "export const K = 2;\n");
    expect(git(dir, 'rev-parse', `${c1}:helper.mjs`))
      .toEqual(git(dir, 'rev-parse', 'HEAD:helper.mjs'));
  });

  it('flags a committed-but-UNPUSHED change, and distinguishes it from uncommitted', () => {
    const { dir, c1 } = makeRepo();
    fs.writeFileSync(path.join(dir, 'helper.mjs'), "export const K = 2;\n");
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'c2');

    const out = driftIn(dir, c1, STEPS);
    expect(out.drift).toEqual([{ file: 'helper.mjs', kind: 'unpushed' }]);
  });

  it('flags an UNTRACKED closure file — diff has nothing to compare it against', () => {
    const { dir, c1 } = makeRepo();
    fs.writeFileSync(path.join(dir, 'probe.mjs'), "import './helper.mjs';\nimport './extra.mjs';\n");
    fs.writeFileSync(path.join(dir, 'extra.mjs'), "export const E = 1;\n");

    const out = driftIn(dir, c1, STEPS);
    const files = out.drift.map((d) => d.file).sort();
    expect(files).toEqual(['extra.mjs', 'probe.mjs']);
    expect(out.drift.every((d) => d.kind === 'uncommitted')).toBe(true);
  });

  it('passes a clean tree — the gate must not block the queue on no evidence', () => {
    const { dir, c1 } = makeRepo();
    const out = driftIn(dir, c1, STEPS);
    expect(out.ok).toBe(true);
    expect(out.drift).toEqual([]);
  });

  it('reports its own inconclusiveness rather than passing, when the commit is unreadable', () => {
    const { dir } = makeRepo();
    const out = driftIn(dir, '0000000000000000000000000000000000000000', STEPS);
    expect(out.unchecked).toBe(true);
    expect(out.drift).toEqual([]);
  });
});
