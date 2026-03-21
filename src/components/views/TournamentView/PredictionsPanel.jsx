/**
 * PredictionsPanel.jsx - Tournament milestone projections
 *
 * Shows milestone estimates, personal blind-out breakdown,
 * and projected finish position with progress bar.
 */

import React from 'react';
import { calculateOrbitsUntilBlindOut } from '../../../utils/tournamentEngine';
import { ordinalSuffix, formatMinutesHuman } from '../../../utils/displayUtils';
import { LIMITS } from '../../../constants/gameConstants';

const MILESTONE_LABELS = {
  final_table: 'Final Table',
  bubble: 'Bubble',
  heads_up: 'Heads Up',
  winner: 'Winner',
};

/**
 * @param {Object} props
 * @param {Object|null} props.predictions - From TournamentContext
 * @param {number} props.heroStack - Hero's current chip stack
 * @param {Object} props.config - Tournament config
 * @param {number} props.currentLevelIndex - Current blind level
 * @param {number|null} props.playersRemaining - Players remaining
 * @param {number|null} props.totalEntrants - Total entrants
 */
export const PredictionsPanel = ({
  predictions,
  heroStack,
  config,
  currentLevelIndex,
  playersRemaining,
  totalEntrants,
}) => {
  // Personal blind-out calculation
  const blindOut = heroStack > 0 && config.blindSchedule?.length > 0
    ? calculateOrbitsUntilBlindOut(
        heroStack,
        config.blindSchedule,
        currentLevelIndex,
        LIMITS.NUM_SEATS,
        config.handPaceSeconds
      )
    : null;

  // Hero's projected finish from rankings
  const heroRanking = predictions?.finishProjections?.rankings?.find(r => r.stack === heroStack);

  // Progress percentage
  const progress = totalEntrants && playersRemaining
    ? ((totalEntrants - playersRemaining) / (totalEntrants - 1)) * 100
    : 0;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 space-y-4">
      {/* Event Projections */}
      <div>
        <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
          Event Projections
        </h3>
        {predictions?.milestones?.length > 0 ? (
          <div className="space-y-1">
            {predictions.milestones.map((m) => (
              <div key={m.milestone} className="flex justify-between text-sm">
                <span className="text-gray-300">{MILESTONE_LABELS[m.milestone] || m.milestone}</span>
                <span className="text-white font-medium">{formatMinutesHuman(m.estimatedMinutes)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-gray-500">
            {predictions?.dropoutRate
              ? 'Waiting for more data...'
              : 'Record eliminations to enable projections'}
          </p>
        )}
        {predictions?.dropoutRate && (
          <div className="mt-1 text-xs text-gray-500">
            Confidence: <span className={
              predictions.dropoutRate.confidence === 'high' ? 'text-green-400' :
              predictions.dropoutRate.confidence === 'medium' ? 'text-yellow-400' :
              'text-red-400'
            }>{predictions.dropoutRate.confidence}</span>
          </div>
        )}
      </div>

      {/* Your Blind-Out */}
      {blindOut && heroStack > 0 && (
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wide">
            Your Blind-Out
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">{heroStack.toLocaleString()} chips survives</span>
              <span className="text-white font-medium">
                {(blindOut.blindOutLevel - currentLevelIndex).toFixed(1)} levels ({formatMinutesHuman(Math.round(blindOut.wallClockMinutes))})
              </span>
            </div>
            {heroRanking && (
              <div className="flex justify-between">
                <span className="text-gray-300">Projected finish</span>
                <span className="text-white font-medium">
                  ~{heroRanking.projectedFinish}{ordinalSuffix(heroRanking.projectedFinish)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {totalEntrants && (
        <div>
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${Math.min(100, progress)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

