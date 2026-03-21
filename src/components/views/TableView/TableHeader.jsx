import React from 'react';
import PropTypes from 'prop-types';
import { formatMsToTimer } from '../../../utils/displayUtils';

/**
 * TableHeader - Compact info bar with hand count, session timer, and session controls
 * Hand controls (Next Hand, Reset, Hand Over) moved to CommandStrip
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
}) => {
  return (
    <div
      className={`flex justify-between items-center px-4 py-1 transition-all duration-300 ${isSidebarCollapsed ? 'ml-14' : 'ml-36'}`}
      style={{ marginRight: '450px', background: 'rgba(0,0,0,0.5)', borderBottom: '1px solid rgba(212,168,71,0.15)' }}
    >
      <div className="flex items-center gap-3">
        <div className="font-bold" style={{ color: 'var(--gold)', fontSize: '15px' }}>Hand #{handCount + 1}</div>
        {hasActiveSession ? (
          <>
            <div className="text-sm" style={{ color: '#6dba8a' }}>{sessionTimeDisplay}</div>
            {isTournament && tournamentBlinds && (
              <button
                onClick={onOpenTournament}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold"
                style={{ background: 'rgba(59,130,246,0.3)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.4)' }}
              >
                <span>{tournamentBlinds.sb}/{tournamentBlinds.bb}</span>
                {levelTimeRemaining != null && (
                  <span className={levelTimeRemaining < 120000 ? 'text-red-400' : ''}>
                    {formatMsToTimer(levelTimeRemaining)}
                  </span>
                )}
              </button>
            )}
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
  );
};

TableHeader.propTypes = {
  handCount: PropTypes.number.isRequired,
  sessionTimeDisplay: PropTypes.string.isRequired,
  hasActiveSession: PropTypes.bool.isRequired,
  isSidebarCollapsed: PropTypes.bool.isRequired,
  onEndSession: PropTypes.func.isRequired,
  onNewSession: PropTypes.func.isRequired,
};
