/**
 * BlockerInsightStrip.jsx — Human-readable blocker insight
 *
 * Formats treeMetadata.blockerEffects into text like:
 * "Your A♠ blocks 12% of villain's nut flush combos"
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, FONT, COLOR, R } from './panelTokens';

const SUIT_SYMBOLS = ['♠', '♥', '♦', '♣'];
const RANK_CHARS = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];

const formatCard = (cardStr) => {
  if (!cardStr || cardStr.length < 2) return cardStr;
  return cardStr; // Already formatted (e.g., "A♠")
};

// Find the most impactful blocker effect
const findTopBlocker = (blockerEffects) => {
  if (!blockerEffects) return null;

  const htEffects = blockerEffects.handTypeEffects;
  if (!htEffects) {
    // Fall back to bucket-level
    const buckets = ['nuts', 'strong', 'draw'];
    let best = null;
    for (const b of buckets) {
      const eff = blockerEffects[b];
      if (eff && eff.pctRemoved > 3 && eff.removed > 0) {
        if (!best || eff.pctRemoved > best.pctRemoved) {
          best = { label: b, ...eff };
        }
      }
    }
    return best;
  }

  // Hand-type level: find the most blocked type
  const LABELS = {
    nutFlush: 'nut flush', secondFlush: 'flush', weakFlush: 'flush',
    nutStraight: 'nut straight', nonNutStraight: 'straight',
    set: 'set', trips: 'trips', twoPair: 'two pair',
    topPairGood: 'top pair', topPairWeak: 'top pair',
    comboDraw: 'combo draw', nutFlushDraw: 'nut flush draw',
    nonNutFlushDraw: 'flush draw', oesd: 'OESD',
  };

  let best = null;
  for (const [ht, eff] of Object.entries(htEffects)) {
    if (eff.pctRemoved > 5 && eff.removed > 0) {
      if (!best || eff.pctRemoved > best.pctRemoved) {
        best = { label: LABELS[ht] || ht, ...eff };
      }
    }
  }
  return best;
};

export const BlockerInsightStrip = ({ blockerEffects, heroCards }) => {
  const topBlocker = findTopBlocker(blockerEffects);
  if (!topBlocker) return null;

  const totalRemoved = blockerEffects?.totalRemoved || 0;
  const totalBaseline = blockerEffects?.totalBaseline || 1;
  const overallPct = Math.round((totalRemoved / totalBaseline) * 100);

  return (
    <div style={{
      padding: '6px 8px',
      background: 'rgba(34,211,238,0.06)',
      border: `1px solid rgba(34,211,238,0.15)`,
      borderRadius: R.md,
      marginBottom: 6,
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{
        width: 4, height: 4, borderRadius: '50%',
        background: COLOR.cyan, flexShrink: 0,
      }} />
      <span style={{
        fontFamily: FONT.mono,
        fontSize: 9,
        color: COLOR.cyan,
        lineHeight: 1.3,
      }}>
        {heroCards?.length === 2
          ? `${formatCard(heroCards[0])} ${formatCard(heroCards[1])} block`
          : 'Hero blocks'}
        {' '}{Math.round(topBlocker.pctRemoved)}% of villain's {topBlocker.label} combos
        {overallPct > 3 && ` (${totalRemoved} combos removed)`}
      </span>
    </div>
  );
};
