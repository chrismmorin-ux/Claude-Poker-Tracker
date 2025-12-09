import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Square } from 'lucide-react';
import { VENUES, GAME_TYPES, GAME_TYPE_KEYS, SESSION_GOALS } from '../../../constants/sessionConstants';
import { formatTime12Hour, calculateTotalRebuy } from '../../../utils/displayUtils';

/**
 * ActiveSessionCard - Display and edit the current active session
 */
export const ActiveSessionCard = ({
  currentSession,
  onEndSession,
  onUpdateField,
}) => {
  // Local editing state
  const [editingBuyIn, setEditingBuyIn] = useState(false);
  const [editingVenue, setEditingVenue] = useState(false);
  const [editingGameType, setEditingGameType] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [addingRebuy, setAddingRebuy] = useState(false);

  const [buyInValue, setBuyInValue] = useState('');
  const [venueValue, setVenueValue] = useState('');
  const [gameTypeValue, setGameTypeValue] = useState('');
  const [goalValue, setGoalValue] = useState('');
  const [rebuyAmount, setRebuyAmount] = useState('');

  // Format relative time
  const formatRelativeTime = (timestamp) => {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  // Get default rebuy amount based on game type
  const getDefaultRebuyAmount = (gameTypeLabel) => {
    const gameType = Object.values(GAME_TYPES).find(gt => gt.label === gameTypeLabel);
    return gameType?.rebuyDefault || 200;
  };

  // Handlers
  const handleBuyInUpdate = () => {
    const parsed = parseFloat(buyInValue);
    if (!isNaN(parsed)) {
      onUpdateField('buyIn', parsed);
    }
    setEditingBuyIn(false);
  };

  const handleGoalUpdate = () => {
    onUpdateField('goal', goalValue);
    setEditingGoal(false);
  };

  const handleStartAddRebuy = () => {
    const defaultAmount = getDefaultRebuyAmount(currentSession.gameType);
    setRebuyAmount(defaultAmount.toString());
    setAddingRebuy(true);
  };

  const handleConfirmRebuy = () => {
    const parsedAmount = parseFloat(rebuyAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) return;

    onUpdateField('rebuyTransactions', [
      ...currentSession.rebuyTransactions,
      { timestamp: Date.now(), amount: parsedAmount }
    ]);
    setAddingRebuy(false);
  };

  const handleCancelRebuy = () => {
    setAddingRebuy(false);
    setRebuyAmount('');
  };

  if (!currentSession.isActive || !currentSession.sessionId) {
    return null;
  }

  return (
    <div className="mb-6 bg-gradient-to-r from-green-500 to-green-600 rounded-lg shadow-lg p-6 text-white">
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold mb-1">
            {currentSession.venue} - {currentSession.gameType} - {formatTime12Hour(currentSession.startTime)}
          </h2>
          <p className="text-green-100">
            Started {formatRelativeTime(currentSession.startTime)}
          </p>
        </div>
        <button
          onClick={onEndSession}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors flex items-center gap-2"
        >
          <Square size={16} />
          End Session
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        {/* Hands */}
        <div className="bg-white/10 rounded-lg p-3">
          <div className="text-green-100 mb-1">Hands</div>
          <div className="text-2xl font-bold">{currentSession.handCount || 0}</div>
        </div>

        {/* Buy-in + Session Total */}
        <div className="bg-white/10 rounded-lg p-3">
          <div className="text-green-100 mb-1">Initial Buy-in</div>
          {editingBuyIn ? (
            <input
              type="number"
              value={buyInValue}
              onChange={(e) => setBuyInValue(e.target.value)}
              onBlur={handleBuyInUpdate}
              className="w-full px-2 py-1 text-gray-900 rounded"
              autoFocus
            />
          ) : (
            <div
              onClick={() => {
                setBuyInValue((currentSession.buyIn || '').toString());
                setEditingBuyIn(true);
              }}
              className="text-2xl font-bold mb-2 cursor-pointer hover:bg-white/10 rounded px-2 py-1"
            >
              ${currentSession.buyIn || '---'}
            </div>
          )}
          <div className="text-green-100 text-xs mb-1">Session Total</div>
          <div className="text-2xl font-bold">
            ${(currentSession.buyIn || 0) + calculateTotalRebuy(currentSession.rebuyTransactions)}
          </div>
        </div>

        {/* Rebuys */}
        <div className="bg-white/10 rounded-lg p-3">
          <div className="text-green-100 mb-1">Rebuys</div>
          {addingRebuy ? (
            <div className="space-y-2">
              <input
                type="number"
                value={rebuyAmount}
                onChange={(e) => setRebuyAmount(e.target.value)}
                className="w-full px-2 py-1 text-gray-900 rounded"
                autoFocus
              />
              <div className="flex gap-2">
                <button
                  onClick={handleConfirmRebuy}
                  className="flex-1 px-2 py-1 bg-white/20 hover:bg-white/30 rounded text-xs"
                >
                  Confirm
                </button>
                <button
                  onClick={handleCancelRebuy}
                  className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 rounded text-xs"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleStartAddRebuy}
              className="w-full px-3 py-2 bg-white/20 hover:bg-white/30 rounded text-sm"
            >
              + Add Rebuy
            </button>
          )}

          {/* Rebuy transaction list */}
          {currentSession.rebuyTransactions && currentSession.rebuyTransactions.length > 0 && (
            <div className="mt-3 space-y-1 max-h-24 overflow-y-auto">
              {currentSession.rebuyTransactions.map((tx, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span>{formatTime12Hour(tx.timestamp)}</span>
                  <span>${tx.amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Venue and Game Type */}
      <div className="mt-4 bg-white/10 rounded-lg p-3">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Venue */}
          <div className="flex items-center gap-2">
            <span className="text-green-100 text-sm">Venue:</span>
            {editingVenue ? (
              <select
                value={venueValue}
                onChange={(e) => {
                  const newVenue = e.target.value;
                  setVenueValue(newVenue);
                  onUpdateField('venue', newVenue);
                  setEditingVenue(false);
                }}
                onBlur={() => setEditingVenue(false)}
                className="px-2 py-1 text-gray-900 rounded"
                autoFocus
              >
                {VENUES.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            ) : (
              <div
                onClick={() => {
                  setVenueValue(currentSession.venue || VENUES[0]);
                  setEditingVenue(true);
                }}
                className="text-lg cursor-pointer hover:bg-white/10 rounded px-2 py-1 font-medium"
              >
                {currentSession.venue || 'Click to set'}
              </div>
            )}
          </div>

          {/* Game Type */}
          <div className="flex items-center gap-2">
            <span className="text-green-100 text-sm">Game Type:</span>
            {editingGameType ? (
              <select
                value={gameTypeValue}
                onChange={(e) => {
                  setGameTypeValue(e.target.value);
                  const gameTypeLabel = GAME_TYPES[e.target.value]?.label;
                  if (gameTypeLabel) {
                    onUpdateField('gameType', gameTypeLabel);
                  }
                  setEditingGameType(false);
                }}
                onBlur={() => setEditingGameType(false)}
                className="px-2 py-1 text-gray-900 rounded"
                autoFocus
              >
                {GAME_TYPE_KEYS.map((key) => (
                  <option key={key} value={key}>{GAME_TYPES[key].label}</option>
                ))}
              </select>
            ) : (
              <div
                onClick={() => {
                  const currentKey = GAME_TYPE_KEYS.find(
                    key => GAME_TYPES[key].label === currentSession.gameType
                  ) || GAME_TYPE_KEYS[0];
                  setGameTypeValue(currentKey);
                  setEditingGameType(true);
                }}
                className="text-lg cursor-pointer hover:bg-white/10 rounded px-2 py-1 font-medium"
              >
                {currentSession.gameType || 'Click to set'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Goal */}
      <div className="mt-4">
        <div className="text-green-100 text-sm mb-1">Goal</div>
        {editingGoal ? (
          <select
            value={goalValue}
            onChange={(e) => setGoalValue(e.target.value)}
            onBlur={handleGoalUpdate}
            className="w-full px-3 py-2 text-gray-900 rounded"
            autoFocus
          >
            <option value="">No specific goal</option>
            {Object.values(SESSION_GOALS).map((goal) => (
              <option key={goal} value={goal}>{goal}</option>
            ))}
          </select>
        ) : (
          <div
            onClick={() => {
              setGoalValue(currentSession.goal || '');
              setEditingGoal(true);
            }}
            className="text-lg cursor-pointer hover:bg-white/10 rounded px-2 py-1"
          >
            {currentSession.goal || 'Click to set goal'}
          </div>
        )}
      </div>
    </div>
  );
};

ActiveSessionCard.propTypes = {
  currentSession: PropTypes.shape({
    isActive: PropTypes.bool,
    sessionId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    startTime: PropTypes.number,
    venue: PropTypes.string,
    gameType: PropTypes.string,
    buyIn: PropTypes.number,
    handCount: PropTypes.number,
    goal: PropTypes.string,
    rebuyTransactions: PropTypes.arrayOf(PropTypes.shape({
      timestamp: PropTypes.number,
      amount: PropTypes.number,
    })),
  }).isRequired,
  onEndSession: PropTypes.func.isRequired,
  onUpdateField: PropTypes.func.isRequired,
};
