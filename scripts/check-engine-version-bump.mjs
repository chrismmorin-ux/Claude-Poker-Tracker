#!/usr/bin/env node
/**
 * check-engine-version-bump.mjs — WS-466 (FIND-127) gate.
 *
 * ENGINE_VERSION is the only thing that lets a predictionAudit record say WHICH
 * engine produced it. It sat at 'v123' through three algorithm-shape changes
 * (WS-436/450/451), so every record from that span is unattributable forever —
 * damage that cannot be repaired after the fact, only stopped from growing.
 * This gate stops it from growing: engine sources may not change without an
 * ENGINE_VERSION bump.
 *
 * Two checks, both against git (not text patterns — FIND-130 documented how a
 * content-regex gate gets talked out of its job):
 *   1. WORKING TREE: any modified/added engine source (tests excluded) while
 *      ENGINE_VERSION in the working tree still equals HEAD's → FAIL.
 *   2. HISTORY RATCHET: the newest commit touching engine sources is newer than
 *      the newest commit touching runtimeVersions.js, and no bump is pending in
 *      the working tree → FAIL. (After the bump commits, the ratchet resets.)
 *
 * `--assume-no-bump` runs the same checks pretending the working-tree bump does
 * not exist — the self-test path: with any engine-source change present it MUST
 * exit non-zero, which is how the gate proves it can actually fire.
 */
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const VERSION_FILE = 'src/constants/runtimeVersions.js';
const ENGINE_PATHS = [
  'src/utils/exploitEngine',
  'src/utils/rangeEngine',
  'src/utils/handAnalysis',
];
// Tests and docs are not algorithm changes.
const EXCLUDES = [':(exclude)**/__tests__/**', ':(exclude)**/*.test.js', ':(exclude)**/*.md'];
const SOURCE_RE = /\.(js|jsx|mjs)$/;

const assumeNoBump = process.argv.includes('--assume-no-bump');

const git = (...args) => {
  const r = spawnSync('git', args, { encoding: 'utf8' });
  if (r.status !== 0) return null;
  return r.stdout;
};

const parseVersion = (text) => {
  const m = text && text.match(/ENGINE_VERSION\s*=\s*'([^']+)'/);
  return m ? m[1] : null;
};

const headText = git('show', `HEAD:${VERSION_FILE}`);
const headVersion = parseVersion(headText);
const workVersion = parseVersion(readFileSync(VERSION_FILE, 'utf8'));
const bumpPending = !assumeNoBump && headVersion !== null && workVersion !== headVersion;

const failures = [];

// 1. Working-tree engine edits (modified, staged, or new untracked sources).
const statusOut = git('status', '--porcelain', '--', ...ENGINE_PATHS) || '';
const dirtySources = statusOut
  .split('\n')
  .filter(Boolean)
  .map((l) => l.slice(3).trim())
  .filter((p) => SOURCE_RE.test(p) && !/__tests__|\.test\./.test(p));
if (dirtySources.length && !bumpPending) {
  failures.push(
    `engine source changed in the working tree without an ENGINE_VERSION bump:\n` +
    dirtySources.map((p) => `     ${p}`).join('\n')
  );
}

// 2. History ratchet: last engine-source commit vs last version-file commit.
const engineLast = parseInt(git('log', '-1', '--format=%ct', '--', ...ENGINE_PATHS, ...EXCLUDES) || '0', 10);
const versionLast = parseInt(git('log', '-1', '--format=%ct', '--', VERSION_FILE) || '0', 10);
if (engineLast > versionLast && !bumpPending) {
  failures.push(
    `engine sources were committed after the last ENGINE_VERSION change ` +
    `(engine ${new Date(engineLast * 1000).toISOString()} > version ${new Date(versionLast * 1000).toISOString()})`
  );
}

if (failures.length) {
  console.error('❌ check-engine-version-bump: ENGINE_VERSION must change with the engine.');
  console.error(`   Bump ENGINE_VERSION in ${VERSION_FILE} (currently '${workVersion}').`);
  console.error('   Every predictionAudit record is stamped with it; an unbumped version');
  console.error('   makes engine eras permanently unattributable (FIND-127).');
  failures.forEach((f) => console.error('   - ' + f));
  process.exit(1);
}
console.log(
  `✓ check-engine-version-bump: ENGINE_VERSION '${workVersion}'` +
  (bumpPending ? ` (bump pending vs HEAD '${headVersion}')` : ' current vs engine history')
);
