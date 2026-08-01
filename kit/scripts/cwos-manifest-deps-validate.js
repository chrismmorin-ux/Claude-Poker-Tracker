#!/usr/bin/env node
/**
 * cwos-manifest-deps-validate — publish-time completeness gate for kit/MANIFEST.yaml.
 *
 * kit/MANIFEST.yaml is a hand-maintained map of every file the kit ships, and
 * nothing verified it was COMPLETE. A script could be registered while a module
 * it require()s was not, and the omission stayed invisible until an adopted repo
 * crashed at require-time.
 *
 * That is WS-544: upgrading claude-poker-tracker 3.8.0 -> 3.8.1 overwrote four
 * scripts with versions that eagerly require('./lib/cli'), a module the manifest
 * never shipped. All four died at require(). The upgrade's own validation gate
 * still reported 7/7 green — it exercises reconcile / next / pulse / audit and
 * never loads those scripts. Registering the missing files by hand fixed the
 * instances and left the class intact; this gate closes the class.
 *
 * WHAT IT CHECKS, over every .js registered in the manifest:
 *
 *   unregistered-dep  a resolved relative require() target is absent from the
 *                     manifest — it would not ship, and the consumer would die
 *                     at require() in every adopted repo.
 *   tier-inversion    the target ships at a LATER capability tier than its
 *                     consumer, so a repo enabling the consumer's tier installs
 *                     the script without the module. Capability tiers are
 *                     cumulative (see lib/capability-map.js closeDownward), so
 *                     the rule is dep.tier <= consumer.tier.
 *   absent-source     a manifest `source:` does not exist on disk. Install pushes
 *                     "Source missing:" into state.errors and CONTINUES, so this
 *                     is otherwise recorded once per adoption and never read.
 *
 * WHAT IT DELIBERATELY DOES NOT FAIL ON:
 *
 *   guarded requires  `try { x = require('./y'); } catch {}` is the established
 *                     idiom for optional deps (20+ call sites; see the factory
 *                     comment in lib/cwos-utils.js). Those tolerate absence by
 *                     design. Reported under `optional`, never as a violation.
 *   dynamic requires  require(<expression>) cannot be resolved statically.
 *                     Reported under `unanalyzable` so the blind spot is visible
 *                     rather than silently assumed safe.
 *
 * TWO THINGS THAT LOOK LIKE DETAILS AND ARE NOT:
 *
 *   1. Comments are stripped before scanning. lib/cwos-utils.js:901 is a COMMENT
 *      illustrating the guarded-import pattern; a raw regex reads it as a real
 *      require of './core/events' (which does not exist — the live requires two
 *      lines down use '../core/events'). A gate that cries wolf gets disabled.
 *   2. Directory modules resolve. core/defer-translators is a directory with an
 *      index.js; a naive existsSync(spec + '.js') reads it as missing.
 *
 * Usage:
 *   node kit/scripts/cwos-manifest-deps-validate.js            # JSON to stdout
 *   node kit/scripts/cwos-manifest-deps-validate.js --human
 *   node kit/scripts/cwos-manifest-deps-validate.js --root <p>
 *
 * Exit codes: 0 = clean | 1 = violation(s) | 2 = invalid arg / manifest unreadable.
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { cliGate } = require('./lib/cli');
const { readYAMLFile } = require('./lib/cwos-utils');
const { CAPABILITY_ORDER } = require('./lib/capability-map');

const CLI = {
  name: 'cwos-manifest-deps-validate',
  summary: 'verify kit/MANIFEST.yaml ships every module its registered scripts require',
  flags: {
    human: { type: 'boolean', describe: 'render a readable report instead of JSON' },
    root: { type: 'string', placeholder: 'path', describe: 'HomeBase root (default: walk up from this script)' },
  },
  notes: [
    'Runs at publish time from cwos-hash-manifest.js, so an unregistered dependency',
    'cannot reach a kit release, and as INV-064 in cwos-verify.js.',
    '',
    'Guarded requires (try/catch) and dynamic require(<expr>) are reported but never',
    'fail the gate — the first are optional by design, the second are unanalyzable.',
  ].join('\n'),
};

// ─── source scanning ────────────────────────────────────────────────────────

/**
 * Blank out comment content so commented-out or illustrative require() calls are
 * not mistaken for real ones, returning an array of lines with line numbers
 * intact.
 *
 * This is a character scanner rather than a regex pass, and both properties are
 * load-bearing. A `text.replace(/\/\*[\s\S]*?\*\//g, '')` implementation fails
 * twice on real kit sources:
 *
 *   - it deletes the newlines inside block comments, so every line number after
 *     the first block comment is wrong (core/state-store.js: 552 lines -> 457);
 *   - it is blind to `/*` inside a string literal. state-store.js has 11 `/*`
 *     and 7 `*​/`; the unmatched openers pair with a later close and SWALLOW the
 *     code between them — which is exactly how the real dynamic require at
 *     state-store.js:513 went undetected. Silently skipping code is a worse
 *     failure than not scanning at all.
 *
 * Strings (all three quote styles) are tracked so their contents can never open
 * a comment. Comment characters are replaced with spaces, preserving offsets so
 * the `try`-before-require test still sees the original column layout.
 */
function stripComments(text) {
  const src = String(text);
  const out = new Array(src.length);
  let i = 0;
  let state = 'code'; // code | line | block | sq | dq | tpl

  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];
    const isNewline = c === '\n';

    if (state === 'code') {
      if (c === '/' && next === '/') { state = 'line'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === '/' && next === '*') { state = 'block'; out[i] = ' '; out[i + 1] = ' '; i += 2; continue; }
      if (c === "'") state = 'sq';
      else if (c === '"') state = 'dq';
      else if (c === '`') state = 'tpl';
      out[i] = c; i++; continue;
    }

    if (state === 'line') {
      // Newlines always survive so line numbering is preserved.
      out[i] = isNewline ? c : ' ';
      if (isNewline) state = 'code';
      i++; continue;
    }

    if (state === 'block') {
      if (c === '*' && next === '/') { out[i] = ' '; out[i + 1] = ' '; state = 'code'; i += 2; continue; }
      out[i] = isNewline ? c : ' ';
      i++; continue;
    }

    // Inside a string literal: copy verbatim, honour escapes, and bail out at a
    // newline so an unterminated quote cannot swallow the rest of the file.
    out[i] = c;
    if (c === '\\' && i + 1 < src.length) { out[i + 1] = src[i + 1]; i += 2; continue; }
    if (isNewline) { state = 'code'; i++; continue; }
    if ((state === 'sq' && c === "'") || (state === 'dq' && c === '"') || (state === 'tpl' && c === '`')) {
      // Closing quote only when it is not the opening one we just entered on.
      state = 'code';
    }
    i++;
  }

  return out.join('').split('\n');
}

const RELATIVE_REQUIRE = /require\(\s*(['"])(\.[^'"]*)\1\s*\)/;
// Matched against the STRUCTURAL view, where string contents are blanked to
// spaces. So a literal require('./x') reads as `require(        )` and must NOT
// match: the first meaningful character after the paren has to be neither
// whitespace nor a closing paren. Excluding quote and backslash keeps regex
// literals and any unblanked quote from registering as a call site.
const DYNAMIC_REQUIRE = /require\(\s*[^)\s'"\\]/;

/**
 * Blank string CONTENTS as well as comments, yielding a view safe for counting
 * braces. Needed because `{` and `}` inside a string literal would otherwise
 * corrupt block-depth tracking.
 */
function structuralView(text) {
  const lines = stripComments(text);
  return lines.map((line) => {
    let out = '';
    let quote = null;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (quote) {
        if (c === '\\') { out += '  '; i++; continue; }
        out += ' ';
        if (c === quote) quote = null;
        continue;
      }
      if (c === "'" || c === '"' || c === '`') { quote = c; out += ' '; continue; }
      out += c;
    }
    return out;
  });
}

/**
 * Return a Set of 1-based line numbers that sit inside a `try { … }` block.
 *
 * Guarded requires are the established idiom for optional dependencies, and the
 * kit writes them BOTH ways — single-line
 *   `try { ({ appendEvent } = require('../core/events')); } catch {}`
 * and multi-line
 *   `try {`
 *   `  const { runSweep } = require('./cwos-engine-complete');`
 * A same-line `try` test only catches the first, which would report every
 * multi-line guarded require as a violation. Depth tracking catches both.
 */
function tryGuardedLines(text) {
  const lines = structuralView(text);
  const guarded = new Set();
  let depth = 0;
  const openTries = []; // depths at which a try block body began

  lines.forEach((line, idx) => {
    const lineNo = idx + 1;
    if (openTries.length) guarded.add(lineNo);

    // Scan tokens left-to-right so `try {` on this line guards this line too.
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '{') {
        // A `try` immediately preceding this brace opens a guarded body.
        if (/\btry\s*$/.test(line.slice(0, i))) {
          depth++;
          openTries.push(depth);
          guarded.add(lineNo);
          continue;
        }
        depth++;
      } else if (c === '}') {
        if (openTries.length && openTries[openTries.length - 1] === depth) openTries.pop();
        depth--;
      }
    }
  });

  return guarded;
}

/**
 * Resolve a relative specifier the way Node does, including directory modules.
 * Returns a repo-relative POSIX path, or null when nothing exists on disk.
 */
function resolveRequire(root, fromRel, spec) {
  const baseAbs = path.resolve(root, path.dirname(fromRel), spec);
  const candidates = [baseAbs, `${baseAbs}.js`, path.join(baseAbs, 'index.js'), `${baseAbs}.json`];
  for (const abs of candidates) {
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return path.relative(root, abs).split(path.sep).join('/');
    }
  }
  return null;
}

/**
 * Extract every relative require from a file, tagging each as guarded or hard.
 * A require is "guarded" when it sits inside a `try { … }` block — the idiom
 * kit/scripts uses for optional dependencies, which tolerate absence by design.
 */
function scanRequires(text) {
  const out = [];
  const guarded = tryGuardedLines(text);
  stripComments(text).forEach((line, i) => {
    let rest = line;
    for (;;) {
      const m = RELATIVE_REQUIRE.exec(rest);
      if (!m) break;
      out.push({ spec: m[2], line: i + 1, guarded: guarded.has(i + 1) });
      rest = rest.slice(m.index + m[0].length);
    }
  });
  return out;
}

/**
 * Detect require(<expression>) call sites. Runs against the STRUCTURAL view, not
 * merely the comment-stripped one: prose like "dynamic require(<expr>) is
 * reported" inside a doc string is not a call site, and reporting the scanner's
 * own help text as an unanalyzable dependency is exactly the kind of noise that
 * teaches people to ignore the output.
 */
function hasDynamicRequire(text) {
  return structuralView(text).some((line) => DYNAMIC_REQUIRE.test(line));
}

// ─── the check ──────────────────────────────────────────────────────────────

function tierIndex(capability) {
  return CAPABILITY_ORDER.indexOf(capability);
}

/**
 * Pure check. Returns a plain result object; never exits, never writes.
 * Exported so cwos-verify.js and the test suite can call it directly.
 */
function checkManifestDeps(root) {
  const manifestPath = path.join(root, 'kit', 'MANIFEST.yaml');
  const read = readYAMLFile(manifestPath);
  if (!read.ok) {
    return { ok: false, exit_code: 2, error: `cannot read kit/MANIFEST.yaml: ${read.error}`, violations: [] };
  }
  const entries = read.data && read.data.files;
  if (!Array.isArray(entries)) {
    return { ok: false, exit_code: 2, error: 'kit/MANIFEST.yaml has no files array', violations: [] };
  }

  const bySource = new Map();
  for (const e of entries) {
    if (e && e.source) bySource.set(String(e.source).split('\\').join('/'), e);
  }

  const violations = [];
  const optional = [];
  const unanalyzable = [];

  // absent-source: every declared source must exist on disk.
  for (const [src, entry] of bySource) {
    if (!fs.existsSync(path.join(root, src))) {
      violations.push({
        kind: 'absent-source',
        source: src,
        capability: entry.capability || null,
        detail: `manifest declares ${src} but it does not exist — /adopt records "Source missing:" in state.errors and continues`,
      });
    }
  }

  // require-graph checks over registered .js only.
  for (const [src, entry] of bySource) {
    if (!src.endsWith('.js')) continue;
    const abs = path.join(root, src);
    if (!fs.existsSync(abs)) continue; // already reported as absent-source

    const text = fs.readFileSync(abs, 'utf8');
    if (hasDynamicRequire(text)) unanalyzable.push({ source: src, reason: 'dynamic require(<expression>)' });

    for (const req of scanRequires(text)) {
      const target = resolveRequire(root, src, req.spec);

      if (!target) {
        // Nothing on disk at all. Guarded ones are tolerated by design.
        const rec = {
          kind: 'unresolvable-require',
          source: src,
          line: req.line,
          spec: req.spec,
          detail: `require('${req.spec}') resolves to nothing on disk`,
        };
        if (req.guarded) optional.push({ ...rec, kind: 'unresolvable-guarded' });
        else violations.push(rec);
        continue;
      }

      const targetEntry = bySource.get(target);

      if (!targetEntry) {
        const rec = {
          kind: 'unregistered-dep',
          source: src,
          line: req.line,
          spec: req.spec,
          target,
          detail: `${src} requires ${target}, which kit/MANIFEST.yaml does not ship`,
        };
        if (req.guarded) optional.push({ ...rec, kind: 'unregistered-guarded' });
        else violations.push(rec);
        continue;
      }

      const consumerTier = tierIndex(entry.capability);
      const depTier = tierIndex(targetEntry.capability);
      if (consumerTier >= 0 && depTier >= 0 && depTier > consumerTier) {
        const rec = {
          kind: 'tier-inversion',
          source: src,
          line: req.line,
          target,
          consumer_capability: entry.capability,
          dep_capability: targetEntry.capability,
          detail: `${src} [${entry.capability}] requires ${target} [${targetEntry.capability}] — a repo at the consumer's tier installs the script without the module`,
        };
        if (req.guarded) optional.push({ ...rec, kind: 'tier-inversion-guarded' });
        else violations.push(rec);
      }
    }
  }

  return {
    ok: violations.length === 0,
    exit_code: violations.length === 0 ? 0 : 1,
    entries_checked: bySource.size,
    scripts_checked: [...bySource.keys()].filter((s) => s.endsWith('.js')).length,
    violations,
    optional,
    unanalyzable,
  };
}

// ─── rendering ──────────────────────────────────────────────────────────────

function renderHuman(result) {
  const out = [];
  if (result.error) return `manifest-deps: ERROR — ${result.error}\n`;

  out.push(`manifest-deps: ${result.entries_checked} manifest entries, ${result.scripts_checked} registered .js scanned.`);

  if (!result.violations.length) {
    out.push('  OK — every hard require resolves to a registered file at or below its consumer\'s tier.');
  } else {
    out.push(`  ${result.violations.length} violation(s):`);
    for (const v of result.violations) out.push(`    [${v.kind}] ${v.detail}`);
  }

  if (result.optional.length) {
    out.push(`  ${result.optional.length} guarded require(s) — optional by design, not failing:`);
    for (const o of result.optional.slice(0, 10)) {
      out.push(`    [${o.kind}] ${o.source}${o.line ? ':' + o.line : ''} -> ${o.target || o.spec}`);
    }
    if (result.optional.length > 10) out.push(`    … and ${result.optional.length - 10} more`);
  }

  if (result.unanalyzable.length) {
    out.push(`  ${result.unanalyzable.length} file(s) use dynamic require() and cannot be statically verified:`);
    for (const u of result.unanalyzable) out.push(`    ${u.source}`);
  }

  return out.join('\n') + '\n';
}

// ─── entry point ────────────────────────────────────────────────────────────

function findRoot(override) {
  if (override) return path.resolve(override);
  let dir = __dirname;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'kit', 'MANIFEST.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // WS-549: kit/MANIFEST.yaml is distribution content, so the fallback is the
  // distribution root rather than a hop count.
  return require('./lib/kit-paths').resolveDistRoot();
}

function main() {
  const { values } = cliGate(process.argv.slice(2), CLI);
  const root = findRoot(values.root);
  const result = checkManifestDeps(root);

  if (values.human) process.stdout.write(renderHuman(result));
  else process.stdout.write(JSON.stringify(result, null, 2) + '\n');

  process.exit(result.exit_code);
}

module.exports = { checkManifestDeps, stripComments, scanRequires, resolveRequire, renderHuman };

if (require.main === module) main();
