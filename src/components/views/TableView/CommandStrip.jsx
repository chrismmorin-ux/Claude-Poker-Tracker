import React, { useState, useMemo, useCallback } from 'react';
import PropTypes from 'prop-types';
import { Undo2, SkipForward, RotateCcw } from 'lucide-react';
import { ActionSequence } from '../../ui/ActionSequence';
import { LAYOUT, STREETS, ACTIONS } from '../../../constants/gameConstants';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';
import { PrimitiveActionButton } from '../../ui/PrimitiveActionButton';
import { getValidActions } from '../../../utils/actionUtils';
import { hasBetOrRaiseOnStreet, getActionsForSeatOnStreet } from '../../../utils/sequenceUtils';
import { getSizingOptions, getCurrentBet, getSeatContributions, getMinRaise } from '../../../utils/potCalculator';
import { getPositionName } from '../../../utils/positionUtils';
import { useGame } from '../../../contexts';
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
  // Street
  currentStreet,
  onStreetChange,
  onNextStreet,
  onClearStreet,
  // Seat selection
  selectedPlayers,
  dealerButtonSeat,
  // Action panel
  onClearSelection,
  onToggleAbsent,
  onClearSeatActions,
  onUndoLastAction,
  onAdvanceSeat,
  // Batch actions
  remainingCount,
  canCheckAround,
  onRestFold,
  onCheckAround,
  onFoldToInvested,
  // Hand controls
  onNextHand,
  onResetHand,
  // Card selector
  showCardSelector,
  communityCards,
  holeCards,
  holeCardsVisible,
  cardSelectorType,
  highlightedBoardIndex,
  onSelectCard,
  onCloseCardSelector,
  getCardStreet,
  setCardSelectorType,
  setHighlightedCardIndex,
  onToggleHoleVisibility,
  onClearBoard,
  onClearHole,
  // HE-2a: Next-to-act display
  nextActionSeat,
  getSeatPlayerName,
}) => {
  const { recordPrimitiveAction, potInfo, blinds, actionSequence, smallBlindSeat, bigBlindSeat } = useGame();
  const [customValue, setCustomValue] = useState('');

  const isMultiSeat = selectedPlayers.length > 1;
  const hasSeatSelected = selectedPlayers.length > 0;
  const hasBet = currentStreet !== 'preflop' ? hasBetOrRaiseOnStreet(actionSequence, currentStreet) : false;
  const validActions = hasSeatSelected ? getValidActions(currentStreet, hasBet, isMultiSeat) : [];

  // Sizing
  const sizingAction = !isMultiSeat
    ? validActions.find(a => a === PRIMITIVE_ACTIONS.BET || a === PRIMITIVE_ACTIONS.RAISE)
    : null;
  const nonSizingActions = validActions.filter(a => a !== PRIMITIVE_ACTIONS.BET && a !== PRIMITIVE_ACTIONS.RAISE);

  const currentBet = getCurrentBet(actionSequence, currentStreet);
  const effectiveBet = currentStreet === 'preflop' && currentBet === 0 ? blinds.bb : currentBet;

  // Per-seat contributions for correct call amounts
  const seatContributions = useMemo(
    () => getSeatContributions(actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat),
    [actionSequence, currentStreet, blinds, smallBlindSeat, bigBlindSeat]
  );

  const singleSeat = selectedPlayers.length === 1 ? selectedPlayers[0] : null;
  const seatAlreadyIn = singleSeat ? (seatContributions[singleSeat] || 0) : 0;
  const callAmount = Math.max(0, effectiveBet - seatAlreadyIn);

  // Min raise enforcement
  const minRaise = useMemo(
    () => getMinRaise(actionSequence, currentStreet, blinds),
    [actionSequence, currentStreet, blinds]
  );

  const sizingOptions = sizingAction
    ? getSizingOptions(currentStreet, sizingAction, blinds, potInfo.total, currentBet)
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
    if (!isMultiSeat && onAdvanceSeat) {
      onAdvanceSeat(selectedPlayers[0]);
    }
  }, [recordPrimitiveAction, isMultiSeat, selectedPlayers, onAdvanceSeat, seatContributions, effectiveBet]);

  const handleSizeSelected = useCallback((amount) => {
    if (!recordPrimitiveAction || !sizingAction) return;
    const seat = selectedPlayers[0];
    recordPrimitiveAction(seat, sizingAction, amount);
    if (onAdvanceSeat) {
      onAdvanceSeat(seat);
    }
  }, [recordPrimitiveAction, sizingAction, selectedPlayers, onAdvanceSeat]);

  const handleCustomSubmit = useCallback((e) => {
    e.preventDefault();
    const val = parseFloat(customValue);
    if (!isNaN(val) && val >= minRaise) {
      handleSizeSelected(val);
      setCustomValue('');
    }
  }, [customValue, handleSizeSelected, minRaise]);

  const actionArray = singleSeat ? getActionsForSeatOnStreet(actionSequence, singleSeat, currentStreet) : [];
  const positionLabel = singleSeat ? getPositionName(singleSeat, dealerButtonSeat) : '';

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
          communityCards={communityCards}
          holeCards={holeCards}
          holeCardsVisible={holeCardsVisible}
          cardSelectorType={cardSelectorType}
          highlightedBoardIndex={highlightedBoardIndex}
          onSelectCard={onSelectCard}
          onClose={onCloseCardSelector}
          getCardStreet={getCardStreet}
          setCardSelectorType={setCardSelectorType}
          setHighlightedCardIndex={setHighlightedCardIndex}
          onToggleHoleVisibility={onToggleHoleVisibility}
          onClearBoard={onClearBoard}
          onClearHole={onClearHole}
        />
      )}

      {/* ═══ ACTION ZONE (top) — recording what happened ═══ */}

      {/* Seat Indicator — condensed single line */}
      <div className="px-2 py-1.5" style={{ borderBottom: '1px solid var(--panel-border)' }}>
        {singleSeat ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold" style={{ fontSize: '15px' }}>S{singleSeat}</span>
              {positionLabel && (
                <span style={{ color: 'var(--gold)', fontSize: '14px', fontWeight: 700 }}>{positionLabel}</span>
              )}
              {getSeatPlayerName && getSeatPlayerName(singleSeat) && (
                <span className="text-gray-400" style={{ fontSize: '12px' }}>{getSeatPlayerName(singleSeat)}</span>
              )}
              {nextActionSeat && (
                <span className="text-gray-600" style={{ fontSize: '11px' }}>
                  → S{nextActionSeat}
                </span>
              )}
            </div>
            {actionArray.length > 0 && (
              <ActionSequence actions={actionArray} size="small" maxVisible={4} />
            )}
          </div>
        ) : isMultiSeat ? (
          <span className="text-white font-bold" style={{ fontSize: '13px' }}>
            {selectedPlayers.length} Seats: {selectedPlayers.sort((a,b) => a-b).join(', ')}
          </span>
        ) : (
          <span className="text-gray-500" style={{ fontSize: '13px' }}>Tap a seat to act</span>
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
              const getStyle = () => {
                if (action === PRIMITIVE_ACTIONS.FOLD) return { background: 'linear-gradient(180deg, #dc2626 0%, #b91c1c 100%)' };
                if (action === PRIMITIVE_ACTIONS.CHECK) return { background: 'linear-gradient(180deg, #0891b2 0%, #0e7490 100%)' };
                if (action === PRIMITIVE_ACTIONS.CALL) return { background: 'linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)' };
                if (action === PRIMITIVE_ACTIONS.BET) return { background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)' };
                if (action === PRIMITIVE_ACTIONS.RAISE) return { background: 'linear-gradient(180deg, #ea580c 0%, #c2410c 100%)' };
                return { background: '#4b5563' };
              };
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
                    className="btn-press rounded-md font-bold text-white shadow"
                    style={{ height: '68px', background: 'linear-gradient(180deg, #16a34a 0%, #15803d 100%)', fontSize: '15px' }}
                  >
                    <div>{label}</div>
                    <div style={{ fontSize: '11px', opacity: 0.75 }}>${amount}</div>
                  </button>
                ))}
              </div>
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
                  style={{ height: '48px', fontSize: '15px', background: !customValue || parseFloat(customValue) < minRaise ? '#374151' : '#16a34a' }}
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
                onClick={onRestFold}
                className="btn-press flex-1 rounded-lg font-bold text-white"
                style={{ height: '68px', fontSize: '16px', background: 'linear-gradient(180deg, #991b1b 0%, #7f1d1d 100%)' }}
              >
                {lastRaiserSeat ? `Fold to S${lastRaiserSeat} (${remainingCount})` : `Rest Fold (${remainingCount})`}
              </button>
              {hasAggression && (
                <button
                  onClick={onFoldToInvested}
                  className="btn-press flex-1 rounded-lg font-bold text-white"
                  style={{ height: '68px', fontSize: '14px', background: 'linear-gradient(180deg, #78350f 0%, #5c2d0e 100%)' }}
                >
                  Fold Cold
                </button>
              )}
              {canCheckAround && (
                <button
                  onClick={onCheckAround}
                  className="btn-press flex-1 rounded-lg font-bold text-white"
                  style={{ height: '68px', fontSize: '16px', background: 'linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 100%)' }}
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
              onClick={() => onClearSeatActions([singleSeat])}
              className="btn-press flex-1 rounded-lg font-semibold text-white"
              style={{ height: '48px', fontSize: '13px', background: '#7f1d1d' }}
            >
              Clear Seat
            </button>
            <button
              onClick={() => onUndoLastAction(singleSeat)}
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
            <button onClick={onClearSelection} className="btn-press flex-1 rounded-lg font-semibold text-white" style={{ height: '48px', fontSize: '13px', background: '#374151' }}>Deselect</button>
          )}
          {hasSeatSelected && (
            <button onClick={onToggleAbsent} className="btn-press flex-1 rounded-lg font-semibold text-white" style={{ height: '48px', fontSize: '13px', background: '#1f2937', border: '1px solid var(--panel-border)' }}>Absent</button>
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

CommandStrip.propTypes = {
  currentStreet: PropTypes.string.isRequired,
  onStreetChange: PropTypes.func.isRequired,
  onNextStreet: PropTypes.func.isRequired,
  onClearStreet: PropTypes.func.isRequired,
  selectedPlayers: PropTypes.arrayOf(PropTypes.number).isRequired,
  dealerButtonSeat: PropTypes.number.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  onToggleAbsent: PropTypes.func.isRequired,
  onClearSeatActions: PropTypes.func.isRequired,
  onUndoLastAction: PropTypes.func.isRequired,
  onAdvanceSeat: PropTypes.func.isRequired,
  remainingCount: PropTypes.number.isRequired,
  canCheckAround: PropTypes.bool.isRequired,
  onRestFold: PropTypes.func.isRequired,
  onCheckAround: PropTypes.func.isRequired,
  onFoldToInvested: PropTypes.func.isRequired,
  onNextHand: PropTypes.func.isRequired,
  onResetHand: PropTypes.func.isRequired,
  showCardSelector: PropTypes.bool.isRequired,
  communityCards: PropTypes.array.isRequired,
  holeCards: PropTypes.array.isRequired,
  holeCardsVisible: PropTypes.bool.isRequired,
  cardSelectorType: PropTypes.string,
  highlightedBoardIndex: PropTypes.number,
  onSelectCard: PropTypes.func.isRequired,
  onCloseCardSelector: PropTypes.func.isRequired,
  getCardStreet: PropTypes.func.isRequired,
  setCardSelectorType: PropTypes.func.isRequired,
  setHighlightedCardIndex: PropTypes.func.isRequired,
  onToggleHoleVisibility: PropTypes.func.isRequired,
  onClearBoard: PropTypes.func.isRequired,
  onClearHole: PropTypes.func.isRequired,
  nextActionSeat: PropTypes.number,
  getSeatPlayerName: PropTypes.func,
};
