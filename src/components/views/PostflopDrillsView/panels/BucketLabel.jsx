/**
 * BucketLabel — shared label component used by P1 / P2 / P6b in the v2
 * BucketEVPanel composition.
 *
 * Gate-4 F01/F14 compliance (from 2026-04-22-heuristic-bucket-ev-panel-v2
 * audit): every bucket/group label in the panel must
 *   1. render its human-readable displayName (not the code-id),
 *   2. offer inline tap-for-definition (popover) scoped to the currently-
 *      rendered label,
 *   3. have a minimum 44 DOM-px tap target (wrap the text in a padded
 *      button so `useScale`-compressed viewports still meet H-ML06).
 *
 * Looks up displayName + definition from two sources:
 *   - `dominationGroupMetaFor(id)` — for DOMINATION_GROUPS ids like
 *     `overcardsAx`, `pairPlusFD`, `tpStrong`.
 *   - `displayNameForBucket(id)` + `definitionForBucket(id)` — for
 *     BUCKET_TAXONOMY ids referenced in `bucketCandidates` like
 *     `topPair`, `flushDraw`, `air`.
 *
 * Falls back to the raw id when neither source has the label — keeps
 * future-taxonomy additions visible rather than silent.
 */

import React, { useState, useRef, useEffect } from 'react';
import { dominationGroupMetaFor } from '../../../../utils/postflopDrillContent/drillModeEngine';
import {
  displayNameForBucket,
  definitionForBucket,
} from '../../../../utils/postflopDrillContent/bucketTaxonomy';

/**
 * Resolve `{ displayName, definition }` from a label id, checking domination
 * groups first (finer-grained taxonomy) and falling back to bucket taxonomy.
 */
const resolveLabelMeta = (labelId) => {
  const dg = dominationGroupMetaFor(labelId);
  if (dg) {
    return { displayName: dg.label, definition: dg.definition || null };
  }
  return {
    displayName: displayNameForBucket(labelId) || labelId,
    definition: definitionForBucket(labelId),
  };
};

export const BucketLabel = ({ labelId, className = '', variant = 'inline' }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const { displayName, definition } = resolveLabelMeta(labelId);

  // Close on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (btnRef.current && !btnRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Tap-target sizing: the clickable box is the padded button. Padding is
  // measured in DOM-px so `useScale`-compressed viewports still meet the
  // H-ML06 ≥44 DOM-px rule (a scale=0.5 visual target is 22px but the DOM
  // size remains 44px, which is what touch hit-testing uses).
  const variantClass =
    variant === 'table-header'
      ? 'inline-flex items-center min-h-[44px] min-w-[44px] px-1 py-1 hover:text-gray-200 transition-colors font-medium'
      : 'inline-flex items-center min-h-[44px] min-w-[44px] px-1 py-1 hover:text-gray-200 transition-colors';

  const disabled = !definition;

  return (
    <span className="relative inline-block" ref={btnRef}>
      <button
        type="button"
        onClick={disabled ? undefined : () => setOpen((v) => !v)}
        className={`${variantClass} ${className} ${disabled ? 'cursor-default' : 'cursor-help'}`}
        title={definition || displayName}
        aria-describedby={open ? `bucket-tip-${labelId}` : undefined}
      >
        {displayName}
        {!disabled && (
          <span className="ml-1 text-[9px] text-gray-500 select-none" aria-hidden="true">ⓘ</span>
        )}
      </button>
      {open && definition && (
        <span
          id={`bucket-tip-${labelId}`}
          role="tooltip"
          className="absolute z-20 left-0 top-full mt-1 w-64 px-2.5 py-2 text-[11px] text-gray-100 bg-gray-900 border border-gray-700 rounded shadow-lg leading-snug"
        >
          <span className="block font-semibold text-gray-100 mb-0.5">{displayName}</span>
          <span className="block text-gray-300">{definition}</span>
        </span>
      )}
    </span>
  );
};
