/**
 * HandTypePanel.jsx — Villain range composition by hand type
 *
 * Wraps the existing HandTypeBreakdown component with the panel header style.
 * Shows the full hand-type taxonomy: Premium → Flush → Straight → Set/Trips →
 * Two Pair → Top Pair → Mid/Low → Draws → Air with stacked bar and detail rows.
 */

import React from 'react';
import { HandTypeBreakdown } from '../../../ui/HandTypeBreakdown';
import { BORDER, TEXT } from '../../../../constants/designTokens';

export const HandTypePanel = ({ segmentation, bucketEquities }) => {
  if (!segmentation?.handTypes) return null;

  return (
    <div className="mb-2.5">
      <div
        className="text-[9px] font-bold uppercase tracking-[0.8px] mb-1.5 pb-[3px] border-b"
        style={{ color: TEXT.muted, borderBottomColor: BORDER.default }}
      >
        Villain Range Composition
      </div>
      <HandTypeBreakdown
        handTypes={segmentation.handTypes}
        totalCombos={segmentation.totalCombos || 0}
        bucketEquities={bucketEquities}
        size="md"
      />
    </div>
  );
};
