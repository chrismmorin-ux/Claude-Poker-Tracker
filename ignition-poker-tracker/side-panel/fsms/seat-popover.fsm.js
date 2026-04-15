import { defineFsm } from '../fsm.js';

/**
 * Seat popover FSM — C2 site #9 from 05-architecture-delta.md.
 *
 * hidden  ← initial; no popover.
 * shown   ← user clicked a seat circle.
 *           Extra payload { seat, coords } is surfaced to the coordinator so
 *           the render path can read `snap.seatPopoverSeat` + `snap.seatPopoverCoords`
 *           on subsequent renders. (Coordinates live in their own slot rather
 *           than inside the FSM state to keep the FSM declarative.)
 *
 * Re-clicking the currently-shown seat collapses the popover — handled by
 * caller before dispatching (i.e. caller dispatches outsideClick instead of
 * another seatClick when seat matches current `pinnedVillainSeat`).
 */
export const seatPopoverFsm = defineFsm({
  id: 'seatPopover',
  initial: 'hidden',
  states: {
    hidden: {
      on: {
        seatClick: (payload) => {
          if (!payload || payload.seat == null) return null;
          return { state: 'shown', seat: payload.seat, coords: payload.coords || null };
        },
      },
    },
    shown: {
      on: {
        seatClick: (payload) => {
          if (!payload || payload.seat == null) return null;
          return { state: 'shown', seat: payload.seat, coords: payload.coords || null };
        },
        outsideClick: () => 'hidden',
        handNew:      () => 'hidden',
        tableSwitch:  () => 'hidden',
      },
    },
  },
});
