#!/usr/bin/env node
/**
 * cwos-doc-invocation-lint — do the CLI invocations our prose prescribes
 * actually parse?
 *
 * WS-575. `cwos-git.js` documented this escape hatch in two places:
 *
 *     node <main>/kit/scripts/cwos-next.js gate --workstream-dir <main>/.claude/workstream
 *
 * `cwos-next.js` contains zero occurrences of `workstream-dir`. Under ADR-063
 * an unrecognised flag is fatal (exit 2), so following the documented recipe
 * did not silently do the wrong thing — it hard-failed. That is the better of
 * the two failure modes, and it also means the recipe had almost certainly
 * never been executed by anyone. Prose prescribing a flag that does not exist
 * is invisible until someone runs it, and ADR-063 makes it loud only at that
 * moment.
 *
 * The convention itself was real: `--workstream-dir` is accepted by
 * cwos-heartbeat, cwos-replay, cwos-engine-complete and a dozen others. It was
 * the prescription that was misapplied. A lint is the right shape precisely
 * because the flag is usually right — a human reading that line had no reason
 * to doubt it.
 *
 * ── WHAT IT CHECKS ───────────────────────────────────────────────────────────
 * For every `cwos-<name>.js ... --flag` invocation appearing in prose (markdown
 * and JS comments), assert the named script mentions that flag somewhere in its
 * source. Mentioning it is a weak test on purpose: it cannot confirm the flag
 * WORKS, but a script whose source never contains the string certainly does not
 * accept it, and that is the whole failure class. Weak and zero-false-positive
 * beats strong and noisy for a check nobody asked for.
 *
 * Exit 0 clean, 1 with findings, 2 on bad usage (ADR-063).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = __dirname;
const REPO_ROOT = path.resolve(__dirname, '..', '..');

/** Directories whose prose is scanned for invocations. */
const SCAN_ROOTS = ['kit', 'docs', 'fleet', 'sim', 'engines'];
const SCAN_FILES = ['CLAUDE.md'];
const SCAN_EXTS = new Set(['.md', '.js']);

/**
 * Placeholder flags that appear in generic templates rather than as real
 * prescriptions. `--flag` in "usage: <script> [--flag]" is documentation ABOUT
 * flags, not a claim that a specific one exists.
 */
const PLACEHOLDER_FLAGS = new Set([
  '--flag', '--flags', '--option', '--options', '--opt', '--args', '--arg',
  '--foo', '--bar', '--baz', '--xxx', '--unknown', '--bogus', '--nope',
]);

function usage() {
  process.stdout.write(
    'cwos-doc-invocation-lint — verify that CLI invocations appearing in prose actually parse\n' +
    '\n' +
    'usage: cwos-doc-invocation-lint [options]\n' +
    '\n' +
    'options:\n' +
    '  --human       human-readable report (default is JSON)\n' +
    '  --quiet       print nothing unless there are findings\n' +
    '  -h, --help    print this usage and exit without acting\n' +
    '\n' +
    'Exit 0 clean, 1 with findings, 2 on an unrecognised flag (ADR-063).\n'
  );
}

function walk(dir, out) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (['node_modules', '.git', '__tests__', 'archive', '.sandbox'].includes(e.name)) continue;
      walk(p, out);
    } else if (SCAN_EXTS.has(path.extname(e.name))) {
      out.push(p);
    }
  }
  return out;
}

/** Does `scriptName` exist under kit/scripts (at any depth)? */
const scriptIndex = (() => {
  const idx = new Map();
  const files = walk(SCRIPTS_DIR, []);
  for (const f of files) {
    const base = path.basename(f);
    if (base.startsWith('cwos-') && base.endsWith('.js') && !idx.has(base)) idx.set(base, f);
  }
  return idx;
})();

const sourceCache = new Map();
function scriptSource(file) {
  if (!sourceCache.has(file)) {
    try { sourceCache.set(file, fs.readFileSync(file, 'utf8')); } catch { sourceCache.set(file, ''); }
  }
  return sourceCache.get(file);
}

const SCRIPT_TOKEN = /\bcwos-[a-z0-9-]+\.js\b/g;

/**
 * Pull the spans of a line that are actually INVOCATIONS, not prose that
 * happens to mention a script and, separately, a flag.
 *
 * Two shapes count, and nothing else:
 *   1. `node …/cwos-x.js …`  — a command, flags run to the next shell separator
 *   2. `` `cwos-x.js --flag` `` — a backticked span, flags confined to the span
 *
 * Without this, ADR-045's sentence "scans `cwos-reconcile.js` for the deleted
 * identifiers … --grep" reads as a prescription for a `--grep` flag. Prose
 * about a script is not a claim about its interface, and a lint that cannot
 * tell the difference gets muted within a week.
 */
function invocationSpans(line) {
  const spans = [];

  // (2) backticked spans first — they are unambiguous and bounded.
  for (const m of line.matchAll(/`([^`]+)`/g)) {
    if (/\bcwos-[a-z0-9-]+\.js\b/.test(m[1])) spans.push(m[1]);
  }

  // (1) `node ...` commands. Take from the script name to the next separator.
  for (const m of line.matchAll(/\bnode\s+\S*?(cwos-[a-z0-9-]+\.js)([^\n]*)/g)) {
    spans.push(m[1] + m[2].split(/\||;|&&|&/)[0]);
  }

  return spans;
}

function collectFindings() {
  const findings = [];
  const targets = [];
  for (const r of SCAN_ROOTS) walk(path.join(REPO_ROOT, r), targets);
  for (const f of SCAN_FILES) {
    const p = path.join(REPO_ROOT, f);
    if (fs.existsSync(p)) targets.push(p);
  }

  for (const file of targets) {
    let text;
    try { text = fs.readFileSync(file, 'utf8'); } catch { continue; }
    if (!text.includes('cwos-')) continue;
    const lines = text.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const seen = new Set();

      // This lint quotes the WS-575 invocation verbatim as its worked example.
      // Flagging its own documentation would be correct and useless.
      if (path.basename(file) === 'cwos-doc-invocation-lint.js') continue;

      for (const span of invocationSpans(line)) {
        // A span can chain several commands — `node a.js & node b.js --auto`.
        // Attribute flags to the NEAREST PRECEDING script, never to the first
        // one in the span, or every chained invocation blames its neighbour.
        const names = [...span.matchAll(SCRIPT_TOKEN)];
        for (let k = 0; k < names.length; k++) {
          const nameMatch = names[k];
          const scriptName = nameMatch[0];
          const target = scriptIndex.get(scriptName);
          // A script we do not ship is out of scope — this lint is about OUR
          // prose describing OUR CLIs, not third-party examples.
          if (!target) continue;
          // A script's own usage string is the definition, not a claim about
          // someone else. Skip self-references.
          if (path.basename(file) === scriptName) continue;

          const from = nameMatch.index + scriptName.length;
          const to = k + 1 < names.length ? names[k + 1].index : span.length;
          // Also stop at a shell separator inside this script's own segment.
          const segment = span.slice(from, to).split(/\||;|&&|&/)[0];
          const flags = segment.match(/--[a-z][a-z0-9-]*/g) || [];
          const src = scriptSource(target);

          for (const flag of flags) {
            if (PLACEHOLDER_FLAGS.has(flag)) continue;
            // The bare name, so `--workstream-dir` matches `readFlag(args,
            // 'workstream-dir')` as well as a literal `'--workstream-dir'`.
            const bare = flag.slice(2);
            if (src.includes(bare)) continue;
            const key = `${scriptName}${flag}`;
            if (seen.has(key)) continue;     // one finding per line per pair
            seen.add(key);
            findings.push({
              doc: path.relative(REPO_ROOT, file).replace(/\\/g, '/'),
              line: i + 1,
              script: scriptName,
              flag,
              excerpt: line.trim().slice(0, 140),
            });
          }
        }
      }
    }
  }
  return findings;
}

function main() {
  const args = process.argv.slice(2);
  let human = false, quiet = false;
  for (const a of args) {
    if (a === '--human') human = true;
    else if (a === '--quiet') quiet = true;
    else if (a === '-h' || a === '--help') { usage(); process.exit(0); }
    else {
      process.stderr.write(`cwos-doc-invocation-lint: unknown option "${a}"\n`);
      process.exit(2);
    }
  }

  const findings = collectFindings();

  if (quiet && findings.length === 0) process.exit(0);

  if (human) {
    if (findings.length === 0) {
      process.stdout.write('doc-invocation: OK — every documented flag exists in the script it names.\n');
    } else {
      process.stdout.write(`doc-invocation: ${findings.length} prescription(s) name a flag their script does not accept.\n\n`);
      for (const f of findings) {
        process.stdout.write(`  ${f.doc}:${f.line}\n`);
        process.stdout.write(`    ${f.script} has no "${f.flag}" — under ADR-063 this invocation exits 2.\n`);
        process.stdout.write(`    ${f.excerpt}\n\n`);
      }
    }
  } else {
    process.stdout.write(JSON.stringify({ ok: findings.length === 0, count: findings.length, findings }, null, 2) + '\n');
  }

  process.exit(findings.length === 0 ? 0 : 1);
}

if (require.main === module) main();

module.exports = { collectFindings };
