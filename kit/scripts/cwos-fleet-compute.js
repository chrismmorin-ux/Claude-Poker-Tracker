#!/usr/bin/env node
'use strict';
/**
 * cwos-fleet-compute.js — keep the fleet's compute node fed with the most important work.
 *
 * THE PROBLEM, MEASURED 2026-08-16. cm-node1 has run a healthy `Fleet-ComputeRunner` since
 * 2026-08-15: it ticks every five minutes, its last 300+ ticks all succeeded, and 314 of its
 * 379 ledger events were `tick_idle`. A machine waking up every five minutes for a day to
 * discover it has nothing to do. Meanwhile six `runs_on: node1` items sat in this repo's
 * queue. The runner was never the missing piece — the supply chain was. Three links were
 * broken and each had to be fixed for any of it to work:
 *
 *   1. `runs_on` never reached state. The workstream reducer's ITEM_FIELDS whitelist did not
 *      include it, so all 174 backfilled labels were invisible to every consumer. "The most
 *      important node1 item" was not an expressible query.
 *   2. No item was executable. A WS-*.yaml is prose; the runner needs argv and expectFiles.
 *   3. Nothing ever asked. `/next` had no fleet step, and nothing fed the queue on a cadence.
 *
 * This script is link 3, and it deliberately reuses the SAME ranking `/next` shows the
 * founder (cwos-next.js candidates) rather than computing a private ordering. A second
 * ranking would drift, and the machine would end up confidently working on something the
 * founder had already deprioritised.
 *
 * COMMANDS
 *   status [--json]        what is node1 doing right now (read-only, degrades gracefully)
 *   rank   [--json]        node1 candidates in founder-visible priority order
 *   feed   [--dry-run]     if node1 is idle, submit the top ready item
 *
 * RUNS FROM EITHER END. On cm-node1 (the scheduled feeder) it operates on local paths. From
 * G16 (during `/next`) it goes over ssh + scp — the channels the fleet skill mandates. It
 * detects which by hostname rather than by a flag, so the scheduled task and the interactive
 * call are the same code path.
 *
 * NEVER BLOCKS THE CALLER. Every remote call carries a timeout and every failure degrades to
 * `reachable: false` with a reason. `/next` must not hang because a Surface is asleep.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { materializeSpec, readQueueItem, normalizeRunsOn, validateComputeJob,
        stepsFingerprint, materializeSteps } = require('./lib/cwos-compute-job');
const { pendingSets, extractHighlights, buildReviewItem, markHarvested, headlineFor, HARVEST_MARKER,
        harvestedContentKeys } = require('./lib/cwos-fleet-harvest');

// ------------------------------------------------------------------ config

const TARGET = process.env.CWOS_COMPUTE_HOST || 'cm-node1';
// The machine name as Windows reports it, used to decide local vs remote.
const TARGET_HOSTNAME = (process.env.CWOS_COMPUTE_HOSTNAME || 'CM-NODE1').toUpperCase();
const REMOTE_NODE = process.env.CWOS_COMPUTE_NODE || 'C:\\Users\\chris\\.local\\node\\node.exe';
const REMOTE_RUNNER = process.env.CWOS_COMPUTE_RUNNER
  || 'C:\\Users\\chris\\repos\\ai-personal\\nodes\\scripts\\compute-runner.js';
const REMOTE_REPO = process.env.CWOS_COMPUTE_REPO || 'C:\\Users\\chris\\repos\\claude-poker-tracker';
const REMOTE_INBOX = process.env.CWOS_COMPUTE_INBOX || 'C:\\Users\\chris\\fleet\\compute\\incoming';
const REMOTE_DONE = process.env.CWOS_COMPUTE_DONE || 'C:\\Users\\chris\\fleet\\compute\\done';

const REMOTE_LOGS = process.env.CWOS_COMPUTE_LOGS || 'C:\\Users\\chris\\fleet\\compute\\logs';

// Where returned artifact sets land on THIS machine (the runner's `returnTo.dir`).
const INBOX_DIR = process.env.CWOS_COMPUTE_INBOX_LOCAL || 'C:\\Users\\chris\\fleet\\inbox';

const SSH_TIMEOUT_MS = Number(process.env.CWOS_COMPUTE_TIMEOUT_MS || 20000);

const REPO_ROOT = process.cwd();
const QUEUE_DIR = path.join(REPO_ROOT, '.claude', 'workstream', 'queue');

const onTarget = () => os.hostname().toUpperCase() === TARGET_HOSTNAME;

// ------------------------------------------------------------------ shell

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    encoding: 'utf8',
    timeout: opts.timeout || SSH_TIMEOUT_MS,
    windowsHide: true,
    ...opts,
  });
  return {
    ok: r.status === 0,
    status: r.status,
    stdout: (r.stdout || '').trim(),
    // ssh prints a post-quantum advisory to stderr on every connection here; it is noise,
    // not failure, so stderr alone never decides ok-ness.
    stderr: (r.stderr || '').trim(),
    timedOut: r.error && r.error.code === 'ETIMEDOUT',
    error: r.error ? String(r.error.message || r.error) : null,
  };
}

/** Run a command on the compute node — locally if we ARE it, else over ssh. */
function onCompute(argv, opts = {}) {
  if (onTarget()) return run(process.execPath, [REMOTE_RUNNER, ...argv], opts);
  return run('ssh', [TARGET, `${quote(REMOTE_NODE)} ${quote(REMOTE_RUNNER)} ${argv.map(quote).join(' ')}`], opts);
}

/** Quote a single argument for the remote shell. Paths here contain spaces and backslashes. */
function quote(s) {
  const str = String(s);
  return /[\s"']/.test(str) ? `"${str.replace(/"/g, '\\"')}"` : str;
}

// ------------------------------------------------------------------ status

function computeStatus() {
  const base = { host: TARGET, local: onTarget(), reachable: false, running: null, queued: [], doneCount: null };
  const r = onCompute(['status', '--json']);
  if (!r.ok) {
    return {
      ...base,
      reason: r.timedOut
        ? `no response in ${SSH_TIMEOUT_MS}ms (asleep or off-tailnet)`
        : (r.stderr.split('\n').filter((l) => !/post-quantum|store now|may need to be upgraded|^\*\*/.test(l))[0]
           || r.error || `exit ${r.status}`),
    };
  }
  let parsed;
  try {
    // ssh may prepend the advisory banner; take the JSON object only.
    const at = r.stdout.indexOf('{');
    parsed = JSON.parse(at === -1 ? r.stdout : r.stdout.slice(at));
  } catch (e) {
    return { ...base, reason: `unparseable status output: ${String(e.message).slice(0, 120)}` };
  }
  return {
    ...base,
    reachable: true,
    running: parsed.running || null,
    queued: parsed.queued || [],
    doneCount: parsed.doneCount ?? null,
    idle: !parsed.running && (parsed.queued || []).length === 0,
  };
}

/**
 * Job ids the compute node has already finished (succeeded or failed).
 *
 * The feeder consults this before submitting so a completed item is not re-run. A failed job
 * is included deliberately: the runner already retried it `maxAttempts` times internally, so
 * a failure here means the spec or the code needs a human, and silently re-submitting it
 * every two hours would burn the machine on a known-broken job instead of advancing to the
 * next item.
 */
function doneJobIds() {
  // Emit id|ws_id|job_hash per terminal job. Reading the recorded provenance rather than
  // pattern-matching the id is what makes this survive an id-scheme change: the first jobs
  // were commit-keyed (ws-320-48bd185e7587) and the current ones are content-keyed, and a
  // check that only compared ids would have silently re-run every pre-existing job once.
  const summary = onTarget()
    ? path.join(REPO_ROOT, 'scripts', 'fleet', 'done-summary.cjs')
    : `${REMOTE_REPO}\\scripts\\fleet\\done-summary.cjs`;
  const r = onTarget()
    ? run(process.execPath, [summary, REMOTE_DONE])
    : run('ssh', [TARGET, `${quote(REMOTE_NODE)} ${quote(summary)} ${quote(REMOTE_DONE)}`]);
  if (!r.ok) return { ok: false, ids: new Set(), prints: new Set() };
  const ids = new Set();
  const prints = new Set();  // fingerprints of work that already reached a terminal state
  for (const line of r.stdout.split('\n')) {
    const l = line.trim();
    if (!l || /^\*\*|post-quantum|store now|upgraded/.test(l)) continue;
    const [id, wsId, fingerprint, outcome, , started] = l.split('|');
    // WS-594: a job that died BEFORE running a step is not 'work that already ran'.
    // The dedup below exists so the machine does not burn every two hours on a
    // known-broken spec, and its stated premise is that the runner already retried
    // maxAttempts times. That premise does not hold for a setup failure: ws-594 died in
    // ensureWorktree with attempts=[], stepResults=0, having executed nothing, and was
    // then permanently unresubmittable while node1 idled. A stale worktree is an
    // environment condition; clearing it is exactly the human intervention the dedup
    // asks for, and after it the job must be able to run.
    //
    // Scoped hard: ONLY non-succeeded AND never-started. A job that ran and failed still
    // blocks, because that is a real spec or code defect. `started` is absent on records
    // written by an older done-summary, and absent must NOT mean retryable — an unknown
    // history is treated as 'started', so the conservative behaviour is the default.
    const neverStarted = started === 'never-started' && outcome && outcome !== 'succeeded';
    if (neverStarted) continue;
    if (id) ids.add(id);
    // Fingerprints of every terminal job, regardless of which item they came from. The
    // fingerprint identifies the WORK, so this needs no ws_id -- which is just as well,
    // since the runner does not preserve one.
    if (fingerprint) prints.add(fingerprint);
  }
  return { ok: true, ids, prints };
}

/**
 * The candidate side of the WS-572 code digest.
 *
 * Runs ON THE COMPUTE NODE, exactly like `done-summary.cjs` computes the historical side —
 * same machine, same working tree, same function, so the import closure both sides see is
 * identical and only the commit differs. Computing it from the local G16 checkout instead
 * would silently diverge whenever the two repos are not in step, and an asymmetric dedupe key
 * re-runs finished work rather than erroring.
 *
 * Returns null on every failure path. Null means "no digest", and `stepsFingerprint` then
 * reproduces the pre-WS-572 key — which is what the historical side also produces when it
 * cannot establish one. Degrading together is the property that matters.
 */
const digestCache = new Map();
function codeDigestFor(wsId, commit) {
  if (!wsId || !commit) return null;
  const key = `${wsId}@${commit}`;
  if (digestCache.has(key)) return digestCache.get(key);
  const script = onTarget()
    ? path.join(REPO_ROOT, 'scripts', 'fleet', 'code-digest.cjs')
    : `${REMOTE_REPO}\\scripts\\fleet\\code-digest.cjs`;
  const r = onTarget()
    ? run(process.execPath, [script, commit, wsId])
    : run('ssh', [TARGET, `${quote(REMOTE_NODE)} ${quote(script)} ${quote(commit)} ${quote(wsId)}`]);
  const line = r.ok
    ? r.stdout.split('\n').map((l) => l.trim()).filter((l) => /^[0-9a-f]{12}$/.test(l))[0] || null
    : null;
  digestCache.set(key, line);
  return line;
}

/**
 * Which of a job's step scripts are ABSENT from the pinned commit's tree.
 *
 * ── WHY THIS EXISTS (ws-295-28d02a0a9124, 2026-08-20) ──
 * The feeder pins the job to `computeHead()` — cm-node1's HEAD, which is whatever
 * `origin/main` last handed it. The spec, however, is authored on G16 against the WORKING
 * TREE, where a script may exist in a commit that has not been pushed yet. Nothing compared
 * the two. WS-295 was submitted naming `scripts/backtest/run-optimism-boards.mjs`, a file
 * introduced in db4c7e96 which was one of 36 unpushed commits; node1 was at fa526801, where
 * it does not exist. Step 0 ran for 25 minutes and SUCCEEDED, then step 1 died
 * MODULE_NOT_FOUND, twice, and the whole job was thrown away.
 *
 * The 25 wasted minutes are the cheap half. The expensive half is that this is undetectable
 * from the authoring side: the file is right there on G16's disk, so every check a human
 * would think to run passes. `validateComputeJob` cannot catch it either — it validates the
 * SHAPE of the block and has no repo, no commit, and no filesystem.
 *
 * So the check has to live here, where the pinned commit is known, and it has to run against
 * the commit rather than against any working tree.
 */
function missingScriptsAtCommit(commit, steps) {
  // A step's script is its first path-shaped argument: `node <script> --flag ...`. Anything
  // that is not repo-relative (a flag, a bare value, an absolute path) is not ours to verify.
  const wanted = [];
  for (const st of steps || []) {
    const arg = (st.args || []).find((a) => /^[\w./-]+\.(mjs|cjs|js|py|sh)$/.test(String(a)));
    if (arg && !wanted.includes(arg)) wanted.push(arg);
  }
  if (!wanted.length) return { ok: true, missing: [] };

  // One `ls-tree` for the whole set: N steps must not cost N round-trips to the compute node.
  const paths = wanted.map((w) => quote(w)).join(' ');
  const cmd = `git -C ${quote(REMOTE_REPO)} ls-tree -r --name-only ${quote(commit)} -- ${paths}`;
  const r = onTarget()
    ? run('git', ['-C', REMOTE_REPO, 'ls-tree', '-r', '--name-only', commit, '--', ...wanted])
    : run('ssh', [TARGET, cmd]);
  // A check that cannot run must not silently pass — but it also must not block the queue on
  // a transient ssh failure, so it reports its own inconclusiveness and the caller decides.
  if (!r.ok) return { ok: false, missing: [], stale: [], unchecked: true };
  const present = new Set(r.stdout.split('\n').map((l) => l.trim()).filter(Boolean));
  const missing = wanted.filter((w) => !present.has(w));

  // -- PRESENT IS NOT ENOUGH: it must be the SAME code (ws-293-3408793574cc, 2026-08-20) --
  // WS-293 was submitted with `--shards 12`, the flag WS-512 added precisely to stop this
  // probe exhausting memory on the full corpus. At the pinned commit the script EXISTS, so an
  // existence check passes it -- but that version imports only `indexEvalPlayers`, has no
  // `shards` parameter, and never shards. The unknown flag was silently ignored, all 27,809
  // players were indexed into one Map, and it died at 8 GB after reading 2.02M hands. The run
  // had LESS headroom than the unbounded run WS-512 was written to fix.
  //
  // A job running different code than its author reasoned about does not return a wrong
  // number, it returns AN ANSWER TO A DIFFERENT QUESTION -- and nothing downstream can tell,
  // because the spec, the flags and the artifact names all still look right. So compare the
  // blob at the pinned commit against the blob here, and refuse on any difference.
  const live = wanted.filter((w) => !missing.includes(w));
  const stale = [];
  if (live.length) {
    const hashAt = (rev) => {
      const h = run('git', ['-C', REPO_ROOT, 'rev-parse', ...live.map((w) => rev + ':' + w)]);
      return h.ok ? h.stdout.split('\n').map((l) => l.trim()).filter(Boolean) : null;
    };
    const atCommit = hashAt(commit);
    const atHead = hashAt('HEAD');
    if (atCommit && atHead && atCommit.length === live.length && atHead.length === live.length) {
      live.forEach((w, idx) => { if (atCommit[idx] !== atHead[idx]) stale.push(w); });
    }
  }
  return { ok: true, missing, stale };
}

/**
 * Closure files that differ between the PINNED COMMIT and the WORKING TREE on this machine.
 *
 * ── WHY THIS EXISTS (WS-595, 2026-08-20) ──
 * `missingScriptsAtCommit` and the `localCodeDigest` pair below both already ask "would node1
 * run different code than I am looking at". Both answered it by comparing the pinned commit
 * against `HEAD` — and HEAD is not what anyone is looking at. The spec is authored against the
 * WORKING TREE, which is where an uncommitted edit lives, and a commit-to-commit comparison
 * cannot see one by construction.
 *
 * Measured on the run that produced this fix. WS-594's accept criteria require artifacts
 * carrying `totals.budgetGated` and `totals.budgetGatedStages`. Those fields exist only in the
 * working-tree copy of `probe-depth2-coverage.mjs` (blob a93cd980). At both cm-node1's HEAD
 * (446ab938) and G16's HEAD (b5e54400) the blob is 5f8bf40c — identical, so `stale` was empty,
 * the closure digests matched, and the job submitted CLEAN. It would have run to completion and
 * written plausible artifacts that cannot satisfy the item, and the per-stage rows would have
 * been keyed by array index rather than by `rec.stage` — misattributed across boards.
 *
 * That is strictly worse than the MODULE_NOT_FOUND this item was filed for. A missing module
 * fails loudly and costs minutes; this returns an answer to a different question and nothing
 * downstream can tell. Third instance of the class (5e4aaabe, 446ab938 are the other two).
 *
 * ── WHY `git diff` AND NOT `hash-object` ──
 * Comparing blob shas by hand means reimplementing the checkout filters. `git diff` applies
 * .gitattributes exactly as git does, so a CRLF working tree does not read as universal drift.
 * Untracked files need their own probe because `diff` has nothing to diff them against — and a
 * closure file that is untracked is certainly not at the pinned commit.
 *
 * `repoRoot` is injected rather than read from `REPO_ROOT` directly for the same reason
 * `codeDigest` injects `lsTree`: vitest workers forbid `process.chdir`, so a gate that could
 * only be exercised against the real checkout would be a gate nobody ever tested.
 */
function worktreeDrift(commit, steps, repoRoot = REPO_ROOT) {
  let files = [];
  try {
    const { entryScripts, importClosure } = require('./lib/cwos-code-digest');
    const entries = entryScripts(steps, repoRoot);
    if (!entries.length) return { ok: true, drift: [] };
    files = importClosure(entries, repoRoot);
  } catch {
    // The lib is the same one the digest path uses; if it cannot load, that path is already
    // degrading to the legacy key and this gate has nothing to add. Do not block on it.
    return { ok: true, drift: [] };
  }
  if (!files.length) return { ok: true, drift: [] };

  const nameOnly = (rev) => {
    const r = run('git', ['-C', repoRoot, 'diff', '--name-only', rev, '--', ...files]);
    return r.ok ? new Set(r.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) : null;
  };
  const vsCommit = nameOnly(commit);
  const vsHead = nameOnly('HEAD');
  const untrackedR = run('git', ['-C', repoRoot, 'ls-files', '--others', '--exclude-standard', '--', ...files]);
  if (!vsCommit || !vsHead || !untrackedR.ok) {
    // A check that cannot run must not silently pass. Same contract as missingScriptsAtCommit:
    // report inconclusiveness and let the caller refuse rather than guess.
    return { ok: false, unchecked: true, drift: [] };
  }
  const untracked = new Set(untrackedR.stdout.split('\n').map((l) => l.trim()).filter(Boolean));

  // Classify, because the remedy differs and naming the wrong one sends someone to the wrong
  // command. Uncommitted -> the edit is not in ANY commit yet, so pushing changes nothing.
  // Unpushed -> it is committed here and simply has not reached the ref node1 pulls from.
  const drift = [];
  for (const f of files) {
    const changed = vsCommit.has(f) || untracked.has(f);
    if (!changed) continue;
    drift.push({ file: f, kind: (vsHead.has(f) || untracked.has(f)) ? 'uncommitted' : 'unpushed' });
  }
  return { ok: true, drift };
}

/**
 * The code digest for an item's job at a commit-ish, computed HERE.
 *
 * `codeDigestFor` asks cm-node1, because the dedupe's other side lives there and both sides
 * must use one function. This one is deliberately local: it prices the SAME import closure at
 * two commits on one machine, which is the only way to ask "would the compute node run
 * different code than I am looking at" without trusting the compute node's checkout to answer
 * a question about its own staleness.
 *
 * Entry-script comparison alone is not enough. WS-293's entry script did change, so it was
 * caught -- but a change confined to `rangeCalibrationProbe.mjs` with an untouched
 * `run-range-calibration.mjs` would have passed, and that is the more common shape.
 */
function localCodeDigest(wsId, commitish) {
  if (!wsId || !commitish) return null;
  const script = path.join(REPO_ROOT, 'scripts', 'fleet', 'code-digest.cjs');
  if (!fs.existsSync(script)) return null;
  const r = run(process.execPath, [script, commitish, wsId, REPO_ROOT], { cwd: REPO_ROOT });
  if (!r.ok) return null;
  const line = r.stdout.split(String.fromCharCode(10)).map((l) => l.trim()).filter((l) => /^[0-9a-f]{12}$/.test(l))[0];
  return line || null;
}

/**
 * What the compute node's checkout actually TRACKS -- `{branch, remote}` or null.
 *
 * Do not assume GitHub. Measured 2026-08-20: cm-node1's `origin` is
 * `chris@100.120.209.34:C:/...` -- G16 itself, over the tailnet -- so it pulls this machine's
 * LOCAL `main`, and `origin/main` on GitHub is a different commit entirely (same subject line,
 * which is exactly how the two got confused). A refusal message that says "push to origin/main"
 * sends someone to the wrong remote, and the fix they make there changes nothing here.
 */
function computeTracking() {
  const q = (k) => {
    const r = onTarget()
      ? run('git', ['-C', REMOTE_REPO, 'config', k])
      : run('ssh', [TARGET, `git -C ${quote(REMOTE_REPO)} config ${quote(k)}`]);
    if (!r.ok) return null;
    return r.stdout.split(String.fromCharCode(10)).map((l) => l.trim())
      .filter((l) => l && !/post-quantum|store now|upgraded|^\*\*/.test(l))[0] || null;
  };
  const branchRef = q('branch.main.merge');
  const remoteName = q('branch.main.remote') || 'origin';
  const url = q(`remote.${remoteName}.url`);
  if (!branchRef && !url) return null;
  return { branch: (branchRef || '').replace('refs/heads/', '') || 'main', remote: remoteName, url };
}

/** HEAD of the repo on the compute node — the commit a worktree can actually be cut from. */
function computeHead() {
  if (onTarget()) {
    const r = run('git', ['-C', REMOTE_REPO, 'rev-parse', 'HEAD']);
    return r.ok ? r.stdout.trim() : null;
  }
  const r = run('ssh', [TARGET, `git -C ${quote(REMOTE_REPO)} rev-parse HEAD`]);
  if (!r.ok) return null;
  const line = r.stdout.split('\n').map((l) => l.trim()).filter((l) => /^[0-9a-f]{40}$/.test(l))[0];
  return line || null;
}

// ------------------------------------------------------------------ ranking

/**
 * Ids in an item's `blocked_by` that are not yet done.
 *
 * A blocker is cleared only by an explicit `status: done`. Anything else — backlog, active,
 * a blocker whose YAML is missing entirely — counts as unmet, because the failure modes are
 * asymmetric: refusing to submit costs a 2-hour wait for the next feeder tick, while
 * submitting on a bad assumption costs hours of the fleet's only unattended compute and
 * returns a number someone may quote.
 */
function blockersNotDone(item) {
  const ids = Array.isArray(item.blocked_by) ? item.blocked_by : [];
  const unmet = [];
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id) continue;
    const blocker = readQueueItem(QUEUE_DIR, id);
    if (!blocker) { unmet.push(`${id} (not found)`); continue; }
    if (String(blocker.status || '').trim() !== 'done') unmet.push(`${id} (${blocker.status || 'no status'})`);
  }
  return unmet;
}

/**
 * Node1 candidates in the SAME order `/next` shows the founder.
 *
 * Shells out to cwos-next.js rather than reimplementing the score. The scoring rules
 * (priority floors, soft-block damping, source-class saturation) are load-bearing and change;
 * a copy here would silently diverge and the machine would work on the wrong thing.
 */
function rankNode1(limit = 200) {
  const r = run(process.execPath, [path.join(__dirname, 'cwos-next.js'), 'candidates', '--limit', String(limit)], {
    cwd: REPO_ROOT,
    timeout: 60000,
  });
  if (!r.ok && !r.stdout) return { ok: false, reason: r.error || `candidates exited ${r.status}`, candidates: [] };
  let parsed;
  try {
    const at = r.stdout.indexOf('{');
    parsed = JSON.parse(at === -1 ? r.stdout : r.stdout.slice(at));
  } catch (e) {
    return { ok: false, reason: `unparseable candidates output: ${String(e.message).slice(0, 120)}`, candidates: [] };
  }
  const all = (parsed.result && parsed.result.candidates) || parsed.candidates || [];
  const node1 = all.filter((c) => normalizeRunsOn(c.runs_on) === 'node1');
  return {
    ok: true,
    candidates: node1,
    ready: node1.filter((c) => c.compute_ready),
    unready: node1.filter((c) => !c.compute_ready),
  };
}

// ------------------------------------------------------------------ feed

function feed({ dryRun }) {
  const status = computeStatus();
  if (!status.reachable) return { ok: false, action: 'none', reason: `${TARGET} unreachable: ${status.reason}`, status };
  if (!status.idle) {
    return {
      ok: true,
      action: 'none',
      reason: status.running
        ? `busy: ${status.running.jobId} step ${status.running.step + 1}/${status.running.totalSteps} (${status.running.hours}h)`
        : `${status.queued.length} job(s) already queued`,
      status,
    };
  }

  const ranked = rankNode1();
  if (!ranked.ok) return { ok: false, action: 'none', reason: ranked.reason, status };
  if (ranked.ready.length === 0) {
    return {
      ok: true,
      action: 'none',
      // Named explicitly rather than reported as "nothing to do": an idle machine with
      // unready work is a backlog of missing job specs, which is itself actionable.
      reason: ranked.unready.length
        ? `${ranked.unready.length} node1 item(s) ranked but none has a compute_job spec — ${ranked.unready.slice(0, 3).map((c) => c.id).join(', ')}`
        : 'no node1 candidates in the queue',
      needs_spec: ranked.unready.map((c) => ({ id: c.id, score: c.adjusted_score, title: c.title })),
      status,
    };
  }

  const commit = computeHead();
  // Named once and reused by every refusal below, so no message can invent a remote.
  const tracking = computeTracking();
  const trackDesc = tracking
    ? `${tracking.remote}/${tracking.branch}${tracking.url ? ` (${tracking.url})` : ''}`
    : 'the branch it tracks';
  if (!commit) return { ok: false, action: 'none', reason: `cannot read HEAD of ${REMOTE_REPO} on ${TARGET}`, status };

  // Walk DOWN the ranking rather than only considering the top item. The top-ranked node1
  // item stays `backlog` after its job succeeds — finishing a compute job does not close a
  // queue item — so without this the feeder re-submits the same item every cycle and never
  // reaches the second-ranked one.
  const already = doneJobIds();
  const nodePath = onTarget() ? process.execPath : REMOTE_NODE;
  const skipped = [];
  let top = null;
  let m = null;
  let item = null;

  for (const cand of ranked.ready) {
    const candItem = readQueueItem(QUEUE_DIR, cand.id);
    if (!candItem) { skipped.push(`${cand.id}: yaml unreadable`); continue; }
    // A hard `blocked_by` must stop a SUBMISSION, not merely damp a ranking. The ranker
    // applies soft-block damping and still reports compute_ready:true, which is right for
    // composing a sprint a human will read and wrong for a dispatcher that acts unattended.
    // Found 2026-08-17: WS-503 declared blocked_by:[WS-504] and the dry-run still picked it,
    // so the 2-hourly autonomous feeder would have spent 4-5 h on cm-node1 producing a
    // knowingly-confounded result. Compute is the scarce resource here; a blocked job that
    // runs anyway costs more than one that never starts.
    const unmet = blockersNotDone(candItem);
    if (unmet.length) { skipped.push(`${cand.id}: blocked_by unmet — ${unmet.join(', ')}`); continue; }
    const built = materializeSpec({ item: candItem, commit, repoPath: REMOTE_REPO, nodePath });
    if (!built.ok) { skipped.push(`${cand.id}: ${built.problems.join('; ')}`); continue; }
    // The spec is shape-valid; that says nothing about whether the code it names is REACHABLE
    // at the commit we are about to pin. See missingScriptsAtCommit for the run this cost.
    const scripts = missingScriptsAtCommit(commit, built.spec.steps);
    if (scripts.unchecked) {
      skipped.push(`${cand.id}: cannot verify step scripts exist at ${commit.slice(0, 8)} on ${TARGET} — refusing rather than guessing`);
      continue;
    }
    if (scripts.missing.length) {
      // Name the likely remedy: the overwhelmingly common cause is a local commit that has
      // not been pushed, so the file is on the author's disk and absent from the pinned tree.
      // A message that only said "missing" would send someone looking for a deleted file.
      skipped.push(`${cand.id}: ${scripts.missing.join(', ')} absent at pinned commit ${commit.slice(0, 8)} — ${TARGET} pulls ${trackDesc}, so advance that branch (or fix the path in compute_job)`);
      continue;
    }
    if (scripts.stale.length) {
      // Not "might be different" -- IS different, by blob hash. WS-293 passed an existence
      // check and then ran a version of the probe that had never heard of the flag the job
      // depended on. See missingScriptsAtCommit.
      skipped.push(`${cand.id}: ${scripts.stale.join(', ')} differs at pinned commit ${commit.slice(0, 8)} from the version here — ${TARGET} would run OLD code and answer a different question; advance ${trackDesc} first`);
      continue;
    }
    // Whole import closure, not just the entry script. Both digests are priced locally so
    // node1's own staleness cannot be what answers the question about node1's staleness.
    const digAt = localCodeDigest(cand.id, commit);
    const digHere = localCodeDigest(cand.id, 'HEAD');
    if (digAt && digHere && digAt !== digHere) {
      skipped.push(`${cand.id}: code closure differs at pinned commit ${commit.slice(0, 8)} (${digAt}) from HEAD (${digHere}) — ${TARGET} would run OLD code; advance ${trackDesc} first`);
      continue;
    }
    // ...and the same question asked against the WORKING TREE, which is the thing the spec was
    // actually authored against. Both checks above compare commit to commit and are blind to an
    // uncommitted edit by construction — that blindness is WS-595. See worktreeDrift.
    const wt = worktreeDrift(commit, built.spec.steps);
    if (wt.unchecked) {
      skipped.push(`${cand.id}: cannot compare the working tree against pinned commit ${commit.slice(0, 8)} — refusing rather than guessing`);
      continue;
    }
    if (wt.drift.length) {
      // Name the remedy per file, because they are different commands and guessing wrong wastes
      // a cycle: an uncommitted edit is not fixed by pushing, and a pushed commit is not fixed
      // by committing. Uncommitted is listed first — it is the case no earlier gate could see.
      const un = wt.drift.filter((d) => d.kind === 'uncommitted').map((d) => d.file);
      const up = wt.drift.filter((d) => d.kind === 'unpushed').map((d) => d.file);
      const parts = [];
      if (un.length) parts.push(`UNCOMMITTED here: ${un.join(', ')} — commit them, then advance ${trackDesc}`);
      if (up.length) parts.push(`committed but unpushed: ${up.join(', ')} — advance ${trackDesc}`);
      skipped.push(`${cand.id}: ${TARGET} would run code that differs from this working tree, so the run would answer a different question than the spec was written for. ${parts.join(' | ')}`);
      continue;
    }
    // Dedupe on the FINGERPRINT of the work, not on the job id. Both sides are fingerprinted
    // at read time by one shared function, so the comparison stays symmetric even if that
    // function changes later. Two earlier keying schemes each silently invalidated history
    // and re-ran finished work; this one cannot.
    const candPrint = stepsFingerprint(
      built.spec.steps, built.spec.inputs, codeDigestFor(cand.id, commit),
    );
    if (already.ok && already.prints.has(candPrint)) {
      skipped.push(`${cand.id}: this exact work already ran`);
      continue;
    }
    top = cand; m = built; item = candItem;
    break;
  }

  if (!top) {
    return {
      ok: true,
      action: 'none',
      reason: skipped.length
        ? `every ready node1 item is already done or unbuildable — ${skipped.join(' | ')}`
        : 'no ready node1 candidate survived selection',
      skipped,
      status,
    };
  }

  // `skipped` rides along on success too: "why did it not pick the top-ranked item" is the
  // first question anyone asks of a dispatcher, and answering it only on failure is how a
  // silently-wrong selection goes unnoticed.
  if (dryRun) return { ok: true, action: 'dry-run', spec: m.spec, picked: top, skipped, status };

  const submitted = submitSpec(m.spec);
  if (!submitted.ok) return { ok: false, action: 'none', reason: submitted.reason, spec: m.spec, skipped, status };
  return { ok: true, action: 'submitted', jobId: m.spec.id, picked: top, spec: m.spec, skipped, status };
}

/** Write the spec where the runner can see it and ask the runner to take it. */
function submitSpec(spec) {
  const tmp = path.join(os.tmpdir(), `${spec.id}.json`);
  fs.writeFileSync(tmp, JSON.stringify(spec, null, 2));

  if (onTarget()) {
    const r = onCompute(['submit', tmp]);
    try { fs.unlinkSync(tmp); } catch { /* best effort */ }
    return r.ok ? { ok: true } : { ok: false, reason: (r.stderr || r.stdout || `submit exited ${r.status}`).slice(0, 400) };
  }

  // Remote: scp then submit. scp is the mandated channel — a spec pushed through a git
  // commit or a cloud-synced folder is exactly the anti-pattern the fleet skill names.
  const mk = run('ssh', [TARGET, `powershell -NoProfile -Command "New-Item -ItemType Directory -Force -Path ${quote(REMOTE_INBOX)} | Out-Null"`]);
  if (!mk.ok) return { ok: false, reason: `cannot create ${REMOTE_INBOX}: ${mk.stderr.slice(0, 200)}` };
  const dest = `${REMOTE_INBOX}\\${spec.id}.json`;
  const cp = run('scp', [tmp, `${TARGET}:${dest.replace(/\\/g, '/')}`], { timeout: 60000 });
  try { fs.unlinkSync(tmp); } catch { /* best effort */ }
  if (!cp.ok) return { ok: false, reason: `scp failed: ${(cp.stderr || cp.error || '').slice(0, 200)}` };
  const r = onCompute(['submit', dest]);
  return r.ok ? { ok: true } : { ok: false, reason: (r.stderr || r.stdout || `submit exited ${r.status}`).slice(0, 400) };
}

// ------------------------------------------------------------------ harvest

/**
 * File a review item for every completed run whose artifacts came back unreviewed.
 *
 * Runs at the top of `/next`, so a finished run reaches the founder through the queue they
 * already read rather than through an inbox they have no reason to open. Founder, 2026-08-16:
 * "if it's running properly (max utilization) then I won't see it in my normal course of
 * starting sessions" — success is what causes the results to go unseen, which is why this
 * cannot be left to habit.
 */
function harvest({ dryRun }) {
  const now = new Date().toISOString();
  const sets = pendingSets(INBOX_DIR);
  const filed = [];
  const skipped = [];

  // A FAILED job returns no artifacts, so it lands in no inbox and is exactly as invisible
  // as an unreviewed success — arguably worse, since the machine then sits idle having
  // achieved nothing. WS-293 exhausted both attempts on a JavaScript heap OOM on
  // 2026-08-16 and would have vanished silently. Failures are pulled from the compute
  // node's own done/ records and filed like any other result.
  const terminal = doneOutcomes();
  for (const t of terminal) {
    if (t.outcome === 'succeeded') continue;
    if (!/^ws-\d+-/i.test(t.id)) continue;
    const markerDir = path.join(INBOX_DIR, t.id);
    if (fs.existsSync(path.join(markerDir, HARVEST_MARKER))) continue;
    if (dryRun) { filed.push({ reviewId: '(dry-run)', title: `FAILED: ${t.id}`, jobId: t.id, wsId: t.wsId }); continue; }
    const res = fileFailureItem(t, now);
    if (res.ok) filed.push(res.entry); else skipped.push(`${t.id}: ${res.reason}`);
  }

  // WS-572: a result already filed under another job id does not get a second review item.
  // Two runs of the identical WS-320 spec returned byte-identical artifacts and filed WS-497
  // and WS-505 separately, so the panel claimed six unread runs against four real results.
  // The marker is still written, which is what stops the duplicate resurfacing every harvest.
  const alreadyFiled = harvestedContentKeys(INBOX_DIR);

  for (const set of sets) {
    if (set.nonQueue) { skipped.push(`${set.jobId}: not a queue-driven job (no WS id in the job id)`); continue; }
    const dup = set.contentKey ? alreadyFiled.get(set.contentKey) : null;
    if (dup) {
      skipped.push(`${set.jobId}: identical result already filed as ${dup.reviewId} (from ${dup.jobId})`);
      if (!dryRun) markHarvested(set, dup.reviewId, now);
      continue;
    }
    const highlights = extractHighlights(set.dir, set.manifest);
    const source = set.wsId ? (readQueueItem(QUEUE_DIR, set.wsId) || null) : null;

    if (dryRun) {
      filed.push({ reviewId: '(dry-run)', title: headlineFor(highlights, set.jobId), jobId: set.jobId, wsId: set.wsId });
      continue;
    }

    const alloc = run(process.execPath, [path.join(__dirname, 'cwos-next.js'), 'allocate-ws-id'], { cwd: REPO_ROOT });
    let reviewId = null;
    try {
      const at = alloc.stdout.indexOf('{');
      reviewId = JSON.parse(alloc.stdout.slice(at)).ws_id;
    } catch { /* handled below */ }
    if (!reviewId) { skipped.push(`${set.jobId}: could not allocate a WS id`); continue; }

    const yaml = buildReviewItem({ reviewId, set, highlights, source, now });
    try {
      fs.writeFileSync(path.join(QUEUE_DIR, `${reviewId}.yaml`), yaml);
    } catch (e) {
      skipped.push(`${set.jobId}: ${String(e.message).slice(0, 120)}`);
      continue;
    }
    markHarvested(set, reviewId, now);
    filed.push({ reviewId, title: headlineFor(highlights, set.jobId), jobId: set.jobId, wsId: set.wsId });
  }
  return { ok: true, filed, skipped, scanned: sets.length };
}

/**
 * How far cm-node1's checkout is behind this one — the skew that makes a shipped fix inert.
 *
 * ── WHY (2026-08-20) ──
 * `doneOutcomes()` does not run OUR copy of `done-summary.cjs`; it runs the one in the
 * compute node's checkout, because that is the machine holding the `done/` directory. So a
 * fix to that reader takes effect only once node1 has PULLED it. `done-summary.cjs` states
 * in its own header that this is fine — "cm-node1 already syncs it, so there is nothing
 * extra to deploy or keep in step." That premise assumes the commit reached `origin/main`.
 *
 * WS-547 added a 5th field (the runner's own failure verdict, base64) to that reader and was
 * committed on G16. It was never pushed. node1 kept running the 4-field version, so
 * `detailB64` arrived `undefined`, `recordDetail` fell back to `''`, and the WS-547 fix —
 * which was written precisely to stop failures being filed as undiagnosable — could not fire
 * even once. WS-592 was then filed saying "the runner recorded no detail", while node1's own
 * terminal record held `detail: "step 1 (optimism-size-boards-depth1): missing artifact"`.
 *
 * A capability that silently stops existing is worse than one that was never built, because
 * the repo now contains a fix everybody believes is running. This makes the skew SAY so.
 */
function checkoutSkew(remoteHead) {
  if (!remoteHead || onTarget()) return null;
  const local = run('git', ['-C', REPO_ROOT, 'rev-parse', 'HEAD']);
  if (!local.ok) return null;
  const localHead = local.stdout.trim();
  if (localHead === remoteHead) return null;
  // `A..B` counts commits reachable from B and not from A — i.e. what node1 has not got.
  const ahead = run('git', ['-C', REPO_ROOT, 'rev-list', '--count', `${remoteHead}..${localHead}`]);
  if (!ahead.ok) return null;
  const n = Number(ahead.stdout.trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  // Only name the files that actually change what the fleet pipeline can do. A hundred
  // unpushed UI commits are irrelevant here; one unpushed change to the reader is not.
  const touched = run('git', ['-C', REPO_ROOT, 'diff', '--name-only', remoteHead, localHead,
    '--', 'scripts/fleet', 'scripts/backtest', 'kit/scripts/lib/cwos-compute-job.js']);
  const files = touched.ok
    ? touched.stdout.split('\n').map((l) => l.trim()).filter(Boolean)
    : [];
  return { behind: n, remoteHead: remoteHead.slice(0, 8), localHead: localHead.slice(0, 8), files };
}

/** Terminal jobs on the compute node with their outcome, via the versioned reader. */
function doneOutcomes() {
  const summary = onTarget()
    ? path.join(REPO_ROOT, 'scripts', 'fleet', 'done-summary.cjs')
    : `${REMOTE_REPO}\\scripts\\fleet\\done-summary.cjs`;
  const r = onTarget()
    ? run(process.execPath, [summary, REMOTE_DONE])
    : run('ssh', [TARGET, `${quote(REMOTE_NODE)} ${quote(summary)} ${quote(REMOTE_DONE)}`]);
  if (!r.ok) return [];
  const out = [];
  for (const line of r.stdout.split('\n')) {
    const l = line.trim();
    if (!l || /^\*\*|post-quantum|store now|upgraded/.test(l)) continue;
    const [id, wsId, jobHash, outcome, detailB64] = l.split('|');
    // WS-547: `detail` is what the runner itself said went wrong. Base64 on the wire so a
    // Windows path or a newline in it cannot split the record.
    let recordDetail = '';
    try { recordDetail = detailB64 ? Buffer.from(detailB64, 'base64').toString('utf8').trim() : ''; }
    catch { recordDetail = ''; }
    if (id) out.push({ id, wsId: wsId || null, jobHash: jobHash || null, outcome: outcome || '', recordDetail });
  }
  return out;
}

/** File a review item for a job that did NOT succeed, and mark it so it files once. */
function fileFailureItem(t, now) {
  const detail = failureDetail(t.id, t.recordDetail || '');
  const alloc = run(process.execPath, [path.join(__dirname, 'cwos-next.js'), 'allocate-ws-id'], { cwd: REPO_ROOT });
  let reviewId = null;
  try { reviewId = JSON.parse(alloc.stdout.slice(alloc.stdout.indexOf('{'))).ws_id; } catch { /* below */ }
  if (!reviewId) return { ok: false, reason: 'could not allocate a WS id' };

  const wsId = t.wsId || (/^(ws-\d+)-/i.exec(t.id) || [])[1]?.toUpperCase() || null;
  const source = wsId ? (readQueueItem(QUEUE_DIR, wsId) || null) : null;
  const esc = (s) => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

  const body = [
    `id: ${esc(reviewId)}`,
    `title: ${esc(`${wsId || t.id} FAILED on cm-node1 — ${detail.headline}`)}`,
    'legacy_id: ""', 'type: bug', 'status: backlog',
    'claimed_by: null', 'claimed_at: null', 'started_at: null',
    'completed_at: null', 'completion_commit: null',
    `priority_score: ${source && source.priority_score ? source.priority_score : 22.0}`,
    'priority_label: "P1"',
    `category: ${esc((source && source.category) || 'infrastructure')}`,
    'capability: "core"',
    `program: ${esc((source && source.program) || 'infrastructure')}`,
    'finding_id: ""',
    'description: |',
    '  A compute job on cm-node1 reached a terminal state WITHOUT succeeding. It produced no',
    '  artifacts, so it landed in no inbox — nothing else would ever have surfaced it, and the',
    '  machine went idle having achieved nothing.',
    '',
    `  JOB       : ${t.id}`,
    `  SOURCE    : ${wsId || '(unknown)'}${source ? ` — ${source.title}` : ''}`,
    `  OUTCOME   : ${t.outcome || 'unknown'}`,
    `  DETAIL    : ${detail.headline}`,
    ...detail.lines.map((l) => `    ${l}`),
    '',
    '  Retries are already exhausted at the runner level (maxAttempts), so re-submitting the',
    '  identical spec will fail identically. The spec or the code has to change first — which',
    '  also re-keys the job hash and lets the feeder pick it up again.',
    'accept_criteria: |',
    '  - The cause is identified and fixed in the code or the compute_job block, not worked',
    '    around by shrinking the run until it fits.',
    `  - ${wsId || 'The source item'} either runs to completion or its blocker is stated explicitly.`,
    'effort: "S"',
    'runs_on: "any"',
    'files_involved: []', 'blocked_by: []', 'blocked_by_legacy: []', 'enables: []',
    'sprint_id: null', 'decision_flags: []',
    'source:', '  kind: "fleet-compute"',
    `  detail: ${esc(`auto-filed by cwos-fleet-compute harvest — failed job ${t.id}`)}`,
    `created_at: ${esc(now)}`, '',
  ].join('\n');

  try {
    fs.writeFileSync(path.join(QUEUE_DIR, `${reviewId}.yaml`), body);
    const markerDir = path.join(INBOX_DIR, t.id);
    fs.mkdirSync(markerDir, { recursive: true });
    fs.writeFileSync(path.join(markerDir, HARVEST_MARKER),
      JSON.stringify({ harvested_at: now, review_item: reviewId, job_id: t.id, outcome: t.outcome }, null, 2));
  } catch (e) {
    return { ok: false, reason: String(e.message).slice(0, 120) };
  }
  return { ok: true, entry: { reviewId, title: `FAILED: ${detail.headline}`, jobId: t.id, wsId } };
}

/** Pull the actual error out of the job's step log — a failure with no cause is not a report. */
function failureDetail(jobId, recordDetail = '') {
  // ── EVERY step log, not just step 0 (ws-295-28d02a0a9124, 2026-08-20) ──
  // This used to read `<jobId>.0.log` and nothing else. A job fails at the step that failed,
  // which is usually NOT step 0 — and when step 0 succeeded its log is clean by definition,
  // so the grep found nothing and the item was filed claiming "the step log has no error —
  // the job died before its first step". For WS-295 all three clauses were false: step 0 ran
  // 25 minutes and SUCCEEDED, step 1 failed twice, and `.1.log` held the complete cause
  // (`Error: Cannot find module ... run-optimism-boards.mjs`) — matching a pattern this
  // function already searches for. The evidence was on disk, in the right format, and simply
  // never opened.
  //
  // Descending sort so the LAST step is read first: the failing step is the last one to
  // write, and its lines are the ones that explain the outcome.
  const ps = `Get-ChildItem '${REMOTE_LOGS}\\${jobId}.*.log' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Get-Content | Select-String -Pattern 'FATAL ERROR|Error:|ENOENT|out of memory' | Select-Object -First 3`;
  const r = onTarget()
    ? run('powershell', ['-NoProfile', '-Command', ps])
    : run('ssh', [TARGET, `powershell -NoProfile -Command "${ps}"`]);
  const lines = (r.stdout || '').split('\n').map((l) => l.trim())
    .filter((l) => l && !/^\*\*|post-quantum|store now|upgraded/.test(l)).slice(0, 3);
  const oom = lines.some((l) => /out of memory|heap limit/i.test(l));

  // ── WS-547: THE STEP LOG IS NOT THE ONLY PLACE A FAILURE IS RECORDED ──
  // This used to grep `<jobId>.0.log` and nothing else, so a job that died BEFORE its first
  // step ran — which writes no step log — was filed as "no error captured in the step log".
  // ws-503-17172f8726ce failed twice that way while the runner's terminal record carried
  // `detail: "existing worktree at C:\\cj\\ws-503-17172f8726ce is 6f4cf7db…, expected
  // 32d968a4…"`, the exact and complete cause. The item that got filed said the failure was
  // undiagnosable, so nobody went looking, and the job stayed dead through another cycle.
  //
  // Order of preference: OOM is promoted because it is the one cause whose signature lives in
  // the log and not in the record; otherwise the RUNNER'S OWN VERDICT outranks a grepped log
  // line, because it is a deliberate statement rather than a pattern that happened to match.
  const headline = oom
    ? 'JavaScript heap out of memory'
    : (recordDetail ? recordDetail.split('\n')[0].slice(0, 120)
      : (lines[0] ? lines[0].slice(0, 90)
        : 'the runner recorded no detail and the step log has no error — the job died before its first step'));

  // The record's detail is surfaced in the body even when a log line won the headline, so the
  // two accounts can be read against each other rather than one silently replacing the other.
  const body = recordDetail && !lines.includes(recordDetail) ? [`runner: ${recordDetail}`, ...lines] : lines;
  return { headline, lines: body };
}

// ------------------------------------------------------------------ output

/** Open review items the harvester filed — the "are finished runs being read" signal. */
function reviewDebt() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude', 'workstream', 'state', 'queue.json'), 'utf8'));
    return Object.values(j.items || {})
      .filter((i) => i.source && i.source.kind === 'fleet-compute')
      .filter((i) => i.status !== 'done' && i.status !== 'completed' && i.status !== 'dismissed')
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0));
  } catch { return []; }
}

/**
 * Ready items whose exact spec has NOT already run — the real runway.
 *
 * `ranked.ready` counts items that COULD run; it says nothing about whether they already
 * did. On 2026-08-16 that gap read as "3 ready item(s) waiting" while all three were in fact
 * spent, which is the reassuring-but-wrong reading this panel exists to prevent.
 */
function runwayFor(ranked, already, status) {
  if (!ranked || !ranked.ok) return [];
  // The job currently RUNNING (or already queued) is not runway behind itself. Counting it
  // read as "3 jobs ready" while the top one was the job in flight — reassuring and wrong,
  // which is the failure mode this panel exists to prevent.
  const inFlight = new Set();
  if (status && status.running) inFlight.add(wsIdOfJob(status.running.jobId));
  for (const q of (status && status.queued) || []) inFlight.add(wsIdOfJob(q));

  const nodePath = onTarget() ? process.execPath : REMOTE_NODE;
  // One HEAD lookup for the whole panel — codeDigestFor caches per (item, commit), so the
  // cost here is one remote call per genuinely-ready item, not one per candidate.
  const commit = ranked.ready.length ? computeHead() : null;
  return ranked.ready.filter((c) => {
    if (inFlight.has(c.id)) return false;
    const item = readQueueItem(QUEUE_DIR, c.id);
    if (!item || !item.compute_job) return false;
    const fp = stepsFingerprint(
      materializeSteps(item.compute_job, nodePath),
      item.compute_job.inputs,
      codeDigestFor(c.id, commit),
    );
    return !(already.ok && already.prints.has(fp));
  });
}

/** `ws-320-f6c3e820c448.json` -> `WS-320`. */
function wsIdOfJob(jobId) {
  const m = /^(ws-\d+)-/i.exec(String(jobId || ''));
  return m ? m[1].toUpperCase() : null;
}

/**
 * The node1 panel for `/next`.
 *
 * Founder 2026-08-16: this is its own workstream with a different design mechanism than the
 * sprint. A sprint answers "what am I doing next"; a pipeline answers three different
 * questions, and the panel is built around exactly those — is it ALIVE, is it FED, and is
 * anything BACKING UP unread. Priority rarely changes here; assurance is the product.
 */
function panel(status, ranked, already) {
  const L = [];
  const head = `Fleet compute — ${TARGET}`;
  if (!status.reachable) {
    L.push(head);
    L.push(`  NOW      UNREACHABLE — ${status.reason}`);
    L.push('           (not a blocker; composition continues)');
    return L.join('\n');
  }

  // `status` is the third argument, and omitting it (as this call did until WS-572) leaves
  // `status` undefined inside, so BOTH in-flight guards evaluate to false and the filter the
  // function exists for is dead. The panel then reports the running job as runway behind
  // itself — the reassuring-but-wrong reading named in runwayFor's own docblock.
  const runway = runwayFor(ranked, already, status);
  const needSpec = ranked.ok ? ranked.unready.filter((c) => !c.compute_note) : [];
  const blocked = ranked.ok ? ranked.unready.filter((c) => c.compute_note) : [];
  const reviews = reviewDebt();

  L.push(head);

  // NOW — is it alive?
  if (status.running) {
    const r = status.running;
    const ws = (r.jobId.match(/^ws-\d+/i) || [r.jobId])[0].toUpperCase();
    const health = r.alive ? 'healthy' : 'NOT ALIVE — runner will retry or fail it on the next tick';
    L.push(`  NOW      RUNNING ${ws} · step ${r.step + 1}/${r.totalSteps} · ${r.hours}h · ${health}`);
  } else if (status.queued.length) {
    L.push(`  NOW      ${status.queued.length} job(s) QUEUED — the runner starts them within 5 min`);
  } else {
    L.push('  NOW      IDLE');
  }

  // RUNWAY — is it fed? This is the number that decides whether the machine keeps working.
  if (runway.length) {
    L.push(`  RUNWAY   ${runway.length} job(s) ready behind it — next ${runway[0].id} (${runway[0].adjusted_score})`);
  } else if (!status.running && !status.queued.length) {
    L.push('  RUNWAY   EMPTY — node1 will idle until a compute_job spec exists');
  } else {
    L.push('  RUNWAY   EMPTY — nothing queued behind the current job');
  }
  if (needSpec.length) L.push(`           ${needSpec.length} item(s) need a spec written: ${needSpec.map((c) => c.id).join(', ')}`);

  // REVIEWS — are results being read? The failure the whole harvest exists to prevent.
  if (reviews.length) {
    const top = reviews.slice(0, 3).map((r) => `${r.id} (${r.priority_label || r.priority_score})`).join(', ');
    L.push(`  REVIEWS  ${reviews.length} finished run(s) waiting to be read — ${top}${reviews.length > 3 ? ', …' : ''}`);
  } else {
    L.push('  REVIEWS  none outstanding');
  }

  // FAILED — the half REVIEWS structurally cannot show, and the reason `status` could report
  // a dead job as an idle machine.
  //
  // harvest() already files a review item for every non-succeeded run (see its comment: a
  // failed job "lands in no inbox and is exactly as invisible as an unreviewed success —
  // arguably worse, since the machine then sits idle having achieved nothing"). But harvest
  // runs at the top of /next. Between the failure and the next /next, the ONLY thing `status`
  // said was `NOW IDLE`.
  //
  // MEASURED FAILURE, 2026-08-20: ws-594 died at worktree setup, `status` printed IDLE, and
  // the run was reported as in progress on that basis. The data was already here —
  // doneOutcomes() had the record and its detail — and nothing rendered it. Once harvest has
  // filed a failure it appears under REVIEWS, so this line shows only the UNFILED ones and
  // does not double-report.
  const unfiledFailures = doneOutcomes()
    .filter((t) => t.outcome && t.outcome !== 'succeeded' && /^ws-\d+-/i.test(t.id))
    .filter((t) => !fs.existsSync(path.join(INBOX_DIR, t.id, HARVEST_MARKER)));
  if (unfiledFailures.length) {
    L.push(`  FAILED   ${unfiledFailures.length} job(s) ended NON-SUCCESSFULLY and are not yet filed as reviews:`);
    for (const f of unfiledFailures.slice(0, 3)) {
      const why = String(f.recordDetail || 'no detail recorded').split(String.fromCharCode(10))[0].trim().slice(0, 96);
      L.push(`           ${f.id} — ${why}`);
    }
    if (unfiledFailures.length > 3) L.push(`           …and ${unfiledFailures.length - 3} more`);
    L.push('           These file as review items on the next /next. A failed job returns no');
    L.push('           artifacts, so nothing else surfaces it — do not read IDLE as finished.');
  }

  // BLOCKED — named so they stop reading as "just needs a spec" forever.
  if (blocked.length) {
    L.push(`  BLOCKED  ${blocked.length} item(s) need CODE before they can ever run: ${blocked.map((c) => c.id).join(', ')}`);
  }

  // SKEW - the line that would have caught WS-547 shipping into a void. node1 runs the
  // pipeline code from ITS OWN checkout, so anything unpushed here is not running there,
  // however recently it was committed. Only reported when pipeline files are among the
  // unpushed commits: a skew that cannot change fleet behaviour is noise.
  // One extra rev-parse over ssh, only on the panel path. `status` does not carry HEAD and
  // threading it through would make every caller pay for a check only this line uses.
  const skew = checkoutSkew(computeHead());
  if (skew && skew.files.length) {
    L.push(`  SKEW     ${TARGET} is ${skew.behind} commit(s) behind (${skew.remoteHead} vs ${skew.localHead})`);
    L.push(`           and runs pipeline code from its own checkout, so ${skew.files.length} unpushed file(s) are NOT live there:`);
    L.push(`           ${skew.files.slice(0, 3).join(', ')}${skew.files.length > 3 ? ', ...' : ''}`);
    const tr = computeTracking();
    // Name the ACTUAL source. node1's `origin` is this machine over the tailnet, not GitHub,
    // and the two `main`s carry the same subject line -- which is how they got confused.
    L.push(`           advance ${tr ? `${tr.remote}/${tr.branch}` : 'the branch it pulls'}${tr && tr.url ? ` -> ${tr.url}` : ''},`);
    L.push('           or the fix you just shipped is not the code that runs.');
  }

  return L.join('\n');
}

/** Kept for callers that want the single line. */
function humanStatusLine(status, ranked) {
  if (!status.reachable) return `Fleet compute (${TARGET}): UNREACHABLE — ${status.reason}`;
  if (status.running) {
    const r = status.running;
    const ws = r.jobId.match(/^ws-\d+/i);
    return `Fleet compute (${TARGET}): RUNNING ${ws ? ws[0].toUpperCase() : r.jobId} — step ${r.step + 1}/${r.totalSteps}, ${r.hours}h elapsed, alive=${r.alive}`;
  }
  if (status.queued.length) return `Fleet compute (${TARGET}): ${status.queued.length} job(s) QUEUED, none started yet`;
  const ready = ranked && ranked.ok ? ranked.ready.length : 0;
  if (ready) return `Fleet compute (${TARGET}): IDLE — ${ready} ready item(s) waiting, top is ${ranked.ready[0].id}`;
  return `Fleet compute (${TARGET}): IDLE`;
}

// ------------------------------------------------------------------ cli

function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0] || 'status';
  const asJson = argv.includes('--json');
  const dryRun = argv.includes('--dry-run');

  if (cmd === 'status') {
    const status = computeStatus();
    const ranked = rankNode1();
    if (asJson) {
      console.log(JSON.stringify({
        ...status,
        ready: ranked.ok ? ranked.ready.map((c) => ({ id: c.id, score: c.adjusted_score, title: c.title })) : [],
        needs_spec: ranked.ok ? ranked.unready.map((c) => ({ id: c.id, score: c.adjusted_score, title: c.title })) : [],
      }, null, 2));
    } else {
      console.log(panel(status, ranked, doneJobIds()));
    }
    // Exit 0 even when unreachable: /next reads this for information, never for a gate.
    return;
  }

  if (cmd === 'rank') {
    const ranked = rankNode1();
    if (asJson) return void console.log(JSON.stringify(ranked, null, 2));
    if (!ranked.ok) return void console.log('rank failed: ' + ranked.reason);
    if (!ranked.candidates.length) return void console.log('no node1 candidates');
    for (const c of ranked.candidates) {
      console.log(`${c.compute_ready ? 'READY' : '  -  '}  ${c.id}  ${String(c.adjusted_score).padStart(5)}  ${(c.title || '').slice(0, 70)}`);
    }
    return;
  }

  if (cmd === 'feed') {
    const r = feed({ dryRun });
    if (asJson) return void console.log(JSON.stringify(r, null, 2));
    if (r.action === 'submitted') console.log(`submitted ${r.jobId} (${r.picked.id}, score ${r.picked.adjusted_score}) to ${TARGET}`);
    else if (r.action === 'dry-run') console.log(`would submit ${r.spec.id} (${r.picked.id}): ${r.spec.steps.length} step(s)`);
    else console.log(`no submission — ${r.reason}`);
    for (const s of r.skipped || []) console.log(`  skipped ${s}`);
    if (!r.ok) process.exitCode = 1;
    return;
  }

  if (cmd === 'harvest') {
    const r = harvest({ dryRun });
    if (asJson) return void console.log(JSON.stringify(r, null, 2));
    if (!r.filed.length && !r.skipped.length) return void console.log('nothing to harvest');
    for (const f of r.filed) console.log(`${dryRun ? 'would file' : 'filed'} ${f.reviewId} — ${f.title}`);
    for (const s of r.skipped) console.log(`  skipped ${s}`);
    return;
  }

  if (cmd === 'validate') {
    // Author-time check: does this item's block satisfy the runner before we ever queue it?
    const id = argv[1];
    if (!id) return void console.log('usage: cwos-fleet-compute validate WS-NNN');
    const item = readQueueItem(QUEUE_DIR, id);
    if (!item) return void console.log(`${id}.yaml not found`);
    const v = validateComputeJob(item.compute_job);
    console.log(v.ok ? `${id}: compute_job OK (${item.compute_job.steps.length} step(s))` : `${id}: ${v.problems.join('; ')}`);
    if (!v.ok) process.exitCode = 1;
    return;
  }

  console.log('usage: cwos-fleet-compute.js <status|rank|feed|validate> [--json] [--dry-run]');
  process.exitCode = 2;
}

if (require.main === module) main();

// `failureDetail` and `missingScriptsAtCommit` are exported for verification: both were
// written to fix a misdiagnosis, and a fix to a diagnostic is worthless unless the
// diagnostic itself can be run against the job it got wrong.
module.exports = { computeStatus, rankNode1, feed, humanStatusLine, panel, reviewDebt, doneJobIds,
                   failureDetail, missingScriptsAtCommit, worktreeDrift, checkoutSkew, computeHead };
