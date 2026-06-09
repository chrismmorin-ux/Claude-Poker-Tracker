#!/usr/bin/env node
/**
 * cwos-state-store — thin CLI wrapper over kit/scripts/core/state-store.js.
 *
 * ADR-020 step 2, WS-189. Matches the cwos-event.js precedent: commands
 * invoke this via Bash; in-process scripts use the module directly.
 *
 * Usage:
 *   cwos-state-store load                      # (re)load, print summary
 *   cwos-state-store <domain> all              # JSON array of all items
 *   cwos-state-store <domain> by-id <value>    # single item or null
 *   cwos-state-store <domain> by-status <v>    # filtered list
 *   cwos-state-store <domain> by-program <v>   # filtered list
 *   cwos-state-store envelope active           # active commands
 *   cwos-state-store envelope recent [N]       # recent N completed (default 10)
 *   cwos-state-store recover-rebalance         # promote any .rebalance-staging files (WS-264)
 *   cwos-state-store compat [--strict]         # WS-274 schema/lag handshake (exit 1 on mismatch if --strict)
 *
 * Guarded per AS-42: if `core/` is absent (fleet repo without step-2
 * runtime), exits 0 silently. Non-fatal under all conditions.
 */

'use strict';

require('./lib/preflight');

let stateStoreMod = null;
try { stateStoreMod = require('./core/state-store'); }
catch { process.exit(0); }

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

function printSummary(store) {
  const summary = {};
  for (const name of stateStoreMod.DEFAULT_DOMAINS) {
    const d = store.domains[name];
    const items = d && d.items ? Object.keys(d.items).length : 0;
    summary[name] = items;
  }
  writeJson({ summary, updated_at_per_domain: _updatedMap(store) });
}

function _updatedMap(store) {
  const out = {};
  for (const name of stateStoreMod.DEFAULT_DOMAINS) {
    const d = store.domains[name];
    out[name] = (d && d.updated_at) || null;
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  try {
    const store = stateStoreMod.stateStore;

    if (!sub || sub === 'load' || sub === '--help' || sub === '-h') {
      store.load();
      printSummary(store);
      return;
    }

    if (sub === 'recover-rebalance') {
      let rebalanceMod;
      try { rebalanceMod = require('./core/rebalance'); }
      catch { writeJson({ ok: true, recovered: [], note: 'rebalance module not present' }); return; }
      const result = rebalanceMod.recoverRebalance({ workstreamDir: store.workstreamDir });
      writeJson(result);
      process.exit(result.ok ? 0 : 1);
    }

    if (sub === 'compat') {
      const strict = args.includes('--strict');
      const report = stateStoreMod.compat(store.workstreamDir);
      writeJson(report);
      process.exit(strict && !report.ok ? 1 : 0);
    }

    const domain = sub;
    const op = args[1];
    if (!stateStoreMod.DEFAULT_DOMAINS.includes(domain)) {
      process.stderr.write(`cwos-state-store: unknown domain '${domain}'. Valid: ${stateStoreMod.DEFAULT_DOMAINS.join(', ')}\n`);
      process.exit(2);
    }
    const acc = store[domain];
    if (!acc) { writeJson([]); return; }

    switch (op) {
      case 'all':        writeJson(acc.all()); return;
      case 'active':     writeJson(acc.active ? acc.active() : []); return;
      case 'recent': {
        const n = parseInt(args[2] || '10', 10);
        writeJson(acc.recent ? acc.recent(n) : []);
        return;
      }
      case 'by-id':         writeJson(acc.byId ? acc.byId(args[2]) : null); return;
      case 'by-status':     writeJson(acc.byStatus ? acc.byStatus(args[2]) : []); return;
      case 'by-program':    writeJson(acc.byProgram ? acc.byProgram(args[2]) : []); return;
      case 'by-severity':   writeJson(acc.bySeverity ? acc.bySeverity(args[2]) : []); return;
      case 'by-tier':       writeJson(acc.byTier ? acc.byTier(args[2]) : []); return;
      case 'by-command-id': writeJson(acc.byCommandId ? acc.byCommandId(args[2]) : null); return;
      default:
        process.stderr.write(`cwos-state-store: unknown op '${op}' for domain '${domain}'\n`);
        process.exit(2);
    }
  } catch (err) {
    // Non-fatal — AS-23 discipline.
    process.stderr.write(`cwos-state-store: ${err.message}\n`);
    process.exit(0);
  }
}

if (require.main === module) main();
