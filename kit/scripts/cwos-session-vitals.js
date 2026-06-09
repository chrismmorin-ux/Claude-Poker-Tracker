#!/usr/bin/env node
/**
 * cwos-session-vitals — SessionStart hook printer.
 *
 * WS-159 / FIND-083 (design-audit run-001). Lifts AI-conversation surface
 * from L3 to L4 by surfacing RED vital signs and program health at session
 * start, so /next /autopilot /audit etc. can't proceed silently against a
 * broken state.
 *
 * Read-only. Zero file writes. No .hooks-liveness.yaml stamp — therefore
 * outside the Compound C lock contract entirely. Silent on green; 3-line
 * block when something is RED. Always exits 0; never blocks session start.
 *
 * Triggers banner when:
 *   - Any system/state.md vital sign is marked RED, OR
 *   - Any program file has health_score < 4 (the hard-cap floor for open
 *     CRITICAL findings + sprint-blocking stale + similar — per
 *     kit/templates/system/health-scoring.md).
 *
 * Usage:
 *   node cwos-session-vitals.js [--quiet]
 *
 * Exit code: always 0.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function safe(fn, fallback) {
  try { return fn(); } catch { return fallback; }
}

function repoRoot() {
  return process.cwd();
}

// ─── Vital signs (system/state.md) ─────────────────────────────────────────

function loadRedVitals(root) {
  const file = path.join(root, 'system', 'state.md');
  const text = safe(() => fs.readFileSync(file, 'utf8'), '');
  if (!text) return [];
  const out = [];
  for (const line of text.split('\n')) {
    if (!line.startsWith('|')) continue;
    if (!/\bRED\b/.test(line)) continue;
    // Skip the header separator row.
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    const cells = line.split('|').map(c => c.trim());
    // Layout: ["", area, status, detail, ""].
    const area = cells[1] || '?';
    const status = cells[2] || '';
    const detail = cells[3] || '';
    if (!/\bRED\b/.test(status)) continue;
    out.push({ area, detail });
  }
  return out;
}

// ─── Program health (typed-API state-store) ────────────────────────────────

function loadPrograms(root) {
  const cli = path.join(root, 'kit', 'scripts', 'cwos-state-store.js');
  if (!safe(() => fs.existsSync(cli), false)) return [];
  const r = spawnSync('node', [cli, 'programs', 'all'], {
    encoding: 'utf8',
    timeout: 3000,
  });
  if (!r || r.status !== 0 || !r.stdout) return [];
  const parsed = safe(() => JSON.parse(r.stdout), null);
  return Array.isArray(parsed) ? parsed : [];
}

function redPrograms(programs) {
  return programs
    .filter(p => p && typeof p.health_score === 'number' && p.health_score < 4)
    .map(p => ({
      id: p.id || '?',
      tier: p.tier || 'unknown',
      health_score: p.health_score,
    }));
}

// ─── Render ────────────────────────────────────────────────────────────────

function render(redVitals, redProgs) {
  const total = redVitals.length + redProgs.length;
  if (total === 0) return null;
  const lines = [];
  lines.push(`⚠ Session start: ${total} RED condition${total === 1 ? '' : 's'}`);
  for (const v of redVitals) {
    const detail = v.detail ? `: ${v.detail}` : '';
    lines.push(`  - ${v.area}${detail}`);
  }
  for (const p of redProgs) {
    lines.push(`  - ${p.id}: health ${p.health_score} (tier ${p.tier})`);
  }
  lines.push('Run /status for detail.');
  return lines.join('\n');
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const root = repoRoot();
  const redVitals = loadRedVitals(root);
  const programs = loadPrograms(root);
  const redProgs = redPrograms(programs);
  const banner = render(redVitals, redProgs);
  if (banner) process.stdout.write(banner + '\n');
  process.exit(0);
}

try { main(); }
catch { process.exit(0); }  // Hook MUST NOT block session start under any failure mode.
