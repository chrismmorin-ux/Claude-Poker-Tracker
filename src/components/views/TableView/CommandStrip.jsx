import React, { useState, useMemo, useCallback, useRef } from 'react';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT, STREETS, LIMITS } from '../../../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import { getActionGradient, BATCH_COLORS } from '../../../constants/designTokens';
import { getValidActions } from '../../../utils/actionUtils';
import { hasBetOrRaiseOnStreet, getActionsForSeatOnStreet } from '../../../utils/sequenceUtils';
import { getSizingOptions, getCurrentBet, getMinRaise, getSeatContributions } from '../../../utils/potCalculator';
import { getPositionName, getPreflopOrder } from '../../../utils/positionUtils';
import { useGame, useSettings, useUI, useCard, usePlayer, useOnlineAnalysisContext, useToast, useSession } from '../../../contexts';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useSeatUtils } from '../../../hooks/useSeatUtils';
import { useAutoSeatSelection } from '../../../hooks/useAutoSeatSelection';
import { useCardSelection } from '../../../hooks/useCardSelection';
import { GAME_ACTIONS } from '../../../reducers/gameReducer';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { CardSelectorPanel } from './CardSelectorPanel';
import { LiveAdviceBar } from './LiveAdviceBar';
import { SizingPresetsPanel } from './SizingPresetsPanel';
import { ControlZone } from './ControlZone';

/**
 * ProgressArc — small SVG ring showing acted/total seats
 */
const ProgressArc = ({ acted, total }) => {
  if (total <= 0) return null;
  const r = 14, cx = 18, cy = 18, stroke = 3;
  const circumference = 2 * Math.PI * r;
  const progress = acted / total;
  const dashOffset = circumference * (1 - progress);
  return (
    <svg width="36" height="36" style={{ flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2f3a" strokeWidth={stroke} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#d4a847" strokeWidth={stroke}
        strokeDasharray={circumference} strokeDashoffset={dashOffset}
        strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
        style={{ transition: 'stroke-dashoffset 0.3s ease' }} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
        fill="#d4a847" fontSize="11" fontWeight="700">{acted}/{total}</text>
    </svg>
  );
};

/**
 * Street completion state for progress indicator
 */
const getStreetState = (street, currentStreet, actionSequence) => {
  const streetIndex = STREETS.indexOf(street);
  const currentIndex = STREETS.indexOf(currentStreet);
  if (streetIndex < currentIndex) return 'completed';
  if (streetIndex === currentIndex) return 'active';
  return 'future';
};

/** Short labels for street tabs */
const STREET_LABELS = {
  preflop: 'Pre',
  flop: 'Flop',
  turn: 'Turn',
  river: 'Rvr',
  showdown: 'SD',
};

/**
 * CommandStrip - Unified right-side control panel
 * Consolidates ActionPanel + StreetSelector + BatchActionBar + hand controls
 */
export const CommandStrip = ({
  // Shared computation (expensive Monte Carlo — avoid duplicate hook call)
  liveEquity,
  boardTexture,
}) => {
  // Contexts — consumed directly (CH-2: all orchestration callbacks internalized)
  const { recordPrimitiveAction, potInfo, blinds, actionSequence, smallBlindSeat, bigBlindSeat, currentStreet, dealerButtonSeat, absentSeats, dispatchGame } = useGame();
  const { settings, updateSetting } = useSettings();
  const { selectedPlayers, setSelectedPlayers, showCardSelector, cardSelectorType, highlightedBoardIndex, setCardSelectorType, setHighlightedCardIndex, closeCardSelector } = useUI();
  const { communityCards, holeCards, holeCardsVisible, dispatchCard } = useCard();
  const { getSeatPlayerName } = usePlayer();
  const { advice: gameTreeAdvice } = useOnlineAnalysisContext();
  const { showSuccess, showInfo, showWarning } = useToast();
  const { currentSession } = useSession();

  // Hooks — consumed directly instead of receiving computed values as props
  const {
    toggleAbsent,
    clearSeatActions,
    undoLastAction,
    undoBatch,
    getRemainingSeats,
    restFold,
    checkAround,
    foldToInvested,
    getCardStreet,
    clearCards,
    nextHand,
    resetHand,
    clearStreetActions,
    openShowdownScreen,
  } = useGameHandlers();

  const { getNextActionSeat, getFirstActionSeat, activeSeatCount } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, actionSequence, LIMITS.NUM_SEATS);

  // Auto-select first action seat on mount, street change, or card selector close
  const { scheduleAutoSelect } = useAutoSeatSelection(showCardSelector, currentStreet, getFirstActionSeat, setSelectedPlayers);

  // Card selection logic (community and hole cards)
  const selectCard = useCardSelection(highlightedBoardIndex, cardSelectorType, communityCards, holeCards, currentStreet, dispatchCard, { closeCardSelector, setHighlightedCardIndex });

  // Computed locally (previously passed as props)
  const seatContributions = useMemo(
    () => getSeatContributions(actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat),
    [actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat]
  );
  const remainingCount = getRemainingSeats().length;
  const singleSeatForNext = selectedPlayers.length === 1 ? selectedPlayers[0] : null;
  const nextActionSeat = singleSeatForNext ? getNextActionSeat(singleSeatForNext) : null;

  // Auto-advance to next seat after recording an action
  const handleAdvanceSeat = useCallback((currentSeat) => {
    const nextSeat = getNextActionSeat(currentSeat);
    if (nextSeat) {
      setSelectedPlayers([nextSeat]);
    } else {
      setSelectedPlayers([]);
    }
  }, [getNextActionSeat, setSelectedPlayers]);

  // HE-2b: Orbit tap-ahead — tapping a position ahead auto-folds intermediate un-acted seats
  // RT-26: Track undo point for batch undo
  const orbitUndoPointRef = useRef(null);

  const handleOrbitTap = useCallback((targetSeat) => {
    if (currentStreet !== 'preflop') {
      orbitUndoPointRef.current = null;
      setSelectedPlayers([targetSeat]);
      return;
    }
    const order = getPreflopOrder(dealerButtonSeat).filter(s => !absentSeats.includes(s));
    const firstToAct = getFirstActionSeat();
    const currentIdx = order.indexOf(firstToAct);
    const targetIdx = order.indexOf(targetSeat);

    // If target is behind or equal to current, or current not found, just select
    if (currentIdx === -1 || targetIdx === -1 || targetIdx <= currentIdx) {
      orbitUndoPointRef.current = null;
      setSelectedPlayers([targetSeat]);
      return;
    }

    // Save undo point before auto-folding
    orbitUndoPointRef.current = actionSequence.length;

    // Auto-fold un-acted, non-folded seats between current and target
    const preflopEntries = actionSequence.filter(e => e.street === 'preflop');
    let foldCount = 0;
    for (let i = currentIdx; i < targetIdx; i++) {
      const seat = order[i];
      const hasActed = preflopEntries.some(e => e.seat === seat);
      if (!hasActed) {
        dispatchGame({
          type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
          payload: { seat, action: 'fold' },
        });
        foldCount++;
      }
    }
    if (foldCount > 0) {
      showInfo(`Folded ${foldCount} seat${foldCount > 1 ? 's' : ''}`);
    }
    setSelectedPlayers([targetSeat]);
  }, [currentStreet, dealerButtonSeat, absentSeats, getFirstActionSeat, actionSequence, dispatchGame, setSelectedPlayers, showInfo]);

  // RT-26: Batch undo all orbit auto-folds at once
  const handleUndo = useCallback((seat) => {
    if (orbitUndoPointRef.current !== null) {
      undoBatch(orbitUndoPointRef.current);
      orbitUndoPointRef.current = null;
      showInfo('Orbit folds undone');
    } else {
      undoLastAction(seat);
    }
  }, [undoBatch, undoLastAction, showInfo]);

  // Card management handlers (previously passed as props)
  const handleToggleHoleVisibility = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY });
  }, [dispatchCard]);
  const handleClearBoard = useCallback(() => clearCards('community'), [clearCards]);
  const handleClearHole = useCallback(() => clearCards('hole'), [clearCards]);

  // Orchestration handlers (previously passed as props from TableView)
  const handleStreetChange = useCallback((street) => {
    orbitUndoPointRef.current = null;
    dispatchGame({ type: GAME_ACTIONS.SET_STREET, payload: street });
    if (street === 'showdown') {
      openShowdownScreen();
    }
  }, [dispatchGame, openShowdownScreen]);

  const handleNextHand = useCallback(() => {
    orbitUndoPointRef.current = null;
    const handNumber = (currentSession?.handCount || 0) + 1;
    nextHand();
    if (actionSequence.length > 0) {
      showSuccess(`Hand #${handNumber} completed`);
    } else {
      showInfo(`Hand #${handNumber + 1} started`);
    }
    scheduleAutoSelect();
  }, [currentSession, nextHand, actionSequence, showSuccess, showInfo, scheduleAutoSelect]);

  const handleResetHand = useCallback(() => {
    orbitUndoPointRef.current = null;
    if (!window.confirm('Reset all actions for this hand?')) return;
    resetHand();
    showWarning('Hand reset');
    scheduleAutoSelect();
  }, [resetHand, showWarning, scheduleAutoSelect]);

  const handleClearStreet = useCallback(() => {
    clearStreetActions();
  }, [clearStreetActions]);

  const canCheckAround = currentStreet !== 'preflop' && !hasBetOrRaiseOnStreet(actionSequence, currentStreet);
  const [customValue, setCustomValue] = useState('');
  const [sizingEditorOpen, setSizingEditorOpen] = useState(false);
  const longPressTimer = useRef(null);

  const isMultiSeat = selectedPlayers.length > 1;
  const hasSeatSelected = selectedPlayers.length > 0;
  const hasBet = currentStreet !== 'preflop' ? hasBetOrRaiseOnStreet(actionSequence, currentStreet) : false;
  const rawValidActions = hasSeatSelected ? getValidActions(currentStreet, hasBet, isMultiSeat) : [];

  // BB option: when BB faces no raise preflop, they CHECK (not CALL) since blind is already posted
  const isBBOption = currentStreet === 'preflop'
    && !isMultiSeat
    && selectedPlayers.length === 1
    && selectedPlayers[0] === bigBlindSeat
    && !actionSequence.some(e => e.street === 'preflop' && e.action === 'raise');

  const validActions = isBBOption
    ? rawValidActions.map(a => a === PRIMITIVE_ACTIONS.CALL ? PRIMITIVE_ACTIONS.CHECK : a)
    : rawValidActions;

  // Sizing
  const sizingAction = !isMultiSeat
    ? validActions.find(a => a === PRIMITIVE_ACTIONS.BET || a === PRIMITIVE_ACTIONS.RAISE)
    : null;
  const nonSizingActions = validActions.filter(a => a !== PRIMITIVE_ACTIONS.BET && a !== PRIMITIVE_ACTIONS.RAISE);

  const currentBet = getCurrentBet(actionSequence, currentStreet);
  const effectiveBet = currentStreet === 'preflop' && currentBet === 0 ? blinds.bb : currentBet;

  const singleSeat = selectedPlayers.length === 1 ? selectedPlayers[0] : null;
  const seatAlreadyIn = singleSeat ? (seatContributions[singleSeat] || 0) : 0;
  const callAmount = Math.max(0, effectiveBet - seatAlreadyIn);

  // Min raise enforcement
  const minRaise = useMemo(
    () => getMinRaise(actionSequence, currentStreet, blinds),
    [actionSequence, currentStreet, blinds]
  );

  // Determine sizing key and custom multipliers
  const sizingKey = useMemo(() => {
    if (!sizingAction) return null;
    if (currentStreet === 'preflop') {
      return currentBet <= blinds.bb ? 'preflop_open' : 'preflop_raise';
    }
    return sizingAction === PRIMITIVE_ACTIONS.BET ? 'postflop_bet' : 'postflop_raise';
  }, [sizingAction, currentStreet, currentBet, blinds.bb]);

  const customMultipliers = sizingKey ? (settings.customBetSizes?.[sizingKey] || null) : null;

  const sizingOptions = sizingAction
    ? getSizingOptions(currentStreet, sizingAction, blinds, potInfo.total, currentBet, customMultipliers)
    : [];

  const handleRecordAction = useCallback((action) => {
    if (!recordPrimitiveAction) return;
    selectedPlayers.forEach(seat => {
      if (action === PRIMITIVE_ACTIONS.CALL) {
        const alreadyIn = seatContributions[seat] || 0;
        const increment = Math.max(0, effectiveBet - alreadyIn);
        recordPrimitiveAction(seat, action, increment);
      } else {
        recordPrimitiveAction(seat, action);
      }
    });
    if (!isMultiSeat) {
      handleAdvanceSeat(selectedPlayers[0]);
    }
  }, [recordPrimitiveAction, isMultiSeat, selectedPlayers, handleAdvanceSeat, seatContributions, effectiveBet]);

  const handleSizeSelected = useCallback((amount) => {
    if (!recordPrimitiveAction || !sizingAction) return;
    const seat = selectedPlayers[0];
    recordPrimitiveAction(seat, sizingAction, amount);
    handleAdvanceSeat(seat);
  }, [recordPrimitiveAction, sizingAction, selectedPlayers, handleAdvanceSeat]);

  const handleCustomSubmit = useCallback((e) => {
    e.preventDefault();
    const val = parseFloat(customValue);
    if (!isNaN(val) && val >= minRaise) {
      handleSizeSelected(val);
      setCustomValue('');
    }
  }, [customValue, handleSizeSelected, minRaise]);

  // Long-press handlers for sizing button customization
  const handleSizingLongPressStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      setSizingEditorOpen(true);
    }, 500);
  }, []);

  const handleSizingLongPressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Editor state for sizing customization
  const [editorValues, setEditorValues] = useState([]);

  const openSizingEditor = useCallback(() => {
    const current = sizingOptions.map(o => o.label);
    if (sizingKey === 'postflop_bet') {
      const fracs = sizingOptions.map(o => {
        const pot = potInfo.total || 1;
        return parseFloat((o.amount / pot).toFixed(2));
      });
      setEditorValues(customMultipliers || fracs);
    } else {
      const mults = sizingOptions.map(o => parseFloat(o.label.replace('x', '').replace('/', '')));
      setEditorValues(customMultipliers || mults);
    }
    setSizingEditorOpen(true);
  }, [sizingOptions, sizingKey, customMultipliers, potInfo.total]);

  const handleSaveSizing = useCallback(() => {
    if (!sizingKey) return;
    const newCustom = { ...(settings.customBetSizes || {}), [sizingKey]: editorValues };
    updateSetting('customBetSizes', newCustom);
    setSizingEditorOpen(false);
  }, [sizingKey, editorValues, settings.customBetSizes, updateSetting]);

  const handleResetSizing = useCallback(() => {
    if (!sizingKey) return;
    const newCustom = { ...(settings.customBetSizes || {}), [sizingKey]: null };
    updateSetting('customBetSizes', newCustom);
    setSizingEditorOpen(false);
  }, [sizingKey, settings.customBetSizes, updateSetting]);

  const actionArray = singleSeat ? getActionsForSeatOnStreet(actionSequence, singleSeat, currentStreet) : [];
  const positionLabel = singleSeat ? getPositionName(singleSeat, dealerButtonSeat) : '';

  // Live action advice classification
  const actionAdvice = useMemo(() => {
    if (!liveEquity || liveEquity.equity === null) return null;
    const eq = liveEquity.equity;
    const fp = liveEquity.foldPct;
    if (eq >= 0.55) return { label: 'VALUE', color: '#22c55e', icon: 'up' };
    if (eq < 0.40 && fp !== null && fp >= 0.40) return { label: 'BLUFF', color: '#f59e0b', icon: 'down' };
    return { label: 'CHECK', color: '#6b7280', icon: 'flat' };
  }, [liveEquity]);

  // Show "Fold Cold" when there's aggression (raise preflop, or bet/raise postflop)
  const hasAggression = currentStreet === 'preflop'
    ? actionSequence.some(e => e.street === 'preflop' && e.action === 'raise')
    : hasBetOrRaiseOnStreet(actionSequence, currentStreet);

  // HE-2b: Compute last raiser on preflop for contextual "Fold to S{n}" label
  const lastRaiserSeat = useMemo(() => {
    if (currentStreet !== 'preflop') return null;
    let raiser = null;
    for (const entry of actionSequence) {
      if (entry.street !== 'preflop') continue;
      if (entry.action === 'raise') raiser = entry.seat;
    }
    return raiser;
  }, [actionSequence, currentStreet]);

  return (
    <div
      className="absolute flex flex-col"
      style={{
        width: `${LAYOUT.ACTION_PANEL_WIDTH}px`,
        top: `${LAYOUT.ACTION_PANEL_TOP}px`,
        right: '0px',
        bottom: '0px',
        background: 'var(--panel-bg)',
        borderLeft: '1px solid var(--panel-border)',
      }}
    >
      {/* Street Progress Tabs */}
      <div className="flex gap-1 px-1.5 py-1" style={{ background: 'var(--panel-surface)' }}>
        {STREETS.map((street) => {
          const state = getStreetState(street, currentStreet, actionSequence);
          return (
            <button
              key={street}
              onClick={() => handleStreetChange(street)}
              className="btn-press flex-1 rounded-md font-bold transition-all"
              style={{
                height: '40px',
                background: state === 'active'
                  ? 'linear-gradient(180deg, #d4a847 0%, #b8922e 100%)'
                  : state === 'completed'
                    ? '#1a3a2a'
                    : 'var(--panel-bg)',
                color: state === 'active' ? '#1a1200' : state === 'completed' ? '#6dba8a' : '#6b7280',
                border: state === 'active' ? 'none' : '1px solid var(--panel-border)',
                fontSize: '13px',
                letterSpacing: '0.5px',
              }}
            >
              {STREET_LABELS[street]}
              {state === 'completed' && <span className="ml-0.5 text-xs">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Card Selector — full-screen overlay (position:fixed) */}
      {showCardSelector && (
        <CardSelectorPanel
          currentStreet={currentStreet}
          communityCards={communityCards}
          holeCards={holeCards}
          holeCardsVisible={holeCardsVisible}
          cardSelectorType={cardSelectorType}
          highlightedBoardIndex={highlightedBoardIndex}
          onSelectCard={selectCard}
          onClose={closeCardSelector}
          getCardStreet={getCardStreet}
          setCardSelectorType={setCardSelectorType}
          setHighlightedCardIndex={setHighlightedCardIndex}
          onToggleHoleVisibility={handleToggleHoleVisibility}
          onClearBoard={handleClearBoard}
          onClearHole={handleClearHole}
        />
      )}

      <LiveAdviceBar actionAdvice={actionAdvice} liveEquity={liveEquity} boardTexture={boardTexture} gameTreeAdvice={gameTreeAdvice} currentStreet={currentStreet} />

      {/* ═══ ACTION ZONE (top) — recording what happened ═══ */}

      {/* Seat Indicator — prominent next-to-act display (HE-2a: position-first) */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--panel-border)' }}>
        {singleSeat ? (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center font-black"
              style={{
                width: '48px', height: '48px', borderRadius: '10px',
                fontSize: positionLabel && positionLabel.length > 2 ? '15px' : '20px',
                background: 'linear-gradient(180deg, #d4a847 0%, #b8922e 100%)',
                color: '#1a1200', flexShrink: 0, letterSpacing: '0.5px',
              }}
            >
              {positionLabel || singleSeat}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-gray-400 font-semibold" style={{ fontSize: '12px' }}>S{singleSeat}</span>
                {getSeatPlayerName(singleSeat) && (
                  <span className="text-gray-300 truncate font-semibold" style={{ fontSize: '14px' }}>{getSeatPlayerName(singleSeat)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {actionArray.length > 0 && (
                  <ActionSequence actions={actionArray} size="small" maxVisible={4} />
                )}
                {nextActionSeat && (
                  <span style={{ fontSize: '13px' }}>
                    <span className="text-gray-500">→ </span>
                    <span className="font-bold" style={{ color: '#d4a847' }}>{getPositionName(nextActionSeat, dealerButtonSeat)}</span>
                    <span className="text-gray-500"> (S{nextActionSeat})</span>
                  </span>
                )}
              </div>
            </div>
            {remainingCount > 0 && (
              <ProgressArc acted={activeSeatCount - remainingCount} total={activeSeatCount} />
            )}
          </div>
        ) : isMultiSeat ? (
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center font-bold text-white"
              style={{
                width: '48px', height: '48px', borderRadius: '10px', fontSize: '16px',
                background: '#374151', flexShrink: 0,
              }}
            >
              {selectedPlayers.length}
            </div>
            <span className="text-white font-bold" style={{ fontSize: '14px' }}>
              Seats {selectedPlayers.sort((a,b) => a-b).join(', ')}
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-center py-1">
            <span className="text-gray-500 font-semibold" style={{ fontSize: '14px' }}>Tap a seat to record</span>
          </div>
        )}
      </div>

      {/* HE-2b: Preflop orbit strip — tap-ahead auto-folds intermediate seats */}
      {currentStreet === 'preflop' && singleSeat && (
        <div className="px-3 pb-1.5 pt-0.5 flex gap-1 overflow-x-auto" style={{ borderBottom: '1px solid var(--panel-border)' }}>
          {getPreflopOrder(dealerButtonSeat)
            .filter(s => !absentSeats.includes(s))
            .map(s => {
              const isCurrent = s === singleSeat;
              const seatActions = actionSequence.filter(e => e.street === 'preflop' && e.seat === s);
              const hasFolded = seatActions.some(e => e.action === 'fold');
              const hasActed = seatActions.length > 0;
              const bg = isCurrent ? '#d4a847' : hasFolded ? '#7f1d1d' : hasActed ? '#14532d' : '#1f2937';
              const color = isCurrent ? '#1a1200' : hasFolded ? '#fca5a5' : hasActed ? '#86efac' : '#6b7280';
              return (
                <button
                  key={s}
                  onClick={() => handleOrbitTap(s)}
                  className="btn-press rounded"
                  style={{
                    height: '36px', padding: '4px 8px', fontSize: '12px', fontWeight: isCurrent ? 800 : 600,
                    background: bg, color, whiteSpace: 'nowrap', flexShrink: 0,
                    textDecoration: hasFolded ? 'line-through' : 'none',
                    border: isCurrent ? '2px solid #fbbf24' : '1px solid transparent',
                  }}
                >
                  {getPositionName(s, dealerButtonSeat)}
                  {hasActed && !hasFolded && !isCurrent && ' \u2713'}
                </button>
              );
            })}
        </div>
      )}

      {/* Action Buttons + Sizing + Batch recording */}
      {hasSeatSelected && currentStreet !== 'showdown' && (
        <div className="px-2 py-2 flex flex-col gap-2">
          {/* HE-2a: Action context header */}
          {singleSeat && positionLabel && (
            <div className="font-bold" style={{ fontSize: '13px', color: '#d4a847', paddingLeft: '2px' }}>
              {positionLabel}&apos;s action
            </div>
          )}
          {/* Primary actions — 100px for can't-miss thumb hits */}
          <div className={`grid gap-2 ${
            (isMultiSeat ? validActions : nonSizingActions).length >= 3 ? 'grid-cols-3' : 'grid-cols-2'
          }`}>
            {(isMultiSeat ? validActions : nonSizingActions).map(action => {
              const getLabel = () => {
                if (action === PRIMITIVE_ACTIONS.CALL) return callAmount > 0 ? `Call $${callAmount}` : 'Call';
                if (action === PRIMITIVE_ACTIONS.CHECK) return 'Check';
                if (action === PRIMITIVE_ACTIONS.BET) return 'Bet';
                if (action === PRIMITIVE_ACTIONS.RAISE) return 'Raise';
                if (action === PRIMITIVE_ACTIONS.FOLD) return 'Fold';
                return action;
              };
              const getStyle = () => ({ background: getActionGradient(action) });
              return (
                <button
                  key={action}
                  type="button"
                  onClick={() => handleRecordAction(action)}
                  className="btn-press rounded-lg font-extrabold text-white shadow-lg"
                  style={{ height: '100px', fontSize: '20px', letterSpacing: '0.5px', ...getStyle() }}
                >
                  {getLabel()}
                </button>
              );
            })}
          </div>

          <SizingPresetsPanel
            sizingOptions={sizingOptions}
            sizingAction={sizingAction}
            minRaise={minRaise}
            customValue={customValue}
            setCustomValue={setCustomValue}
            sizingEditorOpen={sizingEditorOpen}
            setSizingEditorOpen={setSizingEditorOpen}
            editorValues={editorValues}
            setEditorValues={setEditorValues}
            sizingKey={sizingKey}
            potTotal={potInfo.total}
            currentBet={currentBet}
            blindsBb={blinds.bb}
            onSizeSelected={handleSizeSelected}
            onCustomSubmit={handleCustomSubmit}
            onSizingLongPressStart={handleSizingLongPressStart}
            onSizingLongPressEnd={handleSizingLongPressEnd}
            onSaveSizing={handleSaveSizing}
            onResetSizing={handleResetSizing}
          />

          {/* Batch recording — Rest Fold / Fold Cold / Check All */}
          {remainingCount > 0 && (
            <div className="flex gap-1.5">
              <button
                onClick={restFold}
                className="btn-press flex-1 rounded-lg font-bold text-white"
                style={{ height: '68px', fontSize: '16px', background: `linear-gradient(180deg, ${BATCH_COLORS.restFold.base} 0%, ${BATCH_COLORS.restFold.dark} 100%)` }}
              >
                {lastRaiserSeat ? `Fold to ${getPositionName(lastRaiserSeat, dealerButtonSeat)} (${remainingCount})` : `Rest Fold (${remainingCount})`}
              </button>
              {hasAggression && (
                <button
                  onClick={foldToInvested}
                  className="btn-press flex-1 rounded-lg font-bold text-white"
                  style={{ height: '68px', fontSize: '14px', background: `linear-gradient(180deg, ${BATCH_COLORS.foldCold.base} 0%, ${BATCH_COLORS.foldCold.dark} 100%)` }}
                >
                  {currentStreet === 'preflop' && lastRaiserSeat ? `Skip to ${getPositionName(lastRaiserSeat, dealerButtonSeat)}` : 'Fold Cold'}
                </button>
              )}
              {canCheckAround && (
                <button
                  onClick={checkAround}
                  className="btn-press flex-1 rounded-lg font-bold text-white"
                  style={{ height: '68px', fontSize: '16px', background: `linear-gradient(180deg, ${BATCH_COLORS.checkAll.base} 0%, ${BATCH_COLORS.checkAll.dark} 100%)` }}
                >
                  Check All ({remainingCount})
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ CONTROL ZONE (bottom) — table management ═══ */}
      <div className="flex-1" />

      <ControlZone
        singleSeat={singleSeat}
        actionArray={actionArray}
        hasSeatSelected={hasSeatSelected}
        remainingCount={remainingCount}
        currentStreet={currentStreet}
        onClearSeat={clearSeatActions}
        onUndo={handleUndo}
        onDeselect={() => setSelectedPlayers([])}
        onToggleAbsent={toggleAbsent}
        onClearStreet={handleClearStreet}
        onResetHand={handleResetHand}
        onNextHand={handleNextHand}
      />
    </div>
  );
};
