/**
 * ComboDistributionPanel.jsx — Ahead / Tied / Behind stacked bar
 *
 * Shows hero's combo distribution from treeMetadata.comboStats:
 * how many villain combos hero is ahead of, tied with, and behind.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, R } from '../panelTokens';

export const ComboDistributionPanel = ({ comboStats }) => {
  if (!comboStats || comboStats.total === 0) return null;

  const { ahead = 0, tied = 0, behind = 0, total } = comboStats;
  const aheadPct = (ahead / total) * 100;
  const tiedPct = (tied / total) * 100;
  const behindPct = (behind / total) * 100;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        ...sectionHeader,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span>Combo Distribution</span>
        <span style={{ fontFamily: FONT.mono, fontSize: 8, fontWeight: 400, color: TEXT.faint }}>
          {total} combos
        </span>
      </div>

      {/* Stacked bar */}
      <div style={{
        display: 'flex', height: 16, borderRadius: 4, overflow: 'hidden',
        background: SURFACE.inset, marginBottom: 6,
      }}>
        {aheadPct > 0 && (
          <div style={{
            width: `${aheadPct}%`, height: '100%',
            background: `linear-gradient(90deg, #166534, ${COLOR.green})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            {aheadPct >= 12 && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>
                {Math.round(aheadPct)}%
              </span>
            )}
          </div>
        )}
        {tiedPct > 0 && (
          <div style={{
            width: `${tiedPct}%`, height: '100%',
            background: `linear-gradient(90deg, #854d0e, ${COLOR.yellow})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            {tiedPct >= 12 && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>
                {Math.round(tiedPct)}%
              </span>
            )}
          </div>
        )}
        {behindPct > 0 && (
          <div style={{
            width: `${behindPct}%`, height: '100%',
            background: `linear-gradient(90deg, #7f1d1d, ${COLOR.red})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'width 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          }}>
            {behindPct >= 12 && (
              <span style={{ fontSize: 8, fontWeight: 700, color: '#fff' }}>
                {Math.round(behindPct)}%
              </span>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 14, fontSize: 9 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: COLOR.green }} />
          <span style={{ color: TEXT.secondary }}>Ahead</span>
          <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: COLOR.green }}>
            {ahead} ({Math.round(aheadPct)}%)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: COLOR.yellow }} />
          <span style={{ color: TEXT.secondary }}>Tied</span>
          <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: COLOR.yellow }}>
            {tied}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: COLOR.red }} />
          <span style={{ color: TEXT.secondary }}>Behind</span>
          <span style={{ fontFamily: FONT.mono, fontWeight: 600, color: COLOR.red }}>
            {behind} ({Math.round(behindPct)}%)
          </span>
        </div>
      </div>
    </div>
  );
};

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
