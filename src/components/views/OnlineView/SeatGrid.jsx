/**
 * SeatGrid.jsx — 3x3 seat grid for OnlineView
 *
 * Displays 9 seats with headline-based or VPIP/PFR/AF stats.
 * Each seat is clickable when data is available.
 */

import React from 'react';
import { SEAT_ARRAY } from '../../../constants/gameConstants';
import { STYLE_COLORS, MATURITY_COLORS } from './onlineConstants';

export const SeatGrid = ({ tendencyMap, selectedSeat, onSelectSeat, handCount }) => {
  if (handCount === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-1.5 mb-3">
      {SEAT_ARRAY.map(seat => {
        const seatStr = String(seat);
        const data = tendencyMap[seatStr];
        const isSelected = selectedSeat === seatStr;
        const hasData = data && data.sampleSize > 0;

        return (
          <div
            key={seat}
            onClick={() => hasData && onSelectSeat(isSelected ? null : seatStr)}
            className={`bg-[#16213e] border rounded-md p-2 transition-[border-color] duration-200 ${isSelected ? 'border-[#d4a847]' : 'border-[#2a2a4a]'} ${hasData ? 'cursor-pointer opacity-100' : 'cursor-default opacity-[0.35]'}`}
          >
            {/* Seat header */}
            <div className="flex justify-between items-center mb-1">
              <span className="text-[11px] font-bold text-gray-400">
                Seat {seat}
              </span>
              {data?.style && (
                <span
                  className="text-[9px] font-bold px-[5px] py-px rounded-[3px]"
                  style={{
                    backgroundColor: STYLE_COLORS[data.style]?.bg || '#374151',
                    color: STYLE_COLORS[data.style]?.text || '#9ca3af',
                  }}
                >
                  {data.style}
                </span>
              )}
            </div>

            {/* Stats / Headline */}
            {hasData ? (
              <>
                {data.villainProfile && data.villainProfile.maturity !== 'unknown' ? (
                  <>
                    {/* Headline-based display */}
                    <div
                      className="text-[10px] text-[#e0e0e0] leading-[1.3] overflow-hidden min-h-[26px]"
                      style={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                      }}
                    >
                      {data.villainProfile.headline}
                    </div>
                    <div className="flex justify-between items-center mt-[3px]">
                      <span
                        className="text-[8px] px-1 py-px rounded-[2px] font-bold"
                        style={{
                          background: MATURITY_COLORS[data.villainProfile.maturity]?.bg || '#374151',
                          color: MATURITY_COLORS[data.villainProfile.maturity]?.text || '#9ca3af',
                        }}
                      >
                        {data.villainProfile.maturityLabel}
                      </span>
                      <span className="text-[9px] text-gray-600">
                        {data.sampleSize}h
                        {data.exploits?.length > 0 && (
                          <span className="text-gray-500 ml-[3px]">
                            {data.exploits.length}e
                          </span>
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Fallback: VPIP/PFR/AF stats — credible-interval suffix per FIND-001 / SPR-017 */}
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">VPIP</span>
                      <span
                        className={`font-bold ${data.vpip > 40 ? 'text-red-500' : data.vpip < 15 ? 'text-green-500' : 'text-[#e0e0e0]'}`}
                      >
                        {data.vpip}%
                        {data.intervals?.vpip && data.sampleSize <= 200 && (
                          <span className="text-[9px] text-gray-400 ml-1 font-normal">
                            ±{(((data.intervals.vpip.upper - data.intervals.vpip.lower) / 2) * 100).toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">PFR</span>
                      <span className="font-bold text-[#e0e0e0]">
                        {data.pfr}%
                        {data.intervals?.pfr && data.sampleSize <= 200 && (
                          <span className="text-[9px] text-gray-400 ml-1 font-normal">
                            ±{(((data.intervals.pfr.upper - data.intervals.pfr.lower) / 2) * 100).toFixed(1)}%
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-gray-500">AF</span>
                      <span className="font-bold text-[#e0e0e0]">
                        {data.af === null ? '—' : data.af === Infinity ? '∞' : data.af?.toFixed(1)}
                      </span>
                    </div>
                    <div className="text-[9px] text-gray-600 text-right mt-0.5">
                      {data.sampleSize}h
                      {data.exploits?.length > 0 && (
                        <span className="text-[#d4a847] ml-1">
                          {data.exploits.length} exploit{data.exploits.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-[11px] text-gray-600 text-center pt-2">—</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
