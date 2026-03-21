/**
 * BlindTimerBar.jsx - Tournament blind level timer display
 *
 * Shows current level, SB/BB/ante, countdown, next level preview,
 * pause/resume controls, level progress bar, and lockout badge.
 */

import React from 'react';
import { Pause, Play, SkipForward, PauseCircle } from 'lucide-react';
import { formatMsToTimer } from '../../../utils/displayUtils';
import { GOLD } from '../../../constants/designTokens';

/**
 * @param {Object} props
 * @param {Object} props.currentBlinds - { sb, bb, ante, durationMinutes }
 * @param {Object|null} props.nextBlinds - Next level blinds
 * @param {number} props.currentLevelIndex - Current level index
 * @param {number} props.levelTimeRemaining - ms remaining in level
 * @param {number} props.levelDurationMs - Total level duration in ms
 * @param {boolean} props.isPaused - Timer paused state
 * @param {number|null} props.playersRemaining - Players remaining
 * @param {number|null} props.totalEntrants - Total entrants
 * @param {Object|null} props.lockoutInfo - Lockout proximity info
 * @param {Function} props.onPause - Pause handler
 * @param {Function} props.onResume - Resume handler
 * @param {Function} props.onSkipLevel - Skip to next level
 */
export const BlindTimerBar = ({
  currentBlinds,
  nextBlinds,
  currentLevelIndex,
  levelTimeRemaining,
  levelDurationMs,
  isPaused,
  playersRemaining,
  totalEntrants,
  lockoutInfo,
  onPause,
  onResume,
  onSkipLevel,
}) => {
  const isLowTime = levelTimeRemaining < 120000; // < 2 minutes
  const levelProgress = levelDurationMs > 0 ? 1 - (levelTimeRemaining / levelDurationMs) : 0;

  return (
    <div className="rounded-lg p-3 relative overflow-hidden" style={{
      background: '#1f2937',
      border: isPaused
        ? '1px solid rgba(234,179,8,0.4)'
        : '1px solid rgba(212,168,71,0.3)',
    }}>
      {/* Paused overlay badge */}
      {isPaused && (
        <div className="absolute top-1 right-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold z-10" style={{
          backgroundColor: 'rgba(234,179,8,0.2)',
          color: '#eab308',
          border: '1px solid rgba(234,179,8,0.3)',
        }}>
          <PauseCircle size={12} />
          PAUSED
        </div>
      )}

      {/* Top row: Level info + timer + controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className="text-xs font-bold px-2 py-0.5 rounded" style={{
            backgroundColor: 'rgba(212,168,71,0.2)',
            color: GOLD,
          }}>
            Lvl {currentLevelIndex + 1}
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
          {/* Lockout badge */}
          {lockoutInfo?.isApproaching && (
            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{
              backgroundColor: 'rgba(245,158,11,0.2)',
              color: '#f59e0b',
              border: '1px solid rgba(245,158,11,0.3)',
            }}>
              Lockout in {lockoutInfo.levelsUntilLockout} lvl{lockoutInfo.levelsUntilLockout !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Timer countdown */}
          <span
            className={`text-2xl font-mono font-bold ${
              isPaused ? 'opacity-50' : isLowTime ? 'text-red-400 animate-pulse' : 'text-green-400'
            }`}
            style={isLowTime && !isPaused ? {
              textShadow: '0 0 8px rgba(248,113,113,0.5)',
            } : undefined}
          >
            {formatMsToTimer(levelTimeRemaining)}
          </span>

          {/* Pause/Resume */}
          <button
            onClick={isPaused ? onResume : onPause}
            className={`p-2.5 rounded-lg transition-colors ${
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
            className="p-2.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
          >
            <SkipForward size={16} />
          </button>
        </div>
      </div>

      {/* Players remaining */}
      {playersRemaining != null && (
        <div className="mt-1 text-sm text-gray-400">
          Players: <span className="text-white font-medium">{playersRemaining}</span>
          {totalEntrants && <span>/{totalEntrants}</span>} remaining
        </div>
      )}

      {/* Level progress bar */}
      <div className="mt-2 w-full h-0.5 rounded-full" style={{ backgroundColor: 'rgba(212,168,71,0.15)' }}>
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(100, Math.max(0, levelProgress * 100))}%`,
            backgroundColor: GOLD,
          }}
        />
      </div>
    </div>
  );
};
