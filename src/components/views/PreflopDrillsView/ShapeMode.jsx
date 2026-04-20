import React, { useEffect, useMemo, useState } from 'react';
import { HandPicker } from './HandPicker';
import { MatchupBreakdown } from './MatchupBreakdown';
import { computeHandVsHand, parseHandClass } from '../../../utils/pokerCore/preflopEquity';
import { classifyHero, classifyLane } from '../../../utils/drillContent/shapes';
import { classifyMatchup } from '../../../utils/drillContent/frameworks';

/**
 * ShapeMode — hero-POV "shape catalog" surface.
 *
 * User picks their actual holding; UI displays the shape it falls into and
 * every lane (villain-shape category) the hand can face, with calibrated
 * equity bands and modifier deltas. Clicking any sample villain reveals
 * exact equity via MatchupBreakdown, reusing the same panel as Explorer/
 * Library/Estimate modes.
 *
 * This is the manifestation of the shapes catalog from Phase A — what the
 * Lessons tab teaches, this tab lets the user *navigate* from their own
 * cards.
 */
export const ShapeMode = ({ initialHand = 'AKs' }) => {
  const [hand, setHand] = useState(initialHand);
  const [selectedVillain, setSelectedVillain] = useState(null);
  const [result, setResult] = useState(null);
  const [matches, setMatches] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const heroShape = useMemo(() => {
    try { return classifyHero(hand); } catch { return null; }
  }, [hand]);

  // Reset villain selection when hand changes.
  useEffect(() => {
    setSelectedVillain(null);
    setResult(null);
    setMatches(null);
    setError(null);
  }, [hand]);

  const openVillain = (villain) => {
    setSelectedVillain(villain);
    setLoading(true);
    setResult(null);
    setMatches(null);
    setError(null);
    setTimeout(() => {
      try {
        const r = computeHandVsHand(hand, villain);
        const m = classifyMatchup(parseHandClass(hand), parseHandClass(villain));
        setResult(r);
        setMatches(m);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  return (
    <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
      <div className="overflow-y-auto pr-2 flex flex-col gap-4">
        <HandPicker label="Your hand" value={hand} onChange={setHand} />
        {heroShape ? (
          <ShapePanel
            shape={heroShape}
            heroHand={hand}
            onVillainClick={openVillain}
            selectedVillain={selectedVillain}
          />
        ) : (
          <div className="bg-rose-900/30 border border-rose-700 rounded-lg p-4 text-sm text-rose-200">
            Could not classify "{hand}" into a shape. Pick a different hand.
          </div>
        )}
      </div>

      <div className="overflow-y-auto">
        {selectedVillain ? (
          error ? (
            <div className="bg-red-900/30 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
              {error}
            </div>
          ) : (
            <MatchupBreakdown
              handALabel={hand}
              handBLabel={selectedVillain}
              result={result}
              frameworkMatches={matches}
              loading={loading}
            />
          )
        ) : (
          <div className="bg-gray-800/50 border border-gray-800 rounded-lg p-6 min-h-[400px] flex items-center justify-center text-sm text-gray-500 text-center px-8">
            Pick a sample villain in any lane on the left to see exact equity and the framework breakdown.
          </div>
        )}
      </div>
    </div>
  );
};

const ShapePanel = ({ shape, heroHand, onVillainClick, selectedVillain }) => (
  <div className="bg-gray-800 border border-gray-700 rounded-lg p-5">
    <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Your shape</div>
    <div className="text-2xl font-bold text-white">{shape.name}</div>
    <p className="text-xs text-gray-400 mt-2">
      {shape.lanes.length} structural lanes you can fall into. Each shows the equity band hero
      should expect, plus modifier deltas to apply mentally.
    </p>

    <div className="mt-5 space-y-2">
      {shape.lanes.map((lane) => (
        <LaneRow
          key={lane.id}
          lane={lane}
          heroHand={heroHand}
          onVillainClick={onVillainClick}
          selectedVillain={selectedVillain}
        />
      ))}
    </div>
  </div>
);

const LaneRow = ({ lane, heroHand, onVillainClick, selectedVillain }) => {
  // Verify each rep canonically routes back to this lane (skips reps that
  // are shadowed by an earlier lane in the catalog ordering).
  const villains = useMemo(() => {
    const reps = lane.representatives || [];
    return reps.filter((v) => {
      try {
        const { lane: routed } = classifyLane(heroHand, v);
        return routed?.id === lane.id;
      } catch {
        return false;
      }
    });
  }, [lane, heroHand]);

  const bandPct = `${(lane.band[0] * 100).toFixed(0)}–${(lane.band[1] * 100).toFixed(0)}%`;
  const baseLabel = `${(lane.baseEquity * 100).toFixed(0)}%`;

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-gray-100">{lane.villainDesc}</div>
          <div className="text-xs text-gray-500 mt-0.5 font-mono">{lane.id}</div>
        </div>
        <div className="text-right whitespace-nowrap">
          <div className="text-lg font-bold text-emerald-400">{baseLabel}</div>
          <div className="text-[10px] uppercase tracking-wide text-gray-500">band {bandPct}</div>
        </div>
      </div>

      {Object.keys(lane.modifiers).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {Object.entries(lane.modifiers).map(([key, delta]) => (
            <span
              key={key}
              className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                delta > 0 ? 'bg-emerald-900/60 text-emerald-300' : 'bg-rose-900/60 text-rose-300'
              }`}
              title={modifierTooltip(key)}
            >
              {modifierLabel(key)} {delta > 0 ? '+' : ''}{(delta * 100).toFixed(1)}%
            </span>
          ))}
        </div>
      )}

      {villains.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {villains.map((v) => (
            <button
              key={v}
              onClick={() => onVillainClick(v)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                selectedVillain === v
                  ? 'bg-purple-700 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const MODIFIER_LABELS = {
  heroSuited: 'hero suited',
  villainSuited: 'opp suited',
  flushDominator: 'flush dom',
  flushDominated: 'flush dom\'d',
  connectedness: 'connected',
};
const MODIFIER_TOOLTIPS = {
  heroSuited: 'Mental adjustment if hero is suited (vs the offsuit baseline this band assumes).',
  villainSuited: 'Mental adjustment if villain is suited.',
  flushDominator: 'When both suited and hero holds the higher flush card.',
  flushDominated: 'When both suited and hero holds the lower flush card.',
  connectedness: 'Per step closer the two ranks become (gap shrinks).',
};
const modifierLabel = (key) => MODIFIER_LABELS[key] || key;
const modifierTooltip = (key) => MODIFIER_TOOLTIPS[key] || '';
