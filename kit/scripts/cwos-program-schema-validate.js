#!/usr/bin/env node
/**
 * cwos-program-schema-validate.js — capability_brief schema validator.
 *
 * Enforces INV-041: every product program (not monitor_only) ships a
 * capability_brief block conforming to the schema in
 * kit/templates/workstream/programs/prog-template.yaml.
 *
 * Background: prog-design has the reference brief shipped via WS-162.
 * WS-166 generalized the pattern to every program. Without enforcement,
 * future programs added without a brief would silently regress the
 * no-silent-install principle (feedback_no_silent_install_no_user_invention;
 * ADR-028).
 *
 * Required subfields:
 *   value: string, ≥40 chars
 *   problems_prevented: list of strings, 3-5 entries, each ≥10 chars
 *   cost.activation: string, ≥10 chars
 *   cost.ongoing: string, ≥10 chars
 *   first_output: list of strings, 3-4 entries, each ≥10 chars
 *   activation_command: string, must start with "/pulse run"
 *   requires_user_input: boolean
 *
 * Invocations:
 *   node cwos-program-schema-validate.js                   # sweep all
 *   node cwos-program-schema-validate.js --program <path>  # one file
 *   node cwos-program-schema-validate.js --quiet           # no human output
 *
 * Exit codes:
 *   0 = all product programs valid
 *   1 = at least one product program failed (missing or malformed brief)
 *   2 = file read / parse error
 *
 * Output: JSON to stdout ({ ok, exit_code, programs_checked, failures }).
 * Human-readable messages to stderr (suppressed with --quiet).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readYAMLFile, globFiles } = require('./lib/cwos-utils');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROGRAMS_DIR = path.join(REPO_ROOT, '.claude', 'workstream', 'programs');
const KIT_PROGRAMS_DIR = path.join(REPO_ROOT, 'kit', 'templates', 'workstream', 'programs');

function isString(v) { return typeof v === 'string' && v.length > 0; }
function isBool(v) { return typeof v === 'boolean'; }
function isList(v) { return Array.isArray(v); }

function validateBrief(brief, programId) {
  const errors = [];
  if (!brief || typeof brief !== 'object') {
    return [`capability_brief block missing or not a mapping`];
  }

  if (!isString(brief.value)) {
    errors.push(`capability_brief.value must be a non-empty string`);
  } else if (brief.value.length < 40) {
    errors.push(`capability_brief.value too short (${brief.value.length} chars; minimum 40)`);
  }

  if (!isList(brief.problems_prevented)) {
    errors.push(`capability_brief.problems_prevented must be a list`);
  } else {
    if (brief.problems_prevented.length < 3 || brief.problems_prevented.length > 5) {
      errors.push(`capability_brief.problems_prevented must have 3-5 entries (got ${brief.problems_prevented.length})`);
    }
    brief.problems_prevented.forEach((item, idx) => {
      if (!isString(item)) {
        errors.push(`capability_brief.problems_prevented[${idx}] must be a non-empty string`);
      } else if (item.length < 10) {
        errors.push(`capability_brief.problems_prevented[${idx}] too short (${item.length} chars; minimum 10)`);
      }
    });
  }

  if (!brief.cost || typeof brief.cost !== 'object') {
    errors.push(`capability_brief.cost block missing or not a mapping`);
  } else {
    if (!isString(brief.cost.activation)) {
      errors.push(`capability_brief.cost.activation must be a non-empty string`);
    } else if (brief.cost.activation.length < 10) {
      errors.push(`capability_brief.cost.activation too short (minimum 10 chars)`);
    }
    if (!isString(brief.cost.ongoing)) {
      errors.push(`capability_brief.cost.ongoing must be a non-empty string`);
    } else if (brief.cost.ongoing.length < 10) {
      errors.push(`capability_brief.cost.ongoing too short (minimum 10 chars)`);
    }
  }

  if (!isList(brief.first_output)) {
    errors.push(`capability_brief.first_output must be a list`);
  } else {
    if (brief.first_output.length < 3 || brief.first_output.length > 4) {
      errors.push(`capability_brief.first_output must have 3-4 entries (got ${brief.first_output.length})`);
    }
    brief.first_output.forEach((item, idx) => {
      if (!isString(item)) {
        errors.push(`capability_brief.first_output[${idx}] must be a non-empty string`);
      } else if (item.length < 10) {
        errors.push(`capability_brief.first_output[${idx}] too short (${item.length} chars; minimum 10)`);
      }
    });
  }

  if (!isString(brief.activation_command)) {
    errors.push(`capability_brief.activation_command must be a non-empty string`);
  } else if (!brief.activation_command.startsWith('/pulse run ')) {
    errors.push(`capability_brief.activation_command must start with "/pulse run " (got "${brief.activation_command}")`);
  }

  // cwos-utils parser may keep inline comments on the value; accept string 'true'/'false' too.
  const ru = brief.requires_user_input;
  const isStrBool = typeof ru === 'string' && /^(true|false)\b/i.test(ru.trim());
  if (!isBool(ru) && !isStrBool) {
    errors.push(`capability_brief.requires_user_input must be a boolean (true|false)`);
  }

  return errors;
}

function validateProgramFile(filePath) {
  let parsed;
  try {
    const result = readYAMLFile(filePath);
    if (!result.ok) {
      return { filePath, programId: path.basename(filePath, '.yaml'), readError: `parse warnings: ${(result.warnings || []).join('; ')}` };
    }
    parsed = result.data;
  } catch (e) {
    return { filePath, programId: path.basename(filePath, '.yaml'), readError: e.message };
  }

  const programId = parsed.id || path.basename(filePath, '.yaml').replace(/^prog-/, '');
  // cwos-utils parser keeps inline comments on the value; coerce true/false robustly.
  const monitorRaw = parsed.monitor_only;
  const isMonitorOnly = monitorRaw === true ||
    (typeof monitorRaw === 'string' && monitorRaw.trim().toLowerCase().startsWith('true'));
  const isTemplate = path.basename(filePath) === 'prog-template.yaml';

  if (isTemplate) {
    return { filePath, programId, skipped: 'template', errors: [] };
  }
  if (isMonitorOnly) {
    return { filePath, programId, skipped: 'monitor_only', errors: [] };
  }

  const errors = validateBrief(parsed.capability_brief, programId);
  return { filePath, programId, errors, hasErrors: errors.length > 0 };
}

function discoverPrograms(args) {
  if (args.program) {
    return [args.program];
  }
  const dirs = [PROGRAMS_DIR, KIT_PROGRAMS_DIR].filter(d => fs.existsSync(d));
  const files = [];
  for (const dir of dirs) {
    // globFiles returns full paths (relative to cwd), not bare filenames
    for (const f of globFiles(dir, 'prog-*.yaml')) {
      files.push(path.isAbsolute(f) ? f : path.resolve(f));
    }
  }
  return files;
}

function parseArgs(argv) {
  const args = { quiet: false, program: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--quiet') args.quiet = true;
    else if (argv[i] === '--program') args.program = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv);
  const files = discoverPrograms(args);
  const results = files.map(validateProgramFile);

  const failures = results.filter(r => r.readError || r.hasErrors);
  const checked = results.filter(r => !r.skipped);
  const skipped = results.filter(r => r.skipped);

  const summary = {
    ok: failures.length === 0,
    exit_code: failures.length === 0 ? 0 : (results.some(r => r.readError) ? 2 : 1),
    programs_checked: checked.length,
    programs_skipped: skipped.length,
    failures: failures.map(f => ({
      program: f.programId,
      file: path.relative(REPO_ROOT, f.filePath),
      errors: f.readError ? [`read/parse error: ${f.readError}`] : f.errors,
    })),
  };

  if (!args.quiet) {
    if (failures.length === 0) {
      process.stderr.write(`✓ INV-041: ${checked.length}/${checked.length} product programs have valid capability_brief (${skipped.length} skipped: monitor_only or template)\n`);
    } else {
      process.stderr.write(`✗ INV-041 violation: ${failures.length}/${results.length} programs failed schema validation\n`);
      for (const f of summary.failures) {
        process.stderr.write(`\n  ${f.program} (${f.file}):\n`);
        for (const err of f.errors) {
          process.stderr.write(`    - ${err}\n`);
        }
      }
    }
  }

  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
  process.exit(summary.exit_code);
}

if (require.main === module) {
  main();
}

module.exports = { validateBrief, validateProgramFile };
