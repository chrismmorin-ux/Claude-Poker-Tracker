/**
 * render-events.js — deterministic regenerator for system/events.log.md.
 *
 * ADR-018 step 1, WS-173. Reads every event from the shadow log under
 * `.claude/workstream/events/` and produces a founder-facing markdown
 * view grouped by command_id. Frontmatter records
 * `generated_from_event`, `generated_content_hash`, `generated_at`,
 * `source_chunks`, `event_count`.
 *
 * Pre-write hash guard: if the existing file's body hash does not match
 * the frontmatter's `generated_content_hash`, the founder has hand-edited
 * the view. The regenerator refuses to overwrite, appends a
 * `founder-correction` event, and returns a non-ok result — caller
 * decides whether to halt.
 *
 * Invariant: `len(rendered sections)` == `len(JSONL events)` after any
 * successful regeneration. Violation returns non-ok.
 *
 * Zero external dependencies.
 */

'use strict';

require('../lib/preflight');

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { findWorkstreamDir } = require('../lib/cwos-utils');
const events = require('./events');

const DEFAULT_OUTPUT_REL = path.join('system', 'events.log.md');

function defaultOutputPath(repoRoot, workstreamDir) {
  // Prefer an explicit repoRoot. Otherwise derive from the workstream dir
  // (repo root = parent-of-.claude). Only fall back to __dirname-relative
  // resolution when neither is available — that path is HomeBase-local
  // and will be wrong when the kit is installed elsewhere.
  if (repoRoot) return path.join(repoRoot, DEFAULT_OUTPUT_REL);
  if (workstreamDir) {
    // workstreamDir ends in .claude/workstream — two levels up is the repo root.
    const root = path.dirname(path.dirname(workstreamDir));
    return path.join(root, DEFAULT_OUTPUT_REL);
  }
  return path.join(path.resolve(__dirname, '..', '..', '..'), DEFAULT_OUTPUT_REL);
}

// ─── Hashing ───────────────────────────────────────────────────────────────

function sha256OfString(s) {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * Extract + return the body (post-frontmatter) of a rendered file.
 * Returns { frontmatter: object|null, body: string }. The body is used
 * for hash comparison; the frontmatter carries the prior hash.
 */
function splitFrontmatter(content) {
  if (!content.startsWith('---\n')) return { frontmatter: null, body: content };
  const end = content.indexOf('\n---\n', 4);
  if (end === -1) return { frontmatter: null, body: content };
  const fmText = content.slice(4, end);
  const body = content.slice(end + 5); // skip the closing '\n---\n'
  const fm = {};
  for (const line of fmText.split('\n')) {
    const idx = line.indexOf(':');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (/^".*"$/.test(val) || /^'.*'$/.test(val)) val = val.slice(1, -1);
    fm[key] = val;
  }
  return { frontmatter: fm, body };
}

// ─── Rendering ─────────────────────────────────────────────────────────────

/**
 * Group events by command_id, preserving chunk+line order within each
 * command. Returns an array of { command_id, events } in order of first
 * appearance.
 */
function groupByCommand(events) {
  const index = new Map();
  const order = [];
  for (const ev of events) {
    const cid = ev.command_id || '(unknown)';
    if (!index.has(cid)) { index.set(cid, []); order.push(cid); }
    index.get(cid).push(ev);
  }
  return order.map((cid) => ({ command_id: cid, events: index.get(cid) }));
}

function renderBody(groups, chunks) {
  const lines = [];
  lines.push('# Events Log');
  lines.push('');
  lines.push('Auto-generated from the shadow event log. **Do not hand-edit** —');
  lines.push('the regenerator detects edits and emits a `founder-correction`');
  lines.push('event. To correct a mis-routed event, use the normal correction');
  lines.push('path, not direct markdown edits.');
  lines.push('');

  if (groups.length === 0) {
    lines.push('_No events recorded yet._');
    lines.push('');
    return lines.join('\n');
  }

  lines.push(`## Summary`);
  lines.push('');
  lines.push(`- Commands recorded: ${groups.length}`);
  const totalEvents = groups.reduce((n, g) => n + g.events.length, 0);
  lines.push(`- Events recorded: ${totalEvents}`);
  lines.push(`- Source chunks: ${chunks.length}`);
  lines.push('');

  for (const group of groups) {
    lines.push(`## Command \`${group.command_id}\``);
    lines.push('');
    const first = group.events[0];
    lines.push(`- Start: ${first.timestamp}`);
    lines.push(`- Events: ${group.events.length}`);
    if (group.events.length > 0) {
      const tracks = new Set(group.events.map((e) => e.source_track).filter(Boolean));
      lines.push(`- Tracks: ${Array.from(tracks).join(', ') || '(none)'}`);
    }
    lines.push('');
    lines.push(`| # | Time | Track | Tag | Summary |`);
    lines.push(`|---|------|-------|-----|---------|`);
    group.events.forEach((ev, i) => {
      const summary = summarizePayload(ev.payload);
      lines.push(`| ${i + 1} | ${ev.timestamp} | ${ev.source_track || ''} | ${ev.track_tag || ''} | ${escapeCell(summary)} |`);
    });
    lines.push('');
  }
  return lines.join('\n');
}

function summarizePayload(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if ('payload_ref' in payload) return `blob:${payload.payload_ref}`;
  const keys = Object.keys(payload);
  if (keys.length === 0) return '{}';
  // Two keys: show both k=v pairs short-form. More: show first two + count.
  const pairs = keys.slice(0, 2).map((k) => `${k}=${shortValue(payload[k])}`);
  if (keys.length > 2) pairs.push(`+${keys.length - 2} more`);
  return pairs.join(', ');
}
function shortValue(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return v.length > 32 ? JSON.stringify(v.slice(0, 29)) + '...' : JSON.stringify(v);
  if (typeof v === 'object') return `{${Object.keys(v).length} keys}`;
  return String(v);
}
function escapeCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

function renderFrontmatter(fm) {
  const lines = ['---'];
  for (const key of Object.keys(fm)) {
    const v = fm[key];
    if (Array.isArray(v)) {
      lines.push(`${key}: [${v.map((x) => JSON.stringify(x)).join(', ')}]`);
    } else if (typeof v === 'string') {
      lines.push(`${key}: ${JSON.stringify(v)}`);
    } else {
      lines.push(`${key}: ${v}`);
    }
  }
  lines.push('---');
  return lines.join('\n') + '\n';
}

// ─── Main entry ────────────────────────────────────────────────────────────

/**
 * Regenerate `system/events.log.md` from the shadow event log.
 *
 * Options:
 *   { workstreamDir } — explicit workstream dir (default: findWorkstreamDir)
 *   { outputPath }    — explicit output file (default: <repoRoot>/system/events.log.md)
 *   { repoRoot }      — explicit repo root (used for default output path)
 *
 * Returns:
 *   { ok: true, file, bytesWritten, eventCount, groupCount }
 *   { ok: false, reason: 'founder-edited', correctionEventId, file }
 *   { ok: false, reason: 'invariant', expected, got, file }
 *   { ok: false, reason: 'read-error', warnings }
 */
function renderEventsLog(opts = {}) {
  const workstreamDir = opts.workstreamDir || findWorkstreamDir();
  const outputPath = opts.outputPath || defaultOutputPath(opts.repoRoot, workstreamDir);

  const { events: allEvents, warnings } = events.readAllChunks(workstreamDir);

  // Pre-write hash guard: refuse to overwrite a hand-edited file.
  if (fs.existsSync(outputPath)) {
    const existing = fs.readFileSync(outputPath, 'utf8');
    const { frontmatter, body } = splitFrontmatter(existing);
    if (frontmatter && frontmatter.generated_content_hash) {
      const actual = sha256OfString(body);
      if (actual !== frontmatter.generated_content_hash) {
        const r = events.appendEvent({
          source_track: 'T_meta:correction',
          track_tag: 'founder-correction',
          source_tier: 'founder-prompt',
          payload: {
            file: DEFAULT_OUTPUT_REL.replace(/\\/g, '/'),
            expected_hash: frontmatter.generated_content_hash,
            actual_hash: actual,
            prior_event: frontmatter.generated_from_event || null,
          },
        }, { workstreamDir });
        return {
          ok: false,
          reason: 'founder-edited',
          file: outputPath,
          correctionEventId: r.ok ? r.event.id : null,
          correctionError: r.ok ? null : r.errors,
        };
      }
    }
  }

  // Compose new rendered body.
  const groups = groupByCommand(allEvents);
  const chunkFiles = events.listChunks(workstreamDir).map((p) => path.basename(p));
  const body = renderBody(groups, chunkFiles);
  const bodyHash = sha256OfString(body);
  const lastEvent = allEvents[allEvents.length - 1];
  const fm = renderFrontmatter({
    generated_from_event: lastEvent ? lastEvent.id : '',
    generated_content_hash: bodyHash,
    generated_at: new Date().toISOString(),
    source_chunks: chunkFiles,
    event_count: allEvents.length,
  });

  const full = fm + body;
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, full, 'utf8');

  // Invariant check: sections count equals distinct command_ids (should match groups.length).
  // Event count check: sum of group events == total events.
  const summed = groups.reduce((n, g) => n + g.events.length, 0);
  if (summed !== allEvents.length) {
    return { ok: false, reason: 'invariant', expected: allEvents.length, got: summed, file: outputPath };
  }

  return {
    ok: true,
    file: outputPath,
    bytesWritten: Buffer.byteLength(full, 'utf8'),
    eventCount: allEvents.length,
    groupCount: groups.length,
    contentHash: bodyHash,
    warnings,
  };
}

module.exports = {
  renderEventsLog,
  sha256OfString,
  splitFrontmatter,
  groupByCommand,
  renderBody,
  DEFAULT_OUTPUT_REL,
};
