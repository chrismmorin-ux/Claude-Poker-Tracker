/**
 * holeMapGit.mjs — the two git questions the Hole Map's freshness verdict needs answered.
 *
 * WHY THIS IS A SEPARATE MODULE FROM `holeMapFreshness.mjs`. The verdict, its copy and its
 * banner are pure functions over data, and the eventual in-app study surface has to be able to
 * import them verbatim — if it cannot, it will re-implement the banner and the two will drift,
 * which is the same defect class as transcribing a number into JSX. `node:child_process` in the
 * same module would make that import impossible in a browser bundle. So the impure half lives
 * here, and nothing in the app will ever import this file.
 *
 * Both functions return `null` — not a falsy answer — when git cannot be asked. `null` and
 * `[]` / `false` mean opposite things, and collapsing them would let a broken checker present
 * as "current", which is the one output it must never fake.
 */

import { execFileSync } from 'node:child_process';
import { WATCHED_PATHS, parseCommitLines } from './holeMapFreshness.mjs';

/**
 * The git invocation, as an injectable seam.
 *
 * WHY IT IS INJECTABLE. Asserting the `null`-vs-`[]` discipline by actually spawning git makes
 * the assertion measure PROCESS SPAWN LATENCY under whatever else the machine is doing — and
 * this repo has already paid for that mistake once (`fe716f59`, "stop two EV assertions from
 * measuring machine load"). Spawning also cannot exercise the failure branch on demand. So the
 * spawn is a parameter: the tests drive the contract with a fake, deterministically and in
 * microseconds, and one integration test still runs the real thing.
 */
export const gitRun = (args, { cwd = process.cwd() } = {}) => execFileSync('git', args, {
  cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
});

/**
 * Ask git which watched commits landed after `sinceCommit`.
 *
 * Returns `null` — not an empty list — when the question cannot be answered (no git, unknown
 * commit, detached history). `null` and `[]` mean opposite things and collapsing them would
 * let a broken checker present as "current", which is the one output it must never fake.
 *
 * Only a resolved hex sha is accepted. A ref name like `HEAD` would silently mean something
 * different tomorrow, so a manifest that stamped one would be unfalsifiable.
 *
 * @returns {{sha: string, subject: string}[] | null}
 */
export const readEngineCommits = (
  sinceCommit,
  { cwd = process.cwd(), paths = WATCHED_PATHS, run = gitRun } = {},
) => {
  if (typeof sinceCommit !== 'string' || !/^[0-9a-f]{7,40}$/i.test(sinceCommit)) return null;
  try {
    return parseCommitLines(run(
      ['log', '--no-merges', '--format=%H%x1f%s', `${sinceCommit}..HEAD`, '--', ...paths],
      { cwd },
    ));
  } catch {
    // Unknown commit / no repo / no git. Unanswerable, and it says so.
    return null;
  }
};

/**
 * Was there an uncommitted change *in the watched paths* when this ran?
 *
 * NOT `git status --porcelain` over the whole tree — that is what `gitStamp` reports, and in
 * this repo it is true almost always because CWOS rewrites `.claude/workstream/**` on every
 * command. A dirty-tree verdict keyed on that would fire on every single artifact and become
 * the banner nobody reads. The question that actually matters is narrower: did the ENGINE
 * differ from its last commit when the numbers were computed? Only then is the stamped commit
 * a lie about what ran.
 *
 * Returns `null` when git cannot be asked — the same discipline as `readEngineCommits`.
 */
export const readWatchedDirty = ({ cwd = process.cwd(), paths = WATCHED_PATHS } = {}) => {
  try {
    const out = execFileSync('git', ['status', '--porcelain', '--', ...paths], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim().length > 0;
  } catch {
    return null;
  }
};