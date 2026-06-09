#!/usr/bin/env node
/**
 * cwos-registry-sync.js — Reconcile HomeBase fleet/registry.yaml against
 * a repo's declared capability state in .cwos-onboarding.yaml.
 *
 * Invoked from /session-start Step 3c. Runs silently unless drift is detected,
 * then emits a single-line notice and patches the registry in place.
 *
 * The registry's capabilities_enabled field was written once at /adopt time
 * and never updated. When the founder runs /discover to enable additional
 * capabilities, the repo's .cwos-onboarding.yaml advances but the registry
 * stays stale. This script closes that loop.
 *
 * Flags:
 *   --dry-run   Report drift but don't write.
 *   --quiet     Suppress "no drift" messages.
 *   --path <p>  Path to the repo to sync (default: cwd).
 *
 * Exit codes:
 *   0  — success (including "not in fleet" and "no drift")
 *   1  — unrecoverable error (missing files, parse failure)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readYAMLFile, writeFileAtomic, makeEventEmitter } = require('./lib/cwos-utils');
const { resolveEnabledCapabilities, levelForCapabilities, CAPABILITY_ORDER } =
  require('./lib/capability-map');

const emitEvent = makeEventEmitter();

function parseArgs(argv) {
  const opts = { dryRun: false, quiet: false, repoPath: process.cwd() };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--quiet') opts.quiet = true;
    else if (a === '--path' && argv[i + 1]) opts.repoPath = path.resolve(argv[++i]);
  }
  return opts;
}

function findHomeBase(startDir) {
  let dir = path.resolve(startDir);
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'fleet', 'registry.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function normalizePath(p) {
  return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

/**
 * Patch a specific repo entry's capabilities_enabled (and maturity) in
 * registry.yaml, preserving all comments and surrounding structure.
 *
 * Entry shape:
 *   - name: "Physical-Therapy-by-AI"
 *     path: "C:/Users/chris/Physical-Therapy-by-AI"
 *     ...
 *     capabilities_enabled: [core]
 *     maturity: L1
 *     ...
 *
 * We locate the entry whose path matches (case-insensitive), then rewrite
 * its capabilities_enabled and maturity lines in place.
 */
function patchRegistryEntry(registryText, repoPath, caps, maturity) {
  const lines = registryText.split('\n');
  const targetPath = normalizePath(repoPath);

  let entryStart = -1;
  let entryEnd = lines.length;
  let entryIndent = -1;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(\s*)-\s+name:/);
    if (!m) continue;
    const thisIndent = m[1].length;

    // If we were scanning an entry, close it on the next same-indent list item.
    if (entryStart >= 0 && thisIndent <= entryIndent) {
      entryEnd = i;
      break;
    }

    // Scan forward within this candidate entry for a matching path line.
    for (let j = i + 1; j < lines.length; j++) {
      const n = lines[j].match(/^(\s+)-\s+name:/);
      if (n && n[1].length <= thisIndent) break;
      const pm = lines[j].match(/^\s+path:\s*["']?([^"'\n]+?)["']?\s*$/);
      if (pm) {
        if (normalizePath(pm[1]) === targetPath) {
          entryStart = i;
          entryIndent = thisIndent;
        }
        break;
      }
    }
    if (entryStart >= 0 && entryIndent === thisIndent && i > entryStart) {
      entryEnd = i;
      break;
    }
  }

  if (entryStart < 0) {
    return { matched: false, text: registryText };
  }

  const capsLiteral = caps.length === 0
    ? '[]'
    : '[' + caps.join(', ') + ']';
  const fieldPad = ' '.repeat(entryIndent + 2);
  const capsLine = `${fieldPad}capabilities_enabled: ${capsLiteral}`;
  const maturityLine = `${fieldPad}maturity: ${maturity}`;

  let patchedCaps = false;
  let patchedMaturity = false;

  for (let i = entryStart; i < entryEnd; i++) {
    if (/^\s+capabilities_enabled:/.test(lines[i])) {
      lines[i] = capsLine;
      patchedCaps = true;
    } else if (/^\s+maturity:/.test(lines[i])) {
      lines[i] = maturityLine;
      patchedMaturity = true;
    }
  }

  // If the entry lacks capabilities_enabled, insert after `type:` line.
  if (!patchedCaps) {
    for (let i = entryStart; i < entryEnd; i++) {
      if (/^\s+type:/.test(lines[i])) {
        lines.splice(i + 1, 0, capsLine);
        break;
      }
    }
  }
  if (!patchedMaturity) {
    // Insert after capabilities_enabled line.
    for (let i = entryStart; i < entryEnd + 1; i++) {
      if (/^\s+capabilities_enabled:/.test(lines[i])) {
        lines.splice(i + 1, 0, maturityLine);
        break;
      }
    }
  }

  return { matched: true, text: lines.join('\n') };
}

function setsEqual(a, b) {
  const as = a instanceof Set ? a : new Set(a);
  const bs = b instanceof Set ? b : new Set(b);
  if (as.size !== bs.size) return false;
  for (const v of as) if (!bs.has(v)) return false;
  return true;
}

function orderedCaps(capSet) {
  return CAPABILITY_ORDER.filter((c) => capSet.has(c));
}

function main() {
  const opts = parseArgs(process.argv);
  const homeBase = findHomeBase(opts.repoPath) || findHomeBase(process.cwd());
  if (!homeBase) {
    // Not catastrophic — repo isn't under a HomeBase root. Quiet.
    if (!opts.quiet) console.log('registry-sync: no HomeBase root found, skipping.');
    return 0;
  }

  const onboardingPath = path.join(opts.repoPath, '.cwos-onboarding.yaml');
  if (!fs.existsSync(onboardingPath)) {
    if (!opts.quiet) console.log('registry-sync: no .cwos-onboarding.yaml, skipping.');
    return 0;
  }

  const onboarding = readYAMLFile(onboardingPath);
  if (!onboarding.ok) {
    console.error(`registry-sync: failed to parse onboarding: ${onboarding.error}`);
    return 1;
  }

  const resolved = resolveEnabledCapabilities(onboarding.data);
  const declaredCaps = resolved.enabled;
  const declaredList = orderedCaps(declaredCaps);
  const declaredMaturity = levelForCapabilities(declaredCaps) || 'L0';

  const registryPath = path.join(homeBase, 'fleet', 'registry.yaml');
  const registry = readYAMLFile(registryPath);
  if (!registry.ok || !Array.isArray(registry.data && registry.data.repos)) {
    console.error(`registry-sync: failed to parse ${registryPath}`);
    return 1;
  }

  const targetPath = normalizePath(opts.repoPath);
  const entry = registry.data.repos.find(
    (r) => r && r.path && normalizePath(r.path) === targetPath
  );

  if (!entry) {
    if (!opts.quiet) {
      console.log(`registry-sync: repo not in fleet registry. Run /adopt to register.`);
    }
    return 0;
  }

  const currentCaps = new Set(entry.capabilities_enabled || []);
  const currentMaturity = entry.maturity || 'L0';

  if (setsEqual(currentCaps, declaredCaps) && currentMaturity === declaredMaturity) {
    if (!opts.quiet) console.log('registry-sync: no drift.');
    return 0;
  }

  if (opts.dryRun) {
    console.log(
      `registry-sync (dry-run): ${entry.name} drift detected — ` +
      `registry=[${[...currentCaps].join(', ')}] maturity=${currentMaturity} → ` +
      `declared=[${declaredList.join(', ')}] maturity=${declaredMaturity}`
    );
    return 0;
  }

  const registryText = fs.readFileSync(registryPath, 'utf8');
  const { matched, text } = patchRegistryEntry(
    registryText, entry.path, declaredList, declaredMaturity
  );
  if (!matched) {
    console.error(`registry-sync: could not locate entry block for ${entry.name}`);
    return 1;
  }

  writeFileAtomic(registryPath, text);
  emitEvent('T12:program-management', 'registry-synced', {
    repo: entry.name, capabilities: declaredList, maturity: declaredMaturity,
  });
  console.log(
    `✓ Fleet registry synced: ${entry.name} → [${declaredList.join(', ')}] (${declaredMaturity})`
  );
  return 0;
}

if (require.main === module) {
  process.exit(main());
}

module.exports = { patchRegistryEntry, findHomeBase, normalizePath };
