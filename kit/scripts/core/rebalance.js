/**
 * rebalance.js — T6:workstream-rebalance atomic mutation engine (WS-264).
 *
 * ADR-037 RISK-2 / AS-037-10. Provides an atomic transaction boundary for
 * multi-field cache-invalidation fan-out across queue/WS-*.yaml. One
 * trigger event (sprint_completed, engine_run_completed, context_updated)
 * can invalidate cached fields on ~20 backlog items; this module rewrites
 * them all-or-nothing.
 *
 * Atomicity protocol (event-log as commit point):
 *
 *   1. computeUpdates() runs caller-supplied computeFn against each
 *      touched WS yaml, building an in-memory map of new file contents.
 *   2. Each updated file is written to <path>.rebalance-staging and
 *      fsynced. Staging files are invisible to glob WS-*.yaml so
 *      concurrent readers see pre-rebalance state.
 *   3. A score_window_rebalanced commit event is appended to the event
 *      log (carrying touched_ws_ids + sha256 content hashes). The event
 *      log's withWriteLock + fsync is the durability boundary — anything
 *      after this point is committed.
 *   4. Each .rebalance-staging is promoted to .yaml via atomic rename.
 *   5. A reconcile-refresh event is appended so the T6:workstream reducer
 *      re-reads now-promoted YAMLs and materializes state/queue.json.
 *
 * Recovery (kit/scripts/cwos-reconcile.js calls recoverRebalance() before
 * Phase 0): any .rebalance-staging files are promoted forward (atomic
 * rename), and a score_window_rebalanced event with trigger_reason
 * 'recovered' is appended to record the action. This is forward-recovery
 * — partial promotions complete, never roll back. computeFn is required
 * to be deterministic (replay-pure) so retrying produces identical
 * results.
 *
 * Zero external dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findWorkstreamDir, readYAMLFile, globFiles } = require('../lib/cwos-utils');
const { appendEvent } = require('./events');

const STAGING_SUFFIX = '.rebalance-staging';

function sha256(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

function fsyncFile(filePath) {
  const fd = fs.openSync(filePath, 'r+');
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Apply field updates to a YAML file's text.
 *
 * Strategy: line-based replace for top-level scalar fields. If a field
 * already exists at column 0, replace its value. Otherwise insert at the
 * end of the top-level scalar section (before the first block sequence
 * or the end of file).
 *
 * Constraints:
 *   - Only top-level scalar/array fields are supported (no nested map
 *     mutation). Caller's computeFn should return only fields it knows
 *     how to express as block-scalar key: value.
 *   - String values are quoted; numbers/booleans/null are written bare.
 *   - Arrays of strings/numbers are written inline as ["a", "b", "c"].
 *
 * Returns the new file content as a string. Throws if a field shape is
 * unsupported.
 */
function applyFieldUpdates(yamlText, updates) {
  let lines = yamlText.split('\n');
  for (const [field, value] of Object.entries(updates)) {
    const serialized = serializeValue(value);
    const lineRe = new RegExp(`^${escapeRegex(field)}\\s*:`);
    const idx = lines.findIndex((l) => lineRe.test(l));
    const newLine = `${field}: ${serialized}`;
    if (idx >= 0) {
      lines[idx] = newLine;
    } else {
      // Insert before trailing blank lines / EOF
      let insertAt = lines.length;
      while (insertAt > 0 && lines[insertAt - 1].trim() === '') insertAt -= 1;
      lines.splice(insertAt, 0, newLine);
    }
  }
  return lines.join('\n');
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function serializeValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) {
    return '[' + v.map((item) => serializeValue(item)).join(', ') + ']';
  }
  throw new Error(`rebalance: unsupported value shape for serialization: ${typeof v}`);
}

/**
 * Run a rebalance.
 *
 * Args:
 *   workstreamDir   — absolute path to .claude/workstream/
 *   triggerReason   — one of 'sprint-completed' | 'engine-run-completed' |
 *                     'context-updated' | 'manual'
 *   triggerEventId  — string id of the event that triggered the rebalance,
 *                     or null for manual
 *   touchedWsIds    — array of WS-NNN strings to consider for update
 *   computeFn       — (yamlData, wsId) → { field: value, ... } | null
 *                     Returning null or empty object skips that WS (no-op).
 *                     MUST be deterministic (replay-pure) — recovery may
 *                     re-run it.
 *
 * Returns:
 *   { ok, rebalance_id, commit_event_id, ws_count, no_op?, errors? }
 */
function rebalance(opts) {
  const workstreamDir = opts.workstreamDir || findWorkstreamDir();
  const triggerReason = opts.triggerReason;
  const triggerEventId = 'triggerEventId' in opts ? opts.triggerEventId : null;
  const touchedWsIds = opts.touchedWsIds || [];
  const computeFn = opts.computeFn;

  if (typeof computeFn !== 'function') {
    return { ok: false, errors: ['rebalance: computeFn must be a function'] };
  }
  if (!Array.isArray(touchedWsIds)) {
    return { ok: false, errors: ['rebalance: touchedWsIds must be an array'] };
  }

  const queueDir = path.join(workstreamDir, 'queue');
  if (!fs.existsSync(queueDir)) {
    return { ok: false, errors: [`rebalance: queueDir not found: ${queueDir}`] };
  }

  // Step 1: compute updates
  const updates = [];
  const errors = [];
  for (const wsId of touchedWsIds) {
    if (!/^WS-\d+$/.test(wsId)) {
      errors.push(`rebalance: invalid wsId shape: ${wsId}`);
      continue;
    }
    const yamlPath = path.join(queueDir, `${wsId}.yaml`);
    if (!fs.existsSync(yamlPath)) {
      errors.push(`rebalance: ${wsId}.yaml not found`);
      continue;
    }
    const oldContent = fs.readFileSync(yamlPath, 'utf8');
    const r = readYAMLFile(yamlPath);
    if (!r.ok) {
      errors.push(`rebalance: ${wsId}.yaml parse failed: ${r.error}`);
      continue;
    }
    let fields;
    try {
      fields = computeFn(r.data, wsId);
    } catch (err) {
      errors.push(`rebalance: computeFn threw for ${wsId}: ${err.message}`);
      continue;
    }
    if (!fields || typeof fields !== 'object' || Object.keys(fields).length === 0) continue;
    let newContent;
    try {
      newContent = applyFieldUpdates(oldContent, fields);
    } catch (err) {
      errors.push(`rebalance: applyFieldUpdates failed for ${wsId}: ${err.message}`);
      continue;
    }
    if (newContent === oldContent) continue;
    updates.push({ wsId, yamlPath, oldContent, newContent, contentHash: sha256(newContent) });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }
  if (updates.length === 0) {
    return { ok: true, ws_count: 0, no_op: true };
  }

  // Step 2: stage files
  const stagingPaths = [];
  try {
    for (const u of updates) {
      const stagingPath = u.yamlPath + STAGING_SUFFIX;
      fs.writeFileSync(stagingPath, u.newContent, 'utf8');
      fsyncFile(stagingPath);
      stagingPaths.push(stagingPath);
    }
  } catch (err) {
    // Stage failure — clean up partial staging files.
    for (const p of stagingPaths) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
    return { ok: false, errors: [`rebalance: staging failed: ${err.message}`] };
  }

  // Step 3: append commit event
  const rebalanceId = crypto.randomBytes(8).toString('hex');
  const contentHashes = {};
  for (const u of updates) contentHashes[u.wsId] = u.contentHash;
  const payload = {
    type: 'score_window_rebalanced',
    rebalance_id: rebalanceId,
    trigger_reason: triggerReason,
    trigger_event_id: triggerEventId,
    touched_ws_ids: updates.map((u) => u.wsId),
    content_hashes: contentHashes,
  };
  let commitResult;
  try {
    commitResult = appendEvent({
      source_tier: 'reducer-output',
      source_track: 'T6:workstream',
      track_tag: 'score-window-rebalanced',
      payload,
      causation_id: triggerEventId,
    }, { workstreamDir });
  } catch (err) {
    // Append threw — clean up staging.
    for (const p of stagingPaths) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
    return { ok: false, errors: [`rebalance: commit appendEvent threw: ${err.message}`] };
  }
  if (!commitResult || !commitResult.ok) {
    for (const p of stagingPaths) {
      try { fs.unlinkSync(p); } catch { /* ignore */ }
    }
    return {
      ok: false,
      errors: ['rebalance: commit event rejected', ...(commitResult ? commitResult.errors || [] : [])],
    };
  }

  // Step 4: promote staging → final
  const promoted = [];
  for (const u of updates) {
    const stagingPath = u.yamlPath + STAGING_SUFFIX;
    try {
      fs.renameSync(stagingPath, u.yamlPath);
      promoted.push(u.wsId);
    } catch (err) {
      // Leave staging for recovery to pick up — commit event already in log.
      errors.push(`rebalance: promote ${u.wsId} failed: ${err.message}`);
    }
  }

  // Step 5: trigger T6:workstream re-materialization of state/queue.json.
  // The score-window-rebalanced event in step 3 already fired the reducer,
  // but at that time staging files were not promoted — so state/queue.json
  // saw OLD content. Append a reconcile-refresh event here so the reducer
  // re-runs against the now-promoted YAMLs.
  try {
    appendEvent({
      source_tier: 'reducer-output',
      source_track: 'T6:workstream',
      track_tag: 'reconcile-refresh',
      payload: { type: 'reconcile-refresh', domains_intended: ['queue'] },
      causation_id: commitResult.event && commitResult.event.id,
    }, { workstreamDir });
  } catch { /* non-fatal — eventual consistency via next reconcile */ }

  return {
    ok: errors.length === 0,
    rebalance_id: rebalanceId,
    commit_event_id: commitResult.event && commitResult.event.id,
    ws_count: updates.length,
    promoted,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Recover from a crashed rebalance. Promotes any stranded .rebalance-staging
 * files and emits a recovery event for replay-purity.
 *
 * Forward-recovery only: staged content is always promoted, never deleted.
 * computeFn determinism guarantees that retrying the rebalance would
 * produce the same staged content, so promoting forward is safe even if
 * the original commit event never made it to the log.
 *
 * Returns: { ok, recovered: [wsId, ...], errors? }
 */
function recoverRebalance(opts) {
  const workstreamDir = (opts && opts.workstreamDir) || findWorkstreamDir();
  const queueDir = path.join(workstreamDir, 'queue');
  if (!fs.existsSync(queueDir)) {
    return { ok: true, recovered: [] };
  }
  const stagingFiles = fs.readdirSync(queueDir).filter((f) => f.endsWith(STAGING_SUFFIX));
  if (stagingFiles.length === 0) {
    return { ok: true, recovered: [] };
  }

  const recovered = [];
  const errors = [];
  const contentHashes = {};
  for (const stagingFile of stagingFiles) {
    const stagingPath = path.join(queueDir, stagingFile);
    const targetName = stagingFile.slice(0, -STAGING_SUFFIX.length);
    const targetPath = path.join(queueDir, targetName);
    const wsIdMatch = targetName.match(/^(WS-\d+)\.yaml$/);
    if (!wsIdMatch) {
      // Orphan staging file with malformed name — leave it alone.
      errors.push(`recoverRebalance: skipping unexpected staging filename: ${stagingFile}`);
      continue;
    }
    const wsId = wsIdMatch[1];
    let stagedContent;
    try {
      stagedContent = fs.readFileSync(stagingPath, 'utf8');
    } catch (err) {
      errors.push(`recoverRebalance: read ${stagingFile} failed: ${err.message}`);
      continue;
    }
    try {
      fs.renameSync(stagingPath, targetPath);
      recovered.push(wsId);
      contentHashes[wsId] = sha256(stagedContent);
    } catch (err) {
      errors.push(`recoverRebalance: promote ${wsId} failed: ${err.message}`);
    }
  }

  if (recovered.length > 0) {
    try {
      appendEvent({
        source_tier: 'reducer-output',
        source_track: 'T6:workstream',
        track_tag: 'score-window-rebalanced',
        payload: {
          type: 'score_window_rebalanced',
          rebalance_id: 'recovered-' + crypto.randomBytes(6).toString('hex'),
          trigger_reason: 'recovered',
          trigger_event_id: null,
          touched_ws_ids: recovered,
          content_hashes: contentHashes,
        },
      }, { workstreamDir });
    } catch (err) {
      errors.push(`recoverRebalance: emit recovery event failed: ${err.message}`);
    }
  }

  return {
    ok: errors.length === 0,
    recovered,
    errors: errors.length > 0 ? errors : undefined,
  };
}

module.exports = {
  STAGING_SUFFIX,
  applyFieldUpdates,
  serializeValue,
  rebalance,
  recoverRebalance,
};
