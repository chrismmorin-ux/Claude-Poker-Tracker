/**
 * SessionForm.jsx - New session creation form
 *
 * Modal form for starting a new poker session.
 * Allows optional buy-in, goal selection, and notes.
 */

import React, { useState } from 'react';
import { SESSION_GOALS, VENUES, GAME_TYPES, GAME_TYPE_KEYS } from '../../constants/sessionConstants';

/**
 * SessionForm component
 * @param {Object} props
 * @param {Function} props.onSubmit - Callback when form is submitted: (sessionData) => void
 * @param {Function} props.onCancel - Callback when form is cancelled
 * @param {number} props.scale - Scale factor for responsive design
 * @param {string} props.defaultGameType - Default game type from previous session
 * @param {string} props.defaultVenue - Default venue from previous session
 */
export const SessionForm = ({ onSubmit, onCancel, scale = 1, defaultGameType = '', defaultVenue = '' }) => {
  // Initialize with defaults from previous session
  const initialGameType = defaultGameType || 'ONE_TWO'; // Default to 1/2 if no previous session
  const initialBuyIn = GAME_TYPES[initialGameType]?.buyInDefault || 200;

  const [venue, setVenue] = useState(defaultVenue || '');
  const [gameType, setGameType] = useState(initialGameType);
  const [buyIn, setBuyIn] = useState(initialBuyIn.toString());
  const [goal, setGoal] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  // Handle game type selection
  const handleGameTypeSelect = (key) => {
    setGameType(key);
    // Auto-fill buy-in based on game type
    const defaultBuyIn = GAME_TYPES[key].buyInDefault;
    setBuyIn(defaultBuyIn > 0 ? defaultBuyIn.toString() : '');
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    // Validation
    const newErrors = {};

    // Venue is optional - no validation needed

    if (!gameType) {
      newErrors.gameType = 'Game type is required';
    }

    if (buyIn && (isNaN(buyIn) || parseFloat(buyIn) <= 0)) {
      newErrors.buyIn = 'Buy-in must be a positive number';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // Prepare session data
    const sessionData = {
      venue,
      gameType: GAME_TYPES[gameType].label,
      buyIn: buyIn ? parseFloat(buyIn) : null,
      goal: goal === 'Custom goal...' ? customGoal : goal || null,
      notes: notes || null
    };

    onSubmit(sessionData);
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-96"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Start New Session</h2>
          <button
            onClick={onCancel}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Game Type - First field */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Game Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {GAME_TYPE_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleGameTypeSelect(key)}
                  className={`px-3 py-2 rounded font-medium transition-colors ${
                    gameType === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {GAME_TYPES[key].label}
                </button>
              ))}
            </div>
            {errors.gameType && (
              <p className="text-red-500 text-xs mt-1">{errors.gameType}</p>
            )}
          </div>

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.venue ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select venue...</option>
              {VENUES.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {errors.venue && (
              <p className="text-red-500 text-xs mt-1">{errors.venue}</p>
            )}
          </div>

          {/* Buy-in */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Buy-in
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                $
              </span>
              <input
                type="text"
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value)}
                placeholder="200"
                className={`w-full pl-7 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.buyIn ? 'border-red-500' : 'border-gray-300'
                }`}
              />
            </div>
            {errors.buyIn && (
              <p className="text-red-500 text-xs mt-1">{errors.buyIn}</p>
            )}
          </div>

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Goal (optional)
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a goal...</option>
              {SESSION_GOALS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Goal Input */}
          {goal === 'Custom goal...' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Custom Goal
              </label>
              <input
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Enter your custom goal"
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for this session..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700 transition-colors font-medium"
            >
              Start Session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
