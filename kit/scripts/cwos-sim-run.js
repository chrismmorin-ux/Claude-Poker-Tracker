#!/usr/bin/env node
/**
 * cwos-sim-run.js — Deterministic simulation scenario runner.
 *
 * Two modes:
 *   --scaffold  Set up sandbox from scenario definition (fixtures, templates, git)
 *   --validate  Check assertions against sandbox state + captured command output
 *
 * Does NOT execute CWOS commands (those are LLM operations).
 * The LLM runs commands between scaffold and validate.
 *
 * Usage:
 *   node cwos-sim-run.js --scaffold --scenario <id> [--homebase <path>]
 *   node cwos-sim-run.js --validate --scenario <id> [--output-file <path>] [--homebase <path>]
 *   node cwos-sim-run.js --validate --tag <tag> [--homebase <path>]
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const {
  readYAMLFile, writeFileAtomic, parseYAML, serializeYAML,
  formatScalar, globFiles,
} = require('./lib/cwos-utils');

const { emitBundle, bundleError } = require('./lib/cwos-orchestrate');

// Phase-grouped emits for 7 mutation sites across sandbox-build /
// scenario-apply / result-write phases (per SPR-058 granularity decision).
const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

// ─── Helpers ───────────────────────────────────────────────────────────────

function toForwardSlash(p) { return p.replace(/\\/g, '/'); }

function rmrf(dir) {
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
}

function mkdirp(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirRecursive(src, dest) {
  mkdirp(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function deepMerge(target, overrides) {
  if (!overrides || typeof overrides !== 'object') return target;
  for (const [key, val] of Object.entries(overrides)) {
    if (val && typeof val === 'object' && !Array.isArray(val) &&
        target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
      deepMerge(target[key], val);
    } else {
      target[key] = val;
    }
  }
  return target;
}

function getByDotPath(obj, dotPath) {
  if (!dotPath || !obj) return undefined;
  return dotPath.split('.').reduce((o, k) => {
    if (o === null || o === undefined) return undefined;
    // Support numeric indices for arrays
    const idx = parseInt(k);
    if (!isNaN(idx) && Array.isArray(o)) return o[idx];
    return o[k];
  }, obj);
}

// ─── Template Variable Resolution ──────────────────────────────────────────

function resolveTemplateVars(text, context) {
  if (typeof text !== 'string') return text;

  const now = new Date();
  const dateOnly = now.toISOString().split('T')[0];

  return text.replace(/\{\{(\w+(?:_\w+)*)\}\}/g, (match, varName) => {
    // Exact matches
    if (varName === 'now') return now.toISOString();
    if (varName === 'date_only') return dateOnly;
    if (varName === 'sandbox') return toForwardSlash(context.sandboxPath);
    if (varName === 'phase') return context.phase || 'foundation';

    // now_minus_Xh
    const hourMatch = varName.match(/^now_minus_(\d+)h$/);
    if (hourMatch) {
      const d = new Date(now.getTime() - parseInt(hourMatch[1]) * 3600000);
      return d.toISOString();
    }

    // now_minus_Xd
    const nowDayMatch = varName.match(/^now_minus_(\d+)d$/);
    if (nowDayMatch) {
      const d = new Date(now.getTime() - parseInt(nowDayMatch[1]) * 86400000);
      return d.toISOString();
    }

    // date_minus_Xd
    const dateMinus = varName.match(/^date_minus_(\d+)d$/);
    if (dateMinus) {
      const d = new Date(now.getTime() - parseInt(dateMinus[1]) * 86400000);
      return d.toISOString().split('T')[0];
    }

    // date_plus_Xd
    const datePlus = varName.match(/^date_plus_(\d+)d$/);
    if (datePlus) {
      const d = new Date(now.getTime() + parseInt(datePlus[1]) * 86400000);
      return d.toISOString().split('T')[0];
    }

    return match; // Leave unresolved vars as-is
  });
}

function resolveDeep(obj, context) {
  if (typeof obj === 'string') return resolveTemplateVars(obj, context);
  if (Array.isArray(obj)) return obj.map(v => resolveDeep(v, context));
  if (obj && typeof obj === 'object') {
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = resolveDeep(v, context);
    }
    return result;
  }
  return obj;
}

// ─── CLI Parsing ───────────────────────────────────────────────────────────

function parseCLI() {
  const args = process.argv.slice(2);
  const config = {
    mode: null, scenario: null, tag: null,
    homebase: null, outputFile: null,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--scaffold')                        config.mode = 'scaffold';
    else if (arg === '--validate')                   config.mode = 'validate';
    else if (arg === '--run')                        config.mode = 'run';
    else if (arg === '--scenario' && args[i + 1])    config.scenario = args[++i];
    else if (arg === '--tag' && args[i + 1])         config.tag = args[++i];
    else if (arg === '--homebase' && args[i + 1])    config.homebase = path.resolve(args[++i]);
    else if (arg === '--output-file' && args[i + 1]) config.outputFile = path.resolve(args[++i]);
  }

  if (!config.mode) bundleError('Mode required: --scaffold, --validate, or --run');
  if (!config.scenario && !config.tag) bundleError('--scenario <id> or --tag <tag> required');

  // Resolve homebase
  if (!config.homebase) {
    let dir = process.cwd();
    for (let d = 0; d < 10; d++) {
      if (fs.existsSync(path.join(dir, 'sim', 'scenarios'))) { config.homebase = dir; break; }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
    if (!config.homebase) bundleError('Could not find HomeBase (no sim/scenarios/). Use --homebase.');
  }

  config.sandboxPath = path.join(config.homebase, 'sim', '.sandbox');
  config.scenariosDir = path.join(config.homebase, 'sim', 'scenarios');
  config.fixturesDir = path.join(config.homebase, 'sim', 'fixtures');
  config.resultsDir = path.join(config.homebase, 'sim', 'results');
  config.reposDir = path.join(config.homebase, 'sim', 'repos');

  return config;
}

// ─── Scenario Loading ──────────────────────────────────────────────────────

function loadScenario(config, scenarioId) {
  const scenarioPath = path.join(config.scenariosDir, scenarioId + '.yaml');
  if (!fs.existsSync(scenarioPath)) {
    bundleError(`Scenario not found: ${scenarioId} (looked at ${toForwardSlash(scenarioPath)})`);
  }
  const { ok, data, error } = readYAMLFile(scenarioPath);
  if (!ok) bundleError(`Cannot parse scenario ${scenarioId}: ${error}`);
  return data;
}

function loadScenariosByTag(config, tag) {
  const files = globFiles(config.scenariosDir, '*.yaml');
  const scenarios = [];
  for (const filePath of files) {
    const { ok, data } = readYAMLFile(filePath);
    if (!ok) continue;
    const tags = Array.isArray(data.tags) ? data.tags : [];
    if (tags.includes(tag)) scenarios.push(data);
  }
  if (scenarios.length === 0) bundleError(`No scenarios found with tag: ${tag}`);
  return scenarios;
}

// ─── Scaffold Phase ────────────────────────────────────────────────────────

function scaffold(config, scenario, errors) {
  const sandbox = config.sandboxPath;
  const templateContext = {
    sandboxPath: sandbox,
    phase: scenario.state?.phase || 'foundation',
  };

  // 1. Clean sandbox
  rmrf(sandbox);
  mkdirp(sandbox);

  // 2. Copy source repo if specified
  if (scenario.source_repo) {
    const repoSrc = path.join(config.reposDir, scenario.source_repo);
    if (fs.existsSync(repoSrc)) {
      // Copy everything except MANIFEST.yaml
      for (const entry of fs.readdirSync(repoSrc, { withFileTypes: true })) {
        if (entry.name === 'MANIFEST.yaml') continue;
        const srcPath = path.join(repoSrc, entry.name);
        const destPath = path.join(sandbox, entry.name);
        if (entry.isDirectory()) {
          copyDirRecursive(srcPath, destPath);
        } else {
          fs.copyFileSync(srcPath, destPath);
        }
      }
    } else {
      errors.push(`source_repo not found: ${scenario.source_repo}`);
    }
  }

  // 3. Create standard directory structure
  const dirs = [
    'system',
    '.claude/workstream/queue',
    '.claude/workstream/findings/archive',
    '.claude/workstream/runs',
    '.claude/workstream/sessions',
    '.claude/workstream/.active-sessions',
    '.claude/workstream/programs',
    '.claude/workstream/evidence',
    '.claude/workstream/engines',
  ];
  for (const dir of dirs) {
    mkdirp(path.join(sandbox, dir));
  }

  // 4. Populate files from scenario state
  const stateFiles = scenario.state?.files || {};
  let filesPopulated = 0;

  for (const [relPath, spec] of Object.entries(stateFiles)) {
    const destPath = path.join(sandbox, relPath);
    mkdirp(path.dirname(destPath));

    try {
      let content;

      if (spec.fixture) {
        // Load fixture and apply overrides
        const fixturePath = path.join(config.fixturesDir, spec.fixture);
        if (!fs.existsSync(fixturePath)) {
          errors.push(`Fixture not found: ${spec.fixture}`);
          continue;
        }

        const fixtureText = fs.readFileSync(fixturePath, 'utf8');
        const isMd = spec.fixture.endsWith('.md');

        if (isMd) {
          // Template substitution for markdown
          content = fixtureText;
          if (spec.overrides) {
            for (const [key, val] of Object.entries(spec.overrides)) {
              content = content.split(`{{${key}}}`).join(String(val));
            }
          }
        } else {
          // Deep merge for YAML
          const fixtureData = parseYAML(fixtureText);
          if (spec.overrides) deepMerge(fixtureData, spec.overrides);
          content = serializeYAML(fixtureData) + '\n';
        }
      } else if (spec.content !== undefined) {
        content = typeof spec.content === 'string' ? spec.content : serializeYAML(spec.content) + '\n';
      } else {
        errors.push(`File spec for ${relPath} has no fixture or content`);
        continue;
      }

      // Resolve template variables
      content = resolveTemplateVars(content, templateContext);
      fs.writeFileSync(destPath, content, 'utf8');
      filesPopulated++;
    } catch (err) {
      errors.push(`Failed to populate ${relPath}: ${err.message}`);
    }
  }

  // 5. Write scaffold marker
  const level = scenario.state?.adoption_level || 'L3';
  const milestone = scenario.state?.milestone || 'M3';
  const phase = scenario.state?.phase || 'foundation';

  fs.writeFileSync(path.join(sandbox, '.cwos-version'),
    `version: "3.0"\nlevel: ${level}\n`, 'utf8');

  fs.writeFileSync(path.join(sandbox, 'CLAUDE.md'),
    `# Sim Sandbox\nSimulated CWOS repo at ${level}, ${milestone}, ${phase}.\n`, 'utf8');

  emitEvent('T0:envelope', 'sim-sandbox-built', {
    phase: 'sandbox-build',
    path: path.relative(process.cwd(), sandbox).replace(/\\/g, '/'),
    scenario_id: scenario.id,
  });

  // 6. Initialize git
  try {
    spawnSync('git', ['init'], { cwd: sandbox, stdio: 'pipe' });
    spawnSync('git', ['add', '-A'], { cwd: sandbox, stdio: 'pipe' });
    spawnSync('git', ['-c', 'user.name=sim', '-c', 'user.email=sim@cwos',
      'commit', '-m', `sim scaffold: ${scenario.id}`],
      { cwd: sandbox, stdio: 'pipe' });
  } catch (err) {
    errors.push(`Git init failed: ${err.message}`);
  }

  return { files_populated: filesPopulated, sandbox: toForwardSlash(sandbox) };
}

// ─── Validation Phase ──────────────────────────────────────────────────────

function validate(config, scenario, outputText, errors) {
  const assertions = scenario.assertions || [];
  const results = [];
  const sandbox = config.sandboxPath;

  for (const assertion of assertions) {
    const result = runAssertion(assertion, sandbox, outputText, config, errors);
    results.push(result);
  }

  return results;
}

function runAssertion(assertion, sandbox, outputText, config, errors) {
  const desc = assertion.description || assertion.type;
  const base = { assertion: desc, type: assertion.type };

  try {
    switch (assertion.type) {
      case 'file_exists':
        return { ...base, status: fs.existsSync(path.join(sandbox, assertion.path)) ? 'PASS' : 'FAIL',
          ...(fs.existsSync(path.join(sandbox, assertion.path)) ? {} : { expected: 'file exists', actual: 'not found' }) };

      case 'file_not_exists':
        return { ...base, status: !fs.existsSync(path.join(sandbox, assertion.path)) ? 'PASS' : 'FAIL',
          ...(fs.existsSync(path.join(sandbox, assertion.path)) ? { expected: 'file not exists', actual: 'file found' } : {}) };

      case 'file_yaml_field_equals':
        return checkYAMLField(base, sandbox, assertion, (actual, expected) => actual === expected || String(actual) === String(expected));

      case 'file_yaml_field_gte':
        return checkYAMLField(base, sandbox, assertion, (actual, expected) => Number(actual) >= Number(expected));

      case 'file_yaml_field_lte':
        return checkYAMLField(base, sandbox, assertion, (actual, expected) => Number(actual) <= Number(expected));

      case 'file_yaml_array_length': {
        const filePath = path.join(sandbox, assertion.path);
        if (!fs.existsSync(filePath)) return { ...base, status: 'FAIL', expected: assertion.expected, actual: 'file not found' };
        const { ok, data } = readYAMLFile(filePath);
        if (!ok) return { ...base, status: 'FAIL', expected: assertion.expected, actual: 'YAML parse error' };
        const arr = getByDotPath(data, assertion.field);
        const len = Array.isArray(arr) ? arr.length : 0;
        return { ...base, status: len === assertion.expected ? 'PASS' : 'FAIL',
          ...(len !== assertion.expected ? { expected: assertion.expected, actual: len } : {}) };
      }

      case 'file_yaml_contains_entry': {
        const filePath = path.join(sandbox, assertion.path);
        if (!fs.existsSync(filePath)) return { ...base, status: 'FAIL', expected: assertion.match, actual: 'file not found' };
        const { ok, data } = readYAMLFile(filePath);
        if (!ok) return { ...base, status: 'FAIL', expected: assertion.match, actual: 'YAML parse error' };
        const arr = getByDotPath(data, assertion.field);
        if (!Array.isArray(arr)) return { ...base, status: 'FAIL', expected: assertion.match, actual: 'not an array' };
        const found = arr.some(item =>
          Object.entries(assertion.match).every(([k, v]) => String(item[k]) === String(v))
        );
        return { ...base, status: found ? 'PASS' : 'FAIL',
          ...(found ? {} : { expected: assertion.match, actual: 'no matching entry found' }) };
      }

      case 'file_md_contains': {
        const filePath = path.join(sandbox, assertion.path);
        if (!fs.existsSync(filePath)) return { ...base, status: 'FAIL', expected: assertion.value, actual: 'file not found' };
        const content = fs.readFileSync(filePath, 'utf8');
        const found = content.includes(assertion.value);
        return { ...base, status: found ? 'PASS' : 'FAIL',
          ...(found ? {} : { expected: `contains "${assertion.value}"`, actual: 'not found in file' }) };
      }

      case 'output_contains': {
        const found = outputText.toLowerCase().includes(assertion.value.toLowerCase());
        return { ...base, status: found ? 'PASS' : 'FAIL',
          ...(found ? {} : { expected: `output contains "${assertion.value}"`, actual: 'not found' }) };
      }

      case 'output_not_contains': {
        const found = outputText.toLowerCase().includes(assertion.value.toLowerCase());
        return { ...base, status: !found ? 'PASS' : 'FAIL',
          ...(found ? { expected: `output does not contain "${assertion.value}"`, actual: 'found in output' } : {}) };
      }

      case 'no_error': {
        const errorPatterns = [/\bError:/i, /\bFATAL\b/, /\bTraceback\b/, /\bException\b/];
        const hasError = errorPatterns.some(p => p.test(outputText));
        return { ...base, status: !hasError ? 'PASS' : 'FAIL',
          ...(hasError ? { expected: 'no error patterns', actual: 'error pattern found in output' } : {}) };
      }

      case 'manifest_coverage': {
        return checkManifestCoverage(base, config, sandbox, assertion);
      }

      case 'manifest_false_positive_check': {
        return checkManifestFalsePositives(base, config, sandbox, assertion);
      }

      case 'review_prompt':
        return { ...base, status: 'REVIEW', review_prompt: assertion.value };

      default:
        return { ...base, status: 'FAIL', expected: 'known assertion type', actual: `unknown: ${assertion.type}` };
    }
  } catch (err) {
    return { ...base, status: 'FAIL', expected: 'no error', actual: err.message };
  }
}

function checkYAMLField(base, sandbox, assertion, comparator) {
  const filePath = path.join(sandbox, assertion.path);
  if (!fs.existsSync(filePath)) return { ...base, status: 'FAIL', expected: assertion.expected, actual: 'file not found' };
  const { ok, data } = readYAMLFile(filePath);
  if (!ok) return { ...base, status: 'FAIL', expected: assertion.expected, actual: 'YAML parse error' };
  const actual = getByDotPath(data, assertion.field);
  const pass = comparator(actual, assertion.expected);
  return { ...base, status: pass ? 'PASS' : 'FAIL',
    ...(pass ? {} : { expected: assertion.expected, actual }) };
}

function checkManifestCoverage(base, config, sandbox, assertion) {
  const manifestPath = path.join(config.homebase, assertion.manifest);
  if (!fs.existsSync(manifestPath)) return { ...base, status: 'FAIL', actual: 'manifest not found' };
  const { ok, data } = readYAMLFile(manifestPath);
  if (!ok) return { ...base, status: 'FAIL', actual: 'manifest parse error' };

  const planted = data.planted_issues || [];
  if (planted.length === 0) return { ...base, status: 'PASS' };

  // Read findings from sandbox
  const findingsDir = path.join(sandbox, '.claude', 'workstream', 'findings');
  const findingFiles = fs.existsSync(findingsDir) ? globFiles(findingsDir, 'FIND-*.yaml') : [];
  const findings = [];
  for (const f of findingFiles) {
    const { ok: fOk, data: fData } = readYAMLFile(f);
    if (fOk) findings.push(fData);
  }

  let detected = 0;
  for (const issue of planted) {
    const keywords = issue.detection_keywords || [];
    const matched = findings.some(f => {
      const desc = String(f.description || f.title || '').toLowerCase();
      return keywords.some(kw => desc.includes(kw.toLowerCase()));
    });
    if (matched) detected++;
  }

  const coverage = planted.length > 0 ? detected / planted.length : 1;
  const pass = coverage >= (assertion.minimum_coverage || 0);
  return { ...base, status: pass ? 'PASS' : 'FAIL',
    detected, total_planted: planted.length, coverage: Math.round(coverage * 100) / 100,
    ...(pass ? {} : { expected: `>=${assertion.minimum_coverage}`, actual: coverage }) };
}

function checkManifestFalsePositives(base, config, sandbox, assertion) {
  const manifestPath = path.join(config.homebase, assertion.manifest);
  if (!fs.existsSync(manifestPath)) return { ...base, status: 'FAIL', actual: 'manifest not found' };
  const { ok, data } = readYAMLFile(manifestPath);
  if (!ok) return { ...base, status: 'FAIL', actual: 'manifest parse error' };

  const planted = data.planted_issues || [];
  const allKeywords = planted.flatMap(i => (i.detection_keywords || []).map(k => k.toLowerCase()));

  const findingsDir = path.join(sandbox, '.claude', 'workstream', 'findings');
  const findingFiles = fs.existsSync(findingsDir) ? globFiles(findingsDir, 'FIND-*.yaml') : [];

  let extraFindings = 0;
  for (const f of findingFiles) {
    const { ok: fOk, data: fData } = readYAMLFile(f);
    if (!fOk) continue;
    const desc = String(fData.description || fData.title || '').toLowerCase();
    const matchesAny = allKeywords.some(kw => desc.includes(kw));
    if (!matchesAny) extraFindings++;
  }

  const pass = extraFindings <= (assertion.max_extra_findings || 5);
  return { ...base, status: pass ? 'PASS' : 'FAIL',
    extra_findings: extraFindings,
    ...(pass ? {} : { expected: `<=${assertion.max_extra_findings}`, actual: extraFindings }) };
}

// ─── Results Writing ───────────────────────────────────────────────────────

function writeResults(config, scenario, results) {
  mkdirp(config.resultsDir);

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '').substring(0, 15);
  const filename = `sim-run-${ts}-${scenario.id}.yaml`;

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const reviews = results.filter(r => r.status === 'REVIEW').length;

  let overall = 'PASS';
  if (failed > 0) overall = 'FAIL';
  else if (reviews > 0) overall = 'PASS*';

  const resultData = {
    scenario: scenario.id,
    timestamp: now.toISOString(),
    overall,
    sandbox_path: toForwardSlash(config.sandboxPath),
    commands_executed: (scenario.commands || []).map(c => c.command || c),
    results,
    manual_review: results.filter(r => r.status === 'REVIEW').map(r => r.review_prompt),
    summary: { total: results.length, passed, failed, manual_review: reviews },
  };

  const content = serializeYAML(resultData) + '\n';
  const outPath = path.join(config.resultsDir, filename);
  writeFileAtomic(outPath, content);

  emitEvent('T0:envelope', 'sim-result-written', {
    phase: 'result-write',
    path: path.relative(process.cwd(), outPath).replace(/\\/g, '/'),
    scenario: scenario.id,
    overall,
  });

  return { filename, overall, summary: resultData.summary };
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const startMs = Date.now();
  const config = parseCLI();
  const errors = [];

  // Load scenario(s)
  let scenarios;
  if (config.tag) {
    scenarios = loadScenariosByTag(config, config.tag);
  } else {
    scenarios = [loadScenario(config, config.scenario)];
  }

  const batchResults = [];

  for (const scenario of scenarios) {
    const scenarioResult = { id: scenario.id, name: scenario.name };

    // Scaffold phase
    if (config.mode === 'scaffold' || config.mode === 'run') {
      const scaffoldResult = scaffold(config, scenario, errors);
      scenarioResult.scaffold = scaffoldResult;
    }

    // Validate phase
    if (config.mode === 'validate' || config.mode === 'run') {
      // Load captured output if available
      let outputText = '';
      if (config.outputFile && fs.existsSync(config.outputFile)) {
        outputText = fs.readFileSync(config.outputFile, 'utf8');
      }

      const results = validate(config, scenario, outputText, errors);
      const written = writeResults(config, scenario, results);
      scenarioResult.validation = written;
    }

    batchResults.push(scenarioResult);
  }

  // Compute batch summary
  const batchSummary = {
    scenarios_run: batchResults.length,
    scenarios_passed: batchResults.filter(r => r.validation?.overall === 'PASS' || r.validation?.overall === 'PASS*').length,
    scenarios_failed: batchResults.filter(r => r.validation?.overall === 'FAIL').length,
  };

  if (config.mode === 'validate' || config.mode === 'run') {
    batchSummary.total_assertions = batchResults.reduce((s, r) => s + (r.validation?.summary?.total || 0), 0);
    batchSummary.assertions_passed = batchResults.reduce((s, r) => s + (r.validation?.summary?.passed || 0), 0);
    batchSummary.assertions_failed = batchResults.reduce((s, r) => s + (r.validation?.summary?.failed || 0), 0);
  }

  emitBundle({
    command: 'sim-run',
    script: 'cwos-sim-run.js',
    startMs,
    errors,
    data: {
      mode: config.mode,
      scenarios: batchResults,
      batch_summary: batchSummary,
    },
  });

  // Exit code: non-zero if any scenario failed
  if (batchSummary.scenarios_failed > 0) process.exit(1);
}

main();
