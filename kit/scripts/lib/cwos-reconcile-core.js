/**
 * cwos-reconcile-core.js — Pure library functions for state reconciliation.
 *
 * Rebuilds all CWOS indexes from source files and reconciles config counters.
 * Callable from cwos-reconcile.js (CLI), cwos-gc.js (post-archival), and any
 * future callers without spawning subprocesses.
 *
 * Zero external dependencies. All file I/O via cwos-utils.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  readYAMLFile, globFiles, writeFileAtomic, patchYAMLFile, withFileLock
} = require('./cwos-utils');

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeYAMLString(str) {
  if (!str) return '';
  return String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, ' ');
}

function extractMaxId(items, prefix) {
  return items.reduce((max, item) => {
    const match = String(item.id || '').match(new RegExp(`${prefix}-(\\d+)`));
    return match ? Math.max(max, parseInt(match[1])) : max;
  }, 0);
}

// ADR-016: derive capability from program + category when item lacks an explicit value.
const CAPABILITY_BY_PROGRAM = {
  'kit-quality': 'engines',
  'engine-reliability': 'engines',
  'product-evolution': 'engines',
  'simulation-framework': 'engines',
  'fleet-health': 'governance',
  'program-integrity': 'governance',
  'documentation-accuracy': 'governance',
};
const CAPABILITY_BY_CATEGORY = {
  architecture: 'core',
  workstream: 'workstream',
  engines: 'engines',
  evolution: 'engines',
  fleet: 'governance',
  'program-maintenance': 'governance',
  quality: 'governance',
  onboarding: 'core',
};

function deriveCapability(item) {
  if (item.program && CAPABILITY_BY_PROGRAM[item.program]) return CAPABILITY_BY_PROGRAM[item.program];
  if (item.category && CAPABILITY_BY_CATEGORY[item.category]) return CAPABILITY_BY_CATEGORY[item.category];
  return null;
}

// ─── Queue Index ────────────────────────────────────────────────────────────

function rebuildQueueIndex(wsDir, opts = {}) {
  const queueDir = path.join(wsDir, 'queue');
  const files = globFiles(queueDir, 'WS-*.yaml');
  const items = [];
  const byStatus = {};
  const byCategory = {};
  const warnings = [];
  let skipped = 0;

  for (const filePath of files) {
    const { ok, data, error } = readYAMLFile(filePath);
    if (!ok) {
      warnings.push(`queue: skipping ${path.basename(filePath)}: ${error}`);
      skipped++;
      continue;
    }
    if (!data.id) {
      warnings.push(`queue: skipping ${path.basename(filePath)}: no id field`);
      skipped++;
      continue;
    }

    const entry = {
      id: String(data.id),
      title: data.title || '',
      status: data.status || 'backlog',
      priority_score: data.priority_score ?? 0,
      category: data.category || '',
      effort: data.effort || 'S',
    };
    if (data.blocked_by && Array.isArray(data.blocked_by) && data.blocked_by.length > 0) {
      entry.blocked_by = data.blocked_by;
    }
    if (data.sprint_id) entry.sprint_id = String(data.sprint_id);
    if (data.finding_id) entry.finding_id = String(data.finding_id);
    if (data.opt_id) entry.opt_id = String(data.opt_id);
    if (data.source === 'auto-recommendation' || data.source?.toString() === 'auto-recommendation') {
      entry.source = 'auto-recommendation';
    }
    if (data.program) entry.program = data.program;
    const capability = data.capability || deriveCapability(data);
    if (capability) entry.capability = capability;
    if (data.completion_notes) entry.completion_notes = String(data.completion_notes);

    items.push(entry);
    byStatus[entry.status] = (byStatus[entry.status] || 0) + 1;
    if (entry.category) byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
  }

  if (!opts.dryRun) {
    const indexContent = buildQueueIndexYAML(items, byStatus, byCategory);
    const indexPath = path.join(wsDir, 'queue-index.yaml');
    withFileLock(indexPath + '.lock', () => {
      writeFileAtomic(indexPath, indexContent);
    }, { ownerLabel: 'reconcile:queue-index', maxWaitMs: 10000 });
  }

  return {
    total: items.length, items, byStatus, byCategory, skipped, warnings,
    maxId: extractMaxId(items, 'WS')
  };
}

function buildQueueIndexYAML(items, byStatus, byCategory) {
  const lines = [
    '# Queue Index — fast-scan summary of all work items',
    '# Rebuild from: queue/WS-*.yaml',
    '# Updated by /next, /workstream, /session-end (via cwos-reconcile)',
    '',
    `total_items: ${items.length}`,
    'by_status:',
  ];
  for (const [status, count] of Object.entries(byStatus)) {
    lines.push(`  ${status}: ${count}`);
  }
  lines.push('', 'by_category:');
  const sortedCats = Object.entries(byCategory).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [cat, count] of sortedCats) {
    lines.push(`  ${cat}: ${count}`);
  }
  lines.push('', 'items:');
  for (const item of items) {
    lines.push(`  - id: "${item.id}"`);
    lines.push(`    title: "${escapeYAMLString(item.title)}"`);
    lines.push(`    status: ${item.status}`);
    lines.push(`    priority_score: ${item.priority_score}`);
    lines.push(`    category: ${item.category}`);
    lines.push(`    effort: ${item.effort}`);
    if (item.blocked_by) lines.push(`    blocked_by: [${item.blocked_by.map(b => `"${b}"`).join(', ')}]`);
    if (item.sprint_id) lines.push(`    sprint_id: "${item.sprint_id}"`);
    if (item.finding_id) lines.push(`    finding_id: "${item.finding_id}"`);
    if (item.opt_id) lines.push(`    opt_id: "${item.opt_id}"`);
    if (item.source) lines.push(`    source: ${item.source}`);
    if (item.program) lines.push(`    program: ${item.program}`);
    if (item.capability) lines.push(`    capability: ${item.capability}`);
    if (item.completion_notes) lines.push(`    completion_notes: "${escapeYAMLString(item.completion_notes)}"`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ─── Findings Index ─────────────────────────────────────────────────────────

function rebuildFindingsIndex(wsDir, opts = {}) {
  const findingsDir = path.join(wsDir, 'findings');
  const files = globFiles(findingsDir, 'FIND-*.yaml');
  const items = [];
  const warnings = [];
  let skipped = 0;

  for (const filePath of files) {
    const { ok, data, error } = readYAMLFile(filePath);
    if (!ok) {
      warnings.push(`findings: skipping ${path.basename(filePath)}: ${error}`);
      skipped++;
      continue;
    }
    if (!data.id) {
      warnings.push(`findings: skipping ${path.basename(filePath)}: no id field`);
      skipped++;
      continue;
    }
    items.push({
      id: String(data.id),
      title: data.title || '',
      engine: data.source_engine || data.engine || (data.source && data.source.engine) || '',
      severity: String(data.severity || '').toLowerCase(),
      status: data.status || 'open',
      dedup_key: data.dedup_key || '',
      program: data.program || '',
      created_at: data.created || data.created_at || data.date || '',
    });
  }

  if (!opts.dryRun) {
    const indexContent = buildFindingsIndexYAML(items);
    const indexPath = path.join(wsDir, 'findings-index.yaml');
    withFileLock(indexPath + '.lock', () => {
      writeFileAtomic(indexPath, indexContent);
    }, { ownerLabel: 'reconcile:findings-index', maxWaitMs: 10000 });
  }

  return { total: items.length, items, skipped, warnings, maxId: extractMaxId(items, 'FIND') };
}

function buildFindingsIndexYAML(items) {
  const lines = [
    '# Findings Index — fast-scan summary of all findings',
    '# Rebuild from: findings/FIND-*.yaml',
    '# Updated by /engine (via cwos-reconcile)',
    '',
    'findings:',
  ];
  for (const item of items) {
    lines.push(`  - id: "${item.id}"`);
    lines.push(`    title: "${escapeYAMLString(item.title)}"`);
    if (item.engine) lines.push(`    engine: ${item.engine}`);
    lines.push(`    severity: ${item.severity}`);
    lines.push(`    status: ${item.status}`);
    if (item.dedup_key) lines.push(`    dedup_key: "${item.dedup_key}"`);
    if (item.program) lines.push(`    program: ${item.program}`);
    if (item.created_at) lines.push(`    created_at: "${item.created_at}"`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ─── Sprint Index ───────────────────────────────────────────────────────────

function rebuildSprintIndex(wsDir, opts = {}) {
  const sprintsDir = path.join(wsDir, 'sprints');
  if (!fs.existsSync(sprintsDir)) {
    return { total: 0, items: [], skipped: 0, warnings: [], maxId: 0 };
  }
  const files = globFiles(sprintsDir, 'SPR-*.yaml');
  const items = [];
  const warnings = [];
  let skipped = 0;

  for (const filePath of files) {
    const { ok, data, error } = readYAMLFile(filePath);
    if (!ok) {
      warnings.push(`sprints: skipping ${path.basename(filePath)}: ${error}`);
      skipped++;
      continue;
    }
    if (!data.id) {
      warnings.push(`sprints: skipping ${path.basename(filePath)}: no id field`);
      skipped++;
      continue;
    }
    const sprintItems = Array.isArray(data.items) ? data.items : [];
    const itemsDone = sprintItems.filter(it => it && it.status === 'done').length;
    items.push({
      id: String(data.id),
      title: data.title || '',
      status: data.status || 'approved',
      item_count: sprintItems.length,
      items_done: itemsDone,
      effort_summary: data.effort_summary || '',
      program_focus: data.program_focus || '',
      created_at: data.created_at || '',
      completed_at: data.completed_at || null,
    });
  }

  if (!opts.dryRun) {
    const indexContent = buildSprintIndexYAML(items);
    writeFileAtomic(path.join(wsDir, 'sprint-index.yaml'), indexContent);
  }

  return { total: items.length, items, skipped, warnings, maxId: extractMaxId(items, 'SPR') };
}

function buildSprintIndexYAML(items) {
  const lines = [
    '# Sprint Index — fast-scan summary of active sprints',
    '# Rebuild from: sprints/SPR-*.yaml (active only; archive in sprints/archive/)',
    '# Updated by /next, /sprint, /session-end (via cwos-reconcile)',
    '',
    'sprints:',
  ];
  for (const item of items) {
    lines.push(`  - id: "${item.id}"`);
    lines.push(`    title: "${escapeYAMLString(item.title)}"`);
    lines.push(`    status: ${item.status}`);
    lines.push(`    item_count: ${item.item_count}`);
    lines.push(`    items_done: ${item.items_done}`);
    if (item.effort_summary) lines.push(`    effort_summary: "${escapeYAMLString(item.effort_summary)}"`);
    if (item.program_focus) lines.push(`    program_focus: "${item.program_focus}"`);
    if (item.created_at) lines.push(`    created_at: "${item.created_at}"`);
    lines.push(`    completed_at: ${item.completed_at ? `"${item.completed_at}"` : 'null'}`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ─── Enhancements Index ─────────────────────────────────────────────────────

function rebuildEnhancementsIndex(wsDir, opts = {}) {
  const enhDir = path.join(wsDir, 'enhancements');
  if (!fs.existsSync(enhDir)) {
    return { total: 0, items: [], skipped: 0, warnings: [], maxId: 0 };
  }
  const files = globFiles(enhDir, 'ENH-*.yaml');
  const items = [];
  const warnings = [];
  let skipped = 0;

  for (const filePath of files) {
    const { ok, data, error } = readYAMLFile(filePath);
    if (!ok) {
      warnings.push(`enhancements: skipping ${path.basename(filePath)}: ${error}`);
      skipped++;
      continue;
    }
    if (!data.id) { skipped++; continue; }
    items.push({
      id: String(data.id),
      engine: data.engine || '',
      type: data.type || '',
      status: data.status || 'pending',
      target: data.target || '',
      title: data.title || data.summary || '',
      created_at: data.created_at || data.created || '',
    });
  }

  if (!opts.dryRun) {
    const indexContent = buildEnhancementsIndexYAML(items);
    writeFileAtomic(path.join(wsDir, 'enhancements-index.yaml'), indexContent);
  }

  return { total: items.length, items, skipped, warnings, maxId: extractMaxId(items, 'ENH') };
}

function buildEnhancementsIndexYAML(items) {
  const lines = [
    '# Enhancements Index — maintained by cwos-reconcile',
    '# Rebuild from: enhancements/ENH-*.yaml',
    '',
    'enhancements:' + (items.length === 0 ? ' []' : ''),
  ];
  for (const item of items) {
    lines.push(`  - id: "${item.id}"`);
    if (item.engine) lines.push(`    engine: ${item.engine}`);
    if (item.type) lines.push(`    type: ${item.type}`);
    lines.push(`    status: ${item.status}`);
    if (item.target) lines.push(`    target: "${escapeYAMLString(item.target)}"`);
    if (item.title) lines.push(`    title: "${escapeYAMLString(item.title)}"`);
    if (item.created_at) lines.push(`    created_at: "${item.created_at}"`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ─── Readiness Index ────────────────────────────────────────────────────────

function rebuildReadinessIndex(wsDir, opts = {}) {
  const readyDir = path.join(wsDir, 'readiness');
  if (!fs.existsSync(readyDir)) {
    return { total: 0, items: [], skipped: 0, warnings: [], maxId: 0 };
  }
  const files = globFiles(readyDir, 'READY-*.yaml');
  const items = [];
  const warnings = [];
  let skipped = 0;

  for (const filePath of files) {
    const { ok, data, error } = readYAMLFile(filePath);
    if (!ok) {
      warnings.push(`readiness: skipping ${path.basename(filePath)}: ${error}`);
      skipped++;
      continue;
    }
    if (!data.id) { skipped++; continue; }
    items.push({
      id: String(data.id),
      engine: data.engine || '',
      type: data.type || '',
      status: data.status || 'pending',
      scope: data.scope || data.target || '',
      title: data.title || data.summary || '',
      safe_to_proceed: data.safe_to_proceed === true,
      created_at: data.created_at || data.created || '',
    });
  }

  if (!opts.dryRun) {
    const indexContent = buildReadinessIndexYAML(items);
    writeFileAtomic(path.join(wsDir, 'readiness-index.yaml'), indexContent);
  }

  return { total: items.length, items, skipped, warnings, maxId: extractMaxId(items, 'READY') };
}

function buildReadinessIndexYAML(items) {
  const lines = [
    '# Readiness Index — maintained by cwos-reconcile',
    '# Rebuild from: readiness/READY-*.yaml',
    '',
    'reports:' + (items.length === 0 ? ' []' : ''),
  ];
  for (const item of items) {
    lines.push(`  - id: "${item.id}"`);
    if (item.engine) lines.push(`    engine: ${item.engine}`);
    if (item.type) lines.push(`    type: ${item.type}`);
    lines.push(`    status: ${item.status}`);
    if (item.scope) lines.push(`    scope: "${escapeYAMLString(item.scope)}"`);
    if (item.title) lines.push(`    title: "${escapeYAMLString(item.title)}"`);
    lines.push(`    safe_to_proceed: ${item.safe_to_proceed}`);
    if (item.created_at) lines.push(`    created_at: "${item.created_at}"`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ─── Counter Reconciliation ─────────────────────────────────────────────────

function reconcileCounters(wsDir, results, opts = {}) {
  const configPath = path.join(wsDir, 'config.yaml');
  const { ok, data: config } = readYAMLFile(configPath);
  if (!ok) return { updated: [], warnings: ['Could not read config.yaml for counter reconciliation'] };

  const patches = {};
  const updated = [];

  // Queue items
  if (results.queue && results.queue.maxId >= (config.next_item_id || 0)) {
    patches.next_item_id = results.queue.maxId + 1;
    updated.push(`next_item_id→${results.queue.maxId + 1}`);
  }
  // Findings
  if (results.findings && results.findings.maxId >= (config.next_finding_id || 0)) {
    patches.next_finding_id = results.findings.maxId + 1;
    updated.push(`next_finding_id→${results.findings.maxId + 1}`);
  }
  // Sprints
  if (results.sprints && results.sprints.maxId >= (config.next_sprint_id || 0)) {
    patches.next_sprint_id = results.sprints.maxId + 1;
    updated.push(`next_sprint_id→${results.sprints.maxId + 1}`);
  }
  // Enhancements
  if (results.enhancements && results.enhancements.maxId >= (config.next_enh_id || 0)) {
    patches.next_enh_id = results.enhancements.maxId + 1;
    updated.push(`next_enh_id→${results.enhancements.maxId + 1}`);
  }
  // Readiness
  if (results.readiness && results.readiness.maxId >= (config.next_ready_id || 0)) {
    patches.next_ready_id = results.readiness.maxId + 1;
    updated.push(`next_ready_id→${results.readiness.maxId + 1}`);
  }
  // Runs — scan directory names
  const runsDir = path.join(wsDir, 'runs');
  if (fs.existsSync(runsDir)) {
    const runDirs = fs.readdirSync(runsDir).filter(d => d.match(/^run-\d+$/));
    const maxRun = runDirs.reduce((max, d) => Math.max(max, parseInt(d.match(/\d+/)[0])), 0);
    if (maxRun >= (config.next_run_id || 0)) {
      patches.next_run_id = maxRun + 1;
      updated.push(`next_run_id→${maxRun + 1}`);
    }
  }
  // Recommendations — scan files
  const recDir = path.join(wsDir, 'recommendations');
  if (fs.existsSync(recDir)) {
    const recFiles = globFiles(recDir, 'REC-*.yaml');
    const maxRec = recFiles.reduce((max, f) => {
      const n = parseInt(path.basename(f).match(/\d+/)?.[0] || '0');
      return Math.max(max, n);
    }, 0);
    if (maxRec >= (config.next_rec_id || 0)) {
      patches.next_rec_id = maxRec + 1;
      updated.push(`next_rec_id→${maxRec + 1}`);
    }
  }

  if (!opts.dryRun && Object.keys(patches).length > 0) {
    patchYAMLFile(configPath, patches);
  }

  return { updated, patches };
}

// ─── Runs Index (WS-314) ────────────────────────────────────────────────────

function rebuildRunsIndex(wsDir, opts = {}) {
  // Index every run dir that has a summary.yaml. Hot/cold flag derived from
  // the summary's `date` field — runs older than RUNS_HOT_DAYS are flagged
  // cold (still readable; just deprioritized in default scan).
  const runsDir = path.join(wsDir, 'runs');
  if (!fs.existsSync(runsDir)) {
    return { total: 0, items: [], skipped: 0, warnings: [], maxId: 0 };
  }

  const RUNS_HOT_DAYS = 180;
  const today = Date.now();

  let entries;
  try { entries = fs.readdirSync(runsDir, { withFileTypes: true }); }
  catch { return { total: 0, items: [], skipped: 0, warnings: [], maxId: 0 }; }

  const items = [];
  const warnings = [];
  let skipped = 0;

  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (!/^run-[A-Za-z0-9_-]+$/.test(ent.name)) continue;
    if (ent.name === 'archive') continue;

    const summaryPath = path.join(runsDir, ent.name, 'summary.yaml');
    if (!fs.existsSync(summaryPath)) {
      skipped++;
      continue;
    }
    const r = readYAMLFile(summaryPath);
    if (!r.ok || !r.data) {
      warnings.push(`runs: skipping ${ent.name}: ${r.error || 'unparseable summary.yaml'}`);
      skipped++;
      continue;
    }
    const data = r.data;

    let hot = true;
    const dateStr = String(data.date || data.completed_at || '');
    const dateMatch = dateStr.match(/^\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      const ageDays = (today - Date.parse(dateMatch[0])) / (24 * 60 * 60 * 1000);
      if (Number.isFinite(ageDays) && ageDays > RUNS_HOT_DAYS) hot = false;
    }

    const workItems = Array.isArray(data.work_items_created) ? data.work_items_created : [];
    const grandfathered = !!(data._provenance && data._provenance.grandfathered);

    items.push({
      run_id: String(data.run_id || ent.name),
      engine: data.engine || '',
      target: data.target || '',
      contract_id: data.contract_id || '',
      mode: data.mode || '',
      date: dateStr || '',
      launch_readiness: data.launch_readiness || '',
      work_items_created: workItems.length,
      findings_count: typeof data.findings_after_synthesis === 'number'
        ? data.findings_after_synthesis : null,
      hot,
      grandfathered,
    });
  }

  // Stable ordering: most-recent first.
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  if (!opts.dryRun) {
    const indexContent = buildRunsIndexYAML(items);
    const indexPath = path.join(wsDir, 'runs-index.yaml');
    const lockPath = `${indexPath}.lock`;
    withFileLock(lockPath, () => {
      writeFileAtomic(indexPath, indexContent);
    }, { ownerLabel: 'reconcile:runs', maxWaitMs: 10000 });
  }

  return { total: items.length, items, skipped, warnings, maxId: 0 };
}

function buildRunsIndexYAML(items) {
  const hot = items.filter(i => i.hot).length;
  const cold = items.length - hot;
  const grandfathered = items.filter(i => i.grandfathered).length;
  const lines = [
    '# Runs Index — fast-scan summary of every engine run with a summary.yaml',
    '# Rebuild from: .claude/workstream/runs/run-*/summary.yaml (WS-314)',
    '# Updated by /engine completion + cwos-reconcile',
    '#',
    `# total: ${items.length}  hot: ${hot}  cold: ${cold}  grandfathered: ${grandfathered}`,
    '',
    `total_runs: ${items.length}`,
    `hot: ${hot}`,
    `cold: ${cold}`,
    'runs:' + (items.length === 0 ? ' []' : ''),
  ];
  for (const item of items) {
    lines.push(`  - run_id: "${item.run_id}"`);
    if (item.engine) lines.push(`    engine: "${escapeYAMLString(item.engine)}"`);
    if (item.target) lines.push(`    target: "${escapeYAMLString(item.target)}"`);
    if (item.contract_id) lines.push(`    contract_id: "${item.contract_id}"`);
    if (item.mode) lines.push(`    mode: ${item.mode}`);
    if (item.date) lines.push(`    date: "${item.date}"`);
    if (item.launch_readiness) lines.push(`    launch_readiness: ${item.launch_readiness}`);
    lines.push(`    work_items_created: ${item.work_items_created}`);
    if (item.findings_count !== null) lines.push(`    findings_count: ${item.findings_count}`);
    lines.push(`    hot: ${item.hot}`);
    if (item.grandfathered) lines.push(`    grandfathered: true`);
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ─── Convenience: rebuild everything ────────────────────────────────────────

function rebuildAll(wsDir, opts = {}) {
  const queue = rebuildQueueIndex(wsDir, opts);
  const findings = rebuildFindingsIndex(wsDir, opts);
  const sprints = rebuildSprintIndex(wsDir, opts);
  const enhancements = rebuildEnhancementsIndex(wsDir, opts);
  const readiness = rebuildReadinessIndex(wsDir, opts);
  const runs = rebuildRunsIndex(wsDir, opts);
  const counters = reconcileCounters(
    wsDir, { queue, findings, sprints, enhancements, readiness }, opts
  );

  const allWarnings = [
    ...queue.warnings, ...findings.warnings, ...sprints.warnings,
    ...enhancements.warnings, ...readiness.warnings, ...runs.warnings,
    ...(counters.warnings || [])
  ];

  return { queue, findings, sprints, enhancements, readiness, runs, counters, warnings: allWarnings };
}

// ─── Entity Type Registry ───────────────────────────────────────────────────

const ENTITY_TYPES = ['queue', 'findings', 'sprints', 'enhancements', 'readiness', 'runs', 'recommendations'];

module.exports = {
  rebuildQueueIndex,
  rebuildFindingsIndex,
  rebuildSprintIndex,
  rebuildEnhancementsIndex,
  rebuildReadinessIndex,
  rebuildRunsIndex,
  reconcileCounters,
  rebuildAll,
  ENTITY_TYPES,
};
