/**
 * HandPlanTree.jsx — Branch guidance for the rest of the hand
 *
 * Shows what to do if villain calls, raises, bets, checks, or on the next street.
 * Each branch has a colored left border, label, action note, and runout detail.
 * Extracted from LiveRecommendations for reuse in both old and new UI.
 */

import React from 'react';
import { SURFACE, TEXT, GOLD } from '../../../constants/designTokens';

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
  const barColor = pct >= 60 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444'; // green/yellow/red-500

  return (
    <div className="flex items-center gap-1 mt-0.5">
      <div
        className="w-[50px] h-1 rounded-sm overflow-hidden"
        style={{ background: SURFACE.inset }}
      >
        <div
          className="h-full rounded-sm transition-[width] duration-500 ease-in"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <span className="font-mono text-[8px]" style={{ color: TEXT.faint }}>
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
    <div className="mb-2">
      <div
        className="text-[9px] mb-1 uppercase tracking-[0.5px] font-semibold"
        style={{ color: TEXT.faint }}
      >
        Hand Plan
      </div>

      {branches.map((b) => (
        <div
          key={b.key}
          className="flex items-start gap-1.5 py-1 pl-2 mb-0.5 border-l-2"
          style={{ borderLeftColor: b.color }}
        >
          <div className="flex-1">
            <div className="flex items-center gap-1">
              {/* Branch dot */}
              <div
                className="w-[5px] h-[5px] rounded-full shrink-0"
                style={{ background: b.color, boxShadow: `0 0 3px ${b.color}60` }}
              />
              {/* Label */}
              <span className="text-[10px] font-bold" style={{ color: b.color }}>
                {b.label}
              </span>
              {/* Separator */}
              <span className="text-[10px]" style={{ color: TEXT.faint }}>→</span>
              {/* Note */}
              <span className="text-[10px] flex-1" style={{ color: TEXT.secondary }}>
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
