import React, { useState, useMemo } from 'react';
import { ScaledContainer } from '../ui/ScaledContainer';
import { RangeGrid } from '../ui/RangeGrid';
import { LAYOUT, SEAT_ARRAY } from '../../constants/gameConstants';
import { useGame, useSession, usePlayer } from '../../contexts';
import { useUI } from '../../contexts';
import { useSessionStats } from '../../hooks/useSessionStats';
import { useRangeProfile } from '../../hooks/useRangeProfile';
import { RANGE_POSITIONS } from '../../utils/rangeEngine';

const StatRow = ({ label, value }) => (
  <div className="flex justify-between p-2 bg-gray-50 rounded">
    <span>{label}</span>
    <span className="font-bold">{value !== null && value !== undefined ? `${value}%` : '--'}</span>
  </div>
);

const STYLE_COLORS = {
  Fish: 'bg-red-100 text-red-700',
  LAG: 'bg-orange-100 text-orange-700',
  LP: 'bg-yellow-100 text-yellow-700',
  Nit: 'bg-blue-100 text-blue-700',
  TAG: 'bg-green-100 text-green-700',
  Reg: 'bg-purple-100 text-purple-700',
  Unknown: 'bg-gray-100 text-gray-600',
};

const fmtPct = (v) => (v !== null && v > 0) ? `${v}%` : '--';

const RangeProfileTable = ({ rangeSummary }) => (
  <div className="space-y-4">
    {/* No raise faced: fold / limp / open */}
    <div>
      <h4 className="text-sm font-semibold text-blue-700 mb-2">First In (no raise faced)</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left p-1.5">Pos</th>
            <th className="text-right p-1.5">Fold</th>
            <th className="text-right p-1.5">Limp</th>
            <th className="text-right p-1.5">Open</th>
            <th className="text-right p-1.5 text-gray-400">n</th>
          </tr>
        </thead>
        <tbody>
          {RANGE_POSITIONS.filter(p => p !== 'BB').map((pos) => {
            const row = rangeSummary[pos];
            if (!row) return null;
            const f = row.noRaiseFreqs;
            return (
              <tr key={pos} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-1.5 font-semibold">{pos}</td>
                <td className="p-1.5 text-right text-gray-500">{fmtPct(f.fold)}</td>
                <td className="p-1.5 text-right">{fmtPct(f.limp)}</td>
                <td className="p-1.5 text-right">{fmtPct(f.open)}</td>
                <td className="p-1.5 text-right text-gray-400">{row.noRaiseHands}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

    {/* Facing a raise: fold / cold-call / 3-bet */}
    <div>
      <h4 className="text-sm font-semibold text-orange-700 mb-2">Facing a Raise</h4>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b-2 border-gray-200">
            <th className="text-left p-1.5">Pos</th>
            <th className="text-right p-1.5">Fold</th>
            <th className="text-right p-1.5">Cold-Call</th>
            <th className="text-right p-1.5">3-Bet</th>
            <th className="text-right p-1.5 text-gray-400">n</th>
          </tr>
        </thead>
        <tbody>
          {RANGE_POSITIONS.map((pos) => {
            const row = rangeSummary[pos];
            if (!row) return null;
            const f = row.facedRaiseFreqs;
            return (
              <tr key={pos} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="p-1.5 font-semibold">{pos}</td>
                <td className="p-1.5 text-right text-gray-500">{fmtPct(f.fold)}</td>
                <td className="p-1.5 text-right">{fmtPct(f.coldCall)}</td>
                <td className="p-1.5 text-right">{fmtPct(f.threeBet)}</td>
                <td className="p-1.5 text-right text-gray-400">{row.facedRaiseHands}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  </div>
);

export const StatsView = ({ scale }) => {
  const { mySeat } = useGame();
  const { setCurrentScreen, SCREEN } = useUI();
  const { currentSession } = useSession();
  const { seatPlayers, getSeatPlayerName } = usePlayer();
  const sessionId = currentSession?.sessionId ?? null;
  const { seatStats, isLoading } = useSessionStats(sessionId, seatPlayers);
  const [selectedSeat, setSelectedSeat] = useState(mySeat);

  const selectedPlayerId = seatPlayers[selectedSeat] || null;
  const { rangeProfile, rangeSummary, isLoading: rangeLoading } = useRangeProfile(selectedPlayerId);
  const [gridPosition, setGridPosition] = useState('LATE');
  const [gridAction, setGridAction] = useState('open');

  const gridShowdownIndices = useMemo(() => {
    const s = new Set();
    if (rangeProfile?.showdownAnchors) {
      for (const a of rangeProfile.showdownAnchors) {
        if (a.position === gridPosition && a.action === gridAction && a.gridIndex != null) {
          s.add(a.gridIndex);
        }
      }
    }
    return s;
  }, [rangeProfile, gridPosition, gridAction]);

  const selectedStats = seatStats[selectedSeat] || null;
  const selectedName = getSeatPlayerName(selectedSeat) || `Seat ${selectedSeat}`;
  const isYou = selectedSeat === mySeat;

  return (
    <ScaledContainer scale={scale}>
      <div className="bg-gray-50 overflow-y-auto p-6" style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold">Session Stats</h2>
          <button onClick={() => setCurrentScreen(SCREEN.TABLE)} className="bg-green-600 text-white px-4 py-2 rounded-lg">Back to Table</button>
        </div>

        {!sessionId ? (
          <div className="text-center text-gray-500 mt-12 text-lg">No active session</div>
        ) : isLoading ? (
          <div className="text-center text-gray-500 mt-12 text-lg">Loading stats...</div>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-3 mb-4">
              {SEAT_ARRAY.map((seat) => {
                const stats = seatStats[seat];
                const name = getSeatPlayerName(seat);
                const isMySeat = seat === mySeat;
                const isSelected = seat === selectedSeat;
                return (
                  <button
                    key={seat}
                    onClick={() => setSelectedSeat(seat)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors
                      ${isSelected ? 'border-blue-500 ring-2 ring-blue-300' : 'hover:border-blue-400'}
                      ${isMySeat ? 'bg-blue-50 border-blue-400' : 'bg-white border-gray-300'}
                    `}
                  >
                    <div className="text-xs text-gray-500">Seat {seat}</div>
                    <div className="font-semibold text-sm truncate">{name || '--'}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {stats ? `${stats.handCount} hands` : '0 hands'}
                    </div>
                    {stats && stats.sampleSize > 0 && (
                      <div className="text-xs font-mono mt-1">
                        {stats.vpip ?? '--'}/{stats.pfr ?? '--'}/{stats.af !== null ? stats.af : '--'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="bg-white p-5 rounded-lg border-2 border-gray-300">
              <h3 className="text-lg font-bold mb-3">
                {selectedName}{isYou ? ' (You)' : ''} — Seat {selectedSeat}
              </h3>

              {!selectedStats || selectedStats.sampleSize === 0 ? (
                <div className="text-center text-gray-400 py-6">No data for this seat</div>
              ) : (
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <h4 className="font-semibold text-blue-700 mb-2">Preflop</h4>
                    <div className="space-y-2">
                      <StatRow label="VPIP" value={selectedStats.vpip} />
                      <StatRow label="PFR" value={selectedStats.pfr} />
                      <StatRow label="3-Bet" value={selectedStats.threeBet} />
                      <StatRow label="Limp" value={selectedStats.limpPct} />
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-green-700 mb-2">Postflop</h4>
                    <div className="space-y-2">
                      <StatRow label="C-Bet" value={selectedStats.cbet} />
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>AF</span>
                        <span className="font-bold">
                          {selectedStats.af !== null
                            ? selectedStats.af === Infinity ? 'INF' : selectedStats.af
                            : '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-purple-700 mb-2">Profile</h4>
                    <div className="space-y-2">
                      {selectedStats.style && (
                        <div className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${STYLE_COLORS[selectedStats.style] || STYLE_COLORS.Unknown}`}>
                          {selectedStats.style}
                        </div>
                      )}
                      <div className="flex justify-between p-2 bg-gray-50 rounded">
                        <span>Sample</span>
                        <span className="font-bold">{selectedStats.sampleSize} hands</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {selectedPlayerId && rangeSummary && (
              <div className="bg-white p-5 rounded-lg border-2 border-gray-300 mt-4">
                <h3 className="text-lg font-bold mb-3">Range Profile</h3>
                {rangeLoading ? (
                  <div className="text-center text-gray-400 py-4">Loading range data...</div>
                ) : (
                  <>
                    <RangeProfileTable rangeSummary={rangeSummary} />

                    {/* Visual Range Grid */}
                    {rangeProfile && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-700 mb-2">Range Grid</h4>
                        {/* Position pills */}
                        <div className="flex gap-1 mb-2">
                          {RANGE_POSITIONS.map((pos) => (
                            <button
                              key={pos}
                              onClick={() => setGridPosition(pos)}
                              className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                                gridPosition === pos
                                  ? 'bg-blue-600 text-white'
                                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                              }`}
                            >
                              {pos}
                            </button>
                          ))}
                        </div>
                        {/* Action pills */}
                        <div className="flex gap-1 mb-3">
                          {['open', 'limp', 'coldCall', 'threeBet'].map((act) => (
                            <button
                              key={act}
                              onClick={() => setGridAction(act)}
                              className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                gridAction === act
                                  ? 'bg-green-600 text-white'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {act === 'coldCall' ? 'Cold-Call' : act === 'threeBet' ? '3-Bet' : act.charAt(0).toUpperCase() + act.slice(1)}
                            </button>
                          ))}
                        </div>
                        <div className="flex justify-center">
                          <RangeGrid
                            weights={rangeProfile.ranges?.[gridPosition]?.[gridAction]}
                            showdownIndices={gridShowdownIndices}
                            size="compact"
                            sampleSize={rangeSummary[gridPosition]?.hands || 0}
                          />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="mt-3 text-center text-gray-400 text-sm">
              Table Dynamics (Coming Soon)
            </div>
          </>
        )}
      </div>
    </ScaledContainer>
  );
};
