/**
 * AnchorFilters.jsx — filter chips + sort dropdown for AnchorLibraryView.
 *
 * Per `docs/design/surfaces/anchor-library.md` §Filter row:
 *   - 5 filter groups (Style / Street / Polarity / Tier / Status)
 *   - Multi-select within group (OR); across groups (AND)
 *   - Sort dropdown with 3 strategies; AP-01 refuses "biggest edge"
 *   - Clear filters button visible only when filters active
 *
 * Pure render; receives `view` + setters from parent (AnchorLibraryView, which
 * owns the `useAnchorLibraryView` hook). Keeps the component testable in
 * isolation without mocking localStorage.
 *
 * EAL Phase 6 — Session 19 (S19).
 */

import React from 'react';
import {
  SORT_STRATEGY_LABELS,
  VALID_SORT_STRATEGIES,
} from '../../../utils/anchorLibrary/anchorSortStrategies';
import { isFilterEmpty } from '../../../utils/anchorLibrary/librarySelectors';

// ───────────────────────────────────────────────────────────────────────────
// Filter chip enumerations (canonical order = render order)
// ───────────────────────────────────────────────────────────────────────────

const FILTER_GROUPS = [
  {
    group: 'styles',
    label: 'Style',
    options: [
      { value: 'Fish', label: 'Fish' },
      { value: 'Nit', label: 'Nit' },
      { value: 'LAG', label: 'LAG' },
      { value: 'TAG', label: 'TAG' },
    ],
  },
  {
    group: 'streets',
    label: 'Street',
    options: [
      { value: 'flop', label: 'Flop' },
      { value: 'turn', label: 'Turn' },
      { value: 'river', label: 'River' },
    ],
  },
  {
    group: 'polarities',
    label: 'Polarity',
    options: [
      { value: 'overfold', label: 'Overfold' },
      { value: 'overbluff', label: 'Overbluff' },
      { value: 'overcall', label: 'Overcall' },
      { value: 'over-raise', label: 'Over-raise' },
      { value: 'under-defend', label: 'Under-defend' },
    ],
  },
  {
    group: 'tiers',
    label: 'Tier',
    options: [
      { value: '2', label: 'Tier 2' },
      { value: '1', label: 'Tier 1 candidate' },
    ],
  },
  {
    group: 'statuses',
    label: 'Status',
    options: [
      { value: 'active', label: 'Active' },
      { value: 'expiring', label: 'Expiring' },
      { value: 'retired', label: 'Retired' },
      { value: 'suppressed', label: 'Suppressed' },
      { value: 'candidate', label: 'Candidate' },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Internal: filter chip
// ───────────────────────────────────────────────────────────────────────────

const FilterChip = ({ pressed, label, onToggle, group }) => (
  <button
    type="button"
    onClick={onToggle}
    aria-pressed={pressed}
    data-filter-group={group}
    data-filter-value={label}
    style={{
      minHeight: 36,
      padding: '0.25rem 0.75rem',
      background: pressed ? '#374151' : '#1f2937',
      color: '#e5e7eb',
      border: '1px solid ' + (pressed ? '#4b5563' : '#374151'),
      borderRadius: '999px',
      cursor: 'pointer',
      fontSize: '0.8125rem',
    }}
  >
    {label}
  </button>
);

// ───────────────────────────────────────────────────────────────────────────
// AnchorFilters
// ───────────────────────────────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.filters - { styles, streets, polarities, tiers, statuses }
 * @param {string} props.sort - one of VALID_SORT_STRATEGIES
 * @param {(group: string, value: string) => void} props.onToggleFilter
 * @param {(sort: string) => void} props.onSortChange
 * @param {() => void} props.onClearFilters
 */
export const AnchorFilters = ({
  filters,
  sort,
  onToggleFilter,
  onSortChange,
  onClearFilters,
}) => {
  const safeFilters = filters && typeof filters === 'object' ? filters : {};
  const filtersActive = !isFilterEmpty(safeFilters);

  const handleSortChange = (e) => {
    const next = e?.target?.value;
    if (typeof onSortChange === 'function' && VALID_SORT_STRATEGIES.includes(next)) {
      onSortChange(next);
    }
  };

  return (
    <section
      data-testid="anchor-filters"
      aria-label="Anchor filters"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        marginBottom: '1rem',
      }}
    >
      {FILTER_GROUPS.map(({ group, label, options }) => {
        const selected = Array.isArray(safeFilters[group]) ? safeFilters[group] : [];
        return (
          <div
            key={group}
            data-testid={`anchor-filter-group-${group}`}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.375rem',
              alignItems: 'center',
            }}
          >
            <span
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                minWidth: '4.5rem',
                marginRight: '0.25rem',
              }}
            >
              {label}:
            </span>
            {options.map((opt) => (
              <FilterChip
                key={opt.value}
                group={group}
                label={opt.label}
                pressed={selected.includes(opt.value)}
                onToggle={() => onToggleFilter && onToggleFilter(group, opt.value)}
              />
            ))}
          </div>
        );
      })}

      {/* Sort + clear-filters row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '0.5rem',
          marginTop: '0.25rem',
        }}
      >
        <label
          style={{ fontSize: '0.75rem', color: '#9ca3af', marginRight: '0.25rem' }}
          htmlFor="anchor-library-sort"
        >
          Sort:
        </label>
        <select
          id="anchor-library-sort"
          aria-label="Sort order"
          value={VALID_SORT_STRATEGIES.includes(sort) ? sort : VALID_SORT_STRATEGIES[0]}
          onChange={handleSortChange}
          style={{
            minHeight: 36,
            padding: '0.25rem 0.5rem',
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.375rem',
            fontSize: '0.8125rem',
          }}
        >
          {VALID_SORT_STRATEGIES.map((key) => (
            <option key={key} value={key}>
              {SORT_STRATEGY_LABELS[key] || key}
            </option>
          ))}
        </select>

        {filtersActive && (
          <button
            type="button"
            onClick={onClearFilters}
            data-testid="anchor-filters-clear"
            aria-label="Clear all filters"
            style={{
              minHeight: 36,
              padding: '0.25rem 0.625rem',
              background: '#1f2937',
              color: '#e5e7eb',
              border: '1px solid #374151',
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Clear filters
          </button>
        )}
      </div>
    </section>
  );
};

export default AnchorFilters;
