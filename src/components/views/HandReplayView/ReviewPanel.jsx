/**
 * ReviewPanel.jsx - Right-side analysis panel for hand replay
 *
 * Sections: Street progress, playback transport, current action card,
 * hero coaching (HeroCoachingCard), villain analysis (VillainAnalysisSection).
 */

import React, { useMemo, useCallback } from 'react';
import { getPositionName } from '../../../utils/positionUtils';
import { PRIMITIVE_BUTTON_CONFIG } from '../../../constants/primitiveActions';
import { STREET_LABELS_SHORT } from '../../../constants/gameConstants';
import { EV_COLORS } from '../../../constants/designTokens';
import { getPlayerName } from '../../../utils/handAnalysis';
import { HeroCoachingCard } from './HeroCoachingCard';
import { VillainAnalysisSection } from './VillainAnalysisSection';
// EAL Phase 6 Stream D B3 (S17, 2026-04-27) — Tier 0 owner observation capture.
import { AnchorObservationSection } from './AnchorObservationSection';
import { TendencyStatsCard } from '../../ui/TendencyStatsCard';
// HSP-W1 (WS-143 / SPR-029, 2026-05-03) — first-consumer wire for the Hero State Primitive.
// Renders canonical-vs-actual side-by-side panels per hero decision point.
// Surface spec: docs/design/surfaces/hand-replay-view.md §"HeroStateSection".
import { HeroStateSection } from './HeroStateSection';
// SLS Stream B1 (WS-041 / SPR-082, 2026-05-15) — Range Silhouette descriptor row.
// Classifies the active villain's preflop range into one of 5 prototypes
// (Oval/Barbell/Triangle/Comb/Cloud) and renders the label + confidence.
// Read-only embed; no mastery writes. See `docs/projects/poker-shape-language.project.md`.
import { RangeSilhouetteSection } from './RangeSilhouetteSection';
// SLS Stream B2 (WS-042 / SPR-084, 2026-05-16) — Equity-Distribution Curve,
// Spire+Polarization, Sizing Curve Tag descriptor rows. All three currently
// receive null props because per-combo equity + EV-by-sizing data is not yet
// exposed in `villainAnalysis` for the review surface — sections render null
// until a follow-up sprint plumbs the data through. Classifier modules +
// lessons + tests are real; visible-on-screen impact unlocks then.
import { EquityDistributionCurveSection } from './EquityDistributionCurveSection';
import { SpirePolarizationSection } from './SpirePolarizationSection';
import { SizingCurveTagSection } from './SizingCurveTagSection';
// SLS Stream B3 (WS-043 / SPR-088, 2026-05-18) — Saddle (way-ahead /
// way-behind) descriptor row. Consumes `villainAnalysis.perCombo` (wired
// by SPR-086) and emits a two-mass classification (wayAheadMass +
// wayBehindMass + middleMass + label). Basin/Sankey deferred — see
// shapeLanguage/CLAUDE.md Basin scope re-frame note and memory
// `feedback_river_equity_is_showdown_outcome.md`.
import { SaddleSection } from './SaddleSection';
// SCF G5 / WS-158 (2026-05-03) — hero-leak badge inside HeroCoachingCard.
// Per chris-live-player.md autonomy red lines #5 + #8: source-util-policy
// whitelisted (review-mode only); no shame copy in alignment labels.
import { useHeroLeaks } from '../../../hooks/useHeroLeaks';
import { deriveSituationKey } from '../../../utils/skillAssessment/deriveSituationKey';
import { GUEST_USER_ID } from '../../../utils/persistence/index';
// SCF G5 / WS-147 (SPR-032, 2026-05-03) — Drill-this navigates to LessonDetailView via UIContext.
import { useUI } from '../../../contexts';

export const ReviewPanel = ({
  replay,
  hand,
  heroSeat,
  buttonSeat,
  seatPlayers,
  seatNames,
  tendencyMap,
  actionAnalysis,
  allPlayerCards,
}) => {
  const {
    currentActionIndex, currentStreet, currentActionEntry, currentAnalysis,
    villainAnalysis, selectedVillainSeat, pinnedVillainSeat, revealedSeats,
    availableStreets, timelineLength, potAtPoint,
    stepForward, stepBack, jumpToStart, jumpToEnd, jumpToStreet,
    analysisLens, setAnalysisLens,
    visibleActions,
  } = replay;

  // Determine if selected villain's cards are known (revealed or always visible)
  const villainCards = useMemo(() => {
    if (!selectedVillainSeat) return null;
    const cards = allPlayerCards[selectedVillainSeat] || allPlayerCards[String(selectedVillainSeat)];
    if (!cards || !cards[0] || !cards[1]) return null;
    if (!revealedSeats.has(selectedVillainSeat)) return null;
    return cards;
  }, [selectedVillainSeat, allPlayerCards, revealedSeats]);

  // Compute villainStyle for VillainAnalysisSection
  const villainStyle = useMemo(() => {
    if (!selectedVillainSeat) return null;
    const playerId = seatPlayers[selectedVillainSeat];
    if (!playerId) return null;
    return tendencyMap?.[playerId]?.style || null;
  }, [selectedVillainSeat, seatPlayers, tendencyMap]);

  // SPR-063 / WS-135 — Compute villainTendency for the credible-interval rollup card
  const villainTendency = useMemo(() => {
    if (!selectedVillainSeat) return null;
    const playerId = seatPlayers[selectedVillainSeat];
    if (!playerId) return null;
    return tendencyMap?.[playerId] || null;
  }, [selectedVillainSeat, seatPlayers, tendencyMap]);

  // Is current action a hero action?
  const isHeroAction = heroSeat && currentActionEntry && Number(currentActionEntry.seat) === heroSeat;
  const heroCoaching = currentAnalysis?.heroAnalysis || null;

  // SCF G5 / WS-158 — derive situation key for current decision point + look up active leak.
  const situationKey = useMemo(
    () => isHeroAction
      ? deriveSituationKey({ hand, actionEntry: currentActionEntry, heroSeat, buttonSeat })
      : null,
    [isHeroAction, hand, currentActionEntry, heroSeat, buttonSeat],
  );
  const heroLeakState = useHeroLeaks(GUEST_USER_ID, situationKey);
  // SCF G5 / WS-147 (SPR-032, 2026-05-03) — Drill-this opens LessonDetailView.
  // Per autonomy red line #5: navigation only, no graded transition copy.
  const { openLessonDetail } = useUI();
  const onDrillLeak = useCallback((leak) => {
    if (!leak?.relatedConceptId) return;
    openLessonDetail(leak.relatedConceptId);
  }, [openLessonDetail]);

  // Model accuracy summary across all villain actions with predictions
  const modelAccuracy = useMemo(() => {
    if (!actionAnalysis || actionAnalysis.length === 0) return null;
    let correct = 0, total = 0;
    for (const a of actionAnalysis) {
      if (!a?.modelPrediction?.actions || !a.modelPrediction.actualAction) continue;
      total++;
      // "Correct" = the actual action was the model's most-probable action
      const entries = Object.entries(a.modelPrediction.actions);
      const topAction = entries.reduce((best, cur) => cur[1] > best[1] ? cur : best, ['', 0])[0];
      if (topAction === a.modelPrediction.actualAction) correct++;
    }
    if (total < 2) return null;
    return { correct, total };
  }, [actionAnalysis]);

  return (
    <div className="flex flex-col h-full p-3 gap-3">
      {/* A. Street Progress */}
      <div className="flex gap-1.5 shrink-0">
        {availableStreets.map((street) => {
          const isCurrent = street === currentStreet;
          const streetIdx = availableStreets.indexOf(street);
          const currentStreetIdx = availableStreets.indexOf(currentStreet);
          const isCompleted = streetIdx < currentStreetIdx;
          return (
            <button
              key={street}
              onClick={() => jumpToStreet(street)}
              className={`
                px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${isCurrent
                  ? 'bg-cyan-600 text-white'
                  : isCompleted
                    ? 'bg-gray-700 text-cyan-400'
                    : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
                }
              `}
            >
              {isCompleted && <span className="mr-1">&#10003;</span>}
              {STREET_LABELS_SHORT[street] || street}
            </button>
          );
        })}
      </div>

      {/* B. Playback Transport */}
      <div className="flex items-center gap-2 shrink-0 bg-gray-800/50 rounded-lg px-3 py-2">
        <button onClick={jumpToStart} className="text-gray-400 hover:text-white text-sm px-1" title="Jump to start (Home)">
          |&#9664;
        </button>
        <button onClick={stepBack} className="text-gray-400 hover:text-white text-lg px-1" title="Step back (Left)">
          &#9664;
        </button>
        <button onClick={stepForward} className="text-gray-400 hover:text-white text-lg px-1" title="Step forward (Right)">
          &#9654;
        </button>
        <button onClick={jumpToEnd} className="text-gray-400 hover:text-white text-sm px-1" title="Jump to end (End)">
          &#9654;|
        </button>
        <span className="text-gray-500 text-xs ml-auto">
          Action {currentActionIndex + 1} / {timelineLength}
        </span>
      </div>

      {/* C. Current Action Card */}
      {currentActionEntry && (
        <div className="shrink-0 bg-gray-800/60 rounded-lg p-3 border border-gray-700">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-xs">
              {getPositionName(Number(currentActionEntry.seat), buttonSeat)}
            </span>
            <span className="text-white text-sm font-semibold">
              {getPlayerName(seatNames, Number(currentActionEntry.seat))}
            </span>
            {(() => {
              const config = PRIMITIVE_BUTTON_CONFIG[currentActionEntry.action];
              return config ? (
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-bold text-white"
                  style={{ backgroundColor: config.bg }}
                >
                  {config.label}
                  {currentActionEntry.amount ? ` $${currentActionEntry.amount}` : ''}
                </span>
              ) : (
                <span className="text-gray-400 text-xs">{currentActionEntry.action}</span>
              );
            })()}
          </div>

          {/* EV badge */}
          {currentAnalysis?.evAssessment && (
            <div className="mt-2 flex items-center gap-2">
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold"
                style={{
                  backgroundColor: EV_COLORS[currentAnalysis.evAssessment.verdict]?.bg || '#374151',
                  color: EV_COLORS[currentAnalysis.evAssessment.verdict]?.text || '#9ca3af',
                }}
              >
                {currentAnalysis.evAssessment.verdict}
              </span>
              <span className="text-gray-500 text-[10px]">
                {currentAnalysis.evAssessment.reason}
              </span>
            </div>
          )}

          {/* Action class (value/thin/bluff) — MoE-banded per FIND-002 */}
          {currentAnalysis?.actionClass?.class && (
            <div className="mt-1">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                currentAnalysis.actionClass.class === 'value'
                  ? 'bg-green-900/50 text-green-400'
                  : currentAnalysis.actionClass.class === 'thin'
                    ? 'bg-yellow-900/50 text-yellow-400'
                    : 'bg-red-900/50 text-red-400'
              }`}>
                {currentAnalysis.actionClass.class === 'thin' ? 'thin value' : currentAnalysis.actionClass.class}
                {currentAnalysis.actionClass.moe != null && (
                  <span className="ml-1 opacity-75 normal-case font-normal">
                    (±{(currentAnalysis.actionClass.moe * 100).toFixed(1)}%)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}

      {/* D. Hero Coaching Card (with SCF leak badge per WS-158 / SPR-031) */}
      {isHeroAction && (
        <HeroCoachingCard
          heroCoaching={heroCoaching}
          leak={heroLeakState.leak}
          onSnooze={heroLeakState.snooze}
          onDismiss={heroLeakState.dismiss}
          onDrill={onDrillLeak}
        />
      )}

      {/* D2. HSP HandReplay wire (WS-143 / SPR-029, 2026-05-03) */}
      {isHeroAction && (
        <HeroStateSection
          hand={hand}
          currentActionEntry={currentActionEntry}
          visibleActions={visibleActions}
          heroSeat={heroSeat}
          buttonSeat={buttonSeat}
          villainProfile={villainAnalysis?.villainProfile || null}
          villainRange={villainAnalysis?.villainRange || null}
          villainModel={villainAnalysis?.villainModel || null}
        />
      )}

      {/* D3. SLS Range Silhouette descriptor row (WS-041 / SPR-082, 2026-05-15).
          Read-only classifier embed; no mastery writes. */}
      {isHeroAction && (
        <RangeSilhouetteSection
          villainRange={villainAnalysis?.villainRange || null}
        />
      )}

      {/* D4. SLS Stream B2 descriptor rows (WS-042 / SPR-084, 2026-05-16).
          Equity-Distribution Curve + Spire+Polarization + Sizing Curve Tag.
          All three accept null props today (data not yet wired through
          villainAnalysis) and render null. Per-combo equity + EV-by-sizing
          plumbing is a follow-up. Sections are mounted now so the wiring
          flips a single null → real-data swap when it lands. */}
      {isHeroAction && (
        <EquityDistributionCurveSection
          perCombo={villainAnalysis?.perCombo || null}
        />
      )}
      {isHeroAction && (
        <SpirePolarizationSection
          perCombo={villainAnalysis?.perCombo || null}
        />
      )}
      {isHeroAction && (
        <SizingCurveTagSection
          evByFraction={villainAnalysis?.evByFraction || null}
        />
      )}
      {/* D5. SLS Stream B3 Saddle descriptor row (WS-043 / SPR-088,
          2026-05-18). Way-ahead / way-behind mass classification on the
          villain's per-combo equity distribution. Sibling to the B2
          sections; same prop wire (perCombo). Renders null when
          perCombo is absent or below the sparse-input floor. */}
      {isHeroAction && (
        <SaddleSection
          perCombo={villainAnalysis?.perCombo || null}
        />
      )}

      {/* E. Villain Analysis */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <VillainAnalysisSection
          selectedVillainSeat={selectedVillainSeat}
          villainAnalysis={villainAnalysis}
          villainCards={villainCards}
          pinnedVillainSeat={pinnedVillainSeat}
          analysisLens={analysisLens}
          setAnalysisLens={setAnalysisLens}
          currentAnalysis={currentAnalysis}
          currentActionEntry={currentActionEntry}
          potAtPoint={potAtPoint}
          hand={hand}
          isHeroAction={isHeroAction}
          seatNames={seatNames}
          buttonSeat={buttonSeat}
          villainStyle={villainStyle}
        />
      </div>

      {/* SPR-063 / WS-135 — Villain tendency credible-interval card,
          peer to VillainAnalysisSection. Reads tendencyMap at the
          ReviewPanel level so VillainAnalysisSection stays unchanged. */}
      {villainTendency && (
        <TendencyStatsCard
          stats={villainTendency}
          title="Villain Tendency"
          testId="review-panel-tendency-card"
        />
      )}

      {/* G. Anchor Observation Capture (EAL S17, Tier 0) */}
      {hand?.handId && (
        <AnchorObservationSection
          handId={hand.handId}
          initialStreetKey={currentStreet}
          initialActionIndex={currentActionIndex}
        />
      )}

      {/* F. Model Accuracy Summary */}
      {modelAccuracy && (
        <div className="shrink-0 flex items-center justify-between px-3 py-1.5 bg-gray-800/40 rounded text-[10px]">
          <span className="text-gray-500">Model accuracy</span>
          <span style={{
            fontWeight: 700,
            color: modelAccuracy.correct / modelAccuracy.total >= 0.5 ? '#22c55e' : '#eab308',
          }}>
            {modelAccuracy.correct}/{modelAccuracy.total} predicted correctly
          </span>
        </div>
      )}
    </div>
  );
};
