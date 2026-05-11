/**
 * VoiceCardEntryOverlay — viewport-anchored PTT + chip strip for VCE.
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Mounted at the AppRoot level (outside ScaledContainer per D-5).
 * Conditionally renders only when:
 *   - settings.voiceCardEntry.enabled === true
 *   - We're on TableView (board entry path).
 *   - At least one community-card slot is empty.
 *
 * On commit: fills the empty community-card slots left-to-right from the
 * parsed cards, dispatching SET_COMMUNITY_CARD per card.
 *
 * NOTE: ShowdownView per-villain wiring (D-1 ratification) is deferred to
 * Phase D2 follow-up. R3 ship-or-drop priority is validating the board path
 * first (higher frequency: 3× per hand vs. 1× showdown). If kill criteria
 * pass on board, showdown wiring is a small follow-up — same hook + parser
 * already proven, only the per-row placement is new.
 */

import { useCallback, useMemo } from 'react';
import { useCard, useSettings, useUI } from '../../contexts';
import { SCREEN } from '../../constants/uiConstants';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { useVoiceCardEntry } from '../../hooks/useVoiceCardEntry';
import VoicePttButton from './VoicePttButton';
import VoiceConfirmationChips from './VoiceConfirmationChips';

function firstNEmptyIndices(communityCards, n) {
  const out = [];
  for (let i = 0; i < communityCards.length && out.length < n; i++) {
    const c = communityCards[i];
    if (!c || c === '') out.push(i);
  }
  return out;
}

export default function VoiceCardEntryOverlay() {
  const { settings } = useSettings();
  const { currentView, isShowdownViewOpen } = useUI();
  const { communityCards, dispatchCard } = useCard();

  const vceConfig = settings?.voiceCardEntry || { enabled: false, confidenceThreshold: 0.65 };
  const enabled = !!vceConfig.enabled;
  const threshold = Number.isFinite(vceConfig.confidenceThreshold)
    ? vceConfig.confidenceThreshold
    : 0.65;

  // State-aware visibility (Gate 2 E-5).
  // For this iteration: TableView board entry only. Showdown deferred.
  const onTableView = currentView === SCREEN.TABLE && !isShowdownViewOpen;
  const hasEmptyBoardSlots = useMemo(
    () => (communityCards || []).some((c) => !c || c === ''),
    [communityCards],
  );
  const surfaceReady = onTableView && hasEmptyBoardSlots;

  const {
    supported,
    permissionStatus,
    isListening,
    result,
    startHold,
    release,
    reset,
  } = useVoiceCardEntry({ confidenceThreshold: threshold });

  const handleCommit = useCallback(
    (committedCards) => {
      if (!Array.isArray(committedCards) || committedCards.length === 0) {
        reset();
        return;
      }
      const slots = firstNEmptyIndices(communityCards || [], committedCards.length);
      slots.forEach((slotIdx, i) => {
        const card = committedCards[i];
        if (card) {
          dispatchCard({
            type: CARD_ACTIONS.SET_COMMUNITY_CARD,
            payload: { index: slotIdx, card },
          });
        }
      });
      reset();
    },
    [communityCards, dispatchCard, reset],
  );

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  // Gate render entirely when flag is OFF OR not on a VCE-eligible surface.
  if (!enabled) return null;
  if (!surfaceReady) return null;

  // Bottom-right viewport anchor + small chip strip slot above.
  // Outside ScaledContainer (D-5) — fixed viewport positioning, constant size.
  return (
    <div
      data-testid="voice-card-entry-overlay"
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden={false}
    >
      {/* Confirmation chip strip — top-center, above the TableView action zone.
          Sits in the small empty band between view chrome top and the action
          buttons so it never overlaps either action buttons or CTA stack. */}
      {result && Array.isArray(result.cards) && result.cards.length > 0 && (
        <div
          className="pointer-events-auto absolute top-24 left-1/2 -translate-x-1/2"
          data-testid="voice-card-entry-overlay-chips-container"
        >
          <VoiceConfirmationChips
            cards={result.cards}
            onCommit={handleCommit}
            onCancel={handleCancel}
            label="Heard:"
          />
        </div>
      )}

      {/* PTT button — TOP-RIGHT in the band BETWEEN the streets-tabs row
          (y=4–44) and the position-tabs row (y=115–151), 56×56 px constant.
          Placement empirically verified at 1600×720 via DOM-enumerated probe
          (2026-05-11): clears all other interactive elements on TableView
          REGARDLESS of active seat count. The position-tabs row extends
          rightward as more seats activate (BB+7 at 8 seats ends at x=1521;
          BB+8 at 9 seats ends at x=1548), so anchoring to a fixed y above
          that row is more durable than picking a horizontal slot inside it.
          The right column is densely packed from y=193 (action zone) through
          y=712 (Next Hand) — a prior bottom-right placement overlapped the
          Next Hand button (Gate 2 SC-4 violation, discovered 2026-05-11).
          Gate 2 SC-4 binding. Regression-tested by VoiceCardEntryOverlay
          Playwright spec which asserts zero overlap on TableView load. */}
      <div
        className="pointer-events-auto absolute top-12 right-1"
        data-testid="voice-card-entry-overlay-ptt-container"
      >
        <VoicePttButton
          supported={supported}
          permissionStatus={permissionStatus}
          isListening={isListening}
          onHoldStart={startHold}
          onHoldEnd={release}
          label="Hold to speak board cards"
        />
        {permissionStatus === 'denied' && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-md bg-gray-900/95 border border-gray-700 px-2 py-1 text-[10px] text-gray-300"
            data-testid="voice-card-entry-overlay-mic-denied"
          >
            Microphone access denied — open device settings to enable.
          </div>
        )}
        {!supported && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-md bg-gray-900/95 border border-gray-700 px-2 py-1 text-[10px] text-gray-300"
            data-testid="voice-card-entry-overlay-not-supported"
          >
            Voice not supported on this browser.
          </div>
        )}
      </div>
    </div>
  );
}
