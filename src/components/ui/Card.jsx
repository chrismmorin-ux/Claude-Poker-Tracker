/**
 * @file Card — section card surface + CardHeader + SubLabel + ChipRow.
 *
 * Unified-PlayerFinder Phase A foundation primitive. The 4 exports cover
 * the layout primitives used to compose grouped chip sections in the
 * PlayerFinder.
 *
 *   <Card>             — slate-800/60 surface with slate-700 border.
 *                        12px padding, 16px bottom margin.
 *   <CardHeader>       — uppercase amber-300 tracking-wider title with
 *                        optional active-count badge on the right.
 *   <SubLabel>         — uppercase gray-500 11px row label inside a card.
 *                        Same size as CardHeader; contrast via color, not
 *                        size — keeps hierarchy without inflating type ramp.
 *   <ChipRow>          — flex-wrap chip container; gap-2 (8px) per the
 *                        spacing scale.
 */

import React from 'react';

export const Card = ({ children, className = '' }) => (
  <div className={`bg-slate-800/60 border border-slate-700 rounded-lg p-3 mb-4 ${className}`}>
    {children}
  </div>
);

export const CardHeader = ({ children, count = 0 }) => (
  <div className="flex items-center justify-between mb-2">
    <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
      {children}
    </span>
    {count > 0 ? (
      <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 text-amber-300">
        {count}
      </span>
    ) : null}
  </div>
);

export const SubLabel = ({ children }) => (
  <div className="text-[11px] uppercase tracking-wider text-gray-500 font-bold mb-1 mt-2 first:mt-0">
    {children}
  </div>
);

export const ChipRow = ({ children, className = '' }) => (
  <div className={`flex flex-wrap gap-2 mb-2 ${className}`}>{children}</div>
);

export default Card;
