/**
 * PrimitiveCalibrationPanel — Primitives tab.
 *
 * Renders perception-primitive validity posteriors via
 * `selectAllPrimitiveValidities`. Each row shows: primitive id, name,
 * validity posterior (point + CI), dependent-anchor count, status. Rows with
 * `status === 'invalidated'` (validity CI below the load-bearing threshold)
 * carry a visible badge; cross-anchor invalidation (I-EAL-9) is the key
 * surface here.
 *
 * No scalar score (AP-04). No ranking by validity (AP-01 — leaderboard);
 * primitives sorted alphabetically by id.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React, { useMemo } from 'react';
import { useAnchorLibrary } from '../../../contexts/AnchorLibraryContext';
import { selectAllPrimitiveValidities } from '../../../utils/anchorLibrary/anchorCalibrationSelectors';

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatCi = (ci) => {
  if (!ci || typeof ci.lower !== 'number' || typeof ci.upper !== 'number') return null;
  return `[${formatPercent(ci.lower)}, ${formatPercent(ci.upper)}]`;
};

const STATUS_LABEL = Object.freeze({
  'load-bearing': 'load-bearing',
  'at-risk': 'at-risk',
  invalidated: 'invalidated',
});

const STATUS_COLOR = Object.freeze({
  'load-bearing': '#34d399',
  'at-risk': '#fbbf24',
  invalidated: '#f87171',
});

export const PrimitiveCalibrationPanel = () => {
  const { selectAllPrimitives } = useAnchorLibrary();

  const allPrimitives = useMemo(
    () => (typeof selectAllPrimitives === 'function' ? selectAllPrimitives() : []),
    [selectAllPrimitives],
  );

  const rows = useMemo(
    () => selectAllPrimitiveValidities(allPrimitives).slice().sort((a, b) => {
      if (a.primitiveId < b.primitiveId) return -1;
      if (a.primitiveId > b.primitiveId) return 1;
      return 0;
    }),
    [allPrimitives],
  );

  if (rows.length === 0) {
    return (
      <div
        data-testid="primitive-calibration-empty"
        role="status"
        style={{
          padding: '2rem 1rem',
          textAlign: 'center',
          color: '#9ca3af',
          fontSize: '0.875rem',
        }}
      >
        Perception primitives have not yet been seeded.
      </div>
    );
  }

  return (
    <div
      data-testid="primitive-calibration-panel"
      role="tabpanel"
      aria-label="Perception primitives validity"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <ul
        data-testid="primitive-list"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {rows.map((row) => {
          const ciStr = formatCi(row.credibleInterval);
          const statusColor = STATUS_COLOR[row.status] || '#9ca3af';
          const statusLabel = STATUS_LABEL[row.status] || row.status;
          return (
            <li
              key={row.primitiveId}
              data-testid="primitive-row"
              data-primitive-id={row.primitiveId}
              data-primitive-status={row.status}
              style={{
                padding: '0.625rem 0.75rem',
                background: '#111827',
                border: '1px solid #374151',
                borderRadius: '0.375rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '0.875rem', color: '#e5e7eb' }}>{row.primitiveId}</strong>
                {row.name && (
                  <span style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>— {row.name}</span>
                )}
                <span style={{ flex: 1 }} />
                <span
                  data-testid="primitive-status-badge"
                  style={{
                    fontSize: '0.6875rem',
                    color: statusColor,
                    border: `1px solid ${statusColor}`,
                    padding: '0.0625rem 0.375rem',
                    borderRadius: '0.25rem',
                    textTransform: 'lowercase',
                  }}
                >
                  {statusLabel}
                </span>
              </div>
              <div style={{ fontSize: '0.8125rem', color: '#d1d5db' }}>
                <span style={{ color: '#9ca3af' }}>Validity posterior: </span>
                <strong>{formatPercent(row.posterior)}</strong>
                {ciStr && (
                  <span style={{ color: '#9ca3af' }}> (CI {ciStr})</span>
                )}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Dependent anchors: {row.dependentAnchorCount}
                {row.isInvalidated && row.dependentAnchorCount > 0 && (
                  <span style={{ color: '#f87171', marginLeft: '0.5rem' }}>
                    — primitive validity below threshold; dependent anchors flagged.
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default PrimitiveCalibrationPanel;
