/**
 * MiniCard.jsx — Compact playing card display (rank + suit)
 *
 * Renders a 26×34px card with suit-colored text.
 * Accepts either a card string ("Ah", "Tc") or pre-parsed { rank, suit }.
 */

import React from 'react';
import { SURFACE, BORDER, TEXT, GOLD } from '../../../constants/designTokens';

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
    <div
      className="inline-flex flex-col items-center justify-center w-[26px] h-[34px] rounded-[3px] font-mono text-[11px] font-semibold leading-none gap-0 border shadow-[inset_0_1px_2px_rgba(0,0,0,0.3)]"
      style={{
        background: isHero
          ? `linear-gradient(180deg, ${SURFACE.card}, #1f1a10)`
          : SURFACE.card,
        borderColor: isHero ? GOLD.dim : BORDER.subtle,
        color,
      }}
    >
      <span className="text-xs leading-none">{parsed.rank}</span>
      <span className="text-[9px] leading-none -mt-px">{parsed.suit}</span>
    </div>
  );
};
