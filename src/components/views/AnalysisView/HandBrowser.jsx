import React, { useState, useEffect } from 'react';
import { getAllSessions, GUEST_USER_ID } from '../../../utils/persistence/index';
import { BETTING_STREETS } from '../../../constants/gameConstants';

const formatTime = (timestamp) => {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getStreetReached = (hand) => {
  const seq = hand.gameState?.actionSequence;
  if (Array.isArray(seq) && seq.length > 0) {
    const streets = new Set(seq.map(e => e.street));
    for (let i = BETTING_STREETS.length - 1; i >= 0; i--) {
      if (streets.has(BETTING_STREETS[i])) return BETTING_STREETS[i];
    }
  }
  // Fallback: check seatActions keys
  const sa = hand.gameState?.seatActions || hand.seatActions || {};
  for (let i = BETTING_STREETS.length - 1; i >= 0; i--) {
    if (sa[BETTING_STREETS[i]]) return BETTING_STREETS[i];
  }
  return 'preflop';
};

const streetAbbrev = { preflop: 'PF', flop: 'F', turn: 'T', river: 'R' };

export const HandBrowser = ({
  hands, selectedHandId, onSelectHand,
  filterPlayerId, filterSessionId,
  onFilterPlayerChange, onFilterSessionChange,
  allPlayers,
}) => {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    getAllSessions(GUEST_USER_ID).then(setSessions).catch(() => setSessions([]));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Filters */}
      <div className="space-y-2 mb-3">
        <select
          value={filterPlayerId || ''}
          onChange={(e) => onFilterPlayerChange(e.target.value || null)}
          className="w-full px-2 py-1 border border-gray-600 rounded text-xs bg-gray-700 text-gray-200"
        >
          <option value="">All Players</option>
          {allPlayers.map(p => (
            <option key={p.playerId} value={p.playerId}>{p.name}</option>
          ))}
        </select>
        <select
          value={filterSessionId || ''}
          onChange={(e) => onFilterSessionChange(e.target.value || null)}
          className="w-full px-2 py-1 border border-gray-600 rounded text-xs bg-gray-700 text-gray-200"
        >
          <option value="">All Sessions</option>
          {sessions.map(s => (
            <option key={s.sessionId} value={s.sessionId}>
              {s.venue || 'Session'} #{s.sessionId} - {s.gameType || ''}
            </option>
          ))}
        </select>
      </div>

      {/* Hand list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {hands.length === 0 ? (
          <div className="text-center text-gray-400 text-xs mt-8">
            {filterPlayerId || filterSessionId ? 'No hands match filters' : 'No hands recorded'}
          </div>
        ) : (
          hands.map((hand) => {
            const handId = hand.handId ?? hand.id;
            const isSelected = handId === selectedHandId;
            const streetReached = getStreetReached(hand);
            const actionCount = hand.gameState?.actionSequence?.length || 0;
            const heroCards = hand.cardState?.holeCards || hand.gameState?.holeCards;
            const hasHeroCards = heroCards && heroCards[0] && heroCards[1];

            return (
              <button
                key={handId}
                onClick={() => onSelectHand(handId)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  isSelected
                    ? 'bg-indigo-900/30 border border-indigo-500'
                    : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-gray-200">
                    {hand.handDisplayId || `#${handId}`}
                  </span>
                  <span className="text-gray-400">{formatTime(hand.timestamp)}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                  <span className="text-gray-500">
                    {streetAbbrev[streetReached] || streetReached}
                    {actionCount > 0 && ` | ${actionCount} acts`}
                  </span>
                  {hasHeroCards && (
                    <span className="font-mono text-gray-300">
                      {heroCards[0]} {heroCards[1]}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
