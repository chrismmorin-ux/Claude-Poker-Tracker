/**
 * reducers/sprints.js — T6:workstream sprints reducer (WS-201).
 *
 * Materializes state/sprints.json from `.claude/workstream/sprints/
 * SPR-*.yaml` on any T6:workstream event. Pragmatic filesystem-read.
 *
 * Zero external dependencies.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const { readYAMLFile, globFiles } = require('../../lib/cwos-utils');
const { classifySource } = require('../../cwos-classify');

const TRACK = 'T6:workstream';
const DOMAIN = 'sprints';
const SCHEMA_VERSION = 1;

const ITEM_FIELDS = [
  'id', 'title', 'status', 'program_focus', 'effort_summary',
  'created_at', 'approved_at', 'completed_at', 'goal',
];

// WS-262 cached fields stamped per sprint:
//   anchor_source_class — classifySource(sprint.items[0]).
//                         Single string. Consumed by /next Step 2d
//                         source-class damping.
//   last_anchor_source_classes — every sprint item's class as an array.
//                         Consumed by future cluster analysis.
const CACHED_FIELDS = ['anchor_source_class', 'last_anchor_source_classes'];

function reduce(event, allState, ctx) {
  if (!event || event.source_track !== TRACK) return undefined;
  if (!ctx || !ctx.workstreamDir) return undefined;

  const sprintsDir = path.join(ctx.workstreamDir, 'sprints');
  if (!fs.existsSync(sprintsDir)) return undefined;

  // Pre-build a wsId → source map from queue/WS-*.yaml so we can classify
  // each sprint item's source-class without reading individual queue files
  // per item. One pass of the queue directory; matches the workstream
  // reducer's filesystem-read pattern.
  const queueDir = path.join(ctx.workstreamDir, 'queue');
  const sourceByWsId = {};
  if (fs.existsSync(queueDir)) {
    for (const qf of globFiles(queueDir, 'WS-*.yaml')) {
      const qr = readYAMLFile(qf);
      if (qr.ok && qr.data && qr.data.id) {
        sourceByWsId[qr.data.id] = qr.data.source;
      }
    }
  }

  const items = {};
  const files = globFiles(sprintsDir, 'SPR-*.yaml');
  for (const f of files) {
    const r = readYAMLFile(f);
    if (!r.ok || !r.data || !r.data.id) continue;
    const d = r.data;
    const entry = {};
    for (const k of ITEM_FIELDS) if (d[k] !== undefined) entry[k] = d[k];
    // Derive item_count + items_done from the items block if present
    if (Array.isArray(d.items)) {
      entry.item_count = d.items.length;
      entry.items_done = d.items.filter((i) => i && i.status === 'done').length;
      // WS-262: stamp anchor_source_class + last_anchor_source_classes.
      // Each sprint item's source-class is classifySource of the
      // referenced WS's source field (looked up via the sourceByWsId map).
      const classes = d.items.map((i) => {
        if (!i || !i.id) return 'untagged';
        const src = sourceByWsId[i.id];
        if (src === undefined) return 'untagged';
        return classifySource({ source: src });
      });
      entry.last_anchor_source_classes = classes;
      entry.anchor_source_class = classes[0] || 'untagged';
    }
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
  for (const k of ak) { if (!(k in b)) return false; if (!itemEqual(a[k], b[k])) return false; }
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
    } else if (va !== vb) {
      return false;
    }
  }
  return true;
}

function register(registerReducer) { registerReducer(TRACK, reduce); }

module.exports = { TRACK, DOMAIN, SCHEMA_VERSION, ITEM_FIELDS, CACHED_FIELDS, reduce, register, emptyDomain };
