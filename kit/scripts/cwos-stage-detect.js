#!/usr/bin/env node
/**
 * cwos-stage-detect.js — stage signal scanner.
 *
 * Reads kit/data/stage-detection-signals.yaml, walks the target repo for
 * each signal's detection rule, emits the highest-implied stage. Per
 * spec: single-hit fires (signals are narrow). Pair-escalation overlays.
 *
 * Subcommands:
 *   scan  — emit JSON {detected_min, detected_min_non_commercial, signals_fired[], scanned_at}
 *
 * Usage:
 *   node kit/scripts/cwos-stage-detect.js scan --target-dir <path> \
 *     [--commercial|--non-commercial]
 *
 * Detection types implemented:
 *   source_imports                — package.json / requirements.txt / go.mod / *.toml
 *   file_glob                     — recursive glob
 *   file_grep                     — regex search in files
 *   readme_url                    — URL extraction from README; non-localhost / non-staging
 *   git_log                       — git log --grep with date window
 *   schema_table_name_matches     — grep migration / schema files
 *   git_tag_matches               — git tag list
 *   file_count                    — count files matching globs
 *   test_function_count           — count test() / it() / describe() / def test_ occurrences
 *
 * DNS resolution intentionally NOT done — too slow and unreliable in sandbox
 * environments. URL pattern is enough for first-pass detection; founder
 * always retains the override.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { readYAMLFile } = require('./lib/cwos-utils.js');

const SIGNALS_PATH = path.join(__dirname, '..', 'data', 'stage-detection-signals.yaml');
const STAGE_ORDER = ['S1', 'S2', 'S3', 'S4', 'S5'];
const NC_STAGE_ORDER = ['N1', 'N2', 'N3'];

function readFlag(args, name) {
  const i = args.indexOf(`--${name}`);
  if (i < 0 || i === args.length - 1) return null;
  return args[i + 1];
}
function hasFlag(args, name) { return args.indexOf(`--${name}`) >= 0; }
function writeJson(obj) { process.stdout.write(JSON.stringify(obj, null, 2) + '\n'); }
function dieWith(code, msg) { process.stderr.write(`cwos-stage-detect: ${msg}\n`); process.exit(code); }

function loadSignals() {
  const r = readYAMLFile(SIGNALS_PATH);
  if (!r.ok) dieWith(2, `cannot read ${SIGNALS_PATH}: ${r.error}`);
  return r.data || {};
}

function maxStage(stages, order) {
  let best = null;
  for (const s of stages) {
    if (!s) continue;
    const ix = order.indexOf(s);
    if (ix < 0) continue;
    if (best === null || ix > order.indexOf(best)) best = s;
  }
  return best;
}

// ─── filesystem walking ───────────────────────────────────────────────────

const DEFAULT_EXCLUDES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'fixtures', 'test-data', '.next', '.cache', '__pycache__']);

function walkRepo(rootDir, excludes = DEFAULT_EXCLUDES) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (excludes.has(e.name)) continue;
        stack.push(full);
      } else if (e.isFile()) {
        out.push(full);
      }
    }
  }
  return out;
}

// Convert bash-style glob ("**/foo.{js,ts}") to a RegExp. Pragmatic — handles
// **, *, ?, character class {a,b,c} but not full bash glob semantics.
function compileGlob(pattern) {
  // Normalize backslashes for cross-platform matching
  const norm = pattern.replace(/\\/g, '/');
  let re = '';
  let i = 0;
  while (i < norm.length) {
    const ch = norm[i];
    if (ch === '*' && norm[i + 1] === '*') {
      // ** matches anything including /
      re += '.*';
      i += 2;
      if (norm[i] === '/') i++;
    } else if (ch === '*') {
      re += '[^/]*';
      i++;
    } else if (ch === '?') {
      re += '[^/]';
      i++;
    } else if (ch === '{') {
      // {a,b,c} → (a|b|c)
      const end = norm.indexOf('}', i);
      if (end < 0) { re += '\\{'; i++; continue; }
      const opts = norm.slice(i + 1, end).split(',').map(o => o.replace(/[.+^${}()|[\]\\]/g, '\\$&'));
      re += '(' + opts.join('|') + ')';
      i = end + 1;
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      re += '\\' + ch;
      i++;
    } else {
      re += ch;
      i++;
    }
  }
  return new RegExp('^' + re + '$');
}

function matchesAnyGlob(relPath, patterns) {
  const norm = relPath.replace(/\\/g, '/');
  for (const p of patterns) {
    const re = compileGlob(p);
    if (re.test(norm)) return true;
  }
  return false;
}

// ─── detection: source_imports ────────────────────────────────────────────

function detectSourceImports(rootDir, packages) {
  // Search package.json dependencies/devDependencies, requirements.txt, go.mod, Gemfile, pyproject.toml
  const results = [];
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = Object.assign({}, pkg.dependencies || {}, pkg.devDependencies || {}, pkg.peerDependencies || {});
      for (const want of packages) {
        if (want.includes('*')) {
          const re = compileGlob(want);
          for (const dep of Object.keys(deps)) {
            if (re.test(dep)) { results.push({ source: 'package.json', package: dep }); break; }
          }
        } else if (deps[want]) {
          results.push({ source: 'package.json', package: want });
        }
      }
    } catch { /* malformed package.json — skip */ }
  }
  // requirements.txt
  for (const reqFile of ['requirements.txt', 'requirements-dev.txt', 'pyproject.toml']) {
    const p = path.join(rootDir, reqFile);
    if (!fs.existsSync(p)) continue;
    try {
      const txt = fs.readFileSync(p, 'utf8');
      for (const want of packages) {
        const re = new RegExp(`\\b${want.replace(/[.+^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(txt)) results.push({ source: reqFile, package: want });
      }
    } catch { /* skip */ }
  }
  // go.mod
  const goMod = path.join(rootDir, 'go.mod');
  if (fs.existsSync(goMod)) {
    try {
      const txt = fs.readFileSync(goMod, 'utf8');
      for (const want of packages) {
        if (txt.includes(want)) results.push({ source: 'go.mod', package: want });
      }
    } catch { /* skip */ }
  }
  return results;
}

// ─── detection: file_glob ─────────────────────────────────────────────────

function detectFileGlob(rootDir, pattern) {
  const allFiles = walkRepo(rootDir);
  const matches = [];
  for (const f of allFiles) {
    const rel = path.relative(rootDir, f);
    if (matchesAnyGlob(rel, [pattern])) matches.push(rel);
  }
  return matches;
}

// ─── detection: file_grep ─────────────────────────────────────────────────

// JS RegExp doesn't accept POSIX/PCRE `(?i)` inline flag — convert to flag.
function compileRegex(src) {
  let flags = '';
  let s = String(src || '');
  if (s.startsWith('(?i)')) { flags += 'i'; s = s.slice(4); }
  return new RegExp(s, flags);
}

function detectFileGrep(rootDir, fileGlobs, regexPattern) {
  const allFiles = walkRepo(rootDir);
  const matches = [];
  const pattern = compileRegex(regexPattern);
  for (const f of allFiles) {
    const rel = path.relative(rootDir, f);
    if (!matchesAnyGlob(rel, fileGlobs)) continue;
    try {
      const txt = fs.readFileSync(f, 'utf8');
      if (pattern.test(txt)) matches.push(rel);
    } catch { /* skip binary / unreadable */ }
  }
  return matches;
}

// ─── detection: readme_url ────────────────────────────────────────────────

function detectReadmeUrl(rootDir, scheme, excludes) {
  const candidates = ['README.md', 'README.MD', 'README', 'readme.md'];
  let txt = null;
  let foundFile = null;
  for (const c of candidates) {
    const p = path.join(rootDir, c);
    if (fs.existsSync(p)) {
      try { txt = fs.readFileSync(p, 'utf8'); foundFile = c; break; } catch { /* skip */ }
    }
  }
  if (!txt) return [];
  const urlRe = new RegExp(`${scheme}://([a-zA-Z0-9.-]+)(?:[/:][^\\s)\\]]*)?`, 'g');
  const matches = [];
  let m;
  while ((m = urlRe.exec(txt)) !== null) {
    const host = m[1];
    let excluded = false;
    for (const ex of excludes) {
      const exRe = compileGlob(ex);
      if (exRe.test(host)) { excluded = true; break; }
    }
    if (!excluded) matches.push({ file: foundFile, url: m[0], host });
  }
  return matches;
}

// ─── detection: git_log ───────────────────────────────────────────────────

function detectGitLog(rootDir, opts) {
  const branches = opts.on_branch || ['main', 'master'];
  const within = opts.within_days || 30;
  const pattern = opts.commit_msg_matches;
  const minCount = opts.min_count || 1;
  if (!pattern) return [];
  // Try each branch; return first that matches
  for (const branch of branches) {
    const r = spawnSync('git', ['log', branch, `--since=${within}.days`, '-E', '--grep', pattern, '--oneline'], {
      cwd: rootDir, encoding: 'utf8', timeout: 5000,
    });
    if (r.status === 0 && r.stdout) {
      const lines = r.stdout.trim().split('\n').filter(Boolean);
      if (lines.length >= minCount) return lines;
    }
  }
  return [];
}

// ─── detection: schema_table_name_matches ─────────────────────────────────

function detectSchemaTableNames(rootDir, fileGlobs, pattern, _requireFkOrLogin) {
  // Pragmatic: just file_grep against the schema files; the requires_*
  // sub-checks are heuristic and skipped (founder override remains).
  const re = compileRegex(pattern);
  const allFiles = walkRepo(rootDir);
  const matches = [];
  for (const f of allFiles) {
    const rel = path.relative(rootDir, f);
    if (!matchesAnyGlob(rel, fileGlobs)) continue;
    try {
      const txt = fs.readFileSync(f, 'utf8');
      const m = txt.match(re);
      if (m) matches.push({ file: rel, match: m[0] });
    } catch { /* skip */ }
  }
  return matches;
}

// ─── detection: git_tag_matches ───────────────────────────────────────────

function detectGitTagMatches(rootDir, pattern) {
  const r = spawnSync('git', ['tag', '-l'], { cwd: rootDir, encoding: 'utf8', timeout: 5000 });
  if (r.status !== 0 || !r.stdout) return [];
  const re = compileRegex(pattern);
  return r.stdout.trim().split('\n').filter(t => t && re.test(t));
}

// ─── detection: file_count ────────────────────────────────────────────────

function detectFileCount(rootDir, globs, minCount) {
  const allFiles = walkRepo(rootDir);
  let count = 0;
  for (const f of allFiles) {
    const rel = path.relative(rootDir, f);
    if (matchesAnyGlob(rel, globs)) count++;
    if (count >= minCount) return { fired: true, count };
  }
  return { fired: false, count };
}

// ─── detection: test_function_count ───────────────────────────────────────

function detectTestFunctionCount(rootDir, minCount) {
  const allFiles = walkRepo(rootDir);
  const TEST_FILE_RE = /(\.test\.|_test\.|\.spec\.|test_)/i;
  const COUNT_RE = /\b(test|it|describe)\s*\(|^\s*def\s+test_/gm;
  let count = 0;
  for (const f of allFiles) {
    const rel = path.relative(rootDir, f);
    if (!TEST_FILE_RE.test(rel)) continue;
    try {
      const txt = fs.readFileSync(f, 'utf8');
      const matches = txt.match(COUNT_RE);
      if (matches) count += matches.length;
      if (count >= minCount) return { fired: true, count };
    } catch { /* skip */ }
  }
  return { fired: false, count };
}

// ─── signal evaluation ───────────────────────────────────────────────────

function evaluateSignal(signal, rootDir) {
  // Schema v2 (post-SPR-112): each detection branch is a flat object with
  // `type:` discriminator. Schema v1 fallback removed — restructured signals
  // file is the single supported shape.
  const branches = Array.isArray(signal.detections) ? signal.detections : [];
  for (const branch of branches) {
    const t = branch.type;
    if (t === 'source_imports') {
      const m = detectSourceImports(rootDir, branch.packages || []);
      if (m.length > 0) return { fired: true, evidence: { type: t, matches: m } };
    } else if (t === 'file_glob') {
      const m = detectFileGlob(rootDir, branch.pattern);
      if (m.length > 0) return { fired: true, evidence: { type: t, matches: m.slice(0, 5) } };
    } else if (t === 'file_grep') {
      const m = detectFileGrep(rootDir, branch.files || [], branch.pattern || '');
      if (m.length > 0) return { fired: true, evidence: { type: t, matches: m.slice(0, 5) } };
    } else if (t === 'readme_url') {
      const m = detectReadmeUrl(rootDir, branch.scheme || 'https', branch.excludes || []);
      if (m.length > 0) return { fired: true, evidence: { type: t, matches: m.slice(0, 3) } };
    } else if (t === 'git_log') {
      const m = detectGitLog(rootDir, branch);
      if (m.length > 0) return { fired: true, evidence: { type: t, matches: m.slice(0, 5) } };
    } else if (t === 'schema_table_name_matches') {
      const m = detectSchemaTableNames(rootDir, branch.schema_files || [], branch.pattern || '', branch.requires_fk_to_user_table || branch.requires_login_field);
      if (m.length > 0) return { fired: true, evidence: { type: t, matches: m.slice(0, 5) } };
    } else if (t === 'git_tag_matches') {
      const m = detectGitTagMatches(rootDir, branch.pattern);
      if (m.length > 0) return { fired: true, evidence: { type: t, matches: m.slice(0, 5) } };
    } else if (t === 'file_count') {
      const r = detectFileCount(rootDir, branch.globs || [], branch.min || 1);
      if (r.fired) return { fired: true, evidence: { type: t, count: r.count } };
    } else if (t === 'test_function_count') {
      const r = detectTestFunctionCount(rootDir, branch.min || 1);
      if (r.fired) return { fired: true, evidence: { type: t, count: r.count } };
    }
  }
  return { fired: false };
}

// ─── scan command ─────────────────────────────────────────────────────────

function cmdScan(args) {
  const targetDir = readFlag(args, 'target-dir');
  if (!targetDir) dieWith(2, 'scan: --target-dir <path> required');
  if (!fs.existsSync(targetDir)) dieWith(2, `scan: target-dir does not exist: ${targetDir}`);
  const isNonCommercial = hasFlag(args, 'non-commercial');

  const data = loadSignals();
  const signals = Array.isArray(data.signals) ? data.signals : [];

  const fired = [];
  for (const sig of signals) {
    const result = evaluateSignal(sig, targetDir);
    if (result.fired) {
      fired.push({
        id: sig.id,
        implies_stage_min: sig.implies_stage_min,
        implies_stage_min_non_commercial: sig.implies_stage_min_non_commercial || null,
        evidence: result.evidence,
        rationale: sig.rationale,
        pair_escalation_with: sig.pair_escalation_with || null,
        pair_escalation_to: sig.pair_escalation_to || null,
      });
    }
  }

  // Compute baseline detected_min from highest single-hit
  const commercialStages = fired.map(s => s.implies_stage_min).filter(Boolean);
  const ncStages = fired.map(s => s.implies_stage_min_non_commercial).filter(Boolean);
  let detectedMin = maxStage(commercialStages, STAGE_ORDER);
  let detectedMinNC = maxStage(ncStages, NC_STAGE_ORDER);

  // Apply pair-escalation: schema-v2 uses flat fields pair_escalation_with + pair_escalation_to.
  const firedIds = new Set(fired.map(s => s.id));
  for (const sig of fired) {
    const partner = sig.pair_escalation_with;
    const target = sig.pair_escalation_to;
    if (partner && target && firedIds.has(partner) && STAGE_ORDER.indexOf(target) > STAGE_ORDER.indexOf(detectedMin || 'S1')) {
      detectedMin = target;
    }
  }

  writeJson({
    target_dir: targetDir,
    mode: isNonCommercial ? 'non-commercial' : 'commercial',
    detected_min: detectedMin,
    detected_min_non_commercial: detectedMinNC,
    signals_fired: fired,
    scanned_at: new Date().toISOString(),
  });
}

// ─── entry ────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const sub = args[0];
  switch (sub) {
    case 'scan': return cmdScan(args.slice(1));
    case '--help': case '-h': case undefined:
      process.stderr.write(
        'usage: cwos-stage-detect <scan> [options]\n' +
        '  scan --target-dir <path> [--commercial|--non-commercial]\n'
      );
      process.exit(sub === undefined ? 2 : 0);
      return;
    default:
      dieWith(2, `unknown subcommand: ${sub}`);
  }
}

if (require.main === module) main();

module.exports = { evaluateSignal, walkRepo, compileGlob, matchesAnyGlob, detectSourceImports };
