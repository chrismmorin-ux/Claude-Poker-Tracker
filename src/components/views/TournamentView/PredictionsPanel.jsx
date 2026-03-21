/**
 * PredictionsPanel.jsx - Tournament milestone projections
 *
 * Shows unified vertical timeline with milestone estimates,
 * lockout/blind-out nodes, and projected finish position.
 */

import React, { useMemo } from 'react';
import { Clock } from 'lucide-react';
import { ordinalSuffix, formatMinutesHuman } from '../../../utils/displayUtils';
import { GOLD } from '../../../constants/designTokens';

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
 * @param {Object|null} props.icmPressure - ICM pressure info
 * @param {Object|null} props.lockoutInfo - Lockout proximity info
 * @param {Object|null} props.blindOutInfo - Blind-out projection
 * @param {number|null} props.heroSeat - Hero's seat number
 */
export const PredictionsPanel = ({
  predictions,
  heroStack,
  config,
  currentLevelIndex,
  playersRemaining,
  totalEntrants,
  icmPressure,
  lockoutInfo,
  blindOutInfo,
  heroSeat,
}) => {
  // Hero's projected finish from rankings (match by seat, not stack)
  const heroRanking = heroSeat != null
    ? predictions?.finishProjections?.rankings?.find(r => r.seat === heroSeat)
    : null;

  // Progress percentage
  const progress = totalEntrants && playersRemaining
    ? ((totalEntrants - playersRemaining) / (totalEntrants - 1)) * 100
    : 0;

  // Build unified timeline
  const timelineNodes = useMemo(() => {
    const nodes = [];

    // Add milestones from predictions
    if (predictions?.milestones?.length > 0) {
      for (const m of predictions.milestones) {
        const isBubble = m.milestone === 'bubble';
        const bubbleHighlight = isBubble && icmPressure &&
          (icmPressure.zone === 'approaching' || icmPressure.zone === 'bubble');
        nodes.push({
          type: m.milestone,
          label: MILESTONE_LABELS[m.milestone] || m.milestone,
          estimatedMinutes: m.estimatedMinutes,
          isPast: false,
          bubbleHighlight,
        });
      }
    }

    // Add lockout node
    if (lockoutInfo && !lockoutInfo.isPastLockout) {
      nodes.push({
        type: 'lockout',
        label: 'Rebuy Freeze',
        estimatedMinutes: lockoutInfo.minutesUntilLockout,
        isPast: false,
      });
    }

    // Add blind-out node
    if (blindOutInfo && heroStack > 0) {
      nodes.push({
        type: 'blind_out',
        label: 'Blind Out',
        estimatedMinutes: blindOutInfo.wallClockMinutes,
        isPast: false,
      });
    }

    // Sort by estimated minutes ascending
    nodes.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes);

    return nodes;
  }, [predictions?.milestones, lockoutInfo, blindOutInfo, heroStack, icmPressure]);

  // Find the next approaching milestone (first non-past)
  const nextMilestoneIdx = timelineNodes.findIndex(n => !n.isPast);

  const getNodeColor = (node, idx) => {
    if (node.type === 'lockout') return '#f59e0b'; // amber
    if (node.type === 'blind_out') return '#ef4444'; // red
    if (node.bubbleHighlight) return '#ef4444'; // red for bubble pressure
    if (idx === nextMilestoneIdx) return GOLD;
    return '#9ca3af'; // gray-400
  };

  return (
    <div className="bg-gray-800 border rounded-lg p-4 space-y-4" style={{ borderColor: 'rgba(212,168,71,0.3)' }}>
      {/* Event Projections Header */}
      <h3 className="text-sm font-medium uppercase tracking-wide" style={{ color: GOLD }}>
        Event Timeline
      </h3>

      {/* Vertical Timeline */}
      {timelineNodes.length > 0 ? (
        <div className="relative pl-4">
          {/* Vertical rail */}
          <div
            className="absolute left-1 top-1 bottom-1 w-0.5"
            style={{ backgroundColor: 'rgba(212,168,71,0.3)' }}
          />

          <div className="space-y-3">
            {timelineNodes.map((node, idx) => {
              const color = getNodeColor(node, idx);
              const isNext = idx === nextMilestoneIdx;

              return (
                <div key={`${node.type}-${idx}`} className="relative flex items-center gap-3 rounded px-1 py-0.5"
                  style={isNext ? { backgroundColor: 'rgba(212,168,71,0.08)' } : undefined}
                >
                  {/* Dot on rail */}
                  <div
                    className="absolute rounded-full"
                    style={{
                      left: '-13px',
                      width: isNext ? '10px' : '8px',
                      height: isNext ? '10px' : '8px',
                      backgroundColor: isNext ? color : 'transparent',
                      border: `2px solid ${color}`,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      boxShadow: isNext ? `0 0 6px ${color}` : 'none',
                    }}
                  />

                  {/* Label + time */}
                  <div className="flex-1 flex justify-between items-center">
                    <span
                      className="text-sm font-medium"
                      style={{ color: isNext ? '#f3f4f6' : '#9ca3af' }}
                    >
                      {node.label}
                      {node.type === 'lockout' && (
                        <span className="ml-1 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>
                          rebuy
                        </span>
                      )}
                    </span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: isNext ? '#ffffff' : '#6b7280' }}
                    >
                      {formatMinutesHuman(Math.round(node.estimatedMinutes))}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-4 text-center">
          <Clock size={24} className="text-gray-600 mb-2" />
          <p className="text-sm text-gray-400">
            {predictions?.dropoutRate
              ? 'Waiting for more data...'
              : 'No projections yet'}
          </p>
          <p className="text-xs text-gray-500 mt-1">Record eliminations to build the timeline</p>
        </div>
      )}

      {/* Confidence */}
      {predictions?.dropoutRate && (
        <div className="text-xs text-gray-500">
          Confidence: <span className={
            predictions.dropoutRate.confidence === 'high' ? 'text-green-400' :
            predictions.dropoutRate.confidence === 'medium' ? 'text-yellow-400' :
            'text-red-400'
          }>{predictions.dropoutRate.confidence}</span>
        </div>
      )}

      {/* Your Blind-Out */}
      {blindOutInfo && heroStack > 0 && (
        <div className="rounded-lg p-2.5" style={{
          backgroundColor: blindOutInfo.levelsRemaining < 3
            ? 'rgba(239,68,68,0.08)'
            : 'transparent',
          border: blindOutInfo.levelsRemaining < 3
            ? '1px solid rgba(239,68,68,0.2)'
            : 'none',
        }}>
          <h3 className="text-sm font-medium uppercase tracking-wide mb-2" style={{ color: GOLD }}>
            Your Blind-Out
          </h3>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-300">{heroStack.toLocaleString()} chips survives</span>
              <span className="text-white font-medium">
                {blindOutInfo.levelsRemaining.toFixed(1)} levels ({formatMinutesHuman(blindOutInfo.wallClockMinutes)})
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
          <div className="relative w-full bg-gray-700 rounded-full h-2.5">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, progress)}%`, backgroundColor: GOLD }}
            />
            {progress > 20 && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-gray-900">
                {Math.round(progress)}%
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
