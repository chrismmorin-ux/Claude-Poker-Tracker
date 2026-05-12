/**
 * VoiceCardEntryOverlay — viewport-anchored PTT + chip strip for VCE.
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Mounted at the AppRoot level (outside ScaledContainer per D-5).
 * Two render contexts:
 *   - TableView: board card entry. Scope label "BOARD". Commits to
 *     communityCards via SET_COMMUNITY_CARD, filling next empty slots.
 *   - ShowdownView: per-villain card entry. Scope label "V<seat>" where
 *     seat is the next uncaptured non-hero villain that took an action
 *     postflop. Auto-advances target as villains' cards fill.
 *
 * After-commit behavior preserves the existing flow — the same SET_COMMUNITY_CARD
 * and SET_PLAYER_CARD actions the existing tap CardPicker dispatches.
 *
 * Position is owner-configurable (Settings → PTT button position):
 *   - 'bottom-left' (default): viewport (8, 660, 64, 716). Near phone mic
 *     and speaker on Galaxy A22 landscape. Verified clear via Playwright probe.
 *   - 'top-right': viewport (1540, 48, 1596, 104). Legacy placement; clear of
 *     the position-tabs row at all seat counts.
 */

import { useCallback, useMemo } from 'react';
import { useCard, useGame, useSettings, useUI } from '../../contexts';
import { SCREEN } from '../../constants/uiConstants';
import { CARD_ACTIONS } from '../../reducers/cardReducer';
import { SEAT_ARRAY } from '../../constants/gameConstants';
import { useVoiceCardEntry } from '../../hooks/useVoiceCardEntry';
import VoicePttButton from './VoicePttButton';
import VoiceConfirmationChips from './VoiceConfirmationChips';

function firstNEmptyCommunityIndices(communityCards, n) {
  const out = [];
  for (let i = 0; i < communityCards.length && out.length < n; i++) {
    const c = communityCards[i];
    if (!c || c === '') out.push(i);
  }
  return out;
}

// Return the seats that took a public action on the river OR were still in
// the hand at showdown — i.e., villains whose hole cards we'd care about
// recording. Skips hero (mySeat) and absent seats.
function uncapturedVillainSeats({
  allPlayerCards,
  actionSequence,
  mySeat,
  absentSeats = [],
}) {
  const villainActed = new Set();
  for (const entry of actionSequence || []) {
    if (entry && typeof entry.seat === 'number' && entry.seat !== mySeat) {
      villainActed.add(entry.seat);
    }
  }
  // Order by seat number for deterministic auto-advance.
  return SEAT_ARRAY.filter((seat) => {
    if (seat === mySeat) return false;
    if (absentSeats.includes(seat)) return false;
    if (!villainActed.has(seat)) return false;
    const cards = allPlayerCards?.[seat] || ['', ''];
    const hasBoth = cards[0] && cards[1] && cards[0] !== '' && cards[1] !== '';
    return !hasBoth;
  });
}

function firstEmptyPlayerSlot(allPlayerCards, seat) {
  const cards = allPlayerCards?.[seat] || ['', ''];
  if (!cards[0] || cards[0] === '') return 0;
  if (!cards[1] || cards[1] === '') return 1;
  return -1;
}

export default function VoiceCardEntryOverlay() {
  const { settings } = useSettings();
  const { currentView, isShowdownViewOpen } = useUI();
  const { communityCards, allPlayerCards, dispatchCard } = useCard();
  const { actionSequence, mySeat, absentSeats } = useGame();

  const vceConfig = settings?.voiceCardEntry || {};
  const enabled = !!vceConfig.enabled;
  const threshold = Number.isFinite(vceConfig.confidenceThreshold)
    ? vceConfig.confidenceThreshold
    : 0.65;
  const activationMode = vceConfig.activationMode === 'tap' ? 'tap' : 'hold';
  const position = vceConfig.position === 'top-right' ? 'top-right' : 'bottom-left';

  const onTableView = currentView === SCREEN.TABLE && !isShowdownViewOpen;
  const onShowdownView = isShowdownViewOpen === true;

  const hasEmptyBoardSlots = useMemo(
    () => (communityCards || []).some((c) => !c || c === ''),
    [communityCards],
  );

  const villainQueue = useMemo(() => {
    if (!onShowdownView) return [];
    return uncapturedVillainSeats({
      allPlayerCards,
      actionSequence,
      mySeat,
      absentSeats: absentSeats || [],
    });
  }, [onShowdownView, allPlayerCards, actionSequence, mySeat, absentSeats]);

  const targetVillain = villainQueue[0] ?? null;

  // Visibility predicate
  const surfaceReady = enabled && (
    (onTableView && hasEmptyBoardSlots) ||
    (onShowdownView && targetVillain !== null)
  );

  const {
    supported,
    permissionStatus,
    isListening,
    result,
    startHold,
    release,
    tapToggle,
    reset,
  } = useVoiceCardEntry({ confidenceThreshold: threshold, activationMode });

  const handleCommit = useCallback(
    (committedCards) => {
      if (!Array.isArray(committedCards) || committedCards.length === 0) {
        reset();
        return;
      }
      if (onTableView) {
        const slots = firstNEmptyCommunityIndices(communityCards || [], committedCards.length);
        slots.forEach((slotIdx, i) => {
          const card = committedCards[i];
          if (!card) return;
          dispatchCard({
            type: CARD_ACTIONS.SET_COMMUNITY_CARD,
            payload: { index: slotIdx, card },
          });
        });
      } else if (onShowdownView && targetVillain !== null) {
        // Fill the current targetVillain's two slots, then if any cards remain
        // (e.g., user spoke 4 cards for two villains in one utterance) advance
        // to the next uncaptured villain.
        let remaining = [...committedCards];
        let v = targetVillain;
        const localQueue = [...villainQueue];
        while (remaining.length > 0 && v !== undefined && v !== null) {
          let slot = firstEmptyPlayerSlot(allPlayerCards, v);
          while (slot !== -1 && remaining.length > 0) {
            const card = remaining.shift();
            dispatchCard({
              type: CARD_ACTIONS.SET_PLAYER_CARD,
              payload: { seat: v, slotIndex: slot, card },
            });
            slot = slot === 0 ? 1 : -1; // local progression; refresh from state next iter
            // Note: in practice, two cards per villain; after that, advance.
            if (slot === 1) {
              // Check whether slot 1 will be available after slot 0 fill
              const cards = allPlayerCards?.[v] || ['', ''];
              if (cards[1] && cards[1] !== '') slot = -1;
            }
          }
          // Advance villain
          localQueue.shift();
          v = localQueue[0];
        }
      }
      reset();
    },
    [onTableView, onShowdownView, targetVillain, villainQueue, communityCards, allPlayerCards, dispatchCard, reset],
  );

  const handleCancel = useCallback(() => {
    reset();
  }, [reset]);

  if (!surfaceReady) return null;

  const scopeLabel = onTableView
    ? 'BOARD'
    : targetVillain !== null
      ? `V${targetVillain}`
      : 'BOARD';

  // Position classes per D-5 + post-iteration owner choice.
  // bottom-left at (8, 660): viewport-anchored, near sidebar nav stack edge.
  // top-right at (1540, 48): legacy band between streets-tabs and position-tabs.
  const pttPositionClasses =
    position === 'top-right'
      ? 'absolute top-12 right-1'
      : 'absolute bottom-1 left-16';

  // Chip strip placement — keep above the action zone in both cases.
  const chipStripClasses =
    position === 'top-right'
      ? 'absolute top-24 left-1/2 -translate-x-1/2'
      : 'absolute bottom-24 left-1/2 -translate-x-1/2';

  return (
    <div
      data-testid="voice-card-entry-overlay"
      data-position={position}
      data-activation-mode={activationMode}
      data-scope={scopeLabel}
      className="pointer-events-none fixed inset-0 z-40"
      aria-hidden={false}
    >
      {/* Confirmation chip strip. Non-overlapping with action zone. */}
      {result && Array.isArray(result.cards) && result.cards.length > 0 && (
        <div
          className={`pointer-events-auto ${chipStripClasses}`}
          data-testid="voice-card-entry-overlay-chips-container"
        >
          <VoiceConfirmationChips
            cards={result.cards}
            onCommit={handleCommit}
            onCancel={handleCancel}
            label={onTableView ? 'Board:' : `V${targetVillain ?? ''} cards:`}
          />
        </div>
      )}

      {/* PTT button — scope-labeled per surface. */}
      <div
        className={`pointer-events-auto ${pttPositionClasses}`}
        data-testid="voice-card-entry-overlay-ptt-container"
      >
        <VoicePttButton
          supported={supported}
          permissionStatus={permissionStatus}
          isListening={isListening}
          activationMode={activationMode}
          onHoldStart={startHold}
          onHoldEnd={release}
          onTapToggle={tapToggle}
          scopeLabel={scopeLabel}
          feedbackPlacement={position === 'top-right' ? 'bottom' : 'top'}
        />
        {/* Mic-denied / unsupported diagnostics — non-modal passive banners. */}
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
