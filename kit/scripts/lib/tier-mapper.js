/**
 * tier-mapper.js — shared library for archetype + stage + override tier resolution.
 *
 * Consumed by:
 *   - kit/scripts/cwos-adopt-archetype.js  (WS-250 — bundle resolver)
 *   - kit/scripts/cwos-stage.js            (WS-251, future — re-tier on stage transition)
 *   - kit/scripts/cwos-pulse.js            (future — health-recompute reads tier map)
 *   - kit/scripts/cwos-audit.js            (future — flag tier mismatches)
 *
 * Contracts (load-bearing):
 *   1. Pure functions. No filesystem writes. Reads only kit/data/{archetypes,stages}.yaml.
 *   2. Tier resolution order (later wins):
 *        stage default  →  archetype tier_overrides[stage]  →  founder archetype_overrides.tiers
 *      The founder override is final per ADR-035 Stage 4 condition #2.
 *   3. Opt-out semantics: any program in archetype_overrides.programs with
 *      status === "opted-out" is removed from the install set BEFORE tier
 *      mapping runs. Tier overrides for opted-out programs are silently
 *      discarded (no error — founder may opt out then later opt back in).
 *   4. Unknown archetype/stage IDs throw. Caller decides whether to swallow.
 */

const fs = require('fs');
const path = require('path');
const { readYAMLFile } = require('./cwos-utils.js');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const ARCHETYPES_PATH = path.join(DATA_DIR, 'archetypes.yaml');
const STAGES_PATH = path.join(DATA_DIR, 'stages.yaml');

const VALID_TIERS = new Set(['dormant', 'watch', 'active', 'critical']);

let _archetypesCache = null;
let _stagesCache = null;

function loadArchetypes() {
  if (_archetypesCache) return _archetypesCache;
  const r = readYAMLFile(ARCHETYPES_PATH);
  if (!r.ok) throw new Error(`tier-mapper: cannot read ${ARCHETYPES_PATH}: ${r.error}`);
  _archetypesCache = r.data || {};
  return _archetypesCache;
}

function loadStages() {
  if (_stagesCache) return _stagesCache;
  const r = readYAMLFile(STAGES_PATH);
  if (!r.ok) throw new Error(`tier-mapper: cannot read ${STAGES_PATH}: ${r.error}`);
  _stagesCache = r.data || {};
  return _stagesCache;
}

function clearCache() {
  _archetypesCache = null;
  _stagesCache = null;
}

function findArchetype(archetypeId) {
  const data = loadArchetypes();
  if (archetypeId === 'NONE' || archetypeId === 'default_no_archetype') {
    return data.default_no_archetype || { id: 'NONE', programs: [], engines: [], personas: [], tier_overrides: {} };
  }
  const list = Array.isArray(data.archetypes) ? data.archetypes : [];
  const found = list.find((a) => a && a.id === archetypeId);
  if (!found) throw new Error(`tier-mapper: unknown archetype "${archetypeId}"`);
  return found;
}

function findStage(stageId) {
  const data = loadStages();
  const commercial = Array.isArray(data.stages) ? data.stages : [];
  const nonCommercial = Array.isArray(data.non_commercial_stages) ? data.non_commercial_stages : [];

  const direct = commercial.find((s) => s && s.id === stageId);
  if (direct) return { stage: direct, source: 'commercial' };

  const nc = nonCommercial.find((s) => s && s.id === stageId);
  if (nc) {
    // Non-commercial stages map to commercial stage(s) for tier resolution.
    // Per stages.yaml#N2.rationale: when maps_to has multiple, take the LATER
    // stage to ensure full operating-tier protections.
    const mapsTo = Array.isArray(nc.maps_to) ? nc.maps_to : [];
    const targetId = mapsTo.length > 0 ? mapsTo[mapsTo.length - 1] : null;
    const target = targetId ? commercial.find((s) => s && s.id === targetId) : null;
    if (!target) throw new Error(`tier-mapper: non-commercial stage "${stageId}" maps_to "${targetId}" but commercial stage not found`);
    return { stage: target, source: 'non_commercial', original: nc };
  }

  throw new Error(`tier-mapper: unknown stage "${stageId}"`);
}

/**
 * stageDefaultTierFor(stage, programId) — pick the right per-stage default for a program.
 * Most programs use stage.archetype_default_tier. Stage-defined per-class overrides
 * (S3's archetype_compliance_tier, archetype_security_tier) apply to a fixed set.
 */
function stageDefaultTierFor(stage, programId) {
  const COMPLIANCE_PROGS = new Set(['prog-compliance', 'prog-vendor-risk']);
  const SECURITY_PROGS = new Set(['prog-security']);
  if (stage.archetype_compliance_tier && COMPLIANCE_PROGS.has(programId)) return stage.archetype_compliance_tier;
  if (stage.archetype_security_tier && SECURITY_PROGS.has(programId)) return stage.archetype_security_tier;
  return stage.archetype_default_tier || 'dormant';
}

/**
 * mapTiers(archetypeId, stageId, overrides, programIds) → { [programId]: tier }
 *
 * Resolution order (later wins):
 *   1. Stage default tier (per stage class: default / compliance / security)
 *   2. Archetype tier_overrides[stageId][programId]
 *   3. Founder archetype_overrides.tiers[].program_id match
 */
function mapTiers(archetypeId, stageId, overrides, programIds) {
  if (!Array.isArray(programIds)) throw new Error('tier-mapper: programIds must be an array');
  const archetype = findArchetype(archetypeId);
  const { stage } = findStage(stageId);

  const archetypeOverrides = (archetype.tier_overrides && typeof archetype.tier_overrides === 'object') ? archetype.tier_overrides : {};
  const founderTierOverrides = (overrides && Array.isArray(overrides.tiers)) ? overrides.tiers : [];
  const founderByProg = {};
  for (const t of founderTierOverrides) {
    if (!t || typeof t !== 'object' || !t.program_id) continue;
    if (!VALID_TIERS.has(t.override_tier)) continue;
    founderByProg[t.program_id] = t.override_tier;
  }

  const out = {};
  for (const progId of programIds) {
    let tier = stageDefaultTierFor(stage, progId);

    const archProgOverrides = archetypeOverrides[progId];
    if (archProgOverrides && typeof archProgOverrides === 'object' && archProgOverrides[stageId]) {
      tier = archProgOverrides[stageId];
    } else if (archProgOverrides && typeof archProgOverrides === 'object' && stage.id !== stageId) {
      // stageId may be N2 mapping to S4 — also check the original stageId key.
      if (archProgOverrides[stage.id]) tier = archProgOverrides[stage.id];
    }

    if (founderByProg[progId]) tier = founderByProg[progId];
    out[progId] = tier;
  }
  return out;
}

/**
 * applyProgramOptOuts(programIds, overrides) → filteredProgramIds
 *
 * Removes any programId whose archetype_overrides.programs entry has
 * status === "opted-out". Unknown override entries (programId not in
 * the input set) are silently ignored.
 */
function applyProgramOptOuts(programIds, overrides) {
  if (!Array.isArray(programIds)) return [];
  const optOuts = new Set();
  if (overrides && Array.isArray(overrides.programs)) {
    for (const p of overrides.programs) {
      if (p && typeof p === 'object' && p.status === 'opted-out' && p.id) {
        optOuts.add(p.id);
      }
    }
  }
  return programIds.filter((id) => !optOuts.has(id));
}

/**
 * applyTierOverrides(tierMap, overrides) → tierMap
 *
 * Pure overlay of founder overrides on an existing tier map. Provided as a
 * standalone helper for callers that already have a tier map and want to
 * apply overrides without re-resolving from archetype/stage data.
 */
function applyTierOverrides(tierMap, overrides) {
  const out = Object.assign({}, tierMap || {});
  if (!overrides || !Array.isArray(overrides.tiers)) return out;
  for (const t of overrides.tiers) {
    if (!t || typeof t !== 'object' || !t.program_id) continue;
    if (!VALID_TIERS.has(t.override_tier)) continue;
    if (out[t.program_id] !== undefined) out[t.program_id] = t.override_tier;
  }
  return out;
}

module.exports = {
  mapTiers,
  applyProgramOptOuts,
  applyTierOverrides,
  findArchetype,
  findStage,
  stageDefaultTierFor,
  clearCache,
  // Exposed for cwos-adopt-archetype.js and tests.
  _internal: { loadArchetypes, loadStages },
};
