/**
 * TendencyStatsCard.jsx — surface-integration wrapper around TendencyStats.
 *
 * Per WS-135 / SPR-063: PlayerAnalysisPanel + HandReplay/ReviewPanel both
 * needed tendency-stats rendering with the SPR-017 ±X.X% credible-interval
 * convention. This wrapper adds card chrome (header + body + footer) over
 * the bare TendencyStats body so the rows have surface context.
 *
 * Bare `<TendencyStats>` continues to be used by PlayerRow + SeatGrid
 * unchanged.
 *
 * Hard rules:
 *   - AP-04: no scalar score / grade / rank / overall summary rendered.
 *   - Hide-when-narrow heuristic preserved automatically (internal to
 *     TendencyStats.formatBandSuffix; n > 200 → bands hidden).
 *   - Tap target on disclosure ≥44×44.
 *
 * EAL Phase 6 unrelated; this component is generic to any tendency consumer.
 */

import React, { useState, useCallback } from 'react';
import { TendencyStats } from './TendencyStats';

/**
 * @param {Object} props
 * @param {Object} props.stats              — { vpip, pfr, af, threeBet, cbet, sampleSize, style, intervals }
 * @param {string} props.title              — Header label (e.g. "Villain Tendency")
 * @param {string} [props.footer]           — Optional footer caption (e.g. "Based on 100 hands"); auto-derived from sampleSize if omitted
 * @param {boolean} [props.defaultCollapsed] — When true, body starts collapsed; tap title to expand
 * @param {string} [props.testId]           — Optional data-testid root
 */
export const TendencyStatsCard = ({
  stats,
  title,
  footer,
  defaultCollapsed = false,
  testId = 'tendency-stats-card',
}) => {
  const [collapsed, setCollapsed] = useState(Boolean(defaultCollapsed));

  const handleToggle = useCallback(() => {
    setCollapsed((prev) => !prev);
  }, []);

  // If stats are insufficient for rendering, the inner TendencyStats returns
  // null. Mirror that here so the card itself doesn't render empty chrome.
  if (!stats || typeof stats.sampleSize !== 'number' || stats.sampleSize < 10) {
    return null;
  }

  const resolvedFooter = footer ?? `Based on ${stats.sampleSize} hand${stats.sampleSize === 1 ? '' : 's'}`;

  return (
    <div
      data-testid={testId}
      className="bg-gray-800 border border-gray-700 rounded-lg p-3 my-2"
    >
      {defaultCollapsed ? (
        <button
          type="button"
          data-testid={`${testId}-toggle`}
          onClick={handleToggle}
          aria-expanded={!collapsed}
          className="w-full flex items-center justify-between text-left"
          style={{ minHeight: 44, minWidth: 44 }}
        >
          <span
            data-testid={`${testId}-title`}
            className="text-sm font-semibold text-gray-200"
          >
            {title}
          </span>
          <span className="text-xs text-gray-400">{collapsed ? '▸' : '▾'}</span>
        </button>
      ) : (
        <div
          data-testid={`${testId}-title`}
          className="text-sm font-semibold text-gray-200 mb-1"
        >
          {title}
        </div>
      )}
      {!collapsed && (
        <div data-testid={`${testId}-body`}>
          <TendencyStats stats={stats} />
          <div
            data-testid={`${testId}-footer`}
            className="text-[10px] text-gray-500 mt-2"
          >
            {resolvedFooter}
          </div>
        </div>
      )}
    </div>
  );
};

export default TendencyStatsCard;
