#!/usr/bin/env node
/**
 * cwos-inventory.js — Deterministic inventory verifier for state.md.
 *
 * Counts actual files in each Inventory category and compares against
 * the documented counts in system/state.md. Prevents documentation drift
 * by catching stale counts before engines read them.
 *
 * Modes:
 *   --verify  Report mismatches (exit 1 if any)
 *   --fix     Update state.md Inventory table with correct counts
 *
 * Usage:
 *   node cwos-inventory.js --verify [--state <path>]
 *   node cwos-inventory.js --fix [--state <path>]
 */

'use strict';

require('./lib/preflight');

const fs = require('fs');
const path = require('path');

const {
  globFiles, writeFileAtomic,
} = require('./lib/cwos-utils');

const { emitBundle, bundleError } = require('./lib/cwos-orchestrate');

const { makeEventEmitter } = require('./lib/cwos-utils');
const emitEvent = makeEventEmitter();

// ─── Inventory Check Definitions ───────────────────────────────────────────

// Each entry maps a state.md Inventory row to a countable directory + pattern.
// Only rows with simple numeric counts are checked. Rows like "16 + skeleton"
// are skipped because they can't be mechanically verified.

const INVENTORY_CHECKS = [
  { component: 'Standard Commands',    dir: 'kit/commands',                          pattern: '*.md' },
  { component: 'Core Personas',        dir: 'personas/core',                         pattern: '*.md' },
  { component: 'Domain Personas',      dir: 'personas/domain',                       pattern: '*.md' },
  { component: 'Standard Engines',     dir: 'engines/standard',                      pattern: '*.md' },
  { component: 'Library Engines',      dir: 'engines/library',                       pattern: '*/SKILL.md', nested: true },
  { component: 'Deterministic Scripts',dir: 'kit/scripts',                           pattern: 'cwos-*.js' },
  { component: 'System Files',         dir: 'system',                                pattern: '*.md' },
  { component: 'HomeBase Programs',    dir: '.claude/workstream/programs',            pattern: 'prog-*.yaml' },
  { component: 'ADRs',                 dir: 'docs/adrs',                             pattern: 'ADR-*.md' },
  { component: 'Guides',               dir: 'docs/guides',                           pattern: '*.md' },
  { component: 'Product Docs',         dir: 'docs',                                  pattern: '*.md', topOnly: true },
  { component: 'Fleet Commands',       dir: 'fleet/commands',                        pattern: '*.md' },
  { component: 'Sim Scenarios',        dir: 'sim/scenarios',                         pattern: '*.yaml' },
  { component: 'Sim Repos',            dir: 'sim/repos',                             pattern: '*', dirsOnly: true },
  { component: 'Replay Scripts',       dir: 'sim/replay/scripts',                    pattern: '*.yaml' },
  { component: 'Replay Fragments',     dir: 'sim/replay/fragments',                  pattern: '*.yaml' },
  { component: 'Evolution Constitutions', dir: 'docs/evolution/constitutions',        pattern: '*.yaml' },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function countFiles(rootDir, check) {
  const fullDir = path.join(rootDir, check.dir);
  if (!fs.existsSync(fullDir)) return 0;

  if (check.nested) {
    // Count pattern matches in subdirectories (e.g., engines/library/*/SKILL.md)
    const subPattern = check.pattern.split('/');
    const filename = subPattern[subPattern.length - 1];
    let count = 0;
    try {
      for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          const candidate = path.join(fullDir, entry.name, filename);
          if (fs.existsSync(candidate)) count++;
        }
      }
    } catch { /* ignore */ }
    return count;
  }

  if (check.dirsOnly) {
    // Count subdirectories only
    try {
      return fs.readdirSync(fullDir, { withFileTypes: true })
        .filter(e => e.isDirectory()).length;
    } catch { return 0; }
  }

  if (check.topOnly) {
    // Count only files directly in dir, not subdirectories
    try {
      const regex = globToRegex(check.pattern);
      return fs.readdirSync(fullDir, { withFileTypes: true })
        .filter(e => e.isFile() && regex.test(e.name)).length;
    } catch { return 0; }
  }

  return globFiles(fullDir, check.pattern).length;
}

function globToRegex(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp('^' + escaped + '$');
}

function findRootDir(startDir) {
  let dir = path.resolve(startDir || process.cwd());
  for (let depth = 0; depth < 10; depth++) {
    if (fs.existsSync(path.join(dir, 'system', 'state.md'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

// ─── Inventory Table Parser ────────────────────────────────────────────────

function parseInventoryTable(content) {
  const lines = content.split('\n');
  let inInventory = false;
  let headerIdx = -1;
  let sepIdx = -1;
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === '## Inventory') { inInventory = true; continue; }
    if (inInventory && line.startsWith('## ') && line !== '## Inventory') break;
    if (!inInventory) continue;

    if (headerIdx === -1 && line.startsWith('|') && line.includes('Component')) {
      headerIdx = i;
      continue;
    }
    if (headerIdx !== -1 && sepIdx === -1 && line.match(/^\|[\s-|]+\|?$/)) {
      sepIdx = i;
      continue;
    }
    if (sepIdx !== -1 && line.startsWith('|')) {
      const cells = line.split('|').filter(c => c !== '').map(c => c.trim());
      if (cells.length >= 2) {
        // Extract numeric count (first number in the Count cell)
        const countStr = cells[1];
        const numMatch = countStr.match(/^(\d+)/);
        rows.push({
          lineIndex: i,
          component: cells[0],
          countStr,
          count: numMatch ? parseInt(numMatch[1]) : null,
          location: cells[2] || '',
          raw: lines[i],
        });
      }
      continue;
    }
    if (sepIdx !== -1 && !line.startsWith('|') && line !== '') break;
  }

  return { rows, headerIdx, sepIdx };
}

function updateInventoryLine(line, newCount) {
  // Replace the count number in the Count column while preserving the rest
  const parts = line.split('|');
  // parts: ['', ' Component ', ' Count ', ' Location ', '']
  if (parts.length < 4) return line;

  const countCell = parts[2];
  // Replace leading number, keep any suffix like " + skeleton"
  const updated = countCell.replace(/\d+/, String(newCount));
  parts[2] = updated;
  return parts.join('|');
}

// ─── CLI ───────────────────────────────────────────────────────────────────

function parseCLI() {
  const args = process.argv.slice(2);
  const config = { mode: 'verify', statePath: null };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--verify') config.mode = 'verify';
    else if (args[i] === '--fix') config.mode = 'fix';
    else if (args[i] === '--state' && args[i + 1]) config.statePath = path.resolve(args[++i]);
  }

  // Find root directory and state file
  const rootDir = findRootDir(process.cwd());
  if (!rootDir) bundleError('Cannot find system/state.md — are you in a CWOS repo?');

  config.rootDir = rootDir;
  if (!config.statePath) config.statePath = path.join(rootDir, 'system', 'state.md');
  if (!fs.existsSync(config.statePath)) bundleError(`State file not found: ${config.statePath}`);

  return config;
}

// ─── Main ──────────────────────────────────────────────────────────────────

function main() {
  const startMs = Date.now();
  const config = parseCLI();
  const errors = [];

  // Read state.md
  const content = fs.readFileSync(config.statePath, 'utf8');
  const { rows } = parseInventoryTable(content);

  // Count actual files and compare
  const mismatches = [];
  const verified = [];

  for (const check of INVENTORY_CHECKS) {
    const actual = countFiles(config.rootDir, check);

    // Find matching row in state.md
    const row = rows.find(r => r.component === check.component);
    if (!row) {
      errors.push(`Inventory row not found for: ${check.component}`);
      continue;
    }
    if (row.count === null) {
      // Non-numeric count (e.g., "16 + skeleton") — skip
      continue;
    }

    if (row.count !== actual) {
      mismatches.push({
        component: check.component,
        documented: row.count,
        actual,
        diff: actual - row.count,
        lineIndex: row.lineIndex,
      });
    } else {
      verified.push({ component: check.component, count: actual });
    }
  }

  // Fix mode: update state.md
  if (config.mode === 'fix' && mismatches.length > 0) {
    const lines = content.split('\n');
    for (const m of mismatches) {
      lines[m.lineIndex] = updateInventoryLine(lines[m.lineIndex], m.actual);
    }
    writeFileAtomic(config.statePath, lines.join('\n'));
    emitEvent('T6:workstream', 'inventory-rebuilt', {
      mismatches_fixed: mismatches.length,
    });
  }

  // Emit bundle
  emitBundle({
    command: 'inventory',
    script: 'cwos-inventory.js',
    startMs,
    errors,
    data: {
      mode: config.mode,
      total_checked: verified.length + mismatches.length,
      total_verified: verified.length,
      total_mismatches: mismatches.length,
      mismatches,
      verified: verified.map(v => `${v.component}: ${v.count}`),
      fixed: config.mode === 'fix' && mismatches.length > 0,
    },
  });

  // Exit code
  if (config.mode === 'verify' && mismatches.length > 0) process.exit(1);
}

main();
