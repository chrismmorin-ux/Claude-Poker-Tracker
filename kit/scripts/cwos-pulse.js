#!/usr/bin/env node
/**
 * cwos-pulse — CLI consolidation of /pulse (WS-267, ADR-037 Decision #3).
 *
 * Exactly 5 subcommands (Decision #3 / AS-037-4 — non-negotiable):
 *   overview       — program enumeration + health summary table.
 *                    `--program <id>` for single-program detail.
 *   compute-health — canonical health-formula invocation. Returns
 *                    JSON {program_id, score, breakdown, ...} via the
 *                    shared kit/scripts/core/health-scoring module —
 *                    the SINGLE source replacing prose-formula sites
 *                    in next.md / pulse.md / audit.md.
 *   run            — record a protocol_run_intent event for a program +
 *                    protocol pair. Engine actually firing remains in
 *                    /engine prose for now (intent_only narrowing).
 *   escalate       — change a program's tier (dormant / watch / active /
 *                    critical). Emits program_escalated event with
 *                    ALTERATION-5 two-field provenance.
 *   refresh        — read-only bulk recompute across all non-monitor-only
 *                    programs. Returns delta array (prior_score vs
 *                    new_score). No mutations.
 *
 * Output convention (mirrors cwos-next.js / cwos-state-store.js):
 *   - JSON to stdout by default; `--human` flag adds formatted table +
 *     Decision #8 footer.
 *   - Exit 0 on clean success, 1 on validation failure, 2 on invalid
 *     argument. Most error paths exit 0 + stderr (AS-23 discipline).
 *
 * Replay-purity:
 *   - Reads via cwos-utils + state-store typed-API.
 *   - new Date() / Date.now() ONLY at event-emission boundaries; tests
 *     inject `--clock <iso>` for determinism.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

let stateStoreMod = null;
try { stateStoreMod = require('./core/state-store'); }
catch { process.exit(0); }

const {
  findWorkstreamDir,
  readYAMLFile,
  globFiles,
  todayISO,
  loadEventDeps,
} = require('./lib/cwos-utils');

let healthMod = null;
try { healthMod = require('./core/health-scoring'); }
catch { /* health-scoring unavailable */ }

const { appendEvent, ensureCommandId } = loadEventDeps();

let asnReportMod = null;
try { asnReportMod = require('./cwos-asn-report'); }
catch { /* asn-report unavailable — pulse renders without AS-N sub-block */ }

// ─── Shared helpers ────────────────────────────────────────────────────────

const VALID_TIERS = new Set(['dormant', 'watch', 'active', 'critical']);
const VALID_PROTOCOLS = new Set(['baseline', 'sweep', 'delta', 'challenge', 'blind_spot']);
const TIER_ORDER = { critical: 0, active: 1, watch: 2, dormant: 3 };
// Severity ladder for de-escalation detection (WS-352). Distinct from
// TIER_ORDER above, which is a display-sort order (critical-first). Here a
// HIGHER number = a more-alert tier, so a downgrade is next < prior.
const TIER_SEVERITY = { dormant: 0, watch: 1, active: 2, critical: 3 };

const DECISION_8_FOOTER = 'Pulse output: deterministic (CLI). Health-score formula: canonical (single source). Tier escalation: deterministic (CLI).';

function writeJson(obj) {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

// WS-365 / FIND-247: structured failure envelope. TTY-safe ANSI red header
// followed by a single-line JSON envelope so machine consumers + the founder
// both parse the same data. Default destination: stderr. Never throws — any
// internal failure degrades to a plain stderr write so the call site can still
// exit cleanly.
function emitRedBanner({ subcommand, programId, tier, error, source_track }) {
  try {
    const isTTY = process.stderr.isTTY;
    const red = isTTY ? '\x1b[1;41;97m' : '';
    const reset = isTTY ? '\x1b[0m' : '';
    const cmd = subcommand ? ` ${subcommand}` : '';
    const ctx = programId ? ` (${programId}${tier ? ` @${tier}` : ''})` : '';
    process.stderr.write(`${red} CWOS-FAIL ${reset} cwos-pulse${cmd}${ctx}\n`);
    process.stderr.write(JSON.stringify({
      ok: false,
      severity: 'red',
      subcommand: subcommand || null,
      program: programId || null,
      tier: tier || null,
      error: (error && error.message) || String(error),
      source_track: source_track || 'T11:vital-signs',
      at: new Date().toISOString(),
    }) + '\n');
  } catch (e) {
    process.stderr.write(`cwos-pulse: emitRedBanner failed (${e.message}); original error: ${(error && error.message) || error}\n`);
  }
}

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function hasFlag(args, name) {
  return args.includes(`--${name}`);
}

function repoRoot() {
  const ws = findWorkstreamDir(process.cwd());
  return path.resolve(ws, '..', '..');
}

function programsDir() {
  return path.join(repoRoot(), '.claude', 'workstream', 'programs');
}

function findingsIndexPath() {
  return path.join(repoRoot(), '.claude', 'workstream', 'findings-index.yaml');
}

function loadFindingsIndex() {
  // Mirror health-scoring.js loadFindingsIndex but rooted at this repo.
  const p = findingsIndexPath();
  if (!fs.existsSync(p)) return [];
  const r = readYAMLFile(p);
  if (!r.ok || !r.data || !Array.isArray(r.data.findings)) return [];
  return r.data.findings;
}

function readProgram(programId) {
  const p = path.join(programsDir(), `prog-${programId}.yaml`);
  if (!fs.existsSync(p)) return null;
  const r = readYAMLFile(p);
  return (r.ok && r.data) ? r.data : null;
}

function listAllPrograms({ skipMonitorOnly = true } = {}) {
  const dir = programsDir();
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!/^prog-.+\.yaml$/.test(f) || f === 'prog-template.yaml') continue;
    const r = readYAMLFile(path.join(dir, f));
    if (!r.ok || !r.data) continue;
    if (skipMonitorOnly && r.data.monitor_only === true) continue;
    out.push(r.data);
  }
  return out;
}

function ceilingForTier(tier) {
  // Matches health-scoring.js TARGET_CEILING.
  const map = { dormant: 0, watch: 4, active: 8, critical: 10 };
  return map[tier] || 0;
}

// WS-369 / FIND-251: outputs-acted-on value ratio metric for /pulse column.
// Delegated to cwos-value-ratio.js so the same computation is reusable
// from /pulse, the observational-delta protocol, and standalone CLI.
let _valueRatioMod = null;
function getValueRatioMod() {
  if (_valueRatioMod) return _valueRatioMod;
  try { _valueRatioMod = require('./cwos-value-ratio'); }
  catch { _valueRatioMod = null; }
  return _valueRatioMod;
}

// WS-436 / INV-053: direction-drift metric for /pulse overview column.
// Returns { pct, window, count_no } for findings in this program over the last
// `windowSize` entries by detected_at desc. Returns null when window < minSignal.
const DRIFT_WINDOW = 20;
const DRIFT_MIN_SIGNAL = 5;
const DRIFT_WARN_THRESHOLD = 20; // percentage

function computeDirectionDrift(programId) {
  const findingsDir = path.join(repoRoot(), '.claude', 'workstream', 'findings');
  if (!fs.existsSync(findingsDir)) return null;
  const files = fs.readdirSync(findingsDir).filter(f => /^FIND-.+\.yaml$/.test(f));
  const rows = [];
  for (const f of files) {
    const r = readYAMLFile(path.join(findingsDir, f));
    if (!r.ok || !r.data) continue;
    const d = r.data;
    if ((d.program || '') !== programId) continue;
    rows.push({
      detected_at: (d.detected_at || d.created_at || '').toString(),
      rel: (d.adopter_value_relation || '').toString(),
    });
  }
  if (rows.length === 0) return null;
  rows.sort((a, b) => (b.detected_at || '').localeCompare(a.detected_at || ''));
  const window = rows.slice(0, DRIFT_WINDOW);
  if (window.length < DRIFT_MIN_SIGNAL) return null;
  const noCount = window.filter(r => r.rel === 'no').length;
  return {
    pct: Math.round((noCount / window.length) * 100),
    window: window.length,
    count_no: noCount,
  };
}

function sortByTierThenScore(programs) {
  return programs.slice().sort((a, b) => {
    const at = TIER_ORDER[a.tier] != null ? TIER_ORDER[a.tier] : 99;
    const bt = TIER_ORDER[b.tier] != null ? TIER_ORDER[b.tier] : 99;
    if (at !== bt) return at - bt;
    return (b.score || 0) - (a.score || 0);
  });
}

// ─── 1. overview ───────────────────────────────────────────────────────────

function runOverview(args) {
  const human = hasFlag(args, 'human');
  const programArg = readFlag(args, 'program');
  const today = readFlag(args, 'clock') || todayISO();

  const findingsIndex = loadFindingsIndex();
  let programs = listAllPrograms();

  if (programArg) {
    programs = programs.filter((p) => p.id === programArg);
    if (programs.length === 0) {
      process.stderr.write(`overview: program not found: ${programArg}\n`);
      process.exit(2);
    }
  }

  const rows = [];
  for (const prog of programs) {
    let scoreData = null;
    let scoreFallback = false;
    if (healthMod && healthMod.computeHealthScore) {
      try { scoreData = healthMod.computeHealthScore(prog, findingsIndex, today); }
      catch (e) {
        // WS-367 / FIND-249: this catch was silent — a computeHealthScore
        // failure dropped the row to the stamped score with no signal at all.
        // overview is a dashboard over ALL programs, so it must NOT exit here
        // (tier-conditional EXIT is the main() catch's job); instead surface
        // the fallback on stderr and flag the row so it's visible in JSON and
        // the human warning section below.
        process.stderr.write(`cwos-pulse overview: computeHealthScore failed for ${prog.id} — using stamped score: ${e.message}\n`);
        scoreFallback = true;
      }
    }
    let asnSummary = null;
    if (asnReportMod && Array.isArray(prog.assumptions)) {
      try { asnSummary = asnReportMod.summarizeProgramAssumptions(prog.assumptions, today); }
      catch { /* swallow — surface as missing summary */ }
    }
    const vrMod = getValueRatioMod();
    let valueRatio = null;
    if (vrMod && typeof vrMod.computeValueRatio === 'function') {
      try { valueRatio = vrMod.computeValueRatio(prog.id, repoRoot(), { clock: today }); }
      catch { valueRatio = null; }
    }
    rows.push({
      id: prog.id,
      name: prog.name || prog.id,
      tier: prog.tier || 'dormant',
      score: scoreData ? scoreData.score : (prog.health_score == null ? null : prog.health_score),
      ceiling: scoreData ? scoreData.ceiling : (prog.health_ceiling == null ? null : prog.health_ceiling),
      target_ceiling: ceilingForTier(prog.tier),
      stamped_score: prog.health_score == null ? null : prog.health_score,
      stamped_fallback: scoreFallback, // WS-367: true when computeHealthScore threw and the row fell back to the stamped score
      caps_applied: scoreData ? scoreData.capsApplied : [],
      open_findings: scoreData ? scoreData.openFindings : null,
      monitor_only: prog.monitor_only === true,
      assumptions: asnSummary,
      direction_drift: computeDirectionDrift(prog.id),
      value_ratio: valueRatio,
      // WS-350: surface accountability cap state.
      cap_breach: (prog.cap_breach && typeof prog.cap_breach === 'object') ? prog.cap_breach : null,
      work_items_open: typeof prog.work_items_open === 'number' ? prog.work_items_open : null,
      max_open_items: (prog.accountability && prog.accountability.on_finding && typeof prog.accountability.on_finding.max_open_items === 'number')
        ? prog.accountability.on_finding.max_open_items
        : null,
    });
  }

  const sorted = sortByTierThenScore(rows);

  // WS-322 Phase C: surface deferred-scope tripwires that have become eligible
  // (status: blocked previously, now unblocked by a fired trigger). These are
  // re-evaluation cues for the founder — work that was deferred at /intend
  // ignition is now in scope per the trigger condition. We also include items
  // that are STILL blocked, so /pulse is the standing surface for "what's
  // queued up against future state transitions."
  const deferred = collectDeferredScope();

  if (programArg) {
    if (human) {
      process.stdout.write(renderOverviewHuman(sorted, today));
      return;
    }
    writeJson({ computed_at: today, program: sorted[0] });
    return;
  }

  if (human) {
    process.stdout.write(renderOverviewHuman(sorted, today));
    process.stdout.write(renderDeferredScopeHuman(deferred));
    return;
  }
  writeJson({ computed_at: today, programs: sorted, deferred_scope: deferred });
}

// WS-322 Phase C: scan all WS items for deferred-scope tripwires.
// Returns { eligible: [...], still_blocked: [...] } where:
//   eligible    = status: backlog AND blocked_by_note starts with [unblocked]
//                 (Phase B emits this prefix when a trigger fires)
//   still_blocked = status: blocked AND has re_eval_trigger
function collectDeferredScope() {
  const root = repoRoot();
  const queueDir = path.join(root, '.claude', 'workstream', 'queue');
  if (!fs.existsSync(queueDir)) return { eligible: [], still_blocked: [] };

  const eligible = [];
  const still_blocked = [];

  for (const f of fs.readdirSync(queueDir)) {
    if (!/^WS-.+\.yaml$/.test(f)) continue;
    let r;
    try { r = readYAMLFile(path.join(queueDir, f)); } catch { continue; }
    if (!r || !r.ok) continue;
    const item = r.data || {};
    if (!item.re_eval_trigger) continue;
    const note = (item.blocked_by_note || '').toString();
    if (item.status === 'blocked') {
      still_blocked.push({
        id: item.id, title: item.title,
        trigger_type: item.re_eval_trigger.type,
        trigger_target: item.re_eval_trigger.target,
        note,
      });
    } else if (/^\[unblocked\]/.test(note)) {
      eligible.push({
        id: item.id, title: item.title,
        trigger_type: item.re_eval_trigger.type,
        trigger_target: item.re_eval_trigger.target,
        note,
      });
    }
  }

  return { eligible, still_blocked };
}

function renderDeferredScopeHuman(deferred) {
  if (deferred.eligible.length === 0 && deferred.still_blocked.length === 0) return '';
  const lines = ['', '## Deferred scope (WS-322 tripwires)', ''];
  if (deferred.eligible.length > 0) {
    lines.push(`**Eligible for re-eval (${deferred.eligible.length}):** trigger fired; founder to triage build / re-defer / abandon.`);
    for (const e of deferred.eligible) {
      lines.push(`- ${e.id}: ${e.title}`);
      lines.push(`  _${e.note.replace(/^"\\?"?|"\\?"?$/g, '')}_`);
    }
    lines.push('');
  }
  if (deferred.still_blocked.length > 0) {
    lines.push(`**Still blocked (${deferred.still_blocked.length}):** waiting on trigger condition.`);
    for (const b of deferred.still_blocked) {
      lines.push(`- ${b.id}: ${b.title}`);
      lines.push(`  _Trigger: ${b.trigger_type} → ${b.trigger_target}_`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderOverviewHuman(rows, today) {
  const out = [];

  // WS-350: surface cap-breached programs as a RED CRITICAL section BEFORE
  // the program table. work_items_open > max_open_items means the program
  // has more outstanding work than its accountability contract allows — the
  // founder is implicitly being asked to manage more than they signed up for.
  // Sorted by breach ratio descending so the worst offender leads.
  const breachedRows = rows.filter((r) => r.cap_breach && r.cap_breach.active === true)
    .slice()
    .sort((a, b) => (b.cap_breach.ratio || 0) - (a.cap_breach.ratio || 0));
  if (breachedRows.length > 0) {
    out.push(`## CRITICAL: Program cap breaches (${breachedRows.length})`);
    out.push(``);
    out.push(`Each program declares \`accountability.on_finding.max_open_items\` — a contract on how much open work it can sponsor before the founder is overwhelmed. These programs are over their declared cap:`);
    out.push(``);
    for (const r of breachedRows) {
      const cb = r.cap_breach;
      const findingsNote = cb.findings_open > 0 ? `, ${cb.findings_open} open findings` : '';
      const floorNote = cb.priority_floor != null ? ` · priority_floor=${cb.priority_floor}` : '';
      const sinceNote = cb.since ? ` · since ${cb.since}` : '';
      out.push(`- **${r.id}** — ${cb.work_items_open}/${cb.max_open_items} work items (${cb.ratio}× cap)${findingsNote}${floorNote}${sinceNote}`);
    }
    out.push(``);
    out.push(`Resolve: close items via /next (priority_floor will raise these to the top of candidates), raise \`max_open_items\` if the cap is wrong, or retire the program. /next will continue to compose sprints; this is a visibility surface, not a block.`);
    out.push(``);
  }

  // WS-351 Part A: surface active promotion gaps as CRITICAL lines BEFORE
  // the program table so they're impossible to miss. Re-validates live
  // (pure function on current YAML state) — does not depend on event-log
  // history or accumulated cruft.
  const criticalLines = collectPromotionGapCriticalLines();
  if (criticalLines.length > 0) {
    out.push(`## CRITICAL: Findings ungoverned (${criticalLines.length})`);
    out.push(``);
    for (const line of criticalLines) out.push(line);
    out.push(``);
    out.push(`Resolve: promote each ungoverned finding to a WS item, or close the finding as obsolete. The findings → work-item loop has demonstrably broken — AS-51 may auto-flip to contradicted on next reconcile (>72h elapsed).`);
    out.push(``);
  }
  // WS-367 / FIND-249: surface rows whose live score could not be computed and
  // fell back to the stamped score. Previously the failure was swallowed
  // silently; a stale stamped score can mask a program that is actually
  // failing its health computation. This is a WARN (not CRITICAL) — the table
  // still renders with the stamped value, but the founder is told it's stale.
  const fallbackRows = rows.filter((r) => r.stamped_fallback === true);
  if (fallbackRows.length > 0) {
    out.push(`## WARN: Health score fell back to stamped value (${fallbackRows.length})`);
    out.push(``);
    out.push(`Live \`computeHealthScore\` failed for these programs — the Score column shows the last stamped value, which may be stale. See stderr for the underlying error.`);
    out.push(``);
    for (const r of fallbackRows) {
      const stamped = r.stamped_score == null ? 'no stamped score' : `stamped ${r.stamped_score}`;
      out.push(`- **${r.id}** (${r.tier}) — ${stamped}`);
    }
    out.push(``);
  }

  out.push(`## Programs (${rows.length}) — computed ${today}`);
  out.push(``);
  out.push(`| Program | Tier | Score | Ceiling | Stamped | Caps | Open Findings | WIP/Cap | Drift | Value 90d | AS-N (a/r/!) |`);
  out.push(`|---------|------|-------|---------|---------|------|---------------|---------|-------|-----------|--------------|`);
  for (const r of rows) {
    const score = r.score == null ? '-' : `${r.score}/${r.target_ceiling}`;
    const ceiling = r.ceiling == null ? '-' : String(r.ceiling);
    const stamped = r.stamped_score == null ? '-' : String(r.stamped_score);
    const caps = (r.caps_applied || []).length > 0 ? r.caps_applied.join('; ') : '-';
    const openCount = r.open_findings ? Object.values(r.open_findings).reduce((a, b) => a + b, 0) : '-';
    const drift = r.direction_drift == null
      ? '-'
      : `${r.direction_drift.pct}%${r.direction_drift.pct >= DRIFT_WARN_THRESHOLD ? ' !' : ''}`;
    const valueRatio = !r.value_ratio || r.value_ratio.insufficient_signal
      ? '-'
      : `${r.value_ratio.pct}%${r.value_ratio.below_threshold ? ' !' : ''}`;
    // WS-350: WIP/Cap column. Breached programs render with `!` marker.
    let wipCell = '-';
    if (r.max_open_items != null && r.work_items_open != null) {
      const breached = r.cap_breach && r.cap_breach.active === true;
      wipCell = `${r.work_items_open}/${r.max_open_items}${breached ? ' !' : ''}`;
    }
    out.push(`| ${r.id} | ${(r.tier || '-').toUpperCase()} | ${score} | ${ceiling} | ${stamped} | ${caps} | ${openCount} | ${wipCell} | ${drift} | ${valueRatio} | ${formatAsnCell(r.assumptions)} |`);
  }
  out.push(``);
  out.push(`AS-N column: <active>/<machine-runnable>/<overdue>; (!) = at least one overdue. \`-\` = no AS-N declared.`);
  out.push(`WIP/Cap column: open work items / accountability.on_finding.max_open_items; (!) = over cap. \`-\` = no cap declared. WS-350.`);
  out.push(`Drift column: % of last ${DRIFT_WINDOW} findings tagged adopter_value_relation=no; (!) at ≥${DRIFT_WARN_THRESHOLD}%. \`-\` = <${DRIFT_MIN_SIGNAL} findings in window.`);
  const vrMod2 = getValueRatioMod();
  if (vrMod2) {
    out.push(`Value 90d column: % of last-90d findings promoted to a WS item (forward + reverse pointer); (!) below ${vrMod2.VALUE_RATIO_WARN_THRESHOLD}%. \`-\` = <${vrMod2.MIN_SIGNAL} findings in window. WS-369 outputs-acted-on metric.`);
  }
  out.push(`---`);
  out.push(DECISION_8_FOOTER);
  out.push(``);
  return out.join('\n');
}

// WS-351 Part A: live-evaluate promotion gaps for /pulse rendering.
// Calls validateFindingPromotion against current YAML state — pure function,
// no event-log dependency, always-current. Returns an array of
// founder-readable CRITICAL lines (or empty array on any failure).
function collectPromotionGapCriticalLines() {
  let reconcileMod;
  try { reconcileMod = require('./cwos-reconcile'); }
  catch { return []; }
  if (!reconcileMod || typeof reconcileMod.validateFindingPromotion !== 'function') return [];

  const ws = path.join(repoRoot(), '.claude', 'workstream');
  let queueItems = [];
  let findingItems = [];
  try {
    const queueIdx = readYAMLFile(path.join(ws, 'queue-index.yaml'));
    if (queueIdx.ok && Array.isArray(queueIdx.data && queueIdx.data.items)) queueItems = queueIdx.data.items;
    const findIdx = readYAMLFile(path.join(ws, 'findings-index.yaml'));
    if (findIdx.ok && Array.isArray(findIdx.data && findIdx.data.findings)) findingItems = findIdx.data.findings;
  } catch { return []; }

  let gaps;
  try { gaps = reconcileMod.validateFindingPromotion(ws, queueItems, findingItems, null); }
  catch { return []; }
  if (!Array.isArray(gaps) || gaps.length === 0) return [];

  // Render top 10 gaps; if more, append a roll-up line.
  const orphans = gaps.filter(g => g.kind === 'finding_orphaned');
  const mismatches = gaps.filter(g => g.kind === 'count_mismatch');
  const cap = 10;
  const surfaced = [];
  for (const g of orphans.slice(0, cap)) {
    surfaced.push(`- **${g.finding_id}** (${(g.severity || '').toUpperCase()}) ungoverned in ${g.program} run ${g.run_id} (since ${g.run_date || '?'})`);
  }
  for (const g of mismatches.slice(0, Math.max(0, cap - surfaced.length))) {
    surfaced.push(`- **${g.program}** run ${g.run_id} claims ${g.authored} WS items but only ${g.actual} exist (delta ${g.delta})`);
  }
  if (gaps.length > surfaced.length) {
    surfaced.push(`- _…and ${gaps.length - surfaced.length} more. Run \`node kit/scripts/cwos-reconcile.js\` for the full list._`);
  }
  return surfaced;
}

function formatAsnCell(s) {
  if (!s || !s.total) return '-';
  const flag = s.overdue > 0 ? ' (!)' : '';
  return `${s.counts.active}/${s.machine_runnable}/${s.overdue}${flag}`;
}

// ─── 2. compute-health ─────────────────────────────────────────────────────

function runComputeHealth(args) {
  const programId = readFlag(args, 'program');
  const today = readFlag(args, 'clock') || todayISO();
  if (!programId) {
    process.stderr.write('compute-health: --program <id> is required\n');
    process.exit(2);
  }
  const prog = readProgram(programId);
  if (!prog) {
    process.stderr.write(`compute-health: program not found: ${programId}\n`);
    process.exit(2);
  }
  if (!healthMod || !healthMod.computeHealthScore) {
    process.stderr.write('compute-health: core/health-scoring module unavailable\n');
    process.exit(0);
  }
  const findingsIndex = loadFindingsIndex();
  const result = healthMod.computeHealthScore(prog, findingsIndex, today);
  writeJson({
    program_id: programId,
    computed_at: today,
    score: result.score,
    ceiling: result.ceiling,
    target_ceiling: ceilingForTier(prog.tier),
    breakdown: {
      finding_health: result.findingHealth,
      protocol_currency: result.protocolCurrency,
      problem_class_coverage: result.coverage,
      maturity_progress: result.maturityProgress,
      raw: result.raw,
      earned_score: result.earnedScore,
    },
    caps_applied: result.capsApplied || [],
    open_findings: result.openFindings,
    max_rigor: result.maxRigor,
  });
}

// ─── 3. run ─────────────────────────────────────────────────────────────────

function runRun(args) {
  const aiAutonomous = hasFlag(args, 'ai-autonomous');
  const today = readFlag(args, 'clock') || todayISO();
  // Positional: <program> [<protocol>]
  const positional = args.filter((a, i) => !a.startsWith('--') && (i === 0 || !args[i - 1].startsWith('--') || (i >= 1 && args[i - 1] === '--ai-autonomous')));
  // Simpler: scan first two non-flag, non-flag-value tokens.
  const pos = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      // skip the flag's value if it takes one
      if (a === '--clock' || a === '--ai-autonomous') {
        if (a === '--clock') i += 1;
      }
      continue;
    }
    pos.push(a);
  }
  const programId = pos[0];
  let protocol = pos[1] || null;

  if (!programId) {
    process.stderr.write('run: <program> is required (and optionally <protocol>)\n');
    process.exit(2);
  }
  const prog = readProgram(programId);
  if (!prog) {
    process.stderr.write(`run: program not found: ${programId}\n`);
    process.exit(2);
  }

  // WS-372 / WS-365 / FIND-247: pre-flight evidence_dir check. If the program's
  // evidence_dir is missing on disk AND the program is at active/critical
  // tier, refuse the run with a structured RED-banner failure instead of
  // letting downstream engine writes hit ENOENT and get swallowed by AS-23.
  // Watch and dormant tiers still get the soft path (the gap is acceptable
  // while ramping up).
  if (prog.evidence_dir && (prog.tier === 'active' || prog.tier === 'critical')) {
    const evidenceAbs = path.join(repoRoot(), prog.evidence_dir);
    if (!fs.existsSync(evidenceAbs)) {
      emitRedBanner({
        subcommand: 'run',
        programId,
        tier: prog.tier,
        error: new Error(`evidence_dir missing: ${prog.evidence_dir}`),
        source_track: 'T11:vital-signs',
      });
      process.stderr.write(
        `  This is the FIND-247 silent-fail chain — engine writes would ENOENT and AS-23-swallow.\n` +
        `  Fix: re-run /adopt (idempotent) or mkdir the path manually.\n`
      );
      process.exit(1);
    }
  }

  // If no protocol specified, pick next-due (cadence_days exceeded).
  if (!protocol) {
    protocol = pickNextDueProtocol(prog, today);
    if (!protocol) {
      writeJson({ ok: true, program: programId, status: 'no_due_protocol', computed_at: today });
      return;
    }
  }

  if (!VALID_PROTOCOLS.has(protocol)) {
    process.stderr.write(`run: invalid protocol '${protocol}'. Valid: ${Array.from(VALID_PROTOCOLS).join(', ')}\n`);
    process.exit(2);
  }

  // TODO(WS-???-engine-invocation): full engine invocation remains in
  // /engine prose. cwos-pulse run records the INTENT and lets prose
  // drive the actual run. Once an engine-CLI ships, this subcommand
  // will dispatch to it.
  let eventId = null;
  if (appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('pulse-run');
      const r = appendEvent({
        source_track: 'T11:vital-signs',
        source_tier: aiAutonomous ? 'llm-emission' : 'founder-prompt',
        track_tag: '/pulse',
        command_id: commandId,
        payload: {
          type: 'protocol_run_intent',
          program: programId,
          protocol,
          authorized_by: aiAutonomous ? 'ai-autonomous' : 'founder',
          composed_by: 'cli-deterministic',
          emitted_at: today,
        },
      });
      if (r && r.ok && r.event) eventId = r.event.id;
    } catch (e) {
      process.stderr.write(`run: event emission failed (non-fatal): ${e.message}\n`);
    }
  }

  writeJson({
    ok: true,
    program: programId,
    protocol,
    status: 'intent_recorded',
    event_id: eventId,
    note: 'Engine invocation remains in /engine prose; this CLI records the intent only.',
  });
}

function pickNextDueProtocol(prog, today) {
  // Read program.protocols block; pick the protocol whose
  // last_run_date + cadence_days < today (most overdue first).
  const protocols = prog.protocols || {};
  const lastRuns = prog.last_run_by_protocol || {};
  let bestName = null;
  let bestOverdue = -Infinity;
  for (const [name, def] of Object.entries(protocols)) {
    if (!def || !def.cadence_days) continue;
    const last = (lastRuns[name] && lastRuns[name].date) || prog.last_run_date || null;
    if (!last) {
      // never run — treat as max overdue
      if (Infinity > bestOverdue) {
        bestOverdue = Infinity;
        bestName = name;
      }
      continue;
    }
    const days = daysBetween(last, today);
    const overdue = days - def.cadence_days;
    if (overdue > bestOverdue) {
      bestOverdue = overdue;
      bestName = name;
    }
  }
  return (bestOverdue > 0 || bestOverdue === Infinity) ? bestName : null;
}

function daysBetween(isoA, isoB) {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return Math.floor((b - a) / 86400000);
}

// ─── 4. escalate ───────────────────────────────────────────────────────────
//
// WS-352: ai-autonomous de-escalation guard. Tier escalation is symmetric in
// the CLI — the same `escalate` verb raises and lowers a tier. Raising the
// alarm autonomously is fine; LOWERING it (de-escalation) is a founder
// decision, because the AI should not be able to quiet the very accountability
// programs that keep it honest. A program may opt back into automatic
// de-escalation via accountability.on_tier_change.auto_deescalate (default
// false across every shipped template). evaluateDowngradeGate is pure so the
// decision is unit-testable; readAutoDeescalate reads the live program object.
function readAutoDeescalate(prog) {
  return !!(prog && prog.accountability && prog.accountability.on_tier_change
    && prog.accountability.on_tier_change.auto_deescalate === true);
}

function evaluateDowngradeGate({ aiAutonomous, priorTier, newTier, autoDeescalate }) {
  const prior = TIER_SEVERITY[priorTier];
  const next = TIER_SEVERITY[newTier];
  const isDowngrade = Number.isInteger(prior) && Number.isInteger(next) && next < prior;
  if (!isDowngrade) return { blocked: false };
  if (!aiAutonomous) return { blocked: false };           // founder authority
  if (autoDeescalate === true) return { blocked: false }; // program opted in
  return { blocked: true, reason: 'ai_autonomous_downgrade_blocked' };
}

// Mutation order is load-bearing for INV-cli-tells-the-truth:
//   1. mutate prog-<id>.yaml tier field (canonical source)
//   2. re-sync programs/registry.yaml from all prog-*.yaml (derived index)
//   3. emit program_escalated event AFTER state is materialized
//   4. report ok:true ONLY when (1) and (2) both succeeded
//
// Until kit-v3.6.1 this command emitted the event and returned ok:true with
// a note saying "founder must update prog-*.yaml to materialize". The CLI
// was lying about success — anyone reading "new_tier: critical" and missing
// the postscript thought the escalation took effect. /next still saw the
// stale registry; /pulse still saw the stale prog file. The state-mutation
// path now lives in this function; the event log is the audit trail, not
// the trigger.

function mutateProgramTier(programId, newTier) {
  const filePath = path.join(programsDir(), `prog-${programId}.yaml`);
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: `prog-${programId}.yaml not found at ${filePath}` };
  }
  let content;
  try { content = fs.readFileSync(filePath, 'utf8'); }
  catch (e) { return { ok: false, reason: `read failed: ${e.message}` }; }

  // Target the top-level `tier: <value>` line. The schema has exactly one
  // unindented `tier:` declaration; nested references (e.g. `min_tier:` in
  // protocols, `tier_triggers:` block) live at indented columns and are
  // intentionally excluded by the ^tier: anchor. Matches both quoted +
  // unquoted scalars.
  const tierRe = /^tier:\s*['"]?([a-z]+)['"]?\s*$/m;
  if (!tierRe.test(content)) {
    return { ok: false, reason: `prog-${programId}.yaml: no top-level 'tier:' line to mutate` };
  }
  const updated = content.replace(tierRe, `tier: ${newTier}`);
  if (updated === content) {
    return { ok: false, reason: `prog-${programId}.yaml: tier line unchanged after replace (unexpected; check schema)` };
  }
  try { fs.writeFileSync(filePath, updated, 'utf8'); }
  catch (e) { return { ok: false, reason: `write failed: ${e.message}` }; }
  return { ok: true, file: filePath };
}

function resyncProgramRegistry() {
  try {
    const { syncRegistry } = require('./lib/cwos-program-registry');
    return syncRegistry(programsDir());
  } catch (e) {
    return { written: false, error: e.message };
  }
}

function runEscalate(args) {
  const aiAutonomous = hasFlag(args, 'ai-autonomous');
  const noEmit = hasFlag(args, 'no-emit');
  const today = readFlag(args, 'clock') || todayISO();
  const pos = args.filter((a) => !a.startsWith('--'));
  const programId = pos[0];
  const newTier = pos[1];

  if (!programId || !newTier) {
    process.stderr.write('escalate: <program> <tier> are required\n');
    process.exit(2);
  }
  if (!VALID_TIERS.has(newTier)) {
    process.stderr.write(`escalate: invalid tier '${newTier}'. Valid: ${Array.from(VALID_TIERS).join(', ')}\n`);
    process.exit(2);
  }
  const prog = readProgram(programId);
  if (!prog) {
    process.stderr.write(`escalate: program not found: ${programId}\n`);
    process.exit(2);
  }
  const priorTier = prog.tier || 'dormant';
  if (priorTier === newTier) {
    writeJson({ ok: true, noop: true, program: programId, tier: priorTier });
    return;
  }

  // WS-352: ai-autonomous de-escalation guard. Runs BEFORE any state mutation
  // so a blocked attempt leaves prog-*.yaml + registry untouched.
  const gate = evaluateDowngradeGate({
    aiAutonomous,
    priorTier,
    newTier,
    autoDeescalate: readAutoDeescalate(prog),
  });
  if (gate.blocked) {
    let eventId = null;
    if (!noEmit && appendEvent && ensureCommandId) {
      try {
        const commandId = ensureCommandId('pulse-escalate');
        const r = appendEvent({
          source_track: 'T11:vital-signs',
          source_tier: 'llm-emission',
          track_tag: '/pulse',
          command_id: commandId,
          payload: {
            type: 'program_escalation_rejected',
            program_id: programId,
            prior_tier: priorTier,
            attempted_tier: newTier,
            reason: gate.reason,
            auto_deescalate: false,
            authorized_by: 'ai-autonomous',
            composed_by: 'cli-deterministic',
            emitted_at: today,
          },
        });
        if (r && r.ok && r.event) eventId = r.event.id;
      } catch (e) {
        process.stderr.write(`escalate: rejection-event emission failed (non-fatal): ${e.message}\n`);
      }
    }
    process.stderr.write(
      `escalate: ai-autonomous de-escalation of ${programId} (${priorTier} → ${newTier}) blocked — `
      + `auto_deescalate is not enabled. Founder authorization required.\n`);
    writeJson({
      ok: false,
      program: programId,
      prior_tier: priorTier,
      attempted_tier: newTier,
      reason: gate.reason,
      auto_deescalate: false,
      tier_materialized: false,
      event_id: eventId,
    });
    process.exit(1);
  }

  // Step 1: mutate prog-<id>.yaml tier field. Fail loud if this can't
  // happen — better to exit 1 than to record an event the file doesn't
  // reflect.
  const mutation = mutateProgramTier(programId, newTier);
  if (!mutation.ok) {
    process.stderr.write(`escalate: prog-yaml mutation failed: ${mutation.reason}\n`);
    writeJson({
      ok: false,
      program: programId,
      prior_tier: priorTier,
      attempted_tier: newTier,
      reason: 'prog_yaml_mutation_failed',
      detail: mutation.reason,
    });
    process.exit(1);
  }

  // Step 2: re-sync programs/registry.yaml from prog-*.yaml. /next reads
  // the registry; if this step fails, /next still sees the old tier and
  // INV-052 trips on the next /audit.
  const resync = resyncProgramRegistry();
  if (resync.error) {
    process.stderr.write(`escalate: registry resync error: ${resync.error}\n`);
    writeJson({
      ok: false,
      program: programId,
      prior_tier: priorTier,
      new_tier: newTier,
      reason: 'registry_resync_failed',
      detail: resync.error,
      note: 'prog-*.yaml WAS mutated (Step 1 succeeded); registry.yaml is now stale. Run `node kit/scripts/cwos-program-registry-sync.js` to repair.',
    });
    process.exit(1);
  }

  // Step 3: emit the program_escalated event (audit trail; not the trigger).
  let eventId = null;
  if (!noEmit && appendEvent && ensureCommandId) {
    try {
      const commandId = ensureCommandId('pulse-escalate');
      const r = appendEvent({
        source_track: 'T11:vital-signs',
        source_tier: aiAutonomous ? 'llm-emission' : 'founder-prompt',
        track_tag: '/pulse',
        command_id: commandId,
        payload: {
          type: 'program_escalated',
          program_id: programId,
          prior_tier: priorTier,
          new_tier: newTier,
          authorized_by: aiAutonomous ? 'ai-autonomous' : 'founder',
          composed_by: 'cli-deterministic',
          emitted_at: today,
          materialized: true,
        },
      });
      if (r && r.ok && r.event) eventId = r.event.id;
    } catch (e) {
      // Event-emit failure is non-fatal: the canonical state (prog YAML +
      // registry) is already correct. We still surface the warning so the
      // founder knows the audit trail has a gap.
      process.stderr.write(`escalate: event emission failed (non-fatal — state was materialized): ${e.message}\n`);
    }
  }

  writeJson({
    ok: true,
    program: programId,
    prior_tier: priorTier,
    new_tier: newTier,
    tier_materialized: true,
    registry_synced: resync.written === true,
    registry_programs_count: resync.programs_count,
    event_id: eventId,
  });
}

// ─── 5. refresh ────────────────────────────────────────────────────────────

function runRefresh(args) {
  const human = hasFlag(args, 'human');
  const today = readFlag(args, 'clock') || todayISO();
  if (!healthMod || !healthMod.computeHealthScore) {
    process.stderr.write('refresh: core/health-scoring module unavailable\n');
    process.exit(0);
  }
  const findingsIndex = loadFindingsIndex();
  const programs = listAllPrograms();
  const deltas = [];
  for (const prog of programs) {
    let result = null;
    try { result = healthMod.computeHealthScore(prog, findingsIndex, today); }
    catch { /* skip */ }
    const newScore = result ? result.score : null;
    const priorScore = prog.health_score == null ? null : prog.health_score;
    const delta = (newScore != null && priorScore != null) ? (newScore - priorScore) : null;
    deltas.push({
      program_id: prog.id,
      tier: prog.tier || 'dormant',
      prior_score: priorScore,
      new_score: newScore,
      delta,
      caps_applied: result ? result.capsApplied : [],
    });
  }
  // Sort by absolute delta desc — biggest movers up top.
  deltas.sort((a, b) => Math.abs(b.delta || 0) - Math.abs(a.delta || 0));

  if (human) {
    process.stdout.write(renderRefreshHuman(deltas, today));
    return;
  }
  writeJson({ computed_at: today, deltas });
}

function renderRefreshHuman(deltas, today) {
  const out = [];
  out.push(`## Health refresh — computed ${today}`);
  out.push(``);
  out.push(`| Program | Tier | Prior | New | Δ | Caps |`);
  out.push(`|---------|------|-------|-----|---|------|`);
  for (const d of deltas) {
    const arrow = d.delta == null ? '-' : (d.delta > 0 ? `↑${d.delta}` : (d.delta < 0 ? `↓${Math.abs(d.delta)}` : '→0'));
    const caps = (d.caps_applied || []).length > 0 ? d.caps_applied.join('; ') : '-';
    out.push(`| ${d.program_id} | ${d.tier.toUpperCase()} | ${d.prior_score == null ? '-' : d.prior_score} | ${d.new_score == null ? '-' : d.new_score} | ${arrow} | ${caps} |`);
  }
  out.push(``);
  out.push(`---`);
  out.push(DECISION_8_FOOTER);
  out.push(``);
  return out.join('\n');
}

// ─── Dispatch ──────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  if (!sub || sub === '--help' || sub === '-h') {
    process.stdout.write('usage: cwos-pulse <overview|compute-health|run|escalate|refresh> [options]\n');
    process.exit(sub ? 0 : 1);
  }
  try {
    switch (sub) {
      case 'overview':       return runOverview(args.slice(1));
      case 'compute-health': return runComputeHealth(args.slice(1));
      case 'run':            return runRun(args.slice(1));
      case 'escalate':       return runEscalate(args.slice(1));
      case 'refresh':        return runRefresh(args.slice(1));
      default:
        process.stderr.write(`cwos-pulse: unknown subcommand: ${sub}\n`);
        process.exit(2);
    }
  } catch (err) {
    // WS-351 Part C / FIND-233 surfaced this as the AS-23 final safety net so
    // /next gate detects failure instead of silent exit 0. WS-365 / FIND-247
    // makes it tier-conditional: a failure inside a dormant/watch program is
    // not worth disrupting the gate (the soft path is acceptable while
    // ramping up), but a failure inside an active/critical program emits a
    // structured RED-banner JSON envelope + exits 1 so consumers parse the
    // same signal. Missing/unknown program context falls back to exit 1
    // (treat as serious until proven otherwise).
    let programId = null;
    let tier = null;
    try {
      if (sub === 'run' || sub === 'escalate') {
        const positional = (args.slice(1) || []).filter((a, i, arr) => {
          if (a.startsWith('--')) return false;
          const prev = i > 0 ? arr[i - 1] : null;
          if (prev === '--clock') return false;
          return true;
        });
        programId = positional[0] || null;
      }
      if (programId) {
        const prog = readProgram(programId);
        if (prog && typeof prog.tier === 'string') tier = prog.tier;
      }
    } catch { /* tier lookup best-effort */ }

    const soft = tier === 'dormant' || tier === 'watch';
    if (soft) {
      process.stderr.write(`cwos-pulse: ${sub}${programId ? ` (${programId} @${tier})` : ''} failed (soft): ${err.message}\n`);
    } else {
      emitRedBanner({
        subcommand: sub,
        programId,
        tier,
        error: err,
        source_track: 'T11:vital-signs',
      });
      process.stderr.write(`${err.stack || ''}\n`);
    }
    try {
      if (appendEvent) {
        appendEvent({
          source_track: 'T11:vital-signs',
          track_tag: '/pulse',
          payload: {
            type: 'pulse_command_failed',
            subcommand: sub,
            program: programId,
            tier,
            severity: soft ? 'soft' : 'red',
            error: err.message,
          },
        });
      }
    } catch { /* event-emit best-effort; never re-enter */ }
    process.exit(soft ? 0 : 1);
  }
}

if (require.main === module) main();

module.exports = {
  runOverview, runComputeHealth, runRun, runEscalate, runRefresh,
  pickNextDueProtocol, ceilingForTier, sortByTierThenScore,
  renderOverviewHuman, renderRefreshHuman,
  emitRedBanner,
  evaluateDowngradeGate, readAutoDeescalate, TIER_SEVERITY,
  VALID_TIERS, VALID_PROTOCOLS, DECISION_8_FOOTER,
};
