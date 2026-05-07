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
import { useAnalysisContext } from '../../../contexts/OnlineAnalysisContext';
import { useSyncBridge } from '../../../contexts/SyncBridgeContext';
import { SURFACE, BORDER, TEXT } from '../../../constants/designTokens';
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
  const { tendencyMap, handCount, advice, isComputing } = useAnalysisContext();
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

      <div
        className="w-[400px] h-screen flex flex-col relative overflow-hidden font-display antialiased border-l border-r"
        style={{
          background: SURFACE.body,
          borderLeftColor: BORDER.default,
          borderRightColor: BORDER.default,
          color: TEXT.primary,
        }}
      >
        {/* Noise texture */}
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `repeating-linear-gradient(0deg,transparent,transparent 1px,rgba(255,255,255,0.008) 1px,rgba(255,255,255,0.008) 2px)`,
          }}
        />

        <div className="relative z-[1] flex flex-col h-full">
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
          <div
            className="ext-panel-scrollable flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:thin]"
            style={{ scrollbarColor: `${BORDER.subtle} transparent` }}
          >
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
                <div className="px-3.5 pt-1.5 pb-2.5">
                  {/* Situation + equity */}
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div
                      className="text-[10px] font-semibold uppercase tracking-[0.5px]"
                      style={{ color: TEXT.muted }}
                    >
                      {advice.situationLabel || `${currentStreet || 'Waiting'}…`}
                      {advice.heroAlreadyActed && (
                        <span
                          className="ml-1.5 text-[8px] px-[5px] py-px rounded-[3px]"
                          style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}
                        >REVIEW</span>
                      )}
                    </div>
                    {advice.heroEquity != null && (
                      <div
                        className="font-mono text-base font-bold"
                        style={{ color: advice.heroEquity >= 0.50 ? '#4ade80' : '#f87171' }}
                      >
                        {Math.round(advice.heroEquity * 100)}%
                        <span
                          className="text-[9px] font-normal ml-0.5"
                          style={{ color: TEXT.muted }}
                        >eq</span>
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
                <div className="px-3.5 pb-[60px]">
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
              <div className="px-3.5 py-2.5 text-[11px]" style={{ color: TEXT.muted }}>
                {seatData.sampleSize > 0 ? (
                  <span>Waiting for live hand data against Seat {activeSeat}…</span>
                ) : (
                  <span>No data for Seat {activeSeat} yet</span>
                )}
              </div>
            ) : (
              <div
                className="flex-1 flex flex-col items-center justify-center gap-2 text-xs p-5 text-center"
                style={{ color: TEXT.muted }}
              >
                {isComputing ? (
                  <span>Analyzing…</span>
                ) : handCount > 0 ? (
                  <span>Select a seat or wait for a hand to begin</span>
                ) : (
                  <>
                    <span className="text-xl">♠</span>
                    <span>No hands imported yet</span>
                    <span className="text-[10px]" style={{ color: TEXT.faint }}>
                      Hands sync automatically from the extension
                    </span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Status footer */}
          <div
            className="flex items-center justify-between px-3.5 py-1.5 font-mono text-[9px] shrink-0 border-t"
            style={{
              background: SURFACE.inset,
              borderTopColor: BORDER.default,
              color: TEXT.faint,
            }}
          >
            <div className="flex items-center gap-1.5">
              <div
                className="w-[5px] h-[5px] rounded-full"
                style={{
                  background: hasAdvice ? '#22c55e' : TEXT.faint,
                  animation: hasAdvice ? 'panelLiveDot 2s ease-in-out infinite' : 'none',
                }}
              />
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
