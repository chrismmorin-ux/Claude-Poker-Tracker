import React from 'react';
import { formatMsToTimer } from '../../../utils/displayUtils';
import { GOLD } from '../../../constants/designTokens';
import { getMRatioZone, getGuidanceColor } from '../../../constants/tournamentConstants';
import { IcmBadge } from '../../ui/IcmBadge';

/**
 * TableHeader - Compact info bar with hand count, session timer, and session controls
 * When tournament is active, shows a mini tournament strip with key info.
 */
export const TableHeader = ({
  handCount,
  sessionTimeDisplay,
  hasActiveSession,
  isSidebarCollapsed,
  onEndSession,
  onNewSession,
  // Tournament props (optional)
  isTournament,
  tournamentBlinds,
  levelTimeRemaining,
  onOpenTournament,
  // Enhanced tournament props
  heroMRatio,
  lockoutInfo,
  playersRemaining,
  currentLevelIndex,
  levelDurationMs,
  icmPressure,
  mRatioGuidance,
}) => {
  const isLowTime = levelTimeRemaining != null && levelTimeRemaining < 120000;
  const levelProgress = levelDurationMs > 0 && levelTimeRemaining != null
    ? 1 - (levelTimeRemaining / levelDurationMs)
    : 0;

  // M-ratio zone color (reuse existing helper)
  const mZone = heroMRatio != null ? getMRatioZone(heroMRatio) : null;
  const mColor = mZone?.color || null;

  // M-ratio guidance color
  const guidanceColor = getGuidanceColor(mRatioGuidance?.zone);

  return (
    <div
      className={`flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'ml-14' : 'ml-36'}`}
      style={{ marginRight: '450px' }}
    >
      {/* Main header row */}
      <div
        className="flex justify-between items-center px-4 py-1"
        style={{ background: 'rgba(0,0,0,0.5)', borderBottom: isTournament && tournamentBlinds ? 'none' : '1px solid rgba(212,168,71,0.15)' }}
      >
        <div className="flex items-center gap-3">
          <div className="font-bold" style={{ color: 'var(--gold)', fontSize: '15px' }}>Hand #{handCount + 1}</div>
          {hasActiveSession ? (
            <>
              <div className="text-sm" style={{ color: '#6dba8a' }}>{sessionTimeDisplay}</div>
              <button
                onClick={onEndSession}
                className="px-2 py-0.5 rounded text-xs font-semibold text-white"
                style={{ background: '#991b1b' }}
              >
                End Session
              </button>
            </>
          ) : (
            <button
              onClick={onNewSession}
              className="px-2 py-0.5 rounded text-xs font-semibold text-white"
              style={{ background: '#15803d' }}
            >
              New Session
            </button>
          )}
        </div>
      </div>

      {/* Mini Tournament Strip */}
      {isTournament && tournamentBlinds && (
        <div
          onClick={onOpenTournament}
          className="relative cursor-pointer overflow-hidden transition-colors"
          style={{
            background: 'rgba(212,168,71,0.08)',
            borderBottom: '1px solid rgba(212,168,71,0.25)',
            borderLeft: `3px solid ${GOLD}`,
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(212,168,71,0.14)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(212,168,71,0.08)'}
        >
          <div className="flex items-center justify-between px-4 py-1.5">
            <div className="flex items-center gap-3">
              {/* Level */}
              <span className="text-xs font-bold px-1.5 py-0.5 rounded" style={{
                color: GOLD,
                backgroundColor: 'rgba(212,168,71,0.15)',
              }}>
                Lvl {(currentLevelIndex || 0) + 1}
              </span>

              {/* Blinds */}
              <span className="text-xs font-semibold text-white">
                {tournamentBlinds.sb}/{tournamentBlinds.bb}
                {tournamentBlinds.ante > 0 && (
                  <span className="text-gray-400 ml-0.5">({tournamentBlinds.ante})</span>
                )}
              </span>

              {/* Separator */}
              <span className="text-gray-600">|</span>

              {/* M-ratio */}
              {heroMRatio != null && (
                <>
                  <span className="text-xs font-bold" style={{ color: mColor }}>
                    M{Math.round(heroMRatio)}
                  </span>
                  {/* M-ratio guidance */}
                  {mRatioGuidance && guidanceColor && (
                    <span className="text-xs" style={{ color: guidanceColor }}>
                      {mRatioGuidance.label}
                    </span>
                  )}
                  <span className="text-gray-600">|</span>
                </>
              )}

              {/* Timer */}
              {levelTimeRemaining != null && (
                <>
                  <span className={`text-xs font-mono font-bold ${isLowTime ? 'text-red-400' : 'text-green-400'}`}>
                    {formatMsToTimer(levelTimeRemaining)}
                  </span>
                  <span className="text-gray-600">|</span>
                </>
              )}

              {/* Players remaining */}
              {playersRemaining != null && (
                <span className="text-xs text-gray-300">
                  <span className="text-white font-medium">{playersRemaining}</span> left
                </span>
              )}

              {/* Lockout badge */}
              {lockoutInfo?.isApproaching && (
                <span className="text-xs px-1.5 py-0.5 rounded font-medium" style={{
                  backgroundColor: 'rgba(245,158,11,0.2)',
                  color: '#f59e0b',
                }}>
                  Lockout {lockoutInfo.levelsUntilLockout} lvl
                </span>
              )}

              {/* ICM badge */}
              <IcmBadge icmPressure={icmPressure} />
            </div>
          </div>

          {/* Level progress bar */}
          <div className="w-full h-0.5" style={{ backgroundColor: 'rgba(212,168,71,0.1)' }}>
            <div
              className="h-full transition-all"
              style={{
                width: `${Math.min(100, Math.max(0, levelProgress * 100))}%`,
                backgroundColor: GOLD,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

