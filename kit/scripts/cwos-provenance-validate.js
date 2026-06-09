#!/usr/bin/env node
/**
 * cwos-provenance-validate.js — Protocol-run provenance gate (v1).
 *
 * Enforces INV-F2 (no rigor compression) from system/intention.md by
 * validating that program files declare engine substitutions explicitly
 * rather than silently. See kit/templates/workstream/evidence/PROVENANCE.md.
 *
 * v1 scope (current):
 *   For each program file, for each non-null last_run_by_protocol.<protocol>:
 *   - if engine matches protocols.<protocol>.engine → OK
 *   - if engine differs:
 *       - require spec_compliant: false
 *       - require status: interim-legacy-no-provenance | legacy-no-provenance
 *   - runs dated before 2026-05-06 are grandfathered (no spec_compliant required)
 *
 * v2 scope (deferred): full provenance blocks on evidence files, run_id
 * resolution, agent dispatch tracking. Tracked under WS-304 v2.
 *
 * Invocations:
 *   node cwos-provenance-validate.js --program <path>
 *   node cwos-provenance-validate.js --all
 *   node cwos-provenance-validate.js --staged    # for pre-commit; reads stdin newline-list
 *   node cwos-provenance-validate.js --stdin     # parse single program from stdin
 *
 * Exit codes:
 *   0 = valid
 *   1 = engine spec mismatch without spec_compliant: false
 *   2 = spec_compliant: false without valid status
 *   3 = invalid status value
 *   (lowest exit code wins on multiple failures)
 *
 * Output: JSON object to stdout: { ok, exit_code, programs_checked, findings }.
 * Human messages to stderr.
 *
 * Zero LLM calls. Zero external deps. Uses kit/scripts/lib/cwos-utils.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseYAML, readYAMLFile, globFiles } = require('./lib/cwos-utils');

// ─── Constants ──────────────────────────────────────────────────────────────

const GRANDFATHER_DATE = '2026-05-06';
const VALID_NON_COMPLIANT_STATUSES = new Set([
  'interim-legacy-no-provenance',
  'legacy-no-provenance',
]);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Finding helpers ────────────────────────────────────────────────────────

function mkFinding(programPath, protocol, exitCode, message, detail) {
  return {
    program: programPath,
    protocol,
    exit_code: exitCode,
    severity: 'block',
    message,
    detail: detail || null,
  };
}

// ─── Core validation ────────────────────────────────────────────────────────

/**
 * Validate one program file's last_run_by_protocol entries against the
 * protocols spec. Returns array of findings (empty = clean).
 */
function validateProgram(programPath, programYaml) {
  const findings = [];
  const protocols = programYaml.protocols || {};
  const lastRun = programYaml.last_run_by_protocol || {};

  for (const protocolName of Object.keys(lastRun)) {
    const entry = lastRun[protocolName];
    if (!entry || typeof entry !== 'object') continue;

    // Null/empty entries — protocol has not run, nothing to validate
    if (entry.date == null && entry.engine == null && entry.run_id == null) {
      continue;
    }

    // Date may be missing on partially-populated entries — treat as ungrandfathered
    const runDate = entry.date && typeof entry.date === 'string' ? entry.date : null;
    if (runDate && !ISO_DATE_RE.test(runDate)) {
      findings.push(mkFinding(
        programPath, protocolName, 1,
        `last_run_by_protocol.${protocolName}.date is malformed: "${runDate}" (expected ISO YYYY-MM-DD)`,
      ));
      continue;
    }

    const grandfathered = runDate && runDate < GRANDFATHER_DATE;

    const protoSpec = protocols[protocolName];
    const specEngine = protoSpec && protoSpec.engine ? String(protoSpec.engine).trim() : null;
    const runEngine = entry.engine ? String(entry.engine).trim() : null;

    // Spec missing — can't validate. Note as low-severity (would be a
    // separate finding class for spec completeness; out of v1 scope).
    if (!specEngine) continue;
    if (!runEngine) {
      findings.push(mkFinding(
        programPath, protocolName, 1,
        `last_run_by_protocol.${protocolName}.engine is missing but protocol spec declares engine: ${specEngine}`,
      ));
      continue;
    }

    const enginesMatch = runEngine === specEngine;
    const specCompliant = entry.spec_compliant;
    const status = entry.status;

    if (enginesMatch) {
      // Happy path. If spec_compliant is explicitly false despite a match,
      // that's contradictory but not a blocker — informational.
      continue;
    }

    // Engines don't match.
    if (grandfathered) {
      // Pre-WS-304 runs are allowed without spec_compliant declaration.
      continue;
    }

    // Substitution must be declared explicitly.
    if (specCompliant !== false) {
      findings.push(mkFinding(
        programPath, protocolName, 1,
        `Engine spec mismatch in last_run_by_protocol.${protocolName}: ` +
        `protocol spec is "${specEngine}", run reports "${runEngine}". ` +
        `If substitution was intentional, declare spec_compliant: false ` +
        `with a valid status. Otherwise, dispatch the spec'd engine.`,
        { spec_engine: specEngine, run_engine: runEngine },
      ));
      continue;
    }

    // spec_compliant: false declared. Require status.
    if (status == null || typeof status !== 'string') {
      findings.push(mkFinding(
        programPath, protocolName, 2,
        `last_run_by_protocol.${protocolName} declares spec_compliant: false ` +
        `but is missing status. Required: one of ${[...VALID_NON_COMPLIANT_STATUSES].join(', ')}.`,
      ));
      continue;
    }

    if (!VALID_NON_COMPLIANT_STATUSES.has(status)) {
      findings.push(mkFinding(
        programPath, protocolName, 3,
        `last_run_by_protocol.${protocolName}.status = "${status}" is not valid. ` +
        `Allowed: ${[...VALID_NON_COMPLIANT_STATUSES].join(', ')}.`,
      ));
      continue;
    }
    // spec_compliant: false + valid status = explicitly acknowledged. OK.
  }

  return findings;
}

// ─── File loading ───────────────────────────────────────────────────────────

function loadProgram(programPath) {
  if (!fs.existsSync(programPath)) {
    return { error: `File not found: ${programPath}` };
  }
  try {
    const result = readYAMLFile(programPath);
    // readYAMLFile returns { ok, data, warnings } — unwrap to plain object
    if (!result || result.ok === false) {
      return { error: `Parse failed: ${programPath}: ${(result && result.error) || 'unknown'}` };
    }
    return { yaml: result.data };
  } catch (err) {
    return { error: `Parse failed: ${programPath}: ${err.message}` };
  }
}

// ─── CLI entry points ───────────────────────────────────────────────────────

function runOnFile(programPath) {
  const { yaml, error } = loadProgram(programPath);
  if (error) {
    return [{
      program: programPath, protocol: null, exit_code: 1, severity: 'block',
      message: error, detail: null,
    }];
  }
  return validateProgram(programPath, yaml);
}

function runOnAll() {
  const allFindings = [];
  // globFiles(dir, pattern) — see kit/scripts/lib/cwos-utils.js
  const dirs = [
    '.claude/workstream/programs',
    'kit/templates/workstream/programs',
  ];
  let count = 0;
  for (const dir of dirs) {
    const files = globFiles(dir, 'prog-*.yaml');
    for (const f of files) {
      // Skip prog-template.yaml — it has no last_run_by_protocol by design
      if (path.basename(f) === 'prog-template.yaml') continue;
      count++;
      const findings = runOnFile(f);
      allFindings.push(...findings);
    }
  }
  return { findings: allFindings, count };
}

function runOnStaged(stagedFiles) {
  const allFindings = [];
  let count = 0;
  for (const f of stagedFiles) {
    if (!f) continue;
    if (path.basename(f) === 'prog-template.yaml') continue;
    if (!/(?:^|[\\/])prog-[^\\/]+\.yaml$/.test(f)) continue;
    if (!fs.existsSync(f)) continue;
    count++;
    const findings = runOnFile(f);
    allFindings.push(...findings);
  }
  return { findings: allFindings, count };
}

// ─── Output ─────────────────────────────────────────────────────────────────

function emitFindings(findings, programsChecked) {
  const exitCode = findings.length === 0
    ? 0
    : Math.min(...findings.map((f) => f.exit_code));

  const output = {
    ok: findings.length === 0,
    exit_code: exitCode,
    programs_checked: programsChecked,
    findings,
  };

  process.stdout.write(JSON.stringify(output, null, 2) + '\n');

  if (findings.length > 0) {
    process.stderr.write('\n');
    for (const f of findings) {
      process.stderr.write(`BLOCK [exit ${f.exit_code}] ${f.program}` +
        (f.protocol ? ` (${f.protocol})` : '') + '\n');
      process.stderr.write(`  ${f.message}\n`);
    }
    process.stderr.write(
      '\nProvenance gate enforces INV-F2 (no rigor compression). ' +
      'See kit/templates/workstream/evidence/PROVENANCE.md\n'
    );
  }

  return exitCode;
}

// ─── Main ───────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    process.stderr.write('Usage: cwos-provenance-validate.js --all | --program <path> | --staged | --stdin\n');
    process.exit(1);
  }

  const flag = args[0];

  if (flag === '--all') {
    const { findings, count } = runOnAll();
    process.exit(emitFindings(findings, count));
  }

  if (flag === '--program') {
    const programPath = args[1];
    if (!programPath) {
      process.stderr.write('--program requires a path argument\n');
      process.exit(1);
    }
    const findings = runOnFile(programPath);
    process.exit(emitFindings(findings, 1));
  }

  if (flag === '--staged') {
    // Read newline-separated paths from stdin
    let stdin = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { stdin += chunk; });
    process.stdin.on('end', () => {
      const files = stdin.split('\n').map((s) => s.trim()).filter(Boolean);
      const { findings, count } = runOnStaged(files);
      process.exit(emitFindings(findings, count));
    });
    return;
  }

  if (flag === '--stdin') {
    let stdin = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { stdin += chunk; });
    process.stdin.on('end', () => {
      try {
        const yaml = parseYAML(stdin);
        const findings = validateProgram('<stdin>', yaml);
        process.exit(emitFindings(findings, 1));
      } catch (err) {
        process.stderr.write(`Parse failed: ${err.message}\n`);
        process.exit(1);
      }
    });
    return;
  }

  process.stderr.write(`Unknown flag: ${flag}\n`);
  process.exit(1);
}

main();
