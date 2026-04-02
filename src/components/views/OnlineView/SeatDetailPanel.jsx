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
    <div style={{
      background: '#16213e',
      border: '1px solid #d4a847',
      borderRadius: 8,
      padding: 12,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <h3 style={{ fontSize: 14, fontWeight: 'bold', color: '#d4a847', margin: 0 }}>
            Seat {selectedSeat}
          </h3>
          {selectedSeatData.style && (
            <span style={{
              fontSize: 10, fontWeight: 'bold', padding: '2px 6px', borderRadius: 3,
              backgroundColor: STYLE_COLORS[selectedSeatData.style]?.bg || '#374151',
              color: STYLE_COLORS[selectedSeatData.style]?.text || '#9ca3af',
            }}>
              {selectedSeatData.style}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: '#6b7280' }}>
          {selectedSeatData.sampleSize} hands
          {(() => {
            const q = QUALITY_CONFIG[getQualityTier(selectedSeatData.sampleSize || 0)];
            return q ? <span style={{ fontSize: 10, marginLeft: 4, color: q.color }}>({q.label})</span> : null;
          })()}
        </span>
      </div>

      {/* Data quality explanation */}
      {(() => {
        const tier = getQualityTier(selectedSeatData.sampleSize || 0);
        const detail = QUALITY_DETAIL[tier];
        return detail ? (
          <div style={{ fontSize: 10, color: '#6b7280', fontStyle: 'italic', marginBottom: 6 }}>
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
        <div style={{ marginBottom: 8 }}>
          <h4 style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Exploits</h4>
          {selectedSeatData.exploits.slice(0, 8).map((exploit, i) => {
            const dotColor = TIER_DOT[exploit.tier] || TIER_DOT.speculative;
            const opacity = Math.max(0.5, Math.min(1, (exploit.scoring?.worthiness || 0.5) * 1.5));
            return (
              <div key={i} style={{
                fontSize: 12, padding: '4px 8px', marginBottom: 3,
                background: '#0d1117', borderRadius: 4, borderLeft: '2px solid #d4a847',
                display: 'flex', alignItems: 'center', gap: 6, opacity,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  backgroundColor: dotColor,
                }} title={exploit.tier || 'speculative'} />
                <span>{exploit.label || exploit.description || 'Exploit detected'}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Legacy weaknesses (shown when no observations) */}
      {(!selectedSeatData.observations?.length) && selectedSeatData.weaknesses?.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <h4 style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Weaknesses</h4>
          {selectedSeatData.weaknesses.slice(0, 5).map((w, i) => (
            <div key={i} style={{
              fontSize: 12, padding: '4px 8px', marginBottom: 3,
              background: '#0d1117', borderRadius: 4, borderLeft: '2px solid #ef4444',
            }}>
              {w.label || w.description || 'Weakness detected'}
            </div>
          ))}
        </div>
      )}

      {/* Briefings (always shown as supplement) */}
      {selectedSeatData.briefings?.length > 0 && (
        <div>
          <h4 style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4, textTransform: 'uppercase' }}>Briefings</h4>
          {selectedSeatData.briefings.slice(0, 3).map((b, i) => (
            <div key={i} style={{
              fontSize: 12, padding: '6px 8px', marginBottom: 4,
              background: '#0d1117', borderRadius: 4,
              borderLeft: '2px solid #22c55e',
              lineHeight: 1.4,
            }}>
              {b.briefing || b.label || 'Briefing available'}
            </div>
          ))}
        </div>
      )}

      {selectedSeatData.exploits?.length === 0 && selectedSeatData.weaknesses?.length === 0 && (
        <div style={{ fontSize: 12, color: '#6b7280', textAlign: 'center', padding: 8 }}>
          {selectedSeatData.sampleSize < 20
            ? `Need ${20 - selectedSeatData.sampleSize} more hands for exploit detection`
            : 'No exploits detected — player appears balanced'
          }
        </div>
      )}
    </div>
  );
};
