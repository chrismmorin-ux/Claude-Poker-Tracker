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
 * pendingActive  ← saw one liveContextArrived with betweenHandsOrIdle=true;
 *                  awaiting confirmation. WS-102 debounce: a transient
 *                  malformed payload that briefly says betweenHandsOrIdle=true
 *                  must be retracted by the next push (which will return us
 *                  to inactive) — so the banner doesn't flash on a single
 *                  bad payload. Slot ownership stays with the previous owner
 *                  during pendingActive (renderer treats pendingActive like
 *                  inactive for visibility purposes).
 * active         ← confirmed between hands (two consecutive
 *                  betweenHandsOrIdle=true signals or the resumption path
 *                  from modeAExpired). Banner visible.
 * modeAExpired   ← Mode A timer fired; banner collapses to chevron-only
 *                  affordance (spec: SR-4 Zx X.1 / Z0 pipeline handoff).
 *
 * handNew resets to inactive (hero has cards = we're mid-hand again).
 *
 * WS-102 modeAExpired symmetry: a fresh liveContextArrived with
 * betweenHandsOrIdle=true while in modeAExpired returns to active. Defensive
 * recovery for flows where handNew failed to fire between two between-hands
 * cycles — modeAExpired must not be a sticky terminal that swallows further
 * between-hands signals.
 */
export const betweenHandsFsm = defineFsm({
  id: 'betweenHands',
  initial: 'inactive',
  states: {
    inactive: {
      on: {
        liveContextArrived: (payload) => {
          if (payload && payload.betweenHandsOrIdle) return 'pendingActive';
          return null;
        },
      },
    },
    pendingActive: {
      on: {
        liveContextArrived: (payload) => {
          if (payload && payload.betweenHandsOrIdle === false) return 'inactive';
          if (payload && payload.betweenHandsOrIdle === true) return 'active';
          return null;
        },
        handNew:        () => 'inactive',
        adviceArrived:  () => 'inactive',
        tableSwitch:    () => 'inactive',
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
          if (payload && payload.betweenHandsOrIdle === true) return 'active';
          return null;
        },
        tableSwitch: () => 'inactive',
      },
    },
  },
});
