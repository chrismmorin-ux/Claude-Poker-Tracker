/**
 * cwos-orchestrate.js — Shared library for command pre/post-phase scripts.
 *
 * Provides:
 * - Standard context bundle emitter (YAML to stdout)
 * - Reusable data-gathering functions for vital signs, queue, programs, etc.
 * - Fatal/fallback signaling
 *
 * Per-command scripts (cwos-status-pre.js, cwos-session-start-pre.js, etc.)
 * require this module. It is NOT a dispatcher — it is a shared toolkit.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  readYAMLFile, globFiles, parseMarkdownTable, findWorkstreamDir,
  dateDiffDays, todayISO, serializeYAML
} = require('./cwos-utils');

// ─── Bundle Emitter ─────────────────────────────────────────────────────────

/**
 * Emit a context bundle to stdout in standard YAML envelope format.
 * @param {Object} opts
 * @param {string} opts.command — command name (e.g., 'status')
 * @param {string} opts.script — script filename
 * @param {number} opts.startMs — Date.now() from script start
 * @param {string[]} opts.errors — non-fatal error messages
 * @param {Object} opts.data — the gathered data sections
 */
function emitBundle({ command, script, startMs, errors = [], data }) {
  const now = new Date();
  const bundle = {
    meta: {
      bundle_version: 1,
      generated_at: now.toISOString(),
      command,
      script,
      elapsed_ms: Date.now() - startMs,
      errors,
      fatal: false,
    },
    data,
  };

  console.log('# cwos-context-bundle v1');
  console.log(serializeYAML(bundle));
}

/**
 * Emit a fatal bundle and exit. Claude should fall back to manual steps.
 */
function bundleError(message) {
  const bundle = {
    meta: {
      bundle_version: 1,
      generated_at: new Date().toISOString(),
      fatal: true,
      error: message,
    },
    data: {},
  };

  console.log('# cwos-context-bundle v1 (FATAL)');
  console.log(serializeYAML(bundle));
  process.exit(1);
}

// ─── Data Gatherers ─────────────────────────────────────────────────────────

/**
 * Read vital signs table from system/state.md.
 * Returns array of { area, status, check_command, detail }.
 */
function gatherVitalSigns(stateFile, errors) {
  try {
    const content = fs.readFileSync(stateFile, 'utf8');

    // Extract last_updated from first few lines
    const updatedMatch = content.match(/Last updated:\s*(\S+)/);
    const lastUpdated = updatedMatch ? updatedMatch[1] : null;
    const stalenessHours = lastUpdated
      ? Math.round((Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60))
      : null;

    const { rows } = parseMarkdownTable(content, 'Vital Signs');

    const checks = rows.map(row => ({
      area: row['Area'] || '',
      status: row['Status'] || 'NEEDS CHECK',
      detail: row['Detail'] || '',
    }));

    return {
      last_updated: lastUpdated,
      staleness_hours: stalenessHours,
      stale: stalenessHours !== null && stalenessHours > 24,
      checks,
    };
  } catch (err) {
    errors.push(`vital_signs: ${err.message}`);
    return null;
  }
}

/**
 * Read queue-index.yaml and extract summary + top unclaimed items.
 */
function gatherQueueSummary(wsDir, errors) {
  try {
    const { ok, data } = readYAMLFile(path.join(wsDir, 'queue-index.yaml'));
    if (!ok) { errors.push('queue: could not read queue-index.yaml'); return null; }

    const byStatus = data.by_status || {};
    const items = Array.isArray(data.items) ? data.items : [];

    // Top unclaimed items
    const unclaimed = items
      .filter(i => i.status === 'backlog')
      .sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0))
      .slice(0, 5)
      .map(i => ({
        id: i.id,
        title: i.title,
        priority_score: i.priority_score,
        effort: i.effort,
        category: i.category,
      }));

    // Stale in-progress items (> 48h)
    const staleInProgress = items
      .filter(i => i.status === 'in_progress' && i.started_at)
      .filter(i => dateDiffDays(i.started_at, todayISO()) > 2)
      .map(i => ({ id: i.id, title: i.title }));

    return {
      total: data.total_items || items.length,
      by_status: byStatus,
      by_category: data.by_category || {},
      top_unclaimed: unclaimed,
      stale_in_progress: staleInProgress,
    };
  } catch (err) {
    errors.push(`queue: ${err.message}`);
    return null;
  }
}

/**
 * Read all program files and extract health/status summaries.
 */
function gatherProgramHealth(wsDir, errors) {
  try {
    const progsDir = path.join(wsDir, 'programs');
    const files = globFiles(progsDir, 'prog-*.yaml');
    const today = todayISO();
    const programs = [];

    for (const filePath of files) {
      const { ok, data: prog } = readYAMLFile(filePath);
      if (!ok) continue;
      if (!prog.id || prog.status === 'retired') continue;

      // Determine staleness and overdue protocols
      const lastRuns = prog.last_run_by_protocol || {};
      const protocols = prog.protocols || {};
      const tier = prog.tier || 'dormant';
      const tierLevel = { dormant: 0, watch: 1, active: 2, critical: 3 }[tier] || 0;

      const overdueProtocols = [];
      let mostRecentRun = null;

      for (const [proto, protoDef] of Object.entries(protocols)) {
        const minTier = protoDef.min_tier || 'dormant';
        const minLevel = { dormant: 0, watch: 1, active: 2, critical: 3 }[minTier] || 0;
        if (tierLevel < minLevel) continue;

        const run = lastRuns[proto];
        if (!run || !run.date) {
          overdueProtocols.push(proto);
          continue;
        }

        if (!mostRecentRun || run.date > mostRecentRun) mostRecentRun = run.date;

        const cadence = protoDef.cadence_days || 30;
        const daysSince = dateDiffDays(run.date, today);
        if (daysSince > cadence) {
          overdueProtocols.push(proto);
        }
      }

      programs.push({
        id: prog.id,
        name: prog.name || prog.id,
        tier,
        health_score: prog.health_score ?? 0,
        health_ceiling: prog.health_ceiling ?? 0,
        last_run: mostRecentRun || 'never',
        overdue_protocols: overdueProtocols,
        findings_open: prog.findings_open ?? 0,
        staleness_status: overdueProtocols.length > 0 ? 'STALE' : 'CURRENT',
      });
    }

    // Sort: critical first, then by health_score ascending (worst first)
    const tierOrder = { critical: 0, active: 1, watch: 2, dormant: 3 };
    programs.sort((a, b) =>
      (tierOrder[a.tier] || 4) - (tierOrder[b.tier] || 4) ||
      a.health_score - b.health_score
    );

    return programs;
  } catch (err) {
    errors.push(`programs: ${err.message}`);
    return [];
  }
}

/**
 * Read findings-index.yaml and count open findings by severity.
 */
function gatherFindings(wsDir, errors) {
  try {
    const { ok, data } = readYAMLFile(path.join(wsDir, 'findings-index.yaml'));
    if (!ok) { errors.push('findings: could not read findings-index.yaml'); return null; }

    const findings = Array.isArray(data.findings) ? data.findings : [];
    const openBySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
    const criticalFindings = [];

    for (const f of findings) {
      if (f.status === 'open') {
        const sev = String(f.severity).toLowerCase();
        if (openBySeverity.hasOwnProperty(sev)) openBySeverity[sev]++;
        if (sev === 'critical') {
          criticalFindings.push({ id: f.id, title: f.title, program: f.program });
        }
      }
    }

    return {
      total_open: Object.values(openBySeverity).reduce((a, b) => a + b, 0),
      open_by_severity: openBySeverity,
      critical_findings: criticalFindings,
    };
  } catch (err) {
    errors.push(`findings: ${err.message}`);
    return null;
  }
}

/**
 * Scan sessions/ for active sessions.
 */
function gatherActiveSessions(wsDir, errors) {
  try {
    const sessionsDir = path.join(wsDir, 'sessions');
    if (!fs.existsSync(sessionsDir)) return { active: [] };

    const files = globFiles(sessionsDir, '*.yaml');
    const active = [];

    for (const filePath of files) {
      const { ok, data } = readYAMLFile(filePath);
      if (!ok) continue;
      if (data.status === 'active') {
        active.push({
          id: data.id || path.basename(filePath, '.yaml'),
          started_at: data.started_at || '',
          claimed_items: data.claimed_items || [],
        });
      }
    }

    return { active };
  } catch (err) {
    errors.push(`sessions: ${err.message}`);
    return { active: [] };
  }
}

/**
 * Read usage.yaml if it exists.
 */
function gatherUsage(wsDir, errors) {
  try {
    const usagePath = path.join(wsDir, 'usage.yaml');
    if (!fs.existsSync(usagePath)) return { exists: false };

    const { ok, data } = readYAMLFile(usagePath);
    if (!ok) return { exists: false };

    return {
      exists: true,
      total_items_completed: data.total_items_completed || data.items_completed || 0,
      total_findings_caught: data.total_findings_caught || data.findings_caught || 0,
      regressions_prevented: data.regressions_prevented || 0,
      decisions_preserved: data.decisions_preserved || 0,
      convergence_trend: data.convergence_trend || data.convergence || 'unknown',
      escalation_ready: data.escalation_ready || false,
    };
  } catch (err) {
    errors.push(`usage: ${err.message}`);
    return { exists: false };
  }
}

/**
 * Find system/state.md by walking up from startDir.
 */
function findStateFile(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  for (let depth = 0; depth < 10; depth++) {
    const candidate = path.join(dir, 'system', 'state.md');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  emitBundle,
  bundleError,
  gatherVitalSigns,
  gatherQueueSummary,
  gatherProgramHealth,
  gatherFindings,
  gatherActiveSessions,
  gatherUsage,
  findStateFile,
};
