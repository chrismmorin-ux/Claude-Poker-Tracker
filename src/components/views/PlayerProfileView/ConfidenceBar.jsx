/**
 * ConfidenceBar.jsx — recognition match-confidence visual (§PIO-G4-DISAMB).
 *
 * WS-164 / SPR-110 (PIO G5 child E). Renders a 10-segment bar whose filled
 * fraction is proportional to the recognition match `score` [0..1], plus a
 * factual verbal label. Shared component (lives under PlayerProfileView;
 * consumed by PlayersView rows and future Table-Build CandidateColumn).
 *
 * AP-PIO-04 (binding): copy is FACTUAL only — 'strong match' (≥0.7) /
 * 'partial match' (0.4–0.7) / 'weak match' (<0.4). NEVER renders shame /
 * verification-pressure framing ("are you sure?", "double-check", "did you
 * mean…", "this might be wrong", "caution: low confidence"). Weak match is a
 * normal outcome, not a verdict. A DOM-assertion test enforces this.
 */

import React from 'react';
import { bandConfidence } from '../../../utils/playerMatching/scorePlayerMatch.js';

const SEGMENT_COUNT = 10;

// Band → { fill color, factual label }. Recognition confidence is not
// good/bad — these are neutral confidence tiers, not a severity scale.
const BAND_STYLE = {
  strong:  { fill: 'bg-emerald-500', label: 'strong match' },
  partial: { fill: 'bg-amber-400',   label: 'partial match' },
  weak:    { fill: 'bg-gray-400',    label: 'weak match' },
};

/**
 * @param {object} props
 * @param {number} props.score — recognition match score in [0..1]
 * @param {boolean} [props.showLabel=true] — render the factual verbal label
 * @param {boolean} [props.showPercent=false] — also render 'NN% match'
 */
export const ConfidenceBar = ({ score, showLabel = true, showPercent = false }) => {
  if (typeof score !== 'number' || Number.isNaN(score)) return null;
  const clamped = Math.min(1, Math.max(0, score));
  const band = bandConfidence(clamped);
  const style = BAND_STYLE[band] || BAND_STYLE.weak;
  const filled = Math.round(clamped * SEGMENT_COUNT);
  const pct = Math.round(clamped * 100);

  return (
    <div className="flex items-center gap-2" data-testid="confidence-bar" data-band={band}>
      <div
        className="flex gap-0.5"
        role="img"
        aria-label={`${style.label}, ${pct} percent`}
        title={`${pct}% match`}
      >
        {Array.from({ length: SEGMENT_COUNT }).map((_, i) => (
          <span
            key={i}
            className={`inline-block w-1.5 h-3 rounded-sm ${i < filled ? style.fill : 'bg-gray-700'}`}
          />
        ))}
      </div>
      {showLabel && (
        <span className="text-xs text-gray-400" data-testid="confidence-label">
          {style.label}
          {showPercent ? ` · ${pct}%` : ''}
        </span>
      )}
    </div>
  );
};

export default ConfidenceBar;
