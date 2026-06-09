#!/usr/bin/env node
/**
 * cwos-engine-persona-validate.js
 *
 * Walks every engine markdown file, extracts persona references, and verifies:
 *   1. Each reference resolves to a real .claude/agents/<name>.md file.
 *   2. The frontmatter `name:` field of that agent equals the filename basename.
 *   3. The 8 core personas in personas/core/ have basename === frontmatter name.
 *
 * Resolution rule: .claude/agents/<name>.md only. No fallback. No fuzzy match.
 *
 * Namespace exclusion: roundtable-* agents belong to the multi-persona-roundtable
 * Skill, not eng-engine. Engine prose never references them; if it ever does,
 * the validator treats them like any other reference (must resolve cleanly).
 *
 * Exits 0 on clean validation. Exits 1 with a JSON error report on any failure.
 *
 * Usage:
 *   node kit/scripts/cwos-engine-persona-validate.js          # human output
 *   node kit/scripts/cwos-engine-persona-validate.js --json   # machine output
 *
 * ADR-044 records the canonical-name decision this validator enforces.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const AGENTS_DIR = path.join(ROOT, '.claude', 'agents');
const PERSONAS_CORE = path.join(ROOT, 'personas', 'core');

// Engines we scan. Add new categories here as the engine taxonomy grows
// (e.g., engines/homebase-only/ per WS-315).
const ENGINE_SCAN_SPECS = [
  { dir: path.join(ROOT, 'engines', 'standard'), pattern: /\.md$/, recursive: false },
  { dir: path.join(ROOT, 'engines', 'library'), pattern: /SKILL\.md$/, recursive: true },
  { dir: path.join(ROOT, 'engines', 'homebase-only'), pattern: /\.md$/, recursive: true },
  { dir: path.join(ROOT, 'engines', 'procedures'), pattern: /\.md$/, recursive: false },
];

// Reference-extraction patterns. Each captures a single persona name in group 1.
// Patterns are intentionally conservative — only bold-prefixed dispatch
// directives, explicit .claude/agents/ paths, and the eng-engine roster.
// Generic `**word**` is excluded to avoid false positives on emphasized text.
const REFERENCE_PATTERNS = [
  // "Launch the **<name>** ..." or "Launch the **<name>**-persona ..."
  /Launch (?:the |all )\*\*([a-z][a-z0-9-]+)\*\*/g,
  // Eng-engine roster entries: "1. **<name>** — ..."
  /^\s*\d+\.\s+\*\*([a-z][a-z0-9-]+)\*\*\s+—/gm,
  // Explicit path references: ".claude/agents/<name>.md" or ".claude/agents/<name>`"
  /\.claude\/agents\/([a-z][a-z0-9-]+)\.md/g,
  // agent-dispatch.md panel lists: "[architect, security-engineer, product-ux]"
  // — captures the entire bracket; we'll split on commas downstream.
];
const PANEL_LIST_PATTERN = /Minimum viable panel[^:]*:\s*`?\[([^\]]+)\]`?/g;
const DROP_LIST_PATTERN = /(?:Drop|Keep)\s+`([a-z][a-z0-9-]+)`/g;

// ─── Helpers ────────────────────────────────────────────────────────────────

function readFrontmatterName(filePath) {
  // Returns the `name:` value from a markdown file's YAML frontmatter, or null.
  const text = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const lines = text.split('\n');
  if (lines[0] !== '---') return null;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') break;
    const m = /^name:\s*(.+?)\s*$/.exec(lines[i]);
    if (m) return m[1].replace(/^["']|["']$/g, '');
  }
  return null;
}

function walkDir(dir, pattern, recursive) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const cur = stack.pop();
    let entries;
    try { entries = fs.readdirSync(cur, { withFileTypes: true }); }
    catch { continue; }
    for (const e of entries) {
      const full = path.join(cur, e.name);
      if (e.isDirectory()) {
        if (recursive) stack.push(full);
      } else if (pattern.test(e.name)) {
        out.push(full);
      }
    }
  }
  return out.sort();
}

function extractReferences(md, sourcePath) {
  const refs = [];
  for (const re of REFERENCE_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(md)) !== null) {
      refs.push({ name: m[1], source: sourcePath });
    }
  }
  // Panel-list expansion
  PANEL_LIST_PATTERN.lastIndex = 0;
  let pm;
  while ((pm = PANEL_LIST_PATTERN.exec(md)) !== null) {
    for (const raw of pm[1].split(',')) {
      const name = raw.trim().replace(/`/g, '');
      if (/^[a-z][a-z0-9-]+$/.test(name)) refs.push({ name, source: sourcePath });
    }
  }
  // Drop/Keep lists
  DROP_LIST_PATTERN.lastIndex = 0;
  let dm;
  while ((dm = DROP_LIST_PATTERN.exec(md)) !== null) {
    refs.push({ name: dm[1], source: sourcePath });
  }
  return refs;
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validate() {
  const errors = [];
  const warnings = [];

  // Check 1: persona-core basename === frontmatter name (8 files expected)
  if (!fs.existsSync(PERSONAS_CORE)) {
    errors.push({ kind: 'missing_dir', path: PERSONAS_CORE });
  } else {
    const coreFiles = fs.readdirSync(PERSONAS_CORE).filter(f => f.endsWith('.md'));
    for (const file of coreFiles) {
      const basename = path.basename(file, '.md');
      const filePath = path.join(PERSONAS_CORE, file);
      const fmName = readFrontmatterName(filePath);
      if (fmName === null) {
        errors.push({ kind: 'persona_no_frontmatter_name', file: filePath });
      } else if (fmName !== basename) {
        errors.push({
          kind: 'persona_name_mismatch',
          file: filePath,
          basename,
          frontmatter_name: fmName,
        });
      }
    }
  }

  // Check 2: collect all references from scanned engine files
  const engineFiles = [];
  for (const spec of ENGINE_SCAN_SPECS) {
    engineFiles.push(...walkDir(spec.dir, spec.pattern, spec.recursive));
  }
  const allRefs = [];
  for (const ef of engineFiles) {
    const md = fs.readFileSync(ef, 'utf8');
    allRefs.push(...extractReferences(md, ef));
  }

  // Check 3: every reference resolves to .claude/agents/<name>.md, and that
  // agent's frontmatter name equals the basename.
  const agentCache = new Map();
  function resolveAgent(name) {
    if (agentCache.has(name)) return agentCache.get(name);
    const p = path.join(AGENTS_DIR, name + '.md');
    let result;
    if (!fs.existsSync(p)) {
      result = { exists: false, path: p };
    } else {
      const fm = readFrontmatterName(p);
      result = { exists: true, path: p, frontmatter_name: fm, basename: name };
    }
    agentCache.set(name, result);
    return result;
  }

  // Deduplicate references for cleaner reporting (per name + source pair).
  const seen = new Set();
  const uniqueRefs = [];
  for (const r of allRefs) {
    const key = r.name + '|' + r.source;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueRefs.push(r);
    }
  }

  for (const ref of uniqueRefs) {
    const a = resolveAgent(ref.name);
    if (!a.exists) {
      errors.push({
        kind: 'unresolved_persona_reference',
        name: ref.name,
        source: path.relative(ROOT, ref.source),
        expected: path.relative(ROOT, a.path),
      });
    } else if (a.frontmatter_name !== a.basename) {
      errors.push({
        kind: 'agent_name_mismatch',
        name: ref.name,
        path: path.relative(ROOT, a.path),
        basename: a.basename,
        frontmatter_name: a.frontmatter_name,
      });
    }
  }

  // Check 4: every .claude/agents/<name>.md (excluding roundtable-* private
  // namespace) has basename === frontmatter name.
  if (fs.existsSync(AGENTS_DIR)) {
    const agentFiles = fs.readdirSync(AGENTS_DIR).filter(f => f.endsWith('.md'));
    for (const file of agentFiles) {
      const basename = path.basename(file, '.md');
      const fp = path.join(AGENTS_DIR, file);
      const fmName = readFrontmatterName(fp);
      if (fmName === null) {
        errors.push({ kind: 'agent_no_frontmatter_name', file: fp });
      } else if (fmName !== basename) {
        errors.push({
          kind: 'agent_name_mismatch',
          path: path.relative(ROOT, fp),
          basename,
          frontmatter_name: fmName,
        });
      }
    }
  } else {
    errors.push({ kind: 'missing_dir', path: AGENTS_DIR });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    refs_scanned: uniqueRefs.length,
    engine_files_scanned: engineFiles.length,
  };
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const jsonMode = process.argv.includes('--json');
  const result = validate();

  if (jsonMode) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(
      `Scanned ${result.engine_files_scanned} engine files, ${result.refs_scanned} unique persona references.\n`
    );
    if (result.ok) {
      process.stdout.write('OK — all persona references resolve and all names match basenames.\n');
    } else {
      process.stdout.write(`FAIL — ${result.errors.length} error(s):\n`);
      for (const e of result.errors) {
        process.stdout.write('  ' + JSON.stringify(e) + '\n');
      }
    }
  }
  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = { validate, readFrontmatterName, extractReferences };
