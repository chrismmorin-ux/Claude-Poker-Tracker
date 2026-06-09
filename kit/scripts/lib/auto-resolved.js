'use strict';

/**
 * auto-resolved.js — WS-310 Phase C writers for findings-feedback.yaml
 * and finding-lifecycle.yaml.
 *
 * When /next done closes a WS that carries a `finding_id`, the resolution
 * implies the finding was useful. This module appends the corresponding
 * entries to the two calibration files and refreshes the content_hash on
 * findings-feedback.yaml via the validator's --update mode.
 *
 * Failures are returned in `result.warnings` (caller decides whether to
 * surface them). Callers should never let a failure here block the
 * item_closed event or sprint_completed boundary signal — cwos-reconcile
 * catches drift on the next pass.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readYAMLFile, writeFileAtomic, withFileLock, resolveEvolutionDir } = require('./cwos-utils');
const { appendEntries: appendFeedbackEntries } = require('../cwos-feedback-capture');

function readFindingMeta(findingsDir, findingId) {
  const fp = path.join(findingsDir, `${findingId}.yaml`);
  if (!fs.existsSync(fp)) return null;
  const r = readYAMLFile(fp);
  if (!r.ok || !r.data) return null;
  return {
    engine: r.data.engine || null,
    run_id: r.data.run_id || null,
    severity: r.data.severity || null,
    created_at: r.data.created_at || null,
  };
}

// Flip the finding's own `status` to resolved when its WS closes. This is the
// core lifecycle close that was missing: without it, findings stay status:open
// after their fix ships, inflate the "ungoverned findings" count, and get
// re-promoted by triage. Idempotent. Never overrides a human-set terminal
// status (dismissed / duplicate) — only open/deferred auto-resolve.
// EOL-preserving: program/finding files are CRLF on Windows.
function resolveFindingStatus(findingsDir, findingId, completedAt, wsId) {
  const fp = path.join(findingsDir, `${findingId}.yaml`);
  if (!fs.existsSync(fp)) return { changed: false, reason: 'not_found' };
  let text = fs.readFileSync(fp, 'utf8');
  const eol = text.includes('\r\n') ? '\r\n' : '\n';
  const m = text.match(/^status:[ \t]*["']?([A-Za-z_-]+)["']?/m);
  const cur = m ? m[1].toLowerCase() : null;
  if (cur === 'resolved') return { changed: false, reason: 'already_resolved' };
  if (cur && cur !== 'open' && cur !== 'deferred') return { changed: false, reason: `status_${cur}` };

  if (m) {
    // `[^\r\n]*` stops before the line ending, leaving CRLF/LF intact.
    text = text.replace(/^status:[^\r\n]*/m, 'status: resolved');
  } else {
    text = text.replace(/\s*$/, '') + eol + 'status: resolved' + eol;
  }
  if (!/^resolved_at:/m.test(text)) {
    text = text.replace(/\s*$/, '') + eol + `resolved_at: "${completedAt}"` + eol;
  }
  if (!/^promoted_to:/m.test(text) && !/^related_work_item:/m.test(text)) {
    text = text.replace(/\s*$/, '') + eol + `promoted_to: "${wsId}"` + eol;
  }
  writeFileAtomic(fp, text);
  return { changed: true };
}

function formatLifecycleEntry(e) {
  const sev = e.severity || 'medium';
  const created = e.created_at || '';
  const promoted = e.promoted_at || created;
  const outcome = e.outcome || 'was_real';
  const value = e.value_delivered || 'medium';
  return [
    `  - finding_id: "${e.finding_id}"`,
    `    engine: "${e.engine || ''}"`,
    `    severity: ${sev}`,
    `    created_at: "${created}"`,
    `    promoted_at: "${promoted}"`,
    `    work_item_id: "${e.work_item_id || ''}"`,
    `    resolved_at: "${e.resolved_at || ''}"`,
    `    outcome: ${outcome}`,
    `    graduated_to: null`,
    `    value_delivered: ${value}`,
  ].join('\n') + '\n';
}

function insertLifecycleEntry(text, entry) {
  const lines = text.split(/\r?\n/);
  let entriesIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (/^entries\s*:/.test(lines[i])) { entriesIdx = i; break; }
  }
  if (entriesIdx === -1) {
    return text.replace(/\s+$/, '') + '\n\nentries:\n' + formatLifecycleEntry(entry) + '\n';
  }

  // Inline empty `entries: []` → convert to multi-line list.
  if (/^entries\s*:\s*\[\s*\]\s*$/.test(lines[entriesIdx])) {
    const body = formatLifecycleEntry(entry).trimEnd();
    lines[entriesIdx] = 'entries:\n' + body;
    return lines.join('\n');
  }

  // Multi-line list. Find the first column-0, non-comment line after entries:
  // (the next top-level key), then back up over blank/comment lines so the
  // new entry inserts immediately after the last list item.
  let appendIdx = lines.length;
  for (let i = entriesIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') continue;
    if (/^\S/.test(line) && !line.startsWith('#')) { appendIdx = i; break; }
  }
  while (
    appendIdx > entriesIdx + 1 &&
    (lines[appendIdx - 1].trim() === '' || lines[appendIdx - 1].trim().startsWith('#'))
  ) {
    appendIdx--;
  }
  return [
    ...lines.slice(0, appendIdx),
    formatLifecycleEntry(entry).trimEnd(),
    '',
    ...lines.slice(appendIdx),
  ].join('\n');
}

function writeAutoResolvedEntries(opts) {
  const {
    rootDir,
    findingId,
    wsId,
    sprintId,
    completedAt,
    feedbackPath,
    lifecyclePath,
    findingsDir,
    validatorPath,
    manifestPath,
    lockPath,
    skipValidator,
  } = opts;

  // WS-421: resolve the calibration dir by scope — docs/evolution/ in HomeBase,
  // .claude/workstream/ in adopted repos (no-op here, where docs/evolution exists).
  const evoDir = resolveEvolutionDir(rootDir);
  const fb = feedbackPath || path.join(evoDir, 'findings-feedback.yaml');
  const lc = lifecyclePath || path.join(evoDir, 'finding-lifecycle.yaml');
  const fnDir = findingsDir || path.join(rootDir, '.claude', 'workstream', 'findings');
  const vp = validatorPath || path.join(rootDir, 'kit', 'scripts', 'cwos-findings-feedback-validate.js');
  // WS-311: shared lockfile mirrors cwos-findings-feedback-validate.js:64
  // and cwos-feedback-capture.js so all three writers serialize.
  const lp = lockPath || path.join(rootDir, '.claude', 'workstream', 'state', 'findings-feedback.lock');
  const lpDir = path.dirname(lp);
  if (!fs.existsSync(lpDir)) fs.mkdirSync(lpDir, { recursive: true });

  const result = {
    ok: true,
    finding_id: findingId,
    feedback_appended: false,
    lifecycle_appended: false,
    hash_updated: false,
    warnings: [],
  };

  const meta = readFindingMeta(fnDir, findingId);
  if (!meta) {
    result.warnings.push(`finding ${findingId} not found at ${fnDir}`);
    result.ok = false;
    return result;
  }

  // 0. Flip the finding's own status to resolved — the lifecycle close that
  // makes the calibration logs below consistent with the finding's own state.
  result.status_resolved = false;
  try {
    const sr = resolveFindingStatus(fnDir, findingId, completedAt, wsId);
    result.status_resolved = sr.changed;
    if (!sr.changed && sr.reason && sr.reason !== 'already_resolved') {
      result.status_note = sr.reason; // e.g. status_dismissed — informational, not a failure
    }
  } catch (e) {
    result.warnings.push(`finding status flip failed: ${e.message}`);
  }

  // 1. findings-feedback.yaml — append auto-resolved entry under shared lock
  // (WS-311: serializes against cwos-feedback-capture and validate --update).
  if (fs.existsSync(fb)) {
    try {
      withFileLock(lp, () => {
        const txt = fs.readFileSync(fb, 'utf8');
        const newEntry = {
          finding_id: findingId,
          engine: meta.engine || 'unknown',
          run_id: meta.run_id || 'unknown',
          signal: 'useful',
          marked_at: completedAt,
          marked_by: 'auto-resolved',
          reason: `${wsId} closed in ${sprintId}; resolution implies finding was useful`,
        };
        const updated = appendFeedbackEntries(txt, [newEntry]);
        writeFileAtomic(fb, updated);
        result.feedback_appended = true;
      }, { ownerLabel: 'auto-resolved:feedback', maxWaitMs: 5000 });
    } catch (e) {
      result.warnings.push(`feedback append failed: ${e.message}`);
    }
  } else {
    result.warnings.push(`findings-feedback.yaml not found at ${fb}`);
  }

  // 2. validator --update — recompute content_hash + bump manifest snapshot.
  // Must run AFTER the feedback append so the validator hashes the new state.
  // The validator subprocess takes its own withFileLock on lp; the lock above
  // has already been released by withFileLock's finally block, so no nesting.
  if (!skipValidator && result.feedback_appended && fs.existsSync(vp)) {
    try {
      const args = [vp, '--update'];
      if (feedbackPath) args.push('--feedback-path', feedbackPath);
      if (manifestPath) args.push('--manifest-path', manifestPath);
      args.push('--lock-path', lp);
      const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
      if (r.status === 0) {
        result.hash_updated = true;
      } else {
        result.warnings.push(
          `validator --update exit ${r.status}: ${(r.stderr || '').trim() || '(no stderr)'}`
        );
      }
    } catch (e) {
      result.warnings.push(`validator spawn failed: ${e.message}`);
    }
  }

  // 3. finding-lifecycle.yaml — append was_real entry.
  if (fs.existsSync(lc)) {
    try {
      const txt = fs.readFileSync(lc, 'utf8');
      const lifecycleEntry = {
        finding_id: findingId,
        engine: meta.engine,
        severity: meta.severity,
        created_at: meta.created_at,
        promoted_at: meta.created_at,
        work_item_id: wsId,
        resolved_at: completedAt,
        outcome: 'was_real',
        value_delivered: 'medium',
      };
      const updated = insertLifecycleEntry(txt, lifecycleEntry);
      writeFileAtomic(lc, updated);
      result.lifecycle_appended = true;
    } catch (e) {
      result.warnings.push(`lifecycle append failed: ${e.message}`);
    }
  } else {
    result.warnings.push(`finding-lifecycle.yaml not found at ${lc}`);
  }

  if (result.warnings.length > 0) result.ok = false;
  return result;
}

module.exports = {
  readFindingMeta,
  resolveFindingStatus,
  formatLifecycleEntry,
  insertLifecycleEntry,
  writeAutoResolvedEntries,
};
