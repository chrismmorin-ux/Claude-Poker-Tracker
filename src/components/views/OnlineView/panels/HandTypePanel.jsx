/**
 * HandTypePanel.jsx — Villain range composition by hand type
 *
 * Wraps the existing HandTypeBreakdown component with the panel header style.
 * Shows the full hand-type taxonomy: Premium → Flush → Straight → Set/Trips →
 * Two Pair → Top Pair → Mid/Low → Draws → Air with stacked bar and detail rows.
 */

import React from 'react';
import { HandTypeBreakdown } from '../../../ui/HandTypeBreakdown';
import { BORDER, TEXT } from '../panelTokens';

export const HandTypePanel = ({ segmentation, bucketEquities }) => {
  if (!segmentation?.handTypes) return null;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={sectionHeader}>Villain Range Composition</div>
      <HandTypeBreakdown
        handTypes={segmentation.handTypes}
        totalCombos={segmentation.totalCombos || 0}
        bucketEquities={bucketEquities}
        size="md"
      />
    </div>
  );
};

const sectionHeader = {
  fontSize: 9, fontWeight: 700, color: TEXT.muted,
  textTransform: 'uppercase', letterSpacing: 0.8,
  marginBottom: 6, paddingBottom: 3,
  borderBottom: `1px solid ${BORDER.default}`,
};
