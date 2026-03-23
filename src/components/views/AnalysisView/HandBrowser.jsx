import React, { useState, useEffect, useMemo } from 'react';
import { getAllSessions, GUEST_USER_ID } from '../../../utils/persistence/index';
import { BETTING_STREETS } from '../../../constants/gameConstants';
import { computeHandSignificance } from '../../../utils/handAnalysis';

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

/** Compute total pot from action sequence + blinds */
const getPotSize = (hand) => {
  let pot = 3; // SB(1) + BB(2) default for 1/2
  const blinds = hand.gameState?.blindsPosted;
  if (blinds) pot = (blinds.sb || 1) + (blinds.bb || 2);
  const seq = hand.gameState?.actionSequence;
  if (Array.isArray(seq)) {
    for (const entry of seq) {
      if (entry.amount) pot += entry.amount;
    }
  }
  return pot;
};

const streetAbbrev = { preflop: 'PF', flop: 'F', turn: 'T', river: 'R' };

const POT_FILTERS = [
  { label: 'All Pots', min: 0 },
  { label: '$10+', min: 10 },
  { label: '$25+', min: 25 },
  { label: '$50+', min: 50 },
  { label: '$100+', min: 100 },
];

export const HandBrowser = ({
  hands, selectedHandId, onSelectHand,
  filterPlayerId, filterSessionId,
  onFilterPlayerChange, onFilterSessionChange,
  allPlayers,
  onDeleteHand, onReplayHand,
  tendencyMap, heroPlayerId,
}) => {
  const [sessions, setSessions] = useState([]);
  const [minPot, setMinPot] = useState(0);
  const [sortMode, setSortMode] = useState('recent'); // 'recent' | 'significant'

  useEffect(() => {
    getAllSessions(GUEST_USER_ID).then(setSessions).catch(() => setSessions([]));
  }, []);

  // Pre-compute pot and significance for each hand
  const handsWithMetrics = useMemo(() => {
    return hands.map(hand => ({
      hand,
      pot: getPotSize(hand),
      significance: computeHandSignificance(hand, heroPlayerId, tendencyMap),
    }));
  }, [hands, heroPlayerId, tendencyMap]);

  const filteredHands = useMemo(() => {
    let result = handsWithMetrics;
    if (minPot > 0) {
      result = result.filter(h => h.pot >= minPot);
    }
    if (sortMode === 'significant') {
      result = [...result].sort((a, b) => b.significance.score - a.significance.score);
    }
    return result;
  }, [handsWithMetrics, minPot, sortMode]);

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
        <div className="flex gap-2">
          <select
            value={filterSessionId || ''}
            onChange={(e) => onFilterSessionChange(e.target.value || null)}
            className="flex-1 px-2 py-1 border border-gray-600 rounded text-xs bg-gray-700 text-gray-200"
          >
            <option value="">All Sessions</option>
            {sessions.map(s => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.venue || 'Session'} #{s.sessionId} - {s.gameType || ''}
              </option>
            ))}
          </select>
          <select
            value={minPot}
            onChange={(e) => setMinPot(Number(e.target.value))}
            className="w-[80px] px-2 py-1 border border-gray-600 rounded text-xs bg-gray-700 text-gray-200"
          >
            {POT_FILTERS.map(f => (
              <option key={f.min} value={f.min}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Sort toggle + hand count */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <button
            onClick={() => setSortMode('recent')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              sortMode === 'recent'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Recent
          </button>
          <button
            onClick={() => setSortMode('significant')}
            className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
              sortMode === 'significant'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            Key Hands
          </button>
        </div>
        {filteredHands.length > 0 && (
          <span className="text-[10px] text-gray-500">
            {filteredHands.length}{minPot > 0 ? `/${hands.length}` : ''}
          </span>
        )}
      </div>

      {/* Hand list */}
      <div className="flex-1 overflow-y-auto space-y-1">
        {filteredHands.length === 0 ? (
          <div className="text-center text-gray-400 text-xs mt-8">
            {filterPlayerId || filterSessionId || minPot > 0 ? 'No hands match filters' : 'No hands recorded'}
          </div>
        ) : (
          filteredHands.map(({ hand, pot, significance }) => {
            const handId = hand.handId ?? hand.id;
            const isSelected = handId === selectedHandId;
            const streetReached = getStreetReached(hand);
            const actionCount = hand.gameState?.actionSequence?.length || 0;
            const heroCards = hand.cardState?.holeCards || hand.gameState?.holeCards;
            const hasHeroCards = heroCards && heroCards[0] && heroCards[1];
            const sigColor = significance.score > 0.6 ? '#22c55e'
              : significance.score > 0.35 ? '#f59e0b' : '#6b7280';

            return (
              <div
                key={handId}
                onClick={() => onSelectHand(handId)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-900/30 border border-indigo-500'
                    : 'bg-gray-700 border border-gray-600 hover:bg-gray-600'
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: sigColor }}
                      title={`Significance: ${Math.round(significance.score * 100)}%`}
                    />
                    <span className="font-semibold text-gray-200">
                      {hand.handDisplayId || `#${handId}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 font-semibold">${pot}</span>
                    <span className="text-gray-400">{formatTime(hand.timestamp)}</span>
                  </div>
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
                {isSelected && (
                  <div className="flex gap-1 mt-1.5">
                    {onReplayHand && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onReplayHand(handId); }}
                        className="flex-1 bg-blue-700 hover:bg-blue-600 text-white text-[10px] font-semibold py-1 rounded transition-colors"
                      >
                        Replay
                      </button>
                    )}
                    {onDeleteHand && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onDeleteHand(handId, hand.sessionId); }}
                        className="flex-1 bg-red-700 hover:bg-red-600 text-white text-[10px] font-semibold py-1 rounded transition-colors"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
