/**
 * CalibrationEmptyState — pre-firing state for the Anchors tab.
 *
 * Per Gate 4 spec §Known behavior notes line 316: factual, no
 * engagement-pressure nudge. Copy from `buildAnchorsEmptyStateCopy()`.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React from 'react';
import { buildAnchorsEmptyStateCopy } from '../../../utils/anchorLibrary/calibrationCopy';

export const CalibrationEmptyState = () => (
  <div
    data-testid="calibration-empty-state"
    role="status"
    style={{
      padding: '2rem 1rem',
      textAlign: 'center',
      color: '#9ca3af',
      fontSize: '0.875rem',
      lineHeight: 1.5,
    }}
  >
    {buildAnchorsEmptyStateCopy()}
  </div>
);

export default CalibrationEmptyState;
