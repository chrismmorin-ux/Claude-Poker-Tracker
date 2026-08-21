#!/usr/bin/env node
/**
 * check-protocol-sync.cjs — the app and the extension must agree about the bridge protocol.
 *
 * Extension source: ignition-poker-tracker/shared/constants.js  (the canonical definition)
 * App source:       src/utils/bridgeProtocol.js
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THIS GATE WAS DEAD, AND THE FIX THAT KILLED IT WAS A GOOD ONE (2026-08-21)
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * It was written when the app DUPLICATED the constants, so comparing two object literals was
 * the right check. The app then moved to a pure re-export —
 *
 *     export { PROTOCOL_VERSION, BRIDGE_MSG } from '@extension-shared/constants.js';
 *
 * — which is strictly better, because it removes the possibility of drift instead of detecting
 * it. But this script kept looking for `const BRIDGE_MSG = {...}` in a file that no longer has
 * one, so it reported `app=null` and `Could not parse BRIDGE_MSG` on EVERY run, and exited 1
 * unconditionally. A gate that always fails is not a gate: it gets ignored, and then it is
 * indistinguishable from one that would have caught something.
 *
 * So the check now verifies THE PROPERTY THAT ACTUALLY MATTERS NOW: the app re-exports from the
 * canonical module and does not redefine either symbol locally. Duplication is the failure; a
 * re-export is the pass condition, not a parse error.
 *
 * Run: node scripts/check-protocol-sync.cjs
 * Exit code: 0 = in sync, 1 = drift
 */

const fs = require('fs');
const path = require('path');

const EXT_PATH = path.join(__dirname, '..', 'ignition-poker-tracker', 'shared', 'constants.js');
const APP_PATH = path.join(__dirname, '..', 'src', 'utils', 'bridgeProtocol.js');

function extractValues(content, varName) {
  // Match: const VARNAME = { ... };  or  export const VARNAME = { ... };
  const regex = new RegExp(`(?:export\\s+)?const\\s+${varName}\\s*=\\s*({[^}]+})`, 's');
  const match = content.match(regex);
  if (!match) return null;

  // Extract key-value pairs from the object literal
  const pairs = {};
  const kvRegex = /(\w+)\s*:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = kvRegex.exec(match[1])) !== null) {
    pairs[m[1]] = m[2];
  }
  return pairs;
}

function extractScalar(content, varName) {
  const regex = new RegExp(`(?:export\\s+)?const\\s+${varName}\\s*=\\s*([^;]+);`);
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

// Read files
let extContent, appContent;
try {
  extContent = fs.readFileSync(EXT_PATH, 'utf8');
} catch (e) {
  console.log('SKIP: Extension constants not found at', EXT_PATH);
  process.exit(0);
}
try {
  appContent = fs.readFileSync(APP_PATH, 'utf8');
} catch (e) {
  console.error('ERROR: App bridge protocol not found at', APP_PATH);
  process.exit(1);
}

let errors = 0;

/**
 * Does the app re-export a symbol from the canonical extension module rather than defining it?
 * That is the modern, correct shape and it makes drift structurally impossible.
 */
function reExportsFromCanonical(content, symbol) {
  const re = new RegExp(
    'export\\s*\\{[^}]*\\b' + symbol + '\\b[^}]*\\}\\s*from\\s*[\'"]([^\'"]+)[\'"]',
    's',
  );
  const m = content.match(re);
  return m ? m[1] : null;
}

/** A local redefinition is the thing that would reintroduce drift. */
function definesLocally(content, symbol) {
  return new RegExp('(?:export\\s+)?const\\s+' + symbol + '\\s*=').test(content);
}

const CANONICAL_HINT = 'extension-shared';

for (const symbol of ['PROTOCOL_VERSION', 'BRIDGE_MSG']) {
  const from = reExportsFromCanonical(appContent, symbol);
  const local = definesLocally(appContent, symbol);

  if (from && !local) {
    if (!from.includes(CANONICAL_HINT)) {
      console.error(`MISMATCH: ${symbol} — app re-exports from '${from}', not the canonical extension module`);
      errors++;
    } else {
      console.log(`OK: ${symbol} re-exported from ${from} — drift structurally impossible`);
    }
    continue;
  }

  if (local) {
    // A local copy is the shape this script was originally written to police. It is still
    // detectable, but the right fix is to delete the copy, not to keep the two in step by hand.
    console.error(`DRIFT RISK: ${symbol} is defined locally in the app rather than re-exported. `
      + 'Re-export it from "@extension-shared/constants.js" so the two cannot diverge at all.');
    errors++;
    continue;
  }

  console.error(`MISMATCH: ${symbol} — app neither re-exports nor defines it`);
  errors++;
}

// The extension side must still actually HAVE them, whatever the app does.
if (extractScalar(extContent, 'PROTOCOL_VERSION') === null) {
  console.error('ERROR: PROTOCOL_VERSION missing from extension constants');
  errors++;
}

// The extension's BRIDGE_MSG must be parseable and non-empty — the app inherits whatever is
// here, so an unparseable canonical definition is the one remaining way this can go wrong.
const extMsg = extractValues(extContent, 'BRIDGE_MSG');
if (!extMsg || Object.keys(extMsg).length === 0) {
  console.error('ERROR: Could not parse a non-empty BRIDGE_MSG from the extension constants');
  errors++;
} else {
  console.log(`OK: BRIDGE_MSG defines ${Object.keys(extMsg).length} message type(s) in the canonical module`);
}

if (errors > 0) {
  console.error(`\n${errors} mismatch(es) found. Update both files to match.`);
  process.exit(1);
} else {
  console.log('\nAll protocol constants in sync.');
  process.exit(0);
}
