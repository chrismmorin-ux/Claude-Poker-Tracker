import { defineFsm } from '../fsm.js';

/**
 * Recovery banner FSM — C2 sites #1–5 from 05-architecture-delta.md.
 *
 * hidden         ← initial; no banner visible.
 * showing        ← entered on connectionLost/contextDead/versionMismatch.
 *                  The specific cause lives in coordinator slot `recoveryMessage`,
 *                  written by the caller alongside the dispatch.
 * reloadPending  ← entered when user clicks "Reload" button. Button is disabled;
 *                  caller schedules a coordinator timer that fires `reenableTimerFire`
 *                  to hop back to `showing` after a short cooldown.
 */
export const recoveryBannerFsm = defineFsm({
  id: 'recoveryBanner',
  initial: 'hidden',
  states: {
    hidden: {
      on: {
        connectionLost:   () => 'showing',
        contextDead:      () => 'showing',
        versionMismatch:  () => 'showing',
      },
    },
    showing: {
      on: {
        userReload:         () => 'reloadPending',
        connectionRestored: () => 'hidden',
        tableSwitch:        () => 'hidden',
      },
    },
    reloadPending: {
      on: {
        reenableTimerFire:  () => 'showing',
        connectionRestored: () => 'hidden',
        tableSwitch:        () => 'hidden',
      },
    },
  },
});
