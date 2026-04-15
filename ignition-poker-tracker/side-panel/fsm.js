/**
 * fsm.js — Minimal declarative finite state machine helper.
 *
 * Doctrine R-2.1 (explicit FSM), R-2.2 (named transitions). Used by SR-6.5 to
 * replace implicit state machines scattered across side-panel.js event
 * handlers.
 *
 * Shape of an FSM declaration:
 *   {
 *     id:      'recoveryBanner',
 *     initial: 'hidden',
 *     states: {
 *       hidden:  { on: { connectionLost: (payload) => 'showing' } },
 *       showing: { on: { connectionRestored: () => 'hidden',
 *                        userReload:         () => 'reloadPending' } },
 *       ...
 *     },
 *   }
 *
 * A transition handler receives (payload, ctx) and returns either:
 *   - a string (the next state name), or
 *   - null / undefined (stay in current state), or
 *   - an object { state, ...extra } for FSMs that want to surface side
 *     information to the caller (e.g. the seat popover returning coordinates).
 *
 * Unknown events never throw — they return { changed: false } so the caller
 * can no-op without try/catch.
 */

export function defineFsm(decl) {
  if (!decl || typeof decl !== 'object') {
    throw new Error('defineFsm: declaration required');
  }
  const { id, initial, states } = decl;
  if (!id || !initial || !states || !states[initial]) {
    throw new Error(`defineFsm(${id}): missing id/initial/states[initial]`);
  }
  return {
    id,
    initial,
    states,
    /**
     * Apply an event. Returns { state, changed, extra? }.
     *   state:   the resulting state (== prev if no change)
     *   changed: boolean — true iff state name differs from prev
     *   extra:   optional object returned by the transition handler (minus .state)
     */
    transition(prev, event, payload, ctx) {
      const node = states[prev];
      if (!node) {
        return { state: prev, changed: false };
      }
      const handler = node.on && node.on[event];
      if (!handler) {
        return { state: prev, changed: false };
      }
      const raw = handler(payload, ctx);
      if (raw == null) {
        return { state: prev, changed: false };
      }
      if (typeof raw === 'string') {
        return { state: raw, changed: raw !== prev };
      }
      if (typeof raw === 'object' && raw.state) {
        const { state, ...extra } = raw;
        return { state, changed: state !== prev, extra };
      }
      return { state: prev, changed: false };
    },
  };
}
