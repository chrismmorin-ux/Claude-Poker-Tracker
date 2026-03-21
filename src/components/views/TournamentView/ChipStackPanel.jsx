/**
 * ChipStackPanel.jsx - Per-seat chip stacks with editing
 *
 * Displays prominent players remaining stepper, pinned hero card,
 * chip stacks with M-ratio zones, and elimination controls.
 */

import React, { useState } from 'react';
import { Trash2, Layers } from 'lucide-react';
import { getMRatioZone, getGuidanceColor } from '../../../constants/tournamentConstants';
import { SEAT_ARRAY, LIMITS } from '../../../constants/gameConstants';
import { ordinalSuffix } from '../../../utils/displayUtils';
import { GOLD } from '../../../constants/designTokens';
import { IcmBadge } from '../../ui/IcmBadge';

/**
 * @param {Object} props
 * @param {Object} props.chipStacks - { [seat]: stack }
 * @param {Object} props.currentBlinds - { sb, bb, ante }
 * @param {Array} props.rankings - From projectFinishPosition
 * @param {number|null} props.playersRemaining
 * @param {number|null} props.heroSeat - Hero's seat number
 * @param {number|null} props.totalEntrants - Total entrants
 * @param {Object|null} props.mRatioGuidance - M-ratio guidance
 * @param {Object|null} props.icmPressure - ICM pressure info
 * @param {Function} props.onUpdateStack - (seat, stack) => void
 * @param {Function} props.onEliminate - (seat) => void
 * @param {Function} props.onSetPlayersRemaining - (count) => void
 */
export const ChipStackPanel = ({
  chipStacks,
  currentBlinds,
  rankings,
  playersRemaining,
  heroSeat,
  totalEntrants,
  mRatioGuidance,
  icmPressure,
  onUpdateStack,
  onEliminate,
  onSetPlayersRemaining,
}) => {
  const [editingSeat, setEditingSeat] = useState(null);
  const [editValue, setEditValue] = useState('');

  const costPerOrbit = currentBlinds.sb + currentBlinds.bb + (currentBlinds.ante * LIMITS.NUM_SEATS);

  const startEdit = (seat, currentStack) => {
    setEditingSeat(seat);
    setEditValue(currentStack?.toString() || '');
  };

  const commitEdit = () => {
    if (editingSeat != null && editValue !== '') {
      onUpdateStack(editingSeat, Number(editValue) || 0);
    }
    setEditingSeat(null);
    setEditValue('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') commitEdit();
    if (e.key === 'Escape') { setEditingSeat(null); setEditValue(''); }
  };

  // Get seats that have stacks
  const seatsWithStacks = SEAT_ARRAY.filter(s => chipStacks[s] != null);
  const maxStack = Math.max(1, ...seatsWithStacks.map(s => chipStacks[s] || 0));

  // Hero stack info
  const heroStack = heroSeat ? chipStacks[heroSeat] : null;
  const heroMRatio = heroStack != null && costPerOrbit > 0 ? heroStack / costPerOrbit : 0;
  const heroZone = getMRatioZone(heroMRatio);

  // Non-hero seats
  const otherSeats = seatsWithStacks.filter(s => s !== heroSeat);

  // M-ratio guidance colors
  const guidanceColor = getGuidanceColor(mRatioGuidance?.zone);

  const renderStackRow = (seat, isHero = false) => {
    const stack = chipStacks[seat] || 0;
    const mRatio = costPerOrbit > 0 ? stack / costPerOrbit : 0;
    const zone = getMRatioZone(mRatio);
    const ranking = rankings?.find(r => r.seat === seat);
    const barWidth = maxStack > 0 ? (stack / maxStack) * 100 : 0;

    return (
      <div key={seat} className="relative flex items-center justify-between text-sm py-1.5">
        {/* Background bar */}
        <div
          className="absolute inset-0 rounded"
          style={{
            width: `${barWidth}%`,
            backgroundColor: zone.color,
            opacity: 0.1,
          }}
        />
        <div className="relative flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: zone.color }} />
          <span className="text-gray-400 w-12">{isHero ? 'Hero' : `Seat ${seat}`}</span>
        </div>

        {/* Stack (editable) */}
        <div className="relative">
          {editingSeat === seat ? (
            <input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={handleKeyDown}
              autoFocus
              className="w-24 px-2 py-0.5 bg-gray-700 text-white border border-blue-500 rounded text-sm text-right"
            />
          ) : (
            <button
              onClick={() => startEdit(seat, stack)}
              className="text-white font-medium hover:text-blue-400 transition-colors"
            >
              {stack.toLocaleString()}
            </button>
          )}
        </div>

        {ranking && (
          <span className="relative text-xs text-gray-500 w-16 text-right">
            proj {ranking.projectedFinish}{ordinalSuffix(ranking.projectedFinish)}
          </span>
        )}

        <span className="relative text-xs w-10 text-right" style={{ color: zone.color }}>
          M{Math.round(mRatio)}
        </span>

        {!isHero && (
          <button
            onClick={() => onEliminate(seat)}
            className="relative p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="rounded-lg p-4 space-y-3" style={{
      background: '#1f2937',
      border: '1px solid rgba(212,168,71,0.3)',
    }}>
      {/* Players Remaining Stepper — prominent at top */}
      <div className="pb-3" style={{ borderBottom: '1px solid rgba(212,168,71,0.2)' }}>
        <h3 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: GOLD }}>
          Players Remaining
        </h3>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => onSetPlayersRemaining(Math.max(1, (playersRemaining || 2) - 1))}
            className="w-10 h-10 hover:bg-gray-600 text-gray-300 rounded-lg flex items-center justify-center text-xl font-bold transition-colors"
            style={{ backgroundColor: '#374151', border: `1px solid rgba(212,168,71,0.3)` }}
          >
            -
          </button>
          <div className="text-center">
            <span className="text-white font-bold text-2xl w-12 inline-block text-center">
              {playersRemaining ?? '?'}
            </span>
            {totalEntrants && (
              <div className="text-xs text-gray-500">from {totalEntrants}</div>
            )}
          </div>
          <button
            onClick={() => onSetPlayersRemaining((playersRemaining || 0) + 1)}
            className="w-10 h-10 hover:bg-gray-600 text-gray-300 rounded-lg flex items-center justify-center text-xl font-bold transition-colors"
            style={{ backgroundColor: '#374151', border: `1px solid rgba(212,168,71,0.3)` }}
          >
            +
          </button>
        </div>
      </div>

      {/* Pinned Hero Card */}
      {heroStack != null && (
        <div className="rounded-lg p-3 relative overflow-hidden" style={{
          background: 'rgba(212,168,71,0.05)',
          borderLeft: `4px solid ${GOLD}`,
          boxShadow: `0 0 12px rgba(212,168,71,0.15), inset 0 1px 0 rgba(212,168,71,0.1)`,
        }}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-bold text-lg">{heroStack.toLocaleString()}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-sm font-bold" style={{ color: heroZone.color }}>
                  M{Math.round(heroMRatio)}
                </span>
                <span className="text-xs" style={{ color: heroZone.color }}>
                  {heroZone.label}
                </span>
                {mRatioGuidance && guidanceColor && (
                  <span className="text-xs font-medium" style={{ color: guidanceColor }}>
                    {mRatioGuidance.label}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <IcmBadge icmPressure={icmPressure} />
            </div>
          </div>
          {/* Hero relative bar */}
          <div className="mt-2 w-full h-1.5 rounded-full bg-gray-700">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (heroStack / maxStack) * 100)}%`,
                backgroundColor: heroZone.color,
              }}
            />
          </div>
        </div>
      )}

      {/* Stack List Header */}
      <h3 className="text-xs font-medium uppercase tracking-wide" style={{ color: GOLD }}>
        Chip Stacks
      </h3>

      {/* Stack list (non-hero) */}
      <div className="space-y-0.5 max-h-36 overflow-y-auto">
        {otherSeats.length > 0 ? (
          otherSeats.map((seat) => renderStackRow(seat))
        ) : (
          seatsWithStacks.length === 0 && (
            <div className="flex flex-col items-center py-4 text-center">
              <Layers size={24} className="text-gray-600 mb-2" />
              <p className="text-sm text-gray-400">No chip stacks tracked</p>
              <p className="text-xs text-gray-500 mt-1">Add seats below to track chip counts</p>
            </div>
          )
        )}
      </div>

      {/* Add stack for new seat */}
      {seatsWithStacks.length < 9 && (
        <div className="flex gap-2">
          {SEAT_ARRAY.filter(s => chipStacks[s] == null).slice(0, 3).map(seat => (
            <button
              key={seat}
              onClick={() => {
                onUpdateStack(seat, 0);
                startEdit(seat, 0);
              }}
              className="text-xs px-2.5 py-1.5 hover:bg-gray-600 rounded-lg transition-colors"
              style={{
                backgroundColor: '#374151',
                border: `1px solid rgba(212,168,71,0.3)`,
                color: GOLD,
              }}
            >
              + Seat {seat}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
