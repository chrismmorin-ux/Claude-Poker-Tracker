#!/usr/bin/env node
/**
 * cwos-pathroot-lint.js — detector for INV-066 (WS-549 / ADR-064 P3):
 * "no script resolves a root directory by counting parent directories up from
 * __dirname."
 *
 * The rule is narrow on purpose. `__dirname` is not the problem — resolving a
 * SIBLING is correct and common:
 *
 *     path.join(__dirname, 'cwos-event.js')          // fine, stays
 *     path.join(__dirname, 'reducers')               // fine, stays
 *
 * What breaks is walking UP from __dirname to reach a root:
 *
 *     path.resolve(__dirname, '..', '..')            // flagged
 *     path.join(__dirname, '..', '..', '..', 'sim')  // flagged
 *
 * That only lands correctly because kit/MANIFEST.yaml installs scripts at a
 * known depth. Under a plugin the scripts sit in an ephemeral cache at a
 * Claude-Code-controlled depth, and the run-027 probe confirmed the expression
 * resolves to the marketplace root rather than the repo. 19 sites did this
 * before WS-549, three of them using ONE variable to reach two different roots
 * at once — which reads as correct in HomeBase forever, because in HomeBase
 * they are the same directory.
 *
 * lib/kit-paths.js is the only exemption: resolveDistRoot() deliberately
 * derives from __dirname, because a script's position INSIDE the distribution
 * is fixed even when the distribution moves. There is no suppression comment
 * and no allowlist — an advisory tier is how the original 19 accumulated.
 *
 * Usage:
 *   node kit/scripts/cwos-pathroot-lint.js            # --human (default)
 *   node kit/scripts/cwos-pathroot-lint.js --json
 *   node kit/scripts/cwos-pathroot-lint.js --root <p>
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { resolveDistRoot } = require('./lib/kit-paths');

// The one file allowed to derive a root from __dirname. Posix-normalised.
const EXEMPT = ['kit/scripts/lib/kit-paths.js'];

// __dirname followed by two or more '..' segments, in either path.resolve or
// path.join. Tolerates whitespace and newlines between arguments.
const PATTERN = /__dirname\s*,\s*(?:['"]\.\.['"]\s*,\s*){1,}['"]\.\.['"]/;

// Strip comments and string literals before matching so prose describing the
// old pattern does not trip the lint. Order matters: block comments first.
function stripNonCode(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function listJsFiles(scriptsDir) {
  const out = [];
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        // Tests legitimately reach for repo fixtures by relative depth; they do
        // not ship, and they never run inside a plugin.
        if (e.name === '__tests__' || e.name === 'node_modules') continue;
        walk(full);
      } else if (e.name.endsWith('.js')) {
        out.push(full);
      }
    }
  }
  walk(scriptsDir);
  return out;
}

function scan(root) {
  const scriptsDir = path.join(root, 'kit', 'scripts');
  const violations = [];
  let filesScanned = 0;

  for (const file of listJsFiles(scriptsDir)) {
    const rel = path.relative(root, file).replace(/\\/g, '/');
    if (EXEMPT.includes(rel)) continue;
    filesScanned++;

    let src;
    try { src = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!PATTERN.test(stripNonCode(src))) continue;

    // Re-walk line by line for reportable positions, applying the same
    // comment-stripping per line so the reported line is a real code line.
    const lines = src.split('\n');
    const codeLines = stripNonCode(src).split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (PATTERN.test(codeLines[i] || '')) {
        violations.push({ file: rel, line: i + 1, snippet: lines[i].trim() });
      }
    }
  }

  return {
    ok: violations.length === 0,
    files_scanned: filesScanned,
    violation_count: violations.length,
    violations,
  };
}

function renderHuman(result) {
  const lines = [];
  lines.push('## INV-066 — repo-root resolution by directory arithmetic');
  lines.push('');
  if (result.ok) {
    lines.push(`PASS — ${result.files_scanned} script(s) scanned, no __dirname root-walking found.`);
    lines.push('');
    return lines.join('\n');
  }
  lines.push(`FAIL — ${result.violation_count} site(s) resolve a root by counting parent directories:`);
  lines.push('');
  for (const v of result.violations) {
    lines.push(`  ${v.file}:${v.line}`);
    lines.push(`    ${v.snippet}`);
  }
  lines.push('');
  lines.push('Use lib/kit-paths.js instead — resolveRepoRoot() for the repo\'s own state,');
  lines.push('resolveDistRoot() for content the kit ships, resolveHomeBaseRoot() for the hub.');
  lines.push('If a site needs two of them, that is the defect: name both.');
  lines.push('');
  return lines.join('\n');
}

function parseArgs(argv) {
  const opts = { root: null, json: false, human: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--root' && argv[i + 1]) opts.root = argv[++i];
    else if (a === '--json') { opts.json = true; opts.human = false; }
    else if (a === '--human') opts.human = true;
    else if (a === '--help' || a === '-h') {
      process.stdout.write([
        'Usage: cwos-pathroot-lint.js [--root <path>] [--json | --human]',
        '',
        'Flags scripts under kit/scripts/ that resolve a root directory by walking',
        'up from __dirname. Sibling resolution (path.join(__dirname, "x.js")) is fine.',
        'Exit 0 clean, 1 on any violation, 2 on an unrecognised flag.',
      ].join('\n') + '\n');
      process.exit(0);
    } else {
      process.stderr.write(`cwos-pathroot-lint: unknown argument: ${a}\n`);
      process.exit(2);
    }
  }
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const root = opts.root ? path.resolve(opts.root) : resolveDistRoot();
  const result = scan(root);

  if (opts.json) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stdout.write(renderHuman(result));

  process.exit(result.ok ? 0 : 1);
}

module.exports = { scan, renderHuman, PATTERN, EXEMPT };

if (require.main === module) main();
