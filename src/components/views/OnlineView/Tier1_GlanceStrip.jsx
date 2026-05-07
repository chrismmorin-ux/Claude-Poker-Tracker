/**
 * Tier1_GlanceStrip.jsx — Sticky header with action, EV, context pills, cards
 *
 * The visual anchor of the extension panel. Shows the recommended action at a glance
 * with supporting context (depth, SPR, confidence, board/hero cards, pot).
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, GOLD, ACTION_PILL_COLORS, EV_COLORS } from '../../../constants/designTokens';
import { MiniCard } from './MiniCard';

const GREEN = '#22c55e';   // green-500 — was COLOR.green
const YELLOW = '#eab308';  // yellow-500 — was COLOR.yellow
const CYAN = '#22d3ee';    // cyan-400 — was COLOR.cyan
const PURPLE = '#a78bfa';  // violet-400 — was COLOR.purple

// ─── Action accent gradient ─────────────────────────────────────────────────
const accentGradient = (action) => {
  const a = ACTION_PILL_COLORS[action] || ACTION_PILL_COLORS.check;
  return `linear-gradient(90deg, ${a.text}, ${a.bg})`;
};

// ─── Format EV ──────────────────────────────────────────────────────────────
const formatEV = (ev) => {
  if (ev == null || isNaN(ev)) return { text: '—', positive: true };
  const sign = ev >= 0 ? '+' : '';
  return { text: `${sign}${ev.toFixed(1)}`, positive: ev >= 0 };
};

// ─── Confidence tier → dot color ────────────────────────────────────────────
const confDotColor = (tier) => {
  if (tier === 'high' || tier === 'confirmed') return GREEN;
  if (tier === 'developing' || tier === 'supported') return YELLOW;
  return TEXT.faint;
};

// ─── Shared classes ─────────────────────────────────────────────────────────
const PILL_CLASSES = "font-mono inline-flex items-center gap-[3px] text-[9px] font-semibold px-1.5 py-0.5 rounded-[10px] tracking-[0.3px] leading-none whitespace-nowrap";
const GROUP_LABEL_CLASSES = "text-[8px] font-semibold uppercase tracking-[0.8px] self-center mr-0.5";

export const Tier1_GlanceStrip = ({ advice, liveHandState }) => {
  const topRec = advice?.recommendations?.[0];
  const action = topRec?.action || 'check';
  const ev = topRec?.ev;
  const evInfo = formatEV(ev);
  const sizing = topRec?.sizing;
  const sizingLabel = sizing?.betFraction
    ? `${Math.round(sizing.betFraction * 100)}%`
    : null;

  const meta = advice?.treeMetadata || {};
  const depth = meta.depth || meta.depthReached;
  const spr = meta.spr;
  const tier = advice?.dataQuality?.tier || advice?.confidence || 'none';
  const sampleSize = advice?.villainSampleSize || advice?.dataQuality?.sampleSize;

  // Board + hero cards from live state
  const boardCards = liveHandState?.communityCards || [];
  const heroCards = liveHandState?.heroCards || [];
  const pot = advice?.potSize || liveHandState?.pot;

  return (
    <div
      className="sticky top-0 z-20 border-b shrink-0"
      style={{
        background: SURFACE.inset,
        borderBottomColor: BORDER.default,
      }}
    >
      {/* Animated accent bar */}
      <div
        className="h-[3px]"
        style={{
          background: accentGradient(action),
          animation: 'panelAccentPulse 3s ease-in-out infinite',
        }}
      />

      {/* Main row: action badge + EV + meta pills */}
      <div className="flex items-center px-3.5 py-2.5 gap-2.5">
        {/* Action badge */}
        <div
          className="font-mono flex items-baseline gap-[5px] px-3 py-[5px] rounded-[5px] font-bold tracking-[0.5px] uppercase text-[15px] leading-none whitespace-nowrap"
          style={{
            background: ACTION_PILL_COLORS[action]?.bg || ACTION_PILL_COLORS.check.bg,
            color: ACTION_PILL_COLORS[action]?.text || ACTION_PILL_COLORS.check.text,
          }}
        >
          {action}
          {sizingLabel && (
            <span className="text-[11px] font-medium opacity-80">
              {sizingLabel}
            </span>
          )}
        </div>

        {/* EV display */}
        <div
          className="font-mono font-bold text-lg tracking-[-0.5px] leading-none"
          style={{
            color: evInfo.positive ? EV_COLORS['+EV'].text : EV_COLORS['-EV'].text,
          }}
        >
          {evInfo.text}
          <span className="text-[11px] font-normal opacity-60 ml-px">bb</span>
        </div>

        {/* Meta pills (right side) */}
        <div className="flex flex-col items-end gap-[3px] ml-auto shrink-0">
          <div className="flex items-center gap-1">
            {depth != null && depth > 1 && (
              <span
                className={PILL_CLASSES}
                style={{
                  background: 'rgba(162, 139, 250, 0.15)',
                  color: PURPLE,
                  border: '1px solid rgba(162, 139, 250, 0.25)',
                }}
              >
                D{depth}
              </span>
            )}
            {spr != null && (
              <span
                className={PILL_CLASSES}
                style={{
                  background: 'rgba(34, 211, 238, 0.1)',
                  color: CYAN,
                  border: '1px solid rgba(34, 211, 238, 0.2)',
                }}
              >
                SPR {spr.toFixed(1)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <div
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: confDotColor(tier),
                boxShadow: tier === 'high' ? `0 0 4px rgba(34,197,94,0.4)` : 'none',
              }}
            />
            {sampleSize != null && (
              <span
                className="font-mono text-[8px] uppercase tracking-[0.5px]"
                style={{ color: TEXT.faint }}
              >n={sampleSize}</span>
            )}
          </div>
        </div>
      </div>

      {/* Board + hero cards + pot */}
      {(boardCards.length > 0 || heroCards.length > 0) && (
        <div className="flex items-center gap-2 px-3.5 pb-2">
          {/* Board */}
          {boardCards.length > 0 && (
            <>
              <span className={GROUP_LABEL_CLASSES} style={{ color: TEXT.faint }}>Board</span>
              <div className="flex gap-[3px]">
                {boardCards.map((c, i) => <MiniCard key={i} card={c} />)}
              </div>
            </>
          )}

          {/* Separator */}
          {boardCards.length > 0 && heroCards.length > 0 && (
            <div className="w-px h-5" style={{ background: BORDER.default }} />
          )}

          {/* Hero */}
          {heroCards.length > 0 && (
            <>
              <span className={GROUP_LABEL_CLASSES} style={{ color: TEXT.faint }}>Hero</span>
              <div className="flex gap-[3px]">
                {heroCards.map((c, i) => <MiniCard key={i} card={c} isHero />)}
              </div>
            </>
          )}

          {/* Pot */}
          {pot != null && (
            <div
              className="font-mono ml-auto text-[11px] font-semibold"
              style={{ color: GOLD.base }}
            >
              ${typeof pot === 'number' ? pot.toFixed(0) : pot}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
