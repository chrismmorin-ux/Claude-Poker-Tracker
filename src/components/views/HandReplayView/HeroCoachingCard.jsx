/**
 * HeroCoachingCard.jsx - Hero coaching analysis card for hand replay
 *
 * Shows EV assessment with numeric value, equity comparison bar,
 * optimal play suggestion, alternative actions, weakness pattern callout,
 * and (per SCF Gate 4 / WS-145) hero-leak inline annotation badge with
 * expanded CD-5 claim card + Drill/Dismiss/Snooze affordances.
 *
 * Per chris-live-player.md autonomy red lines #5 + #7:
 *   - No shame / engagement-pressure copy in leak claims
 *   - Editor's-note tone only
 * Lint-style enforcement in HeroCoachingCard.test.jsx.
 */

import React, { useState } from 'react';
import { EV_COLORS } from '../../../constants/designTokens';

export const HeroCoachingCard = ({ heroCoaching, leak = null, onSnooze = null, onDismiss = null, onDrill = null }) => {
  if (!heroCoaching && !leak) return null;
  // Allow leak-only rendering (e.g., when heroCoaching is degraded but a leak fired
  // from prior aggregated data). Common case: both present.
  if (!heroCoaching) heroCoaching = {};

  const ev = heroCoaching.evAssessment?.expectedValue;
  // Only show numeric EV for calls/folds (precise) — bet/raise EV uses full-range equity, not calling range
  const hasNumericEV = ev != null && isFinite(ev) && heroCoaching.evAssessment?.equityNeeded != null;
  const alternatives = heroCoaching.evAssessment?.alternatives;

  return (
    <div className="shrink-0 bg-cyan-900/20 rounded-lg p-3 border border-cyan-700/40">
      <div className="text-cyan-400 text-[10px] font-semibold mb-2">Hero Coaching</div>

      {/* Hero EV assessment */}
      {heroCoaching.evAssessment && (
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-bold"
            style={{
              backgroundColor: EV_COLORS[heroCoaching.evAssessment.verdict]?.bg || '#374151',
              color: EV_COLORS[heroCoaching.evAssessment.verdict]?.text || '#9ca3af',
            }}
          >
            {heroCoaching.evAssessment.verdict}
          </span>
          {hasNumericEV && (
            <span style={{
              fontSize: 10, fontWeight: 700, fontFamily: 'monospace',
              color: ev >= 0 ? '#4ade80' : '#f87171',
            }}>
              {ev >= 0 ? '+' : ''}{ev.toFixed(1)} EV
            </span>
          )}
          <span className="text-gray-400 text-[10px]">
            {heroCoaching.evAssessment.reason}
          </span>
        </div>
      )}

      {/* Equity comparison */}
      {heroCoaching.evAssessment?.equityNeeded != null && (
        <div className="flex items-center gap-2 mb-1.5">
          <div className="flex-1 h-3 bg-gray-800 rounded-full overflow-hidden relative">
            {/* Needed threshold marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
              style={{ left: `${Math.round(heroCoaching.evAssessment.equityNeeded * 100)}%` }}
            />
            {/* Actual equity bar */}
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round(heroCoaching.evAssessment.actualEquity * 100)}%`,
                backgroundColor: heroCoaching.evAssessment.actualEquity > heroCoaching.evAssessment.equityNeeded
                  ? '#22c55e' : '#ef4444',
              }}
            />
          </div>
          <span className="text-gray-400 text-[9px] whitespace-nowrap">
            {Math.round(heroCoaching.evAssessment.actualEquity * 100)}% vs {Math.round(heroCoaching.evAssessment.equityNeeded * 100)}% needed
          </span>
        </div>
      )}

      {/* Optimal play suggestion */}
      {heroCoaching.optimalPlay && (
        <div className="text-gray-500 text-[10px] mt-1">
          <span className="text-cyan-300">{heroCoaching.optimalPlay.suggestedAction}</span>
          {' — '}{heroCoaching.optimalPlay.reason}
        </div>
      )}

      {/* Alternative actions with EV comparison */}
      {alternatives && alternatives.length > 0 && (
        <div style={{
          display: 'flex', gap: 8, marginTop: 4, paddingTop: 3,
          borderTop: '1px solid rgba(103, 232, 249, 0.1)',
        }}>
          {alternatives.map(alt => (
            <span key={alt.action} style={{
              fontSize: 9, fontFamily: 'monospace',
              color: alt.ev >= 0 ? '#4ade80' : '#f87171',
            }}>
              {alt.action}: {alt.ev >= 0 ? '+' : ''}{alt.ev.toFixed(1)}
            </span>
          ))}
        </div>
      )}

      {/* Weakness pattern callout */}
      {heroCoaching.weaknessMatch && (
        <div className="mt-2 bg-amber-900/30 rounded px-2 py-1.5 border border-amber-600/30">
          <div className="text-amber-400 text-[10px] font-semibold">
            {heroCoaching.weaknessMatch.weakness.label}
          </div>
          <div className="text-amber-300/70 text-[9px]">
            {heroCoaching.weaknessMatch.message}
          </div>
        </div>
      )}

      {/* SCF Gate 4 / WS-145 — hero-leak inline annotation */}
      {leak && (
        <HeroLeakBadge leak={leak} onSnooze={onSnooze} onDismiss={onDismiss} onDrill={onDrill} />
      )}
    </div>
  );
};

const HeroLeakBadge = ({ leak, onSnooze, onDismiss, onDrill }) => {
  const [expanded, setExpanded] = useState(false);
  const pct = (n) => (n != null ? `${Math.round(n * 100)}%` : '—');

  return (
    <div
      className="mt-2 bg-amber-900/20 rounded border border-amber-600/30"
      data-testid="hero-leak-badge"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-2 py-1.5 flex items-center justify-between"
        aria-expanded={expanded}
        aria-controls="hero-leak-claim-card"
      >
        <span className="text-amber-400 text-[10px] font-semibold">
          ⚑ leak: {leak.label}
        </span>
        <span className="text-gray-500 text-[10px]" aria-hidden>
          {expanded ? '▲' : '▶ tap'}
        </span>
      </button>
      {expanded && (
        <div
          id="hero-leak-claim-card"
          className="px-2 pb-2 pt-1 space-y-1 border-t border-amber-700/30"
          data-testid="hero-leak-claim-card"
        >
          {/* CD-5 4 mandatory fields */}
          <div className="text-amber-300/90 text-[10px] font-semibold" data-testid="cd5-field-situation">
            {leak.label}
          </div>
          <div className="text-amber-200/80 text-[10px]" data-testid="cd5-field-observation">
            fold-to-cbet rate {pct(leak.observedRate)} [{pct(leak.ciLower)}, {pct(leak.ciUpper)}] over {leak.sampleSize} hands
          </div>
          <div className="text-amber-200/80 text-[10px]" data-testid="cd5-field-baseline">
            Solver baseline: {pct(leak.solverBaseline)}
          </div>
          <div className="text-amber-200/60 text-[9px]" data-testid="cd5-field-threshold">
            Sample threshold: 30 hands
          </div>
          {leak.relatedConceptId && (
            <div className="text-amber-200/60 text-[9px]" data-testid="cd5-related-drill">
              Related drill: {leak.relatedConceptId}
            </div>
          )}
          {/* Affordances */}
          <div className="flex gap-1.5 pt-2 mt-1 border-t border-amber-700/30">
            {onDrill && (
              <button
                type="button"
                onClick={() => onDrill(leak)}
                className="px-2 py-0.5 text-[10px] bg-amber-700/40 hover:bg-amber-700/60 text-amber-100 rounded"
                data-testid="leak-affordance-drill"
              >
                Drill this
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={() => onDismiss(leak)}
                className="px-2 py-0.5 text-[10px] bg-gray-700/60 hover:bg-gray-600/60 text-gray-200 rounded"
                data-testid="leak-affordance-dismiss"
              >
                Dismiss
              </button>
            )}
            {onSnooze && (
              <button
                type="button"
                onClick={() => onSnooze(leak)}
                className="px-2 py-0.5 text-[10px] bg-gray-700/60 hover:bg-gray-600/60 text-gray-200 rounded"
                data-testid="leak-affordance-snooze"
              >
                Snooze
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
