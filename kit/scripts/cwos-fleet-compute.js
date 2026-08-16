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

const { materializeSpec, readQueueItem, normalizeRunsOn, validateComputeJob } = require('./lib/cwos-compute-job');

// ------------------------------------------------------------------ config

const TARGET = process.env.CWOS_COMPUTE_HOST || 'cm-node1';
// The machine name as Windows reports it, used to decide local vs remote.
const TARGET_HOSTNAME = (process.env.CWOS_COMPUTE_HOSTNAME || 'CM-NODE1').toUpperCase();
const REMOTE_NODE = process.env.CWOS_COMPUTE_NODE || 'C:\\Users\\chris\\.local\\node\\node.exe';
const REMOTE_RUNNER = process.env.CWOS_COMPUTE_RUNNER
  || 'C:\\Users\\chris\\repos\\ai-personal\\nodes\\scripts\\compute-runner.js';
const REMOTE_REPO = process.env.CWOS_COMPUTE_REPO || 'C:\\Users\\chris\\repos\\claude-poker-tracker';
const REMOTE_INBOX = process.env.CWOS_COMPUTE_INBOX || 'C:\\Users\\chris\\fleet\\compute\\incoming';

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

  const top = ranked.ready[0];
  const item = readQueueItem(QUEUE_DIR, top.id);
  if (!item) return { ok: false, action: 'none', reason: `${top.id}.yaml unreadable`, status };

  const commit = computeHead();
  if (!commit) return { ok: false, action: 'none', reason: `cannot read HEAD of ${REMOTE_REPO} on ${TARGET}`, status };

  const m = materializeSpec({ item, commit, repoPath: REMOTE_REPO, nodePath: onTarget() ? process.execPath : REMOTE_NODE });
  if (!m.ok) return { ok: false, action: 'none', reason: `${top.id}: ${m.problems.join('; ')}`, status };

  if (dryRun) return { ok: true, action: 'dry-run', spec: m.spec, picked: top, status };

  const submitted = submitSpec(m.spec);
  if (!submitted.ok) return { ok: false, action: 'none', reason: submitted.reason, spec: m.spec, status };
  return { ok: true, action: 'submitted', jobId: m.spec.id, picked: top, spec: m.spec, status };
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

// ------------------------------------------------------------------ output

/** One line for `/next`. The founder should learn the machine's state without reading JSON. */
function humanStatusLine(status, ranked) {
  if (!status.reachable) return `Fleet compute (${TARGET}): UNREACHABLE — ${status.reason}`;
  if (status.running) {
    const r = status.running;
    const ws = r.jobId.match(/^ws-\d+/i);
    return `Fleet compute (${TARGET}): RUNNING ${ws ? ws[0].toUpperCase() : r.jobId} — step ${r.step + 1}/${r.totalSteps}, ${r.hours}h elapsed, alive=${r.alive}`;
  }
  if (status.queued.length) return `Fleet compute (${TARGET}): ${status.queued.length} job(s) QUEUED, none started yet`;
  const ready = ranked && ranked.ok ? ranked.ready.length : 0;
  const unready = ranked && ranked.ok ? ranked.unready.length : 0;
  if (ready) return `Fleet compute (${TARGET}): IDLE — ${ready} ready item(s) waiting, top is ${ranked.ready[0].id}`;
  if (unready) return `Fleet compute (${TARGET}): IDLE — ${unready} node1 item(s) ranked but NONE has a compute_job spec`;
  return `Fleet compute (${TARGET}): IDLE — no node1 work in the queue`;
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
      console.log(humanStatusLine(status, ranked));
      if (ranked.ok && ranked.unready.length) {
        // Split the two reasons apart. An item that needs CODE before any spec could help is
        // not the same backlog as one that needs a spec typed out, and collapsing them is how
        // "needs a spec" gets reported forever against work no spec can unblock.
        const blocked = ranked.unready.filter((c) => c.compute_note);
        const specable = ranked.unready.filter((c) => !c.compute_note);
        if (specable.length) console.log('  needs a compute_job spec: ' + specable.map((c) => c.id).join(', '));
        for (const c of blocked) console.log(`  ${c.id} not dispatchable: ${String(c.compute_note).slice(0, 150)}`);
      }
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
    if (!r.ok) process.exitCode = 1;
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

module.exports = { computeStatus, rankNode1, feed, humanStatusLine };
