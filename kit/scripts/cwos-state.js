#!/usr/bin/env node
/**
 * cwos-state — Deterministic vital signs runner.
 *
 * Reads the vital signs table from system/state.md, executes each
 * Check Command, updates the table with PASS/FAIL status and timestamp.
 *
 * Usage: node cwos-state.js [--state-file <path>] [--timeout <ms>]
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

// ─── Check Command Allow-List (WS-148 / FIND-076) ──────────────────────────
//
// The Check Command column of system/state.md previously ran through
// `spawnSync(..., { shell: true })` with only a placeholder regex as guard.
// That meant anyone who could write a single markdown cell got RCE on the
// next /status or session-start — including via prompt injection during
// /adopt, engine findings that emit into state.md, or a malicious template.
//
// The new contract: only commands that match one of the allow-list entries
// below are ever executed. Everything else becomes status=BLOCKED with a
// loud stderr message and is recorded for audit. Commands are tokenized
// with a shell-free splitter; any shell metacharacter (`;`, `&&`, `||`, `|`,
// backtick, `$(`, `>`, `<`, newline) makes the command BLOCKED outright.
//
// To add a new permitted check, extend CHECK_COMMAND_ALLOWLIST. Argv-based
// matching is deliberate — no string-prefix matching, no shell mode.
const CHECK_COMMAND_ALLOWLIST = [
  {
    argv0: 'node',
    argv1Re: /^kit[\\/]scripts[\\/]cwos-(verify|reconcile|inventory|staleness|plan-scan|session-recovery|fleet-scan|heartbeat)\.js$/,
    argvTailRe: /^--[a-z][a-z0-9-]*(=[A-Za-z0-9_./-]+)?$/,
  },
];

const SHELL_METACHAR_RE = /[;&|`$><\n\r]|\$\(|&&|\|\|/;

// ─── CLI ────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  let stateFile = null;
  let timeout = 15000;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--state-file' && args[i + 1]) { stateFile = path.resolve(args[++i]); }
    if (args[i] === '--timeout' && args[i + 1]) { timeout = parseInt(args[++i]) || 15000; }
  }

  // Find state.md
  if (!stateFile) {
    stateFile = findStateFile(process.cwd());
    if (!stateFile) {
      console.error('ERROR: Could not find system/state.md');
      process.exit(1);
    }
  }

  if (!fs.existsSync(stateFile)) {
    console.error(`ERROR: ${stateFile} does not exist`);
    process.exit(1);
  }

  const content = fs.readFileSync(stateFile, 'utf8');
  const result = processVitalSigns(content, timeout);

  // Write back
  fs.writeFileSync(stateFile, result.updatedContent, 'utf8');

  // Shadow event (WS-174): fire only when state.md content actually changed.
  if (result.updatedContent !== content) {
    emitEvent('T11:vital-signs', 'state-regenerated', {
      pass: result.pass, fail: result.fail, skip: result.skip,
      file: path.basename(stateFile),
    });
  }

  // Summary
  console.log(`Vital Signs: ${result.pass} GREEN, ${result.fail} RED, ${result.skip} SKIP`);
  if (result.failures.length > 0) {
    console.log('Failures:');
    for (const f of result.failures) {
      console.log(`  - ${f.area}: ${f.detail}`);
    }
  }
}

// ─── Vital Signs Processing ─────────────────────────────────────────────────

function processVitalSigns(content, timeout) {
  const lines = content.split('\n');

  // Find the ## Vital Signs section
  const sectionStart = lines.findIndex(l => /^##\s+Vital Signs/.test(l.trim()));
  if (sectionStart === -1) {
    console.error('WARN: No ## Vital Signs section found in state.md');
    return { updatedContent: content, pass: 0, fail: 0, skip: 0, failures: [] };
  }

  // Find the table within this section
  let tableHeaderIdx = -1;
  let tableSepIdx = -1;
  let tableEndIdx = -1;

  for (let i = sectionStart + 1; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Stop at next section
    if (trimmed.startsWith('##') && i > sectionStart) break;

    if (tableHeaderIdx === -1 && trimmed.startsWith('|') && trimmed.includes('Area')) {
      tableHeaderIdx = i;
      continue;
    }
    if (tableHeaderIdx !== -1 && tableSepIdx === -1 && /^\|[\s-|]+$/.test(trimmed)) {
      tableSepIdx = i;
      continue;
    }
    if (tableSepIdx !== -1 && trimmed.startsWith('|')) {
      tableEndIdx = i;
      continue;
    }
    if (tableSepIdx !== -1 && !trimmed.startsWith('|') && trimmed !== '') {
      break;
    }
  }

  if (tableHeaderIdx === -1 || tableSepIdx === -1) {
    console.error('WARN: Could not find vital signs table');
    return { updatedContent: content, pass: 0, fail: 0, skip: 0, failures: [] };
  }

  // Parse header columns
  const headerCells = lines[tableHeaderIdx].split('|').filter(c => c.trim()).map(c => c.trim());
  const areaIdx = headerCells.findIndex(c => c === 'Area');
  const statusIdx = headerCells.findIndex(c => c === 'Status');
  const cmdIdx = headerCells.findIndex(c => c === 'Check Command');
  const detailIdx = headerCells.findIndex(c => c === 'Detail');

  // Process data rows
  let pass = 0, fail = 0, skip = 0;
  const failures = [];

  for (let i = tableSepIdx + 1; i <= tableEndIdx; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed.startsWith('|')) continue;

    const cells = trimmed.split('|').filter((_, idx) => idx > 0); // skip first empty
    // Remove last empty cell from trailing |
    if (cells.length > 0 && cells[cells.length - 1].trim() === '') cells.pop();

    const area = (cells[areaIdx] || '').trim();
    const cmd = (cells[cmdIdx] || '').trim();
    let status = (cells[statusIdx] || '').trim();
    let detail = (cells[detailIdx] || '').trim();

    // Placeholder guard: commands containing angle-bracket placeholders like
    // `<your build command>` are template defaults, never real commands.
    // Strip backticks first so `<your ...>` matches.
    const placeholderProbe = cmd.replace(/`/g, '');
    const isPlaceholder = /<[^>]+>/.test(placeholderProbe);

    if (!cmd || cmd === '\u2014' || cmd === '-' || cmd === 'N/A' || cmd === '\u2013') {
      // No command — skip
      skip++;
    } else if (isPlaceholder) {
      // Unconfigured placeholder — do not execute
      status = 'SKIP';
      detail = 'Not yet configured (placeholder — edit system/state.md)';
      skip++;
    } else {
      // Execute the command
      const result = runCheck(cmd, timeout);
      if (result.passed) {
        status = 'GREEN';
        detail = result.detail || detail;
        pass++;
      } else {
        status = 'RED';
        detail = result.detail || 'Check failed';
        fail++;
        failures.push({ area, detail });
      }
    }

    // Rebuild the row
    const newCells = [...cells];
    if (statusIdx < newCells.length) newCells[statusIdx] = ` ${status} `;
    if (detailIdx < newCells.length) newCells[detailIdx] = ` ${detail} `;
    lines[i] = '|' + newCells.join('|') + '|';
  }

  return {
    updatedContent: lines.join('\n'),
    pass, fail, skip,
    failures,
  };
}

// ─── Command Execution ──────────────────────────────────────────────────────

function runCheck(cmd, timeout) {
  // Remove backtick wrapping if present
  const cleanCmd = cmd.replace(/^`/, '').replace(/`$/, '');

  // Shell-metacharacter reject — catches `cmd; rm -rf /`, `cmd && curl`,
  // `cmd $(whoami)`, newline injection, etc., before tokenization.
  if (SHELL_METACHAR_RE.test(cleanCmd)) {
    const msg = `BLOCKED: shell metacharacter in Check Command: ${cleanCmd.substring(0, 80)}`;
    process.stderr.write(msg + '\n');
    return { passed: false, detail: 'BLOCKED (shell metachar)', blocked: true };
  }

  // Tokenize shell-free: split on whitespace outside quoted strings.
  const argv = tokenizeArgv(cleanCmd);
  if (argv.length === 0) {
    return { passed: false, detail: 'BLOCKED (empty command)', blocked: true };
  }

  // Match against allow-list.
  const allowed = CHECK_COMMAND_ALLOWLIST.some(entry => {
    if (argv[0] !== entry.argv0) return false;
    if (argv.length < 2 || !entry.argv1Re.test(argv[1])) return false;
    return argv.slice(2).every(t => entry.argvTailRe.test(t));
  });

  if (!allowed) {
    const msg = `BLOCKED: Check Command not in allow-list: ${cleanCmd.substring(0, 80)}`;
    process.stderr.write(msg + '\n');
    return { passed: false, detail: 'BLOCKED (not allow-listed)', blocked: true };
  }

  try {
    const result = spawnSync(argv[0], argv.slice(1), {
      shell: false,
      encoding: 'utf8',
      timeout,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (result.status === 0) {
      const firstLine = (result.stdout || '').trim().split('\n')[0] || '';
      return { passed: true, detail: firstLine.substring(0, 60) || 'OK' };
    } else {
      const errLine = (result.stderr || result.stdout || '').trim().split('\n')[0] || '';
      return { passed: false, detail: errLine.substring(0, 60) || `Exit code ${result.status}` };
    }
  } catch (err) {
    if (err.message && err.message.includes('TIMEDOUT')) {
      return { passed: false, detail: 'Timed out' };
    }
    return { passed: false, detail: err.message.substring(0, 60) };
  }
}

// Shell-free tokenizer: splits on whitespace, respects single/double quotes.
// Rejects (returns empty) if a quote is unbalanced.
function tokenizeArgv(cmd) {
  const tokens = [];
  let current = '';
  let quote = null;
  for (const ch of cmd) {
    if (quote) {
      if (ch === quote) { quote = null; }
      else { current += ch; }
    } else if (ch === "'" || ch === '"') {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (quote) return []; // unbalanced quote
  if (current) tokens.push(current);
  return tokens;
}

// Exports for testing (no external consumers of runCheck/tokenizeArgv today).
module.exports = {
  runCheck,
  tokenizeArgv,
  CHECK_COMMAND_ALLOWLIST,
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function findStateFile(startDir) {
  let dir = path.resolve(startDir);
  for (let depth = 0; depth < 10; depth++) {
    const candidate = path.join(dir, 'system', 'state.md');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ─── Run ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  main();
}
