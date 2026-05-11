/**
 * VoiceConfirmationChips.jsx — confirmation strip + correction UX for VCE
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Behavior (binding):
 *   - Renders one chip per parsed card. Chips are INERT until explicit commit
 *     (Gate 2 E-4 + R6 — no auto-commit on any condition).
 *   - Swipe up cycles to NEXT rank in same suit. Swipe down cycles BACK
 *     (R4 swipe-to-cycle).
 *   - Long-press (≥400ms) on a chip raises `onRequestFullPick(slotIndex)` so
 *     consumer can open the existing CardPicker for full rank+suit re-pick
 *     (R4 fallback path).
 *   - Commit button dispatches `onCommit(cards)`; Cancel calls `onCancel()`.
 *   - Single-tap a chip is a no-op (preserves the chip).
 *
 * Rank cycle order: A → K → Q → J → T → 9 → 8 → 7 → 6 → 5 → 4 → 3 → 2 → A …
 *   This is the gameConstants RANKS order. Swipe UP cycles to the NEXT element
 *   (wraps); swipe DOWN cycles to the PREVIOUS element (wraps).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RANKS } from '../../constants/gameConstants';

export const SWIPE_THRESHOLD_PX = 20;
export const LONG_PRESS_MS = 400;

export function nextRank(rank) {
  const i = RANKS.indexOf(rank);
  if (i === -1) return rank;
  return RANKS[(i - 1 + RANKS.length) % RANKS.length]; // RANKS is A,K,Q,...,2 so "up" = lower index
}

export function prevRank(rank) {
  const i = RANKS.indexOf(rank);
  if (i === -1) return rank;
  return RANKS[(i + 1) % RANKS.length];
}

export function cardRank(card) {
  return card && card.length >= 2 ? card[0] : '';
}

export function cardSuit(card) {
  return card && card.length >= 2 ? card.slice(1) : '';
}

/**
 * Classify a vertical pointer delta into a swipe direction.
 * Returns 'up' | 'down' | null.
 * Exported so tests can validate the math without depending on jsdom's
 * pointer-event dispatch (which is unreliable in jsdom across React versions).
 */
export function classifySwipe(dyPx, thresholdPx = SWIPE_THRESHOLD_PX) {
  if (typeof dyPx !== 'number' || Number.isNaN(dyPx)) return null;
  if (dyPx <= -thresholdPx) return 'up';
  if (dyPx >= thresholdPx) return 'down';
  return null;
}

function suitColorClass(suit) {
  if (suit === '♥' || suit === '♦') return 'text-red-400';
  return 'text-white';
}

function Chip({ card, onCycleUp, onCycleDown, onLongPress, testId }) {
  const downRef = useRef({ y: 0, fired: false });
  const longPressTimerRef = useRef(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearLongPress(), [clearLongPress]);

  const onPointerDown = useCallback(
    (e) => {
      downRef.current = { y: e.clientY, fired: false };
      clearLongPress();
      longPressTimerRef.current = setTimeout(() => {
        downRef.current.fired = true;
        onLongPress && onLongPress();
      }, LONG_PRESS_MS);
    },
    [clearLongPress, onLongPress],
  );

  const onPointerUp = useCallback(
    (e) => {
      const dy = e.clientY - downRef.current.y;
      const longFired = downRef.current.fired;
      clearLongPress();
      if (longFired) return; // long-press already fired; swipe is moot
      if (dy <= -SWIPE_THRESHOLD_PX) {
        onCycleUp && onCycleUp();
      } else if (dy >= SWIPE_THRESHOLD_PX) {
        onCycleDown && onCycleDown();
      }
      // else: tap — no-op by spec
    },
    [clearLongPress, onCycleUp, onCycleDown],
  );

  const onPointerCancel = useCallback(() => {
    clearLongPress();
  }, [clearLongPress]);

  const rank = cardRank(card);
  const suit = cardSuit(card);
  return (
    <button
      type="button"
      data-testid={testId}
      data-card={card}
      style={{ width: 64, height: 80 }}
      className="flex flex-col items-center justify-center rounded-md bg-gray-800 border border-gray-600 select-none touch-none"
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <span className="text-2xl font-semibold text-white">{rank}</span>
      <span className={`text-3xl ${suitColorClass(suit)}`}>{suit}</span>
      <span aria-hidden="true" className="mt-0.5 text-[10px] text-gray-400">
        ↕
      </span>
    </button>
  );
}

/**
 * @param {object} props
 * @param {string[] | null} props.cards            — parsed cards; null = render nothing
 * @param {(commitedCards: string[]) => void} props.onCommit
 * @param {() => void} props.onCancel
 * @param {(slotIndex: number) => void} [props.onRequestFullPick] — long-press handler
 * @param {string=} props.label                    — visible header label
 * @param {string=} props.testId
 */
export default function VoiceConfirmationChips({
  cards,
  onCommit,
  onCancel,
  onRequestFullPick,
  label = 'Heard:',
  testId = 'voice-confirmation-chips',
}) {
  const [working, setWorking] = useState(cards || []);

  // Hard reset when external `cards` changes (new parser result).
  useEffect(() => {
    setWorking(cards || []);
  }, [cards]);

  const empty = !working || working.length === 0;

  const handleCycleUp = useCallback((i) => {
    setWorking((prev) => {
      const next = [...prev];
      const r = nextRank(cardRank(next[i]));
      next[i] = `${r}${cardSuit(next[i])}`;
      return next;
    });
  }, []);

  const handleCycleDown = useCallback((i) => {
    setWorking((prev) => {
      const next = [...prev];
      const r = prevRank(cardRank(next[i]));
      next[i] = `${r}${cardSuit(next[i])}`;
      return next;
    });
  }, []);

  const handleLongPress = useCallback(
    (i) => {
      onRequestFullPick && onRequestFullPick(i);
    },
    [onRequestFullPick],
  );

  const handleCommit = useCallback(() => {
    if (empty) return;
    onCommit && onCommit(working);
  }, [empty, onCommit, working]);

  const handleCancel = useCallback(() => {
    onCancel && onCancel();
  }, [onCancel]);

  const chips = useMemo(() => working.map((card, i) => (
    <Chip
      // eslint-disable-next-line react/no-array-index-key
      key={`${card}-${i}`}
      card={card}
      onCycleUp={() => handleCycleUp(i)}
      onCycleDown={() => handleCycleDown(i)}
      onLongPress={() => handleLongPress(i)}
      testId={`${testId}-chip-${i}`}
    />
  )), [working, handleCycleUp, handleCycleDown, handleLongPress, testId]);

  if (empty) return null;

  return (
    <div
      data-testid={testId}
      className="flex items-center gap-2 bg-gray-900/95 border border-gray-700 rounded-lg p-2"
    >
      <span className="text-xs text-gray-400 pr-1">{label}</span>
      <div className="flex items-center gap-1.5">{chips}</div>
      <button
        type="button"
        data-testid={`${testId}-commit`}
        onClick={handleCommit}
        className="ml-2 px-3 py-1.5 rounded-md bg-emerald-700 text-white text-sm font-medium border border-emerald-600 hover:bg-emerald-600"
      >
        Commit
      </button>
      <button
        type="button"
        data-testid={`${testId}-cancel`}
        onClick={handleCancel}
        className="px-3 py-1.5 rounded-md bg-gray-700 text-white text-sm border border-gray-600 hover:bg-gray-600"
      >
        Cancel
      </button>
    </div>
  );
}
