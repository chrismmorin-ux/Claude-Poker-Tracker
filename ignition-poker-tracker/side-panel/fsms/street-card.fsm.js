import { defineFsm } from '../fsm.js';

/**
 * Street-card transition FSM — replaces `_prevStreet` module var + implicit
 * fade logic in render-street-card.js (RT-60 / SR-6.5 C2 boundary).
 *
 * empty     ← initial; no street card rendered.
 * showing   ← content visible, no transition in flight.
 * fadingOut ← street just changed; CSS fade-out animation running; fade timer
 *             scheduled by caller; on fadeTimerFire we swap content + enter
 *             fadingIn.
 * fadingIn  ← content swapped; CSS fade-in running; height-release timer
 *             scheduled; on heightReleaseFire we return to `showing`.
 *
 * The FSM tracks transition phase. The actual previous/current street values
 * live in coordinator slots (`prevStreet`, `lastRenderedStreet`) because the
 * street value is data, not FSM state.
 */
export const streetCardFsm = defineFsm({
  id: 'streetCard',
  initial: 'empty',
  states: {
    empty: {
      on: {
        adviceArrive: () => 'showing',
        streetChange: () => 'showing',
      },
    },
    showing: {
      on: {
        streetChange:     () => 'fadingOut',
        adviceArrive:     () => 'showing',
        tableSwitch:      () => 'empty',
      },
    },
    fadingOut: {
      on: {
        fadeTimerFire: () => 'fadingIn',
        tableSwitch:   () => 'empty',
      },
    },
    fadingIn: {
      on: {
        heightReleaseFire: () => 'showing',
        streetChange:      () => 'fadingOut',
        tableSwitch:       () => 'empty',
      },
    },
  },
});
