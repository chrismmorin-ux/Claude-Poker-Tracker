#!/usr/bin/env node
/**
 * cwos-item — item-level status transitions for the work queue.
 *
 * WHY THIS EXISTS (WS-537). `/workstream` documented `done|defer|claim|...` and
 * CLAUDE.md's routing table told sessions to use it instead of hand-editing
 * queue YAMLs — but only `done` (sprint-scoped, in cwos-next.js) and `block`
 * were ever implemented. There was no way to defer, dismiss, or supersede an
 * item through the envelope. So the bookkeeping either did not happen or
 * happened as raw YAML edits that bypassed event emission entirely.
 *
 * The consequence was measured on 2026-07-26: kit-quality sat at 18 open items
 * against a cap of 12 and fleet-health at 13 against 10, and SEVEN of those
 * were items that should not have been open at all — two duplicate pairs, two
 * gated on an item that was itself deferred, two pinned to a kit version four
 * releases stale, one explicitly conditional on a falsifier that had not fired.
 * None of that was neglect. There was simply no supported way to say "not this
 * one, and here is why."
 *
 * DESIGN COMMITMENTS
 *
 *  1. A reason is mandatory and is length-checked. An item leaving the backlog
 *     without a recorded rationale is how a queue becomes untrustworthy — the
 *     next session cannot tell a considered decision from an abandoned one.
 *  2. `defer` additionally requires --until: the condition that brings the item
 *     back. A deferral with no resume trigger is a silent dismissal wearing a
 *     softer word, and it is what turns a backlog into a graveyard.
 *  3. Nothing is deleted. Every transition is reversible via `restore`, and the
 *     item file keeps its full history. This mirrors the portfolio doctrine in
 *     ai-personal/intention.md: dormancy is a state, not an ending.
 *  4. Event-log first, YAML second — same commit-point convention as
 *     cwos-next.js runDone. If the YAML write fails the event still records the
 *     intent and reconcile catches up.
 *
 * Usage:
 *   cwos-item defer    WS-NNN --reason "<text>" --until "<resume condition>"
 *   cwos-item dismiss  WS-NNN --reason "<text>" [--superseded-by WS-MMM]
 *   cwos-item restore  WS-NNN --reason "<text>" [--to backlog]
 *   cwos-item show     WS-NNN
 *
 * Output is JSON on stdout. Exit 0 on success, 2 on usage/validation error.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const {
  readYAMLFile, writeFileAtomic, withFileLock, findWorkstreamDir,
  todayISO, escapeYamlString, loadEventDeps,
} = require('./lib/cwos-utils');

const MIN_REASON_LEN = 20;

// Transitions this CLI owns. `done` deliberately absent — completion flows
// through cwos-next.js done so sprint closure and item closure stay atomic.
const TRANSITIONS = {
  defer: {
    status: 'deferred',
    stampField: 'deferred_at',
    reasonField: 'defer_reason',
    requiresUntil: true,
    // Terminal states are not re-openable through defer; use restore first.
    from: ['backlog', 'blocked', 'claimed', 'in_progress'],
  },
  dismiss: {
    status: 'dismissed',
    stampField: 'dismissed_at',
    reasonField: 'dismiss_reason',
    requiresUntil: false,
    from: ['backlog', 'blocked', 'claimed', 'in_progress', 'deferred'],
  },
  restore: {
    status: 'backlog',
    stampField: 'restored_at',
    reasonField: 'restore_reason',
    requiresUntil: false,
    from: ['deferred', 'dismissed', 'blocked'],
  },
};

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function fail(msg, extra) {
  writeJson(Object.assign({ ok: false, error: msg }, extra || {}));
  process.exit(2);
}

function queuePathFor(wsDir, id) {
  return path.join(wsDir, 'queue', `${id}.yaml`);
}

/**
 * Patch a top-level scalar, or append it when absent. Regex-based rather than
 * parse-and-reserialize on purpose: queue YAMLs carry hand-written prose
 * (description, accept_criteria, completion_notes) that the CWOS YAML subset
 * does not round-trip losslessly. Same reasoning as cwos-next.js runDone.
 */
function patchScalar(raw, field, value) {
  const line = `${field}: "${escapeYamlString(value)}"`;
  const re = new RegExp(`^${field}:\\s*.*$`, 'm');
  if (re.test(raw)) return raw.replace(re, line);
  return raw.trimEnd() + `\n${line}\n`;
}

function patchStatus(raw, status) {
  if (/^status:\s*.*$/m.test(raw)) {
    return raw.replace(/^status:\s*.*$/m, `status: ${status}`);
  }
  return `status: ${status}\n` + raw;
}

function runTransition(verb, args) {
  const spec = TRANSITIONS[verb];
  const id = args[0];

  if (!id || !/^WS-[A-Za-z0-9-]+$/.test(String(id))) {
    fail(`${verb}: first argument must be a work item id (e.g. WS-375)`, { got: id || null });
  }

  const reason = readFlag(args, 'reason');
  if (!reason || reason.trim().length < MIN_REASON_LEN) {
    fail(
      `${verb}: --reason is required and must be at least ${MIN_REASON_LEN} characters. ` +
      `An item leaving the backlog without a recorded rationale cannot be audited later.`,
      { got_length: reason ? reason.trim().length : 0 }
    );
  }

  const until = readFlag(args, 'until');
  if (spec.requiresUntil && (!until || until.trim().length < MIN_REASON_LEN)) {
    fail(
      `defer: --until is required and must be at least ${MIN_REASON_LEN} characters. ` +
      `A deferral with no resume condition is a silent dismissal — state what brings this back.`,
      { got_length: until ? until.trim().length : 0 }
    );
  }

  const supersededBy = readFlag(args, 'superseded-by');
  if (supersededBy && !/^WS-[A-Za-z0-9-]+$/.test(supersededBy)) {
    fail(`${verb}: --superseded-by must be a work item id`, { got: supersededBy });
  }

  const wsDir = findWorkstreamDir(process.cwd());
  if (!wsDir) fail(`${verb}: no .claude/workstream directory found from ${process.cwd()}`);

  const qPath = queuePathFor(wsDir, id);
  if (!fs.existsSync(qPath)) fail(`${verb}: no such item: ${id}`, { looked_in: qPath });

  const read = readYAMLFile(qPath);
  if (!read.ok || !read.data) fail(`${verb}: item YAML unreadable: ${id}`, { detail: read.error || null });

  const priorStatus = String(read.data.status || 'backlog');
  const targetStatus = readFlag(args, 'to') || spec.status;

  if (priorStatus === targetStatus) {
    writeJson({ ok: true, noop: true, id, status: priorStatus, note: 'already in target state' });
    return;
  }
  if (priorStatus === 'done') {
    fail(
      `${verb}: ${id} is done — completed work is not re-openable through this CLI. ` +
      `File a follow-up item instead so the completion record stays intact.`,
      { prior_status: priorStatus }
    );
  }
  if (!spec.from.includes(priorStatus)) {
    fail(`${verb}: illegal transition ${priorStatus} -> ${targetStatus} for ${id}`, {
      prior_status: priorStatus,
      allowed_from: spec.from,
    });
  }
  // Cross-check: superseding item must exist, or the pointer rots on write.
  if (supersededBy) {
    const supPath = queuePathFor(wsDir, supersededBy);
    if (!fs.existsSync(supPath)) {
      fail(`${verb}: --superseded-by ${supersededBy} does not exist`, { looked_in: supPath });
    }
    if (supersededBy === id) fail(`${verb}: an item cannot supersede itself`);
  }

  const stamp = todayISO();
  const { appendEvent, ensureCommandId } = loadEventDeps();

  // Event first — the commit point. Non-fatal if the runtime is absent
  // (fleet repos without core/), per AS-23.
  let eventId = null;
  if (appendEvent) {
    try {
      const payload = {
        type: 'item_transitioned',
        ws_id: id,
        verb,
        from_status: priorStatus,
        to_status: targetStatus,
        reason: reason.trim(),
        at: stamp,
      };
      if (until) payload.resume_condition = until.trim();
      if (supersededBy) payload.superseded_by = supersededBy;
      const evtArgs = {
        source_track: 'T6:workstream',
        source_tier: 'founder-prompt',
        track_tag: 'item_transitioned',
        payload,
      };
      if (ensureCommandId) {
        try { evtArgs.command_id = ensureCommandId('item-transition'); } catch { /* non-fatal */ }
      }
      const r = appendEvent(evtArgs);
      if (r && r.ok && r.event) eventId = r.event.id;
    } catch { /* non-fatal per AS-23 */ }
  }

  try {
    withFileLock(qPath + '.lock', () => {
      let raw = fs.readFileSync(qPath, 'utf8');
      raw = patchStatus(raw, targetStatus);
      raw = patchScalar(raw, spec.stampField, stamp);
      raw = patchScalar(raw, spec.reasonField, reason.trim());
      if (until) raw = patchScalar(raw, 'resume_condition', until.trim());
      if (supersededBy) raw = patchScalar(raw, 'superseded_by', supersededBy);
      if (eventId) raw = patchScalar(raw, 'transitioned_by_event', eventId);
      writeFileAtomic(qPath, raw);
    }, { ownerLabel: `item:${verb}`, maxWaitMs: 5000 });
  } catch (e) {
    // Event is already logged; reconcile reconciles. Report but do not fail
    // the caller — matches runDone's degradation contract.
    writeJson({
      ok: true, id, verb, from_status: priorStatus, to_status: targetStatus,
      event_id: eventId, yaml_written: false, warning: `YAML write failed: ${e.message}`,
      next: 'run node kit/scripts/cwos-reconcile.js to re-derive indexes',
    });
    return;
  }

  writeJson({
    ok: true,
    id,
    verb,
    from_status: priorStatus,
    to_status: targetStatus,
    reason: reason.trim(),
    resume_condition: until ? until.trim() : null,
    superseded_by: supersededBy || null,
    event_id: eventId,
    yaml_written: true,
    next: 'run node kit/scripts/cwos-reconcile.js to re-derive queue-index + program caps',
  });
}

function runShow(args) {
  const id = args[0];
  if (!id) fail('show: first argument must be a work item id');
  const wsDir = findWorkstreamDir(process.cwd());
  if (!wsDir) fail('show: no .claude/workstream directory found');
  const qPath = queuePathFor(wsDir, id);
  if (!fs.existsSync(qPath)) fail(`show: no such item: ${id}`);
  const read = readYAMLFile(qPath);
  if (!read.ok) fail(`show: unreadable: ${id}`, { detail: read.error || null });
  const d = read.data || {};
  writeJson({
    ok: true,
    id: d.id || id,
    title: d.title || '',
    status: d.status || 'backlog',
    program: d.program || null,
    priority_score: d.priority_score ?? null,
    effort: d.effort || null,
    blocked_by: d.blocked_by || null,
    resume_condition: d.resume_condition || d.deferred_until_condition || null,
    superseded_by: d.superseded_by || null,
  });
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write(
      'usage: cwos-item <defer|dismiss|restore|show> WS-NNN [options]\n' +
      '  defer   WS-NNN --reason "<text>" --until "<resume condition>"\n' +
      '  dismiss WS-NNN --reason "<text>" [--superseded-by WS-MMM]\n' +
      '  restore WS-NNN --reason "<text>"\n' +
      '  show    WS-NNN\n' +
      `\n--reason and --until must each be at least ${MIN_REASON_LEN} characters.\n` +
      'Completion is NOT here — use cwos-next.js done so sprint + item closure stay atomic.\n'
    );
    process.exit(sub ? 0 : 1);
  }
  if (sub === 'show') return runShow(args.slice(1));
  if (TRANSITIONS[sub]) return runTransition(sub, args.slice(1));
  process.stderr.write(`cwos-item: unknown subcommand: ${sub}\n`);
  process.exit(2);
}

if (require.main === module) main();

module.exports = { TRANSITIONS, MIN_REASON_LEN, patchScalar, patchStatus };
