'use strict';
/**
 * cwos-fleet-harvest.js — turn a returned artifact set into a queue item that demands review.
 *
 * WHY THIS EXISTS, in the founder's words (2026-08-16): "if it's running properly (max
 * utilization) then I won't see it in my normal course of starting sessions."
 *
 * That is the failure this closes, and it is a nasty one because success causes it. A compute
 * job finishing does NOT close its queue item and does NOT announce itself. The better the
 * feeder works, the more results pile up in an inbox nobody opens — a machine burning hours
 * producing evidence that never reaches a decision. The fleet check reports what node1 is
 * DOING; nothing reported what it had FOUND.
 *
 * So: every completed run becomes a review item carrying its own headline. The item is the
 * notification, and it rides the same queue everything else does, which means it shows up in
 * `/next` without the founder having to remember that compute exists.
 *
 * WHAT COUNTS AS COMPLETE. `manifest.missing` must be empty and `files` non-empty. The
 * cancelled duplicate job on 2026-08-16 returned a manifest with `files: []` and two entries
 * in `missing` — harvesting that would have filed a review item for a run that produced
 * nothing, which is worse than filing none.
 */

const fs = require('fs');
const path = require('path');

/** Marker written inside the artifact dir, so the set carries its own harvest status and
 *  there is no separate index to fall out of sync. Mirrors the runner's `.returned.json`. */
const HARVEST_MARKER = '.harvested.json';

/** Read JSON, returning null rather than throwing — a half-written file is not evidence. */
function readJson(f) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
}

/**
 * Identity of a RESULT, as opposed to identity of a JOB.
 *
 * WS-572. Two jobs can produce byte-identical artifacts, and on 2026-08-16 two did:
 * ws-320-48bd185e7587 and ws-320-f6c3e820c448 both emitted `study-ladder.json` at sha
 * 6a1f1d425db8, and each filed its own review item (WS-497 and WS-505). The panel then
 * reported six finished runs waiting to be read when there were four distinct results, in the
 * one place whose entire job is to be an honest count of unread work.
 *
 * The card hash is deliberately excluded from the key: it stamps the engine commit, so two
 * identical analyses run at different commits carry different card hashes while their DATA is
 * the same. Keying on the data is what collapses them.
 */
function contentKeyOf(manifest) {
  const files = (Array.isArray(manifest.files) ? manifest.files : [])
    .filter((f) => !/\.card\.json$/.test(String(f.rel || '')))
    .map((f) => `${f.rel}:${f.sha256}`)
    .sort();
  return files.length ? files.join('|') : null;
}

/**
 * Content keys of results already filed, mapped to the review item that filed them. Read from
 * the harvest markers, so it survives a queue rewrite and needs no separate index.
 */
function harvestedContentKeys(inboxDir) {
  const seen = new Map();
  let entries = [];
  try { entries = fs.readdirSync(inboxDir, { withFileTypes: true }); } catch { return seen; }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(inboxDir, e.name);
    const marker = readJson(path.join(dir, HARVEST_MARKER));
    if (!marker || !marker.review_item) continue;
    const manifest = readJson(path.join(dir, 'manifest.json'));
    if (!manifest) continue;
    const key = contentKeyOf(manifest);
    if (key && !seen.has(key)) seen.set(key, { reviewId: marker.review_item, jobId: marker.job_id || e.name });
  }
  return seen;
}

/**
 * Artifact sets in the inbox that are complete and not yet harvested.
 * @returns {Array<{jobId, dir, manifest, wsId, contentKey}>}
 */
function pendingSets(inboxDir) {
  let entries = [];
  try { entries = fs.readdirSync(inboxDir, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const dir = path.join(inboxDir, e.name);
    if (fs.existsSync(path.join(dir, HARVEST_MARKER))) continue;
    const manifest = readJson(path.join(dir, 'manifest.json'));
    if (!manifest) continue;
    const files = Array.isArray(manifest.files) ? manifest.files : [];
    const missing = Array.isArray(manifest.missing) ? manifest.missing : [];
    if (files.length === 0 || missing.length > 0) continue;   // incomplete — do not file
    // Only queue-driven jobs become review items. The inbox also holds hand-submitted smoke
    // and plumbing jobs (artifact-return-20260815, final-verify-20260815 from the runner's
    // own commissioning) — auto-filing review items for those is noise in the one place that
    // must stay signal, since the whole point is that a review item means "a real result is
    // waiting". Reported as skipped rather than ignored silently.
    const m = /^(ws-\d+)-/i.exec(manifest.jobId || e.name);
    if (!m) { out.push({ jobId: manifest.jobId || e.name, dir, manifest, wsId: null, nonQueue: true }); continue; }
    out.push({
      jobId: manifest.jobId || e.name,
      dir,
      manifest,
      wsId: m[1].toUpperCase(),
      contentKey: contentKeyOf(manifest),
    });
  }
  return out;
}

/**
 * Pull the reportable content out of a returned artifact set.
 *
 * Deliberately conservative about what it claims to understand. Result Cards have a schema
 * this repo guarantees (ADR-009), so those fields are read directly. Everything else is found
 * by a shallow scan for `verdict` objects — present in the study-ladder output, absent in
 * others, and its absence is not an error. The alternative, per-item bespoke extractors,
 * would rot the moment a harness changed its output shape.
 */
function extractHighlights(dir, manifest) {
  const out = { card: null, verdicts: [], files: [] };

  for (const f of manifest.files || []) {
    out.files.push({ rel: f.rel, bytes: f.bytes, sha256: String(f.sha256 || '').slice(0, 12) });
  }

  for (const f of manifest.files || []) {
    const full = path.join(dir, f.rel);
    const j = readJson(full);
    if (!j) continue;

    if (j.resultCardId) {
      const adm = j.admissibility || {};
      out.card = {
        file: f.rel,
        resultCardId: j.resultCardId,
        estimand: String(j.estimand || '').replace(/\s+/g, ' ').trim(),
        admissible: adm.admissible === true,
        blockers: (adm.blockers || []).map((b) => (typeof b === 'string' ? b : (b.code || JSON.stringify(b)))),
        warnings: (adm.warnings || []).map((w) => ({
          code: typeof w === 'string' ? w : (w.code || 'WARNING'),
          detail: String((typeof w === 'string' ? '' : (w.detail || w.message || ''))).replace(/\s+/g, ' ').trim(),
        })),
        engineCommit: (j.manifest || {}).engineCommit || null,
        engineDirty: (j.manifest || {}).engineDirty,
      };
      continue;
    }

    collectVerdicts(j, out.verdicts, f.rel);
  }
  return out;
}

/** Shallow-ish walk for `{verdict, reason}` shapes, capped so a huge artifact cannot blow up. */
function collectVerdicts(node, acc, file, label = '', depth = 0) {
  if (!node || typeof node !== 'object' || depth > 4 || acc.length >= 12) return;
  if (typeof node.verdict === 'string') {
    acc.push({
      file,
      label: label || null,
      verdict: node.verdict,
      reason: String(node.reason || '').replace(/\s+/g, ' ').trim().slice(0, 260),
    });
    return;
  }
  if (node.verdict && typeof node.verdict === 'object' && typeof node.verdict.verdict === 'string') {
    acc.push({
      file,
      label: label || null,
      verdict: node.verdict.verdict,
      reason: String(node.verdict.reason || '').replace(/\s+/g, ' ').trim().slice(0, 260),
    });
    return;
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === 'object') collectVerdicts(v, acc, file, label ? `${label}.${k}` : k, depth + 1);
  }
}

/** YAML-safe single-line scalar. */
const q = (s) => '"' + String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';

/**
 * Compose the review item's YAML.
 *
 * The headline goes in the DESCRIPTION, not just a path to a file. A review item that says
 * "results are in the inbox" is the same dead end as the inbox itself — it moves the
 * not-looking one step later. The founder should be able to decide whether this needs their
 * attention without opening anything.
 */
function buildReviewItem({ reviewId, set, highlights, source, now }) {
  const h = highlights;
  const srcTitle = (source && source.title) || set.wsId || set.jobId;
  const lines = [];

  lines.push(`id: ${q(reviewId)}`);
  lines.push(`title: ${q(`Review the ${set.wsId || set.jobId} run — ${headlineFor(h, srcTitle)}`)}`);
  lines.push('legacy_id: ""');
  lines.push('type: task');
  lines.push('status: backlog');
  lines.push('claimed_by: null');
  lines.push('claimed_at: null');
  lines.push('started_at: null');
  lines.push('completed_at: null');
  lines.push('completion_commit: null');
  // Inherit the source item's priority: a review of an important run is important, and a
  // review that ranks below everything is a result nobody reads.
  lines.push(`priority_score: ${source && source.priority_score ? source.priority_score : 20.0}`);
  lines.push(`priority_label: ${q((source && source.priority_label) || 'P1')}`);
  lines.push(`category: ${q((source && source.category) || 'domain-correctness')}`);
  lines.push('capability: "core"');
  lines.push(`program: ${q((source && source.program) || 'domain-correctness')}`);
  lines.push('finding_id: ""');

  lines.push('description: |');
  lines.push(`  A compute run finished on cm-node1 and its artifacts are back on this machine.`);
  lines.push(`  Nothing else will surface this: finishing a job does not close a queue item, and`);
  lines.push(`  the better the compute node is utilised the less likely these are to be noticed.`);
  lines.push('');
  lines.push(`  SOURCE ITEM : ${set.wsId || '(unknown)'} — ${srcTitle}`);
  lines.push(`  JOB         : ${set.jobId}`);
  lines.push(`  RAN ON      : ${set.manifest.node || 'cm-node1'} @ ${String(set.manifest.commit || '').slice(0, 12)}`);
  lines.push(`  COLLECTED   : ${set.manifest.collectedAt || 'unknown'}`);
  lines.push(`  ARTIFACTS   : ${set.dir}`);
  for (const f of h.files) lines.push(`     - ${f.rel}  (${f.bytes} bytes, sha256 ${f.sha256}…)`);
  lines.push('');

  if (h.card) {
    lines.push('  RESULT CARD');
    lines.push(`     id          : ${h.card.resultCardId}`);
    lines.push(`     admissible  : ${h.card.admissible}`);
    lines.push(`     engine      : ${String(h.card.engineCommit || '').slice(0, 12)}${h.card.engineDirty === false ? ' (clean)' : h.card.engineDirty ? ' (DIRTY — does not identify the code that ran)' : ''}`);
    if (h.card.blockers.length) lines.push(`     BLOCKERS    : ${h.card.blockers.join('; ')}`);
    for (const w of h.card.warnings) {
      lines.push(`     warning ${w.code}:`);
      wrap(w.detail, 84).forEach((l) => lines.push(`       ${l}`));
    }
    lines.push('');
    lines.push('     estimand:');
    wrap(h.card.estimand, 84).forEach((l) => lines.push(`       ${l}`));
    lines.push('');
  }

  if (h.verdicts.length) {
    lines.push('  VERDICTS');
    for (const v of h.verdicts) {
      lines.push(`     ${v.label || v.file}: ${v.verdict}`);
      if (v.reason) wrap(v.reason, 82).forEach((l) => lines.push(`       ${l}`));
    }
    lines.push('');
  }

  if (!h.card && !h.verdicts.length) {
    lines.push('  No Result Card or verdict block was found in the returned artifacts, so the');
    lines.push('  headline could not be extracted automatically. Open the files above.');
    lines.push('');
  }

  lines.push('accept_criteria: |');
  lines.push('  - The artifacts above are read and the finding is recorded where it belongs');
  lines.push('    (docs/research/ addendum, a decision, or a follow-up item) — not left in the inbox.');
  lines.push(`  - ${set.wsId || 'The source item'} is either closed, or its remaining work is stated explicitly.`);
  lines.push('  - Any warning on the Result Card is answered or explicitly accepted, in writing.');
  lines.push('  - If the run needs re-running with different parameters, the compute_job block is');
  lines.push('    edited (which re-keys the job hash and lets the feeder pick it up again).');

  lines.push('effort: "S"');
  lines.push('runs_on: "any"');
  lines.push('files_involved: []');
  lines.push('blocked_by: []');
  lines.push('blocked_by_legacy: []');
  lines.push(`enables: []`);
  lines.push('sprint_id: null');
  lines.push('decision_flags: []');
  lines.push('source:');
  lines.push('  kind: "fleet-compute"');
  lines.push(`  detail: ${q(`auto-filed by cwos-fleet-compute harvest from job ${set.jobId}`)}`);
  lines.push(`created_at: ${q(now)}`);
  lines.push('');
  return lines.join('\n');
}

/** One-line headline for the item title. */
function headlineFor(h, fallback) {
  if (h.card) {
    const sep = h.card.admissible ? 'admissible' : 'NOT admissible';
    const warn = h.card.warnings.length ? `, ${h.card.warnings.length} warning(s)` : '';
    return `${h.card.resultCardId} ${sep}${warn}`;
  }
  if (h.verdicts.length) {
    const counts = {};
    for (const v of h.verdicts) counts[v.verdict] = (counts[v.verdict] || 0) + 1;
    const summary = Object.entries(counts).map(([k, n]) => `${n}× ${k}`).join(', ');
    // A run where EVERY test came back underpowered did not produce a weak answer — it
    // produced no answer, and the reason is usually a defect rather than a sample size.
    // WS-295's first run returned 6× UNDERPOWERED because 200 distinct RNG seeds yielded
    // literally zero variance, which more replicates could never fix. Saying only
    // "6× UNDERPOWERED" in a title invites exactly the wrong response (run it bigger).
    const kinds = Object.keys(counts);
    if (kinds.length === 1 && /UNDERPOWERED|INCONCLUSIVE/i.test(kinds[0])) {
      return `${summary} — the run answered NOTHING, check the instrument before re-running`;
    }
    return summary;
  }
  return String(fallback).slice(0, 60);
}

function wrap(text, width) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const out = [];
  let line = '';
  for (const w of words) {
    if (line && (line.length + 1 + w.length) > width) { out.push(line); line = w; }
    else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

function markHarvested(set, reviewId, now) {
  try {
    fs.writeFileSync(
      path.join(set.dir, HARVEST_MARKER),
      JSON.stringify({ harvested_at: now, review_item: reviewId, job_id: set.jobId }, null, 2),
    );
  } catch { /* the item is already filed; a missing marker only risks a duplicate next run */ }
}

module.exports = {
  HARVEST_MARKER, pendingSets, extractHighlights, buildReviewItem, markHarvested, headlineFor,
  contentKeyOf, harvestedContentKeys,
};
