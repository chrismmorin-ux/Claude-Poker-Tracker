/**
 * MiniCard.jsx — Compact playing card display (rank + suit)
 *
 * Renders a 26×34px card with suit-colored text.
 * Accepts either a card string ("Ah", "Tc") or pre-parsed { rank, suit }.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, GOLD, FONT } from './panelTokens';

const SUIT_SYMBOLS = { '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣', s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_COLORS = { '♠': TEXT.primary, '♥': '#ef4444', '♦': '#ef4444', '♣': TEXT.primary };
const RANK_DISPLAY = { T: 'T', J: 'J', Q: 'Q', K: 'K', A: 'A' };

const parseCardStr = (str) => {
  if (!str || str.length < 2) return null;
  const rank = str[0];
  const suitChar = str.length > 2 ? str.slice(1) : str[1];
  const suit = SUIT_SYMBOLS[suitChar] || suitChar;
  return { rank: RANK_DISPLAY[rank] || rank, suit };
};

export const MiniCard = ({ card, isHero = false }) => {
  const parsed = typeof card === 'string' ? parseCardStr(card) : card;
  if (!parsed) return null;

  const color = SUIT_COLORS[parsed.suit] || TEXT.primary;
  const isRed = parsed.suit === '♥' || parsed.suit === '♦';

  return (
    <div style={{
      display: 'inline-flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: 26,
      height: 34,
      background: isHero
        ? `linear-gradient(180deg, ${SURFACE.card}, #1f1a10)`
        : SURFACE.card,
      border: `1px solid ${isHero ? GOLD.dim : BORDER.subtle}`,
      borderRadius: 3,
      fontFamily: FONT.mono,
      fontSize: 11,
      fontWeight: 600,
      color,
      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.3)',
      lineHeight: 1,
      gap: 0,
    }}>
      <span style={{ fontSize: 12, lineHeight: 1 }}>{parsed.rank}</span>
      <span style={{ fontSize: 9, lineHeight: 1, marginTop: -1 }}>{parsed.suit}</span>
    </div>
  );
};
