/**
 * BlindTimerBar.jsx - Tournament blind level timer display
 *
 * Shows current level, SB/BB/ante, countdown, next level preview,
 * pause/resume controls, and players remaining counter.
 */

import React from 'react';
import { Pause, Play, SkipForward } from 'lucide-react';
import { formatMsToTimer } from '../../../utils/displayUtils';

/**
 * @param {Object} props
 * @param {Object} props.currentBlinds - { sb, bb, ante, durationMinutes }
 * @param {Object|null} props.nextBlinds - Next level blinds
 * @param {number} props.currentLevelIndex - Current level index
 * @param {number} props.levelTimeRemaining - ms remaining in level
 * @param {boolean} props.isPaused - Timer paused state
 * @param {number|null} props.playersRemaining - Players remaining
 * @param {number|null} props.totalEntrants - Total entrants
 * @param {Function} props.onPause - Pause handler
 * @param {Function} props.onResume - Resume handler
 * @param {Function} props.onSkipLevel - Skip to next level
 */
export const BlindTimerBar = ({
  currentBlinds,
  nextBlinds,
  currentLevelIndex,
  levelTimeRemaining,
  isPaused,
  playersRemaining,
  totalEntrants,
  onPause,
  onResume,
  onSkipLevel,
}) => {
  const isLowTime = levelTimeRemaining < 120000; // < 2 minutes

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      {/* Top row: Level info + timer + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 font-medium">
            Level {currentLevelIndex + 1}
          </span>
          <span className="text-lg font-bold text-white">
            {currentBlinds.sb.toLocaleString()}/{currentBlinds.bb.toLocaleString()}
            {currentBlinds.ante > 0 && (
              <span className="text-gray-400 text-sm ml-1">
                ante {currentBlinds.ante.toLocaleString()}
              </span>
            )}
          </span>
          {nextBlinds && (
            <span className="text-xs text-gray-500">
              Next: {nextBlinds.sb.toLocaleString()}/{nextBlinds.bb.toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Timer countdown */}
          <span className={`text-2xl font-mono font-bold ${
            isLowTime ? 'text-red-400' : 'text-green-400'
          }`}>
            {formatMsToTimer(levelTimeRemaining)}
          </span>

          {/* Pause/Resume */}
          <button
            onClick={isPaused ? onResume : onPause}
            className={`p-2 rounded transition-colors ${
              isPaused
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-yellow-600 hover:bg-yellow-700 text-white'
            }`}
          >
            {isPaused ? <Play size={16} /> : <Pause size={16} />}
          </button>

          {/* Skip level */}
          <button
            onClick={onSkipLevel}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>

      {/* Bottom row: Players remaining */}
      {playersRemaining != null && (
        <div className="mt-1 text-sm text-gray-400">
          Players: <span className="text-white font-medium">{playersRemaining}</span>
          {totalEntrants && <span>/{totalEntrants}</span>} remaining
        </div>
      )}
    </div>
  );
};
