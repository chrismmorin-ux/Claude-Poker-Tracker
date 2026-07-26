/**
 * RangeDetailPanel.jsx - Modal overlay for detailed range visualization
 *
 * Combines position/action filters with RangeGrid + summary stats.
 * Launchable from any view via onClose callback.
 */

import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { RangeGrid } from './RangeGrid';
import { RANGE_POSITIONS } from '../../utils/rangeEngine';
import { rangeWidth } from '../../utils/pokerCore/rangeMatrix';

const DISPLAY_ACTIONS = {
  noRaise: [
    { key: 'open', label: 'Open' },
    { key: 'limp', label: 'Limp' },
  ],
  facedRaise: [
    { key: 'coldCall', label: 'Cold-Call' },
    { key: 'threeBet', label: '3-Bet' },
  ],
};

/**
 * Derived line subclasses (POKER_THEORY §2.5), shown as a refinement row
 * beneath their parent.
 *
 * EVIDENCE GATE: a subclass pill appears only once the villain has actually
 * been observed taking that line. Every subclass grid carries prior mass, so
 * its posterior width never reaches 0 — rendering an unbacked pill would show
 * a confident-looking "Squeeze: 8%" built from nothing but the prior. This is
 * the same trap that kept a rangeRules rule dead until WS-223. Until there is
 * evidence, the parent pill IS the honest aggregate.
 */
const DISPLAY_SUBCLASSES = {
  noRaise: [
    { key: 'openFirstIn', label: 'First-In', parent: 'open' },
    { key: 'isoRaise', label: 'Iso', parent: 'open' },
  ],
  facedRaise: [
    { key: 'cold3Bet', label: 'Cold 3-Bet', parent: 'threeBet' },
    { key: 'squeeze', label: 'Squeeze', parent: 'threeBet' },
    { key: 'limpReraise', label: 'Limp-3Bet', parent: 'threeBet' },
  ],
};

const POSITION_LABELS = {
  EARLY: 'EP',
  MIDDLE: 'MP',
  LATE: 'LP',
  SB: 'SB',
  BB: 'BB',
};

/**
 * @param {Object} props
 * @param {Object|null} props.rangeProfile - Full range profile
 * @param {Object|null} props.rangeSummary - Range width summary
 * @param {string} props.playerName - Display name
 * @param {Function} props.onClose - Close handler
 * @param {boolean} props.isOpen - Visibility flag
 */
export const RangeDetailPanel = ({
  rangeProfile,
  rangeSummary,
  playerName,
  onClose,
  isOpen,
}) => {
  const [position, setPosition] = useState('LATE');
  const [scenario, setScenario] = useState('noRaise'); // 'noRaise' or 'facedRaise'
  const [action, setAction] = useState('open');

  // When scenario changes, default to first action
  const handleScenarioChange = (newScenario) => {
    setScenario(newScenario);
    setAction(DISPLAY_ACTIONS[newScenario][0].key);
  };

  // BB can't open/limp (no noRaise scenario except defend)
  const availableScenarios = position === 'BB'
    ? ['facedRaise']
    : ['noRaise', 'facedRaise'];

  // Reset scenario if BB selected and currently on noRaise
  const effectiveScenario = position === 'BB' && scenario === 'noRaise' ? 'facedRaise' : scenario;
  const effectiveAction = effectiveScenario !== scenario ? DISPLAY_ACTIONS[effectiveScenario][0].key : action;

  const weights = useMemo(() => {
    if (!rangeProfile?.ranges?.[position]?.[effectiveAction]) return null;
    return rangeProfile.ranges[position][effectiveAction];
  }, [rangeProfile, position, effectiveAction]);

  const showdownIndices = useMemo(() => {
    if (!rangeProfile?.showdownAnchors) return new Set();
    const indices = new Set();
    for (const anchor of rangeProfile.showdownAnchors) {
      if (anchor.position === position && anchor.action === effectiveAction && anchor.handIndex != null) {
        indices.add(anchor.handIndex);
      }
    }
    return indices;
  }, [rangeProfile, position, effectiveAction]);

  const positionSummary = rangeSummary?.[position];
  const handCount = positionSummary?.hands || 0;
  const width = weights ? rangeWidth(weights) : 0;

  // Subclass pills, gated on observed evidence (see DISPLAY_SUBCLASSES).
  const availableSubclasses = useMemo(() => {
    const summarySubs = positionSummary?.subclasses;
    if (!summarySubs) return [];
    return DISPLAY_SUBCLASSES[effectiveScenario].filter(
      (s) => (summarySubs[s.key]?.count || 0) > 0
    );
  }, [positionSummary, effectiveScenario]);

  const selectedSubclass = positionSummary?.subclasses?.[effectiveAction] || null;

  // Get observed frequency for selected action
  const getFrequency = () => {
    if (!positionSummary) return null;
    if (selectedSubclass) return selectedSubclass.pct;
    if (effectiveScenario === 'noRaise') {
      return positionSummary.noRaiseFreqs?.[effectiveAction] ?? null;
    }
    return positionSummary.facedRaiseFreqs?.[effectiveAction] ?? null;
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-5 max-w-[480px] w-[95vw] max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-lg font-bold text-gray-800">{playerName} — Range</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none px-1"
          >
            x
          </button>
        </div>

        {!rangeProfile ? (
          <div className="text-center text-gray-400 py-8">No range data available</div>
        ) : (
          <>
            {/* Position pills */}
            <div className="flex gap-1 mb-2">
              {RANGE_POSITIONS.map((pos) => (
                <button
                  key={pos}
                  onClick={() => setPosition(pos)}
                  className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                    position === pos
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {POSITION_LABELS[pos]}
                </button>
              ))}
            </div>

            {/* Scenario toggle */}
            <div className="flex gap-1 mb-2">
              {availableScenarios.map((sc) => (
                <button
                  key={sc}
                  onClick={() => handleScenarioChange(sc)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    effectiveScenario === sc
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {sc === 'noRaise' ? 'No Raise Faced' : 'Facing Raise'}
                </button>
              ))}
            </div>

            {/* Action pills */}
            <div className="flex gap-1 mb-3">
              {DISPLAY_ACTIONS[effectiveScenario].map((a) => (
                <button
                  key={a.key}
                  onClick={() => setAction(a.key)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    effectiveAction === a.key
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>

            {/* Derived-line refinement pills — only once observed */}
            {availableSubclasses.length > 0 && (
              <div className="flex gap-1 mb-3 items-center pl-2 border-l-2 border-gray-200">
                {availableSubclasses.map((s) => (
                  <button
                    key={s.key}
                    onClick={() => setAction(s.key)}
                    title={`${s.label} — ${positionSummary.subclasses[s.key].count} observed`}
                    className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                      effectiveAction === s.key
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-50 text-gray-500 hover:bg-gray-200'
                    }`}
                  >
                    {s.label}
                    <span className="ml-1 opacity-70">{positionSummary.subclasses[s.key].count}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Grid */}
            <div className="flex justify-center mb-3">
              <RangeGrid
                weights={weights}
                showdownIndices={showdownIndices}
                size="full"
                sampleSize={handCount}
              />
            </div>

            {/* Summary row */}
            <div className="flex justify-between text-xs text-gray-600 bg-gray-50 rounded px-3 py-2">
              <span>Range: <strong>{width}%</strong></span>
              <span>Observed: <strong>{getFrequency() != null ? `${getFrequency()}%` : '--'}</strong></span>
              <span>
                {selectedSubclass ? 'Seen: ' : 'Hands: '}
                <strong>{selectedSubclass ? selectedSubclass.count : handCount}</strong>
              </span>
            </div>

            {/* Thin-evidence honesty: a subclass shrinks toward its parent, so
                say so rather than presenting a confident-looking narrow range. */}
            {selectedSubclass && selectedSubclass.count < 3 && (
              <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-3 py-1.5">
                Only {selectedSubclass.count} observed — this range is mostly inherited
                from their overall {selectedSubclass.parent === 'threeBet' ? '3-bet' : 'open'} range.
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default RangeDetailPanel;
