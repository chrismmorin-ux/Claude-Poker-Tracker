/**
 * useSeatStackLedger.js — keeps the seat stack ledger alive during play
 *
 * Surface spec: docs/design/surfaces/seat-stack-ledger.md
 * Gate 2 commitments: C-1 (provenance), C-3 (observed beats derived)
 *
 * Two jobs, both automatic, neither asking the founder for anything:
 *
 *   SEED    a newly-occupied seat from the session buy-in, so the table starts
 *           with a number instead of nothing. Seeded values are `buyin-default`
 *           and therefore NOT admissible — they are a starting guess that cannot
 *           refute a claim, only be replaced by something real.
 *
 *   RECONCILE  after every recorded action, raise any seat that has committed
 *           more than the ledger credits it with (C-3). This is the self-healing
 *           path: a rebuy the app never saw is revealed the moment the player
 *           commits the chips, and the ledger corrects itself with zero
 *           interaction. It is also what made it safe to keep the manual
 *           correction affordance out of the mid-hand surface entirely (C-5).
 *
 * Carry-forward is NOT here — it belongs to NEXT_HAND, where the action sequence
 * that funds the arithmetic still exists.
 */

import { useEffect, useMemo } from 'react';
import { GAME_ACTIONS } from '../reducers/gameReducer';
import { useGame, usePlayer, useSession } from '../contexts';
import { committedSoFar } from '../utils/seatStacks/handSettlement';
import { calculateSidePots } from '../utils/potCalculator';

export const useSeatStackLedger = () => {
  const {
    actionSequence,
    blinds,
    smallBlindSeat,
    bigBlindSeat,
    seatStacks,
    dispatchGame,
  } = useGame();
  const { seatPlayers } = usePlayer();
  const { currentSession } = useSession();

  const buyIn = currentSession?.buyIn ?? null;

  // Seats with a player in them. Stable across renders unless occupancy changes,
  // so the seeding effect does not re-fire on every action.
  const occupiedSeats = useMemo(
    () => Object.keys(seatPlayers || {})
      .filter((seat) => seatPlayers[seat] !== null && seatPlayers[seat] !== undefined)
      .map(Number)
      .sort((a, b) => a - b),
    [seatPlayers],
  );
  const occupancyKey = occupiedSeats.join(',');

  // SEED. The reducer refuses to overwrite a seat that already has a stack, so
  // this can fire freely — an assumption never displaces an observation.
  useEffect(() => {
    if (!buyIn || occupiedSeats.length === 0) return;
    const unseeded = occupiedSeats.filter((seat) => !(seat in (seatStacks || {})));
    if (unseeded.length === 0) return;
    dispatchGame({
      type: GAME_ACTIONS.SEED_SEAT_STACKS,
      payload: { seats: unseeded, buyIn },
    });
    // `occupancyKey` rather than the array: identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [occupancyKey, buyIn, seatStacks, dispatchGame]);

  // RECONCILE. `isEstimated` gates this: when a bet or raise lacked an amount,
  // contributions are unreliable and must not be mistaken for observations.
  useEffect(() => {
    if (!actionSequence || actionSequence.length === 0) return;
    if (!blinds) return;

    const { isEstimated } = calculateSidePots(actionSequence, blinds, {
      smallBlindSeat,
      bigBlindSeat,
    });
    if (isEstimated) return;

    const contributions = committedSoFar(actionSequence, blinds, {
      smallBlindSeat,
      bigBlindSeat,
    });

    // The reducer returns the SAME state object when nothing contradicts, so
    // dispatching on every action is cheap and cannot cause a render loop.
    dispatchGame({
      type: GAME_ACTIONS.RECONCILE_SEAT_STACKS,
      payload: { contributions, estimated: false },
    });
  }, [actionSequence, blinds, smallBlindSeat, bigBlindSeat, dispatchGame]);
};

/**
 * Mount point. Renders nothing — the ledger is bookkeeping, and per Gate 2 C-4
 * it must never put anything in front of the founder mid-hand.
 */
export const SeatStackLedger = () => {
  useSeatStackLedger();
  return null;
};
