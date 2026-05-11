#!/usr/bin/env node
/**
 * check-untracked-imports.mjs — preflight guard for cross-workstream build breaks.
 *
 * The bug class this prevents:
 *   When a working tree carries in-flight work from multiple workstreams,
 *   a `git add <file>` of one shared file can sweep in unrelated imports
 *   that depend on UNTRACKED folders. Local builds pass (folder exists
 *   in working tree); CI builds fail (folder not in git). Caught only at
 *   deploy time by the production build.
 *
 *   Origin failure: 2026-05-11, commit 582a417. PokerTracker.jsx swept
 *   in a `CalibrationDashboardView` lazy import; the folder was untracked.
 *   Deploy failed. Fixed in 18a031d.
 *
 * What this checks:
 *   For every source file changed on this branch (vs. origin/main), parse
 *   `import` / `import()` / `require()` statements with relative paths
 *   and confirm each resolves to a file tracked in git. Untracked targets
 *   produce a non-zero exit + a clear report.
 *
 * What this does NOT check:
 *   - Bare-package imports (`from 'react'`, `from 'node:fs'`) — out of scope.
 *   - Path-aliased imports (tsconfig paths) — repo doesn't use them.
 *   - Asset imports (`import url from './foo.svg'`) — same check still applies;
 *     untracked assets are equally fatal at build time.
 *
 * Modes:
 *   - No args:    check files changed in `origin/main...HEAD`. If empty, fall
 *                 back to staged files.
 *   - --staged:   check only staged files (`git diff --cached --name-only`).
 *   - --since=R:  check files changed in `R..HEAD` (R is a git ref).
 *                 Example: --since=HEAD~1 on CI for push-to-main workflows.
 *   - --all:      check every source file in the repo (slow; for periodic scans).
 *   - <files...>: check the given files explicitly.
 *
 * Exit:
 *   0  All relative imports resolve to tracked files.
 *   1  One or more imports resolve to untracked / missing files.
 *   2  Script error (could not determine file list, missing git, etc.).
 */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE_EXT = /\.(jsx?|tsx?|mjs|cjs)$/i;

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf-8' }).trim();
}

function getChangedFiles(args) {
  // Explicit file list wins.
  const explicit = args.filter((a) => !a.startsWith('--'));
  if (explicit.length > 0) return explicit;

  if (args.includes('--all')) {
    return sh('git ls-files').split('\n');
  }

  if (args.includes('--staged')) {
    const s = sh('git diff --cached --name-only');
    return s ? s.split('\n') : [];
  }

  // `--since=<ref>` — explicit base for the diff.
  const sinceArg = args.find((a) => a.startsWith('--since='));
  if (sinceArg) {
    const base = sinceArg.slice('--since='.length);
    const s = sh(`git diff --name-only ${base}..HEAD`);
    return s ? s.split('\n') : [];
  }

  // Default: changes on the current branch vs. origin/main.
  // Fall back to staged if branch comparison returns nothing
  // (e.g., direct commit on main without prior fetch).
  let files = [];
  try {
    // `git merge-base` ensures we compare against the divergence point,
    // not just the tip of origin/main (which might be ahead).
    const base = sh('git merge-base HEAD origin/main 2>/dev/null') || sh('git rev-parse origin/main');
    const s = sh(`git diff --name-only ${base}..HEAD`);
    files = s ? s.split('\n') : [];
  } catch {
    // origin/main may not exist locally; ignore.
  }
  if (files.length === 0) {
    const s = sh('git diff --cached --name-only');
    files = s ? s.split('\n') : [];
  }
  return files;
}

function getTrackedSet() {
  return new Set(sh('git ls-files').split('\n'));
}

// Resolve a relative import like './foo' or '../bar/baz' from a source file path
// to a candidate set of repo-root-relative file paths.
// We deliberately list ONLY file paths (with extensions or /index.*); we never
// return the bare directory, because git-ls-files lists files not directories
// (so a bare directory hit would always be reported as "untracked" — false +).
function candidatesFor(fromFile, importPath) {
  const fromDir = path.posix.dirname(fromFile.replaceAll(path.sep, '/'));
  const joined = path.posix.normalize(path.posix.join(fromDir, importPath));
  // Extensions to try, both as direct file and as `/index.<ext>`.
  const exts = ['js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs'];
  const candidates = [];
  // Direct file with extension (e.g., './foo.js')
  for (const ext of exts) candidates.push(`${joined}.${ext}`);
  // Bare-extension hit (e.g., './foo' where the file is literally named './foo')
  // — only valid when the importPath already includes a recognizable extension.
  if (/\.(jsx?|tsx?|mjs|cjs)$/i.test(joined)) candidates.push(joined);
  // Directory + index variants (e.g., './foo' → './foo/index.jsx')
  for (const ext of exts) candidates.push(`${joined}/index.${ext}`);
  return candidates;
}

// Strip block comments (`/* ... */`) at the source level, then for each
// remaining line, drop the portion at and after the first `//` that isn't
// inside a string. This is intentionally line-based: a true JS parser would
// be more robust, but for the narrow purpose of finding relative imports,
// line-scoped comment-stripping handles all real-world cases AND avoids
// the brittleness of trying to track regex literals (which can contain
// quote-like chars that confuse a character-by-character scanner).
function stripComments(source) {
  // 1. Block comments first.
  // Note: this still strips block comments inside strings, but real-world
  // source code rarely puts `/*` inside a string literal; a regex literal
  // can hold `/*` but won't be misinterpreted because we strip *before*
  // searching for imports, and the import grammar requires the literal
  // word `import` or `require` followed by `(` or `from`.
  let out = source.replace(/\/\*[\s\S]*?\*\//g, '');
  // 2. Per-line, drop `//` to end-of-line — but only when not inside a string.
  const lines = out.split('\n');
  const cleanedLines = lines.map((line) => {
    let inStr = null; // ' " or `
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      const prev = line[i - 1];
      if (inStr) {
        if (c === inStr && prev !== '\\') inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        inStr = c;
        continue;
      }
      if (c === '/' && line[i + 1] === '/') {
        return line.slice(0, i);
      }
    }
    return line;
  });
  return cleanedLines.join('\n');
}

// Pull every relative-path import out of a source file.
function extractRelativeImports(source) {
  const cleaned = stripComments(source);
  const results = [];
  // Line-anchored static import: must begin a line (optional leading whitespace)
  // followed by the `import` keyword. This skips backtick-wrapped occurrences
  // inside string literals like \`import X from '...'\`.
  const reStatic = /^\s*import(?:\s+[^'"`;\n]+\s+from)?\s+['"]([^'"]+)['"]/gm;
  // Dynamic import / require — only when preceded by a word boundary and
  // not preceded by a backtick (template-literal text masquerading as code).
  const reDynamic = /(?<![`\w])import\(\s*['"]([^'"]+)['"]\s*\)/g;
  const reRequire = /(?<![`\w])require\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const re of [reStatic, reDynamic, reRequire]) {
    let m;
    while ((m = re.exec(cleaned)) !== null) {
      const p = m[1];
      if (p.startsWith('.')) results.push(p);
    }
  }
  return results;
}

function main() {
  const args = process.argv.slice(2);
  let files;
  try {
    files = getChangedFiles(args).filter((f) => f && SOURCE_EXT.test(f));
  } catch (e) {
    console.error(`check-untracked-imports: could not determine file list: ${e.message}`);
    process.exit(2);
  }

  if (files.length === 0) {
    console.log('check-untracked-imports: no source files changed; skipping.');
    process.exit(0);
  }

  const tracked = getTrackedSet();
  const problems = [];

  for (const file of files) {
    if (!fs.existsSync(file)) continue; // deleted file
    let src;
    try {
      src = fs.readFileSync(file, 'utf-8');
    } catch {
      continue;
    }
    const imports = extractRelativeImports(src);
    for (const importPath of imports) {
      const cands = candidatesFor(file, importPath);
      // Resolve: pick the first candidate that EXISTS on disk; then check
      // whether that resolved path is tracked in git.
      const resolved = cands.find((c) => fs.existsSync(c));
      if (!resolved) {
        problems.push({ file, importPath, resolved: null, reason: 'UNRESOLVABLE' });
        continue;
      }
      if (!tracked.has(resolved)) {
        problems.push({ file, importPath, resolved, reason: 'UNTRACKED' });
      }
    }
  }

  if (problems.length === 0) {
    console.log(`check-untracked-imports: ✓ ${files.length} file(s) — all relative imports resolve to tracked files.`);
    process.exit(0);
  }

  console.error('\n❌ check-untracked-imports: FAIL\n');
  console.error('The following imports resolve to files that are NOT tracked in git.');
  console.error('A push would build locally but break on CI / production.\n');
  for (const p of problems) {
    console.error(`  ${p.file}`);
    console.error(`    imports "${p.importPath}"`);
    if (p.reason === 'UNTRACKED') {
      console.error(`    → resolved to: ${p.resolved}`);
      console.error(`    → status: UNTRACKED (run \`git status\` to verify)`);
    } else {
      console.error(`    → status: UNRESOLVABLE (no matching file with .js/.jsx/.ts/.tsx/index variants)`);
    }
    console.error('');
  }
  console.error('Fix one of:');
  console.error('  • `git add` the untracked target file(s) into the same commit, OR');
  console.error('  • Remove the import from the source file, OR');
  console.error('  • If the target belongs to a different workstream, revert the import via:');
  console.error('      git checkout origin/main -- <file>  (then re-stage only your own hunks)');
  console.error('');
  process.exit(1);
}

main();
