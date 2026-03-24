#!/usr/bin/env node
/**
 * check-protocol-sync.cjs — Validates that bridge protocol constants
 * stay in sync between the extension and the main app.
 *
 * Extension source: ignition-poker-tracker/shared/constants.js
 * App source:       src/utils/bridgeProtocol.js
 *
 * Run: node scripts/check-protocol-sync.cjs
 * Exit code: 0 = in sync, 1 = mismatch
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

// Check PROTOCOL_VERSION
const extVersion = extractScalar(extContent, 'PROTOCOL_VERSION');
const appVersion = extractScalar(appContent, 'PROTOCOL_VERSION');
if (extVersion !== appVersion) {
  console.error(`MISMATCH: PROTOCOL_VERSION — extension=${extVersion}, app=${appVersion}`);
  errors++;
} else {
  console.log(`OK: PROTOCOL_VERSION = ${extVersion}`);
}

// Check BRIDGE_MSG values
const extMsg = extractValues(extContent, 'BRIDGE_MSG');
const appMsg = extractValues(appContent, 'BRIDGE_MSG');

if (!extMsg) {
  console.error('ERROR: Could not parse BRIDGE_MSG from extension constants');
  errors++;
} else if (!appMsg) {
  console.error('ERROR: Could not parse BRIDGE_MSG from app bridge protocol');
  errors++;
} else {
  const allKeys = new Set([...Object.keys(extMsg), ...Object.keys(appMsg)]);
  for (const key of allKeys) {
    if (!(key in extMsg)) {
      console.error(`MISMATCH: BRIDGE_MSG.${key} — missing in extension`);
      errors++;
    } else if (!(key in appMsg)) {
      console.error(`MISMATCH: BRIDGE_MSG.${key} — missing in app`);
      errors++;
    } else if (extMsg[key] !== appMsg[key]) {
      console.error(`MISMATCH: BRIDGE_MSG.${key} — extension='${extMsg[key]}', app='${appMsg[key]}'`);
      errors++;
    } else {
      console.log(`OK: BRIDGE_MSG.${key} = '${extMsg[key]}'`);
    }
  }
}

if (errors > 0) {
  console.error(`\n${errors} mismatch(es) found. Update both files to match.`);
  process.exit(1);
} else {
  console.log('\nAll protocol constants in sync.');
  process.exit(0);
}
