/**
 * reducers/findings.js — T6:workstream findings reducer (WS-201).
 *
 * Materializes state/findings.json from `.claude/workstream/findings/
 * FIND-*.yaml` on any T6:workstream event. Pragmatic filesystem-read
 * pattern matching the queue reducer (WS-196).
 *
 * Zero external dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { readYAMLFile, globFiles } = require('../../lib/cwos-utils');

const TRACK = 'T6:workstream';
const DOMAIN = 'findings';
const SCHEMA_VERSION = 1;

const ITEM_FIELDS = [
  'id', 'title', 'engine', 'run_id', 'date', 'severity', 'category',
  'status', 'program', 'dedup_key', 'promoted_to', 'graduated_to',
  'created_at', 'resolved_at', 'resolved_by',
  'adopter_value_relation', 'adopter_value_override_rationale', 'adopter_value_backtag',
];
const ARRAY_FIELDS = ['files_involved'];

function reduce(event, allState, ctx) {
  if (!event || event.source_track !== TRACK) return undefined;
  if (!ctx || !ctx.workstreamDir) return undefined;

  const findingsDir = path.join(ctx.workstreamDir, 'findings');
  if (!fs.existsSync(findingsDir)) return undefined;

  const items = {};
  const files = globFiles(findingsDir, 'FIND-*.yaml');
  for (const f of files) {
    const r = readYAMLFile(f);
    if (!r.ok || !r.data || !r.data.id) continue;
    const d = r.data;
    const entry = {};
    for (const k of ITEM_FIELDS) if (d[k] !== undefined) entry[k] = d[k];
    for (const k of ARRAY_FIELDS) if (Array.isArray(d[k])) entry[k] = d[k];
    items[d.id] = entry;
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
  return { schema_version: SCHEMA_VERSION, domain: DOMAIN, updated_at: null, updated_by_event: null, items: {} };
}

function itemsEqual(a, b) {
  const ak = Object.keys(a); const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (!(k in b)) return false;
    if (!itemEqual(a[k], b[k])) return false;
  }
  return true;
}
function itemEqual(a, b) {
  const ak = Object.keys(a); const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    const va = a[k], vb = b[k];
    if (Array.isArray(va) || Array.isArray(vb)) {
      if (!Array.isArray(va) || !Array.isArray(vb) || va.length !== vb.length) return false;
      for (let i = 0; i < va.length; i++) if (va[i] !== vb[i]) return false;
    } else if (va !== vb) return false;
  }
  return true;
}

function register(registerReducer) { registerReducer(TRACK, reduce); }

module.exports = { TRACK, DOMAIN, SCHEMA_VERSION, ITEM_FIELDS, ARRAY_FIELDS, reduce, register, emptyDomain };
