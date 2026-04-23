/**
 * VillainRangeDecomposition (P1) — primary teaching block of the v2 panel.
 *
 * I-DM-1: rendered above the hero view, expanded by default, cannot be
 * hidden behind a disclosure. The student sees villain's range shape as
 * their first cognitive input.
 *
 * Three rendering modes driven by `decisionKind`:
 *   - `standard` — rows sorted heaviest-first. Single list.
 *   - `bluff-catch` — polar split: VALUE REGION (crushed/dominated) above
 *     divider, BLUFF REGION (favored/dominating) below. Sub-totals show
 *     directly so the "call-or-fold" math is visible.
 *   - `thin-value` — beat-vs-pay split: HANDS THAT BEAT YOU / HANDS THAT
 *     PAY YOU with sub-totals.
 *
 * Responsive row cap: 6 / 4 / 3 at lg+md / sm / xs viewports (Gate-4 F02).
 *
 * Column-header archetype-invariance note (Gate-4 product-UX F-archetype):
 * weightPct is base-range-based; archetype only shifts fold rates (which
 * flow into P2's totals), not range composition. The column header carries
 * an explicit annotation so students don't read "Fish → 45%" as archetype-
 * reweighted.
 */

import React, { useState } from 'react';
import { BucketLabel } from './BucketLabel';
import {
  useResponsiveBreakpoint,
  p1RowCapForBreakpoint,
} from './useResponsiveBreakpoint';
import { RELATION_STYLE } from './panelHelpers';

const VALUE_RELATIONS = new Set(['crushed', 'dominated']);
const BLUFF_RELATIONS = new Set(['favored', 'dominating']);

const DecompositionRow = ({ row }) => {
  const style = RELATION_STYLE[row.relation] || RELATION_STYLE.neutral;
  return (
    <div className="flex items-center justify-between gap-3 text-[11px] py-1.5 border-b border-gray-800/50 last:border-b-0">
      <div className="flex items-center gap-2 min-w-[180px] flex-wrap">
        <span
          className={`px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide font-semibold border ${style.color} ${style.bg} ${style.border}`}
        >
          {style.label}
        </span>
        <span className="text-gray-200">
          <BucketLabel labelId={row.groupId} />
        </span>
      </div>
      <div className="flex items-center gap-4 text-gray-500 font-mono flex-1 justify-end">
        <span>{row.weightPct.toFixed(1)}%</span>
        <span className={style.color}>{(row.heroEquity * 100).toFixed(0)}% eq</span>
      </div>
    </div>
  );
};

const SectionHeader = ({ label, sub, weightPct, accentClass = 'text-gray-400' }) => (
  <div className={`flex items-baseline justify-between pt-1 pb-0.5 text-[10px] uppercase tracking-wide font-semibold ${accentClass}`}>
    <span>
      {label}
      {sub && <span className="ml-1.5 text-gray-500 normal-case tracking-normal">{sub}</span>}
    </span>
    {typeof weightPct === 'number' && (
      <span className="font-mono normal-case tracking-normal">{weightPct.toFixed(1)}% of range</span>
    )}
  </div>
);

const renderStandard = ({ rows, rowCap, expanded, setExpanded }) => {
  const visibleRows = expanded ? rows : rows.slice(0, rowCap);
  const overflow = rows.length - visibleRows.length;
  return (
    <>
      {visibleRows.map((row) => <DecompositionRow key={row.groupId} row={row} />)}
      {overflow > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="w-full min-h-[44px] text-[11px] text-teal-300 hover:text-teal-200 underline py-1 text-left"
        >
          Show all {rows.length} groups (+{overflow} more)
        </button>
      )}
    </>
  );
};

const renderPolar = ({ rows, labels, valueFilter, bluffFilter }) => {
  const valueRows = rows.filter((r) => valueFilter.has(r.relation));
  const bluffRows = rows.filter((r) => bluffFilter.has(r.relation));
  const neutralRows = rows.filter(
    (r) => !valueFilter.has(r.relation) && !bluffFilter.has(r.relation)
  );
  const valueW = valueRows.reduce((s, r) => s + r.weightPct, 0);
  const bluffW = bluffRows.reduce((s, r) => s + r.weightPct, 0);
  const neutralW = neutralRows.reduce((s, r) => s + r.weightPct, 0);

  return (
    <>
      <SectionHeader
        label={labels.value}
        sub="(villain beats you)"
        weightPct={valueW}
        accentClass="text-rose-300"
      />
      {valueRows.length > 0
        ? valueRows.map((row) => <DecompositionRow key={row.groupId} row={row} />)
        : <div className="text-[11px] text-gray-500 italic py-1">none in this range</div>}

      <SectionHeader
        label={labels.bluff}
        sub="(you beat)"
        weightPct={bluffW}
        accentClass="text-teal-300"
      />
      {bluffRows.length > 0
        ? bluffRows.map((row) => <DecompositionRow key={row.groupId} row={row} />)
        : <div className="text-[11px] text-gray-500 italic py-1">none in this range</div>}

      {neutralRows.length > 0 && (
        <>
          <SectionHeader
            label="Close"
            sub="(roughly coin-flip)"
            weightPct={neutralW}
            accentClass="text-amber-300"
          />
          {neutralRows.map((row) => <DecompositionRow key={row.groupId} row={row} />)}
        </>
      )}
    </>
  );
};

/**
 * Props:
 *   decomposition: Array<{ groupId, groupLabel, weightPct, heroEquity, relation, comboCount }>
 *   decisionKind: 'standard' | 'bluff-catch' | 'thin-value'
 *   archetype: string — for the column-header annotation
 */
export const VillainRangeDecomposition = ({
  decomposition = [],
  decisionKind = 'standard',
  archetype = 'reg',
}) => {
  const bp = useResponsiveBreakpoint();
  const rowCap = p1RowCapForBreakpoint(bp);
  const [expanded, setExpanded] = useState(false);

  if (!Array.isArray(decomposition) || decomposition.length === 0) {
    return (
      <div className="rounded border border-gray-800 bg-gray-900/30 px-3 py-2 text-[11px] text-gray-500 italic">
        No villain-range decomposition available for this node.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-teal-800/60 bg-teal-900/10 p-3 space-y-1">
      <div className="flex items-baseline justify-between pb-1 border-b border-gray-800/70">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-teal-300/90">
            Villain's range vs you
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">
            Weight% is base-range — unaffected by archetype · Equity and fold rates shift with archetype
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          vs {archetype}
        </div>
      </div>

      {decisionKind === 'bluff-catch' && renderPolar({
        rows: decomposition,
        labels: { value: 'Value region', bluff: 'Bluff region' },
        valueFilter: VALUE_RELATIONS,
        bluffFilter: BLUFF_RELATIONS,
      })}

      {decisionKind === 'thin-value' && renderPolar({
        rows: decomposition,
        labels: { value: 'Hands that beat you', bluff: 'Hands that pay you' },
        valueFilter: VALUE_RELATIONS,
        bluffFilter: BLUFF_RELATIONS,
      })}

      {(decisionKind === 'standard' || !['bluff-catch', 'thin-value'].includes(decisionKind)) && renderStandard({
        rows: decomposition,
        rowCap,
        expanded,
        setExpanded,
      })}
    </div>
  );
};
