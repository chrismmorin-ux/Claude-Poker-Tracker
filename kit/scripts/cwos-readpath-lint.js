#!/usr/bin/env node
/**
 * cwos-readpath-lint.js — heuristic detector for the determinism-first invariant
 * (WS-391): "AI must not be invoked for pure read-path work; a parse-and-compare
 * phase ships as a script."
 *
 * Scans engine markdown (standard engine .md + library SKILL.md files) and
 * flags a heading-section that contains MECHANICAL-WORK trigger language (glob,
 * count items, check existence, parse YAML, threshold-classify, tally) but does
 * NOT reference a deterministic script (`node kit/scripts/` or `cwos-`) anywhere
 * in the same section. Those sections are candidates to convert into a script.
 *
 * This is a HEURISTIC guide, not a precise gate. It runs at WARN severity in
 * cwos-verify and routes to prog-token-economy — it surfaces the backlog rather
 * than blocking. False positives are expected; the engine author either converts
 * the phase or annotates it `<!-- readpath-ok: <reason> -->` to suppress.
 *
 * Usage:
 *   node kit/scripts/cwos-readpath-lint.js            # --human (default)
 *   node kit/scripts/cwos-readpath-lint.js --json
 *   node kit/scripts/cwos-readpath-lint.js --root <p>
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');

// Mechanical-work triggers. Conservative: each strongly implies parse-and-compare
// that a script does deterministically. Tuned to avoid firing on judgment prose.
const TRIGGERS = [
  { id: 'glob', re: /\bglob\b/i },
  { id: 'count-items', re: /\bcount\b[^.\n]{0,40}\b(items?|findings?|files?|programs?|entries|personas?)\b/i },
  { id: 'check-exists', re: /\bcheck\b[^.\n]{0,30}\bexist/i },
  { id: 'parse-yaml', re: /\bparse\b[^.\n]{0,20}\b(yaml|json|frontmatter)\b/i },
  { id: 'for-each-tally', re: /\bfor each\b[^.\n]{0,60}\b(count|compute|classify|tally|read)\b/i },
  { id: 'compare-counts', re: /\bcompare\b[^.\n]{0,40}\bcounts?\b/i },
];

// A section is exempt if it references a deterministic script or carries an
// explicit suppression annotation.
const SCRIPT_REF = /node\s+kit\/scripts\/|`?cwos-[a-z0-9-]+\.js`?|kit\/scripts\/cwos-/i;
const SUPPRESS = /<!--\s*readpath-ok:/i;

function listEngineFiles(root) {
  const out = [];
  const std = path.join(root, 'engines', 'standard');
  if (fs.existsSync(std)) {
    for (const f of fs.readdirSync(std)) if (f.endsWith('.md')) out.push(path.join(std, f));
  }
  const lib = path.join(root, 'engines', 'library');
  if (fs.existsSync(lib)) {
    for (const d of fs.readdirSync(lib, { withFileTypes: true })) {
      if (!d.isDirectory()) continue;
      const skill = path.join(lib, d.name, 'SKILL.md');
      if (fs.existsSync(skill)) out.push(skill);
    }
  }
  return out.sort();
}

function blankFrontmatter(lines) {
  // Replace a leading --- ... --- YAML block with blank lines (preserving line
  // numbers) so tool lists like `tools: [Read, Glob, Grep]` don't trip the
  // `glob` trigger.
  if (lines[0] !== '---') return lines;
  const out = lines.slice();
  for (let i = 1; i < out.length; i++) {
    const closing = out[i] === '---';
    out[i] = '';
    if (closing) break;
  }
  out[0] = '';
  return out;
}

function splitSections(text) {
  // Split on ## / ### headings; each section carries its heading + body + start line.
  const lines = blankFrontmatter(text.replace(/\r\n/g, '\n').split('\n'));
  const sections = [];
  let cur = { heading: '(preamble)', startLine: 1, body: [] };
  for (let i = 0; i < lines.length; i++) {
    const hm = /^#{2,4}\s+(.*)$/.exec(lines[i]);
    if (hm) {
      sections.push(cur);
      cur = { heading: hm[1].trim(), startLine: i + 1, body: [] };
    } else {
      cur.body.push(lines[i]);
    }
  }
  sections.push(cur);
  return sections;
}

function lintFile(filePath, root) {
  const text = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(root, filePath).replace(/\\/g, '/');
  const candidates = [];
  for (const sec of splitSections(text)) {
    const body = sec.body.join('\n');
    if (SCRIPT_REF.test(body) || SUPPRESS.test(body)) continue; // already deterministic / suppressed
    const fired = TRIGGERS.filter(t => t.re.test(body)).map(t => t.id);
    if (fired.length === 0) continue;
    candidates.push({
      engine: rel,
      section: sec.heading,
      line: sec.startLine,
      triggers: fired,
    });
  }
  return candidates;
}

function lint(opts = {}) {
  const root = opts.root || ROOT;
  const files = (opts.files || listEngineFiles(root));
  const candidates = [];
  for (const f of files) candidates.push(...lintFile(f, root));
  return { ok: candidates.length === 0, count: candidates.length, candidates };
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1 || i === args.length - 1) return null;
  return args[i + 1];
}

function main() {
  const args = process.argv.slice(2);
  const result = lint({ root: readFlag(args, 'root') });
  if (args.includes('--json')) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    if (result.count === 0) {
      process.stdout.write('readpath-lint: clean — no un-scripted mechanical read-path sections.\n');
    } else {
      process.stdout.write(`readpath-lint: ${result.count} candidate section(s) for script conversion:\n`);
      for (const c of result.candidates) {
        process.stdout.write(`  ${c.engine}:${c.line} "${c.section}" [${c.triggers.join(', ')}]\n`);
      }
      process.stdout.write('\nConvert to a cwos-* script, or annotate the section with <!-- readpath-ok: <reason> -->.\n');
    }
  }
  process.exit(0); // detector is WARN-level; never gates on its own
}

if (require.main === module) main();

module.exports = { lint, lintFile, splitSections, TRIGGERS };
