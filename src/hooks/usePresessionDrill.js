/**
 * usePresessionDrill.js - Drill state orchestrator
 *
 * Per surface spec `docs/design/surfaces/presession-drill.md`.
 *
 * Modes (Commit 8.2 Phase A):
 *   1. Entry     — hero selects time budget + villains
 *   2. Flashcards — card-by-card reveal flow
 *   3. Retry    — replay retry-queued cards (new this commit)
 *   4. Exit     — final watchlist summary + hand-off (replaces placeholder)
 *
 * State machine:
 *   entry → flashcards (Start Drill)
 *   flashcards → flashcards (Next card)
 *   flashcards → retry (deck done AND retryQueued > 0)
 *   flashcards → exit (deck done AND retryQueued === 0)
 *   retry → retry (Next retry card)
 *   retry → exit (All retries done OR "I'm ready")
 *   * → entry (abandonDrill)
 *
 * Integrates useAssumptions for state/dispatch. Feature-flag-independent; the
 * view gates on flag.
 *
 * Time-budget variants per surface spec Entry mode:
 *   5 min  → 3 cards
 *   15 min → 5–7 cards (v1 ships 5)
 *   30 min → 10–15 cards (v1 ships 10)
 */

import { useCallback, useMemo, useState } from 'react';
import { useAssumptions } from '../contexts/AssumptionContext';
import {
  drillSessionStarted,
  drillCardRevealed,
  drillCardAnswered,
  drillSessionCompleted,
  drillSessionAbandoned,
  assumptionDialChanged,
} from '../reducers/assumptionReducer';

const TIME_BUDGET_CARD_COUNTS = Object.freeze({
  5: 3,
  15: 5,
  30: 10,
});

/**
 * @returns {Object} Drill orchestrator API
 */
export const usePresessionDrill = () => {
  const { state, dispatch } = useAssumptions();

  // UI-local state (not in reducer — drill session lifecycle is)
  const [mode, setMode] = useState('entry'); // entry | flashcards | retry | exit
  const [timeBudget, setTimeBudget] = useState(15);
  const [selectedVillainIds, setSelectedVillainIds] = useState([]);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);
  const [retryQueueIds, setRetryQueueIds] = useState([]); // assumption ids queued for retry
  const [retryIndex, setRetryIndex] = useState(0); // index within retry queue

  // Derived: primary card deck from selected villains' actionable assumptions
  const deck = useMemo(() => {
    if (selectedVillainIds.length === 0) return [];
    const desiredCardCount = TIME_BUDGET_CARD_COUNTS[timeBudget] ?? 5;
    const candidates = [];
    for (const vId of selectedVillainIds) {
      const ids = state.activeByVillain[vId] || [];
      for (const id of ids) {
        const a = state.assumptions[id];
        if (a && a.quality?.actionableInDrill) candidates.push(a);
      }
    }
    // Sort descending by composite for best-teaching-first ordering.
    candidates.sort((a, b) =>
      (b.quality?.composite ?? 0) - (a.quality?.composite ?? 0));
    return candidates.slice(0, desiredCardCount);
  }, [selectedVillainIds, timeBudget, state.activeByVillain, state.assumptions]);

  // Derived: retry deck built from queued ids (resolving against state)
  const retryDeck = useMemo(() =>
    retryQueueIds.map((id) => state.assumptions[id]).filter(Boolean),
    [retryQueueIds, state.assumptions]);

  const currentCard = mode === 'retry'
    ? (retryDeck[retryIndex] ?? null)
    : (deck[currentCardIndex] ?? null);

  // Available villains for entry-mode selector
  const availableVillains = useMemo(() => {
    const entries = Object.entries(state.activeByVillain);
    return entries.map(([villainId, assumptionIds]) => ({
      villainId,
      actionableCount: assumptionIds.filter((id) => {
        const a = state.assumptions[id];
        return a && a.quality?.actionableInDrill;
      }).length,
    }));
  }, [state.activeByVillain, state.assumptions]);

  // Session summary for exit mode (mood-aware framing consumer)
  const sessionSummary = useMemo(() => {
    const sessionCards = state.drillSession?.cardsShown ?? [];
    const correct = sessionCards.filter((c) => c.heroAnswered === 'correct').length;
    const retryLater = sessionCards.filter((c) => c.heroAnswered === 'retry-later').length;
    const skipped = sessionCards.filter((c) => c.heroAnswered === 'skip').length;
    const totalAnswered = correct + retryLater + skipped;
    const hitRate = totalAnswered === 0 ? 0 : correct / totalAnswered;
    let mood;
    if (hitRate >= 0.80) mood = 'upbeat';
    else if (hitRate >= 0.50) mood = 'neutral';
    else mood = 'encouraging';
    return {
      correct,
      retryLater,
      skipped,
      totalAnswered,
      hitRate,
      mood,
      totalCards: sessionCards.length,
    };
  }, [state.drillSession]);

  // ─────────────────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────────────────

  const toggleVillain = useCallback((villainId) => {
    setSelectedVillainIds((prev) =>
      prev.includes(villainId)
        ? prev.filter((v) => v !== villainId)
        : [...prev, villainId]);
  }, []);

  const startDrill = useCallback(() => {
    if (selectedVillainIds.length === 0) return false;
    const sessionId = `drill-${Date.now()}`;
    dispatch(drillSessionStarted({
      sessionId,
      startedAt: new Date().toISOString(),
      timeBudgetMinutes: timeBudget,
      expectedVillainIds: [...selectedVillainIds],
    }));
    setMode('flashcards');
    setCurrentCardIndex(0);
    setIsRevealed(false);
    setRetryQueueIds([]);
    setRetryIndex(0);
    return true;
  }, [selectedVillainIds, timeBudget, dispatch]);

  const revealCard = useCallback(() => {
    if (!currentCard) return;
    const idx = mode === 'retry' ? retryIndex : currentCardIndex;
    setIsRevealed(true);
    dispatch(drillCardRevealed(idx, currentCard.id));
  }, [currentCard, currentCardIndex, retryIndex, mode, dispatch]);

  const answerCard = useCallback((answer) => {
    // answer ∈ 'correct' | 'retry-later' | 'skip'
    if (!currentCard) return;
    const idx = mode === 'retry' ? retryIndex : currentCardIndex;
    dispatch(drillCardAnswered(
      idx,
      answer,
      null, // dialOverride tracked via setDial
      answer === 'retry-later',
    ));

    // Queue for retry if marked — only from primary flashcards mode, not from retry mode
    if (answer === 'retry-later' && mode === 'flashcards' && currentCard?.id) {
      setRetryQueueIds((prev) =>
        prev.includes(currentCard.id) ? prev : [...prev, currentCard.id]);
    }

    // Advance
    if (mode === 'flashcards') {
      const nextIndex = currentCardIndex + 1;
      if (nextIndex >= deck.length) {
        // Primary deck done — decide retry or exit
        // Check if any retry-queued cards (using the current pending list PLUS the card we just queued)
        const willHaveRetries = answer === 'retry-later'
          ? (retryQueueIds.length >= 0) // always true when just queued
          : retryQueueIds.length > 0;

        if (willHaveRetries) {
          setMode('retry');
          setRetryIndex(0);
          setIsRevealed(false);
        } else {
          dispatch(drillSessionCompleted());
          setMode('exit');
        }
      } else {
        setCurrentCardIndex(nextIndex);
        setIsRevealed(false);
      }
    } else if (mode === 'retry') {
      const nextIndex = retryIndex + 1;
      if (nextIndex >= retryDeck.length) {
        // Retry deck done
        dispatch(drillSessionCompleted());
        setMode('exit');
      } else {
        setRetryIndex(nextIndex);
        setIsRevealed(false);
      }
    }
  }, [currentCard, currentCardIndex, retryIndex, deck.length, retryDeck.length, mode, dispatch, retryQueueIds]);

  const skipRetry = useCallback(() => {
    // "I'm ready" — bypass remaining retries and exit
    dispatch(drillSessionCompleted());
    setMode('exit');
  }, [dispatch]);

  const setDial = useCallback((newDial) => {
    if (!currentCard) return;
    dispatch(assumptionDialChanged(currentCard.id, newDial));
  }, [currentCard, dispatch]);

  const abandonDrill = useCallback(() => {
    dispatch(drillSessionAbandoned());
    setMode('entry');
    setCurrentCardIndex(0);
    setIsRevealed(false);
    setRetryQueueIds([]);
    setRetryIndex(0);
  }, [dispatch]);

  const exitToEntry = useCallback(() => {
    setMode('entry');
    setCurrentCardIndex(0);
    setIsRevealed(false);
    setSelectedVillainIds([]);
    setRetryQueueIds([]);
    setRetryIndex(0);
  }, []);

  return {
    // Mode + data
    mode,
    timeBudget,
    cardCount: TIME_BUDGET_CARD_COUNTS[timeBudget] ?? 5,
    selectedVillainIds,
    availableVillains,
    deck,
    retryDeck,
    retryQueueIds,
    currentCard,
    currentCardIndex,
    retryIndex,
    isRevealed,
    drillSession: state.drillSession,
    sessionSummary,

    // Actions
    setTimeBudget,
    toggleVillain,
    startDrill,
    revealCard,
    answerCard,
    skipRetry,
    setDial,
    abandonDrill,
    exitToEntry,
  };
};
