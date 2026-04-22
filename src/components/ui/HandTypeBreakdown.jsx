/**
 * HandTypeBreakdown.jsx — Detailed villain range display by hand type
 *
 * Shows villain's range composition as grouped hand types summing to 100%.
 * Replaces abstract bucket display with actionable poker hand categories.
 */

import React from 'react';
import { HAND_TYPE_GROUPS, HAND_TYPE_LABELS } from '../../utils/exploitEngine/rangeSegmenter';

// ─── Colors ──────────────────────────────────────────────────────────────────
const GROUP_COLORS = {
  premium:  { bg: '#991b1b', text: '#fca5a5', bar: '#dc2626' },
  flush:    { bg: '#9a3412', text: '#fdba74', bar: '#f97316' },
  straight: { bg: '#854d0e', text: '#fde047', bar: '#eab308' },
  trips:    { bg: '#166534', text: '#86efac', bar: '#22c55e' },
  twoPair:  { bg: '#14532d', text: '#86efac', bar: '#4ade80' },
  topPair:  { bg: '#1e3a5f', text: '#93c5fd', bar: '#3b82f6' },
  midLow:   { bg: '#312e81', text: '#c4b5fd', bar: '#8b5cf6' },
  draws:    { bg: '#164e63', text: '#67e8f9', bar: '#06b6d4' },
  air:      { bg: '#1f2937', text: '#9ca3af', bar: '#6b7280' },
};

// ─── Draw info helpers ───────────────────────────────────────────────────────
const DRAW_TYPES = new Set(['comboDraw', 'nutFlushDraw', 'nonNutFlushDraw', 'oesd', 'gutshot']);

const formatDrawDetail = (ht, data) => {
  if (!DRAW_TYPES.has(ht) || !data.avgDrawOuts) return null;
  const outs = Math.round(data.avgDrawOuts);
  // Approximate hit% for 1 card (turn or river): outs/47 ≈ outs × 2.13%
  // For 2 cards (flop): 1 - ((47-outs)/47 × (46-outs)/46) ≈ outs × 4%
  const hitPct = Math.round(outs * 2.1);
  return `${outs} outs ~${hitPct}%`;
};

// ─── Component ───────────────────────────────────────────────────────────────

export const HandTypeBreakdown = ({ handTypes, totalCombos, bucketEquities, size = 'md' }) => {
  if (!handTypes || Object.keys(handTypes).length === 0) return null;

  const fontSize = size === 'sm' ? 8 : 9;
  const headerSize = size === 'sm' ? 9 : 10;

  // Group hand types into display groups
  const groups = [];
  for (const [groupKey, groupDef] of Object.entries(HAND_TYPE_GROUPS)) {
    const members = [];
    let groupPct = 0;
    let groupCount = 0;

    for (const ht of groupDef.types) {
      if (handTypes[ht]) {
        members.push({ type: ht, ...handTypes[ht] });
        groupPct += handTypes[ht].pct;
        groupCount += handTypes[ht].count;
      }
    }

    if (groupPct >= 0.5) { // Show groups with ≥0.5%
      groups.push({
        key: groupKey,
        label: groupDef.label,
        pct: groupPct,
        count: groupCount,
        members,
        color: GROUP_COLORS[groupKey],
      });
    }
  }

  return (
    <div style={{ marginBottom: 4 }}>
      {/* Header with total */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 3,
      }}>
        <span style={{ fontSize: headerSize, color: '#6b7280', fontWeight: 600 }}>
          Villain Range
        </span>
        {totalCombos > 0 && (
          <span style={{ fontSize: fontSize, color: '#4b5563' }}>
            {totalCombos} combos
          </span>
        )}
      </div>

      {/* Stacked bar (proportional width segments) */}
      <div style={{
        display: 'flex', height: 14, borderRadius: 3, overflow: 'hidden',
        background: '#111827', marginBottom: 4,
      }}>
        {groups.map(g => (
          <div
            key={g.key}
            style={{
              width: `${g.pct}%`, minWidth: g.pct > 0.5 ? 2 : 0,
              background: g.color.bar,
              borderRight: '1px solid #0d1117',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title={`${g.label}: ${Math.round(g.pct)}%`}
          >
            {g.pct >= 8 && (
              <span style={{ fontSize: 7, fontWeight: 700, color: '#fff', letterSpacing: -0.3 }}>
                {Math.round(g.pct)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Group rows */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {groups.map(g => (
          <div key={g.key} style={{
            display: 'flex', alignItems: 'baseline', gap: 4,
            padding: '1px 0',
          }}>
            {/* Group label + percentage */}
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 3,
              minWidth: 90,
            }}>
              <span style={{
                fontSize: fontSize, fontWeight: 700, color: g.color.text,
                minWidth: 28, textAlign: 'right',
              }}>
                {Math.round(g.pct)}%
              </span>
              <span style={{ fontSize: fontSize, fontWeight: 600, color: g.color.text }}>
                {g.label}
              </span>
            </div>

            {/* Sub-type detail */}
            <div style={{
              fontSize: fontSize - 1, color: '#6b7280', display: 'flex',
              flexWrap: 'wrap', gap: 2,
            }}>
              {g.members.length > 1 && g.members.map((m, i) => {
                const drawDetail = formatDrawDetail(m.type, m);
                // RT-115 — flag low-sample sub-types so the learner knows the
                // percentage is thin statistical ground, not precision.
                const lowConf = m.lowConfidence && m.count > 0;
                return (
                  <span key={m.type}>
                    {HAND_TYPE_LABELS[m.type]} {Math.round(m.pct)}%
                    {lowConf && (
                      <span
                        style={{ color: '#78716c', marginLeft: 2 }}
                        title={`Low sample: ${m.count} combo${m.count === 1 ? '' : 's'} — treat as directional, not precise`}
                      >
                        ◦
                      </span>
                    )}
                    {drawDetail && <span style={{ color: '#4b5563' }}> ({drawDetail})</span>}
                    {i < g.members.length - 1 ? ' · ' : ''}
                  </span>
                );
              })}
              {g.members.length === 1 && g.members[0].avgDrawOuts > 0 && (
                <span>
                  {formatDrawDetail(g.members[0].type, g.members[0])}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
