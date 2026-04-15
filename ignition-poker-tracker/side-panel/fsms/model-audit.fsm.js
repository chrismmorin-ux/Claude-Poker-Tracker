import { defineFsm } from '../fsm.js';

/**
 * Model-Audit collapsible FSM (Z4 row 4.3). Debug-flag-gated collapsible
 * exposing model/data provenance. Parallel to moreAnalysisFsm but separate
 * per R-5.1 single-owner and Z4 batch invariant 1.
 *
 * closed ← initial.
 * open   ← user toggled.
 *
 * handNew is NO-OP (user intent sticks per hand per Z4 batch invariant 2).
 * tableSwitch collapses.
 *
 * NOTE: The debug-flag absence-from-DOM contract (Z4 batch invariant 6) is
 * enforced at the render layer — this FSM knows nothing about the flag. When
 * flag=off, the renderer removes the DOM node entirely so no transitions can
 * be dispatched against a missing element.
 */
export const modelAuditFsm = defineFsm({
  id: 'modelAudit',
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
