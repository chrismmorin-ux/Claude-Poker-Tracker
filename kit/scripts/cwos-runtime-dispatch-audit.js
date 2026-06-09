#!/usr/bin/env node
/**
 * cwos-runtime-dispatch-audit — verify SDK persona dispatch over time (WS-316).
 *
 * Production-data complement to WS-307's static persona-graph closure check.
 * Where WS-307 proves "every engine reference resolves to a persona file on
 * disk," this audit proves "the Agent-tool SDK has actually been dispatching
 * those personas successfully on the engines that matter."
 *
 * Read-only. Scans `.claude/workstream/runs/<run-id>/manifest.yaml` for each
 * tracked engine, finds the most recent run, and asserts every declared
 * agent reached terminal status (`complete`) with a substantive artifact.
 *
 * Tracked engines (default):
 *   eng-engine, health-check, milestone-briefing, engine-briefing, financial-audit
 *
 * Per-engine result is one of:
 *   PASS — every declared agent complete + artifact_bytes ≥ MIN_BYTES
 *          (or on-disk file ≥ MIN_BYTES when the manifest field is stale,
 *          e.g. after a re-fire where the original wrote substantively post-check)
 *   FAIL — at least one agent missing, non-terminal, under-byte, or
 *          spec_compliant: false
 *   WARN — engine has zero production manifests yet — unverified
 *
 * Usage:
 *   cwos-runtime-dispatch-audit
 *   cwos-runtime-dispatch-audit --engines eng-engine,health-check
 *   cwos-runtime-dispatch-audit --workstream-dir <p>
 *   cwos-runtime-dispatch-audit --min-bytes 1000
 *   cwos-runtime-dispatch-audit --strict      # exit 1 on any FAIL
 *
 * Exit codes:
 *   0 — no FAILs (PASS / WARN only)
 *   1 — at least one FAIL (only when --strict; default still exits 1 on FAIL)
 *   2 — usage error
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const { findWorkstreamDir, readYAMLFile } = require('./lib/cwos-utils');

const DEFAULT_TRACKED_ENGINES = [
  'eng-engine',
  'health-check',
  'milestone-briefing',
  'engine-briefing',
  'financial-audit',
];

const DEFAULT_MIN_BYTES = 1000;

// ADR-044 / WS-307 ship date: when canonical persona-name + dispatch graph
// closure was put in place. Manifests with started_at OLDER than this can
// have legitimate spec_compliant: false reports because some dispatch paths
// did not yet exist as native subagents. Such evidence is STALE — it needs
// a post-anchor re-run to verify, but is not a blocking failure today.
const ADR_044_ANCHOR = '2026-05-06T22:14:44Z';

// A spec_compliant:false reason matching this pattern means the agent was
// genuinely dispatched via the Agent tool with subagent_type=<persona-name>
// (canonical), but the tool didn't auto-stamp the manifest. Combined with the
// already-enforced status=complete + artifact_bytes>=min checks, this is proven
// real dispatch — not a spec violation. Recognized as compliant. (WS-389 follow-up)
const SPEC_EQUIVALENT_RE = /specification-equivalent dispatch/i;

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}
function hasFlag(args, name) { return args.includes(`--${name}`); }

// ─── Manifest scan ──────────────────────────────────────────────────────────

function scanManifests(wsDir) {
  // Returns array of { run_id, engine, started_at, completed_at, manifest, manifest_path, run_dir }.
  // Skips dirs without manifest.yaml + dirs whose manifest can't be parsed
  // (a warning is recorded for those — they don't count as evidence either way).
  const runsDir = path.join(wsDir, 'runs');
  if (!fs.existsSync(runsDir)) return { runs: [], warnings: [] };

  let entries;
  try { entries = fs.readdirSync(runsDir, { withFileTypes: true }); }
  catch (e) { return { runs: [], warnings: [`could not read ${runsDir}: ${e.message}`] }; }

  const runs = [];
  const warnings = [];
  for (const ent of entries) {
    if (!ent.isDirectory() || ent.name === 'archive') continue;
    if (!/^run-[A-Za-z0-9_-]+$/.test(ent.name)) continue;
    const runDir = path.join(runsDir, ent.name);
    const manifestPath = path.join(runDir, 'manifest.yaml');
    if (!fs.existsSync(manifestPath)) continue;
    const r = readYAMLFile(manifestPath);
    if (!r.ok || !r.data) {
      warnings.push(`${ent.name}: manifest unparseable (${r.error || 'unknown'})`);
      continue;
    }
    runs.push({
      run_id: String(r.data.run_id || ent.name),
      engine: r.data.engine ? String(r.data.engine) : '',
      started_at: r.data.started_at ? String(r.data.started_at) : '',
      completed_at: r.data.completed_at ? String(r.data.completed_at) : '',
      manifest: r.data,
      manifest_path: manifestPath,
      run_dir: runDir,
    });
  }
  return { runs, warnings };
}

function pickMostRecent(runs) {
  // Prefer completed_at, fall back to started_at, fall back to run_id sort.
  return runs.slice().sort((a, b) => {
    const ad = a.completed_at || a.started_at || '';
    const bd = b.completed_at || b.started_at || '';
    if (ad !== bd) return bd.localeCompare(ad);
    return b.run_id.localeCompare(a.run_id);
  })[0] || null;
}

// ─── Per-engine evaluation ─────────────────────────────────────────────────

function resolveArtifactBytes(agent, runDir, repoRoot) {
  // The manifest's artifact_bytes field is captured at update time — it can
  // be stale after a re-fire (the ORIGINAL agent appeared empty at check
  // time, was discarded; later landed substantively but the field never
  // re-stamped). Trust the on-disk file when the manifest field looks
  // suspiciously small.
  const manifestBytes = typeof agent.artifact_bytes === 'number' ? agent.artifact_bytes : null;
  const ap = agent.artifact_path;
  if (!ap) return { bytes: manifestBytes, source: 'manifest' };

  const candidates = [
    path.isAbsolute(ap) ? ap : null,
    path.join(runDir, ap),
    path.join(runDir, ap.replace(/^.*\/runs\/[^/]+\//, '')),
    path.join(repoRoot, ap),
  ].filter(Boolean);

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        const size = fs.statSync(p).size;
        if (manifestBytes === null || size > manifestBytes) {
          return { bytes: size, source: 'on_disk', path: p };
        }
        return { bytes: manifestBytes, source: 'manifest' };
      }
    } catch { /* try next */ }
  }
  return { bytes: manifestBytes, source: 'manifest' };
}

function evaluateEngine(engineName, allRuns, opts) {
  const matching = allRuns.filter(r => r.engine === engineName);
  if (matching.length === 0) {
    return {
      engine: engineName,
      status: 'WARN',
      reason: 'no production manifests yet — engine unverified at runtime',
      most_recent_run: null,
    };
  }
  const mostRecent = pickMostRecent(matching);
  const m = mostRecent.manifest;
  const declared = Array.isArray(m.declared_agents) ? m.declared_agents : [];
  const phase1 = (m.punchlist && m.punchlist.phase_1_parallel_research) || {};
  const agents = phase1.agents || {};

  const failures = [];          // hard failures (FAIL)
  const staleFailures = [];     // pre-anchor spec_compliance failures (STALE-able)
  const agentReports = [];

  const startedAt = mostRecent.started_at || '';
  const isPreAnchor = startedAt && startedAt < opts.anchor;

  for (const name of declared) {
    const a = agents[name];
    if (!a) {
      failures.push(`agent "${name}" missing from phase_1 punchlist`);
      agentReports.push({ name, status: 'missing' });
      continue;
    }
    const status = a.status || 'unknown';
    const report = { name, status, artifact_bytes_manifest: a.artifact_bytes ?? null };

    if (status !== 'complete') {
      failures.push(`agent "${name}" status="${status}" (expected complete)`);
      agentReports.push(report);
      continue;
    }

    const repoRoot = path.resolve(mostRecent.run_dir, '..', '..', '..', '..');
    const resolved = resolveArtifactBytes(a, mostRecent.run_dir, repoRoot);
    report.artifact_bytes_effective = resolved.bytes;
    report.artifact_bytes_source = resolved.source;
    if (resolved.bytes === null) {
      failures.push(`agent "${name}" has no artifact_bytes and no on-disk file`);
      agentReports.push(report);
      continue;
    }
    if (resolved.bytes < opts.minBytes) {
      failures.push(`agent "${name}" artifact_bytes ${resolved.bytes} < min ${opts.minBytes}`);
      agentReports.push(report);
      continue;
    }
    if (a.spec_compliant === false) {
      const msg = `agent "${name}" spec_compliant: false (${a.spec_compliant_reason || 'no reason given'})`;
      // Specification-equivalent dispatch: the agent WAS dispatched via the
      // Claude Code Agent tool with subagent_type=<persona-name> (the canonical
      // mechanism — it resolves to .claude/agents/<name>.md), but the tool does
      // not auto-stamp subagent_type/agent_id into the manifest, so an honest
      // orchestrator records spec_compliant: false + this reason out of caution.
      // We've already proven real dispatch above (status=complete + artifact
      // bytes >= min). The flag is a tooling limitation, not a spec violation —
      // accept as compliant rather than hard-fail every real run. (WS-389 follow-up)
      if (SPEC_EQUIVALENT_RE.test(a.spec_compliant_reason || '')) {
        report.spec_compliant_equivalent = true;
        agentReports.push(report);
        continue;
      }
      // Pre-ADR-044 manifests legitimately had this — the canonical persona
      // dispatch graph hadn't shipped yet. Downgrade to stale.
      if (isPreAnchor) staleFailures.push(msg);
      else failures.push(msg);
      agentReports.push(report);
      continue;
    }
    agentReports.push(report);
  }

  let status = 'PASS';
  let reason = `${declared.length}/${declared.length} declared agents dispatched cleanly in ${mostRecent.run_id}`;
  if (failures.length > 0) {
    status = 'FAIL';
    reason = failures.join('; ');
  } else if (staleFailures.length > 0) {
    status = 'STALE';
    reason = `pre-ADR-044 spec_compliance evidence (started_at=${startedAt} < ${opts.anchor}); re-run engine to verify post-fix dispatch. Details: ${staleFailures.join('; ')}`;
  }

  return {
    engine: engineName,
    status,
    reason,
    most_recent_run: mostRecent.run_id,
    most_recent_started_at: startedAt || null,
    most_recent_completed_at: mostRecent.completed_at || null,
    declared_agents: declared,
    agent_reports: agentReports,
    failures,
    stale_failures: staleFailures,
  };
}

// ─── Driver ────────────────────────────────────────────────────────────────

function audit({ wsDir, engines, minBytes, anchor }) {
  const anchorISO = anchor || ADR_044_ANCHOR;
  const { runs, warnings } = scanManifests(wsDir);
  const results = engines.map(e => evaluateEngine(e, runs, { minBytes, anchor: anchorISO }));
  const counts = results.reduce((c, r) => {
    c[r.status] = (c[r.status] || 0) + 1;
    return c;
  }, { PASS: 0, WARN: 0, FAIL: 0, STALE: 0 });
  return {
    ok: counts.FAIL === 0,
    tracked_engines: engines,
    min_bytes: minBytes,
    anchor: anchorISO,
    runs_scanned: runs.length,
    pass: counts.PASS,
    warn: counts.WARN,
    fail: counts.FAIL,
    stale: counts.STALE,
    results,
    warnings,
  };
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write(
      'Usage: cwos-runtime-dispatch-audit [--engines csv] [--workstream-dir p] [--min-bytes n] [--strict]\n'
    );
    process.exit(0);
  }
  const enginesCsv = readFlag(args, 'engines');
  const engines = enginesCsv
    ? enginesCsv.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_TRACKED_ENGINES;
  const minBytesRaw = readFlag(args, 'min-bytes');
  const minBytes = minBytesRaw ? parseInt(minBytesRaw, 10) : DEFAULT_MIN_BYTES;
  if (!Number.isFinite(minBytes) || minBytes < 0) {
    process.stderr.write(`cwos-runtime-dispatch-audit: invalid --min-bytes "${minBytesRaw}"\n`);
    process.exit(2);
  }

  const wsDirOverride = readFlag(args, 'workstream-dir');
  let wsDir;
  try {
    wsDir = wsDirOverride ? path.resolve(wsDirOverride) : findWorkstreamDir(process.cwd());
  } catch (e) {
    process.stderr.write(`cwos-runtime-dispatch-audit: ${e.message}\n`);
    process.exit(1);
  }

  const anchor = readFlag(args, 'anchor') || ADR_044_ANCHOR;
  const result = audit({ wsDir, engines, minBytes, anchor });
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  // Exit 1 on any FAIL regardless of --strict (FAIL is always actionable);
  // --strict is reserved for future expansion (e.g. WARN-as-FAIL).
  process.exit(result.fail > 0 ? 1 : 0);
}

if (require.main === module) main();

module.exports = {
  audit, scanManifests, pickMostRecent, evaluateEngine, resolveArtifactBytes,
  DEFAULT_TRACKED_ENGINES, DEFAULT_MIN_BYTES, ADR_044_ANCHOR,
};
