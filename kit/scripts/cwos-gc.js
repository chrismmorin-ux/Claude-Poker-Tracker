#!/usr/bin/env node
/**
 * cwos-gc — Registry-driven garbage collection.
 *
 * Reads `archivable_entities` from config.yaml and iterates each entity type:
 * scans for files matching the pattern in done states past their age threshold,
 * moves them to the archive_dir. After all archival, calls cwos-reconcile-core
 * to rebuild indexes from the new state.
 *
 * Adding a new archivable entity type is a config.yaml edit, not code.
 *
 * Usage: node cwos-gc.js [--dry-run] [--workstream-dir <path>]
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const {
  readYAMLFile, globFiles, findWorkstreamDir, dateDiffDays, todayISO
} = require('./lib/cwos-utils');
const { rebuildAll } = require('./lib/cwos-reconcile-core');

const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

// WS-428: event-chunk rotation reads the canonical log via core/events.
// Guarded require so minimal/harness environments without events.js still run
// the YAML-entity GC (event rotation is simply skipped).
let _eventsMod = null;
function loadEventsMod() {
  if (_eventsMod === null) {
    try { _eventsMod = require('./core/events'); }
    catch { _eventsMod = false; }
  }
  return _eventsMod || null;
}

// WS-428 Stage C: bounded replay for snapshot-domain capture. Guarded — if the
// replay engine is unavailable, the snapshot still records boundary metadata
// (domains: null) and rotation proceeds.
let _replayMod = null;
function loadReplayMod() {
  if (_replayMod === null) {
    try { _replayMod = require('./core/cwos-replay'); }
    catch { _replayMod = false; }
  }
  return _replayMod || null;
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  let wsDir;

  const dirIdx = args.indexOf('--workstream-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    wsDir = path.resolve(args[dirIdx + 1]);
  } else {
    try { wsDir = findWorkstreamDir(process.cwd()); }
    catch { console.error('ERROR: Could not find .claude/workstream/'); process.exit(1); }
  }

  const today = todayISO();
  const config = loadConfig(wsDir);

  // Iterate entity-type registry
  const entityResults = [];
  for (const entity of config.archivable_entities) {
    entityResults.push(gcEntityType(wsDir, entity, config.gc, today, dryRun));
  }

  // WS-428: event-chunk rotation. Kept separate from the index-rebuild trigger
  // below — moving event chunks does not change the queue/findings/sprint
  // indexes that rebuildAll regenerates (it materializes from YAML, not events).
  const eventsResult = gcEventChunks(wsDir, config.gc, today, dryRun);

  const graduationCandidates = detectGraduation(wsDir, config.gc);

  // After all archival, reconcile indexes (YAML entities only)
  const totalArchived = entityResults.reduce((sum, r) => sum + r.archived, 0);
  if (!dryRun && totalArchived > 0) {
    rebuildAll(wsDir);
  }

  // Summary
  const mode = dryRun ? '[DRY RUN] ' : '';
  console.log(`${mode}GC Summary:`);
  for (const r of entityResults) {
    console.log(`  ${r.type.padEnd(10)} ${r.archived} archived, ${r.skipped} not eligible`);
  }
  console.log(`  ${eventsResult.type.padEnd(10)} ${eventsResult.archived} archived, ${eventsResult.skipped} not eligible`);

  if (graduationCandidates.length > 0) {
    console.log(`  Graduation candidates (for LLM review):`);
    for (const g of graduationCandidates) {
      console.log(`    - ${g.pattern}: ${g.count} resolved findings (threshold: ${config.gc.graduation_threshold})`);
    }
  }

  if (!dryRun && totalArchived > 0) {
    console.log(`  Indexes rebuilt via cwos-reconcile-core`);
  }
}

// ─── Config ─────────────────────────────────────────────────────────────────

function loadConfig(wsDir) {
  const { ok, data } = readYAMLFile(path.join(wsDir, 'config.yaml'));
  const gc = (ok && data.gc) || {};
  const archivableEntities = (ok && Array.isArray(data.archivable_entities))
    ? data.archivable_entities
    : DEFAULT_ENTITY_REGISTRY;
  return {
    gc: {
      finding_archive_days: gc.finding_archive_days || 30,
      queue_archive_days: gc.queue_archive_days || 30,
      sprint_archive_days: gc.sprint_archive_days || 60,
      run_archive_days: gc.run_archive_days || 90,
      session_archive_days: gc.session_archive_days || 30,
      graduation_threshold: gc.graduation_threshold || 3,
      recurrence_threshold: gc.recurrence_threshold || 2,
      // WS-428: event-chunk rotation. Archive day-files older than N days,
      // but never the newest `events_keep_min_chunks` regardless of age.
      events_archive_days: gc.events_archive_days || 90,
      events_keep_min_chunks: gc.events_keep_min_chunks || 7,
    },
    archivable_entities: archivableEntities,
  };
}

// Fallback if config.yaml has no archivable_entities (legacy configs).
const DEFAULT_ENTITY_REGISTRY = [
  { type: 'queue', dir: 'queue', pattern: 'WS-*.yaml', archive_dir: 'queue/archive', done_states: ['done'], age_source: 'completed_at', age_days_key: 'queue_archive_days' },
  { type: 'findings', dir: 'findings', pattern: 'FIND-*.yaml', archive_dir: 'findings/archive', done_states: ['resolved', 'dismissed'], age_source: 'created_at', age_days_key: 'finding_archive_days' },
  { type: 'sessions', dir: 'sessions', pattern: '*.yaml', archive_dir: 'sessions/archive', done_states: ['completed'], age_source: 'completed_at', age_days_key: 'session_archive_days' },
  { type: 'sprints', dir: 'sprints', pattern: 'SPR-*.yaml', archive_dir: 'sprints/archive', done_states: ['completed', 'abandoned'], age_source: 'completed_at', age_days_key: 'sprint_archive_days' },
  // WS-314: runs are directory-shaped entities. Age is read from
  // summary.yaml's `date` field; archive moves the entire run dir under
  // runs/archive/<year>/. Open WS-* items that cite the run block the
  // archive (the citation guard).
  { type: 'runs', dir: 'runs', kind: 'directory', dir_pattern: '^run-[A-Za-z0-9_-]+$',
    archive_dir: 'runs/archive', archive_year_bucket: true,
    age_source_file: 'summary.yaml', age_source: 'date',
    age_days_key: 'run_archive_days', guard: 'no_open_citations' },
];

// ─── Generic Entity GC Driver ───────────────────────────────────────────────

function gcEntityType(wsDir, entity, gcConfig, today, dryRun) {
  if (entity.kind === 'directory') {
    return gcEntityDirectory(wsDir, entity, gcConfig, today, dryRun);
  }
  const dir = path.join(wsDir, entity.dir);
  const archiveDir = path.join(wsDir, entity.archive_dir);
  const archiveDays = gcConfig[entity.age_days_key] || 30;

  if (!fs.existsSync(dir)) {
    return { type: entity.type, archived: 0, skipped: 0 };
  }

  const files = globFiles(dir, entity.pattern);
  let archived = 0, skipped = 0;

  for (const filePath of files) {
    const { ok, data } = readYAMLFile(filePath);
    if (!ok) { skipped++; continue; }

    // State check (skip if done_states is null — age-only GC)
    if (entity.done_states && Array.isArray(entity.done_states)) {
      if (!entity.done_states.includes(data.status)) { skipped++; continue; }
    }

    // Age check
    const ageSourceValue = data[entity.age_source];
    if (!ageSourceValue) { skipped++; continue; }
    const age = dateDiffDays(ageSourceValue, today);
    if (age < archiveDays) { skipped++; continue; }

    // Eligible — archive
    if (dryRun) {
      console.log(`  [dry-run] Would archive ${entity.type}: ${path.basename(filePath)} (${data.status} ${age}d ago)`);
    } else {
      ensureDir(archiveDir);
      const dest = path.join(archiveDir, path.basename(filePath));
      fs.renameSync(filePath, dest);
      emitEvent('T6:workstream', 'item-archived', {
        entity_type: entity.type,
        path: path.relative(process.cwd(), dest).replace(/\\/g, '/'),
        age_days: age,
      });
    }
    archived++;
  }

  return { type: entity.type, archived, skipped };
}

// ─── Directory-Entity GC Driver (WS-314) ────────────────────────────────────
//
// Handles entity types where each member is a directory rather than a single
// YAML file. Age is read from a designated source file inside each dir
// (entity.age_source_file → entity.age_source field). Optional year-bucketed
// archive_dir, optional citation guard.

function gcEntityDirectory(wsDir, entity, gcConfig, today, dryRun) {
  const dir = path.join(wsDir, entity.dir);
  const archiveBase = path.join(wsDir, entity.archive_dir);
  const archiveDays = gcConfig[entity.age_days_key] || 90;

  if (!fs.existsSync(dir)) {
    return { type: entity.type, archived: 0, skipped: 0 };
  }

  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return { type: entity.type, archived: 0, skipped: 0 }; }

  const dirRe = entity.dir_pattern ? new RegExp(entity.dir_pattern) : null;
  let archived = 0, skipped = 0;
  let citationIndex = null; // lazy: only loaded if a guard needs it

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name === 'archive') continue;
    if (dirRe && !dirRe.test(ent.name)) continue;

    const memberDir = path.join(dir, ent.name);

    // Age source — read source file, extract field. If missing, skip.
    let ageSourceValue = null;
    if (entity.age_source_file) {
      const srcPath = path.join(memberDir, entity.age_source_file);
      if (fs.existsSync(srcPath)) {
        const r = readYAMLFile(srcPath);
        if (r.ok && r.data) ageSourceValue = r.data[entity.age_source];
      }
    }
    if (!ageSourceValue) { skipped++; continue; }

    // Coerce to ISO date if it's a full timestamp.
    const iso = String(ageSourceValue).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) { skipped++; continue; }
    const age = dateDiffDays(iso, today);
    if (age < archiveDays) { skipped++; continue; }

    // Guard — open citations on the run-id block archival.
    if (entity.guard === 'no_open_citations') {
      if (!citationIndex) citationIndex = loadOpenCitationIndex(wsDir);
      if (citationIndex.has(ent.name)) {
        if (dryRun) {
          console.log(`  [dry-run] SKIP ${entity.type} ${ent.name}: cited by open work item`);
        }
        skipped++;
        continue;
      }
    }

    // Compute destination — year bucket if configured.
    let destBase = archiveBase;
    if (entity.archive_year_bucket) {
      destBase = path.join(archiveBase, iso.slice(0, 4));
    }
    const dest = path.join(destBase, ent.name);

    if (dryRun) {
      console.log(`  [dry-run] Would archive ${entity.type}: ${ent.name} (${age}d ago) → ${path.relative(wsDir, dest)}`);
    } else {
      ensureDir(destBase);
      fs.renameSync(memberDir, dest);
      emitEvent('T6:workstream', 'item-archived', {
        entity_type: entity.type,
        path: path.relative(process.cwd(), dest).replace(/\\/g, '/'),
        age_days: age,
      });
    }
    archived++;
  }

  return { type: entity.type, archived, skipped };
}

// Returns a Set of run_ids that are referenced by any open queue item. An
// open item is anything not yet `done` / `dismissed` / `deferred`. Open
// references are matched as the literal `run-NNN` token anywhere in the
// item's YAML text — broad on purpose; the cost of a false-positive (skip
// archive) is much lower than a false-negative (orphan a cited reference).
function loadOpenCitationIndex(wsDir) {
  const cited = new Set();
  const queueDir = path.join(wsDir, 'queue');
  if (!fs.existsSync(queueDir)) return cited;
  let files;
  try { files = fs.readdirSync(queueDir).filter(f => f.startsWith('WS-') && f.endsWith('.yaml')); }
  catch { return cited; }
  const closedStates = new Set(['done', 'dismissed', 'deferred', 'abandoned']);
  for (const f of files) {
    let text;
    try { text = fs.readFileSync(path.join(queueDir, f), 'utf8'); }
    catch { continue; }
    const statusMatch = text.match(/^status:\s*([A-Za-z0-9_-]+)/m);
    const status = statusMatch ? statusMatch[1] : '';
    if (closedStates.has(status)) continue;
    const re = /\brun-[A-Za-z0-9_-]+\b/g;
    let m;
    while ((m = re.exec(text)) !== null) cited.add(m[0]);
  }
  return cited;
}

// ─── Graduation Detection (unchanged from prior version) ────────────────────

function detectGraduation(wsDir, gcConfig) {
  const archiveDir = path.join(wsDir, 'findings', 'archive');
  if (!fs.existsSync(archiveDir)) return [];

  const files = globFiles(archiveDir, 'FIND-*.yaml');
  const patterns = {};
  const dedupGroups = {};

  for (const filePath of files) {
    const { ok, data } = readYAMLFile(filePath);
    if (!ok) continue;
    if (data.status !== 'resolved') continue;

    const key = data.problem_class ||
                `${data.category || 'unknown'}:${(data.affected_files || data.files_involved || [''])[0]}`;
    if (!patterns[key]) patterns[key] = { count: 0, findings: [] };
    patterns[key].count++;
    patterns[key].findings.push(data.id);

    if (data.dedup_key) {
      if (!dedupGroups[data.dedup_key]) dedupGroups[data.dedup_key] = { count: 0, findings: [] };
      dedupGroups[data.dedup_key].count++;
      dedupGroups[data.dedup_key].findings.push(data.id);
    }
  }

  const candidates = [];
  for (const [pattern, info] of Object.entries(patterns)) {
    if (info.count >= gcConfig.graduation_threshold) {
      candidates.push({ pattern, count: info.count, type: 'failure_library', findings: info.findings });
    }
  }
  for (const [dedupKey, info] of Object.entries(dedupGroups)) {
    if (info.count >= gcConfig.recurrence_threshold) {
      candidates.push({ pattern: dedupKey, count: info.count, type: 'invariant', findings: info.findings });
    }
  }
  return candidates;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// ─── Event-chunk rotation (WS-428) ──────────────────────────────────────────
//
// Event chunks are JSONL files (YYYY-MM-DD.jsonl) on a hash chain — NOT YAML
// entities with a status/completed_at field, so the generic gcEntityType driver
// does not apply. Age comes from the filename date. Archival MOVES old chunks
// to events/archive/; events.listChunks() unions both dirs, so the chain + replay
// stay whole (INV-031/INV-044 preserved — nothing is deleted). A fence event +
// boundary anchor are recorded so a future capability can replay from a snapshot
// even if archived chunks are physically removed (WS-428 Stage C, ADR-gated).
function gcEventChunks(wsDir, gcConfig, today, dryRun) {
  const ev = loadEventsMod();
  if (!ev) return { type: 'events', archived: 0, skipped: 0 };

  const archiveDays = gcConfig.events_archive_days || 90;
  // Hard floor from events.js takes precedence over a too-low config value.
  const keepMin = Math.max(ev.KEEP_MIN_LIVE_CHUNKS || 1, gcConfig.events_keep_min_chunks || 7);

  const liveChunks = ev.listLiveChunks(wsDir); // sorted ascending by date
  if (liveChunks.length === 0) return { type: 'events', archived: 0, skipped: 0 };

  // Never archive the newest keepMin chunks, regardless of age — chainHead /
  // appendEvent always need live context.
  const eligibleByCount = liveChunks.slice(0, Math.max(0, liveChunks.length - keepMin));

  const toArchive = [];
  for (const chunkPath of eligibleByCount) {
    const base = path.basename(chunkPath);
    const date = base.replace(/\.jsonl$/, '');
    const age = dateDiffDays(date, today);
    if (age >= archiveDays) toArchive.push({ chunkPath, base, date, age });
  }

  const skipped = liveChunks.length - toArchive.length;
  if (toArchive.length === 0) return { type: 'events', archived: 0, skipped };

  const boundaryDate = toArchive[toArchive.length - 1].date; // newest archived

  if (dryRun) {
    for (const t of toArchive) {
      console.log(`  [dry-run] Would archive events chunk: ${t.base} (${t.age}d old)`);
    }
    return { type: 'events', archived: toArchive.length, skipped, dry_run: true };
  }

  const archiveDir = ev.eventsArchiveDir(wsDir);
  ensureDir(archiveDir);

  // Boundary anchor: read the archived chunks (still in place) to capture the
  // chain head + counts, plus a bounded replay of state AT the boundary. The
  // domains snapshot is what lets replay survive a physically-trimmed log
  // (WS-428 Stage C) — replay can seed from it and apply only the live tail.
  const anchor = computeBoundaryAnchor(toArchive, ev);
  let snapshotRef = null;
  try {
    let domains = null;
    try {
      const replay = loadReplayMod();
      if (replay) {
        replay.loadAllReducers();
        // Bounded replay over chunks <= boundary (chunks are still in place).
        domains = replay.replayToMemory(wsDir, { upTo: boundaryDate }).domains;
      }
    } catch (e) {
      console.error(`  WARN: snapshot domains capture failed (non-fatal): ${e.message}`);
    }
    const snapName = `snapshot-${boundaryDate}.json`;
    const snapshot = {
      boundary_date: boundaryDate,
      last_event_id: anchor.last_event_id,
      boundary_hash: anchor.boundary_hash,
      archived_event_count: anchor.event_count,
      domains, // null only if replay engine was unavailable
      stage: domains ? 'C' : 'B',
    };
    fs.writeFileSync(path.join(archiveDir, snapName), JSON.stringify(snapshot, null, 2));
    snapshotRef = `events/archive/${snapName}`;
  } catch (e) {
    // The snapshot is a forward-looking anchor; its failure must not block the
    // safe, reversible move below.
    console.error(`  WARN: events snapshot capture failed (non-fatal): ${e.message}`);
  }

  const archivedFiles = [];
  for (const t of toArchive) {
    fs.renameSync(t.chunkPath, path.join(archiveDir, t.base));
    archivedFiles.push(t.base);
  }

  // Emit via ev.appendEvent bound to THIS wsDir (not the generic emitEvent
  // helper, which resolves the workstream via findWorkstreamDir and would write
  // to the wrong log when gc runs with --workstream-dir / in a test sandbox).
  try {
    ev.appendEvent({
      source_track: 'T6:workstream',
      track_tag: 'gc:events-archive',
      payload: {
        type: 'events_archived',
        boundary_date: boundaryDate,
        archived_files: archivedFiles,
        archived_count: archivedFiles.length,
        boundary_hash: anchor.boundary_hash,
        snapshot_ref: snapshotRef,
      },
    }, { workstreamDir: wsDir });
  } catch (e) {
    // AS-23: a fence-emit failure must not unwind the completed move.
    console.error(`  WARN: events_archived fence emit failed (non-fatal): ${e.message}`);
  }

  return { type: 'events', archived: archivedFiles.length, skipped, boundary_date: boundaryDate };
}

// Read the to-be-archived chunks (ascending by date) and return the chain head
// at the boundary: the last event's id + content_hash, plus the event count.
function computeBoundaryAnchor(toArchive, ev) {
  let count = 0;
  let lastEv = null;
  for (const t of toArchive) {
    const { events } = ev.readChunk(t.chunkPath);
    count += events.length;
    if (events.length) lastEv = events[events.length - 1];
  }
  return {
    last_event_id: lastEv ? lastEv.id : null,
    boundary_hash: lastEv ? lastEv.content_hash : '',
    event_count: count,
  };
}

if (require.main === module) {
  main();
}

module.exports = { gcEventChunks, computeBoundaryAnchor, loadConfig };
