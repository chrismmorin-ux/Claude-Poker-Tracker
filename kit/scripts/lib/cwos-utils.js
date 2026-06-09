/**
 * cwos-utils.js — Shared utilities for CWOS deterministic scripts.
 * Zero external dependencies. Handles the CWOS YAML subset, file I/O,
 * date math, and markdown table parsing.
 */

'use strict';

// Pre-flight: ensure Node.js version is adequate
const [_cwosNodeMajor] = process.versions.node.split('.').map(Number);
if (_cwosNodeMajor < 14) {
  process.stderr.write(
    `Error: Node.js v14+ is required (found v${process.versions.node}).\n` +
    `Install or update Node.js: https://nodejs.org/\n`
  );
  process.exit(1);
}

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Files worth protecting with the writeFileAtomic size-gate. A shrink to
// <max(100, 50% of prior size) on these paths is refused as likely corruption.
// New files (no prior stat) are exempt. See WS-137 / FIND-066.
const SIZE_GATE_PATH_RE =
  /(?:^|[\\/])(?:kit[\\/]commands[\\/].+\.md|\.claude[\\/]commands[\\/].+\.md|engines[\\/](?:standard|library)[\\/].+\.md|kit[\\/]claude-preamble\.md|kit[\\/]MANIFEST\.yaml)$/;

class SafeWriteError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'SafeWriteError';
    this.code = code;
  }
}

// ─── YAML Parser (CWOS subset) ─────────────────────────────────────────────

/**
 * Parse a CWOS YAML file into a plain object.
 * Handles: scalars, quoted strings, block sequences (- item), inline arrays ([a, b]),
 * block scalars (| and >), nested mappings (up to 2 levels), and comments.
 */
function parseYAML(text, warnings) {
  // Accept an optional warnings array. If omitted, warnings are silently
  // dropped (preserves prior behavior for ad-hoc callers like attribution-
  // test). readYAMLFile always supplies one and surfaces it to callers
  // so the data-loss path becomes observable. WS-147.
  const w = Array.isArray(warnings) ? warnings : null;
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const result = {};
  let i = 0;

  while (i < lines.length) {
    i = parseMapping(lines, i, 0, result, w);
  }
  return result;
}

function parseMapping(lines, i, baseIndent, target, warnings) {
  while (i < lines.length) {
    const line = lines[i];

    // Skip blank lines and comments
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }

    const indent = lineIndent(line);
    if (indent < baseIndent) return i; // dedent — return to parent

    const trimmed = line.trim();

    // Block sequence at this level (- item)
    if (trimmed.startsWith('- ')) {
      // Orphan block-sequence item at mapping scope — malformed input.
      // Typically caused by a previous block sequence terminating early
      // on a continuation line that orphans subsequent items. Historically
      // dropped silently; WS-147 records a warning so consumers can see
      // truncation. Advance i to avoid the infinite-loop fixed in 2026-04-20.
      if (warnings) {
        warnings.push({
          line: i + 1,
          reason: 'orphan-block-sequence-item',
          snippet: trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed,
        });
      }
      i++;
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) { i++; continue; } // not a key-value line

    const key = trimmed.substring(0, colonIdx).trim();
    const afterColon = trimmed.substring(colonIdx + 1).trim();

    // WS-295: detect duplicate keys within the same mapping. Last-wins
    // semantics preserved (the assignment below proceeds); the warning
    // surfaces the silent overwrite for strict-mode callers and any
    // consumer that inspects the warnings array. FIND-128 was 22 days of
    // silent staleness from this exact pattern.
    if (warnings && Object.prototype.hasOwnProperty.call(target, key)) {
      warnings.push({
        line: i + 1,
        reason: `duplicate_key:${key}`,
        snippet: trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed,
      });
    }

    if (afterColon === '' || afterColon === '|' || afterColon === '>') {
      // Check what follows: nested mapping, block sequence, or block scalar
      const nextNonEmpty = peekNextNonEmpty(lines, i + 1);
      if (nextNonEmpty === null) {
        target[key] = afterColon === '' ? null : '';
        i++;
        continue;
      }

      const nextIndent = lineIndent(lines[nextNonEmpty]);
      if (nextIndent <= indent) {
        target[key] = null;
        i++;
        continue;
      }

      if (afterColon === '|' || afterColon === '>') {
        // Block scalar
        const { value, nextLine } = readBlockScalar(lines, i + 1, nextIndent);
        target[key] = value;
        i = nextLine;
      } else if (lines[nextNonEmpty].trim().startsWith('- ')) {
        // Block sequence
        const { arr, nextLine } = readBlockSequence(lines, i + 1, nextIndent, warnings);
        target[key] = arr;
        i = nextLine;
      } else {
        // Nested mapping
        const nested = {};
        i = parseMapping(lines, i + 1, nextIndent, nested, warnings);
        target[key] = nested;
      }
    } else if (afterColon.startsWith('[')) {
      // Inline array
      target[key] = parseInlineArray(afterColon);
      i++;
    } else {
      // Scalar value
      target[key] = parseScalar(afterColon);
      i++;
    }
  }
  return i;
}

function readBlockScalar(lines, start, scalarIndent) {
  const parts = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') {
      parts.push('');
      i++;
      continue;
    }
    const indent = lineIndent(line);
    if (indent < scalarIndent) break;
    parts.push(line.substring(scalarIndent));
    i++;
  }
  // Trim trailing empty lines
  while (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();
  return { value: parts.join('\n'), nextLine: i };
}

function readBlockSequence(lines, start, seqIndent, warnings) {
  const arr = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '' || line.trim().startsWith('#')) { i++; continue; }
    const indent = lineIndent(line);
    if (indent < seqIndent) break;
    const trimmed = line.trim();
    if (!trimmed.startsWith('- ')) break;

    const itemText = trimmed.substring(2).trim();

    // Check if this sequence item starts a nested mapping
    const nextLine = i + 1;
    const nextNonEmpty = peekNextNonEmpty(lines, nextLine);
    if (nextNonEmpty !== null && lineIndent(lines[nextNonEmpty]) > indent) {
      const itemTrimmed = itemText;
      if (itemTrimmed.includes(':')) {
        // Sequence of mappings: - key: value\n  key2: value2
        const nested = {};
        const colonIdx = itemTrimmed.indexOf(':');
        const k = itemTrimmed.substring(0, colonIdx).trim();
        const v = itemTrimmed.substring(colonIdx + 1).trim();
        if (v) nested[k] = parseScalar(v);
        const childIndent = lineIndent(lines[nextNonEmpty]);
        i = parseMapping(lines, nextLine, childIndent, nested, warnings);
        arr.push(nested);
        continue;
      }
    }

    arr.push(parseScalar(itemText));
    i++;
  }
  return { arr, nextLine: i };
}

function parseInlineArray(text) {
  // Remove brackets
  const inner = text.replace(/^\[/, '').replace(/\]$/, '').trim();
  if (inner === '') return [];
  return inner.split(',').map(s => parseScalar(s.trim()));
}

function parseScalar(text) {
  if (text === '' || text === 'null' || text === '~') return null;
  if (text === 'true') return true;
  if (text === 'false') return false;

  // Quoted string
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }

  // Number
  const num = Number(text);
  if (!isNaN(num) && text !== '') return num;

  return text;
}

function lineIndent(line) {
  const match = line.match(/^(\s*)/);
  return match ? match[1].length : 0;
}

function peekNextNonEmpty(lines, start) {
  for (let i = start; i < lines.length; i++) {
    if (lines[i].trim() !== '' && !lines[i].trim().startsWith('#')) return i;
  }
  return null;
}

// ─── YAML Serializer ────────────────────────────────────────────────────────

/**
 * Serialize a plain object to YAML text.
 * Handles scalars, arrays (inline for simple, block for objects), and nested objects.
 */
function serializeYAML(obj, indent = 0) {
  const lines = [];
  const pad = ' '.repeat(indent);

  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      lines.push(`${pad}${key}: null`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        lines.push(`${pad}${key}: []`);
      } else if (typeof value[0] === 'object' && value[0] !== null) {
        // Block sequence of mappings
        lines.push(`${pad}${key}:`);
        for (const item of value) {
          const entries = Object.entries(item);
          if (entries.length === 0) continue;
          const [firstKey, firstVal] = entries[0];
          lines.push(`${pad}  - ${firstKey}: ${formatScalar(firstVal)}`);
          for (let e = 1; e < entries.length; e++) {
            const [k, v] = entries[e];
            if (Array.isArray(v)) {
              lines.push(`${pad}    ${k}: ${formatInlineArray(v)}`);
            } else if (typeof v === 'object' && v !== null) {
              lines.push(`${pad}    ${k}:`);
              const nested = serializeYAML(v, indent + 6);
              lines.push(nested);
            } else {
              lines.push(`${pad}    ${k}: ${formatScalar(v)}`);
            }
          }
          lines.push('');
        }
      } else {
        // Inline array for simple values
        lines.push(`${pad}${key}: ${formatInlineArray(value)}`);
      }
    } else if (typeof value === 'object') {
      lines.push(`${pad}${key}:`);
      lines.push(serializeYAML(value, indent + 2));
    } else if (typeof value === 'string' && value.includes('\n')) {
      lines.push(`${pad}${key}: |`);
      for (const vline of value.split('\n')) {
        lines.push(`${pad}  ${vline}`);
      }
    } else {
      lines.push(`${pad}${key}: ${formatScalar(value)}`);
    }
  }

  return lines.join('\n');
}

function formatScalar(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    // Quote if contains special chars or looks like a number
    if (/[:#\[\]{},&*!|>'"%@`]/.test(value) || value === '' ||
        value === 'true' || value === 'false' || value === 'null' ||
        value === 'yes' || value === 'no' || value === 'on' || value === 'off' ||
        value === 'Yes' || value === 'No' || value === 'On' || value === 'Off' ||
        value === 'YES' || value === 'NO' || value === 'ON' || value === 'OFF' ||
        (!isNaN(Number(value)) && value.trim() !== '')) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  return String(value);
}

function formatInlineArray(arr) {
  if (arr.length === 0) return '[]';
  return '[' + arr.map(v => formatScalar(v)).join(', ') + ']';
}

// ─── YAML Patch (read-modify-write preserving structure) ────────────────────

/**
 * Patch specific top-level scalar fields in a YAML file.
 * Preserves comments, ordering, and unmodified content.
 */
function patchYAMLFile(filePath, patches) {
  let content = fs.readFileSync(filePath, 'utf8');
  for (const [key, value] of Object.entries(patches)) {
    const regex = new RegExp(`^(${escapeRegex(key)}:\\s*).*$`, 'm');
    const formatted = formatScalar(value);
    if (regex.test(content)) {
      content = content.replace(regex, `$1${formatted}`);
    }
  }
  writeFileAtomic(filePath, content);
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── File I/O ───────────────────────────────────────────────────────────────

function readYAMLFile(filePath, opts) {
  const strict = opts && opts.strict === true;
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    const warnings = [];
    const data = parseYAML(text, warnings);
    if (strict && warnings.length > 0) {
      const first = warnings[0];
      return {
        ok: false,
        error: `${first.reason} at line ${first.line}: ${first.snippet}`,
        warnings,
      };
    }
    return { ok: true, data, warnings };
  } catch (err) {
    return { ok: false, error: err.message, warnings: [] };
  }
}

function writeFileAtomic(filePath, content, opts = {}) {
  const preserveHardlinks = opts.preserveHardlinks !== false;
  const skipSizeGate = opts.skipSizeGate === true;

  // Detect if target is hardlinked (nlink > 1). If so, write in-place to
  // preserve the inode — otherwise rename creates a new inode and breaks
  // every other path pointing to the original. Critical for kit/commands
  // <-> .claude/commands/ hardlinks on NTFS.
  let linkCount = 1;
  let priorSize = -1;
  try {
    if (fs.existsSync(filePath)) {
      const st = fs.statSync(filePath);
      linkCount = st.nlink;
      priorSize = st.size;
    }
  } catch { /* new file */ }

  const buf = Buffer.from(content, 'utf8');

  // Size gate — refuse suspicious shrinks on protected paths. New files exempt.
  // Covers writeFileAtomic interrupt-corruption AND upstream bugs that try to
  // overwrite command files with empty/truncated content.
  if (!skipSizeGate && priorSize >= 0 && SIZE_GATE_PATH_RE.test(filePath)) {
    const floor = Math.max(100, Math.floor(priorSize * 0.5));
    if (buf.length < floor) {
      throw new SafeWriteError(
        `refused suspicious shrink: ${filePath} prior=${priorSize}B new=${buf.length}B (floor=${floor}B). ` +
        `Pass { skipSizeGate: true } to override (not recommended).`,
        'SHRINK_REFUSED',
      );
    }
  }

  if (linkCount > 1 && preserveHardlinks) {
    // In-place write for hardlinked files — preserves inode so every hardlink
    // (kit/commands/ <-> .claude/commands/) sees the updated content.
    //
    // Corruption-safe sequence (see WS-137 / FIND-066):
    //   1. Write full new content at offset 0 (may leave trailing bytes from
    //      prior content, but content bytes 0..N are the new full content).
    //   2. fsync — durably persist bytes BEFORE changing the length.
    //   3. Truncate to exact length — removes any trailing garbage.
    //   4. fsync — durably persist the new length.
    //
    // If interrupted BEFORE step 1 completes, the old content is intact.
    // If interrupted AFTER step 1 but before step 3, the file has the full
    // new content plus possibly some trailing bytes from the prior version
    // (readers see valid new content; YAML/MD parsers may choke on trailers,
    // but crash-on-trailers is recoverable — zero-byte corruption is not).
    // After step 4 completes, the file is fully and exactly the new content.
    //
    // NOTE: hooks (cwos-heartbeat.js, cwos-session-recovery.js) do NOT write
    // to hardlinked command files as of 2026-04-20 (verified for WS-137) — so
    // no cross-process lockfile is needed. If a future hook writes to a
    // hardlinked path, add O_EXCL lockfile serialization here.
    const fd = fs.openSync(filePath, 'r+');
    try {
      fs.writeSync(fd, buf, 0, buf.length, 0);
      fs.fsyncSync(fd);
      fs.ftruncateSync(fd, buf.length);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }

    // Readback + SHA-256 verify. Catches any OS-level partial write silently
    // succeeding (rare but the blast radius of a corrupted command file
    // propagating via /fleet-update is fleet-wide, so verify is cheap).
    const actual = fs.readFileSync(filePath);
    if (!buffersEqual(actual, buf)) {
      // Retry once before giving up.
      const fd2 = fs.openSync(filePath, 'r+');
      try {
        fs.writeSync(fd2, buf, 0, buf.length, 0);
        fs.fsyncSync(fd2);
        fs.ftruncateSync(fd2, buf.length);
        fs.fsyncSync(fd2);
      } finally {
        fs.closeSync(fd2);
      }
      const actual2 = fs.readFileSync(filePath);
      if (!buffersEqual(actual2, buf)) {
        throw new SafeWriteError(
          `content hash mismatch post-write on hardlinked file: ${filePath} ` +
          `(retried once). Possible filesystem corruption.`,
          'HASH_MISMATCH',
        );
      }
    }
    return;
  }

  // Default path — atomic via tmp + rename. Creates new inode (intentional
  // for non-hardlinked files; safer against partial writes).
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, content, 'utf8');
  fs.renameSync(tmpPath, filePath);
}

// ─── Path-Traversal Containment (WS-430 / INV-055) ──────────────────────────
// Adopter-controlled values flowing into path.join must pass through these.
// boundedSystemDir: validates a single-segment relative directory name like
//   'system' or 'cwos-system'. boundedPathInRepo: resolves a relative path
//   against a repo root and asserts the result stays inside that root.

function boundedSystemDir(value) {
  if (typeof value !== 'string') {
    throw new SafeWriteError(
      `system_dir must be a string (got ${typeof value})`,
      'SYSTEM_DIR_INVALID',
    );
  }
  if (value.length === 0 || value.trim() !== value) {
    throw new SafeWriteError(
      `system_dir must not be empty or contain leading/trailing whitespace (got ${JSON.stringify(value)})`,
      'SYSTEM_DIR_INVALID',
    );
  }
  if (value.includes('..') || value.includes('/') || value.includes('\\') || value.includes('\0')) {
    throw new SafeWriteError(
      `system_dir must be a single path segment without '..', '/', '\\', or NUL (got ${JSON.stringify(value)})`,
      'SYSTEM_DIR_INVALID',
    );
  }
  if (path.isAbsolute(value)) {
    throw new SafeWriteError(
      `system_dir must be relative (got absolute path ${JSON.stringify(value)})`,
      'SYSTEM_DIR_INVALID',
    );
  }
  return value;
}

function boundedPathInRepo(repoRoot, rel) {
  if (typeof repoRoot !== 'string' || repoRoot.length === 0) {
    throw new SafeWriteError(
      `boundedPathInRepo: repoRoot must be a non-empty string`,
      'BOUNDED_PATH_INVALID',
    );
  }
  if (typeof rel !== 'string') {
    throw new SafeWriteError(
      `boundedPathInRepo: rel must be a string (got ${typeof rel})`,
      'BOUNDED_PATH_INVALID',
    );
  }
  const root = path.resolve(repoRoot);
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new SafeWriteError(
      `boundedPathInRepo: ${JSON.stringify(rel)} escapes repo root ${JSON.stringify(root)} (resolved to ${JSON.stringify(abs)})`,
      'BOUNDED_PATH_ESCAPE',
    );
  }
  return abs;
}

function buffersEqual(a, b) {
  if (a.length !== b.length) return false;
  // Prefer native compare; fall back to SHA-256 for very small buffers or
  // environments where Buffer.compare is flaky.
  if (typeof a.equals === 'function') return a.equals(b);
  return crypto.createHash('sha256').update(a).digest('hex') ===
         crypto.createHash('sha256').update(b).digest('hex');
}

function globFiles(dir, pattern) {
  try {
    const files = fs.readdirSync(dir);
    const regex = globToRegex(pattern);
    return files
      .filter(f => regex.test(f))
      .sort((a, b) => {
        // Numeric sort by ID when possible
        const numA = parseInt(a.match(/\d+/)?.[0] || '0');
        const numB = parseInt(b.match(/\d+/)?.[0] || '0');
        return numA - numB;
      })
      .map(f => path.join(dir, f));
  } catch {
    return [];
  }
}

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

// ─── Date Utilities ─────────────────────────────────────────────────────────

/**
 * Days between two date strings (ISO format: YYYY-MM-DD or full ISO).
 * Returns positive if b is after a.
 */
function dateDiffDays(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return Math.floor((db - da) / (1000 * 60 * 60 * 24));
}

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── Markdown Table Parser ──────────────────────────────────────────────────

/**
 * Extract a markdown table from a section identified by heading.
 * Returns { rows: [{col1: val1, ...}, ...], startLine, endLine }
 */
function parseMarkdownTable(text, sectionHeading) {
  const lines = text.split('\n');
  let inSection = false;
  let headerLine = -1;
  let separatorLine = -1;
  let columns = [];
  const rows = [];
  let startLine = -1;
  let endLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Find section
    if (line.startsWith('##') && line.includes(sectionHeading)) {
      inSection = true;
      continue;
    }
    if (inSection && line.startsWith('##') && !line.includes(sectionHeading)) {
      // Left the section
      break;
    }

    if (!inSection) continue;

    // Find table header
    if (headerLine === -1 && line.startsWith('|')) {
      headerLine = i;
      startLine = i;
      columns = line.split('|').filter(c => c.trim()).map(c => c.trim());
      continue;
    }

    // Skip separator
    if (headerLine !== -1 && separatorLine === -1 && line.match(/^\|[\s-|]+\|?$/)) {
      separatorLine = i;
      continue;
    }

    // Parse data rows
    if (separatorLine !== -1 && line.startsWith('|')) {
      const cells = line.split('|').filter(c => c !== '').map(c => c.trim());
      const row = {};
      columns.forEach((col, idx) => { row[col] = cells[idx] || ''; });
      rows.push(row);
      endLine = i;
      continue;
    }

    // Non-table line after table started — table is done
    if (separatorLine !== -1 && !line.startsWith('|') && line !== '') {
      break;
    }
  }

  return { columns, rows, startLine, endLine };
}

/**
 * Serialize rows back into a markdown table string.
 */
function serializeMarkdownTable(columns, rows) {
  const widths = columns.map(col => {
    const maxData = rows.reduce((max, row) => Math.max(max, (row[col] || '').length), 0);
    return Math.max(col.length, maxData);
  });

  const header = '| ' + columns.map((c, i) => c.padEnd(widths[i])).join(' | ') + ' |';
  const sep = '|' + widths.map(w => '-'.repeat(w + 2)).join('|') + '|';
  const body = rows.map(row =>
    '| ' + columns.map((c, i) => (row[c] || '').padEnd(widths[i])).join(' | ') + ' |'
  );

  return [header, sep, ...body].join('\n');
}

// ─── Workstream Directory Finder ────────────────────────────────────────────

/**
 * Find the .claude/workstream/ directory by walking up from startDir.
 */
function findWorkstreamDir(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  for (let depth = 0; depth < 10; depth++) {
    const candidate = path.join(dir, '.claude', 'workstream');
    if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('Could not find .claude/workstream/ directory');
}

// ─── Repo Root Finder ──────────────────────────────────────────────────────
//
// Walk up from startDir looking for marker files. Default markers: ['.git'].
// Companion to findWorkstreamDir — repo root sits one level outside the
// workstream dir but isn't always derivable that way (test fixtures, sim
// repos, fleet ops point at non-CWOS roots). Replaces 16 local copies.
//
// opts.markers: array of relative paths to look for (default: ['.git'])
// opts.requireAll: when true (default), all markers must exist at a level
//                  before that level counts. When false, any one suffices.
// opts.maxDepth: depth limit on the upward walk (default: 10).
//
// Returns startDir as a fallback if no marker is found — matches the
// behavior of the local copies it replaces (most return start unchanged
// when nothing is hit, so callers don't break on test fixtures).

// Resolve the directory that holds calibration files — findings-feedback.yaml,
// finding-lifecycle.yaml, change-impacts.yaml. In HomeBase these live under
// docs/evolution/ (the Product Evolution apparatus, which never propagates to
// adopters). In an adopted repo docs/evolution/ does not exist, so the same
// files must land under .claude/workstream/ or every calibration write silently
// no-ops. Detection is directory presence — a provable no-op in HomeBase, where
// docs/evolution/ exists and the resolver returns the identical path.
// WS-421 / INV-059.
function resolveEvolutionDir(rootDir) {
  const home = path.join(rootDir, 'docs', 'evolution');
  return fs.existsSync(home) ? home : path.join(rootDir, '.claude', 'workstream');
}

function findRepoRoot(startDir, opts = {}) {
  const start = path.resolve(startDir || process.cwd());
  const markers = opts.markers || ['.git'];
  const requireAll = opts.requireAll !== false;
  const maxDepth = typeof opts.maxDepth === 'number' ? opts.maxDepth : 10;
  let dir = start;
  for (let depth = 0; depth < maxDepth; depth++) {
    const present = markers.map((m) => fs.existsSync(path.join(dir, m)));
    if (requireAll ? present.every(Boolean) : present.some(Boolean)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return start;
}

// ─── Workstream Path Constants ─────────────────────────────────────────────
//
// Canonical relative-segment names for the most-referenced workstream files.
// Use these instead of hardcoding strings — eliminates the rename-scatter
// risk if directory layout shifts. ~75 hardcoded references across 17 scripts
// today; opt-in migration (existing strings stay until touched).
//
// Usage: path.join(findWorkstreamDir(), WS_PATHS.QUEUE_INDEX)

const WS_PATHS = Object.freeze({
  QUEUE_INDEX: 'queue-index.yaml',
  FINDINGS_INDEX: 'findings-index.yaml',
  SPRINT_INDEX: 'sprint-index.yaml',
  PROGRAMS_REGISTRY: 'programs/registry.yaml',
  RUNS_DIR: 'runs',
  CONFIG_YAML: 'config.yaml',
});

// ─── Shadow-event emitter factory ──────────────────────────────────────────
//
// Wraps the guarded-import pattern duplicated in 20+ scripts:
//   let appendEvent = null;
//   try { ({ appendEvent } = require('./core/events')); } catch {}
//   function emitEvent(track, tag, payload) { ... }
//
// Returns a function with the same (track, tag, payload) signature so
// callers can drop in without changing call sites. Failure stays silent
// per AS-23 (shadow-event writes must never fail the caller).
//
// The require is lazy (inside the factory) to avoid a circular dep:
// core/events.js imports findWorkstreamDir + withFileLock from this file.

function makeEventEmitter() {
  let appendEvent = null;
  try { ({ appendEvent } = require('../core/events')); } catch { /* events.js missing or harness-mode */ }
  return function emitEvent(track, tag, payload) {
    if (!appendEvent) return;
    try { appendEvent({ source_track: track, track_tag: tag, payload: payload || {} }); } catch { /* swallow per AS-23 */ }
  };
}

// Loads { appendEvent, ensureCommandId } from core/events + core/composition with
// the same guarded-import pattern as makeEventEmitter. Use this when a script
// needs raw appendEvent (e.g. to inject command_id from ensureCommandId — the
// composed-event protocol). Returned values are null if the underlying core/
// modules are missing (harness-mode / fleet repos without the runtime).

function loadEventDeps() {
  let appendEvent = null;
  try { ({ appendEvent } = require('../core/events')); } catch { /* events.js missing or harness-mode */ }
  let ensureCommandId = null;
  try { ({ ensureCommandId } = require('../core/composition')); } catch { /* composition.js missing */ }
  return { appendEvent, ensureCommandId };
}

// ─── Token-Jaccard similarity (WS-227 — promoted from cwos-constitutional-audit.js) ───
//
// Used by cwos-constitutional-audit.js for P2/P3 near-miss detection (WS-226)
// and the same script's --check-text mode for anti-goal / failed-state
// matching against sprint goals + item titles in /next Step 4a (WS-227).
// Both consumers share one implementation; if a third consumer needs
// corpus-driven similarity, point it at this lib too.

function tokenize(text, stopwords) {
  const stop = new Set(stopwords || []);
  return new Set(
    String(text).toLowerCase()
      .split(/\W+/)
      .filter(t => t && !stop.has(t))
  );
}

function tokenJaccard(a, b, stopwords) {
  const A = tokenize(a, stopwords);
  const B = tokenize(b, stopwords);
  if (A.size === 0 && B.size === 0) return 1;
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

// Loads a corpus YAML file. Returns { detectors, anti_goals, failed_states,
// stopwords }. Tiny inline parser — no external dep. Robust to missing
// sections (returns empty defaults). `corpusPath` is the absolute path.
function loadCorpus(corpusPath) {
  const empty = {
    detectors: {},
    anti_goals: { canonical_phrases: [], similarity_threshold: 0.45 },
    failed_states: { canonical_phrases: [], similarity_threshold: 0.45 },
    stopwords: [],
  };
  if (!fs.existsSync(corpusPath)) return empty;
  const raw = fs.readFileSync(corpusPath, 'utf8');
  const corpus = {
    detectors: {},
    anti_goals: { canonical_phrases: [], similarity_threshold: 0.45 },
    failed_states: { canonical_phrases: [], similarity_threshold: 0.45 },
    stopwords: [],
  };
  const lines = raw.split('\n');
  // section markers carry the current scope
  let section = null;
  let currentDetector = null;
  let currentScope = null; // 'detector' | 'anti_goals' | 'failed_states' | 'stopwords'
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, '').replace(/\s+$/, '');
    if (!line.trim()) continue;
    // Top-level markers (no leading whitespace)
    if (/^stopwords:\s*$/.test(line)) { section = 'stopwords'; currentDetector = null; currentScope = 'stopwords'; continue; }
    if (/^detectors:\s*$/.test(line)) { section = 'detectors'; currentDetector = null; currentScope = null; continue; }
    if (/^anti_goals:\s*$/.test(line)) { section = 'anti_goals'; currentDetector = null; currentScope = 'anti_goals'; continue; }
    if (/^failed_states:\s*$/.test(line)) { section = 'failed_states'; currentDetector = null; currentScope = 'failed_states'; continue; }
    // Detector block (2-space indent under detectors:)
    const detMatch = line.match(/^  ([A-Z][A-Z0-9-]+):\s*$/);
    if (section === 'detectors' && detMatch) {
      currentDetector = detMatch[1];
      corpus.detectors[currentDetector] = { canonical_phrases: [], similarity_threshold: 0.45 };
      section = `detector:${currentDetector}`;
      currentScope = 'detector';
      continue;
    }
    // Threshold — depth 4 (detectors block) or 2 (anti_goals / failed_states)
    const t4 = line.match(/^    similarity_threshold:\s*([\d.]+)/);
    const t2 = line.match(/^  similarity_threshold:\s*([\d.]+)/);
    if (currentScope === 'detector' && currentDetector && t4) {
      corpus.detectors[currentDetector].similarity_threshold = parseFloat(t4[1]);
      continue;
    }
    if ((currentScope === 'anti_goals' || currentScope === 'failed_states') && t2) {
      corpus[currentScope].similarity_threshold = parseFloat(t2[1]);
      continue;
    }
    // Phrase list start
    if (currentScope === 'detector' && currentDetector && /^    canonical_phrases:\s*$/.test(line)) {
      section = `canonical_phrases:detector:${currentDetector}`;
      continue;
    }
    if ((currentScope === 'anti_goals' || currentScope === 'failed_states') && /^  canonical_phrases:\s*$/.test(line)) {
      section = `canonical_phrases:${currentScope}`;
      continue;
    }
    // Phrase items — depth 6 (detector) or 4 (anti_goals/failed_states)
    if (section && section.startsWith('canonical_phrases:detector:')) {
      const m = line.match(/^      -\s*["']?(.+?)["']?\s*$/);
      if (m) { corpus.detectors[currentDetector].canonical_phrases.push(m[1].toLowerCase()); continue; }
    }
    if (section === 'canonical_phrases:anti_goals') {
      const m = line.match(/^    -\s*["']?(.+?)["']?\s*$/);
      if (m) { corpus.anti_goals.canonical_phrases.push(m[1].toLowerCase()); continue; }
    }
    if (section === 'canonical_phrases:failed_states') {
      const m = line.match(/^    -\s*["']?(.+?)["']?\s*$/);
      if (m) { corpus.failed_states.canonical_phrases.push(m[1].toLowerCase()); continue; }
    }
    // Stopword items — depth 2
    if (currentScope === 'stopwords') {
      const m = line.match(/^  -\s*["']?([\w-]+)["']?/);
      if (m) corpus.stopwords.push(m[1].toLowerCase());
    }
  }
  return corpus;
}

// ─── File-based advisory lock (WS-228 — generalized from core/events.js) ────
//
// Atomic create-exclusive lockfile. fs.openSync(path, 'wx') succeeds only when
// the path doesn't exist (POSIX O_EXCL / equivalent on NTFS), making the lock
// acquisition race-free against itself. Caller wraps the protected work in fn;
// release happens in a finally so an exception still cleans the lockfile.
//
// Stale-lock recovery: if an existing lockfile's content includes an ISO
// timestamp older than `staleAfterMs` (default 30s), treat it as orphaned and
// overwrite. This handles the case where a Node process crashed without
// reaching the finally block. 30s is conservative for sub-second protected
// regions (stamp writes, recovery loops); raise it for long operations.
//
// Lockfile content format: "<pid>:<owner-label>:<iso-timestamp>" — useful for
// debugging when a lock is stuck (founder can `cat` the lockfile to see who
// holds it and how old it is).
//
// Used by:
//   - cwos-heartbeat.js + cwos-session-recovery.js for stampHookLiveness
//     read-modify-write protection (closes FAIL-007 S1)
//   - cwos-session-recovery.js for SessionStart double-recovery mutex
//     (closes FAIL-007 S3)

function withFileLock(lockPath, fn, opts = {}) {
  const maxWaitMs = typeof opts.maxWaitMs === 'number' ? opts.maxWaitMs : 5000;
  const retryMs = typeof opts.retryMs === 'number' ? opts.retryMs : 25;
  const staleAfterMs = typeof opts.staleAfterMs === 'number' ? opts.staleAfterMs : 30000;
  const ownerLabel = opts.ownerLabel || 'unknown';
  const start = Date.now();
  const lockContent = `${process.pid}:${ownerLabel}:${new Date().toISOString()}`;
  let fd = null;
  while (fd === null) {
    try {
      fd = fs.openSync(lockPath, 'wx');
      fs.writeSync(fd, lockContent);
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Stale-lock recovery: parse existing lockfile timestamp; if older than
      // staleAfterMs, the holder is presumed dead and we overwrite.
      try {
        const existing = fs.readFileSync(lockPath, 'utf8');
        const m = existing.match(/:(\d{4}-\d{2}-\d{2}T[\d:.]+Z)$/);
        if (m) {
          const age = Date.now() - new Date(m[1]).getTime();
          if (age > staleAfterMs) {
            try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
            continue; // retry acquire on next iteration
          }
        }
      } catch { /* lockfile vanished mid-read or unparseable — fall through to wait */ }
      if (Date.now() - start > maxWaitMs) {
        throw new Error(`withFileLock: timeout after ${maxWaitMs}ms (owner=${ownerLabel}, lockfile=${lockPath})`);
      }
      const jitter = Math.floor(Math.random() * retryMs);
      const end = Date.now() + retryMs + jitter;
      while (Date.now() < end) { /* busy wait — sub-50ms window */ }
    }
  }
  try {
    return fn();
  } finally {
    try { fs.closeSync(fd); } catch { /* ignore */ }
    try { fs.unlinkSync(lockPath); } catch { /* ignore */ }
  }
}

// ─── Exports ────────────────────────────────────────────────────────────────

module.exports = {
  parseYAML,
  serializeYAML,
  patchYAMLFile,
  readYAMLFile,
  writeFileAtomic,
  SafeWriteError,
  boundedSystemDir,
  boundedPathInRepo,
  globFiles,
  dateDiffDays,
  todayISO,
  parseMarkdownTable,
  serializeMarkdownTable,
  findWorkstreamDir,
  findRepoRoot,
  resolveEvolutionDir,
  WS_PATHS,
  makeEventEmitter,
  loadEventDeps,
  formatScalar,
  formatInlineArray,
  tokenize,
  tokenJaccard,
  loadCorpus,
  withFileLock,
};
