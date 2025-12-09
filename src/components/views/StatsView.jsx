import React from 'react';
import { ScaledContainer } from '../ui/ScaledContainer';
import { LAYOUT, SEAT_ARRAY } from '../../constants/gameConstants';
import { useGame } from '../../contexts';
import { useUI } from '../../contexts';

/**
 * StatsView - Displays player statistics
 * Shows stats grid for all seats and detailed stats for the current player
 *
 * Props reduced from 4 to 1 by using contexts:
 * - seatActions → useGame()
 * - mySeat → useGame()
 * - setCurrentScreen → useUI()
 * - scale (kept as prop - viewport-derived, not app state)
 */
export const StatsView = ({ scale }) => {
  // Get state from contexts instead of props
  const { seatActions, mySeat } = useGame();
  const { setCurrentScreen, SCREEN } = useUI();
  return (
    <ScaledContainer scale={scale}>
      <div className="bg-gray-50 overflow-y-auto p-6" style={{ width: `${LAYOUT.TABLE_WIDTH}px`, height: `${LAYOUT.TABLE_HEIGHT}px` }}>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">Player Statistics</h2>
            <button onClick={() => setCurrentScreen(SCREEN.TABLE)} className="bg-green-600 text-white px-4 py-2 rounded-lg">⬅ Back to Table</button>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-6">
            {SEAT_ARRAY.map((seat) => (
              <button key={seat} className={`p-4 rounded-lg border-2 hover:border-blue-500 text-center ${seat === mySeat ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300'}`}>
                <div className="text-sm text-gray-600">Seat</div>
                <div className="font-bold text-3xl">{seat}</div>
                <div className="text-xs text-gray-500 mt-1">45 hands</div>
              </button>
            ))}
          </div>

          <div className="bg-white p-6 rounded-lg border-2 border-gray-300">
            <h3 className="text-xl font-bold mb-4">Seat {mySeat} Statistics (You)</h3>

            <div className="grid grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold text-blue-700 mb-3">Preflop</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>VPIP</span><span className="font-bold">32%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>PFR</span><span className="font-bold">18%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>3bet</span><span className="font-bold">8%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Limp</span><span className="font-bold">12%</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-green-700 mb-3">As PFR</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Cbet IP</span><span className="font-bold">65%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Cbet OOP</span><span className="font-bold">45%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Large %</span><span className="font-bold">35%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Fold CR</span><span className="font-bold">40%</span></div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-purple-700 mb-3">As PFC</h4>
                <div className="space-y-2">
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Donk</span><span className="font-bold">15%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Stab</span><span className="font-bold">25%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Check-Raise</span><span className="font-bold">12%</span></div>
                  <div className="flex justify-between p-2 bg-gray-50 rounded"><span>Fold Cbet</span><span className="font-bold">55%</span></div>
                </div>
              </div>
            </div>
          </div>
      </div>
    </ScaledContainer>
  );
};
