#!/usr/bin/env node
/**
 * cwos-bundle-validate — Archetype-bundle schema + INV-049 runtime validator.
 *
 * WS-383. The archetype bundle (`--archetype-bundle <json>` to
 * cwos-adopt-install.js, also materialized as the `archetype_bundle_resolved`
 * block in an adopted repo's .cwos-onboarding.yaml) drives which program
 * templates install and records the resolved engine/persona set. Until WS-383
 * the only validation was `Array.isArray(bundle.programs)`, so a malformed or
 * hostile bundle was weakly checked and INV-049 ("HomeBase-internal engines
 * never propagate to adopted repos") was enforced only statically against the
 * MANIFEST — never at runtime against the bundle actually being installed.
 *
 * This module is the single source of truth, imported by both
 * cwos-adopt-install.js (parse-time, fail-closed before any file op) and
 * cwos-verify.js (INV-049, validates a resolved bundle artifact when present).
 *
 * Zero-dep by design: no `ajv` / no package.json in this repo. The canonical
 * contract lives at kit/schemas/archetype-bundle.json (human-readable); this
 * hand-rolled validator implements it.
 *
 * Exports:
 *   loadHomebaseOnlyEngines(rootDir) -> Set<engineName>
 *   validateArchetypeBundle(bundle, { homebaseOnlyEngines }) -> { ok, errors[] }
 *
 * Run directly for a self-check:  node kit/scripts/lib/cwos-bundle-validate.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { readYAMLFile } = require('./cwos-utils');

const PROGRAM_ID_RE = /^prog-[A-Za-z0-9_-]+$/;

/**
 * Map a MANIFEST source path under engines/homebase-only/ to its engine name.
 * Top-level engines: basename minus `.md` (engines/homebase-only/meta-engine.md
 * -> "meta-engine"). Pack engines: the directory containing SKILL.md
 * (engines/homebase-only/cross-repo-insight/SKILL.md -> "cross-repo-insight").
 */
function engineNameFromHomebaseSource(src) {
  const rel = String(src).replace(/^engines\/homebase-only\//, '');
  if (rel.endsWith('/SKILL.md')) {
    const parts = rel.split('/');
    return parts[parts.length - 2];
  }
  return rel.replace(/\.md$/, '');
}

/**
 * Enumerate the set of homebase-only engine NAMES from kit/MANIFEST.yaml.
 * The MANIFEST `homebase_only: true` flag is the same source of truth the
 * installer's capability filter (cwos-adopt-install.js:339) and the static
 * INV-049 check (cwos-verify.js) already rely on. Returns an empty Set if the
 * MANIFEST is missing/unparseable (callers decide how strict to be).
 */
function loadHomebaseOnlyEngines(rootDir) {
  const set = new Set();
  if (!rootDir) return set;
  const manifestPath = path.join(rootDir, 'kit', 'MANIFEST.yaml');
  if (!fs.existsSync(manifestPath)) return set;
  const { ok, data } = readYAMLFile(manifestPath);
  if (!ok || !data || !Array.isArray(data.files)) return set;
  for (const entry of data.files) {
    const src = entry && entry.source ? String(entry.source) : '';
    if (entry && entry.homebase_only === true && src.startsWith('engines/homebase-only/')) {
      const name = engineNameFromHomebaseSource(src);
      if (name) set.add(name);
    }
  }
  return set;
}

/**
 * Validate an archetype bundle object against the real bundle shape and
 * INV-049. Aggregates all problems into errors[] (never throws) so callers
 * control the failure UX. Unknown top-level keys are permitted (forward-compat
 * with future resolver fields); every known key is type-checked strictly.
 *
 * @param {object} bundle  parsed bundle JSON / resolved block
 * @param {object} [opts]
 * @param {Set<string>} [opts.homebaseOnlyEngines] names that must NOT appear in bundle.engines
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateArchetypeBundle(bundle, opts) {
  const errors = [];
  const homebaseOnlyEngines = (opts && opts.homebaseOnlyEngines) || new Set();

  if (bundle == null || typeof bundle !== 'object' || Array.isArray(bundle)) {
    return { ok: false, errors: ['bundle must be a JSON object'] };
  }

  // programs: required array of program-ID strings. The strict pattern rejects
  // path traversal (../), separators (/ \), and any non-ID characters, so the
  // bundle can never steer the installer at a path outside the trusted
  // kit/templates/workstream/programs/ base.
  if (!Array.isArray(bundle.programs)) {
    errors.push('programs must be an array');
  } else {
    bundle.programs.forEach((p, i) => {
      if (typeof p !== 'string' || !PROGRAM_ID_RE.test(p)) {
        errors.push(`programs[${i}] must match /^prog-[A-Za-z0-9_-]+$/ (got ${JSON.stringify(p)})`);
      }
    });
  }

  // engines: optional array of non-empty name strings. INV-049: none may be a
  // homebase-only engine — those must never reach an adopted repo.
  if (bundle.engines !== undefined) {
    if (!Array.isArray(bundle.engines)) {
      errors.push('engines must be an array when present');
    } else {
      bundle.engines.forEach((e, i) => {
        if (typeof e !== 'string' || e.trim() === '') {
          errors.push(`engines[${i}] must be a non-empty string (got ${JSON.stringify(e)})`);
        } else if (homebaseOnlyEngines.has(e)) {
          errors.push(`INV-049 violation: engine "${e}" is homebase-only and must not propagate to an adopted repo`);
        }
      });
    }
  }

  // personas: optional array of non-empty name strings.
  if (bundle.personas !== undefined) {
    if (!Array.isArray(bundle.personas)) {
      errors.push('personas must be an array when present');
    } else {
      bundle.personas.forEach((p, i) => {
        if (typeof p !== 'string' || p.trim() === '') {
          errors.push(`personas[${i}] must be a non-empty string (got ${JSON.stringify(p)})`);
        }
      });
    }
  }

  // archetype / stage: optional scalar strings.
  for (const key of ['archetype', 'stage', 'resolved_at']) {
    if (bundle[key] !== undefined && typeof bundle[key] !== 'string') {
      errors.push(`${key} must be a string when present`);
    }
  }

  // tiers: optional plain object (prog-id -> tier).
  if (bundle.tiers !== undefined
      && (typeof bundle.tiers !== 'object' || bundle.tiers === null || Array.isArray(bundle.tiers))) {
    errors.push('tiers must be an object when present');
  }

  return { ok: errors.length === 0, errors };
}

module.exports = {
  loadHomebaseOnlyEngines,
  validateArchetypeBundle,
  engineNameFromHomebaseSource,
  PROGRAM_ID_RE,
};

// ─── CLI self-check ─────────────────────────────────────────────────────────
if (require.main === module) {
  const cases = [
    { name: 'valid minimal', bundle: { programs: ['prog-corrective'] }, hb: [], expectOk: true },
    { name: 'valid full', bundle: { archetype: 'saas', stage: 'growth', programs: ['prog-corrective', 'prog-kit_quality'], engines: ['eng-engine'], personas: ['architect'], tiers: { 'prog-corrective': 'active' } }, hb: ['meta-engine'], expectOk: true },
    { name: 'programs not array', bundle: { programs: 'oops' }, hb: [], expectOk: false },
    { name: 'program traversal', bundle: { programs: ['prog-../../etc/passwd'] }, hb: [], expectOk: false },
    { name: 'bad program id', bundle: { programs: ['kit-quality'] }, hb: [], expectOk: false },
    { name: 'homebase-only engine (INV-049)', bundle: { programs: ['prog-corrective'], engines: ['meta-engine'] }, hb: ['meta-engine', 'quality-judge'], expectOk: false },
    { name: 'distributable engine ok', bundle: { programs: ['prog-corrective'], engines: ['eng-engine'] }, hb: ['meta-engine'], expectOk: true },
    { name: 'engines wrong type', bundle: { programs: ['prog-corrective'], engines: 'eng-engine' }, hb: [], expectOk: false },
    { name: 'null bundle', bundle: null, hb: [], expectOk: false },
  ];
  let pass = 0, fail = 0;
  for (const c of cases) {
    const res = validateArchetypeBundle(c.bundle, { homebaseOnlyEngines: new Set(c.hb) });
    const ok = res.ok === c.expectOk;
    if (ok) { pass++; process.stdout.write(`  ok   ${c.name}\n`); }
    else { fail++; process.stdout.write(`  FAIL ${c.name} — expected ok=${c.expectOk}, got ${res.ok} (${res.errors.join('; ')})\n`); }
  }
  process.stdout.write(`\ncwos-bundle-validate self-check: ${pass} passed, ${fail} failed\n`);
  process.exit(fail === 0 ? 0 : 1);
}
