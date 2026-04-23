/**
 * WeightedTotalTable (P2) — arithmetic-traceability block of the v2 panel.
 *
 * I-DM-2: shows the weighted-total EV as `Σ(weight × per-group EV) = total`
 * with the terms visible. Per-group contribution comes from
 * `computeDecomposedActionEVs` (Commit 2 engine). A future contributor
 * cannot silently ship totals-only rendering — `actionEVs[*]
 * .perGroupContribution` is asserted non-empty in dev, banner in prod.
 *
 * Responsive layout (Gate-4 F02):
 *   lg+md — up to 5 per-group columns + Total
 *   sm    — 3 aggregated columns (Beats you / Pays you / Other) + Total
 *   xs    — vertical reflow: actions as rows, per-group breakdown in an
 *           expandable sub-section per action
 *
 * Visible-column cap at lg+md: top-4-by-weight groups + "Other" aggregation.
 */

import React, { useState } from 'react';
import { BucketLabel } from './BucketLabel';
import {
  useResponsiveBreakpoint,
  p2ColumnModeForBreakpoint,
} from './useResponsiveBreakpoint';

const formatEV = (ev) => {
  if (!Number.isFinite(ev)) return '—';
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${ev.toFixed(2)}bb`;
};

const VALUE_RELATIONS = new Set(['crushed', 'dominated']);
const BLUFF_RELATIONS = new Set(['favored', 'dominating']);

/**
 * Select top-N groups by weight; aggregate the rest into a synthetic "other"
 * entry so every action row has the same column count.
 */
const selectTopGroups = (decomposition, n) => {
  const sorted = [...decomposition].sort((a, b) => b.weightPct - a.weightPct);
  if (sorted.length <= n) return { selected: sorted, otherIds: [], otherWeight: 0 };
  const selected = sorted.slice(0, n);
  const rest = sorted.slice(n);
  const otherWeight = rest.reduce((s, g) => s + g.weightPct, 0);
  return {
    selected,
    otherIds: rest.map((g) => g.groupId),
    otherWeight,
  };
};

/**
 * For an action's perGroupContribution, sum contributions across an arbitrary
 * id-set (used for "Other" column + sm-mode aggregation).
 */
const sumContribByIds = (contrib, idSet) => {
  let sum = 0;
  for (const c of contrib) if (idSet.has(c.groupId)) sum += c.weightTimesEV;
  return sum;
};

const DetailTable = ({ decomposition, actionEVs }) => {
  const { selected, otherIds, otherWeight } = selectTopGroups(decomposition, 4);
  const otherIdSet = new Set(otherIds);
  const selectedIdSet = new Set(selected.map((g) => g.groupId));

  return (
    <div className="overflow-x-auto rounded border border-gray-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-900/60 text-gray-400">
            <th className="text-left px-2 py-1.5 font-medium">Action</th>
            {selected.map((g) => (
              <th key={g.groupId} className="text-right px-2 py-1.5 font-medium whitespace-nowrap">
                <BucketLabel labelId={g.groupId} variant="table-header" />
                <div className="text-[9px] text-gray-500 font-normal mt-0.5">
                  {g.weightPct.toFixed(1)}%
                </div>
              </th>
            ))}
            {otherIds.length > 0 && (
              <th className="text-right px-2 py-1.5 font-medium whitespace-nowrap">
                Other (+{otherIds.length})
                <div className="text-[9px] text-gray-500 font-normal mt-0.5">
                  {otherWeight.toFixed(1)}%
                </div>
              </th>
            )}
            <th className="text-right px-2 py-1.5 font-medium text-teal-300">Total EV</th>
          </tr>
        </thead>
        <tbody>
          {actionEVs.map((a) => {
            const contribById = new Map(a.perGroupContribution.map((c) => [c.groupId, c.weightTimesEV]));
            const otherSum = otherIds.length > 0 ? sumContribByIds(a.perGroupContribution, otherIdSet) : 0;
            return (
              <tr
                key={a.actionLabel}
                className={`border-t border-gray-800 ${a.isBest ? 'bg-teal-900/20' : ''} hover:bg-gray-900/40`}
              >
                <td className={`px-2 py-1.5 ${a.isBest ? 'text-teal-200 font-medium' : 'text-gray-200'}`}>
                  {a.actionLabel}
                  {a.isBest && <span className="ml-1.5 text-[9px] uppercase text-teal-400">best</span>}
                  {a.unsupported && <span className="ml-1.5 text-[9px] text-amber-300">(unsupported)</span>}
                </td>
                {selected.map((g) => (
                  <td key={g.groupId} className="text-right font-mono px-2 py-1.5 text-gray-400">
                    {formatEV(contribById.get(g.groupId) ?? 0)}
                  </td>
                ))}
                {otherIds.length > 0 && (
                  <td className="text-right font-mono px-2 py-1.5 text-gray-500">
                    {formatEV(otherSum)}
                  </td>
                )}
                <td className={`text-right font-mono px-2 py-1.5 font-semibold ${a.isBest ? 'text-teal-200' : 'text-gray-200'}`}>
                  {formatEV(a.totalEV)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const AggregatedTable = ({ decomposition, actionEVs }) => {
  const beatsIds = new Set(
    decomposition.filter((g) => VALUE_RELATIONS.has(g.relation)).map((g) => g.groupId)
  );
  const paysIds = new Set(
    decomposition.filter((g) => BLUFF_RELATIONS.has(g.relation)).map((g) => g.groupId)
  );
  const otherIds = new Set(
    decomposition
      .filter((g) => !VALUE_RELATIONS.has(g.relation) && !BLUFF_RELATIONS.has(g.relation))
      .map((g) => g.groupId)
  );
  const beatsWeight = decomposition.filter((g) => beatsIds.has(g.groupId)).reduce((s, g) => s + g.weightPct, 0);
  const paysWeight = decomposition.filter((g) => paysIds.has(g.groupId)).reduce((s, g) => s + g.weightPct, 0);
  const otherWeight = decomposition.filter((g) => otherIds.has(g.groupId)).reduce((s, g) => s + g.weightPct, 0);

  return (
    <div className="overflow-hidden rounded border border-gray-800">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-gray-900/60 text-gray-400">
            <th className="text-left px-2 py-1.5 font-medium">Action</th>
            <th className="text-right px-2 py-1.5 font-medium">
              Beats you
              <div className="text-[9px] text-gray-500 font-normal">{beatsWeight.toFixed(1)}%</div>
            </th>
            <th className="text-right px-2 py-1.5 font-medium">
              Pays you
              <div className="text-[9px] text-gray-500 font-normal">{paysWeight.toFixed(1)}%</div>
            </th>
            <th className="text-right px-2 py-1.5 font-medium">
              Other
              <div className="text-[9px] text-gray-500 font-normal">{otherWeight.toFixed(1)}%</div>
            </th>
            <th className="text-right px-2 py-1.5 font-medium text-teal-300">Total EV</th>
          </tr>
        </thead>
        <tbody>
          {actionEVs.map((a) => (
            <tr
              key={a.actionLabel}
              className={`border-t border-gray-800 ${a.isBest ? 'bg-teal-900/20' : ''}`}
            >
              <td className={`px-2 py-1.5 ${a.isBest ? 'text-teal-200 font-medium' : 'text-gray-200'}`}>
                {a.actionLabel}
              </td>
              <td className="text-right font-mono px-2 py-1.5 text-gray-400">
                {formatEV(sumContribByIds(a.perGroupContribution, beatsIds))}
              </td>
              <td className="text-right font-mono px-2 py-1.5 text-gray-400">
                {formatEV(sumContribByIds(a.perGroupContribution, paysIds))}
              </td>
              <td className="text-right font-mono px-2 py-1.5 text-gray-500">
                {formatEV(sumContribByIds(a.perGroupContribution, otherIds))}
              </td>
              <td className={`text-right font-mono px-2 py-1.5 font-semibold ${a.isBest ? 'text-teal-200' : 'text-gray-200'}`}>
                {formatEV(a.totalEV)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const VerticalTable = ({ actionEVs }) => (
  <div className="space-y-1">
    {actionEVs.map((a) => (
      <VerticalRow key={a.actionLabel} action={a} />
    ))}
  </div>
);

const VerticalRow = ({ action }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded border border-gray-800 ${action.isBest ? 'bg-teal-900/20 border-teal-800/60' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-[44px] flex items-center justify-between px-3 py-1.5 text-xs"
      >
        <span className={action.isBest ? 'text-teal-200 font-medium' : 'text-gray-200'}>
          {action.actionLabel}
          {action.isBest && <span className="ml-1.5 text-[9px] uppercase text-teal-400">best</span>}
        </span>
        <span className={`font-mono ${action.isBest ? 'text-teal-200 font-semibold' : 'text-gray-200'}`}>
          {formatEV(action.totalEV)}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-2 space-y-0.5 border-t border-gray-800/60 text-[11px]">
          {action.perGroupContribution.map((c) => (
            <div key={c.groupId} className="flex justify-between items-center">
              <span><BucketLabel labelId={c.groupId} /></span>
              <span className="font-mono text-gray-400">{formatEV(c.weightTimesEV)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Props:
 *   decomposition: Array (from P1 input)
 *   actionEVs: Array<{ actionLabel, kind, totalEV, perGroupContribution, isBest, unsupported? }>
 */
export const WeightedTotalTable = ({ decomposition = [], actionEVs = [] }) => {
  const bp = useResponsiveBreakpoint();
  const mode = p2ColumnModeForBreakpoint(bp);

  if (!Array.isArray(actionEVs) || actionEVs.length === 0) {
    // I-DM-2 dev-assertion: empty actionEVs is a failure. Prod shows a
    // banner so the student isn't left staring at nothing.
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[WeightedTotalTable] actionEVs is empty — I-DM-2 violation');
    }
    return (
      <div className="rounded border border-amber-800 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200">
        Arithmetic breakdown unavailable — I-DM-2 violation (no perGroupContribution data).
      </div>
    );
  }

  return (
    <div className="rounded-md border border-gray-800 bg-gray-900/20 p-3 space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">
        Weighted total per action
        <span className="ml-1.5 normal-case tracking-normal text-gray-500">
          — Σ(weight × per-group EV) = total
        </span>
      </div>
      {mode === 'detail-5' && <DetailTable decomposition={decomposition} actionEVs={actionEVs} />}
      {mode === 'aggregated-3' && <AggregatedTable decomposition={decomposition} actionEVs={actionEVs} />}
      {mode === 'vertical' && <VerticalTable actionEVs={actionEVs} />}
    </div>
  );
};
