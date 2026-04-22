/**
 * SessionForm.jsx - New session creation form
 *
 * Modal form for starting a new poker session.
 * Allows optional buy-in, goal selection, and notes.
 * Uses settings context for dynamic venues and game types.
 */

import React, { useState } from 'react';
import { SESSION_GOALS } from '../../constants/sessionConstants';
import { BLIND_SCHEDULES } from '../../constants/tournamentConstants';
import { useSettings } from '../../contexts';
import { TournamentSetupForm } from './TournamentSetupForm';

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
  // Get venues and game types from settings (includes custom ones)
  const { allVenues, allGameTypes, allGameTypeKeys } = useSettings();

  // Initialize with defaults from previous session
  const initialGameType = defaultGameType || 'ONE_TWO'; // Default to 1/2 if no previous session
  const initialBuyIn = allGameTypes[initialGameType]?.buyInDefault || 200;

  const [venue, setVenue] = useState(defaultVenue || '');
  const [gameType, setGameType] = useState(initialGameType);
  const [buyIn, setBuyIn] = useState(initialBuyIn.toString());
  const [goal, setGoal] = useState('');
  const [customGoal, setCustomGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState({});

  // AUDIT-2026-04-21-SV F6: dirty-state tracking for backdrop-tap guard.
  // The form is "dirty" when the user has diverged from the initial (default-seeded)
  // state. Backdrop taps on a dirty form are ignored — the explicit × / Cancel
  // buttons remain the only dismissal path. Preserves between-hands-chris's draft
  // across accidental miss-taps (H-PLT08).
  const initialBuyInStr = initialBuyIn.toString();
  const isDirty =
    venue !== (defaultVenue || '') ||
    gameType !== initialGameType ||
    buyIn !== initialBuyInStr ||
    goal !== '' ||
    customGoal !== '' ||
    notes !== '';

  const handleBackdropClick = () => {
    if (isDirty) return; // Miss-tap protection; explicit × button still works.
    onCancel();
  };
  const [tournamentConfig, setTournamentConfig] = useState({
    format: 'freezeout',
    startingStack: 10000,
    entryFee: 0,
    totalEntrants: null,
    payoutSlots: null,
    blindSchedule: BLIND_SCHEDULES.STANDARD_20MIN,
    handPaceSeconds: 30,
  });

  const isTournament = gameType === 'TOURNAMENT';

  // Handle game type selection
  const handleGameTypeSelect = (key) => {
    setGameType(key);
    // Auto-fill buy-in based on game type
    const defaultBuyIn = allGameTypes[key].buyInDefault;
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
      gameType: allGameTypes[gameType].label,
      buyIn: isTournament ? (tournamentConfig.entryFee || null) : (buyIn ? parseFloat(buyIn) : null),
      goal: goal === 'Custom goal...' ? customGoal : goal || null,
      notes: notes || null
    };

    if (isTournament) {
      onSubmit(sessionData, tournamentConfig);
    } else {
      onSubmit(sessionData);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-6 w-96"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Start New Session</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-200 text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Game Type - First field */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Game Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {allGameTypeKeys.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleGameTypeSelect(key)}
                  className={`px-3 py-2 rounded font-medium transition-colors ${
                    gameType === key
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {allGameTypes[key].label}
                </button>
              ))}
            </div>
            {errors.gameType && (
              <p className="text-red-500 text-xs mt-1">{errors.gameType}</p>
            )}
          </div>

          {/* Tournament Setup (shown when Tournament selected) */}
          {isTournament && (
            <TournamentSetupForm config={tournamentConfig} onChange={setTournamentConfig} />
          )}

          {/* Venue */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Venue
            </label>
            <select
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className={`w-full px-3 py-2 bg-gray-700 text-gray-200 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                errors.venue ? 'border-red-500' : 'border-gray-600'
              }`}
            >
              <option value="">Select venue...</option>
              {allVenues.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            {errors.venue && (
              <p className="text-red-500 text-xs mt-1">{errors.venue}</p>
            )}
          </div>

          {/* Buy-in (hidden for tournaments - entry fee is in tournament config) */}
          {!isTournament && <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Buy-in
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                $
              </span>
              <input
                type="text"
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value)}
                placeholder="200"
                className={`w-full pl-7 pr-3 py-2 bg-gray-700 text-gray-200 border rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  errors.buyIn ? 'border-red-500' : 'border-gray-600'
                }`}
              />
            </div>
            {errors.buyIn && (
              <p className="text-red-500 text-xs mt-1">{errors.buyIn}</p>
            )}
          </div>}

          {/* Goal */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Goal (optional)
            </label>
            <select
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Custom Goal
              </label>
              <input
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="Enter your custom goal"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes for this session..."
              rows={3}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-200 bg-gray-700 rounded hover:bg-gray-600 transition-colors"
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
