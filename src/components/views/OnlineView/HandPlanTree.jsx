/**
 * HandPlanTree.jsx — Branch guidance for the rest of the hand
 *
 * Shows what to do if villain calls, raises, bets, checks, or on the next street.
 * Each branch has a colored left border, label, action note, and runout detail.
 * Extracted from LiveRecommendations for reuse in both old and new UI.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, GOLD, R } from './panelTokens';

const BRANCH_COLORS = {
  ifCall:          '#2563eb',
  ifRaise:         '#ea580c',
  ifVillainBets:   '#ea580c',
  ifVillainChecks: '#0891b2',
  nextStreet:      GOLD.base,
};

const BRANCH_LABELS = {
  ifCall:          'If they call',
  ifRaise:         'If they raise',
  ifVillainBets:   'If villain bets',
  ifVillainChecks: 'If villain checks',
  nextStreet:      'Next street',
};

// Runout quality bar (favorable vs total)
const RunoutBar = ({ favorable, total, scaryCards }) => {
  if (!total || total === 0) return null;
  const pct = Math.round((favorable / total) * 100);
  const barColor = pct >= 60 ? COLOR.green : pct >= 40 ? COLOR.yellow : COLOR.red;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
      <div style={{
        width: 50, height: 4, borderRadius: 2, overflow: 'hidden',
        background: SURFACE.inset,
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 2,
          background: barColor,
          transition: 'width 0.5s ease',
        }} />
      </div>
      <span style={{ fontFamily: FONT.mono, fontSize: 8, color: TEXT.faint }}>
        {favorable}/{total} favorable
        {scaryCards > 0 && ` · ${scaryCards} scary`}
      </span>
    </div>
  );
};

export const HandPlanTree = ({ handPlan, street }) => {
  if (!handPlan || Object.keys(handPlan).length === 0) return null;
  const isRiver = street === 'river';

  const branches = [];

  const addBranch = (key) => {
    const p = handPlan[key];
    if (!p) return;
    branches.push({
      key,
      label: BRANCH_LABELS[key],
      color: BRANCH_COLORS[key],
      note: p.note,
      plan: p.plan,
      favorableRunouts: p.favorableRunouts,
      totalRunouts: p.totalRunouts,
      scaryCards: p.scaryCards,
      showRunouts: !isRiver && key !== 'ifRaise' && p.totalRunouts > 0,
    });
  };

  addBranch('ifCall');
  addBranch('ifRaise');
  addBranch('ifVillainBets');
  addBranch('ifVillainChecks');
  addBranch('nextStreet');

  if (branches.length === 0) return null;

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        fontSize: 9, color: TEXT.faint, marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600,
      }}>
        Hand Plan
      </div>

      {branches.map((b, i) => (
        <div key={b.key} style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          padding: '4px 0 4px 8px',
          borderLeft: `2px solid ${b.color}`,
          marginBottom: 2,
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Branch dot */}
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: b.color, flexShrink: 0,
                boxShadow: `0 0 3px ${b.color}60`,
              }} />
              {/* Label */}
              <span style={{
                fontSize: 10, fontWeight: 700, color: b.color,
              }}>
                {b.label}
              </span>
              {/* Separator */}
              <span style={{ fontSize: 10, color: TEXT.faint }}>→</span>
              {/* Note */}
              <span style={{ fontSize: 10, color: TEXT.secondary, flex: 1 }}>
                {b.note}
              </span>
            </div>

            {/* Runout quality bar */}
            {b.showRunouts && (
              <RunoutBar
                favorable={b.favorableRunouts}
                total={b.totalRunouts}
                scaryCards={b.scaryCards}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
