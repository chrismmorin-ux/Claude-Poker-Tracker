/**
 * reducers/vital-signs.js — T11:vital-signs reducer (WS-197, ADR-020 Phase A).
 *
 * Materializes state/programs.json from `.claude/workstream/programs/
 * prog-*.yaml` + `registry.yaml` on T11:vital-signs events. Preserves
 * the existing health-score formula by calling out to cwos-score.js's
 * computeHealthScore (option a — locked at SPR-062 approval; cwos-
 * score.js retires in a later sprint once the reducer is proven).
 *
 * Same pragmatic filesystem-read pattern as the workstream reducer:
 * reducer reacts to T11:vital-signs events by re-reading program
 * files and materializing the state snapshot. Replay-pure under
 * "state = reducer(events + filesystem)".
 *
 * Zero external dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { readYAMLFile, globFiles } = require('../../lib/cwos-utils');

const TRACK = 'T11:vital-signs';
const DOMAIN = 'programs';
const SCHEMA_VERSION = 1;

// WS-208: health formula lives in core/health-scoring (extracted from
// cwos-score). The reducer now computes health inline per dispatch
// rather than reading pre-computed values, making state/programs.json
// reflect current findings/protocols immediately.
let _healthMod = null;
function _loadHealthScoring() {
  if (_healthMod === null) {
    try { _healthMod = require('../health-scoring'); }
    catch { _healthMod = false; }
  }
  return _healthMod || null;
}
// Preserved for backward compat with any existing importer of _loadScore.
const _loadScore = _loadHealthScoring;

// Fields materialized per program. Mirrors the registry.yaml + prog-*.yaml
// shape so /pulse + /status can migrate to the typed API without
// shape translation.
const REGISTRY_FIELDS = [
  'id', 'name', 'status', 'tier', 'health_score', 'health_ceiling',
  'last_run_date', 'founder_priority', 'monitor_only',
];
const PROG_FIELDS = [
  'id', 'name', 'tier', 'status', 'health_score', 'health_ceiling',
  'health_updated_at', 'last_run_date', 'block_sprint', 'monitor_only',
  // WS-350: surface accountability caps + live breach state so /pulse and
  // /next can read them from state/programs.json without touching YAMLs.
  'findings_open', 'work_items_open',
];
const ARRAY_FIELDS = ['blocks', 'problem_classes'];
// WS-350: nested objects (accountability block + cap_breach diagnostic) are
// preserved as-is rather than field-flattened, so /next can read
// accountability.on_finding.priority_floor directly.
const OBJECT_FIELDS = ['accountability', 'cap_breach'];

function reduce(event, allState, ctx) {
  if (!event || event.source_track !== TRACK) return undefined;
  if (!ctx || !ctx.workstreamDir) return undefined;

  const programsDir = path.join(ctx.workstreamDir, 'programs');
  if (!fs.existsSync(programsDir)) return undefined;

  // Start with registry.yaml as the tier-of-truth for active programs
  const registryPath = path.join(programsDir, 'registry.yaml');
  const registryData = fs.existsSync(registryPath) ? readYAMLFile(registryPath) : { ok: false };
  const registryByIdBase = {};
  if (registryData.ok && Array.isArray(registryData.data.programs)) {
    for (const p of registryData.data.programs) {
      if (!p || !p.id) continue;
      const entry = {};
      for (const k of REGISTRY_FIELDS) if (p[k] !== undefined) entry[k] = p[k];
      registryByIdBase[p.id] = entry;
    }
  }

  // Overlay each prog-*.yaml: program files are more detailed (include
  // health_breakdown and per-protocol run history). Registry tier wins
  // if both define it (registry is authoritative for activation state).
  const items = {};
  const files = globFiles(programsDir, 'prog-*.yaml').filter((f) => !f.endsWith('prog-template.yaml'));
  for (const f of files) {
    const r = readYAMLFile(f);
    if (!r.ok || !r.data || !r.data.id) continue;
    const d = r.data;
    const entry = Object.assign({}, registryByIdBase[d.id] || {});
    for (const k of PROG_FIELDS) if (d[k] !== undefined) entry[k] = d[k];
    for (const k of ARRAY_FIELDS) if (Array.isArray(d[k])) entry[k] = d[k];
    for (const k of OBJECT_FIELDS) if (d[k] && typeof d[k] === 'object') entry[k] = d[k];
    // Registry tier / status are authoritative when present
    if (registryByIdBase[d.id]) {
      if (registryByIdBase[d.id].tier !== undefined) entry.tier = registryByIdBase[d.id].tier;
      if (registryByIdBase[d.id].status !== undefined) entry.status = registryByIdBase[d.id].status;
    }
    // Preserve health_breakdown as a nested object if present
    if (d.health_breakdown && typeof d.health_breakdown === 'object') {
      entry.health_breakdown = d.health_breakdown;
    }

    // WS-208: compute health inline per dispatch so state/programs.json
    // reflects the current findings corpus, not whatever cwos-score
    // last wrote to prog-*.yaml. Falls back to the stored value if
    // health-scoring module is unavailable.
    const hm = _loadHealthScoring();
    if (hm && hm.computeHealthScore) {
      try {
        const findingsIndex = hm.loadFindingsIndex(ctx.workstreamDir);
        const today = new Date().toISOString().slice(0, 10);
        const computed = hm.computeHealthScore(d, findingsIndex, today);
        if (computed && typeof computed.score === 'number') {
          entry.health_score = computed.score;
          entry.health_ceiling = computed.ceiling;
          entry.health_breakdown = {
            finding_health: computed.findingHealth,
            protocol_currency: computed.protocolCurrency,
            problem_class_coverage: computed.coverage,
            maturity_progress: computed.maturityProgress,
            hard_caps_applied: computed.capsApplied || [],
          };
        }
      } catch { /* fall through to stored values */ }
    }

    items[d.id] = entry;
  }

  // Also include programs that are in the registry but have no prog-*.yaml
  // file yet (e.g., dormant stubs) so /pulse shows the full landscape.
  for (const [id, entry] of Object.entries(registryByIdBase)) {
    if (!(id in items)) items[id] = entry;
  }

  // WS-262: back-stamp engine_history_count from the engines domain so
  // every program (not just the one whose engine_run_completed event
  // most recently fired) reports an accurate count. The engines.js
  // reducer also stamps this field cross-domain on T7 events; the back-
  // stamp here closes the gap for migrations + new programs.
  const enginesItems = (allState.engines && allState.engines.items) || {};
  for (const id of Object.keys(items)) {
    const entry = enginesItems[id];
    items[id].engine_history_count =
      entry && Array.isArray(entry.runs) ? entry.runs.length : 0;
  }

  const priorDomain = allState[DOMAIN] || emptyDomain();
  const nextDomain = {
    schema_version: SCHEMA_VERSION,
    domain: DOMAIN,
    updated_at: event.timestamp || (ctx && ctx.timestamp) || null,
    updated_by_event: event.id || null,
    items,
  };

  if (itemsEqual(priorDomain.items || {}, items)) return undefined;
  return { [DOMAIN]: nextDomain };
}

function emptyDomain() {
  return {
    schema_version: SCHEMA_VERSION,
    domain: DOMAIN,
    updated_at: null,
    updated_by_event: null,
    items: {},
  };
}

function itemsEqual(a, b) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!(k in b)) return false;
    if (!itemEqual(a[k], b[k])) return false;
  }
  return true;
}

function itemEqual(a, b) {
  // Shallow equality over scalar + array + one-level-nested-object fields.
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const va = a[k], vb = b[k];
    if (Array.isArray(va) || Array.isArray(vb)) {
      if (!Array.isArray(va) || !Array.isArray(vb) || va.length !== vb.length) return false;
      for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false;
    } else if (va && typeof va === 'object') {
      // Nested object (e.g., health_breakdown): stringify-compare
      if (JSON.stringify(va) !== JSON.stringify(vb)) return false;
    } else if (va !== vb) {
      return false;
    }
  }
  return true;
}

function register(registerReducer) {
  registerReducer(TRACK, reduce);
}

module.exports = {
  TRACK,
  DOMAIN,
  SCHEMA_VERSION,
  REGISTRY_FIELDS,
  PROG_FIELDS,
  ARRAY_FIELDS,
  reduce,
  register,
  emptyDomain,
  _loadScore,
};
