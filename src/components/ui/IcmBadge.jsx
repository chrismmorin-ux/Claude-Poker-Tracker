/**
 * IcmBadge.jsx - ICM badge for tournament UI
 *
 * Prefers REAL ICM (POKER_THEORY.md §10): shows the risk premium / bubble factor
 * + hero $EV when a payout ladder is configured. Falls back to the bubble-distance
 * zone label when ICM data is absent. Approximated (multi-table) ICM is flagged
 * with a `~` per §10.6 — never presented as exact.
 */

import React from 'react';

const fmtMoney = (n) => {
  if (n == null) return '';
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}k`;
  return `$${Math.round(n)}`;
};

// Color the risk premium by severity: higher bubble factor = tighten more.
const premiumColor = (bf) => {
  if (bf >= 1.5) return { bg: 'rgba(239,68,68,0.2)', fg: '#ef4444' };   // heavy premium
  if (bf >= 1.2) return { bg: 'rgba(245,158,11,0.2)', fg: '#f59e0b' };  // notable
  return { bg: 'rgba(34,197,94,0.2)', fg: '#22c55e' };                  // ≈ chip-EV
};

/**
 * @param {Object} props
 * @param {Object|null} props.icmPressure - bubble-distance zone fallback { zone, playersFromBubble }
 * @param {Object|null} props.icm - real ICM { heroEquity, bubbleFactor, requiredEquity, isApproximate, tooLarge }
 */
export const IcmBadge = ({ icmPressure, icm }) => {
  // --- Real ICM (preferred) ---
  if (icm) {
    if (icm.tooLarge) {
      return (
        <span
          className="text-xs px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: 'rgba(148,163,184,0.18)', color: '#94a3b8' }}
          title="Field too large to model ICM precisely — showing bubble distance only (POKER_THEORY §10.6)"
        >
          ICM —
        </span>
      );
    }
    if (icm.bubbleFactor != null) {
      const { bg, fg } = premiumColor(icm.bubbleFactor);
      const approx = icm.isApproximate ? '~' : '';
      const title = [
        `Risk premium (bubble factor): ${approx}${icm.bubbleFactor.toFixed(2)}×`,
        icm.requiredEquity != null ? `Need ${Math.round(icm.requiredEquity * 100)}% equity to call all-in` : null,
        icm.heroEquity != null ? `Your ICM $EV: ${fmtMoney(icm.heroEquity)}` : null,
        icm.isApproximate ? '(approximate — multi-table estimate)' : '(exact — final table)',
      ].filter(Boolean).join(' · ');
      return (
        <span
          className="text-xs px-1.5 py-0.5 rounded font-semibold"
          style={{ backgroundColor: bg, color: fg }}
          title={title}
        >
          ICM {approx}{icm.bubbleFactor.toFixed(2)}×
          {icm.heroEquity != null && (
            <span style={{ opacity: 0.85, marginLeft: 4 }}>{fmtMoney(icm.heroEquity)}</span>
          )}
        </span>
      );
    }
  }

  // --- Fallback: bubble-distance zone label ---
  if (!icmPressure || icmPressure.zone === 'standard') return null;

  if (icmPressure.zone === 'itm') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}>
        ITM
      </span>
    );
  }

  if (icmPressure.zone === 'bubble') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium animate-pulse" style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}>
        BUBBLE ({icmPressure.playersFromBubble} away)
      </span>
    );
  }

  if (icmPressure.zone === 'approaching') {
    return (
      <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
        Bubble ~{icmPressure.playersFromBubble}
      </span>
    );
  }

  return null;
};
