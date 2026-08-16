#!/usr/bin/env node
/**
 * cwos-migrate-watch — INV firing → migration WS auto-promotion (WS-376 / FIND-251).
 *
 * Bridges the invariant system and the workstream queue. When an INV fires
 * N consecutive times without resolution AND no migration WS exists for it,
 * generate one. Closes RC-F from the 2026-05-10 retro: invariants that fire
 * forever as yellow noise because nothing structurally routes detection to
 * remediation (INV-039 on SYN fired for 11 months).
 *
 * Inputs (read-only):
 *   .claude/workstream/meta/invariant-firing-log.yaml  — populated by cwos-verify
 *   system/invariants.md                               — for rule/source text
 *   .claude/workstream/queue-index.yaml                — to pick the next free WS id
 *
 * Outputs (atomic):
 *   .claude/workstream/queue/WS-NNN.yaml               — one per escalation
 *   .claude/workstream/meta/invariant-firing-log.yaml  — counter reset + ws_id link
 *
 * Usage:
 *   node kit/scripts/cwos-migrate-watch.js --watch         # generate any pending
 *   node kit/scripts/cwos-migrate-watch.js --list          # dry-run + report
 *   node kit/scripts/cwos-migrate-watch.js --dry-run       # alias of --list
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { readYAMLFile, findWorkstreamDir, findRepoRoot, todayISO, globFiles, loadEventDeps } = require('./lib/cwos-utils');

const { appendEvent, ensureCommandId } = loadEventDeps();

function loadFiringLog(wsDir) {
  const logPath = path.join(wsDir, 'meta', 'invariant-firing-log.yaml');
  if (!fs.existsSync(logPath)) return { path: logPath, data: { schema_version: 1, invariants: {} } };
  const r = readYAMLFile(logPath);
  if (!r.ok || !r.data) return { path: logPath, data: { schema_version: 1, invariants: {} } };
  if (!r.data.invariants) r.data.invariants = {};
  return { path: logPath, data: r.data };
}

function serializeFiringLog(data) {
  const out = [`schema_version: ${data.schema_version || 1}`, 'invariants:'];
  const ids = Object.keys(data.invariants || {}).sort();
  for (const id of ids) {
    const e = data.invariants[id];
    out.push(`  ${id}:`);
    out.push(`    consecutive_failures: ${e.consecutive_failures || 0}`);
    out.push(`    first_failed_at: ${e.first_failed_at ? `"${e.first_failed_at}"` : 'null'}`);
    out.push(`    last_failed_at: ${e.last_failed_at ? `"${e.last_failed_at}"` : 'null'}`);
    out.push(`    last_status: ${e.last_status ? `"${e.last_status}"` : 'null'}`);
    out.push(`    threshold: ${e.threshold || 5}`);
    out.push(`    migration_ws_id: ${e.migration_ws_id ? `"${e.migration_ws_id}"` : 'null'}`);
  }
  return out.join('\n') + '\n';
}

// Walk all WS-*.yaml files in queue/ + archive/ + sprints/ and find the highest
// numeric ID. Returns "WS-<n+1>".
function pickNextFreeWsId(wsDir) {
  const queueDir = path.join(wsDir, 'queue');
  const archiveDir = path.join(queueDir, 'archive');
  let maxId = 0;
  for (const dir of [queueDir, archiveDir]) {
    if (!fs.existsSync(dir)) continue;
    const files = globFiles(dir, 'WS-*.yaml');
    for (const f of files) {
      const m = path.basename(f).match(/^WS-(\d+)\.yaml$/);
      if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
    }
  }
  return `WS-${maxId + 1}`;
}

// Parse the rule/status prose for a given INV-NNN from system/invariants.md.
// Returns { rule, status, lastVerified } as best-effort strings.
function loadInvariantContext(rootDir, invId) {
  const invPath = path.join(rootDir, 'system', 'invariants.md');
  if (!fs.existsSync(invPath)) return { rule: '', status: '', lastVerified: null };
  const content = fs.readFileSync(invPath, 'utf8');
  // Match the section starting at "### <invId>:" until the next "### " or EOF.
  const escId = invId.replace(/-/g, '-');
  const re = new RegExp(`### ${escId}:[\\s\\S]*?(?=\\n### |\\n## |$)`, 'm');
  const m = content.match(re);
  if (!m) return { rule: '', status: '', lastVerified: null };
  const section = m[0];
  const ruleMatch = section.match(/\*\*Rule:\*\*\s+([\s\S]*?)(?=\n\*\*|\n###|$)/);
  const statusMatch = section.match(/\*\*Status:\*\*\s+([^\n]+)/);
  const verMatch = section.match(/\*\*Last Verified:\*\*\s+([^\n]+)/);
  return {
    rule: ruleMatch ? ruleMatch[1].trim() : '',
    status: statusMatch ? statusMatch[1].trim() : '',
    lastVerified: verMatch ? verMatch[1].trim() : null,
  };
}

// Build a migration WS-NNN.yaml body for the given INV escalation.
function buildMigrationWsYaml(wsId, invId, invCtx, log) {
  const now = new Date().toISOString();
  const today = todayISO();
  const firstFailedAt = log.first_failed_at || today;
  const consecutive = log.consecutive_failures;
  const ruleExcerpt = (invCtx.rule || '').split('\n')[0].slice(0, 200);
  const statusExcerpt = (invCtx.status || '').slice(0, 200);

  return `id: "${wsId}"
title: "Migration triggered by ${invId} (fired ${consecutive} consecutive times)"
status: "backlog"
type: "migration"
category: "migration"
capability: "core"
program: "kit-quality"
priority_score: 75
effort: "M"
created_at: "${today}"
source:
  surfaced_by: "cwos-migrate-watch.js (WS-376)"
  surfaced_during: "${invId} fired ${consecutive} consecutive verify runs without resolution"
  first_failed_at: "${firstFailedAt}"
  invariant_id: "${invId}"
description: |
  ${invId} has fired ${consecutive} consecutive runs since ${firstFailedAt} with no
  open WS item addressing it. cwos-migrate-watch auto-generated this migration
  item per the WS-376 sustained-failure escalation policy (default threshold: 5).

  Rule excerpt:
    ${ruleExcerpt}

  Current status from system/invariants.md:
    ${statusExcerpt}

  Founder action: review the invariant's rule + status text, decide whether
  to (a) author the remediation steps (migration), (b) document why the
  invariant fires as expected and update its status text, or (c) retire the
  invariant if it no longer reflects desired behavior.
accept_criteria:
  - "${invId} passes cwos-verify on the affected fleet member(s)"
  - "Or: invariants.md status text updated to reflect the structural EXPECTED-FAIL framing with cited next steps"
  - "consecutive_failures counter in invariant-firing-log resets to 0 (automatic on PASS)"
files_likely_involved:
  - "system/invariants.md (status text)"
  - "kit/scripts/cwos-verify.js (the check function)"
depends_on:
  - "${invId}"
auto_generated_by: "cwos-migrate-watch"
auto_generated_at: "${now}"
blocked_by_note: "Auto-generated escalation; founder triages remediation path. See depends_on invariant for the exact rule that's failing."
`;
}

function runWatch({ dryRun }) {
  const rootDir = findRepoRoot(process.cwd(), { markers: ['CLAUDE.md', 'kit'], requireAll: true, maxDepth: 8 });
  const wsDir = findWorkstreamDir(rootDir);
  const { path: logPath, data: log } = loadFiringLog(wsDir);

  const escalations = [];
  for (const [invId, entry] of Object.entries(log.invariants)) {
    const threshold = entry.threshold || 5;
    if ((entry.consecutive_failures || 0) < threshold) continue;
    if (entry.migration_ws_id) continue;
    escalations.push({ invId, entry });
  }

  if (escalations.length === 0) {
    process.stdout.write(JSON.stringify({ ok: true, escalations: [], note: 'no INVs at/above threshold without migration WS' }, null, 2) + '\n');
    return;
  }

  const generated = [];
  let nextId = pickNextFreeWsId(wsDir);

  for (const { invId, entry } of escalations) {
    const invCtx = loadInvariantContext(rootDir, invId);
    const wsId = nextId;
    nextId = `WS-${parseInt(wsId.split('-')[1], 10) + 1}`;
    const body = buildMigrationWsYaml(wsId, invId, invCtx, entry);
    const wsPath = path.join(wsDir, 'queue', `${wsId}.yaml`);

    if (!dryRun) {
      fs.writeFileSync(wsPath, body, 'utf8');
      // Reset counter + record link in firing log
      log.invariants[invId] = {
        ...entry,
        consecutive_failures: 0,
        migration_ws_id: wsId,
      };
      // Best-effort event emission
      if (appendEvent && ensureCommandId) {
        try {
          const commandId = ensureCommandId('migrate-watch');
          appendEvent({
            source_track: 'T6:workstream',
            source_tier: 'ai-autonomous',
            track_tag: 'migration_auto_promoted',
            command_id: commandId,
            payload: {
              type: 'migration_auto_promoted',
              ws_id: wsId,
              invariant_id: invId,
              consecutive_failures: entry.consecutive_failures,
              first_failed_at: entry.first_failed_at,
            },
          });
        } catch { /* non-fatal */ }
      }
    }

    generated.push({
      ws_id: wsId,
      invariant_id: invId,
      consecutive_failures: entry.consecutive_failures,
      first_failed_at: entry.first_failed_at,
      path: dryRun ? `(dry-run) ${path.relative(rootDir, wsPath)}` : path.relative(rootDir, wsPath),
    });
  }

  if (!dryRun) {
    fs.writeFileSync(logPath, serializeFiringLog(log), 'utf8');
  }

  process.stdout.write(JSON.stringify({ ok: true, escalations: generated, dry_run: !!dryRun }, null, 2) + '\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    process.stdout.write('usage: cwos-migrate-watch.js [--watch | --list | --dry-run]\n');
    process.exit(0);
  }
  const dryRun = args.includes('--list') || args.includes('--dry-run');
  if (!dryRun && !args.includes('--watch')) {
    process.stderr.write('cwos-migrate-watch: pass --watch (apply) or --list (dry-run)\n');
    process.exit(2);
  }
  runWatch({ dryRun });
}

if (require.main === module) main();

module.exports = { runWatch, pickNextFreeWsId, loadInvariantContext };
