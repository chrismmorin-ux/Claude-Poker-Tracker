#!/usr/bin/env node
/**
 * cwos-capture — record a decision or a friction event AT THE MOMENT IT HAPPENS.
 *
 * The Decision Detection Protocol has always said: flag the decision inline,
 * don't stop working, formalize it at session end. The flag wrote nothing, and
 * session end arrives about 12% of the time. Result, measured 2026-08-03:
 * system/decisions.md holds 47 entries and NOT ONE is marked `Detected:
 * implicit`. Every decision in the log arrived through /decide. The passive
 * capture path has never once produced a record in this repo.
 *
 * Friction logging (session-end Step 5.5b) has the same shape and the same
 * fate — reconstructing "what went wrong this session" from conversation
 * history, at the one moment least likely to be reached.
 *
 * So capture moves to the moment of detection. An event survives a session that
 * dies; a plan to write something later does not. Formalizing into
 * system/decisions.md becomes a mechanical drain that any command can run.
 *
 * This mirrors what M0 dormant mode already does — /session-end Step 0a emits
 * implicit_decision events to T20:capture-buffer. That path was built for repos
 * with no queue to write to, but the reasoning applies everywhere: capture is
 * cheap and lossless, formalization can wait.
 *
 *   cwos-capture decision "Store allocations as percentages" --weight medium \
 *       --why "Avoids rounding drift when reallocating"
 *   cwos-capture friction "cwos-reconcile --help ran a full reconcile" \
 *       --severity medium --component cli-contract
 *   cwos-capture pending      # what has been captured but not yet formalized
 *   cwos-capture drain        # write Heavy/Medium decisions into decisions.md
 *
 * Usage: run with --help.
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');

const {
  findWorkstreamDir, findRepoRoot, readYAMLFile, writeFileAtomic,
  todayISO, withFileLock, loadEventDeps, resolveEventPayload,
} = require('./lib/cwos-utils');
const { cliGate } = require('./lib/cli');

const { appendEvent } = loadEventDeps();

/**
 * Emit, and report whether it actually landed.
 *
 * This deliberately does NOT use makeEventEmitter. That helper is the right
 * default for the 20+ scripts that emit shadow events alongside real work —
 * AS-23 says a telemetry write must never break its host command, so it
 * returns void and swallows everything.
 *
 * Here the event IS the work. A capture that reports success while recording
 * nothing is the precise harm this command exists to prevent: you are never
 * told about the notes that were not taken. Measured 2026-08-04, there were
 * THREE ways to lose one silently, and the old code could not distinguish any
 * of them from success:
 *
 *   1. core/events.js absent  — the require is guarded, so `appendEvent` is
 *      null and makeEventEmitter's emitter returns immediately. This is the
 *      common case in a freshly adopted repo, and it is why the whole event
 *      closure moved to `capability: core` in WS-578.
 *   2. the append throws      — caught and swallowed per AS-23.
 *   3. the append REJECTS     — appendEvent returns `{ok:false, errors}` on a
 *      schema-validation failure and does not throw at all, so no catch
 *      anywhere would have seen it. The return value was simply discarded.
 *
 * The never-block guarantee is unchanged: every path here still ends in exit 0.
 * What changes is that the caller is told the truth about which one it took.
 */
function emitCapture(tag, payload) {
  if (!appendEvent) {
    return { ok: false, reason: 'core/events.js is not installed in this repo, so there is no event log to write to' };
  }
  let res;
  try {
    res = appendEvent({ source_track: TRACK, track_tag: tag, payload: payload || {} });
  } catch (err) {
    return { ok: false, reason: (err && err.message) ? err.message : String(err) };
  }
  if (res && res.ok === false) {
    const why = (res.errors || []).join('; ') || 'no reason given';
    return { ok: false, reason: `the event log rejected the event — ${why}` };
  }
  return { ok: true };
}

const TRACK = 'T20:capture-buffer';
const WEIGHTS = ['heavy', 'medium', 'light'];
const SEVERITIES = ['high', 'medium', 'low'];
const FEEDBACK_CATEGORIES = ['objection', 'preference', 'concern', 'integration', 'feature_request'];

const CLI = {
  name: 'cwos-capture',
  summary: 'record a decision, friction, or founder feedback at the moment it happens',
  usage: 'cwos-capture <decision|friction|feedback|pending|drain> [text] [options]',
  subcommands: {
    decision: 'record an implicit decision made during work',
    friction: 'record something that fought back — a broken command, a workaround',
    feedback: 'record what the founder said about how CWOS is working',
    pending:  'list captures not yet formalized',
    drain:    'write Heavy/Medium decisions into system/decisions.md',
  },
  flags: {
    weight: { type: 'string', placeholder: 'heavy|medium|light', describe: 'decision weight (default: medium). Heavy/Medium reach decisions.md; Light stays in the log.' },
    why: { type: 'string', placeholder: 'text', describe: 'reasoning — the part that is unrecoverable later' },
    context: { type: 'string', placeholder: 'text', describe: 'what work prompted it (item id, bug, feature)' },
    severity: { type: 'string', placeholder: 'high|medium|low', describe: 'friction severity (default: medium)' },
    component: { type: 'string', placeholder: 'name', describe: 'kit component that caused the friction' },
    workaround: { type: 'string', placeholder: 'text', describe: 'what was done instead' },
    category: { type: 'string', placeholder: FEEDBACK_CATEGORIES.join('|'), describe: 'feedback category (default: concern)' },
    detail: { type: 'string', placeholder: 'text', describe: 'fuller context behind the feedback' },
    json: { type: 'boolean', describe: 'machine-readable output' },
    'dry-run': { type: 'boolean', describe: 'for drain: show what would be written, write nothing' },
  },
  notes: 'Capture is cheap and lossless; formalization can wait. Emitting is the point — never block work on it.',
};

// exit 0 — captured, or drained
// exit 2 — bad command line

function main() {
  // cliGate validates the subcommand against CLI.subcommands and rejects an
  // unknown one with a suggestion, so nothing here re-checks it.
  const { values, positionals, sub } = cliGate(process.argv.slice(2), CLI);
  const text = positionals.join(' ').trim();

  let wsDir;
  try { wsDir = findWorkstreamDir(process.cwd()); }
  catch { console.error('cwos-capture: no workstream dir found.'); return 2; }

  switch (sub) {
    case 'decision': return captureDecision(text, values);
    case 'friction': return captureFriction(text, values);
    case 'feedback': return captureFeedback(text, values);
    case 'pending':  return showPending(wsDir, values);
    case 'drain':    return drain(wsDir, values);
  }
  return 2;
}

function captureDecision(text, values) {
  if (!text) { console.error('cwos-capture decision: need the decision text.'); return 2; }
  const weight = normalizeChoice(values.weight, WEIGHTS, 'medium');
  if (!weight) { console.error(`cwos-capture: --weight must be one of ${WEIGHTS.join(', ')}.`); return 2; }

  const landed = emitCapture('decision_detected', {
    type: 'decision_detected',
    decision_text: text,
    weight,
    reasoning: values.why || null,
    context: values.context || null,
    detected_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });

  if (values.json) {
    process.stdout.write(JSON.stringify(
      landed.ok ? { captured: 'decision', weight } : { captured: false, weight, error: landed.reason }
    ) + '\n');
  } else if (landed.ok) {
    process.stdout.write(`captured ${weight} decision — ${weight === 'light' ? 'stays in the log' : 'will reach decisions.md on drain'}\n`);
  } else {
    reportLost('decision', text, landed.reason);
  }
  return 0;
}

/**
 * Say plainly that the capture did not happen, on stderr, and still exit 0.
 *
 * Echoing the text back is the point: the caller can paste it somewhere that
 * does persist. A capture command that loses the note AND the wording has
 * taken something unrecoverable — the reasoning is the part that cannot be
 * reconstructed later, which is the whole premise of capturing at the moment
 * of detection rather than at a session boundary.
 */
function reportLost(kind, text, reason) {
  process.stderr.write(
    `cwos-capture: NOT captured — ${reason}\n` +
    `  the ${kind} was: ${text}\n` +
    `  (exit 0 by design: capture must never block work, but it must not claim success either)\n`
  );
}

function captureFriction(text, values) {
  if (!text) { console.error('cwos-capture friction: need the friction text.'); return 2; }
  const severity = normalizeChoice(values.severity, SEVERITIES, 'medium');
  if (!severity) { console.error(`cwos-capture: --severity must be one of ${SEVERITIES.join(', ')}.`); return 2; }

  const landed = emitCapture('friction_detected', {
    type: 'friction_detected',
    friction_text: text,
    severity,
    component: values.component || null,
    workaround: values.workaround || null,
    detected_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });

  if (values.json) {
    process.stdout.write(JSON.stringify(
      landed.ok ? { captured: 'friction', severity } : { captured: false, severity, error: landed.reason }
    ) + '\n');
  } else if (landed.ok) {
    process.stdout.write(`captured ${severity} friction\n`);
  } else {
    reportLost('friction', text, landed.reason);
  }
  return 0;
}

/**
 * What the founder said about how CWOS is working.
 *
 * Distinct from friction, and worth keeping distinct: friction is the system
 * reporting on itself, feedback is a person reporting on the system. They
 * carry different weight when deciding what to fix, so they stay separate
 * event types rather than one with a flag.
 *
 * `feedback_recorded` had been named as canonical in the WS-567 design and in
 * WS-578 without ever existing — a repo-wide search found it only in design
 * prose. /feedback wrote straight into `.cwos-feedback.yaml`, which is exactly
 * the second store this item removes.
 */
function captureFeedback(text, values) {
  if (!text) { console.error('cwos-capture feedback: need the feedback text.'); return 2; }
  const category = normalizeChoice(values.category, FEEDBACK_CATEGORIES, 'concern');
  if (!category) { console.error(`cwos-capture: --category must be one of ${FEEDBACK_CATEGORIES.join(', ')}.`); return 2; }

  const landed = emitCapture('feedback_recorded', {
    type: 'feedback_recorded',
    feedback_text: text,
    category,
    detail: values.detail || null,
    // Deliberately no `resolved` field at capture time. The event log is
    // append-only, so resolution is a later event, never a mutation of this
    // one — the same reason drain writes *_formalized instead of editing.
    detected_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  });

  if (values.json) {
    process.stdout.write(JSON.stringify(
      landed.ok ? { captured: 'feedback', category } : { captured: false, category, error: landed.reason }
    ) + '\n');
  } else if (landed.ok) {
    process.stdout.write(`captured ${category} feedback\n`);
  } else {
    reportLost('feedback', text, landed.reason);
  }
  return 0;
}

// ─── Reading the buffer ─────────────────────────────────────────────────────

/**
 * Captures that have not been formalized yet.
 *
 * The event log is append-only (ADR-018), so "drained" is not a mutation of the
 * original event — it is a later `*_formalized` event carrying the original's
 * content_hash. Same shape cwos-stop-telemetry uses to stamp an event it cannot
 * edit. Matching on content_hash rather than position means a re-run of drain
 * is idempotent and a partially-completed drain resumes correctly.
 */
function readPending(wsDir) {
  const logPath = path.join(wsDir, 'events', 'current.jsonl');
  if (!fs.existsSync(logPath)) return { decisions: [], friction: [] };

  const drained = new Set();
  const decisions = [];
  const friction = [];

  let lines = [];
  try { lines = fs.readFileSync(logPath, 'utf8').split('\n'); } catch { return { decisions: [], friction: [] }; }

  for (const line of lines) {
    if (!line.trim()) continue;
    let ev;
    try { ev = JSON.parse(line); } catch { continue; }
    // Resolve a spilled payload rather than reading the {payload_ref} stub —
    // a capture whose text ran past 2KB would otherwise list as blank in
    // `pending` and drain under an empty description.
    const p = resolveEventPayload(wsDir, ev);
    const kind = p.type || ev.track_tag;

    if (kind === 'decision_formalized' || kind === 'friction_formalized') {
      if (p.source_hash) drained.add(p.source_hash);
      continue;
    }
    if (kind === 'decision_detected') decisions.push({ ...p, _hash: ev.content_hash, _at: ev.timestamp });
    else if (kind === 'friction_detected') friction.push({ ...p, _hash: ev.content_hash, _at: ev.timestamp });
  }

  return {
    decisions: decisions.filter(d => !drained.has(d._hash)),
    friction: friction.filter(f => !drained.has(f._hash)),
  };
}

function showPending(wsDir, values) {
  const { decisions, friction } = readPending(wsDir);
  if (values.json) {
    process.stdout.write(JSON.stringify({ decisions, friction }, null, 2) + '\n');
    return 0;
  }
  if (decisions.length === 0 && friction.length === 0) {
    process.stdout.write('cwos-capture: nothing pending.\n');
    return 0;
  }
  if (decisions.length > 0) {
    process.stdout.write(`${decisions.length} decision(s) awaiting formalization:\n`);
    for (const d of decisions) process.stdout.write(`  [${d.weight}] ${d.decision_text}\n`);
  }
  if (friction.length > 0) {
    process.stdout.write(`${friction.length} friction event(s) awaiting formalization:\n`);
    for (const f of friction) process.stdout.write(`  [${f.severity}] ${f.friction_text}\n`);
  }
  return 0;
}

// ─── Drain ──────────────────────────────────────────────────────────────────

function drain(wsDir, values) {
  const dryRun = Boolean(values['dry-run']);
  const { decisions, friction } = readPending(wsDir);

  // Light decisions are captured for the record but never reach decisions.md —
  // that is the weight's entire meaning. They stay queryable in the event log.
  const formalizable = decisions.filter(d => d.weight === 'heavy' || d.weight === 'medium');

  // Guard on `decisions`, not `formalizable`: a batch of nothing but light
  // decisions still has work to do (marking them), and returning early here
  // left them pending forever.
  if (decisions.length === 0 && friction.length === 0) {
    if (!values.json) process.stdout.write('cwos-capture drain: nothing to formalize.\n');
    return 0;
  }

  const repoRoot = findRepoRoot(process.cwd());
  const decisionsPath = repoRoot ? path.join(repoRoot, 'system', 'decisions.md') : null;
  const written = [];

  if (formalizable.length > 0 && decisionsPath && fs.existsSync(decisionsPath)) {
    // Lock across read-max-id + append: allocating an id by scanning and then
    // writing is a read-modify-write, and WS-574 is an open bug about exactly
    // this pattern returning duplicate ids under concurrency.
    const lockPath = decisionsPath + '.lock';
    withFileLock(lockPath, () => {
      let body = fs.readFileSync(decisionsPath, 'utf8');
      let next = maxDecId(body) + 1;
      let appended = '';

      for (const d of formalizable) {
        const id = `DEC-${String(next).padStart(3, '0')}`;
        appended += renderDecision(id, d);
        written.push({ id, text: d.decision_text, weight: d.weight, hash: d._hash });
        next++;
      }

      if (!dryRun) {
        if (!body.endsWith('\n')) body += '\n';
        writeFileAtomic(decisionsPath, body + appended);
      }
    }, { maxWaitMs: 5000, ownerLabel: 'capture-drain' });
  } else if (formalizable.length > 0) {
    process.stderr.write('cwos-capture drain: system/decisions.md not found — decisions left pending.\n');
  }

  // A formalization event is the ONLY record that a drain happened — the
  // watermark readPending matches on. If decisions.md was just written and the
  // matching event does not land, the capture stays pending and the NEXT drain
  // appends the same decision to decisions.md again under a fresh DEC id. So a
  // failure here is not cosmetic; it is a duplicate-record bug that compounds
  // every run. Silence was affordable while these went through the swallowing
  // emitter; it is not, and never was.
  const unmarked = [];

  if (!dryRun) {
    for (const w of written) {
      const r = emitCapture('decision_formalized', {
        type: 'decision_formalized',
        source_hash: w.hash, dec_id: w.id, weight: w.weight,
      });
      if (!r.ok) unmarked.push({ what: `${w.id} (${w.text})`, reason: r.reason, wrote_to_file: true });
    }
    // A light decision's formalization IS "stay in the event log" — that is the
    // weight's meaning, not work left undone. Marking it keeps `pending` an
    // honest list of things still owed; otherwise every light capture ever made
    // accumulates there and the list stops being worth reading.
    for (const d of decisions) {
      if (d.weight !== 'light') continue;
      const r = emitCapture('decision_formalized', {
        type: 'decision_formalized',
        source_hash: d._hash, dec_id: null, weight: 'light',
        note: 'light — recorded in the event log, deliberately not in decisions.md',
      });
      if (!r.ok) unmarked.push({ what: `light decision (${d.decision_text})`, reason: r.reason, wrote_to_file: false });
    }
    for (const f of friction) {
      // Friction's destination is the event log itself — `.cwos-feedback.yaml`
      // is a generated VIEW of these events (WS-578), not a second store to
      // write into. Marking formalized keeps `pending` honest rather than
      // growing forever.
      const r = emitCapture('friction_formalized', {
        type: 'friction_formalized', source_hash: f._hash, severity: f.severity,
      });
      if (!r.ok) unmarked.push({ what: `friction (${f.friction_text})`, reason: r.reason, wrote_to_file: false });
    }

    if (unmarked.length) {
      const dupes = unmarked.filter(u => u.wrote_to_file).length;
      process.stderr.write(
        `cwos-capture drain: ${unmarked.length} item(s) could NOT be marked formalized — ${unmarked[0].reason}\n`
      );
      for (const u of unmarked) process.stderr.write(`  still pending: ${u.what}\n`);
      if (dupes > 0) {
        process.stderr.write(
          `  WARNING: ${dupes} of these were already written to system/decisions.md.\n` +
          `  They remain pending, so re-running drain will append them AGAIN under new DEC ids.\n` +
          `  Fix the event log first, or remove those entries from decisions.md by hand.\n`
        );
      }
    }
  }

  if (values.json) {
    process.stdout.write(JSON.stringify({ dry_run: dryRun, decisions: written, friction_marked: friction.length }, null, 2) + '\n');
  } else {
    const verb = dryRun ? 'would write' : 'wrote';
    if (written.length > 0) {
      process.stdout.write(`cwos-capture drain: ${verb} ${written.length} decision(s) to system/decisions.md:\n`);
      for (const w of written) process.stdout.write(`  ${w.id} [${w.weight}] ${w.text}\n`);
    }
    const light = decisions.length - formalizable.length;
    if (light > 0) process.stdout.write(`  (${light} light decision(s) left in the event log by design)\n`);
    if (friction.length > 0) {
      process.stdout.write(`  ${friction.length} friction event(s) ${dryRun ? 'would be marked' : 'marked'} formalized\n`);
    }
  }
  return 0;
}

function maxDecId(body) {
  let max = 0;
  const re = /^###\s+DEC-(\d+)/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    const n = parseInt(m[1], 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return max;
}

/**
 * The short form, deliberately. An implicit decision captures WHAT and WHY
 * without the full options-considered analysis /decide produces — demanding
 * that much at capture time is what made the passive path unusable.
 */
function renderDecision(id, d) {
  const lines = [
    '',
    `### ${id}: ${firstClause(d.decision_text)}`,
    `**Date:** ${todayISO()} | **Status:** Accepted | **Detected:** implicit | **Weight:** ${d.weight}`,
    `**Decision:** ${d.decision_text}`,
  ];
  if (d.reasoning) lines.push(`**Reasoning:** ${d.reasoning}`);
  if (d.context) lines.push(`**Context:** ${d.context}`);
  lines.push('');
  return lines.join('\n');
}

function firstClause(text) {
  const s = String(text).split(/[.—]\s/)[0].trim();
  return s.length > 90 ? s.slice(0, 89).trimEnd() + '…' : s;
}

function normalizeChoice(v, allowed, fallback) {
  if (v == null || v === '') return fallback;
  const s = String(v).toLowerCase();
  return allowed.includes(s) ? s : null;
}

if (require.main === module) {
  try {
    process.exit(main());
  } catch (err) {
    // Capture must never block work. A failure here is reported and shrugged
    // off — losing a decision record is bad, halting the session is worse.
    console.error(`cwos-capture: ${err.message}`);
    process.exit(0);
  }
}

module.exports = { readPending, maxDecId, renderDecision };
