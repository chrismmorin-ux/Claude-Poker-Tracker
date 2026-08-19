'use strict';
/**
 * cwos-compute-job.js — the bridge between a queue item and the fleet compute runner.
 *
 * WHY THIS EXISTS. cm-node1 has run a healthy `Fleet-ComputeRunner` since 2026-08-15 and
 * spent essentially all of it asleep at the wheel: measured 2026-08-16, 314 of 379 ledger
 * events were `tick_idle` — a machine waking every five minutes to discover it had nothing
 * to do — while six `runs_on: node1` items sat unclaimed in this repo's queue. Nothing
 * converted an item into something the runner could execute, so nothing ever ran.
 *
 * THE VALIDATOR IS SHARED ON PURPOSE. The reducer stamps a `compute_ready` boolean into
 * state so the ranker can select on it without parsing YAML; the dispatcher materializes the
 * real spec at submit time. If those two used different notions of "ready", state would
 * advertise work the dispatcher then refused, and the queue would look fed while node1 idled
 * — the exact failure this module exists to end. One validator, both callers.
 *
 * WHAT STAYS IN THE YAML. Only `runs_on` and `compute_ready` are materialized into
 * state/queue.json. The `compute_job` block itself is human-editable content and belongs
 * with `description` and `accept_criteria` on the WS-*.yaml, per the reducer's standing rule
 * that state is a lookup index and not a copy of the file. The dispatcher reads the one YAML
 * it is about to submit; that is a single file read, not a scan.
 *
 * SPEC SHAPE (authored in WS-NNN.yaml):
 *   compute_job:
 *     maxJobHours: 8                   # optional; runner default otherwise
 *     steps:
 *       - name: study-ladder           # required
 *         cmd: node                    # required; `node` is rewritten to the submitting
 *         args: [scripts/...]          #   process's own executable (see resolveCmd)
 *         expectFiles: [out/x.json]    # required, non-empty — rule 3: exit codes are not
 *         env: { KEY: value }          #   evidence. Paths are worktree-relative.
 *         maxAttempts: 2
 *     artifacts: [out/x.json]          # optional; defaults to the union of expectFiles
 */

const fs = require('fs');
const path = require('path');

/** Steps whose cmd is exactly this are bound to the submitting process's node binary. */
const NODE_CMD_TOKEN = 'node';

/**
 * Validate an authored `compute_job` block.
 *
 * Mirrors compute-runner.js `cmdSubmit` so a block that passes here cannot be rejected
 * there. The runner's checks are the floor, not the ceiling: it accepts a missing `args`,
 * and so do we.
 *
 * @param {any} job - the raw `compute_job` value from a WS-*.yaml
 * @returns {{ok: boolean, problems: string[]}}
 */
function validateComputeJob(job) {
  const problems = [];
  if (job === undefined || job === null) return { ok: false, problems: ['no compute_job block'] };
  if (typeof job !== 'object' || Array.isArray(job)) {
    return { ok: false, problems: ['compute_job must be a mapping'] };
  }
  if (!Array.isArray(job.steps) || job.steps.length === 0) {
    problems.push('compute_job.steps must be a non-empty list');
    return { ok: false, problems };
  }
  job.steps.forEach((s, i) => {
    const at = `steps[${i}]`;
    if (!s || typeof s !== 'object' || Array.isArray(s)) {
      problems.push(`${at} must be a mapping`);
      return;
    }
    if (!s.name) problems.push(`${at} needs a name`);
    if (!s.cmd) problems.push(`${at} needs a cmd`);
    if (!Array.isArray(s.expectFiles) || s.expectFiles.length === 0) {
      // Worth the long message: this is the rule people most want to skip, and skipping it
      // is what makes a green exit code mean nothing.
      problems.push(`${at} ("${s.name || '?'}") declares no expectFiles — refusing (exit codes are not evidence)`);
    }
    if (s.args !== undefined && !Array.isArray(s.args)) problems.push(`${at}.args must be a list`);
    if (s.env !== undefined && (typeof s.env !== 'object' || Array.isArray(s.env))) {
      problems.push(`${at}.env must be a mapping`);
    }
  });
  if (job.artifacts !== undefined && !Array.isArray(job.artifacts)) {
    problems.push('compute_job.artifacts must be a list');
  }
  if (job.maxJobHours !== undefined && !(Number(job.maxJobHours) > 0)) {
    problems.push('compute_job.maxJobHours must be a positive number');
  }
  return { ok: problems.length === 0, problems };
}

/**
 * Stable 12-hex digest of an authored compute_job block.
 *
 * THIS IS WHAT STOPS THE MACHINE LOOPING ON ONE ITEM. Found by exercising the feeder
 * 2026-08-16: WS-320's job finished successfully, and the very next feed submitted WS-320
 * again. Completing a compute JOB does not mark the queue ITEM done — the item is still
 * `backlog`, so it is still the top-ranked node1 candidate, forever. The machine would have
 * re-run the same 35-minute corpus pass indefinitely and never reached WS-295 or WS-293,
 * which is the exact opposite of "always working on the next most important thing".
 *
 * Keying the job id on the spec's content rather than on the commit gives the right
 * behaviour in both directions: an unchanged spec resolves to a job id already sitting in
 * the runner's done/ dir and is skipped, while re-authoring the block yields a new id and
 * legitimately re-runs. Keying on the commit instead would have re-run every item on every
 * unrelated push.
 */
/**
 * Canonical fingerprint of a MATERIALIZED steps array.
 *
 * This is the dedupe key, and it is computed from the same representation on both sides —
 * the candidate's materialized steps, and the steps the runner recorded in its terminal
 * file. That symmetry is the point. The previous key was a hash of the AUTHORED block
 * compared against a job id, and changing the hash definition silently invalidated every
 * prior record: it happened twice on 2026-08-16 (first when ids moved from commit-keyed to
 * content-keyed, then when maxJobHours was dropped from the material), and each time the
 * feeder cheerfully re-ran completed work. Hashing both sides at read time with one function
 * means a future change to this function re-keys BOTH and stays consistent.
 *
 * Only fields that can change the OUTPUT are included. `maxJobHours` is a timeout bound and
 * `artifacts` is a collection list; neither can alter what the run produces.
 *
 * ── `codeDigest`, WS-572: THE ANALYSIS CODE IS ALSO AN INPUT ──
 * The three fields above are the COMMAND. They say nothing about the code the command runs,
 * so fixing a bug in that code did not re-open the job it invalidated. WS-320 shipped three
 * wrong verdicts, was fixed in a60d4084, and the corrected instrument had still never run
 * three days later while cm-node1 sat IDLE.
 *
 * The workaround tried at the time is the reason this parameter exists rather than a
 * convention. Commit 9361286b added a comment INSIDE the `compute_job:` block and stated in
 * its message that this re-keyed the job. It did not: the fingerprint is computed from the
 * PARSED steps and inputs, and a YAML comment does not survive parsing. Measured 2026-08-19 —
 * the fingerprint is `12a9c73eaaef` before that commit, after it, and at HEAD. A confident
 * commit message, a believed fix, and three days of silence.
 *
 * Pass `null`/omit and the key is byte-identical to the pre-WS-572 one. That degradation is
 * deliberate: see the NULL IS LOAD-BEARING note in cwos-code-digest.js. Callers must pass it
 * on BOTH sides or NEITHER — an asymmetric key silently re-runs finished work, which has
 * already happened twice on this function (see above).
 */
function stepsFingerprint(steps, inputs, codeDigest = null) {
  const material = (Array.isArray(steps) ? steps : []).map((s) => ({
    name: s.name || null,
    cmd: s.cmd || null,
    args: Array.isArray(s.args) ? s.args.map(String) : [],
    env: s.env || null,
    expectFiles: Array.isArray(s.expectFiles) ? s.expectFiles.slice().sort() : [],
  }));
  const shape = { steps: material, inputs: inputs || null };
  // Absent key, not a null value: `{steps, inputs}` must serialize exactly as it did before
  // WS-572 so that legacy prints and new prints agree whenever the digest is unavailable.
  if (codeDigest) shape.codeDigest = codeDigest;
  const canonical = JSON.stringify(shape);
  return require('crypto').createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

/** Build the runner-ready steps for a job, without needing a commit. Shared so the dedupe
 *  path and the submit path cannot diverge in how they resolve `cmd: node`. */
function materializeSteps(job, nodePath) {
  return (job.steps || []).map((s) => {
    const step = {
      name: s.name,
      cmd: resolveCmd(s.cmd, nodePath),
      args: Array.isArray(s.args) ? s.args.map(String) : [],
      expectFiles: s.expectFiles.slice(),
    };
    if (s.env) step.env = s.env;
    if (s.maxAttempts !== undefined) step.maxAttempts = Number(s.maxAttempts);
    return step;
  });
}

function computeJobHash(job) {
  // Hash only what can CHANGE THE RESULT: the steps (cmd, args, env, expectFiles) and any
  // staged inputs. `maxJobHours` and `artifacts` are operational — a timeout bound and a
  // collection list — and folding them in meant that raising a timeout re-keyed the job and
  // triggered a full re-run producing byte-identical output. Compute is the scarce thing
  // here; spending 35 minutes to reproduce a result because a cap moved is pure waste.
  const material = { steps: job.steps, inputs: job.inputs || null };
  const canonical = JSON.stringify(material, Object.keys(flatten(material)).sort());
  return require('crypto').createHash('sha256').update(canonical).digest('hex').slice(0, 12);
}

/** Collect every key path in an object so JSON.stringify's replacer sorts deterministically. */
function flatten(o, out = {}, prefix = '') {
  if (o && typeof o === 'object') {
    for (const k of Object.keys(o)) {
      out[k] = true;
      flatten(o[k], out, prefix + k + '.');
    }
  }
  return out;
}

/**
 * Normalize a `runs_on` label to a bare lowercase token, or null.
 *
 * The shared YAML reader does strip the trailing `# long unattended compute` comment that
 * the 2026-08-05 backfill wrote onto all 174 items (verified on WS-320, 2026-08-16), so this
 * is not working around that. It exists because these labels are meant to be hand-corrected
 * — machine-affinity.md explicitly says "correct labels as you encounter them" — and a
 * hand-edit is where a stray quote, capital, or trailing space arrives. A dispatcher that
 * silently skips `Node1` because it compared against `node1` would present as an idle
 * machine with no error anywhere, which is the failure mode this whole change is closing.
 */
function normalizeRunsOn(v) {
  if (v === undefined || v === null) return null;
  let s = String(v).trim();
  const hash = s.indexOf('#');
  if (hash !== -1) s = s.slice(0, hash).trim();       // belt-and-braces; reader handles it
  s = s.replace(/^['"]|['"]$/g, '').trim().toLowerCase();
  return s.length > 0 ? s : null;
}

/** Convenience predicate for the reducer's cached stamp. Never throws. */
function isComputeReady(item) {
  try {
    return validateComputeJob(item && item.compute_job).ok;
  } catch {
    return false;
  }
}

/**
 * Resolve a step's command for the machine that will run it.
 *
 * A WS-*.yaml must stay machine-neutral, so it says `node`. But the runner spawns with
 * `shell: false` under Task Scheduler, where PATH is minimal and a bare `node` may not
 * resolve at all. The submitting process IS a node process, so its own `execPath` is both
 * present and the right version — bind to that rather than hoping PATH is populated.
 */
function resolveCmd(cmd, nodePath) {
  if (cmd === NODE_CMD_TOKEN) return nodePath || process.execPath;
  return cmd;
}

/**
 * Turn a queue item's authored block into a spec `compute-runner.js submit` will accept.
 *
 * @param {object} opts
 * @param {object} opts.item      - parsed WS-*.yaml (needs `id` and `compute_job`)
 * @param {string} opts.commit    - the commit to pin the worktree to (rule 4)
 * @param {string} opts.repoPath  - repo the worktree is cut from, on the running machine
 * @param {string} [opts.jobId]   - defaults to `<ws-id>-<commit12>`
 * @param {string} [opts.nodePath]- node binary for `cmd: node` steps
 * @returns {{ok: boolean, problems?: string[], spec?: object}}
 */
function materializeSpec({ item, commit, repoPath, jobId, nodePath }) {
  const v = validateComputeJob(item && item.compute_job);
  if (!v.ok) return { ok: false, problems: v.problems };
  if (!commit) return { ok: false, problems: ['no commit to pin (rule 4: never run from a working tree)'] };
  if (!repoPath) return { ok: false, problems: ['no repoPath'] };

  const job = item.compute_job;
  const steps = materializeSteps(job, nodePath);

  // Default the returned artifact set to everything the steps promised to produce. An
  // artifact list that silently omits a file the run generated is how a result becomes
  // unreproducible later, so the safe default is "return the evidence you demanded".
  const artifacts = Array.isArray(job.artifacts) && job.artifacts.length > 0
    ? job.artifacts.slice()
    : Array.from(new Set(steps.flatMap((s) => s.expectFiles)));

  const jobHash = computeJobHash(job);
  const spec = {
    // Content-keyed, NOT commit-keyed — see computeJobHash for why the machine would
    // otherwise re-run its top item forever.
    id: jobId || `${String(item.id).toLowerCase()}-${jobHash}`,
    commit,
    repoPath,
    steps,
    artifacts,
    // Provenance: which queue item asked for this, so a returned artifact set can be traced
    // back to the claim it was meant to support without consulting a separate index.
    source: { ws_id: item.id, title: item.title || null, job_hash: jobHash, submitted_by: 'cwos-fleet-compute' },
  };
  if (job.maxJobHours !== undefined) spec.maxJobHours = Number(job.maxJobHours);
  if (Array.isArray(job.inputs)) spec.inputs = job.inputs;
  return { ok: true, spec };
}

/** Read + parse a WS-*.yaml, returning the raw object (or null). Kept here so the reducer,
 *  the dispatcher and any test agree on how a queue item is loaded. */
function readQueueItem(queueDir, wsId) {
  const f = path.join(queueDir, `${wsId}.yaml`);
  if (!fs.existsSync(f)) return null;
  // Deliberately lazy: cwos-utils owns YAML parsing, and requiring it at module load would
  // drag the whole utils surface into the reducer's hot path.
  const { readYAMLFile } = require('./cwos-utils');
  const r = readYAMLFile(f);
  return r && r.ok ? r.data : null;
}

module.exports = {
  NODE_CMD_TOKEN,
  normalizeRunsOn,
  computeJobHash,
  stepsFingerprint,
  materializeSteps,
  validateComputeJob,
  isComputeReady,
  resolveCmd,
  materializeSpec,
  readQueueItem,
};
