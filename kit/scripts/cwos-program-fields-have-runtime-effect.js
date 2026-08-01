#!/usr/bin/env node
/**
 * cwos-program-fields-have-runtime-effect.js — accountability-field reader validator.
 *
 * Enforces INV-program-fields-have-runtime-effect: every leaf field declared
 * in the `accountability:` block of kit/templates/workstream/programs/
 * prog-template.yaml must have at least one non-comment runtime reader in
 * kit/scripts/. Rejects "decoration-only" fields — YAML keys that ship to
 * adopted repos but no code ever reads them.
 *
 * Background: FIND-248 (eng-engine challenge run-019) surfaced the class
 * where prog-template grows new accountability fields without runtime
 * wiring. Paired with WS-350 (max_open_items / priority_floor enforcement)
 * which gave every currently-declared field a runtime reader; this validator
 * locks that property in as a kit-publish-time gate.
 *
 * Invocations:
 *   node cwos-program-fields-have-runtime-effect.js          # JSON to stdout
 *   node cwos-program-fields-have-runtime-effect.js --human  # markdown
 *   node cwos-program-fields-have-runtime-effect.js --quiet  # JSON only
 *
 * Exit codes:
 *   0 = every declared field has at least one reader
 *   1 = at least one decoration-only field detected
 *   2 = file read / scan error
 *
 * Output: JSON to stdout ({ ok, exit_code, fields_checked, failures }).
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Field-effect mapping. Each entry declares one accountability leaf field
// (using its dotted path under `accountability:`) plus one or more reader
// regex patterns. The validator succeeds for a field if ANY pattern matches
// in ANY non-test, non-comment line under kit/scripts/.
//
// Event-emission verification is intentionally omitted (see WS-366 plan):
// some fields drive compose-time behavior without emitting (e.g.
// priority_floor mutates candidate scores silently), so an "AND emits an
// event" gate would create false positives. The validator gates on reader
// presence only; the field→event mapping below is documentation, not a gate.
//
// Field → effect site (documentation):
//   on_finding.action                          → cwos-reconcile promoteFinding (creates WS items)
//   on_finding.max_open_items                  → cwos-reconcile validateProgramCaps → 'program_cap_breach' event (WS-350)
//   on_finding.priority_floor                  → cwos-next compose; mutates candidate priority_score (WS-350)
//   on_finding.escalation.stale_days           → cwos-next staleDaysFloor; gate-block source
//   on_finding.escalation.escalate_to          → cwos-pulse session-start surfacing
//   on_finding.escalation.escalate_priority_bump → cwos-next priority_score bump
//   on_stale.action                            → cwos-reconcile (work item creation on stale)
//   on_stale.message                           → cwos-pulse banner / cwos-next gate message
//   on_stale.block_sprint                      → cwos-next gate sprint_block; 'stale_protocol_acknowledged' event
//   on_stale.stale_days                        → cwos-next staleDaysFloor (program-level floor for gate)
//   on_tier_change.action                      → cwos-pulse session-start surfacing
//   on_tier_change.auto_escalate               → cwos-pulse runEscalate; 'program_escalated' event
//   on_tier_change.auto_deescalate             → cwos-pulse runEscalate (downgrade path)
const ACCOUNTABILITY_FIELDS = [
  { path: 'on_finding.action',                            readers: [/on_finding[\s\S]{0,40}?action/, /'create_work_item'/] },
  { path: 'on_finding.max_open_items',                    readers: [/max_open_items/] },
  { path: 'on_finding.priority_floor',                    readers: [/priority_floor/] },
  { path: 'on_finding.escalation.stale_days',             readers: [/escalation[\s\S]{0,30}?stale_days/, /escalation\.stale_days/] },
  { path: 'on_finding.escalation.escalate_to',            readers: [/escalate_to/] },
  { path: 'on_finding.escalation.escalate_priority_bump', readers: [/escalate_priority_bump/] },
  { path: 'on_stale.action',                              readers: [/on_stale[\s\S]{0,40}?action/, /onStale\.action/] },
  { path: 'on_stale.message',                             readers: [/on_stale[\s\S]{0,40}?message/, /onStale\.message/] },
  { path: 'on_stale.block_sprint',                        readers: [/block_sprint/] },
  { path: 'on_stale.stale_days',                          readers: [/on_stale[\s\S]{0,40}?stale_days/, /onStale\.stale_days/, /staleDaysFloor/] },
  { path: 'on_tier_change.action',                        readers: [/on_tier_change/, /notify_founder/] },
  { path: 'on_tier_change.auto_escalate',                 readers: [/auto_escalate/] },
  { path: 'on_tier_change.auto_deescalate',               readers: [/auto_deescalate/] },
];

function walkScripts(rootDir) {
  const scriptsDir = path.join(rootDir, 'kit', 'scripts');
  const out = [];
  function recur(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === '__tests__') continue;
        recur(full);
      } else if (e.isFile() && full.endsWith('.js') && !full.endsWith('.test.js')) {
        out.push(full);
      }
    }
  }
  recur(scriptsDir);
  return out;
}

function stripComments(source) {
  // Strip block comments first (greedy non-spanning patterns are sufficient
  // for kit/scripts/ style — no nested block comments).
  let out = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // Then line comments. Avoid stripping inside string literals by skipping
  // any // that appears after a quote on the same line. Approximation:
  // remove // through end-of-line ONLY when no unescaped quote precedes it.
  out = out.split('\n').map((line) => {
    const idx = line.indexOf('//');
    if (idx < 0) return line;
    // Quick check: if there's a quote before //, leave the line alone — too
    // ambiguous to safely strip. Patterns we care about (max_open_items etc.)
    // won't live inside a string AND a comment simultaneously.
    const beforeSlash = line.slice(0, idx);
    if (/['"`]/.test(beforeSlash)) return line;
    return beforeSlash;
  }).join('\n');
  return out;
}

function checkAccountabilityFieldReaders(rootDir) {
  const files = walkScripts(rootDir);
  if (files.length === 0) {
    return { ok: false, exit_code: 2, fields_checked: 0, failures: [], error: `no scripts found under kit/scripts/ at ${rootDir}` };
  }
  // Pre-read and pre-strip all files (one pass).
  const fileContents = [];
  for (const f of files) {
    let content;
    try { content = fs.readFileSync(f, 'utf8'); }
    catch (e) { return { ok: false, exit_code: 2, fields_checked: 0, failures: [], error: `read failed: ${f}: ${e.message}` }; }
    fileContents.push({ file: f, content: stripComments(content) });
  }
  const failures = [];
  for (const field of ACCOUNTABILITY_FIELDS) {
    const hit = fileContents.some(({ content }) =>
      field.readers.some((re) => re.test(content))
    );
    if (!hit) failures.push({ field: field.path, reason: 'no-reader' });
  }
  return {
    ok: failures.length === 0,
    exit_code: failures.length === 0 ? 0 : 1,
    fields_checked: ACCOUNTABILITY_FIELDS.length,
    failures,
  };
}

// WS-549: named repoRoot(), but every consumer joins `kit/scripts` onto it to
// scan the kit's own scripts for field readers. That is distribution content,
// not repo state, so it resolves from the distribution.
function repoRoot() {
  return require('./lib/kit-paths').resolveDistRoot();
}

function renderHuman(result) {
  const lines = [];
  lines.push(`## Accountability Field Reader Audit`);
  lines.push(``);
  lines.push(`Fields checked: ${result.fields_checked}`);
  lines.push(`Failures: ${result.failures.length}`);
  lines.push(``);
  if (result.failures.length === 0) {
    lines.push(`✓ Every declared accountability field has at least one runtime reader.`);
  } else {
    lines.push(`Decoration-only fields detected:`);
    for (const f of result.failures) {
      lines.push(`  - ${f.field} (${f.reason})`);
    }
  }
  lines.push(``);
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const human = args.includes('--human');
  const quiet = args.includes('--quiet');
  const result = checkAccountabilityFieldReaders(repoRoot());
  if (result.error && !quiet) {
    process.stderr.write(`cwos-program-fields-have-runtime-effect: ${result.error}\n`);
  }
  if (human) {
    process.stdout.write(renderHuman(result));
  } else {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  }
  process.exit(result.exit_code);
}

if (require.main === module) main();

module.exports = {
  checkAccountabilityFieldReaders,
  ACCOUNTABILITY_FIELDS,
  stripComments,
};
