import React, { useState, useMemo, useCallback, useRef } from 'react';
import { Undo2, SkipForward, RotateCcw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT, STREETS, ACTIONS, LIMITS } from '../../../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import { getActionGradient, BATCH_COLORS, ACTION_COLORS } from '../../../constants/designTokens';
import { getValidActions } from '../../../utils/actionUtils';
import { hasBetOrRaiseOnStreet, getActionsForSeatOnStreet } from '../../../utils/sequenceUtils';
import { getSizingOptions, getCurrentBet, getMinRaise, getSeatContributions } from '../../../utils/potCalculator';
import { getPositionName } from '../../../utils/positionUtils';
import { useGame, useSettings, useUI, useCard, usePlayer } from '../../../contexts';
import { useGameHandlers } from '../../../hooks/useGameHandlers';
import { useSeatUtils } from '../../../hooks/useSeatUtils';
import { CARD_ACTIONS } from '../../../reducers/cardReducer';
import { UI_ACTIONS } from '../../../reducers/uiReducer';
import { CardSelectorPanel } from './CardSelectorPanel';

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
  // Only callbacks that require TableView orchestration
  onStreetChange,
  onClearStreet,
  onNextHand,
  onResetHand,
  onSelectCard,
  // Shared computation (expensive Monte Carlo — avoid duplicate hook call)
  liveEquity,
}) => {
  // Contexts — consumed directly (CH-2: eliminated ~18 props from TableView)
  const { recordPrimitiveAction, potInfo, blinds, actionSequence, smallBlindSeat, bigBlindSeat, currentStreet, dealerButtonSeat, absentSeats } = useGame();
  const { settings, updateSetting } = useSettings();
  const { selectedPlayers, setSelectedPlayers, showCardSelector, cardSelectorType, highlightedBoardIndex, setCardSelectorType, setHighlightedCardIndex, closeCardSelector, dispatchUi } = useUI();
  const { communityCards, holeCards, holeCardsVisible, dispatchCard } = useCard();
  const { getSeatPlayerName } = usePlayer();

  // Hooks — consumed directly instead of receiving computed values as props
  const {
    toggleAbsent,
    clearSeatActions,
    undoLastAction,
    getRemainingSeats,
    restFold,
    checkAround,
    foldToInvested,
    getCardStreet,
    clearCards,
  } = useGameHandlers();

  const { getNextActionSeat, activeSeatCount } = useSeatUtils(currentStreet, dealerButtonSeat, absentSeats, actionSequence, LIMITS.NUM_SEATS);

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
      dispatchUi({ type: UI_ACTIONS.SET_SELECTION, payload: [nextSeat] });
    } else {
      setSelectedPlayers([]);
    }
  }, [getNextActionSeat, dispatchUi, setSelectedPlayers]);

  // Card management handlers (previously passed as props)
  const handleToggleHoleVisibility = useCallback(() => {
    dispatchCard({ type: CARD_ACTIONS.TOGGLE_HOLE_VISIBILITY });
  }, [dispatchCard]);
  const handleClearBoard = useCallback(() => clearCards('community'), [clearCards]);
  const handleClearHole = useCallback(() => clearCards('hole'), [clearCards]);

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
        // Record explicit call amount (current bet minus what seat already contributed)
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
    // Pre-fill with current values (custom or defaults)
    const current = sizingOptions.map(o => o.label);
    if (sizingKey === 'postflop_bet') {
      // Extract fractions from labels
      const fracs = sizingOptions.map(o => {
        const pot = potInfo.total || 1;
        return parseFloat((o.amount / pot).toFixed(2));
      });
      setEditorValues(customMultipliers || fracs);
    } else {
      // Extract multipliers from labels
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
              onClick={() => onStreetChange(street)}
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
          onSelectCard={onSelectCard}
          onClose={closeCardSelector}
          getCardStreet={getCardStreet}
          setCardSelectorType={setCardSelectorType}
          setHighlightedCardIndex={setHighlightedCardIndex}
          onToggleHoleVisibility={handleToggleHoleVisibility}
          onClearBoard={handleClearBoard}
          onClearHole={handleClearHole}
        />
      )}

      {/* Live Action Advice — compact equity + suggestion bar */}
      {(actionAdvice || liveEquity?.isComputing) && (
        <div
          className="flex items-center justify-between px-2 py-1.5"
          style={{ borderBottom: '1px solid var(--panel-border)', background: 'var(--panel-surface)' }}
        >
          {liveEquity?.isComputing ? (
            <span className="text-gray-400 animate-pulse" style={{ fontSize: '12px' }}>Computing equity...</span>
          ) : actionAdvice && (
            <>
              <div className="flex items-center gap-1.5">
                {actionAdvice.icon === 'up' && <TrendingUp size={14} color={actionAdvice.color} />}
                {actionAdvice.icon === 'down' && <TrendingDown size={14} color={actionAdvice.color} />}
                {actionAdvice.icon === 'flat' && <Minus size={14} color={actionAdvice.color} />}
                <span className="font-extrabold" style={{ fontSize: '14px', color: actionAdvice.color, letterSpacing: '1px' }}>
                  {actionAdvice.label}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-300" style={{ fontSize: '12px' }}>
                  Eq <span className="font-bold text-white">{Math.round(liveEquity.equity * 100)}%</span>
                </span>
                {liveEquity.foldPct !== null && (
                  <span className="text-gray-300" style={{ fontSize: '12px' }}>
                    Fold <span className="font-bold text-white">{Math.round(liveEquity.foldPct * 100)}%</span>
                  </span>
                )}
                <span className="text-gray-500" style={{ fontSize: '10px' }}>
                  vs {liveEquity.villainName}
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══ ACTION ZONE (top) — recording what happened ═══ */}

      {/* Seat Indicator — prominent next-to-act display (14.2a) */}
      <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--panel-border)' }}>
        {singleSeat ? (
          <div className="flex items-center gap-3">
            {/* Large seat number — primary visual anchor */}
            <div
              className="flex items-center justify-center font-black text-white"
              style={{
                width: '48px', height: '48px', borderRadius: '10px', fontSize: '22px',
                background: 'linear-gradient(180deg, #d4a847 0%, #b8922e 100%)',
                color: '#1a1200', flexShrink: 0,
              }}
            >
              {singleSeat}
            </div>
            {/* Seat info + actions */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {positionLabel && (
                  <span className="font-extrabold" style={{ color: '#d4a847', fontSize: '16px' }}>{positionLabel}</span>
                )}
                {getSeatPlayerName(singleSeat) && (
                  <span className="text-gray-300 truncate" style={{ fontSize: '13px' }}>{getSeatPlayerName(singleSeat)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {actionArray.length > 0 && (
                  <ActionSequence actions={actionArray} size="small" maxVisible={4} />
                )}
                {nextActionSeat && (
                  <span className="text-gray-500" style={{ fontSize: '12px' }}>
                    → S{nextActionSeat} {getPositionName(nextActionSeat, dealerButtonSeat)}
                  </span>
                )}
              </div>
            </div>
            {/* Progress indicator */}
            {remainingCount > 0 && (
              <div className="text-right" style={{ flexShrink: 0 }}>
                <div className="font-bold text-gray-400" style={{ fontSize: '12px' }}>
                  {activeSeatCount - remainingCount}/{activeSeatCount}
                </div>
                <div className="text-gray-600" style={{ fontSize: '10px' }}>acted</div>
              </div>
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

      {/* Action Buttons + Sizing + Batch recording */}
      {hasSeatSelected && currentStreet !== 'showdown' && (
        <div className="px-2 py-2 flex flex-col gap-2">
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

          {/* Sizing Presets */}
          {sizingAction && sizingOptions.length > 0 && (
            <div className="p-2 rounded-lg" style={{ background: 'var(--panel-surface)', border: '1px solid var(--panel-border)' }}>
              <div className="grid grid-cols-4 gap-1.5 mb-1.5">
                {sizingOptions.map(({ label, amount }) => (
                  <button
                    key={label}
                    onClick={() => handleSizeSelected(amount)}
                    onMouseDown={handleSizingLongPressStart}
                    onMouseUp={handleSizingLongPressEnd}
                    onMouseLeave={handleSizingLongPressEnd}
                    onTouchStart={handleSizingLongPressStart}
                    onTouchEnd={handleSizingLongPressEnd}
                    className="btn-press rounded-md font-bold text-white shadow"
                    style={{ height: '68px', background: getActionGradient('bet'), fontSize: '15px' }}
                  >
                    <div style={{ fontSize: '20px', fontWeight: 800 }}>${amount}</div>
                    <div style={{ fontSize: '11px', opacity: 0.65 }}>{label}</div>
                  </button>
                ))}
              </div>

              {/* Sizing Editor Popup */}
              {sizingEditorOpen && (
                <div className="mb-2 p-2 rounded-lg" style={{ background: '#1a1d23', border: '1px solid var(--gold)' }}>
                  <div className="text-white font-bold mb-2" style={{ fontSize: '13px' }}>
                    Customize {sizingKey?.replace('_', ' ')}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {editorValues.map((val, idx) => {
                      const isPostflopBet = sizingKey === 'postflop_bet';
                      const base = isPostflopBet ? (potInfo.total || 1) : (sizingKey === 'preflop_open' ? blinds.bb : currentBet || blinds.bb);
                      const dollarAmount = Math.round(base * val);
                      return (
                        <div key={idx} className="flex flex-col items-center gap-1">
                          <input
                            type="number"
                            value={val}
                            onChange={(e) => {
                              const newVals = [...editorValues];
                              newVals[idx] = parseFloat(e.target.value) || 0;
                              setEditorValues(newVals);
                            }}
                            step="any"
                            className="w-full px-1 rounded text-white text-center font-semibold focus:outline-none"
                            style={{ height: '36px', fontSize: '14px', background: '#374151', border: '1px solid var(--panel-border)' }}
                          />
                          <span className="text-gray-400" style={{ fontSize: '11px' }}>${dollarAmount}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleSaveSizing}
                      className="btn-press flex-1 rounded font-bold text-white"
                      style={{ height: '36px', fontSize: '13px', background: '#166534' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={handleResetSizing}
                      className="btn-press flex-1 rounded font-bold text-white"
                      style={{ height: '36px', fontSize: '13px', background: '#374151' }}
                    >
                      Reset
                    </button>
                    <button
                      onClick={() => setSizingEditorOpen(false)}
                      className="btn-press flex-1 rounded font-bold text-white"
                      style={{ height: '36px', fontSize: '13px', background: '#374151' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              <form onSubmit={handleCustomSubmit} className="flex gap-1.5">
                <div className="flex-1 flex items-center gap-1">
                  <span className="text-gray-500 font-bold" style={{ fontSize: '15px' }}>$</span>
                  <input
                    type="number"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder={`Min $${minRaise}`}
                    min={minRaise}
                    step="any"
                    className="w-full px-3 rounded text-white font-semibold focus:outline-none"
                    style={{ height: '48px', fontSize: '15px', background: '#1a1d23', border: '1px solid var(--panel-border)' }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!customValue || parseFloat(customValue) < minRaise}
                  className="btn-press px-5 rounded font-bold text-white"
                    style={{ height: '48px', fontSize: '15px', background: !customValue || parseFloat(customValue) < minRaise ? '#374151' : ACTION_COLORS.bet.base }}
                >
                  GO
                </button>
              </form>
            </div>
          )}

          {/* Batch recording — Rest Fold / Fold Cold / Check All */}
          {remainingCount > 0 && (
            <div className="flex gap-1.5">
              <button
                onClick={restFold}
                className="btn-press flex-1 rounded-lg font-bold text-white"
                style={{ height: '68px', fontSize: '16px', background: `linear-gradient(180deg, ${BATCH_COLORS.restFold.base} 0%, ${BATCH_COLORS.restFold.dark} 100%)` }}
              >
                {lastRaiserSeat ? `Fold to S${lastRaiserSeat} (${remainingCount})` : `Rest Fold (${remainingCount})`}
              </button>
              {hasAggression && (
                <button
                  onClick={foldToInvested}
                  className="btn-press flex-1 rounded-lg font-bold text-white"
                  style={{ height: '68px', fontSize: '14px', background: `linear-gradient(180deg, ${BATCH_COLORS.foldCold.base} 0%, ${BATCH_COLORS.foldCold.dark} 100%)` }}
                >
                  Fold Cold
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

      <div style={{ background: 'var(--panel-surface)', borderTop: '1px solid var(--panel-border)' }}>
        {/* Clear Seat / Undo — per-seat action management */}
        {singleSeat && actionArray.length > 0 && (
          <div className="flex gap-1.5 px-2 pt-2 pb-1">
            <button
              onClick={() => clearSeatActions([singleSeat])}
              className="btn-press flex-1 rounded-lg font-semibold text-white"
              style={{ height: '48px', fontSize: '13px', background: '#7f1d1d' }}
            >
              Clear Seat
            </button>
            <button
              onClick={() => undoLastAction(singleSeat)}
              className="btn-press flex-1 rounded-lg font-semibold text-white flex items-center justify-center gap-1"
              style={{ height: '48px', fontSize: '13px', background: '#854d0e' }}
            >
              <Undo2 size={14} /> Undo
            </button>
          </div>
        )}

        {/* Utility row — seat/street management */}
        <div className={`flex gap-1.5 px-2 pb-1 ${singleSeat && actionArray.length > 0 ? 'pt-1' : 'pt-2'}`}>
          {hasSeatSelected && (
            <button onClick={() => setSelectedPlayers([])} className="btn-press flex-1 rounded-lg font-semibold text-white" style={{ height: '48px', fontSize: '13px', background: '#374151' }}>Deselect</button>
          )}
          {hasSeatSelected && (
            <button onClick={toggleAbsent} className="btn-press flex-1 rounded-lg font-semibold text-white" style={{ height: '48px', fontSize: '13px', background: '#1f2937', border: '1px solid var(--panel-border)' }}>Absent</button>
          )}
          {currentStreet !== 'showdown' && remainingCount > 0 && (
            <button
              onClick={onClearStreet}
              className="btn-press flex-1 rounded-lg font-semibold text-white"
              style={{ height: '48px', fontSize: '13px', background: '#4c0519' }}
            >
              Reset Street
            </button>
          )}
          <button
            onClick={onResetHand}
            className="btn-press flex-1 rounded-lg flex items-center justify-center gap-1 font-semibold text-white"
            style={{ height: '48px', fontSize: '13px', background: '#1f2937', border: '1px solid var(--panel-border)' }}
          >
            <RotateCcw size={14} />
            Reset Hand
          </button>
        </div>

        {/* Next Hand — primary CTA, always visible, always at very bottom */}
        <div className="px-2 pt-1 pb-2">
          <button
            onClick={onNextHand}
            className="btn-press w-full rounded-lg flex items-center justify-center gap-2 font-extrabold shadow-lg"
            style={{ height: '68px', fontSize: '18px', background: 'linear-gradient(180deg, #d4a847 0%, #b8922e 100%)', color: '#1a1200' }}
          >
            <SkipForward size={20} />
            Next Hand
          </button>
        </div>
      </div>
    </div>
  );
};


