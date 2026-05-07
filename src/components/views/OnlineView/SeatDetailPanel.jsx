/**
 * SeatDetailPanel.jsx — Selected seat detail view for OnlineView
 *
 * Shows seat header, data quality, villain model card, observations,
 * live recommendations, legacy exploits/weaknesses, and briefings.
 */

import React from 'react';
import { VillainModelCard } from '../../ui/VillainModelCard';
import { ObservationPanel } from '../../ui/ObservationPanel';
import { STYLE_COLORS, QUALITY_CONFIG, getQualityTier, QUALITY_DETAIL, TIER_DOT } from './onlineConstants';
import { LiveRecommendations } from './LiveRecommendations';

export const SeatDetailPanel = ({
  selectedSeat, selectedSeatData, advice,
  expandedRec, setExpandedRec,
  recsExpanded, setRecsExpanded,
  onOpenProfile,
}) => {
  const hasProfile = selectedSeatData.villainProfile && selectedSeatData.villainProfile.maturity !== 'unknown';

  return (
    <div className="bg-[#16213e] border border-[#d4a847] rounded-lg p-3">
      <div className="flex justify-between items-center mb-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-sm font-bold text-[#d4a847] m-0">
            Seat {selectedSeat}
          </h3>
          {selectedSeatData.style && (
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-[3px]"
              style={{
                backgroundColor: STYLE_COLORS[selectedSeatData.style]?.bg || '#374151',
                color: STYLE_COLORS[selectedSeatData.style]?.text || '#9ca3af',
              }}
            >
              {selectedSeatData.style}
            </span>
          )}
        </div>
        <span className="text-[11px] text-gray-500">
          {selectedSeatData.sampleSize} hands
          {(() => {
            const q = QUALITY_CONFIG[getQualityTier(selectedSeatData.sampleSize || 0)];
            return q ? <span className="text-[10px] ml-1" style={{ color: q.color }}>({q.label})</span> : null;
          })()}
        </span>
      </div>

      {/* Data quality explanation */}
      {(() => {
        const tier = getQualityTier(selectedSeatData.sampleSize || 0);
        const detail = QUALITY_DETAIL[tier];
        return detail ? (
          <div className="text-[10px] text-gray-500 italic mb-1.5">
            {detail}
          </div>
        ) : null;
      })()}

      {/* Villain Model Summary */}
      {hasProfile && (
        <VillainModelCard
          villainProfile={selectedSeatData.villainProfile}
          thoughtAnalysis={selectedSeatData.thoughtAnalysis}
          currentStreet={advice?.currentStreet}
          villainStyle={selectedSeatData.style}
          onViewFullProfile={onOpenProfile}
          foldCurve={selectedSeatData.villainModel?.personalizedFoldCurve}
        />
      )}

      {/* Decision-organized observations (profile layer) */}
      {selectedSeatData.observations?.length > 0 && (
        <ObservationPanel observations={selectedSeatData.observations} />
      )}

      {/* Live Recommendations (collapsible when profile exists) */}
      {advice && String(advice.villainSeat) === selectedSeat && (
        <LiveRecommendations
          advice={advice}
          selectedSeatData={selectedSeatData}
          hasProfile={hasProfile}
          recsExpanded={recsExpanded}
          setRecsExpanded={setRecsExpanded}
          expandedRec={expandedRec}
          setExpandedRec={setExpandedRec}
        />
      )}

      {/* Legacy exploits (shown when no observations or as supplement) */}
      {(!selectedSeatData.observations?.length) && selectedSeatData.exploits?.length > 0 && (
        <div className="mb-2">
          <h4 className="text-[11px] text-gray-400 mb-1 uppercase">Exploits</h4>
          {selectedSeatData.exploits.slice(0, 8).map((exploit, i) => {
            const dotColor = TIER_DOT[exploit.tier] || TIER_DOT.speculative;
            const opacity = Math.max(0.5, Math.min(1, (exploit.scoring?.worthiness || 0.5) * 1.5));
            return (
              <div
                key={i}
                className="text-xs px-2 py-1 mb-[3px] bg-[#0d1117] rounded border-l-2 border-l-[#d4a847] flex items-center gap-1.5"
                style={{ opacity }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ backgroundColor: dotColor }}
                  title={exploit.tier || 'speculative'}
                />
                <span>{exploit.label || exploit.description || 'Exploit detected'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy weaknesses (shown when no observations) */}
      {(!selectedSeatData.observations?.length) && selectedSeatData.weaknesses?.length > 0 && (
        <div className="mb-2">
          <h4 className="text-[11px] text-gray-400 mb-1 uppercase">Weaknesses</h4>
          {selectedSeatData.weaknesses.slice(0, 5).map((w, i) => (
            <div
              key={i}
              className="text-xs px-2 py-1 mb-[3px] bg-[#0d1117] rounded border-l-2 border-l-red-500"
            >
              {w.label || w.description || 'Weakness detected'}
            </div>
          ))}
        </div>
      )}

      {/* Briefings (always shown as supplement) */}
      {selectedSeatData.briefings?.length > 0 && (
        <div>
          <h4 className="text-[11px] text-gray-400 mb-1 uppercase">Briefings</h4>
          {selectedSeatData.briefings.slice(0, 3).map((b, i) => (
            <div
              key={i}
              className="text-xs px-2 py-1.5 mb-1 bg-[#0d1117] rounded border-l-2 border-l-green-500 leading-[1.4]"
            >
              {b.briefing || b.label || 'Briefing available'}
            </div>
          ))}
        </div>
      )}

      {selectedSeatData.exploits?.length === 0 && selectedSeatData.weaknesses?.length === 0 && (
        <div className="text-xs text-gray-500 text-center p-2">
          {selectedSeatData.sampleSize < 20
            ? `Need ${20 - selectedSeatData.sampleSize} more hands for exploit detection`
            : 'No exploits detected — player appears balanced'
          }
        </div>
      )}
    </div>
  );
};
