/**
 * ComboDistributionPanel.jsx — Ahead / Tied / Behind stacked bar
 *
 * Shows hero's combo distribution from treeMetadata.comboStats:
 * how many villain combos hero is ahead of, tied with, and behind.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT } from '../../../../constants/designTokens';

const GREEN = '#22c55e';   // green-500 — was COLOR.green
const YELLOW = '#eab308';  // yellow-500 — was COLOR.yellow
const RED = '#ef4444';     // red-500 — was COLOR.red

const SECTION_HEADER_CLASSES = "text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b";
const sectionHeaderStyle = { color: TEXT.muted, borderBottomColor: BORDER.default };

export const ComboDistributionPanel = ({ comboStats }) => {
  if (!comboStats || comboStats.total === 0) return null;

  const { ahead = 0, tied = 0, behind = 0, total } = comboStats;
  const aheadPct = (ahead / total) * 100;
  const tiedPct = (tied / total) * 100;
  const behindPct = (behind / total) * 100;

  return (
    <div className="mb-2.5">
      <div className={`${SECTION_HEADER_CLASSES} flex justify-between items-center`} style={sectionHeaderStyle}>
        <span>Combo Distribution</span>
        <span className="font-mono text-[8px] font-normal" style={{ color: TEXT.faint }}>
          {total} combos
        </span>
      </div>

      {/* Stacked bar */}
      <div
        className="flex h-4 rounded overflow-hidden mb-1.5"
        style={{ background: SURFACE.inset }}
      >
        {aheadPct > 0 && (
          <div
            className="h-full flex items-center justify-center transition-[width] duration-[600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
            style={{
              width: `${aheadPct}%`,
              background: `linear-gradient(90deg, #166534, ${GREEN})`,
            }}
          >
            {aheadPct >= 12 && (
              <span className="text-[8px] font-bold text-white">
                {Math.round(aheadPct)}%
              </span>
            )}
          </div>
        )}
        {tiedPct > 0 && (
          <div
            className="h-full flex items-center justify-center transition-[width] duration-[600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
            style={{
              width: `${tiedPct}%`,
              background: `linear-gradient(90deg, #854d0e, ${YELLOW})`,
            }}
          >
            {tiedPct >= 12 && (
              <span className="text-[8px] font-bold text-white">
                {Math.round(tiedPct)}%
              </span>
            )}
          </div>
        )}
        {behindPct > 0 && (
          <div
            className="h-full flex items-center justify-center transition-[width] duration-[600ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
            style={{
              width: `${behindPct}%`,
              background: `linear-gradient(90deg, #7f1d1d, ${RED})`,
            }}
          >
            {behindPct >= 12 && (
              <span className="text-[8px] font-bold text-white">
                {Math.round(behindPct)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-3.5 text-[9px]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ background: GREEN }} />
          <span style={{ color: TEXT.secondary }}>Ahead</span>
          <span className="font-mono font-semibold" style={{ color: GREEN }}>
            {ahead} ({Math.round(aheadPct)}%)
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ background: YELLOW }} />
          <span style={{ color: TEXT.secondary }}>Tied</span>
          <span className="font-mono font-semibold" style={{ color: YELLOW }}>
            {tied}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-sm" style={{ background: RED }} />
          <span style={{ color: TEXT.secondary }}>Behind</span>
          <span className="font-mono font-semibold" style={{ color: RED }}>
            {behind} ({Math.round(behindPct)}%)
          </span>
        </div>
      </div>
    </div>
  );
};
