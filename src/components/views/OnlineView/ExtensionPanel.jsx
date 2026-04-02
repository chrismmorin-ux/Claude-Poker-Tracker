/**
 * ExtensionPanel.jsx — Root component for the Chrome extension side panel
 *
 * 3-tier layout: Glance Strip (sticky) → Quick Context → Deep Analysis.
 * Consumes the same OnlineAnalysisContext data as the main app's OnlineView.
 * 400px wide, dark theme with IBM Plex Mono + Outfit fonts.
 *
 * Villain tracking:
 * - Auto-follows advice.villainSeat by default (the opponent in the current action)
 * - User can "pin" a seat by clicking in CompactSeatStrip (overrides auto-follow)
 * - Pinned state shown via 📌 indicator; click again or click "follow" to unpin
 * - seatDisplayMap from liveHandState provides Ignition display names when available
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useOnlineAnalysisContext } from '../../../contexts/OnlineAnalysisContext';
import { useSyncBridge } from '../../../contexts/SyncBridgeContext';
import { SURFACE, BORDER, TEXT, FONT, GOLD, COLOR } from './panelTokens';
import { CompactSeatStrip } from './CompactSeatStrip';
import { Tier1_GlanceStrip } from './Tier1_GlanceStrip';
import { VillainBrief } from './VillainBrief';
import { BlockerInsightStrip } from './BlockerInsightStrip';
import { RangeAdvantageBar } from './RangeAdvantageBar';
import { VulnerabilityCallout } from './VulnerabilityCallout';
import { BucketEquityPanel } from './panels/BucketEquityPanel';
import { AllRecommendationsPanel } from './panels/AllRecommendationsPanel';
import { StreetTendenciesPanel } from './panels/StreetTendenciesPanel';
import { FoldCurvePanel } from './panels/FoldCurvePanel';
import { FoldBreakdownPanel } from './panels/FoldBreakdownPanel';
import { ComboDistributionPanel } from './panels/ComboDistributionPanel';
import { ModelAuditPanel } from './panels/ModelAuditPanel';
import { VulnerabilitiesPanel } from './panels/VulnerabilitiesPanel';
import { HandTypePanel } from './panels/HandTypePanel';
import { FlopBreakdownPanel } from './panels/FlopBreakdownPanel';
import { AwarenessPanel } from './panels/AwarenessPanel';
import { HandPlanTree } from './HandPlanTree';
import { BoardTexturePills } from './BoardTexturePills';
import { SupportingObservations } from './SupportingObservations';

const FONT_IMPORT = "https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Outfit:wght@300;400;500;600;700&display=swap";

// Inject keyframe animations once
const PANEL_ANIMATIONS = `
@keyframes panelAccentPulse {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}
@keyframes panelBadgeIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
@keyframes panelFadeSlideIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes panelLiveDot {
  0%, 100% { box-shadow: 0 0 4px rgba(34,197,94,0.3); }
  50% { box-shadow: 0 0 8px rgba(34,197,94,0.6); }
}
.ext-panel-scrollable::-webkit-scrollbar { width: 4px; }
.ext-panel-scrollable::-webkit-scrollbar-track { background: transparent; }
.ext-panel-scrollable::-webkit-scrollbar-thumb { background: #374151; border-radius: 2px; }
.ext-panel-scrollable::-webkit-scrollbar-thumb:hover { background: #4b5563; }
`;

export const ExtensionPanel = () => {
  const { tendencyMap, handCount, advice, isComputing } = useOnlineAnalysisContext();
  const syncBridge = useSyncBridge?.() || {};
  const liveHandState = syncBridge.liveHandState;

  // ─── Villain tracking: auto-follow vs pin ─────────────────────────────────
  const [pinnedSeat, setPinnedSeat] = useState(null);
  const prevVillainSeat = useRef(null);
  const [villainChanged, setVillainChanged] = useState(false);

  // Active seat: pinned overrides auto-follow
  const autoSeat = advice?.villainSeat;
  const activeSeat = pinnedSeat || autoSeat || null;
  const isPinned = pinnedSeat != null;
  const seatData = tendencyMap?.[String(activeSeat)];

  // Detect villain change for visual flash
  useEffect(() => {
    if (autoSeat && autoSeat !== prevVillainSeat.current) {
      if (prevVillainSeat.current != null) {
        setVillainChanged(true);
        const timer = setTimeout(() => setVillainChanged(false), 800);
        return () => clearTimeout(timer);
      }
      prevVillainSeat.current = autoSeat;
    }
  }, [autoSeat]);

  // Seat click: toggle pin
  const handleSeatClick = useCallback((seat) => {
    if (seat === pinnedSeat) {
      setPinnedSeat(null); // Unpin → return to auto-follow
    } else {
      setPinnedSeat(seat);
    }
  }, [pinnedSeat]);

  // Player display name from Ignition (if available)
  const seatDisplayMap = liveHandState?.seatDisplayMap || {};
  const villainName = seatDisplayMap[activeSeat] || null;

  // Does advice match the active seat?
  const adviceMatchesSeat = advice && String(advice.villainSeat) === String(activeSeat);
  const hasAdvice = adviceMatchesSeat && advice.recommendations?.length > 0;
  const currentStreet = advice?.currentStreet || liveHandState?.currentStreet;

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="stylesheet" href={FONT_IMPORT} />
      <style dangerouslySetInnerHTML={{ __html: PANEL_ANIMATIONS }} />

      <div style={{
        width: 400,
        height: '100vh',
        background: SURFACE.body,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        borderLeft: `1px solid ${BORDER.default}`,
        borderRight: `1px solid ${BORDER.default}`,
        fontFamily: FONT.display,
        color: TEXT.primary,
        WebkitFontSmoothing: 'antialiased',
      }}>
        {/* Noise texture */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0,
          background: `repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(255,255,255,0.008) 1px,rgba(255,255,255,0.008) 2px)`,
        }} />

        <div style={{
          position: 'relative', zIndex: 1,
          display: 'flex', flexDirection: 'column', height: '100%',
        }}>
          {/* Compact seat strip */}
          <CompactSeatStrip
            tendencyMap={tendencyMap}
            selectedSeat={activeSeat}
            onSelectSeat={handleSeatClick}
            pinnedSeat={pinnedSeat}
            advisorSeat={autoSeat}
          />

          {/* Tier 1: Glance Strip (sticky) */}
          {hasAdvice && (
            <Tier1_GlanceStrip advice={advice} liveHandState={liveHandState} />
          )}

          {/* Scrollable: Tier 2 + Tier 3 */}
          <div className="ext-panel-scrollable" style={{
            flex: 1, overflowY: 'auto', overflowX: 'hidden',
            scrollbarWidth: 'thin',
            scrollbarColor: `${BORDER.subtle} transparent`,
          }}>
            {/* Villain identity bar — always visible when a seat is active */}
            {activeSeat && (
              <VillainBrief
                seat={activeSeat}
                seatData={seatData}
                villainName={villainName}
                style={advice?.villainStyle || seatData?.style}
                sampleSize={seatData?.sampleSize || advice?.villainSampleSize}
                isPinned={isPinned}
                onUnpin={() => setPinnedSeat(null)}
                villainChanged={villainChanged}
                headline={seatData?.villainProfile?.headline}
              />
            )}

            {hasAdvice ? (
              <>
                {/* Tier 2: Quick Context */}
                <div style={{ padding: '6px 14px 10px' }}>
                  {/* Situation + equity */}
                  <div style={{
                    display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                    marginBottom: 6,
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: 600, color: TEXT.muted,
                      textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>
                      {advice.situationLabel || `${currentStreet || 'Waiting'}…`}
                      {advice.heroAlreadyActed && (
                        <span style={{
                          marginLeft: 6, fontSize: 8, padding: '1px 5px',
                          borderRadius: 3, background: 'rgba(234,179,8,0.15)', color: '#eab308',
                        }}>REVIEW</span>
                      )}
                    </div>
                    {advice.heroEquity != null && (
                      <div style={{
                        fontFamily: FONT.mono, fontSize: 16, fontWeight: 700,
                        color: advice.heroEquity >= 0.50 ? '#4ade80' : '#f87171',
                      }}>
                        {Math.round(advice.heroEquity * 100)}%
                        <span style={{ fontSize: 9, fontWeight: 400, color: TEXT.muted, marginLeft: 2 }}>eq</span>
                      </div>
                    )}
                  </div>

                  {/* Board texture pills */}
                  <BoardTexturePills boardTexture={advice.boardTexture} />

                  {/* Hand plan tree (multi-street guidance) */}
                  <HandPlanTree
                    handPlan={advice.recommendations?.[0]?.handPlan}
                    street={currentStreet}
                  />

                  {/* Blocker insight */}
                  <BlockerInsightStrip
                    blockerEffects={advice.treeMetadata?.blockerEffects}
                    heroCards={liveHandState?.holeCards}
                  />

                  {/* Range advantage */}
                  <RangeAdvantageBar advantage={advice.treeMetadata?.advantage} />

                  {/* Top vulnerability */}
                  <VulnerabilityCallout
                    vulnerabilities={seatData?.villainProfile?.vulnerabilities}
                  />

                  {/* Supporting observations for current street */}
                  <SupportingObservations
                    observations={seatData?.observations}
                    currentStreet={currentStreet}
                  />
                </div>

                {/* Tier 3: Deep Analysis (all panels open) */}
                <div style={{ padding: '0 14px 60px' }}>
                  <BucketEquityPanel
                    bucketEquities={advice.bucketEquities}
                    segmentation={advice.segmentation}
                  />

                  <AllRecommendationsPanel
                    recommendations={advice.recommendations}
                    heroEquity={advice.heroEquity}
                  />

                  <StreetTendenciesPanel
                    villainProfile={seatData?.villainProfile}
                    currentStreet={currentStreet}
                  />

                  <FoldCurvePanel
                    foldMeta={advice.foldMeta}
                    foldCurve={seatData?.villainModel?.personalizedFoldCurve}
                    currentBetFraction={advice.recommendations?.[0]?.sizing?.betFraction}
                  />

                  {/* Villain range composition (hand types) */}
                  <HandTypePanel
                    segmentation={advice.segmentation}
                    bucketEquities={advice.bucketEquities}
                  />

                  {/* Flop archetype breakdown (preflop only) */}
                  <FlopBreakdownPanel flopBreakdown={advice.flopBreakdown} />

                  <FoldBreakdownPanel foldMeta={advice.foldMeta} />

                  <ComboDistributionPanel
                    comboStats={advice.treeMetadata?.comboStats}
                  />

                  <VulnerabilitiesPanel
                    vulnerabilities={seatData?.villainProfile?.vulnerabilities}
                  />

                  {/* Awareness indicators + showdown anchors */}
                  <AwarenessPanel villainProfile={seatData?.villainProfile} />

                  <ModelAuditPanel
                    treeMetadata={advice.treeMetadata}
                    foldMeta={advice.foldMeta}
                    modelQuality={advice.modelQuality}
                    dataQuality={advice.dataQuality}
                  />
                </div>
              </>
            ) : activeSeat && seatData ? (
              /* Seat selected but no live advice — show villain profile */
              <div style={{ padding: '10px 14px', color: TEXT.muted, fontSize: 11 }}>
                {seatData.sampleSize > 0 ? (
                  <span>Waiting for live hand data against Seat {activeSeat}…</span>
                ) : (
                  <span>No data for Seat {activeSeat} yet</span>
                )}
              </div>
            ) : (
              <div style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexDirection: 'column', gap: 8, color: TEXT.muted, fontSize: 12,
                padding: 20, textAlign: 'center',
              }}>
                {isComputing ? (
                  <span>Analyzing…</span>
                ) : handCount > 0 ? (
                  <span>Select a seat or wait for a hand to begin</span>
                ) : (
                  <>
                    <span style={{ fontSize: 20 }}>♠</span>
                    <span>No hands imported yet</span>
                    <span style={{ fontSize: 10, color: TEXT.faint }}>
                      Hands sync automatically from the extension
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Status footer */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '6px 14px', background: SURFACE.inset,
            borderTop: `1px solid ${BORDER.default}`,
            fontSize: 9, fontFamily: FONT.mono, color: TEXT.faint, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: hasAdvice ? '#22c55e' : TEXT.faint,
                animation: hasAdvice ? 'panelLiveDot 2s ease-in-out infinite' : 'none',
              }} />
              <span>
                {hasAdvice ? 'LIVE' : 'IDLE'}
                {currentStreet ? ` · ${currentStreet.toUpperCase()}` : ''}
                {handCount > 0 ? ` · ${handCount} hands` : ''}
              </span>
            </div>
            {advice?.treeMetadata?.computeMs && (
              <span>
                {advice.treeMetadata.computeMs}ms
                {advice.treeMetadata.branches ? ` · ${advice.treeMetadata.branches} branches` : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </>
  );
};
