#!/usr/bin/env node
/**
 * cwos-closure-backfill — recover closure provenance that WS-561's presence-guard
 * silently dropped.
 *
 * WHAT HAPPENED
 *
 * Five closure-write sites tested `!/^completed_at:/m` — key PRESENCE, not
 * value. An item scaffolding `completed_at: null` while open matched that
 * regex, so the guard went false and the value was never written, while the
 * CLI reported ok. Measured 2026-08-02: 104 items across claude-poker-tracker
 * and ServeYourNote closed with null provenance.
 *
 * WHY THIS SCRIPT REFUSES TO GUESS
 *
 * The data IS recoverable — `closed_by_event` was written correctly on every
 * affected item, and the `item_closed` event carries both completed_at and
 * completion_commit. So there is a truthful source, and this script uses only
 * that source.
 *
 * It has NO time-based fallback, deliberately. `cwos-reconcile.js` contains
 * `closure.completed_at || todayISO()` three lines from one of the broken
 * guards — the natural thing to copy. Inherited here, that would stamp today's
 * date on whatever could not be resolved, converting 104 DETECTABLY wrong
 * nulls into PLAUSIBLY wrong dates: indistinguishable from truth, silently
 * corrupting the staleness and velocity metrics that read the field, and
 * destroying the evidence needed to ever find the problem again. A null you
 * can find beats a date you can't question. Unresolvable items are reported
 * and left alone.
 *
 * It reads events via listChunks (live + archive), never listLiveChunks —
 * whose own comment says archived history is intentionally excluded. Archived
 * events belong to the OLDEST items, which are both the most likely to need
 * repair and the least likely to have a wrong repair noticed.
 *
 * It matches the EXACT `closed_by_event` id, never "last item_closed event
 * with this ws_id" — an item closed twice would otherwise silently take the
 * wrong closure.
 *
 * Usage:
 *   cwos-closure-backfill [--repo <path>] [--apply] [--json]
 *
 *   default          dry run — report what would change, write nothing
 *   --apply          write the recovered values
 *   --repo <path>    target repo (default: cwd)
 *   --json           machine-readable report
 *
 * exit 0 — nothing to do, or completed
 * exit 1 — items remain unresolvable (dry run reports them; not an error under --apply)
 * exit 2 — bad command line
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const {
  parseYAML,
  readYAMLFile,
  writeFileAtomic,
  withFileLock,
  upsertYAMLScalarField,
  isUnsetYAMLScalar,
  globFiles,
} = require('./lib/cwos-utils');

const FIELDS = ['completed_at', 'completion_commit'];

function usage(code) {
  process.stdout.write(
    'cwos-closure-backfill — recover closure provenance dropped by the WS-561 presence-guard\n\n' +
    'usage: cwos-closure-backfill [--repo <path>] [--apply] [--json]\n\n' +
    '  --repo <path>  target repo (default: cwd)\n' +
    '  --apply        write recovered values (default is a dry run)\n' +
    '  --json         machine-readable report\n' +
    '  -h, --help     print this usage and exit without acting\n\n' +
    'Recovers ONLY from the event log via closed_by_event. Never infers a\n' +
    'timestamp: unresolvable items are reported and left untouched.\n\n' +
    'exit 0 — nothing to do or completed · 1 — unresolvable items remain · 2 — bad args\n'
  );
  process.exit(code);
}

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : null;
}

/**
 * Index every item_closed event by its OWN event id, from live AND archived
 * chunks. Returns Map<eventId, payload>.
 */
function indexClosureEvents(workstreamDir) {
  const byId = new Map();
  let events;
  try { events = require('./core/events'); }
  catch { return byId; }

  let chunks = [];
  try {
    // listChunks unions events/archive/; listLiveChunks would silently skip it.
    chunks = typeof events.listChunks === 'function'
      ? events.listChunks(workstreamDir)
      : [];
  } catch { return byId; }

  for (const entry of chunks) {
    const file = Array.isArray(entry) ? entry[1] : entry;
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let ev;
      try { ev = JSON.parse(line); } catch { continue; }
      const p = ev && ev.payload;
      if (!p || p.type !== 'item_closed') continue;
      if (ev.id) byId.set(ev.id, p);
    }
  }
  return byId;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) usage(0);

  const known = new Set(['--repo', '--apply', '--json']);
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      if (!known.has(a)) {
        process.stderr.write(`cwos-closure-backfill: unknown flag: ${a}\n`);
        process.exit(2);
      }
      if (a === '--repo') i++;
    }
  }

  const repo = path.resolve(readFlag(args, 'repo') || process.cwd());
  const apply = args.includes('--apply');
  const asJson = args.includes('--json');

  const workstreamDir = path.join(repo, '.claude', 'workstream');
  const queueDir = path.join(workstreamDir, 'queue');
  if (!fs.existsSync(queueDir)) {
    process.stderr.write(`cwos-closure-backfill: no queue dir at ${queueDir}\n`);
    process.exit(2);
  }

  const closureEvents = indexClosureEvents(workstreamDir);
  const report = { repo, apply, scanned: 0, affected: 0, repaired: [], unresolvable: [], events_indexed: closureEvents.size };

  for (const file of globFiles(queueDir, 'WS-*.yaml')) {
    report.scanned++;
    let raw;
    try { raw = fs.readFileSync(file, 'utf8'); } catch { continue; }

    const data = parseYAML(raw);
    if (String(data.status || '').trim() !== 'done') continue;

    // Which closure fields are present-but-unset? Read the RAW line, not the
    // parsed value — an absent key and a null key both parse to null/undefined,
    // and only the second is this bug.
    const missing = FIELDS.filter((f) => {
      const m = raw.match(new RegExp(`^${f}:([^\\r\\n]*)$`, 'm'));
      return m && isUnsetYAMLScalar(m[1]);
    });
    if (!missing.length) continue;
    report.affected++;

    const wsId = data.id || path.basename(file, '.yaml');
    const evId = data.closed_by_event;

    if (!evId) {
      report.unresolvable.push({ ws_id: wsId, fields: missing, reason: 'no closed_by_event on item' });
      continue;
    }
    const payload = closureEvents.get(String(evId).trim());
    if (!payload) {
      report.unresolvable.push({ ws_id: wsId, fields: missing, reason: `event ${evId} not found in live or archived chunks` });
      continue;
    }

    const recovered = {};
    const stillMissing = [];
    for (const f of missing) {
      const v = payload[f];
      if (v === undefined || v === null || v === '') stillMissing.push(f);
      else recovered[f] = v;
    }

    if (Object.keys(recovered).length) {
      if (apply) {
        try {
          withFileLock(file + '.lock', () => {
            let content = fs.readFileSync(file, 'utf8');
            for (const [f, v] of Object.entries(recovered)) {
              content = upsertYAMLScalarField(content, f, v, { after: f === 'completed_at' ? 'status' : 'completed_at' }).content;
            }
            writeFileAtomic(file, content);
          }, { ownerLabel: 'closure-backfill', maxWaitMs: 5000 });
        } catch (err) {
          report.unresolvable.push({ ws_id: wsId, fields: Object.keys(recovered), reason: `write failed: ${err.message}` });
          continue;
        }
      }
      report.repaired.push({ ws_id: wsId, recovered, source_event: evId });
    }
    if (stillMissing.length) {
      report.unresolvable.push({ ws_id: wsId, fields: stillMissing, reason: `event ${evId} carries no value for these fields` });
    }
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    const mode = apply ? 'APPLIED' : 'DRY RUN (pass --apply to write)';
    process.stdout.write(`cwos-closure-backfill — ${mode}\n`);
    process.stdout.write(`  repo:            ${repo}\n`);
    process.stdout.write(`  closed items:    ${report.scanned} scanned, ${report.affected} with unset closure fields\n`);
    process.stdout.write(`  events indexed:  ${report.events_indexed} (live + archive)\n`);
    process.stdout.write(`  recoverable:     ${report.repaired.length}\n`);
    process.stdout.write(`  unresolvable:    ${report.unresolvable.length}\n`);
    for (const r of report.repaired.slice(0, 10)) {
      process.stdout.write(`    ${apply ? '✓' : '·'} ${r.ws_id}: ${Object.entries(r.recovered).map(([k, v]) => `${k}=${v}`).join(', ')}\n`);
    }
    if (report.repaired.length > 10) process.stdout.write(`    … ${report.repaired.length - 10} more\n`);
    for (const u of report.unresolvable.slice(0, 10)) {
      process.stdout.write(`    ! ${u.ws_id}: ${u.fields.join(', ')} — ${u.reason}\n`);
    }
    if (report.unresolvable.length > 10) process.stdout.write(`    … ${report.unresolvable.length - 10} more\n`);
    if (report.unresolvable.length) {
      process.stdout.write('\n  Unresolvable items are LEFT AS NULL on purpose. A null is detectably\n');
      process.stdout.write('  wrong; an invented date is not. Do not "fix" these by stamping a time.\n');
    }
  }

  process.exit(report.unresolvable.length && !apply ? 1 : 0);
}

if (require.main === module) main();

module.exports = { indexClosureEvents };
