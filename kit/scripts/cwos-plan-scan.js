#!/usr/bin/env node
/**
 * cwos-plan-scan — Detect orphan plan items and orphan plan decisions.
 *
 * A "plan doc" is any markdown file in docs/ whose name ends in `-plan.md`
 * (e.g., `docs/self-compliance-plan.md`). Plan docs typically contain:
 *   - Phase descriptions with embedded WS item references (WS-A, WS-B, ...)
 *   - A "Decisions Log" markdown table with D1..Dn rows
 *
 * A plan item becomes orphaned when the plan references a work item or
 * decision that has no corresponding artifact:
 *   - Plan WS-X with no matching queue/WS-*.yaml whose source.plan points here
 *   - Plan D-N with no matching DEC-NNN in system/decisions.md referencing it
 *
 * Root cause for the 2026-04-20 incident: self-compliance-plan.md defined
 * WS-A..WS-M but none were materialized in the queue, so /next couldn't see
 * them. This script catches that class of drift.
 *
 * Usage:
 *   node cwos-plan-scan.js                     # human report
 *   node cwos-plan-scan.js --quiet             # silent unless violations
 *   node cwos-plan-scan.js --strict            # exit 1 on any violation
 *   node cwos-plan-scan.js --json              # machine-readable JSON report
 *   node cwos-plan-scan.js --emit-findings     # write findings/FIND-*.yaml
 *   node cwos-plan-scan.js --workstream-dir <p>
 *   node cwos-plan-scan.js --docs-dir <p>      # override docs/ root
 *
 * Plan doc conventions this scanner supports:
 *   1. Plan WS items: headings or bullets of the form "### WS-X — title" or
 *      "**WS-X** — title" or "WS-X" inline. Plan IDs are single-capital-letter
 *      or multi-letter (WS-A, WS-AB) to distinguish from numbered queue IDs.
 *   2. Decisions Log table: a markdown table whose header row contains
 *      "ID", "Decision", and "Chose" (case-insensitive). Rows yield D1..Dn ids.
 *
 * Machine-readable plan metadata (optional, in the plan's frontmatter):
 *   ```yaml
 *   ---
 *   plan_id: self-compliance
 *   ws_id_prefix: WS-        # pattern used for plan-internal IDs
 *   decision_prefix: D       # pattern used for plan-internal decision IDs
 *   ---
 *   ```
 */

'use strict';

require('./lib/preflight');

const path = require('path');
const fs = require('fs');
const { findWorkstreamDir, globFiles, readYAMLFile, writeFileAtomic, todayISO, withFileLock, makeEventEmitter } = require('./lib/cwos-utils');

const emitEvent = makeEventEmitter();

function main() {
  const args = process.argv.slice(2);
  const quiet = args.includes('--quiet');
  const strict = args.includes('--strict');
  const asJson = args.includes('--json');
  const emitFindings = args.includes('--emit-findings');

  let wsDir;
  const dirIdx = args.indexOf('--workstream-dir');
  if (dirIdx !== -1 && args[dirIdx + 1]) {
    wsDir = path.resolve(args[dirIdx + 1]);
  } else {
    try { wsDir = findWorkstreamDir(process.cwd()); }
    catch {
      if (!quiet) process.stderr.write('plan-scan: no workstream dir found\n');
      return 0;
    }
  }

  const repoRoot = path.resolve(wsDir, '..', '..');
  const docsDirIdx = args.indexOf('--docs-dir');
  const docsDir = docsDirIdx !== -1 && args[docsDirIdx + 1]
    ? path.resolve(args[docsDirIdx + 1])
    : path.join(repoRoot, 'docs');

  if (!fs.existsSync(docsDir)) {
    if (!quiet) process.stderr.write(`plan-scan: docs dir not found: ${docsDir}\n`);
    return 0;
  }

  // 1. Discover plan docs.
  const planFiles = discoverPlanDocs(docsDir);
  if (planFiles.length === 0) {
    if (!quiet && !asJson) process.stdout.write('plan-scan: no plan docs found.\n');
    if (asJson) process.stdout.write(JSON.stringify({ plans: [], violations: [] }, null, 2) + '\n');
    return 0;
  }

  // 2. Load queue items and decisions.md.
  const queue = loadQueueItems(wsDir);
  const decisions = loadDecisions(path.join(repoRoot, 'system', 'decisions.md'));

  // 3. Scan each plan doc.
  const report = { plans: [], violations: [] };
  for (const planPath of planFiles) {
    const scan = scanPlanDoc(planPath, queue, decisions);
    report.plans.push({
      file: path.relative(repoRoot, planPath),
      plan_id: scan.plan_id,
      ws_items_detected: scan.ws_items.length,
      ws_items_orphan: scan.orphan_ws.length,
      decisions_detected: scan.decisions.length,
      decisions_orphan: scan.orphan_decisions.length,
    });
    for (const v of scan.violations) report.violations.push(v);
  }

  // 4. Emit findings if requested.
  if (emitFindings && report.violations.length > 0) {
    emitFindingsFromViolations(wsDir, report.violations);
  }

  // 5. Report.
  if (asJson) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else if (!quiet || report.violations.length > 0) {
    printReport(report);
  }

  return strict && report.violations.length > 0 ? 1 : 0;
}

// ─── Plan Discovery ────────────────────────────────────────────────────────

function discoverPlanDocs(docsDir) {
  const results = [];
  function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip archive/ subdirs to avoid flagging historical plans
        if (entry.name === 'archive') continue;
        walk(full);
      } else if (entry.isFile() && /-plan\.md$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(docsDir);
  return results.sort();
}

// ─── Plan Scanning ─────────────────────────────────────────────────────────

function scanPlanDoc(planPath, queue, decisions) {
  const content = fs.readFileSync(planPath, 'utf8');
  const frontmatter = parseFrontmatter(content);
  const planId = frontmatter.plan_id || path.basename(planPath, '.md');

  const wsPrefix = frontmatter.ws_id_prefix || 'WS-';
  const decPrefix = frontmatter.decision_prefix || 'D';

  const wsItems = extractPlanWsItems(content, wsPrefix);
  const planDecisions = extractPlanDecisions(content, decPrefix);

  // Cross-reference.
  const orphanWs = [];
  for (const item of wsItems) {
    const matched = queue.some(q =>
      // Match either by explicit source.plan ref OR by plan-id substring in source
      (q.source && q.source.plan && q.source.plan.endsWith(path.basename(planPath))
        && q.source.original_id && q.source.original_id.includes(item.id))
      // OR by original_id only (looser match)
      || (q.source && q.source.original_id && q.source.original_id.split(' ')[0] === item.id)
    );
    if (!matched) orphanWs.push(item);
  }

  const orphanDecisions = [];
  for (const dec of planDecisions) {
    // Match "Plan ref:" lines tolerantly — accept surrounding markdown bold
    // (`**Plan ref:**`), trailing backticks, or inline code. Strip markdown
    // noise before matching.
    const normalized = decisions.map(d => ({
      ...d,
      body_normalized: d.body ? d.body.replace(/\*\*|`|_/g, '') : '',
    }));
    const matched = normalized.some(d =>
      // Match by plan_ref field in the ADR body (markdown-stripped)
      (d.body_normalized && new RegExp(`Plan ref:\\s*${dec.id}\\b`, 'i').test(d.body_normalized))
      // OR by plan-prefix anywhere in body (looser fallback)
      || (d.body_normalized && new RegExp(`\\b${planId}[^\\n]*${dec.id}\\b`).test(d.body_normalized))
    );
    if (!matched) orphanDecisions.push(dec);
  }

  const violations = [];
  for (const item of orphanWs) {
    violations.push({
      plan_file: planPath,
      plan_id: planId,
      type: 'orphan_plan_ws',
      ref: item.id,
      title: item.title,
      message: `Plan ${planId} references ${item.id} — no matching queue/WS-*.yaml found.`,
    });
  }
  for (const dec of orphanDecisions) {
    violations.push({
      plan_file: planPath,
      plan_id: planId,
      type: 'orphan_plan_decision',
      ref: dec.id,
      title: dec.chose || dec.decision || '(no summary)',
      message: `Plan ${planId} Decisions Log has ${dec.id} — no matching DEC in system/decisions.md references it.`,
    });
  }

  return {
    plan_id: planId,
    ws_items: wsItems,
    decisions: planDecisions,
    orphan_ws: orphanWs,
    orphan_decisions: orphanDecisions,
    violations,
  };
}

function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return {};
  const fm = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*?)\s*$/);
    if (kv) fm[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return fm;
}

function extractPlanWsItems(content, prefix) {
  // Match WS-<letters or digits> in three contexts:
  //   "### WS-X — title"
  //   "**WS-X** — title"
  //   "### WS-X: title"
  // Only match IDs that aren't pure digits-beyond-4 (to avoid matching queue IDs like WS-120)
  // Plan IDs are typically single or short letter sequences (WS-A, WS-AB, WS-M).
  // We also match purely-digit ones but annotate whether they look queue-shaped.
  const items = new Map();
  const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`^#{2,4}\\s+${escaped}([A-Z][A-Z0-9]*|[0-9]+)(?:[-–—:\\s].*?)?\\s*$`, 'gm'),
    new RegExp(`\\*\\*${escaped}([A-Z][A-Z0-9]*|[0-9]+)\\*\\*`, 'g'),
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const id = `${prefix}${m[1]}`;
      if (!items.has(id)) {
        // Extract title text near the match
        const lineStart = content.lastIndexOf('\n', m.index) + 1;
        const lineEnd = content.indexOf('\n', m.index);
        const line = content.slice(lineStart, lineEnd === -1 ? content.length : lineEnd);
        const title = line
          .replace(/^#+\s*/, '')
          .replace(new RegExp(`^.*?${escaped}[A-Z0-9]+\\s*[-–—:\\s]*`), '')
          .replace(/^\*\*.*?\*\*\s*[-–—:]?\s*/, '')
          .trim();
        items.set(id, { id, title: title || '(no title)' });
      }
    }
  }
  return Array.from(items.values());
}

function extractPlanDecisions(content, decPrefix) {
  // Locate a markdown table whose header contains "ID", "Decision", "Chose".
  // Collect rows; the ID column yields D1..Dn.
  const items = [];
  const lines = content.split('\n');
  let tableStart = -1;
  let decisionColIdx = -1, choseColIdx = -1, idColIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/\|/.test(line) && /\bID\b/i.test(line) && /Decision/i.test(line) && /Chose/i.test(line)) {
      const cols = line.split('|').map(c => c.trim().toLowerCase());
      idColIdx = cols.findIndex(c => c === 'id');
      decisionColIdx = cols.findIndex(c => c === 'decision');
      choseColIdx = cols.findIndex(c => c === 'chose');
      tableStart = i + 2; // skip header + separator
      break;
    }
  }

  if (tableStart === -1) return [];

  for (let i = tableStart; i < lines.length; i++) {
    const line = lines[i];
    if (!/\|/.test(line) || line.trim() === '') break;
    const cols = line.split('|').map(c => c.trim());
    const id = cols[idColIdx];
    if (id && new RegExp(`^${decPrefix}\\d+$`).test(id)) {
      items.push({
        id,
        decision: cols[decisionColIdx] || '',
        chose: cols[choseColIdx] || '',
      });
    }
  }
  return items;
}

// ─── Queue Loading ─────────────────────────────────────────────────────────

function loadQueueItems(wsDir) {
  const queueDir = path.join(wsDir, 'queue');
  if (!fs.existsSync(queueDir)) return [];
  const files = globFiles(queueDir, 'WS-*.yaml');
  const items = [];
  for (const f of files) {
    const { ok, data } = readYAMLFile(f);
    if (ok && data && data.id) items.push(data);
  }
  return items;
}

function loadDecisions(decisionsPath) {
  if (!fs.existsSync(decisionsPath)) return [];
  const content = fs.readFileSync(decisionsPath, 'utf8');
  const decisions = [];
  // Match "### DEC-NNN: Title" blocks; capture until next "### DEC-" or "## "
  const re = /^### (DEC-\d+):[^\n]*$/gm;
  let m;
  const starts = [];
  while ((m = re.exec(content)) !== null) {
    starts.push({ id: m[1], index: m.index });
  }
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : content.length;
    // Also stop at next top-level "## " section
    const nextH2 = content.indexOf('\n## ', start);
    const bounded = nextH2 !== -1 && nextH2 < end ? nextH2 : end;
    decisions.push({
      id: starts[i].id,
      body: content.slice(start, bounded),
    });
  }
  return decisions;
}

// ─── Reporting ─────────────────────────────────────────────────────────────

function printReport(report) {
  for (const plan of report.plans) {
    process.stdout.write(`\nPlan: ${plan.plan_id} (${plan.file})\n`);
    process.stdout.write(`  Work items referenced: ${plan.ws_items_detected} (orphan: ${plan.ws_items_orphan})\n`);
    process.stdout.write(`  Decisions referenced:  ${plan.decisions_detected} (orphan: ${plan.decisions_orphan})\n`);
  }

  if (report.violations.length === 0) {
    process.stdout.write('\nplan-scan: clean — all plan items have matching artifacts.\n');
    return;
  }

  process.stdout.write(`\nplan-scan: ${report.violations.length} violation(s) found:\n`);
  for (const v of report.violations) {
    process.stdout.write(`  - ${v.type} (${v.plan_id}): ${v.ref} — ${v.title}\n`);
    process.stdout.write(`    ${v.message}\n`);
  }
  process.stdout.write('\nFix: enqueue missing work items to queue/ or log missing decisions to system/decisions.md.\n');
}

// ─── Findings Emission ─────────────────────────────────────────────────────

function emitFindingsFromViolations(wsDir, violations) {
  const findingsDir = path.join(wsDir, 'findings');
  if (!fs.existsSync(findingsDir)) fs.mkdirSync(findingsDir, { recursive: true });

  // WS-311 AC f: lock the entire glob+max+write flow against any concurrent
  // FIND-NNN allocator. Without this, two simultaneous plan-scans (or future
  // emitters) read the same max id, both compute max+1, second writer
  // silently overwrites first. run-014 manifest evidence: 51 FIND overflow.
  const lockPath = path.join(findingsDir, '.find-counter.lock');
  withFileLock(lockPath, () => {
    // Find next FIND ID by scanning existing + archive (under lock).
    const existing = globFiles(findingsDir, 'FIND-*.yaml');
    const archive = fs.existsSync(path.join(findingsDir, 'archive'))
      ? globFiles(path.join(findingsDir, 'archive'), 'FIND-*.yaml')
      : [];
    const allIds = [...existing, ...archive]
      .map(f => parseInt(path.basename(f).match(/FIND-(\d+)/)?.[1] || '0', 10));
    let nextId = (allIds.length ? Math.max(...allIds) : 0) + 1;

    for (const v of violations) {
      const findingId = `FIND-${String(nextId).padStart(3, '0')}`;
      nextId++;
      const yaml = [
        `id: "${findingId}"`,
        `title: "Plan drift: ${v.ref} orphan in ${v.plan_id}"`,
        `severity: high`,
        `status: open`,
        `type: ${v.type}`,
        `program: program-integrity`,
        `source:`,
        `  script: cwos-plan-scan`,
        `  plan_file: "${path.relative(path.resolve(wsDir, '..', '..'), v.plan_file)}"`,
        `  plan_id: "${v.plan_id}"`,
        `  plan_ref: "${v.ref}"`,
        `description: >`,
        `  ${v.message}`,
        `created_at: "${todayISO()}"`,
        '',
      ].join('\n');
      writeFileAtomic(path.join(findingsDir, `${findingId}.yaml`), yaml);
      // Shadow event (WS-174): one event per finding emitted. Only fires when
      // an orphan was discovered — no heartbeat per conditional-mutation rule.
      emitEvent('T15:plan-scan', 'plan-orphan-finding-emitted', {
        finding_id: findingId,
        plan_id: v.plan_id,
        ref: v.ref,
      });
    }
  }, { ownerLabel: 'plan-scan:emit-findings', maxWaitMs: 10000 });
}

try {
  process.exit(main());
} catch (err) {
  process.stderr.write(`plan-scan: fatal — ${err.message}\n`);
  if (process.argv.includes('--verbose')) process.stderr.write(err.stack + '\n');
  process.exit(2);
}
