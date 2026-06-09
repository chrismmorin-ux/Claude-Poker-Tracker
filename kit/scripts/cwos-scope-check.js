#!/usr/bin/env node
// cwos-scope-check — Verify program scope.file_patterns match real repo files.
//
// Usage:
//   node kit/scripts/cwos-scope-check.js               # emit JSON (default)
//   node kit/scripts/cwos-scope-check.js --pretty      # human-readable table
//   node kit/scripts/cwos-scope-check.js --program <id> # one program only
//   node kit/scripts/cwos-scope-check.js --fix         # rewrite patterns using
//                                                        archetype defaults
//
// Exit code: 0 always (this is informational/corrective, not a gate).
// Called from /onboard-check at M3 (silent drift capture) and /pulse (surfacing
// + --fix on founder consent). Per WS-126 / DEC-026: never shows file patterns
// or YAML to the founder — the /pulse command formats results into a plain
// yes/no question.

'use strict';

const fs = require('fs');
const path = require('path');

const { readYAMLFile, writeFileAtomic, formatScalar, findRepoRoot, makeEventEmitter, boundedSystemDir, SafeWriteError } = require('./lib/cwos-utils.js');
const { ARCHETYPE_PATTERNS, PROGRAM_PATTERN_OVERRIDES } = require('./lib/archetype-patterns.js');

const emitEvent = makeEventEmitter();

// ─── Helpers ──────────────────────────────────────────────────────────────

function resolveSystemDir(root) {
  const configPath = path.join(root, '.cwos-config.yaml');
  if (fs.existsSync(configPath)) {
    const { ok, data } = readYAMLFile(configPath);
    if (ok && data.paths && data.paths.system_dir) {
      try {
        return boundedSystemDir(data.paths.system_dir);
      } catch (err) {
        if (err instanceof SafeWriteError && err.code === 'SYSTEM_DIR_INVALID') {
          process.stderr.write(`scope-check: ignoring invalid paths.system_dir — ${err.message}\n`);
          return 'system';
        }
        throw err;
      }
    }
  }
  return 'system';
}

function resolveArchetype(root) {
  const onboardingPath = path.join(root, '.cwos-onboarding.yaml');
  if (!fs.existsSync(onboardingPath)) return null;
  const { ok, data } = readYAMLFile(onboardingPath);
  if (!ok) return null;
  return data.archetype || (data.profile && data.profile.archetype) || null;
}

function expandPattern(pattern, systemDir) {
  return pattern.replace(/\{system_dir\}/g, systemDir);
}

// Count files matching a single glob pattern, using Node 22+ fs.globSync.
// Returns the number of matches (we don't need the actual paths).
function countMatches(rootDir, pattern) {
  try {
    const matches = fs.globSync(pattern, { cwd: rootDir });
    return matches.length;
  } catch {
    return 0;
  }
}

function computeExpectedPatterns(programId, archetype) {
  const override = PROGRAM_PATTERN_OVERRIDES[programId];
  if (override && override.skip_archetypes && override.skip_archetypes.includes(archetype)) {
    return { patterns: [], skip: true };
  }
  if (override && override.base) {
    return { patterns: override.base, skip: false };
  }
  if (archetype && ARCHETYPE_PATTERNS[archetype]) {
    return { patterns: ARCHETYPE_PATTERNS[archetype], skip: false };
  }
  return { patterns: [], skip: false };
}

// ─── Scan ─────────────────────────────────────────────────────────────────

function scanPrograms(opts) {
  const root = opts.root;
  const systemDir = resolveSystemDir(root);
  const programsDir = path.join(root, '.claude', 'workstream', 'programs');

  if (!fs.existsSync(programsDir)) {
    return { programs: [], error: 'no programs directory' };
  }

  const programFiles = fs.readdirSync(programsDir)
    .filter(f => f.startsWith('prog-') && f.endsWith('.yaml') && f !== 'prog-template.yaml');

  const results = [];
  for (const file of programFiles) {
    const programId = file.replace(/^prog-/, '').replace(/\.yaml$/, '');

    if (opts.program && opts.program !== programId) continue;

    const fullPath = path.join(programsDir, file);
    const { ok, data } = readYAMLFile(fullPath);
    if (!ok) {
      results.push({ program_id: programId, file_patterns: [], match_count: 0, needs_review: false, parse_error: true });
      continue;
    }

    const patterns = (data.scope && Array.isArray(data.scope.file_patterns))
      ? data.scope.file_patterns
      : [];

    let total = 0;
    for (const p of patterns) {
      total += countMatches(root, expandPattern(p, systemDir));
    }

    results.push({
      program_id: programId,
      file_patterns: patterns,
      match_count: total,
      needs_review: patterns.length > 0 && total === 0,
    });
  }

  return { programs: results };
}

// ─── Fix ──────────────────────────────────────────────────────────────────

function fixPrograms(opts, scanResult) {
  const root = opts.root;
  const archetype = resolveArchetype(root);
  const programsDir = path.join(root, '.claude', 'workstream', 'programs');
  const fixLog = [];

  for (const p of scanResult.programs) {
    if (!p.needs_review) continue;

    const expected = computeExpectedPatterns(p.program_id, archetype);

    if (expected.skip) {
      fixLog.push({ program_id: p.program_id, action: 'skip', reason: `archetype ${archetype} excluded` });
      continue;
    }

    if (expected.patterns.length === 0) {
      fixLog.push({ program_id: p.program_id, action: 'fallback', reason: archetype ? 'no archetype patterns' : 'unknown archetype' });
      continue;
    }

    const fullPath = path.join(programsDir, `prog-${p.program_id}.yaml`);
    let content = fs.readFileSync(fullPath, 'utf8');

    // `\r?\n` + EOL preservation: a bare `\n` regex silently fails on CRLF
    // program files (every Windows-authored template), so --fix would log a
    // false "no block found" skip and never narrow scope (WS-471 / FIND-059).
    const eol = content.includes('\r\n') ? '\r\n' : '\n';
    const patternsYAML = expected.patterns.map(pat => `    - ${formatScalar(pat)}`).join(eol);
    const blockRegex = /( {2}file_patterns:\r?\n)(?: {4}- [^\n]*\r?\n)*(?:(?: {4}# \/adopt adjusts[^\n]*\r?\n?))?/;

    if (!blockRegex.test(content)) {
      fixLog.push({ program_id: p.program_id, action: 'skip', reason: 'no file_patterns block found' });
      continue;
    }

    content = content.replace(blockRegex, `$1${patternsYAML}${eol}`);
    writeFileAtomic(fullPath, content);
    emitEvent('T12:program-management', 'scope-patched', {
      program_id: p.program_id,
      path: path.relative(process.cwd(), fullPath).replace(/\\/g, '/'),
      patterns_count: expected.patterns.length,
    });
    fixLog.push({ program_id: p.program_id, action: 'patched', patterns: expected.patterns });
  }

  return { archetype, fix_log: fixLog };
}

// ─── CLI ──────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { pretty: false, program: null, fix: false, root: findRepoRoot(process.cwd(), { markers: ['.claude/workstream'] }) };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--pretty') opts.pretty = true;
    else if (a === '--fix') opts.fix = true;
    else if (a === '--program' && argv[i + 1]) { opts.program = argv[++i]; }
  }
  return opts;
}

function renderPretty(scan, fix) {
  const lines = [];
  lines.push(`Scope check — ${scan.programs.length} programs\n`);
  for (const p of scan.programs) {
    const status = p.needs_review ? 'NEEDS REVIEW' : 'ok';
    lines.push(`  ${p.program_id.padEnd(24)} ${String(p.match_count).padStart(5)} matches  [${status}]`);
  }
  if (fix) {
    lines.push(`\nFix run — archetype: ${fix.archetype || '(unknown)'}`);
    for (const entry of fix.fix_log) {
      lines.push(`  ${entry.program_id.padEnd(24)} ${entry.action}${entry.reason ? ' — ' + entry.reason : ''}`);
    }
  }
  return lines.join('\n');
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const scan = scanPrograms(opts);

  let fix = null;
  if (opts.fix) {
    fix = fixPrograms(opts, scan);
  }

  if (opts.pretty) {
    console.log(renderPretty(scan, fix));
  } else {
    const output = fix ? { ...scan, fix } : scan;
    console.log(JSON.stringify(output, null, 2));
  }
  process.exit(0);
}

if (require.main === module) main();

module.exports = { scanPrograms, fixPrograms, computeExpectedPatterns };
