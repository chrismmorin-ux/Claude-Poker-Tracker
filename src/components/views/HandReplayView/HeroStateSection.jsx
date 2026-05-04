/**
 * @file HeroStateSection — first consumer surface for the Hero State Primitive.
 *
 * Renders inside HandReplayView's ReviewPanel between HeroCoachingCard and
 * VillainAnalysisSection. Active only on hero-action steps; renders the
 * canonical reasoning frame from buildHeroState() side-by-side with hero's
 * actual action in neutral editor's-note tone.
 *
 * Spec: WS-143 / SPR-029. Gate 1 audit:
 *   docs/design/audits/2026-05-03-entry-hero-state-narrative.md
 * Surface: docs/design/surfaces/hand-replay-view.md §"HeroStateSection"
 *
 * Autonomy red lines (chris-live-player.md):
 *   #5 — no shame / engagement-pressure copy. Alignment labels are neutral
 *        editor's-note tone. Lint-style enforcement in tests.
 *   #8 — no cross-surface contamination. This component renders ONLY
 *        inside HandReplayView/ — not on live-table surfaces.
 *
 * Persistence: HSP rederives via buildHeroState() per decision-point view
 * (no IDB cache for v1 per HSP-DESIGN.md §10.2 caching deferral).
 */

import React, { useEffect, useState, useMemo } from 'react';
import { buildHeroState } from '../../../utils/heroState/buildHeroState.js';
import { reconstructGameStateAt, detectAlignment } from './heroStateReplayUtils.js';

export const HeroStateSection = ({
  hand,
  currentActionEntry,
  visibleActions,
  heroSeat,
  buttonSeat,
  villainProfile = null,
  villainRange = null,
  villainModel = null,
}) => {
  const [heroState, setHeroState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const isHeroAction = !!(
    heroSeat
    && currentActionEntry
    && Number(currentActionEntry.seat) === Number(heroSeat)
  );

  useEffect(() => {
    if (!isHeroAction) {
      setHeroState(null);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    let gameState;
    try {
      gameState = reconstructGameStateAt({
        hand,
        visibleActions,
        currentActionEntry,
        heroSeat,
        buttonSeat,
      });
    } catch (err) {
      if (!cancelled) {
        setError(err.message || 'Could not reconstruct game state');
        setLoading(false);
      }
      return;
    }

    const heroHand = hand?.cardState?.heroCards || hand?.cardState?.myCards || null;
    if (!heroHand) {
      if (!cancelled) {
        setError('Hero cards unavailable for this hand');
        setLoading(false);
      }
      return;
    }

    buildHeroState({
      gameState,
      heroHand,
      villainProfile,
      villainRange,
      villainModel,
    })
      .then((hs) => {
        if (!cancelled) {
          setHeroState(hs);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not compute reasoning frame');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    isHeroAction,
    hand,
    currentActionEntry,
    visibleActions,
    heroSeat,
    buttonSeat,
    villainProfile,
    villainRange,
    villainModel,
  ]);

  if (!isHeroAction) return null;

  return (
    <div
      className="bg-indigo-900/30 border border-indigo-500/30 rounded-lg p-2 space-y-2"
      data-testid="hero-state-section"
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full text-left flex justify-between items-center"
        aria-expanded={!collapsed}
        aria-controls="hero-state-section-body"
      >
        <span className="text-indigo-400 text-[10px] font-semibold uppercase tracking-wide">
          Reasoning Frame
        </span>
        <span className="text-gray-500 text-[10px]" aria-hidden>
          {collapsed ? '▼' : '▲'}
        </span>
      </button>
      {!collapsed && (
        <div id="hero-state-section-body">
          {loading && (
            <div className="text-gray-500 text-xs italic" data-testid="hero-state-loading">
              Computing canonical frame…
            </div>
          )}
          {!loading && error && (
            <div className="text-gray-500 text-xs italic" data-testid="hero-state-error">
              No reasoning frame available — {error}
            </div>
          )}
          {!loading && !error && heroState && (
            <SideBySidePanels heroState={heroState} actualAction={currentActionEntry} />
          )}
        </div>
      )}
    </div>
  );
};

// ─── Side-by-side panels ─────────────────────────────────────────────────

const SideBySidePanels = ({ heroState, actualAction }) => {
  const alignment = useMemo(
    () => detectAlignment(actualAction, heroState?.plan?.primary),
    [actualAction, heroState],
  );
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="hero-state-side-by-side">
      <CanonicalPanel narrative={heroState?.narrative} plan={heroState?.plan} />
      <ActualPanel action={actualAction} alignment={alignment} />
    </div>
  );
};

const CanonicalPanel = ({ narrative, plan }) => (
  <div
    className="bg-gray-800/40 border border-gray-700 rounded p-2 space-y-2 text-xs"
    data-testid="hero-state-canonical-panel"
  >
    <div className="text-indigo-400 text-[10px] font-semibold uppercase tracking-wide">
      Canonical
    </div>
    {narrative?.headline && (
      <div className="text-white font-semibold leading-snug">{narrative.headline}</div>
    )}
    {plan?.primary && (
      <div className="text-gray-300 text-[11px]">
        {plan.primary.action}
        {plan.primary.sizing != null ? ` ${plan.primary.sizing}` : ''}
      </div>
    )}
    {narrative?.body && (
      <div className="text-gray-400 text-[11px] leading-relaxed whitespace-pre-line">
        {narrative.body}
      </div>
    )}
    {narrative?.branchSummary && (
      <div className="text-gray-500 text-[10px] leading-snug whitespace-pre-line border-t border-gray-700 pt-2">
        {narrative.branchSummary}
      </div>
    )}
  </div>
);

const ActualPanel = ({ action, alignment }) => (
  <div
    className="bg-gray-800/40 border border-gray-700 rounded p-2 space-y-2 text-xs"
    data-testid="hero-state-actual-panel"
  >
    <div className="text-purple-300 text-[10px] font-semibold uppercase tracking-wide">
      Your Action
    </div>
    <div className="text-white font-semibold">
      {action?.action ?? '—'}
      {action?.amount != null ? ` ${action.amount}` : ''}
    </div>
    <div
      className="text-gray-400 text-[11px] leading-relaxed"
      data-testid={`hero-state-alignment-${alignment.kind}`}
    >
      {alignment.label}
    </div>
  </div>
);
