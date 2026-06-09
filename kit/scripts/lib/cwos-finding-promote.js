'use strict';
/**
 * cwos-finding-promote — shared library that materializes WS items from
 * open findings whose proposed_route says "promote me" and whose severity
 * passes the repo's .cwos-config.yaml priority.auto_promote gate.
 *
 * Pre-kit-v3.7.0 behavior: findings landed on disk (FIND-CA-*.yaml from
 * constitutional-audit, FIND-*.yaml from eng-engine, etc.) with
 * `proposed_route.would_promote_to_queue: true` but no code path
 * created the corresponding WS-*.yaml. /next gate would see active
 * programs and zero candidates, hand back "nothing to do" even when
 * the audit had just surfaced a critical compliance failure.
 *
 * This library owns three steps:
 *   1. allocateNextWsId(wsDir)
 *   2. buildQueueItemFromFinding(finding, wsId, opts) — pure projection
 *   3. promoteFinding(wsDir, finding, opts) — writes WS file, mutates FIND
 *
 * The reconciler (cwos-reconcile.js) has the orchestrator that calls
 * `promoteOpenFindings(wsDir, config)` — that function iterates open
 * findings, checks the auto_promote gate, and dispatches to promoteFinding.
 *
 * Idempotency: when a finding's `promoted_to` is already non-empty, the
 * helper short-circuits. This is the dedup mechanism — re-running
 * reconcile is safe.
 *
 * Determinism: WS-NNN IDs come from a scan of the queue + queue-index.
 * No randomness, no clock dependency except the `created_at` timestamp.
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic, formatScalar, todayISO, withFileLock } = require('./cwos-utils');

// Severities the auto_promote gate maps. Lowercased on read so finding
// files using CRITICAL or Critical still hit the rules.
const SEVERITY_KEYS = ['critical', 'high', 'medium', 'low'];

// Promotion suppression rule: a finding-status of `infeasible` or
// `no-detector` describes a coverage gap, not an actionable failure.
// Those should land on a follow-up backlog manually, not auto-promote
// to the active queue even if would_promote_to_queue is true.
const NON_PROMOTABLE_STATUSES = new Set(['infeasible', 'no-detector']);

// Path within an adopted repo's workstream/ where queue files live.
const QUEUE_DIRNAME = 'queue';
const QUEUE_INDEX_NAME = 'queue-index.yaml';
const FINDINGS_DIRNAME = 'findings';

// Scan queue/ + queue/archive/ + queue-index.yaml; return the next
// numeric WS id of shape WS-NNN. We ignore prefixed variants like
// WS-MD-027 because the index uses pure-numeric IDs for auto-promoted
// items — keeping the auto-promote namespace separate from manual
// prefixed runs makes dedup + sort behavior simpler.
//
// Concurrency (WS-424 / FIND-289): when two engine runs allocate at the
// same instant the unlocked scan returns the same max+1 to both, then
// both write WS-N.yaml — the second clobbers the first. Callers that
// also write the WS file should pass `opts.writer(wsId)` so the lock
// spans scan + write. The lock primitive lives at .ws-counter.lock in
// wsDir; see kit/scripts/lib/cwos-utils.js:withFileLock for details.
function allocateNextWsId(wsDir, opts = {}) {
  const compute = () => {
    const queueDir = path.join(wsDir, QUEUE_DIRNAME);
    const archiveDir = path.join(queueDir, 'archive');
    const indexPath = path.join(wsDir, QUEUE_INDEX_NAME);

    const ids = new Set();
    const PURE_NUMERIC = /^WS-(\d+)\.yaml$/;

    function harvestDir(dir) {
      if (!fs.existsSync(dir)) return;
      for (const f of fs.readdirSync(dir)) {
        const m = PURE_NUMERIC.exec(f);
        if (m) ids.add(parseInt(m[1], 10));
      }
    }
    harvestDir(queueDir);
    harvestDir(archiveDir);

    if (fs.existsSync(indexPath)) {
      const r = readYAMLFile(indexPath);
      if (r.ok && r.data && Array.isArray(r.data.items)) {
        for (const item of r.data.items) {
          // cwos-utils parses single-key list items as strings (e.g.,
          // '- id: "WS-007"' becomes the literal string 'id: "WS-007"'),
          // and multi-key items as objects. Handle both shapes.
          let idStr = null;
          if (typeof item === 'string') {
            const sm = /id:\s*"?(WS-\d+)"?/.exec(item);
            if (sm) idStr = sm[1];
          } else if (item && item.id) {
            idStr = String(item.id);
          }
          const m = /^WS-(\d+)$/.exec(idStr || '');
          if (m) ids.add(parseInt(m[1], 10));
        }
      }
    }

    let max = 0;
    for (const n of ids) if (n > max) max = n;
    const next = max + 1;
    return `WS-${String(next).padStart(3, '0')}`;
  };

  if (typeof opts.writer === 'function') {
    const lockPath = path.join(wsDir, '.ws-counter.lock');
    return withFileLock(lockPath, () => {
      const wsId = compute();
      opts.writer(wsId);
      return wsId;
    }, { ownerLabel: 'allocateNextWsId', maxWaitMs: 10_000 });
  }
  // Legacy unlocked path — safe only for single-threaded read-only callers
  // (tests, /audit drift scans). Concurrent writers MUST pass a writer.
  return compute();
}

// Pure projection — turn a finding object into the queue-item shape.
// Doesn't read or write files. Caller supplies the WS id (so the
// allocator can be batch-friendly later) and an optional `today`
// override for deterministic tests.
function buildQueueItemFromFinding(finding, wsId, opts = {}) {
  const today = opts.today || todayISO();
  const title = finding.title || `Auto-promoted from ${finding.id}`;
  const program = finding.program || finding.category || 'unscoped';
  const severity = (finding.severity || 'medium').toLowerCase();
  const priority = typeof finding.priority_score === 'number'
    ? finding.priority_score
    : defaultPriorityForSeverity(severity);
  const category = inferCategoryFromFinding(finding);
  const recommendedAction = finding.recommended_action || '';
  const description = finding.description || '';

  return {
    id: wsId,
    title,
    status: 'backlog',
    type: 'finding-promoted',
    category,
    program,
    capability: opts.capability || 'core',
    priority_score: priority,
    effort: opts.effort || 'M',
    created_at: today,
    created_by: 'auto-promote-via-reconcile',
    severity,
    source_finding: finding.id,
    description,
    recommended_action: recommendedAction,
    dedup_key: `auto-promote-${finding.id}`,
  };
}

function defaultPriorityForSeverity(severity) {
  switch (severity) {
    case 'critical': return 70;
    case 'high':     return 55;
    case 'medium':   return 40;
    case 'low':      return 20;
    default:         return 30;
  }
}

// Best-effort category inference. Findings emitted by engines carry
// a `category` field; constitutional-audit findings carry
// `category: self-compliance`. Without a category, fall back to the
// program field (kit-quality, program-integrity, etc.).
function inferCategoryFromFinding(finding) {
  if (finding.category && typeof finding.category === 'string') return finding.category;
  if (finding.program) return finding.program;
  return 'general';
}

// Serialize a queue-item object to YAML matching the kit's WS-*.yaml
// schema. Mirrors the shape of the kit/templates/workstream/queue/
// examples and existing hand-written WS files in the queue.
function serializeQueueItem(item) {
  const lines = [];
  lines.push(`id: ${formatScalar(item.id)}`);
  lines.push(`title: ${formatScalar(item.title)}`);
  lines.push(`status: ${formatScalar(item.status)}`);
  lines.push(`type: ${formatScalar(item.type)}`);
  lines.push(`category: ${formatScalar(item.category)}`);
  lines.push(`capability: ${formatScalar(item.capability)}`);
  lines.push(`program: ${formatScalar(item.program)}`);
  lines.push(`priority_score: ${item.priority_score}`);
  lines.push(`effort: ${formatScalar(item.effort)}`);
  lines.push(`severity: ${formatScalar(item.severity)}`);
  lines.push(`created_at: ${formatScalar(item.created_at)}`);
  lines.push(`created_by: ${formatScalar(item.created_by)}`);
  lines.push(`source_finding: ${formatScalar(item.source_finding)}`);
  lines.push(`dedup_key: ${formatScalar(item.dedup_key)}`);
  if (item.description) {
    lines.push('description: |');
    for (const ln of String(item.description).split('\n')) {
      lines.push(`  ${ln}`);
    }
  }
  if (item.recommended_action) {
    lines.push(`recommended_action: ${formatScalar(item.recommended_action)}`);
  }
  lines.push(`source:`);
  lines.push(`  finding_id: ${formatScalar(item.source_finding)}`);
  lines.push(`  promoted_via: cwos-reconcile auto-promote`);
  lines.push(`  promoted_at: ${formatScalar(item.created_at)}`);
  return lines.join('\n') + '\n';
}

// Auto-promote dedup keys are deterministic per finding (see
// buildQueueItemFromFinding). Keep the shape in one place so the dedup
// scan and the projection can never drift apart.
function dedupKeyForFinding(findingId) {
  return `auto-promote-${findingId}`;
}

// Disk-state dedup scan (FIND-290). Scan queue/ then queue/archive/ for any
// WS-*.yaml whose top-level `dedup_key` matches. Returns the existing WS id
// (e.g. "WS-042") on first match, else null. This is the mechanism the old
// promoteFinding comment *claimed* existed but never did: the in-memory
// finding.promoted_to check alone cannot detect a half-state where WS-N.yaml
// was written but the FIND mutation failed, leaving promoted_to: "" on disk.
// Including archive means a finding whose WS was completed + archived is never
// re-promoted. Match is on dedup_key content (unique per finding), so we scan
// all WS-*.yaml shapes, not just the pure-numeric auto-promote namespace.
function findWsByDedupKey(wsDir, dedupKey) {
  if (!dedupKey) return null;
  const target = String(dedupKey).trim();
  const queueDir = path.join(wsDir, QUEUE_DIRNAME);
  const archiveDir = path.join(queueDir, 'archive');
  const DEDUP_RE = /^dedup_key:\s*"?([^"\n]+?)"?\s*$/m;
  const WS_FILE = /^(WS-.+)\.yaml$/;

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return null;
    for (const f of fs.readdirSync(dir)) {
      const idm = WS_FILE.exec(f);
      if (!idm) continue;
      let text;
      try { text = fs.readFileSync(path.join(dir, f), 'utf8'); }
      catch { continue; }
      const m = DEDUP_RE.exec(text);
      if (m && m[1].trim() === target) return idm[1];
    }
    return null;
  }

  return scanDir(queueDir) || scanDir(archiveDir);
}

// Best-effort durable marker for a permanent FIND-mutation failure. Appended
// as one JSON line to <wsDir>/.reconcile-markers.jsonl so the half-state is
// visible to an operator / future tooling. Uses todayISO() — no new clock
// dependency beyond the one this module already takes for created_at. Never
// throws: a marker write failure must not mask the underlying outcome.
function logReconciliationMarker(wsDir, findingId, wsId, err) {
  try {
    const markerPath = path.join(wsDir, '.reconcile-markers.jsonl');
    const entry = {
      type: 'find_mutation_failed',
      finding_id: findingId,
      ws_id: wsId,
      date: todayISO(),
      error: err ? String(err.message || err) : null,
      note: 'WS file written but finding promoted_to mutation failed; dedup_key scan will heal on next reconcile',
    };
    fs.appendFileSync(markerPath, JSON.stringify(entry) + '\n');
    return { ok: true, path: markerPath };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Mutate a finding's top-level `promoted_to` field to point at wsId, with
// bounded retry (default 3 attempts) to ride out transient EBUSY / AV locks
// on Windows. On permanent failure, logs a reconciliation marker and returns
// ok:false. A missing FIND file is a no-op success (nothing to re-link).
function writeFindingPromotedTo(wsDir, findingId, wsId, opts = {}) {
  const findingPath = path.join(wsDir, FINDINGS_DIRNAME, `${findingId}.yaml`);
  if (!fs.existsSync(findingPath)) {
    return { ok: true, skipped: 'finding_file_absent' };
  }
  const maxAttempts = opts.maxAttempts || 3;
  // Match the promoted_to line in place. Schema says it lives at top level.
  const promotedRe = /^promoted_to:\s*"[^"]*"\s*$/m;
  let lastErr = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      let text = fs.readFileSync(findingPath, 'utf8');
      if (promotedRe.test(text)) {
        text = text.replace(promotedRe, `promoted_to: "${wsId}"`);
      } else {
        // Field missing — append at top level (idempotent for re-runs).
        text = text.trimEnd() + `\npromoted_to: "${wsId}"\n`;
      }
      writeFileAtomic(findingPath, text);
      return { ok: true, attempts: attempt };
    } catch (e) {
      lastErr = e;
    }
  }
  const marker = logReconciliationMarker(wsDir, findingId, wsId, lastErr);
  return {
    ok: false,
    warning: `find_mutation_failed_after_${maxAttempts}: ${lastErr && lastErr.message}`,
    marker,
  };
}

// Write WS-NNN.yaml + mutate the finding's `promoted_to` field. Atomic-ish:
// WS file written first, then FIND file updated. Two safeguards close the
// half-state class (FIND-290), where WS-N.yaml lands but the FIND mutation
// fails, leaving promoted_to: "" on disk:
//   1. Before allocating, a disk dedup_key scan (findWsByDedupKey) detects an
//      already-written WS for this finding and re-links it instead of creating
//      a duplicate — so the *next* reconcile heals the half-state.
//   2. The FIND mutation itself (writeFindingPromotedTo) retries, then logs a
//      reconciliation marker on permanent failure. A FIND failure still
//      returns ok:true because the WS file is the durable artifact.
function promoteFinding(wsDir, finding, opts = {}) {
  if (!finding || !finding.id) {
    return { ok: false, reason: 'finding has no id', finding_id: null };
  }
  if (finding.promoted_to && String(finding.promoted_to).trim().length > 0) {
    return { ok: true, skipped: 'already_promoted', finding_id: finding.id, ws_id: finding.promoted_to };
  }

  // Half-state heal: the in-memory promoted_to may be stale if a prior
  // promotion wrote the WS file but failed to mutate the FIND file. Scan disk
  // for a WS carrying this finding's dedup_key before allocating a new id.
  const dedupKey = dedupKeyForFinding(finding.id);
  const existingWsId = findWsByDedupKey(wsDir, dedupKey);
  if (existingWsId) {
    const relink = writeFindingPromotedTo(wsDir, finding.id, existingWsId, opts);
    return {
      ok: true,
      skipped: 'dedup_existing_ws',
      finding_id: finding.id,
      ws_id: existingWsId,
      relinked: relink.ok,
      ...(relink.ok ? {} : { warning: relink.warning }),
    };
  }

  const wsId = opts.wsId || allocateNextWsId(wsDir);
  const queuePath = path.join(wsDir, QUEUE_DIRNAME, `${wsId}.yaml`);
  if (fs.existsSync(queuePath)) {
    return { ok: false, reason: 'queue_id_collision', finding_id: finding.id, ws_id: wsId };
  }

  const item = buildQueueItemFromFinding(finding, wsId, opts);
  try { writeFileAtomic(queuePath, serializeQueueItem(item)); }
  catch (e) { return { ok: false, reason: `ws_write_failed: ${e.message}`, finding_id: finding.id }; }

  const findResult = writeFindingPromotedTo(wsDir, finding.id, wsId, opts);
  if (!findResult.ok) {
    return {
      ok: true,
      warning: `ws_written_but_find_mutation_failed: ${findResult.warning}`,
      finding_id: finding.id,
      ws_id: wsId,
      ws_path: queuePath,
      marker: findResult.marker,
    };
  }

  return { ok: true, finding_id: finding.id, ws_id: wsId, ws_path: queuePath };
}

// Orchestrator: read all FIND-*.yaml in findings/, gate-check each
// against the auto_promote rules in cwosConfig, dispatch promotions.
// Returns a report: { promoted: [...], skipped: [...], errors: [...] }.
// Pure-ish: relies on filesystem (read + write) and no other I/O.
function promoteOpenFindings(wsDir, cwosConfig, opts = {}) {
  const rules = extractAutoPromoteRules(cwosConfig);
  const findingsDir = path.join(wsDir, FINDINGS_DIRNAME);
  const report = { promoted: [], skipped: [], errors: [] };

  if (!fs.existsSync(findingsDir)) {
    return report;
  }

  const files = fs.readdirSync(findingsDir)
    .filter(f => /^FIND-.+\.yaml$/.test(f))
    .sort();

  for (const f of files) {
    const findingPath = path.join(findingsDir, f);
    const r = readYAMLFile(findingPath);
    if (!r.ok || !r.data) { report.errors.push({ file: f, reason: r.error || 'parse_failed' }); continue; }
    const finding = r.data;

    const status = (finding.status || '').toLowerCase();
    const auditStatus = (finding.source && finding.source.audit_status) || '';
    if (status !== 'open') { report.skipped.push({ id: finding.id, reason: `status_${status || 'unset'}` }); continue; }
    if (finding.promoted_to && String(finding.promoted_to).trim().length > 0) {
      report.skipped.push({ id: finding.id, reason: 'already_promoted', ws_id: finding.promoted_to });
      continue;
    }
    if (NON_PROMOTABLE_STATUSES.has(auditStatus)) {
      report.skipped.push({ id: finding.id, reason: `audit_status_${auditStatus}` });
      continue;
    }
    const proposed = finding.proposed_route || {};
    if (proposed.would_promote_to_queue !== true) {
      report.skipped.push({ id: finding.id, reason: 'proposed_route_does_not_promote' });
      continue;
    }
    const sev = (finding.severity || '').toLowerCase();
    if (!SEVERITY_KEYS.includes(sev)) {
      report.skipped.push({ id: finding.id, reason: `unknown_severity_${sev}` });
      continue;
    }
    if (rules[sev] !== true) {
      report.skipped.push({ id: finding.id, reason: `auto_promote_disabled_for_${sev}` });
      continue;
    }

    // Per-iteration locked scan+write: allocateNextWsId holds the
    // .ws-counter.lock across compute + writer, so a concurrent caller
    // sees the new WS-N.yaml on disk before its own scan returns.
    // Closes FIND-289 / WS-424 race.
    let result;
    try {
      allocateNextWsId(wsDir, {
        writer: (wsId) => {
          result = promoteFinding(wsDir, finding, Object.assign({}, opts, { wsId }));
        }
      });
    } catch (err) {
      report.errors.push({ finding_id: finding.id, reason: `lock_failed: ${err.message}` });
      continue;
    }
    if (result && result.ok && result.skipped) {
      // dedup_existing_ws: disk already had a WS for this finding (half-state
      // heal). Re-linked, not newly promoted — route to skipped so callers
      // don't double-count it as a fresh work item.
      report.skipped.push({ id: finding.id, reason: result.skipped, ws_id: result.ws_id });
    } else if (result && result.ok) {
      report.promoted.push({ finding_id: finding.id, ws_id: result.ws_id, severity: sev });
    } else {
      report.errors.push({ finding_id: finding.id, reason: (result && result.reason) || 'writer_failed' });
    }
  }

  return report;
}

function extractAutoPromoteRules(cwosConfig) {
  const out = { critical: false, high: false, medium: false, low: false };
  if (!cwosConfig || typeof cwosConfig !== 'object') return out;
  const prio = cwosConfig.priority || {};
  const ap = prio.auto_promote || {};
  for (const k of SEVERITY_KEYS) {
    out[k] = isTruthyConfigValue(ap[k]);
  }
  return out;
}

// The cwos-utils YAML parser preserves inline comments as part of the
// scalar value (e.g., `critical: true    # comment` parses as the
// literal string "true    # comment"). Strip trailing comments and
// whitespace, then compare to literal "true". Accepts native booleans
// from properly-quoted YAML.
function isTruthyConfigValue(v) {
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v !== 'string') return false;
  const head = v.split('#')[0].trim().toLowerCase();
  return head === 'true';
}

module.exports = {
  allocateNextWsId,
  buildQueueItemFromFinding,
  serializeQueueItem,
  dedupKeyForFinding,
  findWsByDedupKey,
  writeFindingPromotedTo,
  logReconciliationMarker,
  promoteFinding,
  promoteOpenFindings,
  extractAutoPromoteRules,
  isTruthyConfigValue,
  defaultPriorityForSeverity,
  inferCategoryFromFinding,
  SEVERITY_KEYS,
  NON_PROMOTABLE_STATUSES,
};
