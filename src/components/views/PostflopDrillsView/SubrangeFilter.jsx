/**
 * SubrangeFilter — Range Lab Phase 2 (WS-057) hand-category toggle chips.
 *
 * Lets you isolate a subrange of the painted range by hand category (e.g. "just
 * the flush draws"). Selection is a Set of HAND_TYPE_GROUPS ids; an empty set
 * means "whole range". Chips render only for groups that actually have combos
 * in the current range, each labelled with the group's weighted % of the range.
 *
 * Pure presentation — no equity, no grading, no progress tracking.
 */

import React from 'react';

const pctStr = (p) => `${Math.round(p * 100)}%`;

/**
 * @param {object} props
 * @param {object} props.byGroup   handTypeBreakdown(...).byGroup
 * @param {Set<string>} props.value  selected group ids (empty = all)
 * @param {(next:Set<string>) => void} props.onChange
 */
export const SubrangeFilter = ({ byGroup, value, onChange }) => {
  const groups = Object.values(byGroup || {}).filter((g) => g.totalCount > 0);
  if (groups.length === 0) return null;

  const selected = value || new Set();
  const toggle = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  };
  const clear = () => onChange(new Set());

  return (
    <div className="bg-gray-800/40 border border-gray-800 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs uppercase tracking-wide text-gray-400">Subrange filter</span>
        <button
          type="button"
          onClick={clear}
          disabled={selected.size === 0}
          className={`text-[11px] font-semibold rounded px-2 py-0.5 border transition-colors ${
            selected.size === 0
              ? 'border-gray-800 text-gray-600 cursor-default'
              : 'border-gray-700 text-gray-300 hover:bg-gray-700'
          }`}
        >
          All hands
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const on = selected.has(g.id);
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(g.id)}
              className={`text-xs font-semibold rounded-full px-2.5 py-1 border transition-colors ${
                on
                  ? 'bg-teal-600 border-teal-500 text-white'
                  : 'bg-gray-900 border-gray-700 text-gray-300 hover:text-gray-100 hover:border-gray-600'
              }`}
            >
              {g.label}
              <span className={`ml-1.5 font-mono ${on ? 'text-teal-100' : 'text-gray-500'}`}>{pctStr(g.totalPct)}</span>
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <div className="mt-2 text-[11px] text-gray-400">
          Equity below reflects the selected subrange only.
        </div>
      )}
    </div>
  );
};
