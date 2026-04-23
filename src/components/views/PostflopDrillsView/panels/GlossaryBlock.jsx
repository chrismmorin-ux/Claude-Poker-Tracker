/**
 * GlossaryBlock (P6b) — first-class bucket-label glossary for the v2
 * BucketEVPanel composition.
 *
 * Gate-4 F01 resolution (from 2026-04-22-heuristic-bucket-ev-panel-v2
 * audit): the v1 approach (no glossary; students expected to know
 * `topPairGood` / `pairPlusFD` / `overcardsAx` from context) fails
 * H-N06 (recognition-not-recall) for the Apprentice + first-principles-
 * learner personas. This primitive bridges the vocabulary gap:
 *
 *   - Collapsed-by-default 1-line affordance at the bottom of the panel.
 *   - Expanded: 2-column list of {displayName, definition} for every
 *     label rendered on the current node. Scoped — doesn't dump the full
 *     31-entry taxonomy; only what the student can see above.
 *
 * Accepts an array of labelIds; looks up each via the shared BucketLabel
 * resolver (domination groups first, bucket taxonomy fallback).
 */

import React, { useState } from 'react';
import { dominationGroupMetaFor } from '../../../../utils/postflopDrillContent/drillModeEngine';
import {
  displayNameForBucket,
  definitionForBucket,
} from '../../../../utils/postflopDrillContent/bucketTaxonomy';

const resolveEntry = (labelId) => {
  const dg = dominationGroupMetaFor(labelId);
  if (dg) {
    return {
      id: labelId,
      displayName: dg.label,
      definition: dg.definition || null,
    };
  }
  return {
    id: labelId,
    displayName: displayNameForBucket(labelId) || labelId,
    definition: definitionForBucket(labelId),
  };
};

export const GlossaryBlock = ({ labelIds = [] }) => {
  const [open, setOpen] = useState(false);
  // Dedup + filter labels with no definition — no point showing "topPairGood
  // (no definition)" rows. When a definition IS missing, surface it in dev
  // to prompt the content author.
  const seen = new Set();
  const entries = [];
  for (const id of labelIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const entry = resolveEntry(id);
    if (entry.definition) entries.push(entry);
    // Silently skip entries with no definition — dev-mode warn to nudge
    // content authors without disturbing prod render.
    else if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[GlossaryBlock] no definition for label '${id}' — add to BUCKET_DEFINITIONS or DOMINATION_GROUPS`);
    }
  }

  if (entries.length === 0) return null;

  return (
    <div className="border border-gray-800 rounded bg-gray-900/30">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] flex items-center justify-between px-3 py-1.5 text-[11px] text-gray-400 hover:text-gray-200"
      >
        <span>
          Bucket definitions
          <span className="ml-1.5 text-gray-600">
            ({entries.length} label{entries.length === 1 ? '' : 's'} on this node)
          </span>
        </span>
        <span className="text-gray-600">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <dl className="px-3 pb-2 pt-1 space-y-2 text-[11px] leading-snug">
          {entries.map((e) => (
            <div key={e.id} className="flex flex-col sm:flex-row gap-x-3 border-b border-gray-800/50 pb-1.5 last:border-b-0 last:pb-0">
              <dt className="text-gray-200 font-medium min-w-[160px]">{e.displayName}</dt>
              <dd className="text-gray-400 flex-1">{e.definition}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};
