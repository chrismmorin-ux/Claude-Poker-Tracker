import React, { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT } from '../../../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import { PrimitiveActionButton } from '../../ui/PrimitiveActionButton';
import { getValidActions } from '../../../utils/actionUtils';
import { hasBetOrRaiseOnStreet, getActionsForSeatOnStreet } from '../../../utils/sequenceUtils';
import { getSizingOptions, getCurrentBet } from '../../../utils/potCalculator';
import { useGame } from '../../../contexts';

/**
 * ActionPanel - Action buttons panel for selected seats
 */
export const ActionPanel = ({
  selectedPlayers,
  currentStreet,
  onClearSelection,
  onToggleAbsent,
  onClearSeatActions,
  onUndoLastAction,
  onAdvanceSeat,
}) => {
  const { recordPrimitiveAction, potInfo, blinds, actionSequence } = useGame();
  const [customValue, setCustomValue] = useState('');

  const isMultiSeat = selectedPlayers.length > 1;
  const hasBet = currentStreet !== 'preflop' ? hasBetOrRaiseOnStreet(actionSequence, currentStreet) : false;
  const validActions = getValidActions(currentStreet, hasBet, isMultiSeat);

  // Determine if bet or raise is available (for inline sizing)
  const sizingAction = !isMultiSeat
    ? validActions.find(a => a === PRIMITIVE_ACTIONS.BET || a === PRIMITIVE_ACTIONS.RAISE)
    : null;
  const nonSizingActions = validActions.filter(a => a !== PRIMITIVE_ACTIONS.BET && a !== PRIMITIVE_ACTIONS.RAISE);

  // Compute the current bet (call amount)
  const currentBet = getCurrentBet(actionSequence, currentStreet);
  const callAmount = currentStreet === 'preflop' && currentBet === 0 ? blinds.bb : currentBet;

  // Always compute sizing options when bet/raise is available
  const sizingOptions = sizingAction
    ? getSizingOptions(
        currentStreet,
        sizingAction,
        blinds,
        potInfo.total,
        currentBet
      )
    : [];

  const handleRecordAction = useCallback((action) => {
    if (!recordPrimitiveAction) return;
    selectedPlayers.forEach(seat => {
      recordPrimitiveAction(seat, action);
    });
    // Auto-advance to next seat
    if (!isMultiSeat && onAdvanceSeat) {
      onAdvanceSeat(selectedPlayers[0]);
    }
  }, [recordPrimitiveAction, isMultiSeat, selectedPlayers, onAdvanceSeat]);

  const handleSizeSelected = useCallback((amount) => {
    if (!recordPrimitiveAction || !sizingAction) return;
    const seat = selectedPlayers[0];
    recordPrimitiveAction(seat, sizingAction, amount);
    // Auto-advance to next seat
    if (onAdvanceSeat) {
      onAdvanceSeat(seat);
    }
  }, [recordPrimitiveAction, sizingAction, selectedPlayers, onAdvanceSeat]);

  const handleCustomSubmit = useCallback((e) => {
    e.preventDefault();
    const val = parseFloat(customValue);
    if (!isNaN(val) && val > 0) {
      handleSizeSelected(val);
      setCustomValue('');
    }
  }, [customValue, handleSizeSelected]);

  if (selectedPlayers.length === 0 || currentStreet === 'showdown') {
    return null;
  }

  const singleSeat = selectedPlayers.length === 1 ? selectedPlayers[0] : null;
  const actionArray = singleSeat ? getActionsForSeatOnStreet(actionSequence, singleSeat, currentStreet) : [];

  return (
    <div
      className="absolute bg-white rounded-lg shadow-2xl p-3"
      style={{
        width: `${LAYOUT.ACTION_PANEL_WIDTH}px`,
        top: `${LAYOUT.ACTION_PANEL_TOP}px`,
        right: '8px',
      }}
    >
      <div className="flex justify-between items-center mb-2 pb-1.5 border-b-2">
        <h3 className="text-xl font-bold">
          {singleSeat
            ? `Seat ${singleSeat}`
            : `${selectedPlayers.length} Seats: ${selectedPlayers.sort((a,b) => a-b).join(', ')}`
          }
        </h3>
        <div className="text-sm font-semibold text-blue-600 uppercase">{currentStreet}</div>
      </div>

      {/* Current action sequence display - only for single seat */}
      {singleSeat && actionArray.length > 0 && (
        <div className="mb-2 p-1.5 bg-blue-50 rounded">
          <ActionSequence
            actions={actionArray}
            size="medium"
            maxVisible={5}
          />
        </div>
      )}

      {/* Action buttons (non-sizing: fold, check, call) */}
      <div className={`grid ${isMultiSeat ? (validActions.length <= 3 ? 'grid-cols-3' : validActions.length <= 4 ? 'grid-cols-4' : 'grid-cols-5') : 'grid-cols-3'} gap-1.5`}>
        {(isMultiSeat ? validActions : nonSizingActions).map(action => (
          action === PRIMITIVE_ACTIONS.CALL && callAmount > 0 ? (
            <button
              key={action}
              type="button"
              onClick={() => handleRecordAction(action)}
              className="bg-blue-300 hover:bg-blue-400 text-white px-3 py-2 rounded font-bold text-sm transition-colors duration-150"
            >
              Call ${callAmount}
            </button>
          ) : (
            <PrimitiveActionButton
              key={action}
              action={action}
              onClick={handleRecordAction}
            />
          )
        ))}
      </div>

      {/* Inline sizing options - always visible when bet/raise is available */}
      {sizingAction && sizingOptions.length > 0 && (
        <div className="mt-2 p-2 bg-gray-100 rounded border border-gray-300">
          <div className="text-xs font-semibold text-gray-500 mb-1.5">
            {sizingAction === PRIMITIVE_ACTIONS.BET ? 'Bet' : 'Raise'} Size:
          </div>
          <div className="grid grid-cols-4 gap-1.5 mb-1.5">
            {sizingOptions.map(({ label, amount }) => (
              <button
                key={label}
                onClick={() => handleSizeSelected(amount)}
                className="py-1.5 px-1 bg-green-500 hover:bg-green-600 text-white rounded font-bold text-xs shadow"
              >
                <div>{label}</div>
                <div className="text-[10px] opacity-90">${amount}</div>
              </button>
            ))}
          </div>
          <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
            <div className="flex-1 flex items-center gap-1">
              <span className="text-gray-600 font-bold text-sm">$</span>
              <input
                type="number"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Custom"
                min="1"
                step="any"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-semibold focus:border-green-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={!customValue || parseFloat(customValue) <= 0}
              className="px-2 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded font-bold text-sm"
            >
              OK
            </button>
          </form>
        </div>
      )}

      <div className="flex gap-1.5 mt-2">
        <button onClick={onClearSelection} className="flex-1 py-1.5 bg-gray-600 hover:bg-gray-700 text-white rounded font-semibold text-sm">Clear</button>
        <button onClick={onToggleAbsent} className="flex-1 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded font-semibold text-sm">Absent</button>
      </div>

      {/* Clear and Undo buttons - only for single seat with actions */}
      {singleSeat && actionArray.length > 0 && (
        <div className="flex gap-1.5 mt-1.5">
          <button
            onClick={() => onClearSeatActions([singleSeat])}
            className="flex-1 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded font-semibold text-sm"
          >
            Clear Actions
          </button>
          <button
            onClick={() => onUndoLastAction(singleSeat)}
            className="flex-1 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded font-semibold text-sm"
          >
            ↶ Undo
          </button>
        </div>
      )}
    </div>
  );
};

ActionPanel.propTypes = {
  selectedPlayers: PropTypes.arrayOf(PropTypes.number).isRequired,
  currentStreet: PropTypes.string.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onToggleAbsent: PropTypes.func.isRequired,
  onClearSeatActions: PropTypes.func.isRequired,
  onUndoLastAction: PropTypes.func.isRequired,
  onAdvanceSeat: PropTypes.func.isRequired,
};
