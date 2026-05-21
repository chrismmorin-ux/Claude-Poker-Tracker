/**
 * PredicateCalibrationPanel — Predicates tab (v1 empty-state shell).
 *
 * Per Gate 4 spec amendment 2026-05-09 §PredicateCalibrationPanel: predicate
 * calibration data layer is owned by exploit-deviation. EAL Phase 6 ships this
 * tab as an empty-state shell so the 3-tab IA matches the spec; the
 * cross-project dependency stays visible. When exploit-deviation Phase 6
 * ships predicate-calibration infrastructure, this component is replaced
 * with the column layout from spec §PredicateCalibrationPanel.
 *
 * Copy from `buildPredicatesEmptyStateCopy()`.
 *
 * EAL Phase 6 — WS-169 / SPR-066.
 */

import React from 'react';
import { buildPredicatesEmptyStateCopy } from '../../../utils/anchorLibrary/calibrationCopy';

export const PredicateCalibrationPanel = () => (
  <div
    data-testid="predicate-calibration-panel"
    role="tabpanel"
    aria-label="Predicates calibration (pending exploit-deviation infrastructure)"
    style={{
      padding: '2rem 1rem',
      textAlign: 'center',
      color: '#9ca3af',
      fontSize: '0.875rem',
      lineHeight: 1.6,
      maxWidth: '40rem',
      margin: '0 auto',
    }}
  >
    {buildPredicatesEmptyStateCopy()}
  </div>
);

export default PredicateCalibrationPanel;
