import { defineFsm } from '../fsm.js';

/**
 * Between-hands FSM — X.1 spec, C3 gap from 05-architecture-delta.md.
 *
 * Predicate for entering `active`: betweenHandsOrIdle === true (from payload).
 * App-connectedness is NOT part of the predicate here — X.1 spec declares
 * the banner should show between hands regardless of app connection (the
 * app-disconnected overlay is a distinct Zx state X.4). Mid-hand mounts are
 * forbidden: `liveContextArrived` with `betweenHands: false` always routes
 * to `inactive`, even from `active`.
 *
 * inactive       ← initial; no banner.
 * active         ← between hands, before Mode A timer expires.
 * modeAExpired   ← Mode A timer fired; banner collapses to chevron-only
 *                  affordance (spec: SR-4 Zx X.1 / Z0 pipeline handoff).
 *
 * handNew resets to inactive (hero has cards = we're mid-hand again).
 */
export const betweenHandsFsm = defineFsm({
  id: 'betweenHands',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        liveContextArrived: (payload) => {
          if (payload && payload.betweenHandsOrIdle) return 'active';
          return null;
        },
      },
    },
    active: {
      on: {
        liveContextArrived: (payload) => {
          if (payload && payload.betweenHandsOrIdle === false) return 'inactive';
          return null;
        },
        modeATimerFire: () => 'modeAExpired',
        handNew:        () => 'inactive',
        adviceArrived:  () => 'inactive',
        tableSwitch:    () => 'inactive',
      },
    },
    modeAExpired: {
      on: {
        handNew:       () => 'inactive',
        adviceArrived: () => 'inactive',
        liveContextArrived: (payload) => {
          if (payload && payload.betweenHandsOrIdle === false) return 'inactive';
          return null;
        },
        tableSwitch: () => 'inactive',
      },
    },
  },
});
