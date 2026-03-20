/**
 * RangeProvenance.jsx - Shows how a player's range was built
 *
 * Displays provenance strip, GTO comparison, PIP deviations,
 * showdown evidence, and trait badges below the RangeGrid.
 */

import React, { useState, useMemo } from 'react';
import { PRIOR_WEIGHT } from '../../utils/rangeEngine';
import { HAND_CATEGORIES, classifyHand } from '../../utils/rangeEngine/pipCalculator';
import { rangeWidth, averageCharts, POSITION_GTO_KEYS, decodeIndex } from '../../utils/pokerCore/rangeMatrix';

const RANK_LABELS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const handLabel = (idx) => {
  const { rank1, rank2, suited, isPair } = decodeIndex(idx);
  if (isPair) return RANK_LABELS[rank1] + RANK_LABELS[rank2];
  return RANK_LABELS[rank1] + RANK_LABELS[rank2] + (suited ? 's' : 'o');
};

/**
 * Color for prior influence percentage.
 */
const priorColor = (pct) => {
  if (pct > 60) return '#ef4444'; // red
  if (pct > 40) return '#f97316'; // orange
  if (pct > 20) return '#eab308'; // yellow
  return '#22c55e'; // green
};

// =============================================================================
// 1. Provenance Strip
// =============================================================================

const ProvenanceStrip = ({ hands, observed, showdowns, priorPct }) => (
  <div className="flex items-center gap-3 text-[11px] font-medium text-gray-400">
    <span>{hands} hands</span>
    <span className="text-gray-600">|</span>
    <span>{observed} observed</span>
    <span className="text-gray-600">|</span>
    <span>{showdowns} showdown{showdowns !== 1 ? 's' : ''}</span>
    <span className="text-gray-600">|</span>
    <span>
      Prior:{' '}
      <span style={{ color: priorColor(priorPct) }} className="font-bold">
        {priorPct}%
      </span>
    </span>
  </div>
);

// =============================================================================
// 2. GTO Comparison Bar
// =============================================================================

const GtoComparisonBar = ({ playerWidth, gtoWidth, action }) => {
  const delta = playerWidth - gtoWidth;
  const maxWidth = Math.max(playerWidth, gtoWidth, 1);
  const playerPct = Math.round((playerWidth / Math.max(maxWidth, 1)) * 100);
  const gtoPct = Math.round((gtoWidth / Math.max(maxWidth, 1)) * 100);

  let deltaLabel, deltaColor;
  if (action === 'limp') {
    deltaLabel = 'GTO: 0% (limp not in GTO)';
    deltaColor = '#9ca3af';
  } else if (Math.abs(delta) <= 2) {
    deltaLabel = `(≈ GTO)`;
    deltaColor = '#9ca3af';
  } else if (delta > 0) {
    deltaLabel = `(+${delta}% wider)`;
    deltaColor = '#22c55e';
  } else {
    deltaLabel = `(${delta}% tighter)`;
    deltaColor = '#3b82f6';
  }

  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
        <span className="w-12 text-right font-medium">Player</span>
        <div className="flex-1 h-3 bg-gray-700 rounded overflow-hidden relative">
          <div
            className="h-full rounded"
            style={{
              width: `${Math.max(playerPct, 2)}%`,
              backgroundColor: 'rgba(99, 102, 241, 0.7)',
            }}
          />
        </div>
        <span className="w-8 font-mono font-bold text-gray-300">{playerWidth}%</span>
      </div>
      {action !== 'limp' && (
        <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-1">
          <span className="w-12 text-right font-medium">GTO</span>
          <div className="flex-1 h-3 bg-gray-700 rounded overflow-hidden relative">
            <div
              className="h-full rounded"
              style={{
                width: `${Math.max(gtoPct, 2)}%`,
                backgroundColor: 'rgba(234, 179, 8, 0.5)',
              }}
            />
          </div>
          <span className="w-8 font-mono font-bold text-gray-300">{gtoWidth}%</span>
        </div>
      )}
      <div className="text-[10px] text-right" style={{ color: deltaColor }}>
        {deltaLabel}
      </div>
    </div>
  );
};

// =============================================================================
// 3. PIP Deviations (collapsible)
// =============================================================================

const DEVIATION_SYMBOL = { pos: '+', neg: '-', zero: '=' };

const PipDeviations = ({ pips }) => {
  const [open, setOpen] = useState(false);

  if (!pips) return null;

  const entries = Object.entries(HAND_CATEGORIES).map(([key, { label }]) => {
    const delta = pips[key] || 0;
    return { key, label, delta };
  });

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] font-semibold text-gray-400 hover:text-gray-300 transition-colors"
      >
        Category Deviations {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {entries.map(({ key, label, delta }) => {
            let symbol, color;
            if (delta > 0) {
              symbol = '+'.repeat(Math.min(delta, 3));
              color = '#22c55e';
            } else if (delta < 0) {
              symbol = '-'.repeat(Math.min(Math.abs(delta), 3));
              color = '#ef4444';
            } else {
              symbol = '=';
              color = '#6b7280';
            }
            const tierText = delta !== 0
              ? `(${Math.abs(delta)} tier${Math.abs(delta) > 1 ? 's' : ''} ${delta > 0 ? 'wider' : 'tighter'})`
              : '(matches GTO)';
            return (
              <div key={key} className="flex items-center gap-2 text-[10px]">
                <span className="w-28 text-gray-400 truncate">{label}</span>
                <span className="w-8 font-mono font-bold text-center" style={{ color }}>{symbol}</span>
                <span className="text-gray-500">{tierText}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// 4. Showdown Evidence (collapsible)
// =============================================================================

const MAX_SHOWDOWNS = 8;

const ShowdownEvidence = ({ anchors }) => {
  const [open, setOpen] = useState(false);

  if (!anchors || anchors.length === 0) return null;

  const remaining = anchors.length - MAX_SHOWDOWNS;
  const displayed = anchors.slice(0, MAX_SHOWDOWNS);

  return (
    <div className="mt-2">
      <button
        onClick={() => setOpen(!open)}
        className="text-[11px] font-semibold text-gray-400 hover:text-gray-300 transition-colors"
      >
        Showdowns ({anchors.length}) {open ? '▾' : '▸'}
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {displayed.map((anchor, i) => {
            const label = anchor.gridIndex != null ? handLabel(anchor.gridIndex) : '??';
            const won = anchor.outcome === 'WON';
            return (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="font-mono font-bold text-gray-200 w-8">{label}</span>
                <span className="text-gray-500">{anchor.action}</span>
                <span className="text-gray-500">{anchor.position}</span>
                <span
                  className="px-1 py-0.5 rounded text-[9px] font-bold"
                  style={{
                    backgroundColor: won ? 'rgba(217, 168, 71, 0.2)' : 'rgba(107, 114, 128, 0.2)',
                    color: won ? '#d4a847' : '#9ca3af',
                  }}
                >
                  {anchor.outcome || 'SHOWN'}
                </span>
              </div>
            );
          })}
          {remaining > 0 && (
            <div className="text-[9px] text-gray-500">+{remaining} more</div>
          )}
        </div>
      )}
    </div>
  );
};

// =============================================================================
// 5. Trait Badges
// =============================================================================

const TraitBadges = ({ traits }) => {
  if (!traits) return null;

  const TRAIT_LABELS = {
    trapsPreflop: 'Traps Preflop',
    splitsRangePreflop: 'Splits Range',
    positionallyAware: 'Position Aware',
  };

  const confirmed = Object.entries(traits)
    .filter(([_, val]) => val?.confirmed === true)
    .map(([key]) => TRAIT_LABELS[key] || key);

  if (confirmed.length === 0) return null;

  return (
    <div className="flex gap-1 mt-2 flex-wrap">
      {confirmed.map((label) => (
        <span
          key={label}
          className="px-1.5 py-0.5 rounded text-[9px] font-semibold"
          style={{
            backgroundColor: 'rgba(99, 102, 241, 0.2)',
            color: '#818cf8',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          {label}
        </span>
      ))}
    </div>
  );
};

// =============================================================================
// Main Component
// =============================================================================

/**
 * @param {Object} props
 * @param {Object} props.rangeProfile - Full range profile
 * @param {Object} props.rangeSummary - Range width summary per position
 * @param {string} props.position - Current selected position (e.g. 'LATE')
 * @param {string} props.action - Current selected action (e.g. 'open')
 */
export const RangeProvenance = ({ rangeProfile, rangeSummary, position, action }) => {
  const data = useMemo(() => {
    if (!rangeProfile || !rangeSummary) return null;

    // Hands at this position
    const hands = rangeSummary[position]?.hands || 0;

    // Observed count for this action at this position
    const observed = rangeProfile.actionCounts?.[position]?.[action] || 0;

    // Showdowns for this position + action
    const showdownAnchors = (rangeProfile.showdownAnchors || []).filter(
      (a) => a.position === position && a.action === action
    );

    // Total observed actions at position (sum all action counts)
    const counts = rangeProfile.actionCounts?.[position] || {};
    const totalObserved = Object.values(counts).reduce((s, v) => s + (v || 0), 0);

    // Prior influence: PRIOR_WEIGHT / (PRIOR_WEIGHT + totalObserved)
    const priorPct = Math.round((PRIOR_WEIGHT / (PRIOR_WEIGHT + totalObserved)) * 100);

    // Player range width
    const playerRange = rangeProfile.ranges?.[position]?.[action];
    const playerWidth = playerRange ? rangeWidth(playerRange) : 0;

    // GTO range width
    let gtoWidth = 0;
    if (action === 'limp') {
      gtoWidth = 0; // limp not in GTO
    } else if (action === 'open' || action === 'fold') {
      const gtoKeys = POSITION_GTO_KEYS[position];
      if (gtoKeys) {
        const gtoRange = averageCharts(...gtoKeys);
        gtoWidth = rangeWidth(gtoRange);
      }
    } else {
      // coldCall / threeBet — no clean GTO baseline, use population prior width
      gtoWidth = 0;
    }

    // PIPs for this position
    const pips = rangeProfile.pips?.[position] || null;

    return {
      hands,
      observed,
      showdownAnchors,
      priorPct,
      playerWidth,
      gtoWidth,
      pips,
      traits: rangeProfile.traits,
    };
  }, [rangeProfile, rangeSummary, position, action]);

  if (!data) return null;

  return (
    <div className="mt-2 px-1">
      <ProvenanceStrip
        hands={data.hands}
        observed={data.observed}
        showdowns={data.showdownAnchors.length}
        priorPct={data.priorPct}
      />
      {(action === 'open' || action === 'limp') && (
        <GtoComparisonBar
          playerWidth={data.playerWidth}
          gtoWidth={data.gtoWidth}
          action={action}
        />
      )}
      <PipDeviations pips={data.pips} />
      <ShowdownEvidence anchors={data.showdownAnchors} />
      <TraitBadges traits={data.traits} />
    </div>
  );
};

export default RangeProvenance;
