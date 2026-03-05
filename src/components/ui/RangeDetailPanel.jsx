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
import { rangeWidth } from '../../utils/exploitEngine/rangeMatrix';

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
      if (anchor.position === position && anchor.action === effectiveAction && anchor.gridIndex != null) {
        indices.add(anchor.gridIndex);
      }
    }
    return indices;
  }, [rangeProfile, position, effectiveAction]);

  const positionSummary = rangeSummary?.[position];
  const handCount = positionSummary?.hands || 0;
  const width = weights ? rangeWidth(weights) : 0;

  // Get observed frequency for selected action
  const getFrequency = () => {
    if (!positionSummary) return null;
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
        className="bg-white rounded-lg shadow-xl p-5 max-w-[480px] w-[95vw]"
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
              <span>Hands: <strong>{handCount}</strong></span>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  );
};

export default RangeDetailPanel;
