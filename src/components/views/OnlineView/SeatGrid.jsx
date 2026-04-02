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
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 6,
      marginBottom: 12,
    }}>
      {SEAT_ARRAY.map(seat => {
        const seatStr = String(seat);
        const data = tendencyMap[seatStr];
        const isSelected = selectedSeat === seatStr;
        const hasData = data && data.sampleSize > 0;

        return (
          <div
            key={seat}
            onClick={() => hasData && onSelectSeat(isSelected ? null : seatStr)}
            style={{
              background: '#16213e',
              border: `1px solid ${isSelected ? '#d4a847' : '#2a2a4a'}`,
              borderRadius: 6,
              padding: '8px',
              cursor: hasData ? 'pointer' : 'default',
              opacity: hasData ? 1 : 0.35,
              transition: 'border-color 0.2s',
            }}
          >
            {/* Seat header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 11, fontWeight: 'bold', color: '#9ca3af' }}>
                Seat {seat}
              </span>
              {data?.style && (
                <span style={{
                  fontSize: 9, fontWeight: 'bold', padding: '1px 5px', borderRadius: 3,
                  backgroundColor: STYLE_COLORS[data.style]?.bg || '#374151',
                  color: STYLE_COLORS[data.style]?.text || '#9ca3af',
                }}>
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
                    <div style={{
                      fontSize: 10, color: '#e0e0e0', lineHeight: 1.3,
                      overflow: 'hidden', display: '-webkit-box',
                      WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                      minHeight: 26,
                    }}>
                      {data.villainProfile.headline}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 3 }}>
                      <span style={{
                        fontSize: 8, padding: '1px 4px', borderRadius: 2, fontWeight: 'bold',
                        background: MATURITY_COLORS[data.villainProfile.maturity]?.bg || '#374151',
                        color: MATURITY_COLORS[data.villainProfile.maturity]?.text || '#9ca3af',
                      }}>
                        {data.villainProfile.maturityLabel}
                      </span>
                      <span style={{ fontSize: 9, color: '#4b5563' }}>
                        {data.sampleSize}h
                        {data.exploits?.length > 0 && (
                          <span style={{ color: '#6b7280', marginLeft: 3 }}>
                            {data.exploits.length}e
                          </span>
                        )}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Fallback: VPIP/PFR/AF stats */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: '#6b7280' }}>VPIP</span>
                      <span style={{ fontWeight: 'bold', color: data.vpip > 40 ? '#ef4444' : data.vpip < 15 ? '#22c55e' : '#e0e0e0' }}>
                        {data.vpip}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: '#6b7280' }}>PFR</span>
                      <span style={{ fontWeight: 'bold', color: '#e0e0e0' }}>{data.pfr}%</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                      <span style={{ color: '#6b7280' }}>AF</span>
                      <span style={{ fontWeight: 'bold', color: '#e0e0e0' }}>
                        {data.af === null ? '—' : data.af === Infinity ? '∞' : data.af?.toFixed(1)}
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: '#4b5563', textAlign: 'right', marginTop: 2 }}>
                      {data.sampleSize}h
                      {data.exploits?.length > 0 && (
                        <span style={{ color: '#d4a847', marginLeft: 4 }}>
                          {data.exploits.length} exploit{data.exploits.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div style={{ fontSize: 11, color: '#4b5563', textAlign: 'center', paddingTop: 8 }}>—</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
