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
const crypto = require('crypto');
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
// Concurrency (WS-424 / FIND-289, closed by WS-574): callers that also
// write the WS file should still pass `opts.writer(wsId)` — the lock then
// spans scan + write, which is the strongest guarantee available. Callers
// that do NOT write now get a reservation instead of an unreserved guess,
// so there is no longer an unsafe way to call this. See
// kit/scripts/lib/id-allocator.js for the mechanics and the other four
// id kinds that share them.
function allocateNextWsId(wsDir, opts = {}) {
  // WS-574: the scan/lock/reserve mechanics moved to lib/id-allocator.js, which
  // implements the same shape for SPR, FIND, INV and ADR ids too. This function
  // is now a thin adapter kept for its existing callers.
  //
  // The unlocked path this used to fall back to is GONE. It was documented as
  // "safe only for single-threaded read-only callers" and the CLI surface used
  // it anyway, which is why `allocate-ws-id` returned the same id on three
  // consecutive invocations with no concurrency involved. A caller that does
  // not write now gets a *reservation* rather than an unreserved guess.
  const { allocateId } = require('./id-allocator');
  return allocateId('ws', {
    wsDir,
    writer: typeof opts.writer === 'function' ? opts.writer : undefined,
    reservedBy: opts.reservedBy,
    ttlMs: opts.ttlMs,
  });
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
    created_by: opts.createdBy || 'auto-promote-via-reconcile',
    severity,
    source_finding: finding.id,
    description,
    recommended_action: recommendedAction,
    dedup_key: `auto-promote-${finding.id}`,
    // WS-540: content fingerprint so a later promotion of a DIFFERENT finding
    // reporting the SAME evidence resolves to this item instead of creating a
    // twin. Null when the evidence is too thin to match on safely.
    ...(evidenceFingerprint(finding) ? { evidence_key: evidenceFingerprint(finding) } : {}),
    // WS-489: source_meta carries engine/run provenance so serializeQueueItem
    // can write a source: mapping with an `engine` key — the reducer's
    // classifySource requires it for source_class: engine-finding.
    ...(opts.source ? { source_meta: opts.source } : {}),
    // WS-489: review: pending marks an auto-promoted item awaiting the
    // founder's batch yes/no in /next. Status stays backlog (no draft
    // status exists in ALLOWED_QUEUE_STATUSES).
    ...(opts.review ? { review: 'pending' } : {}),
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
  if (item.evidence_key) {
    lines.push(`evidence_key: ${formatScalar(item.evidence_key)}`);
  }
  if (item.description) {
    lines.push('description: |');
    for (const ln of String(item.description).split('\n')) {
      lines.push(`  ${ln}`);
    }
  }
  if (item.recommended_action) {
    lines.push(`recommended_action: ${formatScalar(item.recommended_action)}`);
  }
  if (item.review) {
    lines.push(`review: ${formatScalar(item.review)}`);
  }
  const meta = item.source_meta || {};
  lines.push(`source:`);
  lines.push(`  finding_id: ${formatScalar(item.source_finding)}`);
  if (meta.engine) {
    // `engine` key first-matches in classifySource → source_class: engine-finding.
    lines.push(`  engine: ${formatScalar(meta.engine)}`);
  }
  if (meta.run_id) {
    lines.push(`  run_id: ${formatScalar(meta.run_id)}`);
  }
  lines.push(`  promoted_via: ${meta.promoted_via || 'cwos-reconcile auto-promote'}`);
  lines.push(`  promoted_at: ${formatScalar(item.created_at)}`);
  return lines.join('\n') + '\n';
}

// Auto-promote dedup keys are deterministic per finding (see
// buildQueueItemFromFinding). Keep the shape in one place so the dedup
// scan and the projection can never drift apart.
function dedupKeyForFinding(findingId) {
  return `auto-promote-${findingId}`;
}

// ─── Evidence-based dedup (WS-540) ──────────────────────────────────────────
//
// dedup_key is keyed on finding ID, so ONE detector reported under two finding
// IDs produces TWO work items. That is not theoretical: FIND-CA-FS-9 and
// FIND-CA-P2 are a single constitutional-audit detector — WS-512, promoted from
// the first, is literally annotated "[shared detector with P2]" — and they
// yielded WS-512 and WS-513, identical evidence, identical two files, one fix
// clearing both. Both sat in kit-quality's capped backlog until a human read
// them side by side on 2026-07-26.
//
// The fingerprint is deliberately conservative. A false merge silently swallows
// a real finding, which is far worse than a duplicate, so:
//   - only the evidence/description body is hashed, never the title (two
//     detectors legitimately describe the same evidence differently)
//   - trivially short bodies never dedup — too little signal to be sure
//   - the surviving item records the absorbed finding id rather than dropping
//     it, so the second detector remains traceable and re-verifiable
const MIN_EVIDENCE_LEN_FOR_DEDUP = 60;

function evidenceFingerprint(finding) {
  const body = [finding.evidence, finding.description]
    .filter(v => typeof v === 'string' && v.trim())
    .join('\n');
  if (!body) return null;
  const normalized = body
    .toLowerCase()
    // Detector-specific ids differ between the two findings for the same
    // evidence ("--only FS-9" vs "--only P2"); strip them so they do not
    // defeat the match.
    .replace(/\bfind-[a-z0-9-]+\b/g, '')
    .replace(/\bws-[a-z0-9-]+\b/g, '')
    .replace(/\[shared detector[^\]]*\]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  if (normalized.length < MIN_EVIDENCE_LEN_FOR_DEDUP) return null;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 16);
}

// Scan queue/ + archive/ for an item carrying this evidence fingerprint.
// Returns { wsId, findingId } on match, else null.
function findWsByEvidenceKey(wsDir, evidenceKey) {
  if (!evidenceKey) return null;
  const queueDir = path.join(wsDir, QUEUE_DIRNAME);
  const archiveDir = path.join(queueDir, 'archive');
  const EV_RE = /^evidence_key:\s*"?([^"\n]+?)"?\s*$/m;
  const FIND_RE = /^source_finding:\s*"?([^"\n]+?)"?\s*$/m;
  const WS_FILE = /^(WS-.+)\.yaml$/;

  function scanDir(dir) {
    if (!fs.existsSync(dir)) return null;
    for (const f of fs.readdirSync(dir)) {
      const idm = WS_FILE.exec(f);
      if (!idm) continue;
      let text;
      try { text = fs.readFileSync(path.join(dir, f), 'utf8'); }
      catch { continue; }
      const m = EV_RE.exec(text);
      if (m && m[1].trim() === evidenceKey) {
        const fm = FIND_RE.exec(text);
        return { wsId: idm[1], findingId: fm ? fm[1].trim() : null };
      }
    }
    return null;
  }

  return scanDir(queueDir) || scanDir(archiveDir);
}

// Record on the surviving item that a second finding reports the same evidence.
// Append-only and idempotent — never rewrites existing content.
function recordAbsorbedFinding(wsDir, wsId, findingId) {
  const queueDir = path.join(wsDir, QUEUE_DIRNAME);
  for (const dir of [queueDir, path.join(queueDir, 'archive')]) {
    const p = path.join(dir, `${wsId}.yaml`);
    if (!fs.existsSync(p)) continue;
    try {
      const raw = fs.readFileSync(p, 'utf8');
      if (raw.includes(`also_satisfies_finding`) && raw.includes(findingId)) {
        return { ok: true, noop: true };
      }
      const note =
        `\nalso_satisfies_finding: "${findingId}"` +
        `\nabsorbed_note: "${findingId} reports the same evidence as this item's source finding; ` +
        `one fix clears both. Re-verify BOTH detectors after fixing (WS-540 evidence dedup)."\n`;
      fs.writeFileSync(p, raw.trimEnd() + note);
      return { ok: true, path: p };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: 'ws file not found' };
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

  // WS-540: second dedup pass, keyed on evidence rather than finding id. The
  // id-based scan above cannot catch one detector reported under two finding
  // ids — the FIND-CA-FS-9 / FIND-CA-P2 case that produced WS-512 and WS-513.
  // Opt-out via opts.skipEvidenceDedup for callers that genuinely want one item
  // per finding id regardless of overlap.
  const evidenceKey = opts.skipEvidenceDedup ? null : evidenceFingerprint(finding);
  if (evidenceKey) {
    const twin = findWsByEvidenceKey(wsDir, evidenceKey);
    if (twin && twin.wsId) {
      // Point this finding at the existing item and record the overlap on it,
      // so the second detector stays traceable instead of disappearing.
      const relink = writeFindingPromotedTo(wsDir, finding.id, twin.wsId, opts);
      const noted = recordAbsorbedFinding(wsDir, twin.wsId, finding.id);
      return {
        ok: true,
        skipped: 'dedup_shared_evidence',
        finding_id: finding.id,
        ws_id: twin.wsId,
        twin_finding_id: twin.findingId,
        evidence_key: evidenceKey,
        relinked: relink.ok,
        absorbed_recorded: noted.ok,
        note:
          `${finding.id} reports the same evidence as ${twin.findingId || 'the existing item\'s finding'}; ` +
          `promoted to ${twin.wsId} instead of a second work item. One fix clears both — re-verify both detectors.`,
        ...(relink.ok ? {} : { warning: relink.warning }),
      };
    }
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

// WS-489 conversion bridge — run-scoped orchestrator invoked at engine-run
// close (cwos-engine-complete emitForRun) and via the promote-findings heal
// CLI. Deliberately narrower gates than promoteOpenFindings: no
// proposed_route requirement and no .cwos-config.yaml gate, because run
// scoping already bounds the blast radius to the closing run's findings —
// it can never flood the queue with the legacy open-finding backlog.
//
// Reads FIND files from disk, not findings-index.yaml (the index drops
// run_id and promoted_to). Accepts both run_id shapes (top-level and
// source.run_id) and lowercases severity/status, mirroring the join in
// cwos-reconcile.js validateFindingPromotion.
//
// Never throws. Per-finding failures accumulate in `errors`; only an
// unusable input (missing runId, unreadable findings dir) returns ok: false.
function promoteRunFindings(wsDir, opts = {}) {
  const runId = opts.runId;
  const engineId = opts.engineId || 'unknown';
  const severities = (opts.severities || ['critical', 'high']).map(s => String(s).toLowerCase());
  const dryRun = !!opts.dryRun;
  const report = {
    ok: true,
    run_id: runId || null,
    engine_id: engineId,
    promoted: [],
    skipped: [],
    errors: [],
    medium: [],
    counts: {
      total_run_findings: 0,
      eligible: 0,
      promoted: 0,
      already_linked: 0,
      errors: 0,
      conversion_rate: null,
    },
  };
  if (!runId) {
    report.ok = false;
    report.error = 'runId required';
    return report;
  }

  const findingsDir = path.join(wsDir, FINDINGS_DIRNAME);
  let files = [];
  try {
    if (fs.existsSync(findingsDir)) {
      files = fs.readdirSync(findingsDir).filter(f => /^FIND-.+\.yaml$/.test(f)).sort();
    }
  } catch (e) {
    report.ok = false;
    report.error = `findings_dir_unreadable: ${e.message}`;
    return report;
  }

  for (const f of files) {
    const r = readYAMLFile(path.join(findingsDir, f));
    // Unparseable findings can't be run-matched; Phase 2k reconcile reports them.
    if (!r.ok || !r.data) continue;
    const finding = r.data;
    const findingRunId = String(finding.run_id || (finding.source && finding.source.run_id) || '').trim();
    if (findingRunId !== runId) continue;

    report.counts.total_run_findings += 1;
    const status = (finding.status || '').toLowerCase();
    const sev = (finding.severity || '').toLowerCase();
    const promotedTo = finding.promoted_to && String(finding.promoted_to).trim();

    if (promotedTo) {
      report.counts.already_linked += 1;
      report.skipped.push({ finding_id: finding.id, reason: 'already_promoted', ws_id: promotedTo });
      continue;
    }
    if (status !== 'open') {
      report.skipped.push({ finding_id: finding.id, reason: `status_${status || 'unset'}` });
      continue;
    }
    const auditStatus = (finding.source && finding.source.audit_status) || '';
    if (NON_PROMOTABLE_STATUSES.has(auditStatus)) {
      report.skipped.push({ finding_id: finding.id, reason: `audit_status_${auditStatus}` });
      continue;
    }
    if (!severities.includes(sev)) {
      if (sev === 'medium') {
        // Surfaced in the close briefing, never queued.
        report.medium.push({ finding_id: finding.id, title: finding.title || '', severity: sev });
      } else {
        report.skipped.push({
          finding_id: finding.id,
          reason: SEVERITY_KEYS.includes(sev)
            ? `severity_below_threshold_${sev}`
            : `unknown_severity_${sev || 'unset'}`,
        });
      }
      continue;
    }

    report.counts.eligible += 1;
    if (dryRun) {
      report.promoted.push({ finding_id: finding.id, ws_id: null, severity: sev, would_promote: true });
      continue;
    }

    // Locked scan+write, same pattern as promoteOpenFindings (FIND-289 race).
    let result;
    try {
      allocateNextWsId(wsDir, {
        writer: (wsId) => {
          result = promoteFinding(wsDir, finding, {
            wsId,
            today: opts.today,
            createdBy: 'engine-run-bridge',
            source: { engine: engineId, run_id: runId, promoted_via: 'engine-run-close' },
            review: true,
          });
        }
      });
    } catch (err) {
      report.errors.push({ finding_id: finding.id, reason: `lock_failed: ${err.message}` });
      continue;
    }
    if (result && result.ok && result.skipped) {
      // dedup_existing_ws: disk already had a WS for this finding (half-state
      // heal) — relinked, counts as already_linked, not a fresh promotion.
      report.counts.already_linked += 1;
      report.skipped.push({ finding_id: finding.id, reason: result.skipped, ws_id: result.ws_id });
    } else if (result && result.ok) {
      report.promoted.push({ finding_id: finding.id, ws_id: result.ws_id, severity: sev });
      if (typeof opts.emitEvent === 'function') {
        // Mandatory on the live path: the T6 reducer only rematerializes
        // state/queue.json on events — no event leaves /next blind (INV-031).
        try {
          opts.emitEvent('T6:workstream', 'finding-promoted', {
            finding_id: finding.id,
            ws_id: result.ws_id,
            severity: sev,
            run_id: runId,
            engine_id: engineId,
            promoted_via: 'engine-run-close',
          });
        } catch { /* emitter failures never block promotion */ }
      }
    } else {
      report.errors.push({ finding_id: finding.id, reason: (result && result.reason) || 'writer_failed' });
    }
  }

  report.counts.promoted = report.promoted.length;
  if (report.counts.total_run_findings > 0) {
    report.counts.conversion_rate = Math.round(
      ((report.counts.promoted + report.counts.already_linked) / report.counts.total_run_findings) * 100
    ) / 100;
  }

  if (!dryRun && report.promoted.length > 0) {
    // Keep queue-index.yaml honest without depending on a follow-up
    // reconcile — the sweep and heal-CLI paths have none. Lazy require
    // avoids a load-order cycle (reconcile-core does not require this lib).
    try {
      const { rebuildQueueIndex } = require('./cwos-reconcile-core');
      rebuildQueueIndex(wsDir);
    } catch (e) {
      report.errors.push({ file: 'queue-index.yaml', reason: `index_rebuild_failed: ${e.message}` });
    }
  }
  report.counts.errors = report.errors.length;

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
  evidenceFingerprint,
  findWsByEvidenceKey,
  recordAbsorbedFinding,
  MIN_EVIDENCE_LEN_FOR_DEDUP,
  writeFindingPromotedTo,
  logReconciliationMarker,
  promoteFinding,
  promoteOpenFindings,
  promoteRunFindings,
  extractAutoPromoteRules,
  isTruthyConfigValue,
  defaultPriorityForSeverity,
  inferCategoryFromFinding,
  SEVERITY_KEYS,
  NON_PROMOTABLE_STATUSES,
};
