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
const { pendingSets, extractHighlights, buildReviewItem, markHarvested, headlineFor, HARVEST_MARKER } = require('./lib/cwos-fleet-harvest');

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
    const [id, wsId, fingerprint] = l.split('|');
    if (id) ids.add(id);
    // Fingerprints of every terminal job, regardless of which item they came from. The
    // fingerprint identifies the WORK, so this needs no ws_id -- which is just as well,
    // since the runner does not preserve one.
    if (fingerprint) prints.add(fingerprint);
  }
  return { ok: true, ids, prints };
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

  const commit = computeHead();
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
    const built = materializeSpec({ item: candItem, commit, repoPath: REMOTE_REPO, nodePath });
    if (!built.ok) { skipped.push(`${cand.id}: ${built.problems.join('; ')}`); continue; }
    // Dedupe on the FINGERPRINT of the work, not on the job id. Both sides are fingerprinted
    // at read time by one shared function, so the comparison stays symmetric even if that
    // function changes later. Two earlier keying schemes each silently invalidated history
    // and re-ran finished work; this one cannot.
    if (already.ok && already.prints.has(stepsFingerprint(built.spec.steps, built.spec.inputs))) {
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

  for (const set of sets) {
    if (set.nonQueue) { skipped.push(`${set.jobId}: not a queue-driven job (no WS id in the job id)`); continue; }
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
    const [id, wsId, jobHash, outcome] = l.split('|');
    if (id) out.push({ id, wsId: wsId || null, jobHash: jobHash || null, outcome: outcome || '' });
  }
  return out;
}

/** File a review item for a job that did NOT succeed, and mark it so it files once. */
function fileFailureItem(t, now) {
  const detail = failureDetail(t.id);
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
function failureDetail(jobId) {
  const ps = `Get-Content '${REMOTE_LOGS}\\${jobId}.0.log' -ErrorAction SilentlyContinue | Select-String -Pattern 'FATAL ERROR|Error:|ENOENT|out of memory' | Select-Object -First 3`;
  const r = onTarget()
    ? run('powershell', ['-NoProfile', '-Command', ps])
    : run('ssh', [TARGET, `powershell -NoProfile -Command "${ps}"`]);
  const lines = (r.stdout || '').split('\n').map((l) => l.trim())
    .filter((l) => l && !/^\*\*|post-quantum|store now|upgraded/.test(l)).slice(0, 3);
  const oom = lines.some((l) => /out of memory|heap limit/i.test(l));
  return {
    headline: oom ? 'JavaScript heap out of memory' : (lines[0] ? lines[0].slice(0, 90) : 'no error captured in the step log'),
    lines,
  };
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
  return ranked.ready.filter((c) => {
    if (inFlight.has(c.id)) return false;
    const item = readQueueItem(QUEUE_DIR, c.id);
    if (!item || !item.compute_job) return false;
    const fp = stepsFingerprint(materializeSteps(item.compute_job, nodePath), item.compute_job.inputs);
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

  const runway = runwayFor(ranked, already);
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

  // BLOCKED — named so they stop reading as "just needs a spec" forever.
  if (blocked.length) {
    L.push(`  BLOCKED  ${blocked.length} item(s) need CODE before they can ever run: ${blocked.map((c) => c.id).join(', ')}`);
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

module.exports = { computeStatus, rankNode1, feed, humanStatusLine, panel, reviewDebt, doneJobIds };
