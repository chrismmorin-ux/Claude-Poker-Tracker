/**
 * ChipStackPanel.jsx - Per-seat chip stacks with editing
 *
 * Displays chip stacks, M-ratio zones, projected finishes,
 * and elimination controls.
 */

import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { getMRatioZone } from '../../../constants/tournamentConstants';
import { SEAT_ARRAY, LIMITS } from '../../../constants/gameConstants';
import { ordinalSuffix } from '../../../utils/displayUtils';

/**
 * @param {Object} props
 * @param {Object} props.chipStacks - { [seat]: stack }
 * @param {Object} props.currentBlinds - { sb, bb, ante }
 * @param {Array} props.rankings - From projectFinishPosition
 * @param {number|null} props.playersRemaining
 * @param {Function} props.onUpdateStack - (seat, stack) => void
 * @param {Function} props.onEliminate - (seat) => void
 * @param {Function} props.onSetPlayersRemaining - (count) => void
 */
export const ChipStackPanel = ({
  chipStacks,
  currentBlinds,
  rankings,
  playersRemaining,
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
    if (editingSeat && editValue) {
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

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
        Chip Stacks
      </h3>

      {/* Stack list */}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {seatsWithStacks.length > 0 ? (
          seatsWithStacks.map((seat) => {
            const stack = chipStacks[seat] || 0;
            const mRatio = costPerOrbit > 0 ? stack / costPerOrbit : 0;
            const zone = getMRatioZone(mRatio);
            const ranking = rankings?.find(r => r.seat === seat);

            return (
              <div key={seat} className="flex items-center justify-between text-sm py-1">
                <div className="flex items-center gap-2">
                  {/* M-ratio color dot */}
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: zone.color }}
                  />
                  <span className="text-gray-400 w-12">Seat {seat}</span>
                </div>

                {/* Stack (editable) */}
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

                {/* Projected finish */}
                {ranking && (
                  <span className="text-xs text-gray-500 w-16 text-right">
                    proj {ranking.projectedFinish}{ordinalSuffix(ranking.projectedFinish)}
                  </span>
                )}

                {/* M-ratio */}
                <span className="text-xs w-10 text-right" style={{ color: zone.color }}>
                  M{Math.round(mRatio)}
                </span>

                {/* Eliminate */}
                <button
                  onClick={() => onEliminate(seat)}
                  className="p-1 text-red-400 hover:bg-red-900/30 rounded transition-colors"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-gray-500">Tap "Add Stack" to enter chip counts</p>
        )}
      </div>

      {/* Add stack for new seat */}
      {seatsWithStacks.length < 9 && (
        <div className="flex gap-2">
          {SEAT_ARRAY.filter(s => chipStacks[s] == null).slice(0, 3).map(seat => (
            <button
              key={seat}
              onClick={() => startEdit(seat, 0)}
              className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
            >
              + Seat {seat}
            </button>
          ))}
        </div>
      )}

      {/* Players remaining counter */}
      <div className="border-t border-gray-700 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-400">Players Remaining</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onSetPlayersRemaining(Math.max(1, (playersRemaining || 2) - 1))}
              className="w-7 h-7 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center justify-center text-lg"
            >
              -
            </button>
            <span className="text-white font-bold text-lg w-10 text-center">
              {playersRemaining ?? '?'}
            </span>
            <button
              onClick={() => onSetPlayersRemaining((playersRemaining || 0) + 1)}
              className="w-7 h-7 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded flex items-center justify-center text-lg"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

