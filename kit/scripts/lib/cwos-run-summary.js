/**
 * cwos-run-summary — write canonical summary.yaml for an engine run (WS-314).
 *
 * Distills a run into a machine-readable digest that future founder questions
 * can read instead of re-running the engine. Sister piece to the WS-305
 * manifest gate: manifest = pre/post contract, summary = founder-facing digest.
 *
 * Schema: see kit/templates/workstream/runs/CANONICAL.md
 *
 * Usage (from a CLI shim or programmatically):
 *   writeRunSummary({ runId, runDir, wsDir, dryRun? })
 *
 * Returns: { ok, summary_path, summary, grandfathered }
 *
 * Always best-effort. Missing manifest, missing artifacts, unparseable
 * markdown — none of these throw. Fields are populated when sources are
 * available, left null otherwise. The summary itself records which
 * sources were consulted under `_provenance`.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const {
  readYAMLFile, serializeYAML, writeFileAtomic, withFileLock,
} = require('./cwos-utils');

// ─── Synthesis.md scrapers ─────────────────────────────────────────────────

function readIfExists(p) {
  try { return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null; }
  catch { return null; }
}

// Walk artifacts/ recursively and return the oldest file mtime (ISO). Returns
// null when artifacts/ is missing or empty. Used as a date fallback for
// grandfathered runs that lack a manifest with started_at/completed_at —
// writing summary.yaml to the run dir updates the dir mtime, so the dir
// itself is no longer a reliable source.
function oldestArtifactMtime(runDir) {
  const artifactsDir = path.join(runDir, 'artifacts');
  if (!fs.existsSync(artifactsDir)) return null;
  let oldestMs = Infinity;
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      try {
        const ms = fs.statSync(p).mtimeMs;
        if (ms < oldestMs) oldestMs = ms;
      } catch { /* skip */ }
    }
  }
  walk(artifactsDir);
  if (!Number.isFinite(oldestMs)) return null;
  return new Date(oldestMs).toISOString();
}

// Walks markdown line-by-line; collects bullet items AND markdown-table data
// rows under any heading whose title matches `headingRe`. Stops at the next
// heading at or above the matched heading's level. Returns up to `limit`
// items, trimmed. Table extraction picks the longest text cell from each row
// (typically the title cell). The header row and `---` separator are skipped.
function collectBulletsUnderHeading(md, headingRe, limit = 10) {
  if (!md) return [];
  const lines = md.split(/\r?\n/);
  const out = [];
  let inSection = false;
  let sectionLevel = 0;
  let tableHeaderSeen = false;

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].trim();
      if (inSection && level <= sectionLevel) {
        if (out.length > 0) return out.slice(0, limit);
        inSection = false;
        tableHeaderSeen = false;
      }
      if (!inSection && headingRe.test(title)) {
        inSection = true;
        sectionLevel = level;
        tableHeaderSeen = false;
      }
      continue;
    }
    if (!inSection) continue;
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      const text = bullet[1].trim();
      if (text) out.push(text);
      if (out.length >= limit) return out;
      continue;
    }
    if (line.trim().startsWith('|')) {
      const cells = line.split('|').map(s => s.trim()).filter(s => s.length > 0);
      if (cells.length === 0) continue;
      if (cells.every(c => /^[-: ]+$/.test(c))) { tableHeaderSeen = true; continue; }
      if (!tableHeaderSeen) continue; // skip header row until separator seen
      // Pick the first non-numeric cell of length ≥ 8 — typically the title
      // column. Skips rank/severity/direction columns; falls back to longest
      // if no good candidate.
      const titleCell = cells.find(c => c.length >= 8 && !/^\d+$/.test(c)) ||
        cells.reduce((a, b) => (b.length > a.length ? b : a), '');
      if (titleCell) out.push(titleCell);
      if (out.length >= limit) return out;
    }
  }
  return out.slice(0, limit);
}

// Picks a 1-line title from a bullet — strips bold markers, trailing periods,
// and (parenthetical) tails. For "**WS-001:** Title (foo)" returns "WS-001: Title".
function shortTitle(bullet) {
  return bullet
    .replace(/\*\*/g, '')
    .replace(/\s*\(([^)]{0,80})\)\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

// ─── Field extractors (each best-effort, never throws) ─────────────────────

function extractTopFindings(runDir) {
  // Prefer phase-3/synthesis.md "Findings" / "Weak points" / "Concerns"
  // section. Fall back to phase-3/briefing.md if synthesis is missing.
  const synthesis = readIfExists(path.join(runDir, 'artifacts', 'phase-3', 'synthesis.md'));
  const briefing = readIfExists(path.join(runDir, 'artifacts', 'phase-3', 'briefing.md'));
  const headingRe = /\b(finding|concern|risk|weak[\s-]?point|issue|severity|top)/i;
  let bullets = collectBulletsUnderHeading(synthesis, headingRe, 8);
  if (bullets.length === 0) bullets = collectBulletsUnderHeading(briefing, headingRe, 8);
  if (bullets.length === 0) return null;
  return bullets.map(shortTitle).filter(Boolean).slice(0, 5);
}

function extractKeyDecisions(runDir) {
  const synthesis = readIfExists(path.join(runDir, 'artifacts', 'phase-3', 'synthesis.md'));
  const briefing = readIfExists(path.join(runDir, 'artifacts', 'phase-3', 'briefing.md'));
  const headingRe = /decision|ruling|recommendation/i;
  let bullets = collectBulletsUnderHeading(synthesis, headingRe, 8);
  if (bullets.length === 0) bullets = collectBulletsUnderHeading(briefing, headingRe, 8);
  if (bullets.length === 0) return null;
  return bullets.map(shortTitle).filter(Boolean).slice(0, 5);
}

function extractWorkItems(manifest, runDir) {
  // Prefer manifest punchlist.phase_4_backlog.ws_ids (canonical when present).
  const phase4 = manifest && manifest.punchlist && manifest.punchlist.phase_4_backlog;
  if (phase4 && Array.isArray(phase4.ws_ids) && phase4.ws_ids.length > 0) {
    return phase4.ws_ids.map(String);
  }
  // Fallback: scrape WS-NNN tokens from artifacts/phase-4/*.{md,yaml}
  const phase4Dir = path.join(runDir, 'artifacts', 'phase-4');
  if (!fs.existsSync(phase4Dir)) return null;
  let entries;
  try { entries = fs.readdirSync(phase4Dir); } catch { return null; }
  const seen = new Set();
  const re = /\bWS-(\d{3,5})\b/g;
  for (const f of entries) {
    if (!/\.(md|yaml|yml|txt)$/i.test(f)) continue;
    const text = readIfExists(path.join(phase4Dir, f));
    if (!text) continue;
    let m;
    while ((m = re.exec(text)) !== null) seen.add(`WS-${m[1]}`);
  }
  if (seen.size === 0) return null;
  return Array.from(seen).sort();
}

function extractAlterations(manifest) {
  const phase2 = manifest && manifest.punchlist && manifest.punchlist.phase_2_cross_critique;
  if (phase2 && phase2.alterations_applied && typeof phase2.alterations_applied === 'object') {
    return phase2.alterations_applied;
  }
  return null;
}

function extractContractAlignment(manifest) {
  if (manifest && manifest.contract_alignment && typeof manifest.contract_alignment === 'object') {
    return manifest.contract_alignment;
  }
  return null;
}

function extractLaunchReadiness(manifest) {
  const phase5 = manifest && manifest.punchlist && manifest.punchlist.phase_5_briefing;
  if (phase5 && phase5.launch_readiness) return String(phase5.launch_readiness);
  return null;
}

// WS-414: verdict + finding_counts extracted from phase-3/briefing.md.
// The briefing convention (since corrective-plan v1, line 4 of briefing.md):
//   **Verdict:** **AMEND** (1 CRITICAL + 3 HIGH + 3 MEDIUM)
// Both fields land on summary.yaml so cwos-skill-telemetry.js can read them
// without re-scraping briefing.md.
function extractVerdict(runDir) {
  const briefingPath = path.join(runDir, 'artifacts', 'phase-3', 'briefing.md');
  const md = readIfExists(briefingPath);
  if (!md) return null;
  const m = md.match(/\*\*Verdict:\*\*\s*\*\*([A-Z]+)\*\*/);
  if (!m) return null;
  return String(m[1]).toLowerCase();
}

function extractFindingCounts(runDir, manifest) {
  // Prefer briefing.md count tail (canonical surface). Fall back to manifest
  // findings_after_synthesis as a total-only signal (severity bucket unknown).
  const briefingPath = path.join(runDir, 'artifacts', 'phase-3', 'briefing.md');
  const md = readIfExists(briefingPath);
  if (md) {
    const tail = md.match(/\*\*Verdict:\*\*\s*\*\*[A-Z]+\*\*\s*\(([^)]+)\)/);
    if (tail) {
      const counts = { critical: 0, high: 0, medium: 0, low: 0 };
      const re = /(\d+)\s*(CRITICAL|HIGH|MEDIUM|LOW)/gi;
      let m;
      let matched = false;
      while ((m = re.exec(tail[1])) !== null) {
        counts[m[2].toLowerCase()] = parseInt(m[1], 10);
        matched = true;
      }
      if (matched) return counts;
    }
  }
  return null;
}

// ─── Main writer ───────────────────────────────────────────────────────────

function writeRunSummary({ runId, runDir, wsDir, dryRun = false }) {
  const manifestPath = path.join(runDir, 'manifest.yaml');
  let manifest = null;
  let manifestParsed = false;
  if (fs.existsSync(manifestPath)) {
    const r = readYAMLFile(manifestPath);
    if (r.ok && r.data) {
      manifest = r.data;
      manifestParsed = true;
    }
  }

  // Date — prefer manifest.completed_at, then started_at, then the OLDEST
  // file mtime under artifacts/ (run-dir mtime is misleading because writing
  // summary.yaml to the dir updates it).
  let dateISO = null;
  if (manifest && manifest.completed_at) dateISO = String(manifest.completed_at);
  else if (manifest && manifest.started_at) dateISO = String(manifest.started_at);
  else dateISO = oldestArtifactMtime(runDir);

  // Determine grandfathered status. Pre-WS-314 runs have no input_state_snapshot.
  const inputStateSnapshot = manifest && manifest.input_state_snapshot
    ? manifest.input_state_snapshot
    : null;
  const grandfathered = !inputStateSnapshot;

  const provenance = {
    manifest_present: !!manifest,
    manifest_parsed: manifestParsed,
    grandfathered,
    written_at: new Date().toISOString(),
    schema_version: 1,
  };

  const summary = {
    run_id: runId,
    engine: (manifest && manifest.engine) || null,
    target: (manifest && manifest.target) || null,
    contract_id: (manifest && manifest.contract_id) || null,
    mode: (manifest && manifest.contract && manifest.contract.mode) || null,
    date: dateISO,
    completed_at: (manifest && manifest.completed_at) || null,
    top_findings: extractTopFindings(runDir),
    work_items_created: extractWorkItems(manifest, runDir),
    key_decisions: extractKeyDecisions(runDir),
    alterations_applied: extractAlterations(manifest),
    contract_alignment: extractContractAlignment(manifest),
    launch_readiness: extractLaunchReadiness(manifest),
    input_state_snapshot: inputStateSnapshot,
    findings_raw_count: (manifest && manifest.findings_raw_count !== undefined)
      ? manifest.findings_raw_count : null,
    findings_after_synthesis: (manifest && manifest.findings_after_synthesis !== undefined)
      ? manifest.findings_after_synthesis : null,
    work_items_count: (manifest && manifest.work_items_to_create !== undefined)
      ? manifest.work_items_to_create : null,
    verdict: extractVerdict(runDir),
    finding_counts: extractFindingCounts(runDir, manifest),
    _provenance: provenance,
  };

  const summaryPath = path.join(runDir, 'summary.yaml');
  if (!dryRun) {
    const yaml = serializeYAML(summary);
    const lockPath = `${summaryPath}.lock`;
    withFileLock(lockPath, () => {
      writeFileAtomic(summaryPath, yaml + (yaml.endsWith('\n') ? '' : '\n'));
    }, { ownerLabel: 'run-summary', maxWaitMs: 10000 });
  }

  return { ok: true, summary_path: summaryPath, summary, grandfathered };
}

module.exports = {
  writeRunSummary,
  // Exposed for tests
  collectBulletsUnderHeading, shortTitle,
  extractTopFindings, extractKeyDecisions,
  extractWorkItems, extractAlterations,
  extractContractAlignment, extractLaunchReadiness,
  extractVerdict, extractFindingCounts,
};
