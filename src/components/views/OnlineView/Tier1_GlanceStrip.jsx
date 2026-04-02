/**
 * Tier1_GlanceStrip.jsx — Sticky header with action, EV, context pills, cards
 *
 * The visual anchor of the extension panel. Shows the recommended action at a glance
 * with supporting context (depth, SPR, confidence, board/hero cards, pot).
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, ACTION, EV, COLOR, GOLD, R, CONF_COLOR } from './panelTokens';
import { MiniCard } from './MiniCard';

// ─── Action accent gradient ─────────────────────────────────────────────────
const accentGradient = (action) => {
  const a = ACTION[action] || ACTION.check;
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
  if (tier === 'high' || tier === 'confirmed') return COLOR.green;
  if (tier === 'developing' || tier === 'supported') return COLOR.yellow;
  return TEXT.faint;
};

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
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 20,
      background: SURFACE.inset,
      borderBottom: `1px solid ${BORDER.default}`,
      flexShrink: 0,
    }}>
      {/* Animated accent bar */}
      <div style={{
        height: 3,
        background: accentGradient(action),
        animation: 'panelAccentPulse 3s ease-in-out infinite',
      }} />

      {/* Main row: action badge + EV + meta pills */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '10px 14px',
        gap: 10,
      }}>
        {/* Action badge */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 5,
          padding: '5px 12px',
          borderRadius: R.md,
          fontFamily: FONT.mono,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          fontSize: 15,
          lineHeight: 1,
          whiteSpace: 'nowrap',
          background: ACTION[action]?.bg || ACTION.check.bg,
          color: ACTION[action]?.text || ACTION.check.text,
        }}>
          {action}
          {sizingLabel && (
            <span style={{ fontSize: 11, fontWeight: 500, opacity: 0.8 }}>
              {sizingLabel}
            </span>
          )}
        </div>

        {/* EV display */}
        <div style={{
          fontFamily: FONT.mono,
          fontWeight: 700,
          fontSize: 18,
          letterSpacing: -0.5,
          lineHeight: 1,
          color: evInfo.positive ? EV.pos : EV.neg,
        }}>
          {evInfo.text}
          <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.6, marginLeft: 1 }}>bb</span>
        </div>

        {/* Meta pills (right side) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 3,
          marginLeft: 'auto',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {depth != null && depth > 1 && (
              <span style={{
                ...pillStyle,
                background: 'rgba(162, 139, 250, 0.15)',
                color: COLOR.purple,
                border: '1px solid rgba(162, 139, 250, 0.25)',
              }}>D{depth}</span>
            )}
            {spr != null && (
              <span style={{
                ...pillStyle,
                background: 'rgba(34, 211, 238, 0.1)',
                color: COLOR.cyan,
                border: '1px solid rgba(34, 211, 238, 0.2)',
              }}>SPR {spr.toFixed(1)}</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
              background: confDotColor(tier),
              boxShadow: tier === 'high' ? `0 0 4px rgba(34,197,94,0.4)` : 'none',
            }} />
            {sampleSize != null && (
              <span style={{
                fontFamily: FONT.mono,
                fontSize: 8,
                color: TEXT.faint,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}>n={sampleSize}</span>
            )}
          </div>
        </div>
      </div>

      {/* Board + hero cards + pot */}
      {(boardCards.length > 0 || heroCards.length > 0) && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 14px 8px',
        }}>
          {/* Board */}
          {boardCards.length > 0 && (
            <>
              <span style={groupLabel}>Board</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {boardCards.map((c, i) => <MiniCard key={i} card={c} />)}
              </div>
            </>
          )}

          {/* Separator */}
          {boardCards.length > 0 && heroCards.length > 0 && (
            <div style={{ width: 1, height: 20, background: BORDER.default }} />
          )}

          {/* Hero */}
          {heroCards.length > 0 && (
            <>
              <span style={groupLabel}>Hero</span>
              <div style={{ display: 'flex', gap: 3 }}>
                {heroCards.map((c, i) => <MiniCard key={i} card={c} isHero />)}
              </div>
            </>
          )}

          {/* Pot */}
          {pot != null && (
            <div style={{
              marginLeft: 'auto',
              fontFamily: FONT.mono,
              fontSize: 11,
              fontWeight: 600,
              color: GOLD.base,
            }}>
              ${typeof pot === 'number' ? pot.toFixed(0) : pot}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Shared styles ──────────────────────────────────────────────────────────
const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontFamily: FONT.mono,
  fontSize: 9,
  fontWeight: 600,
  padding: '2px 6px',
  borderRadius: 10,
  letterSpacing: 0.3,
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

const groupLabel = {
  fontSize: 8,
  fontWeight: 600,
  color: TEXT.faint,
  textTransform: 'uppercase',
  letterSpacing: 0.8,
  alignSelf: 'center',
  marginRight: 2,
};
