#!/usr/bin/env node
/**
 * cwos-reconcile — Mandatory post-mutation state reconciliation.
 *
 * Rebuilds all CWOS indexes (queue, findings, sprint, enhancements, readiness)
 * from source files, reconciles all 7 counters in config.yaml, and validates
 * cross-file integrity. Idempotent and safe to run any time.
 *
 * Usage:
 *   node cwos-reconcile.js                       # rebuild all + validate + report
 *   node cwos-reconcile.js --quiet               # silent unless violations
 *   node cwos-reconcile.js --dry-run             # compute but don't write
 *   node cwos-reconcile.js --strict              # exit 1 on any violation
 *   node cwos-reconcile.js --workstream-dir <p>  # explicit workstream dir
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { rebuildAll } = require('./lib/cwos-reconcile-core');
const { findWorkstreamDir, globFiles, readYAMLFile, writeFileAtomic, todayISO, withFileLock, loadEventDeps, resolveEvolutionDir } = require('./lib/cwos-utils');

const { appendEvent } = loadEventDeps();
let renderEventsLog = null;
try { ({ renderEventsLog } = require('./core/render-events')); } catch {}
let _eventsEmittedThisRun = 0;
function emitEvent(track, tag, payload) {
  if (!appendEvent) return;
  try {
    appendEvent({ source_track: track, track_tag: tag, payload: payload || {} });
    _eventsEmittedThisRun += 1;
  } catch { /* shadow writes must never break the host command */ }
}
function maybeRegenView() {
  if (!renderEventsLog || _eventsEmittedThisRun === 0) return;
  if (process.env.CWOS_SKIP_RENDER === '1') return;
  try { renderEventsLog({}); } catch { /* silent */ }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const dryRun = args.includes('--dry-run');
  const strict = args.includes('--strict');
  const checkDrift = args.includes('--check-drift');
  const json = args.includes('--json');

  let wsDir;
  const dirIdx = args.indexOf('--workstream-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    wsDir = path.resolve(args[dirIdx + 1]);
  } else {
    try { wsDir = findWorkstreamDir(process.cwd()); }
    catch { console.error('ERROR: Could not find .claude/workstream/ directory.'); process.exit(1); }
  }

  // --check-drift: lightweight mode (WS-257). Skips rebuild + most validators;
  // runs only the state-drift detector and exits 1 if drift found, 0 otherwise.
  // Used by /next Step 2 and the SessionStart hook to gate on drift before
  // composing sprints or surfacing vitals.
  if (checkDrift) {
    const queueDir = path.join(wsDir, 'queue');
    const queueFiles = fs.existsSync(queueDir) ? globFiles(queueDir, 'WS-*.yaml') : [];
    const queueItems = [];
    for (const f of queueFiles) {
      const r = readYAMLFile(f);
      if (r.ok && r.data) queueItems.push(r.data);
    }
    const drifts = validateStateDrift(wsDir, queueItems, null);
    if (json) {
      console.log(JSON.stringify({ drifts }, null, 2));
    } else if (drifts.length === 0) {
      if (!quiet) console.log('cwos-reconcile --check-drift: no state-drift detected.');
    } else {
      console.log(`STATE DRIFT DETECTED (${drifts.length} item(s)):`);
      for (const d of drifts) {
        console.log(`  ${d.ws_id} (${d.current_status}) — ${d.title}`);
        console.log(`    ${d.paths_existing}/${d.paths_total} files_involved exist with content`);
        console.log(`    commit ${d.completion_commit}: "${d.completion_message}"`);
        console.log(`    Resolve: /workstream done ${d.ws_id} --commit ${d.completion_commit}`);
      }
    }
    process.exit(drifts.length > 0 ? 1 : 0);
  }

  // Pre-Phase 0: forward-recover any crashed rebalance (WS-264).
  //   If a rebalance staged files but didn't promote them (e.g., kill -9
  //   between staging and promote), promote them now via atomic rename and
  //   emit a recovery event so the event log records the action.
  if (!dryRun) {
    let rebalanceMod = null;
    try { rebalanceMod = require('./core/rebalance'); } catch { /* not present */ }
    if (rebalanceMod) {
      try {
        const rec = rebalanceMod.recoverRebalance({ workstreamDir: wsDir });
        if (rec && rec.recovered && rec.recovered.length > 0 && !quiet) {
          console.log(`cwos-reconcile: recovered ${rec.recovered.length} stranded rebalance staging file(s): ${rec.recovered.join(', ')}`);
        }
      } catch (err) {
        if (!quiet) console.error(`cwos-reconcile: rebalance recovery failed: ${err.message}`);
      }
    }
  }

  // Phase 0: propagate done status from sprint items to queue items.
  //   Root cause for SPR-032/036/041/042 drift: sprint YAMLs marked items done
  //   but queue/WS-*.yaml stayed backlog. Reconcile now fixes this structurally.
  const promotions = promoteStaleQueueItemsFromSprints(wsDir, dryRun);

  // Shadow event (WS-174): one event per promotion. Only fires when there's
  // an actual state change — per conditional-mutation decision (no heartbeat).
  if (!dryRun && promotions.length > 0) {
    for (const p of promotions) {
      emitEvent('T6:reconcile-queue', 'queue-promoted-from-sprint', {
        item_id: p.item_id, sprint_id: p.sprint_id, reason: 'sprint-authoritative-done',
      });
    }
  }

  // Phase 1: rebuild all indexes + reconcile counters
  const result = rebuildAll(wsDir, { dryRun });

  // Shadow event (WS-174): emit per index-section that had to fix something
  // (warnings present) and for counters when patches applied. Indexes are
  // idempotent — re-running with no drift produces no warnings, so nothing
  // fires (conditional-mutation decision: only on actual mutation).
  if (!dryRun && result) {
    for (const key of ['queue', 'findings', 'sprints', 'enhancements', 'readiness']) {
      const section = result[key];
      if (section && Array.isArray(section.warnings) && section.warnings.length > 0) {
        emitEvent('T6:reconcile-index', `index-fixed:${key}`, {
          index: key,
          warning_count: section.warnings.length,
          item_count: Array.isArray(section.items) ? section.items.length : null,
        });
      }
    }
    if (result.counters && Array.isArray(result.counters.patches) && result.counters.patches.length > 0) {
      emitEvent('T6:reconcile-counters', 'config-counters-patched', {
        patch_count: result.counters.patches.length,
      });
    }
  }

  // Phase 2: cross-reference validation (operates on rebuilt data)
  const violations = [];
  const warnings = [...result.warnings];

  validateSprintReferences(result.queue.items, result.sprints.items, wsDir, violations);
  validateFindingReferences(result.queue.items, result.findings.items, wsDir, violations);
  validateFindingPointers(wsDir, result.findings.items, warnings);
  validateIdCollisions(result, violations);
  validateStatusDomain(result.queue.items, ALLOWED_QUEUE_STATUSES, 'queue', warnings);
  validateStatusDomain(result.findings.items, ALLOWED_FINDING_STATUSES, 'findings', warnings);
  validateStatusDomain(result.sprints.items, ALLOWED_SPRINT_STATUSES, 'sprints', warnings);

  // Phase 2b: plan-doc reconciliation — detect orphan plan items and
  // orphan plan decisions (WS-X / D-N referenced in docs/*-plan.md with
  // no matching queue/WS-*.yaml or DEC-NNN in decisions.md).
  // Root cause defense for the 2026-04-20 incident (WS-A..WS-M defined in
  // docs/self-compliance-plan.md were never materialized in the queue).
  validatePlanDocs(wsDir, warnings);

  // Phase 2c: staleness SLA — flag canonical docs past their refresh window.
  validateStaleness(wsDir, warnings);

  // Phase 2d: AS-N / Market Dynamics structural validation.
  //   Feeds findings into prog-product-evolution's Unlabeled Load-Bearing
  //   Assumption problem class via the warnings channel. Per framework-spec
  //   §5.7 — added 2026-04-22 (run-corr-md-001, WS-MD-008).
  validateAssumptions(wsDir, warnings);

  // Phase 2e: Engine calibration drift (WS-229).
  //   Computes per-engine Spearman correlation between quality-judge's
  //   `overall` score and findings-feedback signal_rate. When ≥20 paired
  //   points exist for an engine and |ρ| < 0.3, the constitution's overall
  //   score is decoupled from founder relevance — the engine is gaming
  //   the rubric. Surfaces as a warning routed to prog-engine-reliability.
  validateEngineCalibration(wsDir, warnings);

  // Phase 2f: State-drift detector (WS-257).
  //   Catches the failure mode that surfaced in SPR-097: WS items shipped
  //   via commit without ever flipping queue/WS-NNN.yaml from backlog to
  //   done. Phase 0 (promoteStaleQueueItemsFromSprints) handles drift
  //   between sprint-state and queue-state; this validator handles drift
  //   between commit-state and queue-state — work shipped outside the
  //   sprint loop entirely. Routed to prog-program-integrity.
  validateStateDrift(wsDir, result.queue.items, warnings);

  // Phase 2g: Auto-rec phantom-run-ref detector (FIND-130 / WS-167 fix).
  //   Catches the failure mode that surfaced via WS-167: an auto-rec WS item
  //   was generated referencing run-012, which never existed. The auto-rec
  //   generator (session-start.md prose) had no validation that referenced
  //   run-ids resolve to actual artifacts. Walks queue items where
  //   source: auto-recommendation, regex-extracts run-NNN tokens from
  //   title/description, and verifies each resolves to either the global
  //   runs/ directory OR the program's evidence/<program>/ directory.
  //   Flags unresolvable references as warnings routed to
  //   prog-program-integrity.
  validateAutoRecRunRefs(wsDir, result.queue.items, warnings);

  // Phase 2h: Program protocol→engine reference validator (WS-294 / FIND-126).
  //   Walks every program YAML and checks each `protocols.<name>.engine` value
  //   against the active engines list in `.claude/workstream/engines/registry.yaml`.
  //   Active = uncommented entries in the `engines:` map. Historical refs
  //   under `protocol_history[].engine` and `last_run_by_protocol.<name>.engine`
  //   are intentionally skipped — those record what ran when, even if that
  //   engine was later retired. Routed as warnings to prog-program-integrity.
  validateProgramProtocolEngineRefs(wsDir, warnings);

  // Phase 2i: Findings→Work-Item promotion validator (WS-371 / FIND-253).
  //   For each program protocol_history entry where findings > 0 AND
  //   spec_compliant !== false, assert (a) the authored work_items count
  //   matches the actual count of queue items tagged with that run_id, and
  //   (b) every FIND with severity ≥ MEDIUM produced in the run has a
  //   corresponding WS item. Emits promotion_gap events on T6:reconcile-findings
  //   for /pulse to render as CRITICAL lines. Routed as warnings to
  //   prog-program-integrity. Pure function of YAML state at call time.
  const promotionGaps = validateFindingPromotion(wsDir, result.queue.items, result.findings.items, warnings);

  // Phase 2j: AS-N falsification auto-evaluation (WS-351 Part B / FIND-233).
  //   Walks each program's assumptions[] block. For AS-N with structured
  //   thresholds (currently AS-51), evaluates against the promotion-gap
  //   output. AS-51 falsifies when any finding_orphaned gap exists for a
  //   run > 72h old (loop demonstrably did not close). On match, mutates
  //   assumption status: active → contradicted in the program YAML and
  //   emits assumption_contradicted event. Idempotent — already-contradicted
  //   AS-Ns are skipped.
  evaluateAssumptionFalsification(wsDir, todayISO(), promotionGaps, warnings, dryRun);

  // Phase 2k: Auto-promote open findings → queue items (kit-v3.7.0 / Bug A).
  //   For each FIND-*.yaml with status: open AND proposed_route.would_promote_to_queue: true
  //   AND severity passes .cwos-config.yaml priority.auto_promote, allocate a WS-NNN id,
  //   write the queue YAML, and mutate the FIND's promoted_to field. Pre-3.7.0 the
  //   constitutional-audit engine wrote FIND-CA-*.yaml correctly but no code path
  //   materialized them into the queue — /next gate passed against an empty
  //   candidate list even after a critical audit finding. See cwos-finding-promote.js.
  let promotionReport = null;
  if (!dryRun) {
    promotionReport = runAutoPromoteFindings(wsDir, quiet);
    if (promotionReport && Array.isArray(promotionReport.promoted)) {
      for (const p of promotionReport.promoted) {
        emitEvent('T6:workstream', 'finding-promoted', {
          finding_id: p.finding_id,
          ws_id: p.ws_id,
          severity: p.severity,
        });
      }
    }
  }

  // Phase 2l: Exception sunset detection (WS-413 / FIND-272).
  //   Scans .claude/workstream/evidence/ for exception artifacts with
  //   sunset_date fields. Emits findings for at_risk (≤7 days), past_in_grace,
  //   past_grace_lapsed (RED), and cascading AS-N transitions. The script
  //   itself acquires its own ID lock + dedup; we just invoke and surface.
  //   Non-fatal: failures are warnings, never block reconcile.
  if (!dryRun) {
    try {
      const { spawnSync } = require('child_process');
      const checker = path.join(__dirname, 'cwos-exception-sunset-check.js');
      if (fs.existsSync(checker)) {
        const r = spawnSync(process.execPath, [checker], {
          cwd: path.resolve(wsDir, '..', '..'),
          encoding: 'utf8',
        });
        // Exit code 4 = past sunset; surface but don't break reconcile.
        // The pre-commit hook is the gate, not reconcile.
        if (r.status !== 0 && r.status !== 1 && r.status !== 4) {
          warnings.push(`Phase 2l (exception-sunset): unexpected exit ${r.status}`);
        }
      }
    } catch (e) {
      warnings.push(`Phase 2l (exception-sunset) threw: ${e.message}`);
    }
  }

  // Phase 2m: Program accountability cap enforcement (WS-350 / FIND-232).
  //   For each program YAML, count live work_items_open from result.queue.items
  //   and findings_open from result.findings.items. Compare work_items_open to
  //   accountability.on_finding.max_open_items. If exceeded, mark
  //   cap_breach.active=true on the program YAML; otherwise clear it. Mutates
  //   the YAML's findings_open/work_items_open to live counts (closes the
  //   hand-maintenance drift session-end was supposed to fix). Emits
  //   program_cap_breach / program_cap_cleared on T6:program-integrity only on
  //   transition (clean→breached or breached→clean) — idempotent re-runs emit
  //   nothing. Routed as warnings to prog-program-integrity.
  const capReport = validateProgramCaps(wsDir, result.queue.items, result.findings.items, warnings, dryRun);
  if (!dryRun && capReport) {
    for (const t of capReport.transitions) {
      const track = 'T6:program-integrity';
      if (t.kind === 'breach') {
        emitEvent(track, 'program_cap_breach', {
          program: t.program,
          work_items_open: t.work_items_open,
          findings_open: t.findings_open,
          max_open_items: t.max_open_items,
          priority_floor: t.priority_floor,
          ratio: t.ratio,
        });
      } else if (t.kind === 'cleared') {
        emitEvent(track, 'program_cap_cleared', {
          program: t.program,
          work_items_open: t.work_items_open,
          max_open_items: t.max_open_items,
        });
      }
    }
    if (!quiet && capReport.mutations > 0) {
      const breachedCount = Object.values(capReport.capsByProgram).filter(c => c.cap_breach_active).length;
      console.log(`  program-caps:       ${capReport.mutations} program YAML(s) refreshed (${breachedCount} in breach, ${capReport.transitions.length} transition(s))`);
    }
  }

  // Phase 2n: engine_run_completed backfill sweep (WS-466 / FIND-122).
  //   Root-cause fix for the "structurally inert" ADR-038 contract pipeline:
  //   the verifier (cwos-engine-contract-verify) + token meter (cwos-token-budget)
  //   only receive data when /engine Step 6 emits engine_run_completed per run.
  //   That emission was ritual-dependent — runs where Step 6 was skipped dropped
  //   silently out of the pipeline (DEC-029). Reconcile runs at every session
  //   boundary, so hosting the sweep here makes emission deterministic: any run
  //   with a completion artifact but no event gets one by the next reconcile.
  //   Passive healer — never writes FIND-MFST findings; manifest-gated runs are
  //   recorded under skipped. Idempotent; non-fatal (failures become warnings).
  if (!dryRun) {
    try {
      const { runSweep } = require('./cwos-engine-complete');
      const eventsDir = path.join(wsDir, 'events');
      const root = path.resolve(wsDir, '..', '..');
      const sweep = runSweep({ wsDir, eventsDir, root });
      if (sweep && Array.isArray(sweep.emitted) && sweep.emitted.length > 0) {
        for (const e of sweep.emitted) {
          emitEvent('T7:engines', 'engine-completion-backfilled', {
            run_id: e.run_id,
            event_id: e.event_id,
            source: 'reconcile-sweep',
          });
        }
        if (!quiet) {
          console.log(`  engine-sweep:       ${sweep.emitted.length} missing engine_run_completed event(s) backfilled (${sweep.skipped.length} skipped)`);
        }
      }
    } catch (e) {
      warnings.push(`Phase 2n (engine-completion sweep) threw: ${e.message}`);
    }
  }

  // Phase 3: report
  if (!quiet) {
    printSummary(result, violations, warnings, dryRun, promotions);
  } else if (violations.length > 0 || promotions.length > 0) {
    printSummary(result, violations, warnings, dryRun, promotions);
  }

  // WS-207 (SPR-064): reducer auto-refresh. Emit one T6:workstream +
  // one T11:vital-signs event with track_tag 'reconcile-refresh' so the
  // queue/findings/sprints/programs reducers re-materialize state/*.json
  // from the reconciled YAMLs. Fires unconditionally at end-of-reconcile
  // so state stays in sync with directory edits between events.
  if (!dryRun) {
    emitEvent('T6:workstream', 'reconcile-refresh', {
      type: 'reconcile-refresh',
      domains_intended: ['queue', 'findings', 'sprints'],
    });
    emitEvent('T11:vital-signs', 'reconcile-refresh', {
      type: 'reconcile-refresh',
      domains_intended: ['programs'],
    });
  }

  // WS-178: regenerate rendered event view if any events fired during this run.
  maybeRegenView();

  if (strict && violations.length > 0) process.exit(1);
}

// ─── Phase 2k: Auto-promote findings → queue items (kit-v3.7.0 / Bug A) ───
//
// Reads .cwos-config.yaml priority.auto_promote rules, then for each open
// finding with proposed_route.would_promote_to_queue: true and a passing
// severity gate, allocates the next WS-NNN id, writes the queue YAML, and
// updates the finding's promoted_to field. Idempotent — re-running the
// reconcile yields zero promotions because every promoted finding has
// promoted_to set on the next pass.
//
// Lives in cwos-finding-promote.js; this wrapper handles the config read,
// summary print, and warning-routing for severity-gated skips.

function runAutoPromoteFindings(wsDir, quiet) {
  let cwosConfig = null;
  const repoRootDir = path.resolve(wsDir, '..', '..');
  const cfgPath = path.join(repoRootDir, '.cwos-config.yaml');
  if (fs.existsSync(cfgPath)) {
    const r = readYAMLFile(cfgPath);
    if (r.ok) cwosConfig = r.data;
  }

  let promoteLib;
  try { promoteLib = require('./lib/cwos-finding-promote'); }
  catch { return null; }

  const report = promoteLib.promoteOpenFindings(wsDir, cwosConfig || {});

  if (!quiet) {
    if (report.promoted.length > 0) {
      console.log(`  Auto-promoted ${report.promoted.length} finding(s) → queue item(s):`);
      for (const p of report.promoted) {
        console.log(`    - ${p.finding_id} (${p.severity}) → ${p.ws_id}`);
      }
    }
    if (report.errors.length > 0) {
      console.log(`  Auto-promote errors (${report.errors.length}):`);
      for (const e of report.errors) {
        console.log(`    - ${e.finding_id || e.file}: ${e.reason}`);
      }
    }
  }
  return report;
}

// ─── Phase 0: Sprint → Queue Status Promotion ──────────────────────────────

// True iff `a` is a strictly later instant than `b`. Tolerates ISO date-only
// ("2026-05-22") and full timestamps; returns false if either is missing/unparseable
// (callers treat "can't tell" as "don't skip"). Used by the WS-040 re-issued-ID guard.
function isLaterThan(a, b) {
  if (!a || !b) return false;
  const da = new Date(a), db = new Date(b);
  if (isNaN(da.getTime()) || isNaN(db.getTime())) return false;
  return da.getTime() > db.getTime();
}

// Scan all sprint YAMLs (active + archive). For every sprint item with
// status=done, verify the corresponding queue/WS-*.yaml is also status=done.
// If not, auto-promote the queue item: sprint files are authoritative for
// per-item completion state (per DEC-016 + SPR-051 root cause finding).
// Returns array of { item_id, sprint_id, sprint_completed_at } for reporting.
function promoteStaleQueueItemsFromSprints(wsDir, dryRun) {
  const promotions = [];
  const queueDir = path.join(wsDir, 'queue');
  if (!fs.existsSync(queueDir)) return promotions;

  const sprintDirs = [path.join(wsDir, 'sprints'), path.join(wsDir, 'sprints', 'archive')];
  const sprintFiles = [];
  for (const dir of sprintDirs) {
    if (fs.existsSync(dir)) sprintFiles.push(...globFiles(dir, 'SPR-*.yaml'));
  }

  for (const sprintFile of sprintFiles) {
    const { ok, data } = readYAMLFile(sprintFile);
    if (!ok || !Array.isArray(data.items)) continue;
    const sprintId = data.id || path.basename(sprintFile, '.yaml');
    const sprintCompletedAt = data.completed_at || null;

    for (const spItem of data.items) {
      if (!spItem || spItem.status !== 'done' || !spItem.id) continue;
      // Only promote queue items (WS-*). SPR-internal items (e.g., SPR051-1)
      // don't have queue files and must be skipped.
      if (!/^WS-\d+$/.test(spItem.id)) continue;

      const queueFile = path.join(queueDir, `${spItem.id}.yaml`);
      if (!fs.existsSync(queueFile)) continue;

      const { ok: qOk, data: qData } = readYAMLFile(queueFile);
      if (!qOk) continue;
      if (qData.status === 'done') continue; // already in sync

      // WS-040 fix: a done sprint is authoritative ONLY for its genuine members.
      // Match-by-ID alone is unsafe because WS-NNN ids can be RE-ISSUED: an
      // archived done sprint may list an old WS-033 while queue/WS-033.yaml is now
      // a brand-new, unrelated backlog item. Promoting it silently marks the new
      // item done and makes it vanish from the queue (the SPR-018 incident).
      // Genuine members claim the sprint via sprint_id; never promote an item that
      // belongs to a different sprint, or that was created after this sprint completed.
      const memberOfThisSprint = (qData.sprint_id || '') === sprintId;
      if (!memberOfThisSprint) {
        const belongsElsewhere = !!(qData.sprint_id && qData.sprint_id !== sprintId);
        const createdAfterSprint = isLaterThan(qData.created_at, sprintCompletedAt);
        if (belongsElsewhere || createdAfterSprint) {
          console.error(
            `  [reconcile] skip promote ${spItem.id}: queue item does not claim ${sprintId}` +
            `${belongsElsewhere ? ` (claims ${qData.sprint_id})` : ''}` +
            `${createdAfterSprint ? ` and was created ${qData.created_at} after sprint completed ${sprintCompletedAt}` : ''}` +
            ` — likely a re-issued ID, not the archived member.`
          );
          continue;
        }
      }

      // Promote
      promotions.push({
        item_id: spItem.id,
        sprint_id: sprintId,
        prior_status: qData.status || 'unknown',
        sprint_completed_at: sprintCompletedAt,
      });

      if (dryRun) continue;

      const raw = fs.readFileSync(queueFile, 'utf8');
      const completedAt = sprintCompletedAt || todayISO();
      let patched = raw.replace(
        /^status:\s*.*$/m,
        `status: done`
      );
      // Insert completed_at if missing; otherwise leave existing value alone.
      if (!/^completed_at:/m.test(patched)) {
        patched = patched.replace(
          /^status:\s*done$/m,
          `status: done\ncompleted_at: "${completedAt}"`
        );
      }
      // Append an auto-promotion note so the paper trail is obvious.
      const note = `auto_promoted_by_reconcile: "${todayISO()} — sprint ${sprintId} was status=done but queue item was ${qData.status || 'unknown'}"`;
      if (!/^auto_promoted_by_reconcile:/m.test(patched)) {
        patched = patched.trimEnd() + `\n${note}\n`;
      }
      withFileLock(queueFile + '.lock', () => {
        writeFileAtomic(queueFile, patched);
      }, { ownerLabel: 'reconcile:promote-stale', maxWaitMs: 5000 });
    }
  }
  return promotions;
}

// ─── Per-Source-Class Drift Report (WS-230) ────────────────────────────────
// Classifies backlog items by their source field shape and reports mean
// priority_score per class. Two risk classes (auto-rec, engine-finding) are
// the primary watch — these are machine-emitted and prone to RICE inflation.
// Founder-driven classes are also reported so the comparison is visible.
// Returns array of { cls, mean, count } sorted by count descending.
function computeSourceClassDrift(queueItems) {
  if (!Array.isArray(queueItems)) return [];
  const buckets = {};
  for (const it of queueItems) {
    if (!it || it.status !== 'backlog') continue;
    const cls = classifySource(it.source);
    if (!buckets[cls]) buckets[cls] = { sum: 0, count: 0 };
    const score = typeof it.priority_score === 'number' ? it.priority_score : 0;
    buckets[cls].sum += score;
    buckets[cls].count += 1;
  }
  return Object.entries(buckets)
    .map(([cls, b]) => ({ cls, mean: b.sum / b.count, count: b.count }))
    .sort((a, b) => b.count - a.count);
}

// Classify a queue item's source field. Must stay in sync with /next Step 2d.
function classifySource(src) {
  if (src === 'auto-recommendation' || src === 'auto_recommendation') return 'auto-rec';
  if (src && typeof src === 'object') {
    if (src.engine) return 'engine-finding';
    if (src.pre_mortem_id) return 'pre-mortem';
    if (src.parent_ws) return 'spr-followup';
    if (src.plan) return 'plan-internal';
    if (src.conversation) return 'conversation';
  }
  return 'untagged';
}

// ─── Validators ─────────────────────────────────────────────────────────────

const ALLOWED_QUEUE_STATUSES = new Set(['backlog', 'in-progress', 'in_progress', 'claimed', 'done', 'blocked', 'deferred', 'dismissed']);
const ALLOWED_FINDING_STATUSES = new Set(['open', 'resolved', 'dismissed', 'deferred', 'duplicate']);
// `completed` is the legacy template term; `done` is what cwos-next's
// renderSprintYamlClosed actually writes today (and the only status the
// sprint→queue sync reader keys on). Both are valid terminal states.
const ALLOWED_SPRINT_STATUSES = new Set(['proposed', 'approved', 'active', 'completed', 'done', 'abandoned']);

function validateSprintReferences(queueItems, sprintItems, wsDir, violations) {
  const sprintIds = new Set(sprintItems.map(s => s.id));

  // Check archived sprints too — queue items may reference archived sprints
  const archivedSprintsDir = path.join(wsDir, 'sprints', 'archive');
  if (fs.existsSync(archivedSprintsDir)) {
    const archivedFiles = globFiles(archivedSprintsDir, 'SPR-*.yaml');
    for (const f of archivedFiles) {
      const m = path.basename(f).match(/^(SPR-\d+)/);
      if (m) sprintIds.add(m[1]);
    }
  }

  // Every queue item with sprint_id must point to a known sprint
  for (const item of queueItems) {
    if (item.sprint_id && !sprintIds.has(item.sprint_id)) {
      violations.push({
        type: 'orphan_sprint_ref',
        id: item.id,
        detail: `${item.id} references sprint_id ${item.sprint_id} which does not exist (active or archive)`
      });
    }
  }
}

function validateFindingReferences(queueItems, findingItems, wsDir, violations) {
  const findingIds = new Set(findingItems.map(f => f.id));

  // Check archived findings
  const archivedFindingsDir = path.join(wsDir, 'findings', 'archive');
  if (fs.existsSync(archivedFindingsDir)) {
    const archivedFiles = globFiles(archivedFindingsDir, 'FIND-*.yaml');
    for (const f of archivedFiles) {
      const m = path.basename(f).match(/^(FIND-\d+)/);
      if (m) findingIds.add(m[1]);
    }
  }

  // Every queue item with finding_id must point to a known finding
  for (const item of queueItems) {
    if (item.finding_id && !findingIds.has(item.finding_id)) {
      violations.push({
        type: 'orphan_finding_ref',
        id: item.id,
        detail: `${item.id} references finding_id ${item.finding_id} which does not exist (active or archive)`
      });
    }
  }

  // Resolved findings should not have an open work item linked to them — but we
  // can only do the inverse check (open finding linked to done work item) when
  // the queue item carries the link. Done work items linked to open findings
  // suggest the finding should have been resolved.
  const findingById = new Map(findingItems.map(f => [f.id, f]));
  for (const item of queueItems) {
    if (item.status === 'done' && item.finding_id) {
      const finding = findingById.get(item.finding_id);
      if (finding && finding.status === 'open') {
        violations.push({
          type: 'finding_status_drift',
          id: item.id,
          detail: `${item.id} (done) is linked to ${item.finding_id} (open) — finding should be resolved`
        });
      }
    }
  }
}

// WS-320 — Detects free-text FIND-NNN references in queue and program YAMLs
// that point to non-existent FIND files. Distinct from validateFindingReferences
// (which only checks the structured `finding_id` field on queue items).
//
// The failure mode this guards: between WS draft time and FIND creation time,
// the FIND-NNN allocator can re-assign an ID, leaving a stale reference in the
// drafted WS that points to unrelated content (or nothing at all). The original
// case was WS-068 referencing FIND-058/059 which got re-allocated to kit-quality
// issues. The drift is silent because YAML parsers don't validate string
// content, and `validateFindingReferences` only checks the typed field.
//
// Scope: existence-only check (Option A per WS-320 / DEC). Semantic-mismatch
// detection (referenced FIND's program doesn't match citing context) is a
// future enhancement — ship the trip-wire, let real-world signal escalation.
function validateFindingPointers(wsDir, findingItems, warnings) {
  const findingIds = new Set(findingItems.map(f => f.id));
  const archivedFindingsDir = path.join(wsDir, 'findings', 'archive');
  if (fs.existsSync(archivedFindingsDir)) {
    const archivedFiles = globFiles(archivedFindingsDir, 'FIND-*.yaml');
    for (const f of archivedFiles) {
      const m = path.basename(f).match(/^(FIND-\d+)/);
      if (m) findingIds.add(m[1]);
    }
  }

  const findRefRegex = /FIND-\d+/g;
  const scanRoots = [
    path.join(wsDir, 'queue'),
    path.join(wsDir, 'programs'),
  ];

  const dangling = []; // { ref, file, line, ctx }

  for (const root of scanRoots) {
    if (!fs.existsSync(root)) continue;
    let entries;
    try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (e.isDirectory()) continue; // skip archive/ etc — those are historical
      if (!/^(WS|prog)-.+\.ya?ml$/.test(e.name)) continue;
      const full = path.join(root, e.name);
      let content;
      try { content = fs.readFileSync(full, 'utf8'); } catch { continue; }
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const matches = lines[i].match(findRefRegex);
        if (!matches) continue;
        for (const ref of matches) {
          if (findingIds.has(ref)) continue;
          dangling.push({
            ref,
            file: path.relative(wsDir, full).replace(/\\/g, '/'),
            line: i + 1,
            ctx: lines[i].trim().slice(0, 120),
          });
        }
      }
    }
  }

  for (const d of dangling) {
    warnings.push(`finding-pointer rot: ${d.file}:${d.line} references ${d.ref} which does not exist (active or archive) — ctx: "${d.ctx}"`);
  }

  return dangling;
}

function validateIdCollisions(result, violations) {
  const checkSet = (items, label) => {
    const seen = new Set();
    for (const item of items) {
      if (seen.has(item.id)) {
        violations.push({ type: 'id_collision', id: item.id, detail: `Duplicate ${label} id: ${item.id}` });
      }
      seen.add(item.id);
    }
  };
  checkSet(result.queue.items, 'queue');
  checkSet(result.findings.items, 'findings');
  checkSet(result.sprints.items, 'sprints');
  checkSet(result.enhancements.items, 'enhancements');
  checkSet(result.readiness.items, 'readiness');
}

function validateStatusDomain(items, allowed, label, warnings) {
  for (const item of items) {
    if (item.status && !allowed.has(item.status)) {
      warnings.push(`${label}: ${item.id} has unknown status "${item.status}"`);
    }
  }
}

// ─── Output ─────────────────────────────────────────────────────────────────

function printSummary(result, violations, warnings, dryRun, promotions = []) {
  const mode = dryRun ? '[DRY RUN] ' : '';
  console.log(`${mode}cwos-reconcile complete`);
  if (promotions.length > 0) {
    console.log(`\n  Auto-promoted ${promotions.length} queue item(s) (sprint said done, queue was open):`);
    for (const p of promotions) {
      console.log(`    - ${p.item_id}: ${p.prior_status} → done (via ${p.sprint_id})`);
    }
  }
  const statusParts = Object.entries(result.queue.byStatus).map(([k, v]) => `${v} ${k}`).join(', ');
  console.log(`  queue-index:        ${result.queue.total} items (${statusParts})`);
  console.log(`  findings-index:     ${result.findings.total} findings`);
  console.log(`  sprint-index:       ${result.sprints.total} active sprints`);
  console.log(`  enhancements-index: ${result.enhancements.total} enhancements`);
  console.log(`  readiness-index:    ${result.readiness.total} reports`);

  // Per-source-class drift report (WS-230). Surfaces RICE inflation per
  // source-class so the founder can see at a glance whether engine findings
  // or auto-recs are creeping back up. Computed over backlog items only —
  // claimed/done items are no longer in the candidate pool.
  const drift = computeSourceClassDrift(result.queue.items);
  if (drift.length > 0) {
    const parts = drift.map(d => `${d.cls} mean=${d.mean.toFixed(1)} (n=${d.count})`).join('; ');
    console.log(`  source-class drift: ${parts}`);
  }

  if (result.counters.updated.length > 0) {
    console.log(`  Counters updated:   ${result.counters.updated.join(', ')}`);
  } else {
    console.log(`  Counters:           all current`);
  }

  if (warnings.length > 0) {
    console.log(`\n  Warnings (${warnings.length}):`);
    for (const w of warnings) console.log(`    - ${w}`);
  }

  if (violations.length > 0) {
    console.log(`\n  INTEGRITY VIOLATIONS (${violations.length}):`);
    for (const v of violations) console.log(`    [${v.type}] ${v.detail}`);
  } else {
    console.log(`  Integrity:          OK (0 violations)`);
  }
}

// ─── Phase 2b: Plan-Doc Reconciliation ──────────────────────────────────────

// Delegate to cwos-plan-scan.js for authoritative plan→queue/decisions
// cross-reference. Emits warnings for reconcile consumers without importing
// the scanner's internals — keeps the two scripts independently runnable.
function validatePlanDocs(wsDir, warnings) {
  const { spawnSync } = require('child_process');
  const scriptPath = path.join(__dirname, 'cwos-plan-scan.js');
  if (!fs.existsSync(scriptPath)) return; // script absent — skip silently
  const result = spawnSync('node', [scriptPath, '--json', '--workstream-dir', wsDir], {
    encoding: 'utf8',
    timeout: 10000,
  });
  if (result.signal || result.error || result.status !== 0) return;
  let report;
  try { report = JSON.parse(result.stdout); } catch { return; }
  if (!report.violations || report.violations.length === 0) return;
  for (const v of report.violations) {
    warnings.push(`plan-drift [${v.plan_id}]: ${v.type} for ${v.ref} — ${v.message}`);
  }
}

// ─── Phase 2c: Staleness SLA ────────────────────────────────────────────────

function validateStaleness(wsDir, warnings) {
  const { spawnSync } = require('child_process');
  const scriptPath = path.join(__dirname, 'cwos-staleness.js');
  if (!fs.existsSync(scriptPath)) return;
  const result = spawnSync('node', [scriptPath, '--json', '--workstream-dir', wsDir], {
    encoding: 'utf8',
    timeout: 5000,
  });
  if (result.signal || result.error || result.status !== 0) return;
  let report;
  try { report = JSON.parse(result.stdout); } catch { return; }
  if (!report.violations || report.violations.length === 0) return;
  for (const v of report.violations) {
    warnings.push(`staleness: ${v.message}`);
  }
}

// ─── Phase 2d: AS-N / Market Dynamics Structural Validation ─────────────────
//
// Per framework-spec §5.7. Runs cwos-asn-validate.js --all and surfaces every
// finding as a warning prefixed by program/problem-class routing. These are
// the backlog feeders for prog-product-evolution's "Unlabeled Load-Bearing
// Assumption" problem class (added 2026-04-22, WS-MD-009). Stage-7 stale
// findings are surfaced separately so the founder can distinguish missing
// blocks (needs retrofit) from overdue revisits (needs /audit).
function validateAssumptions(wsDir, warnings) {
  const { spawnSync } = require('child_process');
  const scriptPath = path.join(__dirname, 'cwos-asn-validate.js');
  if (!fs.existsSync(scriptPath)) return; // validator not installed — skip
  const result = spawnSync('node', [scriptPath, '--all'], {
    encoding: 'utf8',
    timeout: 10000,
    cwd: path.dirname(path.dirname(wsDir)), // up to repo root from .claude/workstream/
  });
  // Exit codes 1-4 are findings, not errors. >4 or signal means real error.
  if (result.signal || result.error) return;
  if (result.status !== null && result.status > 4) return;
  let report;
  try { report = JSON.parse(result.stdout); } catch { return; }
  if (!report.findings || report.findings.length === 0) return;

  // Count by exit-code severity so the summary doesn't drown the reader.
  let structural = 0, typeSpec = 0, mda = 0, stale = 0;
  for (const f of report.findings) {
    if (f.exit_code === 1) structural++;
    else if (f.exit_code === 2) typeSpec++;
    else if (f.exit_code === 3) mda++;
    else if (f.exit_code === 4) stale++;
  }

  if (structural + typeSpec + mda > 0) {
    warnings.push(
      `prog-product-evolution [Unlabeled Load-Bearing Assumption]: ${structural + typeSpec + mda} artifacts ` +
      `need retrofit (${structural} structural, ${typeSpec} type-specific, ${mda} MDA). ` +
      `Run: node kit/scripts/cwos-asn-validate.js --all`,
    );
  }
  if (stale > 0) {
    warnings.push(
      `prog-product-evolution [Unlabeled Load-Bearing Assumption]: ${stale} AS-N overdue for revisit. ` +
      `Run /audit to sweep and transition to at_risk or validated.`,
    );
  }
}

// ─── Phase 2e: Engine Calibration Drift (WS-229) ───────────────────────────
//
// For each engine, pair (quality-judge overall score, founder signal_rate)
// per evaluated run. When ≥20 paired points exist, compute Spearman rank
// correlation. |ρ| < 0.3 means the constitution's overall score is decoupled
// from founder relevance — the engine is gaming the rubric.
//
// Inputs:
//   - docs/evolution/quality-scores/score-<run-id>.yaml — per-run overall scores
//   - docs/evolution/findings-feedback.yaml — founder marks per finding
//   - findings/FIND-*.yaml — used to map finding_id → run_id, engine
//
// Output: warnings list. One warning per engine that fails the gate. No
// warning while data is still accumulating (<20 paired points).
function validateEngineCalibration(wsDir, warnings) {
  const rootDir = path.dirname(path.dirname(wsDir)); // up to repo root from .claude/workstream/
  const feedbackPath = path.join(resolveEvolutionDir(rootDir), 'findings-feedback.yaml'); // WS-421: scope-aware
  const scoresDir = path.join(rootDir, 'docs/evolution/quality-scores');

  if (!fs.existsSync(feedbackPath) || !fs.existsSync(scoresDir)) return; // not installed yet

  // WS-310: enforce findings-feedback.yaml integrity invariants (content_hash
  // + append-only) before computing any calibration metric. A stale or
  // tampered feedback file would corrupt every downstream signal.
  try {
    const { spawnSync } = require('child_process');
    const validateScript = path.join(rootDir, 'kit', 'scripts', 'cwos-findings-feedback-validate.js');
    if (fs.existsSync(validateScript)) {
      const r = spawnSync(process.execPath, [validateScript, '--check'], {
        cwd: rootDir, encoding: 'utf8',
      });
      if (r.status === 1) {
        warnings.push(
          `prog-kit-quality [findings-feedback integrity]: content_hash mismatch — ` +
          `findings-feedback.yaml drifted from its recorded hash. Run cwos-findings-feedback-validate.js --update ` +
          `if the change was intentional, or restore the file. (Stale data feeds AC-11 at weight 0.20.)`
        );
      } else if (r.status === 2) {
        warnings.push(
          `prog-kit-quality [findings-feedback integrity]: append-only violation — ` +
          `prior entries in findings-feedback.yaml were modified or deleted. The calibration corpus must be append-only ` +
          `to be trustworthy. See ${path.relative(rootDir, validateScript)} --check output.`
        );
      } else if (r.status === 3) {
        warnings.push(
          `prog-kit-quality [findings-feedback integrity]: schema error in findings-feedback.yaml or its manifest ` +
          `(${path.relative(rootDir, '.claude/workstream/state/findings-feedback-manifest.json')}). ` +
          `Run cwos-findings-feedback-validate.js --init if this is a fresh install.`
        );
      }
    }
  } catch { /* non-fatal — calibration check below proceeds either way */ }

  const feedbackR = readYAMLFile(feedbackPath);
  if (!feedbackR.ok || !Array.isArray(feedbackR.data.entries)) return;
  const entries = feedbackR.data.entries.filter(e => e && e.signal && e.signal !== 'pending');
  if (entries.length === 0) return; // no graded findings yet

  // Group entries by engine, compute signal_rate per (engine, run_id)
  const byEngineRun = {};
  for (const e of entries) {
    if (!e.engine || !e.run_id) continue;
    const key = `${e.engine}::${e.run_id}`;
    if (!byEngineRun[key]) byEngineRun[key] = { engine: e.engine, run_id: e.run_id, useful: 0, not_useful: 0 };
    if (e.signal === 'useful') byEngineRun[key].useful += 1;
    else if (e.signal === 'not_useful' || e.signal === 'dismiss') byEngineRun[key].not_useful += 1;
    // 'defer' is neutral, excluded from rate
  }

  // Pair with quality-score overall per run
  const pairs = []; // {engine, run_id, overall, signal_rate}
  const scoreFiles = globFiles(scoresDir, 'score-*.yaml');
  const scoresByRun = {};
  for (const sf of scoreFiles) {
    const r = readYAMLFile(sf);
    if (!r.ok || !r.data.run_id || !r.data.scores || typeof r.data.scores.overall !== 'number') continue;
    scoresByRun[r.data.run_id] = { engine: r.data.engine, overall: r.data.scores.overall };
  }

  for (const key of Object.keys(byEngineRun)) {
    const b = byEngineRun[key];
    const denom = b.useful + b.not_useful;
    if (denom === 0) continue;
    const rate = b.useful / denom;
    const score = scoresByRun[b.run_id];
    if (!score || score.engine !== b.engine) continue;
    pairs.push({ engine: b.engine, run_id: b.run_id, overall: score.overall, signal_rate: rate });
  }

  // Group pairs by engine, compute Spearman where N >= 20
  const byEngine = {};
  for (const p of pairs) {
    if (!byEngine[p.engine]) byEngine[p.engine] = [];
    byEngine[p.engine].push(p);
  }

  for (const engine of Object.keys(byEngine)) {
    const ps = byEngine[engine];
    if (ps.length < 20) continue; // data still accumulating
    const rho = spearmanCorrelation(ps.map(p => p.overall), ps.map(p => p.signal_rate));
    if (Math.abs(rho) < 0.3) {
      warnings.push(
        `prog-engine-reliability [calibration drift]: ${engine} overall-vs-feedback |ρ|=${Math.abs(rho).toFixed(2)} ` +
        `over ${ps.length} runs (gate: ≥0.30). Constitution score is decoupled from founder relevance — ` +
        `meta-engine should diff this engine's recent runs against findings-feedback.yaml to find the leak.`
      );
    }
  }
}

// ─── Phase 2f: State-Drift Detector (ADR-045 / DEC-034) ─────────────────────
//
// Detects + auto-reconciles drift between the canonical event log and the
// materialized queue YAMLs. Reads `item_closed` and `sprint_completed`
// payload events from `.claude/workstream/events/*.jsonl` and compares
// against per-WS YAML status. Two failure modes covered:
//
//   1. HARD DRIFT — `item_closed` event exists in the log but
//      queue/WS-NNN.yaml status is non-terminal (backlog/claimed/in_progress).
//      Caused by a manual YAML revert after closure, or a queue-YAML write
//      failure during cwos-next.js runDone(). Auto-reconciles by writing
//      `status: done` + `completed_at` + `completion_commit` +
//      `closed_by_event` to the queue YAML.
//
//   2. SOFT DRIFT — sprint_completed event exists for a sprint that
//      lists this item, but no `item_closed` event was emitted. Pre-ADR-045
//      sprint closures are the legacy case; goes away as new sprints close
//      via the post-ADR-045 runDone() path. Defers to the existing Phase 0
//      promoteStaleQueueItemsFromSprints, which materializes from the
//      sprint YAML's items list.
//
// REPLACES the prior regex-based commit-message parser (negation-cue list +
// completion-verb proximity check + label-citation pattern). That detector
// produced false positives whenever a new commit-message phrasing slipped
// past the hand-maintained cue list — five tactical patches in six days
// (FIND-121, FIND-121-recurrence, WS-283 false-positive, label-citation
// gap, and the 2026-05-07 WS-310 slash-citation incident). Per ADR-045,
// narrative artifacts (commit messages, PR descriptions) are out of scope
// for state drift; the event log is canonical, full stop.
//
// Returns: array of drift entries:
//   { ws_id, kind: 'item_closed_event' | 'sprint_closed_no_item_event',
//     auto_reconciled: bool, event_id?, prior_status, completion_commit?,
//     completed_at?, error? }
//
// Determinism: pure function of event log + queue YAMLs at call time.
// No git log scan, no commit-message parsing, no regex against narrative.

function _readEventLogChunks(wsDir) {
  // Lazy-require to avoid coupling to core/ when the kit is in a
  // pre-events-log state. wsDir here is the workstream dir
  // (.claude/workstream), which matches what core/events expects.
  let readAllChunks = null;
  try { ({ readAllChunks } = require('./core/events')); } catch { return null; }
  if (!readAllChunks) return null;
  try { return readAllChunks(wsDir).events || []; } catch { return null; }
}

function _buildClosureIndex(events) {
  // Walk events forward. item_closed adds; item_reopened (future-compat)
  // removes. Result keys are WS-IDs.
  const closedItems = new Map();
  const closedSprints = new Map();
  const sprintMembership = new Map();
  for (const ev of events) {
    if (!ev || !ev.payload || typeof ev.payload !== 'object') continue;
    const p = ev.payload;
    const t = p.type;
    if (t === 'item_closed' && typeof p.ws_id === 'string') {
      closedItems.set(p.ws_id, {
        event_id: ev.id,
        completed_at: p.completed_at,
        completion_commit: p.completion_commit,
        sprint_id: p.sprint_id,
      });
    } else if (t === 'item_reopened' && typeof p.ws_id === 'string') {
      closedItems.delete(p.ws_id);
    } else if (t === 'sprint_completed' && typeof p.sprint_id === 'string') {
      closedSprints.set(p.sprint_id, {
        event_id: ev.id,
        completed_at: p.completed_at,
        completion_commit: p.completion_commit,
      });
    } else if (t === 'sprint_approved' && typeof p.sprint_id === 'string' && Array.isArray(p.items)) {
      for (const it of p.items) {
        if (it && typeof it.id === 'string') sprintMembership.set(it.id, p.sprint_id);
      }
    }
  }
  return { closedItems, closedSprints, sprintMembership };
}

function _autoReconcileQueueYaml(queueDir, wsId, closure) {
  // Mirrors the regex-based mutation in promoteStaleQueueItemsFromSprints
  // (Phase 0). Idempotent: a YAML already at status=done is left untouched
  // (caller checks before invoking).
  const queuePath = path.join(queueDir, `${wsId}.yaml`);
  if (!fs.existsSync(queuePath)) return { ok: false, error: 'queue-yaml-missing' };
  let raw;
  try { raw = fs.readFileSync(queuePath, 'utf8'); }
  catch (err) { return { ok: false, error: `read-failed: ${err.message}` }; }
  let patched = raw.replace(/^status:\s*.*$/m, `status: done`);
  const completedAt = closure.completed_at || todayISO();
  if (!/^completed_at:/m.test(patched)) {
    patched = patched.replace(
      /^status:\s*done$/m,
      `status: done\ncompleted_at: "${completedAt}"`
    );
  }
  if (closure.completion_commit && !/^completion_commit:/m.test(patched)) {
    patched = patched.replace(
      /^completed_at:.*$/m,
      (m) => `${m}\ncompletion_commit: "${closure.completion_commit}"`
    );
  }
  if (closure.event_id && !/^closed_by_event:/m.test(patched)) {
    patched = patched.trimEnd() + `\nclosed_by_event: "${closure.event_id}"\n`;
  }
  // Audit note so the founder can see at a glance which path closed this item.
  if (!/^auto_reconciled_by_drift_detector:/m.test(patched)) {
    patched = patched.trimEnd() + `\nauto_reconciled_by_drift_detector: "${todayISO()} — event ${closure.event_id || '(none)'}"\n`;
  }
  try {
    withFileLock(queuePath + '.lock', () => {
      writeFileAtomic(queuePath, patched);
    }, { ownerLabel: 'reconcile:drift-detector', maxWaitMs: 5000 });
  } catch (err) { return { ok: false, error: `write-failed: ${err.message}` }; }
  return { ok: true };
}

function validateStateDrift(wsDir, queueItems, warnings) {
  const drifts = [];
  if (!Array.isArray(queueItems)) return drifts;

  const events = _readEventLogChunks(wsDir);
  if (!events) return drifts; // event log unavailable — skip silently

  const { closedItems, closedSprints, sprintMembership } = _buildClosureIndex(events);
  const queueDir = path.join(wsDir, 'queue');

  for (const item of queueItems) {
    if (!item || !item.id) continue;
    const status = item.status;
    if (status !== 'backlog' && status !== 'claimed' && status !== 'in_progress' && status !== 'in-progress') continue;

    // HARD DRIFT — event log says closed; queue YAML says non-terminal.
    if (closedItems.has(item.id)) {
      const closure = closedItems.get(item.id);
      const reconcile = _autoReconcileQueueYaml(queueDir, item.id, closure);
      const entry = {
        ws_id: item.id,
        kind: 'item_closed_event',
        prior_status: status,
        new_status: 'done',
        auto_reconciled: reconcile.ok,
        event_id: closure.event_id,
        completed_at: closure.completed_at,
        completion_commit: closure.completion_commit,
      };
      if (!reconcile.ok) entry.error = reconcile.error;
      drifts.push(entry);
      if (warnings) {
        warnings.push(
          reconcile.ok
            ? `prog-program-integrity [state-drift / auto-reconciled]: ${item.id} (${status} → done) — closed by event ${closure.event_id || '(unknown)'}.`
            : `prog-program-integrity [state-drift / RECONCILE-FAILED]: ${item.id} (${status}) — event ${closure.event_id} says closed but YAML write failed: ${reconcile.error}. Manual fix required.`
        );
      }
      continue;
    }

    // SOFT DRIFT — item's sprint closed but no per-item closure event. Phase
    // 0 promoteStaleQueueItemsFromSprints already runs in cwos-reconcile main
    // before this validator (sprint YAML authoritative for legacy closes);
    // here we surface a one-line note for the gate's compose --human output
    // when called outside of cwos-reconcile (e.g., from cwos-next.js gate).
    const sprintId = sprintMembership.get(item.id);
    if (sprintId && closedSprints.has(sprintId)) {
      drifts.push({
        ws_id: item.id,
        kind: 'sprint_closed_no_item_event',
        prior_status: status,
        new_status: 'pending-promote',
        auto_reconciled: true, // Phase 0 promote covers this
        sprint_id: sprintId,
        sprint_event_id: closedSprints.get(sprintId).event_id,
      });
    }
  }

  return drifts;
}

// ─── Phase 2g: Auto-Rec Phantom-Run-Ref Detector ────────────────────────────
//
// FIND-130 / WS-167 root-cause guard. Auto-rec WS items historically embedded
// run-NNN references in title/description that didn't exist on disk (WS-167
// pointed at run-012 which never existed; the design baseline actually lives
// at evidence/design/run-001/). This validator catches the recurrence at
// reconcile-time so the founder sees a phantom-pointer warning instead of
// hitting it mid-sprint execution.
//
// Resolution rules (a referenced run resolves if ANY apply):
//   1. .claude/workstream/runs/run-NNN/ exists
//   2. .claude/workstream/evidence/<program>/run-NNN/ exists
//      (program comes from the WS item's `program` field)
//   3. .claude/workstream/runs/run-<engine>-NNN/ or run-<focus>-NNN/ exists
//      where engine/focus is derived loosely from the title — handles e.g.
//      `run-design-critique-010` style namespaced runs
//
// Pure-function: depends only on filesystem state at call time. False
// negatives (run got deleted but artifact path still reachable) are
// preferred over false positives (annoying warnings on legitimate work).
function validateAutoRecRunRefs(wsDir, queueItems, warnings) {
  if (!Array.isArray(queueItems)) return [];
  const drifts = [];
  const runsDir = path.join(wsDir, 'runs');
  const evidenceDir = path.join(wsDir, 'evidence');

  // Index entries are lean (title/status/etc only). Re-read each candidate
  // WS file from disk to get description + accept_criteria + files_involved
  // — that's where auto-rec generators historically embed the run-NNN
  // references, not in the title.
  const queueDir = path.join(wsDir, 'queue');
  for (const item of queueItems) {
    if (!item || !item.id) continue;
    if (item.status === 'done' || item.status === 'dismissed' || item.status === 'deferred') continue;
    if (classifySource(item.source) !== 'auto-rec') continue;
    let raw = item;
    try {
      const r = readYAMLFile(path.join(queueDir, `${item.id}.yaml`));
      if (r.ok && r.data) raw = r.data;
    } catch { /* fall back to lean entry */ }
    const acceptCriteriaText = Array.isArray(raw.accept_criteria)
      ? raw.accept_criteria.join(' ')
      : (typeof raw.accept_criteria === 'string' ? raw.accept_criteria : '');
    const filesInvolvedText = Array.isArray(raw.files_involved)
      ? raw.files_involved.join(' ')
      : '';
    const haystack = `${raw.title || ''} ${raw.description || ''} ${acceptCriteriaText} ${filesInvolvedText}`;
    const refs = extractRunRefs(haystack);
    if (refs.length === 0) continue;

    const program = raw.program || item.program || null;
    for (const ref of refs) {
      if (resolvesRunRef(ref, program, runsDir, evidenceDir)) continue;
      drifts.push({ ws_id: item.id, ref, program });
      if (warnings) {
        const progClause = program ? ` (program: ${program})` : '';
        warnings.push(
          `prog-program-integrity [auto-rec-phantom-run]: ${item.id}${progClause} references ${ref} — not found in runs/ or evidence/${program || '<program>'}/. Resolve: rewrite the WS to point at an existing run, or close it as based on stale data.`
        );
      }
    }
  }
  return drifts;
}

// ─── Phase 2h: Program protocol→engine reference validator (WS-294) ─────

/**
 * Read the active-engine set from the engine registry. Returns a Set of
 * engine ids present as keys in the top-level `engines:` map. Commented
 * entries are excluded (the YAML parser already drops them).
 *
 * Exported as `loadActiveEngines` for testing — see __tests__/program-protocol-refs.test.js.
 */
function loadActiveEngines(wsDir) {
  const registryPath = path.join(wsDir, 'engines', 'registry.yaml');
  if (!fs.existsSync(registryPath)) return new Set();
  const r = readYAMLFile(registryPath);
  if (!r.ok || !r.data || !r.data.engines || typeof r.data.engines !== 'object') return new Set();
  return new Set(Object.keys(r.data.engines));
}

/**
 * Walk every program YAML in `.claude/workstream/programs/` and check each
 * `protocols.<name>.engine` value resolves to an active engine. Skips
 * `protocol_history[].engine` and `last_run_by_protocol.<name>.engine` —
 * those are historical run records, not forward-looking declarations.
 *
 * Pushes warnings of the form:
 *   prog-program-integrity [protocol-engine-ref]: prog-X.protocols.Y.engine="Z" — not in registry.yaml engines:
 *
 * Returns the array of dangling refs for testability.
 */
function validateProgramProtocolEngineRefs(wsDir, warnings) {
  const programsDir = path.join(wsDir, 'programs');
  if (!fs.existsSync(programsDir)) return [];
  const activeEngines = loadActiveEngines(wsDir);
  if (activeEngines.size === 0) return []; // no registry → can't validate

  const dangling = [];
  const files = fs.readdirSync(programsDir)
    .filter((f) => f.startsWith('prog-') && f.endsWith('.yaml'))
    .sort();
  for (const f of files) {
    const fullPath = path.join(programsDir, f);
    const r = readYAMLFile(fullPath);
    if (!r.ok || !r.data) continue;
    const protocols = r.data.protocols;
    if (!protocols || typeof protocols !== 'object') continue;
    for (const protoName of Object.keys(protocols)) {
      const proto = protocols[protoName];
      if (!proto || typeof proto !== 'object') continue;
      const engine = proto.engine;
      if (!engine || typeof engine !== 'string') continue;
      if (activeEngines.has(engine)) continue;
      const progId = r.data.id || f.replace('.yaml', '');
      dangling.push({ program: progId, protocol: protoName, engine, file: f });
      if (warnings) {
        warnings.push(
          `prog-program-integrity [protocol-engine-ref]: ${progId}.protocols.${protoName}.engine="${engine}" — not in registry.yaml engines:. Resolve: change to a registered engine, register the engine, or retire the protocol.`
        );
      }
    }
  }
  return dangling;
}

// ─── Phase 2m: Program Accountability Cap Enforcement (WS-350) ──────────────
//
// FIND-232 / run-019 SUSTAINED/CRITICAL guard. Program YAMLs declare
// accountability.on_finding.max_open_items + priority_floor but until WS-350
// no script read them — the policy was decorative. The result: prog-program-
// integrity itself reached 8.7× over its declared cap and no surface said so.
//
// This validator closes the loop:
//   1. For each program, count live work_items_open and findings_open from
//      the reconciled queue/findings indexes (the validator runs after Phase
//      1 rebuildAll, so both lists are fresh).
//   2. Mutate findings_open / work_items_open on the program YAML to match
//      live counts. Closes the sibling drift bug where session-end was
//      supposed to recount these but no script implemented it.
//   3. If work_items_open > max_open_items: mark cap_breach.active=true on
//      the YAML with diagnostics. Otherwise clear cap_breach.active=false.
//   4. Compare prior vs new breach state; emit transitions to the caller so
//      events fire only on state change (clean→breached / breached→clean),
//      per the conditional-mutation pattern (line 117 idiom).
//   5. Push warnings to prog-program-integrity for each currently breached
//      program.
//
// Skip rules:
//   - monitor_only: true programs (no caps apply; they're ambient indicators)
//   - Programs without accountability.on_finding.max_open_items declared
//   - retired / deprecated programs (status !== 'active' and !== 'NEW')
//
// "Open" definitions:
//   - Queue: status NOT in {done, dismissed, deferred}. Captures live workload
//     including blocked/in-progress, since the founder still owes attention.
//   - Findings: status === 'open'. Resolved/dismissed/duplicate findings don't
//     count.
//
// Cap denominator: work_items_open only (founder decision in plan). findings_open
// surfaces in the diagnostic block for context but does not by itself trigger
// breach.
//
// Returns { capsByProgram, transitions, mutations } where:
//   capsByProgram = { [progId]: { max_open_items, priority_floor, cap_breach_active,
//                                 work_items_open, findings_open } } — for /next + /pulse
//   transitions   = [{ kind: 'breach'|'cleared', program, ... }] — caller emits events
//   mutations     = number of YAML files rewritten — for the summary line
function validateProgramCaps(wsDir, queueItems, findingItems, warnings, dryRun) {
  const empty = { capsByProgram: {}, transitions: [], mutations: 0 };
  const programsDir = path.join(wsDir, 'programs');
  if (!fs.existsSync(programsDir)) return empty;
  if (!Array.isArray(queueItems) || !Array.isArray(findingItems)) return empty;

  const QUEUE_CLOSED = new Set(['done', 'dismissed', 'deferred']);

  const workByProg = {};
  for (const it of queueItems) {
    if (!it || !it.program) continue;
    if (QUEUE_CLOSED.has(it.status)) continue;
    workByProg[it.program] = (workByProg[it.program] || 0) + 1;
  }
  const findByProg = {};
  for (const f of findingItems) {
    if (!f || !f.program) continue;
    if (f.status !== 'open') continue;
    findByProg[f.program] = (findByProg[f.program] || 0) + 1;
  }

  const capsByProgram = {};
  const transitions = [];
  let mutations = 0;
  const today = todayISO();

  const files = fs.readdirSync(programsDir)
    .filter((f) => f.startsWith('prog-') && f.endsWith('.yaml') && f !== 'prog-template.yaml')
    .sort();

  for (const f of files) {
    const fullPath = path.join(programsDir, f);
    const r = readYAMLFile(fullPath);
    if (!r.ok || !r.data || !r.data.id) continue;
    const data = r.data;

    if (data.monitor_only === true) continue;
    const status = data.status || '';
    if (status && status !== 'active' && status !== 'NEW') continue;

    const acc = data.accountability && data.accountability.on_finding;
    if (!acc || typeof acc.max_open_items !== 'number') continue;
    const maxOpen = acc.max_open_items;
    const floor = (typeof acc.priority_floor === 'number') ? acc.priority_floor : null;

    const progId = data.id;
    const woNew = workByProg[progId] || 0;
    const foNew = findByProg[progId] || 0;
    const woOld = (typeof data.work_items_open === 'number') ? data.work_items_open : null;
    const foOld = (typeof data.findings_open === 'number') ? data.findings_open : null;
    const priorBreach = !!(data.cap_breach && data.cap_breach.active === true);
    const breached = woNew > maxOpen;
    const ratio = maxOpen > 0 ? Math.round((woNew / maxOpen) * 100) / 100 : null;

    capsByProgram[progId] = {
      max_open_items: maxOpen,
      priority_floor: floor,
      cap_breach_active: breached,
      work_items_open: woNew,
      findings_open: foNew,
      ratio,
    };

    if (breached && warnings) {
      const findingsNote = foNew > 0 ? ` (${foNew} findings open)` : '';
      const floorNote = (floor != null) ? `, priority_floor=${floor}` : '';
      warnings.push(
        `prog-program-integrity [cap-breach]: ${progId} ${woNew}/${maxOpen} work items, ${ratio}× cap${findingsNote}${floorNote}. Resolve: close items via /next, raise max_open_items if cap is wrong, or retire the program.`
      );
    }

    // Detect transitions for caller event emission
    if (breached && !priorBreach) {
      transitions.push({
        kind: 'breach', program: progId,
        work_items_open: woNew, findings_open: foNew,
        max_open_items: maxOpen, priority_floor: floor, ratio,
      });
    } else if (!breached && priorBreach) {
      transitions.push({
        kind: 'cleared', program: progId,
        work_items_open: woNew, max_open_items: maxOpen,
      });
    }

    // Decide whether the YAML needs rewriting
    const countsChanged = (woOld !== woNew) || (foOld !== foNew);
    const breachStateChanged = (breached !== priorBreach);
    const breachContentChanged = breached && priorBreach && (
      (data.cap_breach.work_items_open !== woNew) ||
      (data.cap_breach.findings_open !== foNew) ||
      (data.cap_breach.ratio !== ratio)
    );
    const needsWrite = countsChanged || breachStateChanged || breachContentChanged;

    if (!needsWrite || dryRun) continue;

    let raw;
    try { raw = fs.readFileSync(fullPath, 'utf8'); } catch { continue; }
    let next = raw;

    if (countsChanged) {
      next = upsertTopLevelScalar(next, 'work_items_open', String(woNew));
      next = upsertTopLevelScalar(next, 'findings_open', String(foNew));
    }
    if (breachStateChanged || breachContentChanged) {
      const since = breached
        ? ((priorBreach && data.cap_breach && data.cap_breach.since) || today)
        : null;
      next = upsertCapBreachBlock(next, breached, {
        work_items_open: woNew, findings_open: foNew,
        max_open_items: maxOpen, priority_floor: floor,
        ratio, since,
      });
    }

    if (next !== raw) {
      try {
        withFileLock(fullPath + '.lock', () => {
          writeFileAtomic(fullPath, next);
        }, { ownerLabel: 'reconcile:program-caps', maxWaitMs: 5000 });
        mutations++;
      } catch { /* swallow — non-fatal */ }
    }
  }

  return { capsByProgram, transitions, mutations };
}

// Replace `key: <oldval>` line in a YAML file's raw text, or insert a new one
// after a sensible anchor. Only handles scalar values on top-level keys —
// nested keys must use a block-aware helper. No-op if oldval already matches.
function upsertTopLevelScalar(raw, key, newValue) {
  const lineRe = new RegExp(`^${key}:\\s*.*$`, 'm');
  if (lineRe.test(raw)) {
    return raw.replace(lineRe, `${key}: ${newValue}`);
  }
  // Insert before `evidence:` (canonical anchor present in every program YAML).
  if (/^evidence:/m.test(raw)) {
    return raw.replace(/^evidence:/m, `${key}: ${newValue}\nevidence:`);
  }
  // Fallback: append.
  return raw.trimEnd() + `\n${key}: ${newValue}\n`;
}

// Replace or insert the top-level `cap_breach:` block. When `active` is true,
// writes the full diagnostic block. When false, writes a compact "cleared"
// marker. Block boundary detection: from `cap_breach:` to the first line that
// begins with a non-whitespace non-`#` character (i.e. the next top-level
// key or comment-block) — same approach used elsewhere for top-level blocks.
function upsertCapBreachBlock(raw, active, breachInfo) {
  const lines = active
    ? [
        'cap_breach:',
        '  active: true',
        `  work_items_open: ${breachInfo.work_items_open}`,
        `  findings_open: ${breachInfo.findings_open}`,
        `  max_open_items: ${breachInfo.max_open_items}`,
        `  priority_floor: ${breachInfo.priority_floor == null ? 'null' : breachInfo.priority_floor}`,
        `  ratio: ${breachInfo.ratio == null ? 'null' : breachInfo.ratio}`,
        `  since: "${breachInfo.since}"`,
      ]
    : [
        'cap_breach:',
        '  active: false',
      ];
  const block = lines.join('\n');

  const inputLines = raw.split('\n');
  const out = [];
  let i = 0, replaced = false;
  while (i < inputLines.length) {
    const line = inputLines[i];
    if (!replaced && /^cap_breach:\s*$/.test(line)) {
      // Skip the existing block: this line + any indented continuation lines.
      i++;
      while (i < inputLines.length) {
        const next = inputLines[i];
        // Continuation = empty (preserved blanks count) OR indented OR comment.
        // Stop at the next top-level key (^[A-Za-z_][...]:).
        if (/^[A-Za-z_][A-Za-z0-9_]*\s*:/.test(next)) break;
        i++;
      }
      out.push(block);
      replaced = true;
      continue;
    }
    out.push(line);
    i++;
  }
  if (!replaced) {
    // Insert before `evidence:` if present; else append before trailing EOF.
    const evIdx = out.findIndex((l) => /^evidence:/.test(l));
    if (evIdx >= 0) {
      out.splice(evIdx, 0, block, '');
    } else {
      out.push('', block);
    }
  }
  return out.join('\n');
}

// ─── Phase 2i: Findings→Work-Item Promotion Validator (WS-371) ──────────────
//
// FIND-253 / FIND-NEW-07 root-cause guard. The findings→work-item promotion
// loop is hand-authored AI discipline; without a deterministic check, a run
// can produce N findings and 0 (or fewer than N) WS items and the gap is
// only visible by manual cross-reference. Worse, protocol_history.work_items
// is itself hand-authored, so an AI can claim work_items=N for a run where
// only K WS files actually exist.
//
// This validator catches both failure modes at reconcile time:
//
//   1. COUNT MISMATCH — protocol_history entry says work_items=N but only K
//      queue items have source.run_id == entry.run_id, where K < N.
//   2. FINDING ORPHANED — a FIND-NNN with severity ≥ MEDIUM and
//      source.run_id == entry.run_id has no corresponding queue item with
//      source.finding_id == FIND-NNN.
//
// Skip rule: entries with `spec_compliant: false` are legitimately exempt
// (e.g., the May 5 single-pass-review delta which produced 8 findings + 0
// WS items as designed — degraded protocol, not a promotion gap).
//
// AS-N coupling: AS-51 in prog-program-integrity reads this validator's
// output via the event log. When delta_findings > 0 AND delta_work_items = 0
// over > 72h on a spec-compliant run, AS-51 auto-flips to contradicted
// (handled in cwos-asn-transition.js auto-evaluate, wired by Step 3).
//
// Returns array of { kind, program, run_id, finding_id?, severity?, delta? }
// for testability. Emits T6:reconcile-findings/promotion_gap events and
// pushes warnings to prog-program-integrity.
function validateFindingPromotion(wsDir, queueItems, findingItems, warnings) {
  const gaps = [];
  const programsDir = path.join(wsDir, 'programs');
  if (!fs.existsSync(programsDir)) return gaps;
  if (!Array.isArray(queueItems) || !Array.isArray(findingItems)) return gaps;

  // Build finding lookup by run_id (severity-gated to MEDIUM/HIGH/CRITICAL).
  const findingsDir = path.join(wsDir, 'findings');
  const findingsByRun = new Map();
  for (const f of findingItems) {
    if (!f || !f.id) continue;
    const sev = (f.severity || '').toLowerCase();
    if (sev !== 'medium' && sev !== 'high' && sev !== 'critical') continue;
    let runId = f.run_id;
    let status = (f.status || '').toLowerCase();
    if (!runId || !status) {
      // Re-read from disk; lean index entries may not carry source.run_id / status.
      const r = readYAMLFile(path.join(findingsDir, `${f.id}.yaml`));
      if (r.ok && r.data) {
        runId = runId || (r.data.source && r.data.source.run_id) || r.data.run_id || null;
        status = status || (r.data.status || '').toLowerCase();
      }
    }
    // Only OPEN findings can be "orphaned". A resolved/dismissed/deferred/
    // duplicate finding is already governed (terminal, or explicitly parked) —
    // flagging it as needing promotion is a false positive. The orphan check
    // was previously severity-gated only, which is why resolved findings and
    // explicitly-deferred findings kept surfacing as promotion gaps.
    if (status && status !== 'open') continue;
    if (!runId) continue;
    if (!findingsByRun.has(runId)) findingsByRun.set(runId, []);
    findingsByRun.get(runId).push({ id: f.id, severity: sev });
  }

  // Build queue lookup by finding_id and by run_id. Re-read each file to
  // pick up source.finding_id / source.run_id which the lean index may not carry.
  const queueDir = path.join(wsDir, 'queue');
  const queueByFindingId = new Set();
  const queueCountByRun = new Map();
  for (const item of queueItems) {
    if (!item || !item.id) continue;
    let raw = item;
    let needsReread = !item.source || (typeof item.source !== 'object');
    if (needsReread) {
      const r = readYAMLFile(path.join(queueDir, `${item.id}.yaml`));
      if (r.ok && r.data) raw = r.data;
    }
    let findingId = raw.finding_id || (raw.source && raw.source.finding_id) || null;
    if (findingId) queueByFindingId.add(findingId);
    const runId = (raw.source && raw.source.run_id) || raw.run_id || null;
    if (runId) queueCountByRun.set(runId, (queueCountByRun.get(runId) || 0) + 1);
  }

  // Archive-awareness: WS items completed in past sprints are moved to
  // queue/archive/ and drop out of the active index. Without scanning them, a
  // finding whose WS is done+archived looks orphaned, and a historical run's
  // long-completed work items look like they were never created (count_mismatch
  // against actual=0). Fold archived WS into both lookups so the gap-check
  // reflects all-time promotion, not just the live queue.
  const queueArchiveDir = path.join(queueDir, 'archive');
  if (fs.existsSync(queueArchiveDir)) {
    for (const fn of fs.readdirSync(queueArchiveDir)) {
      if (!/^WS-.*\.yaml$/.test(fn)) continue;
      const r = readYAMLFile(path.join(queueArchiveDir, fn));
      if (!r.ok || !r.data) continue;
      const raw = r.data;
      const findingId = raw.finding_id || (raw.source && raw.source.finding_id) || null;
      if (findingId) queueByFindingId.add(findingId);
      const runId = (raw.source && raw.source.run_id) || raw.run_id || null;
      if (runId) queueCountByRun.set(runId, (queueCountByRun.get(runId) || 0) + 1);
    }
  }

  // Walk programs and inspect protocol_history entries.
  // Track orphaned (run_id, finding_id) tuples to avoid duplicate reporting
  // when the same run_id appears in multiple programs' protocol_history
  // (e.g., a cross-program audit run referenced by every program).
  const reportedOrphans = new Set();
  const programFiles = fs.readdirSync(programsDir)
    .filter(f => f.startsWith('prog-') && f.endsWith('.yaml'))
    .sort();
  for (const pf of programFiles) {
    const r = readYAMLFile(path.join(programsDir, pf));
    if (!r.ok || !r.data) continue;
    const program = r.data.id || pf.replace('.yaml', '');
    // protocol_history canonically lives under `evidence:` per prog-template.yaml.
    // Tolerate `accountability.protocol_history` and top-level for legacy programs.
    const protocolHistory = (r.data.evidence && Array.isArray(r.data.evidence.protocol_history))
      ? r.data.evidence.protocol_history
      : (r.data.accountability && Array.isArray(r.data.accountability.protocol_history))
        ? r.data.accountability.protocol_history
        : (Array.isArray(r.data.protocol_history) ? r.data.protocol_history : []);

    for (const entry of protocolHistory) {
      if (!entry || typeof entry !== 'object') continue;
      if (typeof entry.findings !== 'number' || entry.findings <= 0) continue;
      if (entry.spec_compliant === false) continue; // legitimate degraded-protocol skip
      const runId = entry.run_id;
      if (!runId) continue;

      // Check 1: count mismatch (authored work_items > actual queue items for run).
      // Each program-level entry is checked independently — a count discrepancy
      // is a per-program accounting issue.
      const authoredCount = typeof entry.work_items === 'number' ? entry.work_items : 0;
      const actualCount = queueCountByRun.get(runId) || 0;
      if (authoredCount > actualCount) {
        gaps.push({
          kind: 'count_mismatch',
          program,
          run_id: runId,
          run_date: entry.date || null,
          authored: authoredCount,
          actual: actualCount,
          delta: authoredCount - actualCount,
        });
      }

      // Check 2: finding orphaned (FIND ≥ MEDIUM with no corresponding WS).
      // Dedupe across programs: a given (run_id, finding_id) is reported once.
      // The first program in alphabetical order owns the report — subsequent
      // programs that reference the same run skip emission.
      const expectedFindings = findingsByRun.get(runId) || [];
      for (const find of expectedFindings) {
        if (queueByFindingId.has(find.id)) continue;
        const key = `${runId}::${find.id}`;
        if (reportedOrphans.has(key)) continue;
        reportedOrphans.add(key);
        gaps.push({
          kind: 'finding_orphaned',
          program,
          run_id: runId,
          run_date: entry.date || null,
          finding_id: find.id,
          severity: find.severity,
        });
      }
    }
  }

  // Emit one event per gap; surface as warning. Per-gap granularity lets
  // /pulse render each as a CRITICAL line and lets AS-51 evaluation read
  // canonical evidence from the log. Idempotency lives on the read side
  // (downstream consumers deduplicate by {program, run_id, finding_id}).
  for (const gap of gaps) {
    const payload = { type: 'promotion_gap', ...gap };
    emitEvent('T6:reconcile-findings', 'promotion_gap', payload);
    if (warnings) {
      if (gap.kind === 'finding_orphaned') {
        warnings.push(
          `prog-program-integrity [promotion-gap]: ${gap.finding_id} (${gap.severity}, run ${gap.run_id}, ${gap.program}) has no corresponding WS item — promote or close.`
        );
      } else if (gap.kind === 'count_mismatch') {
        warnings.push(
          `prog-program-integrity [promotion-gap]: ${gap.program} run ${gap.run_id} claims work_items=${gap.authored} but only ${gap.actual} WS file(s) tagged with that run_id (delta ${gap.delta}). Reconcile protocol_history.work_items or create the missing WS items.`
        );
      }
    }
  }

  return gaps;
}

// ─── Phase 2j: AS-N Falsification Auto-Evaluation (WS-351 Part B) ───────────
//
// FIND-233 root-cause guard. AS-N (labeled load-bearing assumptions) carry
// machine-evaluable falsification thresholds, but until now the threshold
// was checked manually via /audit prose. This validator auto-evaluates the
// structured thresholds against deterministic evidence (the promotion-gap
// output from Phase 2i) and flips status: active → contradicted when the
// loop demonstrably did not close.
//
// Currently handles AS-51 (program accountability loop closes end-to-end).
// Other AS-N with prose thresholds remain on the manual /audit path. As
// more AS-N gain machine-evaluable thresholds, add cases here — they all
// share the same flip-and-emit shape.
//
// Determinism: pure function of (programs YAML, promotionGaps, today).
// Side effects: mutates program YAML (assumption status), emits event.
// Returns array of { asn_id, program, run_id, evidence } for testability.
function evaluateAssumptionFalsification(wsDir, today, promotionGaps, warnings, dryRun) {
  const transitions = [];
  const programsDir = path.join(wsDir, 'programs');
  if (!fs.existsSync(programsDir)) return transitions;
  if (!Array.isArray(promotionGaps)) promotionGaps = [];

  const programFiles = fs.readdirSync(programsDir)
    .filter(f => f.startsWith('prog-') && f.endsWith('.yaml'))
    .sort();
  for (const pf of programFiles) {
    const fullPath = path.join(programsDir, pf);
    const r = readYAMLFile(fullPath);
    if (!r.ok || !r.data) continue;
    const program = r.data.id || pf.replace('.yaml', '');
    const assumptions = Array.isArray(r.data.assumptions) ? r.data.assumptions : [];

    for (const asn of assumptions) {
      if (!asn || !asn.id || asn.status !== 'active') continue;

      // AS-51: program accountability loop closes end-to-end.
      // Falsification: ANY finding_orphaned gap exists for a run > 72h old
      // (loop demonstrably did not close, grace period for in-flight work
      // exhausted). The 72h window is per WS-351 accept_criteria.
      if (asn.id === 'AS-51') {
        for (const gap of promotionGaps) {
          if (gap.kind !== 'finding_orphaned') continue;
          if (!gap.run_date) continue;
          const elapsed = hoursElapsed(gap.run_date, today);
          if (!Number.isFinite(elapsed) || elapsed < 72) continue;

          const evidence = `finding_orphaned: ${gap.finding_id} (${gap.severity}) in ${gap.program} run ${gap.run_id}, elapsed ${Math.floor(elapsed)}h since ${gap.run_date}`;
          const flipResult = dryRun
            ? { ok: true, evidence }
            : flipAssumptionStatus(fullPath, asn.id, 'contradicted', evidence);

          if (flipResult.ok) {
            transitions.push({ asn_id: asn.id, program, run_id: gap.run_id, evidence });
            if (!dryRun) {
              emitEvent('T11:vital-signs', 'assumption_contradicted', {
                type: 'assumption_contradicted',
                asn_id: asn.id,
                program,
                trigger_run_id: gap.run_id,
                evidence,
              });
            }
            if (warnings) {
              warnings.push(
                `prog-program-integrity [AS-N falsified]: ${asn.id} auto-flipped active → contradicted in ${program} (${evidence}). Manual revisit required.`
              );
            }
            break; // one flip per AS-N per reconcile run
          } else if (warnings) {
            warnings.push(
              `prog-program-integrity [AS-N falsify FAILED]: ${asn.id} in ${program} should auto-flip but YAML write failed: ${flipResult.error}.`
            );
          }
        }
      }
    }
  }
  return transitions;
}

// Mutate a single AS-N's status field within a program YAML's assumptions[]
// list. Uses regex (consistent with promoteStaleQueueItemsFromSprints and
// _autoReconcileQueueYaml — the YAML parser doesn't roundtrip cleanly).
// Adds an inline `falsified_at: "<ISO>"` line beside the status: line so
// the founder sees a paper trail at the assumption block, not just in the
// event log.
function flipAssumptionStatus(programYamlPath, asnId, newStatus, evidence) {
  let raw;
  try { raw = fs.readFileSync(programYamlPath, 'utf8'); }
  catch (err) { return { ok: false, error: `read-failed: ${err.message}` }; }

  // Match `- id: AS-NN` then non-greedy any text until `status: <word>`.
  // The non-greedy lookahead ensures we stop at the first status: in the block.
  const re = new RegExp(`(- id:\\s*${asnId}\\b[\\s\\S]*?status:\\s*)\\w+`);
  if (!re.test(raw)) return { ok: false, error: `${asnId} block not found` };
  const patched = raw.replace(re, `$1${newStatus}`);

  // Append an audit note at the end of the AS-N block (after the status line)
  // so the falsification trail is visible at the assumption itself.
  const today = todayISO();
  const noteRe = new RegExp(`(- id:\\s*${asnId}\\b[\\s\\S]*?status:\\s*${newStatus}\\b)(?!\\s*\\n\\s+falsified_at)`);
  let final = patched;
  if (noteRe.test(patched)) {
    final = patched.replace(noteRe, (m) => {
      // Determine indent of next line to match siblings
      return `${m}\n    falsified_at: "${today}"\n    falsified_evidence: "${evidence.replace(/"/g, '\\"').slice(0, 240)}"`;
    });
  }

  try {
    withFileLock(programYamlPath + '.lock', () => {
      writeFileAtomic(programYamlPath, final);
    }, { ownerLabel: 'reconcile:asn-falsify', maxWaitMs: 5000 });
  } catch (err) { return { ok: false, error: `write-failed: ${err.message}` }; }
  return { ok: true, evidence };
}

function hoursElapsed(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  if (isNaN(a) || isNaN(b)) return NaN;
  return (b - a) / 3600000;
}

// Helper: count work items tagged with a given run_id (via source.run_id or
// top-level run_id). Pure function. Used by AS-N evaluation in Step 3 and
// available to AI authors writing protocol_history entries — replaces hand-
// counting with a deterministic source. WS-371 part (a).
function countWorkItemsForRun(queueItems, runId) {
  if (!Array.isArray(queueItems) || !runId) return 0;
  let count = 0;
  for (const item of queueItems) {
    if (!item) continue;
    const itemRunId = (item.source && item.source.run_id) || item.run_id || null;
    if (itemRunId === runId) count += 1;
  }
  return count;
}

function extractRunRefs(text) {
  if (!text || typeof text !== 'string') return [];
  const set = new Set();
  // Match run-NNN where NNN is a small integer (auto-rec convention).
  const re = /\brun-(\d{1,4})\b/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    set.add(`run-${m[1]}`); // preserve original padding; resolvesRunRef handles both forms
  }
  return Array.from(set);
}

function resolvesRunRef(ref, program, runsDir, evidenceDir) {
  // Build candidate forms: preserve original + zero-stripped + zero-padded(3).
  // This way `run-005` (file system) matches `run-5` (haystack) and vice versa.
  const numMatch = ref.match(/^run-(\d+)$/);
  const candidates = new Set([ref]);
  if (numMatch) {
    const stripped = numMatch[1].replace(/^0+/, '') || '0';
    candidates.add(`run-${stripped}`);
    candidates.add(`run-${stripped.padStart(3, '0')}`);
  }

  for (const cand of candidates) {
    // Direct hit in global runs/
    if (fs.existsSync(path.join(runsDir, cand))) return true;
    // Direct hit in program-namespaced evidence/<program>/
    if (program && fs.existsSync(path.join(evidenceDir, program, cand))) return true;
    // Any subdir of evidence/ that contains the run-NNN dir
    if (fs.existsSync(evidenceDir)) {
      try {
        for (const sub of fs.readdirSync(evidenceDir)) {
          if (fs.existsSync(path.join(evidenceDir, sub, cand))) return true;
        }
      } catch { /* permissions etc — skip */ }
    }
    // Loose match in global runs/: any dir whose name ends with -<NNN>
    // (handles e.g. run-design-critique-010 for ref run-010).
    if (fs.existsSync(runsDir)) {
      try {
        const num = cand.slice(4); // 'NNN' part
        for (const sub of fs.readdirSync(runsDir)) {
          if (sub === cand || sub.endsWith(`-${num}`)) return true;
        }
      } catch { /* skip */ }
    }
  }
  return false;
}

// Spearman rank correlation. Returns ρ ∈ [-1, 1]. NaN-safe input ranks ties
// by average rank. Used by validateEngineCalibration; safe to call on
// arrays of any length but caller is responsible for the N≥20 gate.
function spearmanCorrelation(xs, ys) {
  if (!Array.isArray(xs) || !Array.isArray(ys) || xs.length !== ys.length || xs.length === 0) return 0;
  const n = xs.length;
  const rx = rankArray(xs);
  const ry = rankArray(ys);
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) { mx += rx[i]; my += ry[i]; }
  mx /= n; my /= n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const xd = rx[i] - mx;
    const yd = ry[i] - my;
    num += xd * yd; dx += xd * xd; dy += yd * yd;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

function rankArray(arr) {
  const indexed = arr.map((v, i) => ({ v, i }));
  indexed.sort((a, b) => a.v - b.v);
  const ranks = new Array(arr.length);
  let i = 0;
  while (i < indexed.length) {
    let j = i;
    while (j + 1 < indexed.length && indexed[j + 1].v === indexed[i].v) j++;
    const avgRank = (i + j) / 2 + 1; // 1-indexed average rank
    for (let k = i; k <= j; k++) ranks[indexed[k].i] = avgRank;
    i = j + 1;
  }
  return ranks;
}

if (require.main === module) {
  main();
}

module.exports = {
  validateStateDrift,
  validateProgramProtocolEngineRefs,
  validateFindingPointers,
  validateFindingPromotion,
  validateProgramCaps,
  countWorkItemsForRun,
  evaluateAssumptionFalsification,
  flipAssumptionStatus,
  hoursElapsed,
  loadActiveEngines,
  spearmanCorrelation,
  rankArray,
};
