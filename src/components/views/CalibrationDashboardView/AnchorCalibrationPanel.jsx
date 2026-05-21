/**
 * AnchorCalibrationPanel — Anchors tab.
 *
 * Renders one row per anchor consuming `selectAllAnchorCalibrations`. Click
 * row → expand `AnchorDetailPanel` (deep-dive variant). Sort options for v1
 * are A-Z + last-fired only; the spec's `Largest model deviation` sort is
 * NOT shipped in v1 per Gate 1 audit §166 (leaderboard-temptation risk; ship
 * only after owner walkthrough).
 *
 * AP-04: no scalar score column. AP-01: default sort A-Z; no
 * "biggest-edge"-equivalent option in v1.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React, { useMemo, useState } from 'react';
import { useAnchorLibrary } from '../../../contexts/AnchorLibraryContext';
import {
  selectAllAnchorCalibrations,
  MIN_TREND_SAMPLE_SIZE,
} from '../../../utils/anchorLibrary/anchorCalibrationSelectors';
import { buildCollectingDataTrendCopy } from '../../../utils/anchorLibrary/calibrationCopy';
import { CalibrationEmptyState } from './CalibrationEmptyState';
import { AnchorDetailPanel } from './AnchorDetailPanel';

const formatPercent = (value) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return `${(value * 100).toFixed(1)}%`;
};

const formatCi = (ci) => {
  if (!ci || typeof ci.lower !== 'number' || typeof ci.upper !== 'number') return null;
  return `[${formatPercent(ci.lower)}, ${formatPercent(ci.upper)}]`;
};

const TREND_LABEL = Object.freeze({
  'collecting-data': '(collecting data)',
  stable: 'stable',
  improving: 'improving',
  drifting: 'drifting',
});

const TREND_COLOR = Object.freeze({
  'collecting-data': '#9ca3af',
  stable: '#9ca3af',
  improving: '#34d399',
  drifting: '#fbbf24',
});

const SORT_OPTIONS = Object.freeze([
  { id: 'a-z', label: 'A-Z (default)' },
  { id: 'last-fired', label: 'Last fired (recent first)' },
]);

const sortRows = (rows, anchorById, sortKey) => {
  const arr = rows.slice();
  if (sortKey === 'last-fired') {
    arr.sort((a, b) => {
      const aLast = anchorById.get(a.anchorId)?.validation?.lastFiredAt || '';
      const bLast = anchorById.get(b.anchorId)?.validation?.lastFiredAt || '';
      const ta = Date.parse(aLast);
      const tb = Date.parse(bLast);
      const aValid = !Number.isNaN(ta);
      const bValid = !Number.isNaN(tb);
      if (!aValid && !bValid) return 0;
      if (!aValid) return 1;
      if (!bValid) return -1;
      return tb - ta;
    });
  } else {
    arr.sort((a, b) => {
      const an = (a.archetypeName || '').toLowerCase();
      const bn = (b.archetypeName || '').toLowerCase();
      if (an < bn) return -1;
      if (an > bn) return 1;
      return 0;
    });
  }
  return arr;
};

export const AnchorCalibrationPanel = ({
  expandedAnchorIds,
  onToggleExpansion,
  onOverrideAction,
}) => {
  const anchorLibrary = useAnchorLibrary();
  const { selectAllAnchors, selectAllPrimitives } = anchorLibrary;
  const observationsMap = anchorLibrary?.observations || {};

  const [sortKey, setSortKey] = useState('a-z');

  const allAnchors = useMemo(
    () => (typeof selectAllAnchors === 'function' ? selectAllAnchors() : []),
    [selectAllAnchors],
  );

  const anchorById = useMemo(() => {
    const map = new Map();
    for (const a of allAnchors) {
      if (a && typeof a.id === 'string') map.set(a.id, a);
    }
    return map;
  }, [allAnchors]);

  const allPrimitives = useMemo(
    () => (typeof selectAllPrimitives === 'function' ? selectAllPrimitives() : []),
    [selectAllPrimitives],
  );

  const observations = useMemo(
    () => (observationsMap && typeof observationsMap === 'object'
      ? Object.values(observationsMap)
      : []),
    [observationsMap],
  );

  const calibrationRows = useMemo(
    () => selectAllAnchorCalibrations(allAnchors, observations),
    [allAnchors, observations],
  );

  const sortedRows = useMemo(
    () => sortRows(calibrationRows, anchorById, sortKey),
    [calibrationRows, anchorById, sortKey],
  );

  if (sortedRows.length === 0) {
    return <CalibrationEmptyState />;
  }

  return (
    <div
      data-testid="anchor-calibration-panel"
      role="tabpanel"
      aria-label="Anchor calibration"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        <label
          htmlFor="anchor-calibration-sort"
          style={{ color: '#9ca3af', fontSize: '0.75rem' }}
        >
          Sort:
        </label>
        <select
          id="anchor-calibration-sort"
          data-testid="anchor-calibration-sort"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value)}
          style={{
            background: '#1f2937',
            color: '#e5e7eb',
            border: '1px solid #374151',
            borderRadius: '0.25rem',
            padding: '0.25rem 0.5rem',
            fontSize: '0.8125rem',
          }}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
          {sortedRows.length} anchor{sortedRows.length === 1 ? '' : 's'}
        </span>
      </div>

      <ul
        data-testid="anchor-calibration-list"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {sortedRows.map((row) => {
          const anchor = anchorById.get(row.anchorId);
          if (!anchor) return null;
          const isExpanded = expandedAnchorIds && typeof expandedAnchorIds.has === 'function'
            ? expandedAnchorIds.has(row.anchorId)
            : false;
          const trendStatus = row.trend?.status || 'collecting-data';
          const trendLabel = trendStatus === 'collecting-data'
            ? buildCollectingDataTrendCopy()
            : TREND_LABEL[trendStatus] || trendStatus;
          const ciStr = formatCi(row.credibleInterval);
          const sampleBelowTrend = typeof row.sampleSize !== 'number' || row.sampleSize < MIN_TREND_SAMPLE_SIZE;

          return (
            <li
              key={row.anchorId}
              data-testid="anchor-calibration-row"
              data-anchor-id={row.anchorId}
              data-anchor-status={row.status}
            >
              <button
                type="button"
                onClick={() => {
                  if (typeof onToggleExpansion === 'function') onToggleExpansion(row.anchorId);
                }}
                aria-expanded={isExpanded}
                aria-controls={`detail-${row.anchorId}`}
                data-testid="anchor-calibration-row-toggle"
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.625rem 0.75rem',
                  background: '#1f2937',
                  color: '#e5e7eb',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                  minHeight: 44,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '0.875rem' }}>{row.archetypeName || row.anchorId}</strong>
                  <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>
                    [{row.status}]
                  </span>
                  <span style={{ flex: 1 }} />
                  <span
                    data-testid="anchor-row-trend"
                    style={{
                      fontSize: '0.75rem',
                      color: TREND_COLOR[trendStatus] || '#9ca3af',
                    }}
                  >
                    Trend: {trendLabel}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.75rem', color: '#d1d5db' }}>
                  <span>
                    <span style={{ color: '#9ca3af' }}>Predicted: </span>
                    <strong>{formatPercent(row.predictedRate)}</strong>
                  </span>
                  <span>
                    <span style={{ color: '#9ca3af' }}>Observed: </span>
                    <strong>{formatPercent(row.observedRate)}</strong>
                    {ciStr && !sampleBelowTrend && (
                      <span style={{ color: '#9ca3af' }}> {ciStr}</span>
                    )}
                  </span>
                  <span>
                    <span style={{ color: '#9ca3af' }}>Matcher firings: </span>
                    <strong>{row.sampleSizeMatcher}</strong>
                  </span>
                  <span>
                    <span style={{ color: '#9ca3af' }}>Owner-captured: </span>
                    <strong>{row.sampleSizeOwner}</strong>
                  </span>
                </div>
              </button>
              {isExpanded && (
                <div id={`detail-${row.anchorId}`}>
                  <AnchorDetailPanel
                    anchor={anchor}
                    calibration={row}
                    primitives={allPrimitives}
                    onOverrideAction={onOverrideAction}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default AnchorCalibrationPanel;
