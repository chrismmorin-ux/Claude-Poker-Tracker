import React from 'react';

/**
 * PushFoldPanel — binary short-stack verdict (≤15bb), replacing the equity tag.
 * SHOVE / FOLD / CALL + one-line reason + effective-stack ladder. No mixed
 * strategies (persona rule). Verdict comes from $EV (pushFoldEngine), never a
 * label. Implements docs/design/discoveries/2026-04-21-push-fold-widget.md.
 */

const VERDICT_STYLE = {
  SHOVE: { bg: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)', label: 'SHOVE' },
  CALL: { bg: 'linear-gradient(180deg, #2563eb 0%, #1e40af 100%)', label: 'CALL' },
  FOLD: { bg: 'linear-gradient(180deg, #4b5563 0%, #374151 100%)', label: 'FOLD' },
};

export const PushFoldPanel = ({ pushFold, isComputing }) => {
  if (!pushFold) {
    if (isComputing) {
      return (
        <div className="rounded-lg px-3 py-2 text-center text-gray-400 text-sm" style={{ background: 'rgba(255,255,255,0.05)' }}>
          Push/fold — computing…
        </div>
      );
    }
    return null;
  }

  const style = VERDICT_STYLE[pushFold.verdict] || VERDICT_STYLE.FOLD;
  const bb = pushFold.effBB != null ? Math.round(pushFold.effBB) : null;

  return (
    <div className="rounded-lg overflow-hidden shadow-lg" style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
      <div className="flex items-stretch">
        {/* Verdict */}
        <div
          className="flex flex-col items-center justify-center px-5 py-2 text-white"
          style={{ background: style.bg, minWidth: 120 }}
        >
          <span className="font-extrabold tracking-wide" style={{ fontSize: 24, lineHeight: 1 }}>
            {style.label}
          </span>
          <span className="font-semibold" style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
            {pushFold.situation === 'call' ? 'vs all-in' : 'first in'}
          </span>
        </div>

        {/* Reason + ladder */}
        <div className="flex-1 flex flex-col justify-center px-3 py-2 bg-gray-900">
          <div className="text-gray-200 font-semibold" style={{ fontSize: 13 }}>
            {pushFold.reason}
          </div>
          <div className="flex items-center gap-2 mt-1" style={{ fontSize: 11 }}>
            {bb != null && (
              <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(212,168,71,0.18)', color: '#d4a847' }}>
                {bb}bb {pushFold.position ? `· ${pushFold.position}` : ''}
              </span>
            )}
            {pushFold.icmAdjusted && (
              <span className="px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(239,68,68,0.18)', color: '#f87171' }}>
                {pushFold.isApproximate ? 'ICM ~' : 'ICM'}
                {pushFold.requiredEquity != null ? ` · need ${Math.round(pushFold.requiredEquity * 100)}%` : ''}
              </span>
            )}
            {!pushFold.icmAdjusted && (
              <span className="text-gray-500">chip-EV (no payouts set)</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
