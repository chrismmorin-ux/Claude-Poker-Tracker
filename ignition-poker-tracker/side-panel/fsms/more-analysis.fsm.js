import { defineFsm } from '../fsm.js';

/**
 * More-Analysis collapsible FSM (Z4 row 4.2). Renamed from deepExpanderFsm
 * under SR-6.14 when Z4 split into independent 4.2/4.3 collapsibles.
 *
 * closed ← initial.
 * open   ← user toggled.
 *
 * handNew is a NO-OP by design — user intent sticks within a hand (per SR-4
 * Z4 batch invariant 2). tableSwitch collapses.
 */
export const moreAnalysisFsm = defineFsm({
  id: 'moreAnalysis',
  initial: 'closed',
  states: {
    closed: {
      on: {
        userToggle: () => 'open',
      },
    },
    open: {
      on: {
        userToggle:  () => 'closed',
        tableSwitch: () => 'closed',
      },
    },
  },
});
