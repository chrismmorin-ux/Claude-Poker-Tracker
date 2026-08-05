#!/usr/bin/env node
/**
 * check-additive.mjs — the additive-only gate for the Standard-of-Record schemas (WS-328).
 *
 * MODELLED ON `scripts/check-idb-additive.sh`, and for the same reason. That gate exists because
 * `migrationRegistry` authoring rule #2 says a migration may never remove a store or an index:
 * removing one breaks replay from any prior version. A Result Card has the identical property —
 * a card written in generation 1 must still parse in generation 5, or the Ladder cannot rebase
 * and every historical figure becomes unreadable at exactly the moment someone needs to check it.
 *
 * WHY A DIFF AND NOT A GREP. The IDB gate can grep, because its violation has a source-code
 * primitive (`deleteObjectStore(`). A schema violation has none: deleting a line from an array
 * leaves no token to search for. So this gate compares the LIVE schemas against a committed
 * baseline snapshot and fails on removal or retyping — the data-shape half, exactly as
 * `__tests__/migrationRegistry.test.js` is the data-shape half over there.
 *
 * Usage:
 *   node scripts/standardOfRecord/check-additive.mjs           # check
 *   node scripts/standardOfRecord/check-additive.mjs --update   # re-snapshot (review the diff!)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  SOR_SCHEMAS,
  MANIFEST_SCHEMA,
  SOR_SCHEMA_VERSIONS,
} from '../../src/utils/standardOfRecord/schemas.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASELINE = join(HERE, 'schema-baseline.json');

/** The live shape, reduced to what the invariant is about: names, types, and versions. */
const snapshot = () => {
  const objects = {};
  for (const [name, fields] of Object.entries(SOR_SCHEMAS)) {
    objects[name] = {
      version: SOR_SCHEMA_VERSIONS[name] ?? null,
      fields: fields.map((f) => ({ name: f.name, type: f.type, since: f.since })),
    };
  }
  objects.__manifest = {
    version: null,
    fields: MANIFEST_SCHEMA.map((f) => ({ name: f.name, type: f.type, since: f.since })),
  };
  return objects;
};

const compare = (baseline, live) => {
  const violations = [];
  for (const [objName, base] of Object.entries(baseline)) {
    const now = live[objName];
    if (!now) {
      violations.push(`OBJECT REMOVED: "${objName}" is in the baseline and gone from SOR_SCHEMAS. `
        + 'An object type may become obsolete but never disappear — a reader of an old artifact '
        + 'must get null, not a crash.');
      continue;
    }
    const nowByName = new Map(now.fields.map((f) => [f.name, f]));
    for (const f of base.fields) {
      const cur = nowByName.get(f.name);
      if (!cur) {
        violations.push(`FIELD REMOVED: ${objName}.${f.name}. Mark it `
          + '`deprecated: "<reason>"` and leave it in place; deleting it makes every prior '
          + 'artifact carrying it unreadable by this reader.');
        continue;
      }
      if (cur.type !== f.type) {
        violations.push(`FIELD RETYPED: ${objName}.${f.name} was "${f.type}", is now `
          + `"${cur.type}". A retype is a silent removal — an old artifact still parses and now `
          + 'means something else.');
      }
      if (cur.since !== f.since) {
        violations.push(`SINCE CHANGED: ${objName}.${f.name} claimed since ${f.since}, now `
          + `${cur.since}. The version a field shipped in is history, not a setting.`);
      }
    }
    // A NEW field must arrive with `since` equal to the (bumped) current version. Otherwise a
    // consumer refusing a MAJOR it does not understand cannot tell the field is new.
    const baseNames = new Set(base.fields.map((f) => f.name));
    for (const f of now.fields) {
      if (baseNames.has(f.name)) continue;
      if (now.version != null && f.since !== now.version) {
        violations.push(`NEW FIELD MIS-VERSIONED: ${objName}.${f.name} is new with since=`
          + `${f.since}, but SOR_SCHEMA_VERSIONS.${objName} is ${now.version}. Authoring rule #2: `
          + 'a new field arrives with `since` set to the NEXT schema version and that version is '
          + 'bumped in the same change.');
      }
    }
    if (now.version != null && base.version != null && now.version < base.version) {
      violations.push(`VERSION WENT BACKWARDS: ${objName} was ${base.version}, is now ${now.version}.`);
    }
  }
  return violations;
};

const live = snapshot();

if (process.argv.includes('--update')) {
  await writeFile(BASELINE, `${JSON.stringify(live, null, 2)}\n`, 'utf8');
  console.log(`✅ Standard-of-Record schema baseline re-snapshotted at ${BASELINE}`);
  console.log('   Review the diff before committing — this file IS the additive-only invariant.');
  process.exit(0);
}

let baseline;
try {
  baseline = JSON.parse(await readFile(BASELINE, 'utf8'));
} catch {
  console.error(`❌ Standard-of-Record additive-only check: no baseline at ${BASELINE}`);
  console.error('   Create it with --update, then commit it.');
  process.exit(1);
}

const violations = compare(baseline, live);
if (violations.length) {
  console.error('❌ ADDITIVE-ONLY VIOLATION IN src/utils/standardOfRecord/schemas.js');
  console.error('');
  for (const v of violations) console.error(`   - ${v}`);
  console.error('');
  console.error('Per the authoring rules in schemas.js (mirrored from');
  console.error('src/utils/persistence/migrationRegistry.js rule #2): field lists are');
  console.error('APPEND-ONLY. A Result Card from generation 1 must still parse in generation 5,');
  console.error('or the Ladder cannot rebase and every historical figure becomes unreadable.');
  process.exit(1);
}

const objects = Object.keys(live).length;
const fields = Object.values(live).reduce((n, o) => n + o.fields.length, 0);
console.log('✅ Standard-of-Record additive-only check: OK');
console.log(`   - ${objects} registered objects, ${fields} fields, none removed or retyped.`);
