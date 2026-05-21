import { describe, it, expect } from 'vitest';
import { createNamespacedReducer } from '../createNamespacedReducer';
import {
  withPersistenceDispatch,
  shouldPersistAction,
} from '../withPersistenceDispatch';

describe('createNamespacedReducer', () => {
  const counterReducer = (state = { count: 0 }, action) => {
    if (action.type === 'INCREMENT') return { count: state.count + 1 };
    if (action.type === 'RESET') return { count: 0 };
    return state;
  };

  const togglesReducer = (state = { open: false }, action) => {
    if (action.type === 'TOGGLE') return { open: !state.open };
    return state;
  };

  describe('factory validation', () => {
    it('throws on non-object slices', () => {
      expect(() => createNamespacedReducer(null)).toThrow(TypeError);
      expect(() => createNamespacedReducer([])).toThrow(TypeError);
    });

    it('throws on empty slices', () => {
      expect(() => createNamespacedReducer({})).toThrow(/at least one slice/);
    });

    it('throws on malformed slice (not a [fn, init] tuple)', () => {
      expect(() => createNamespacedReducer({ a: 'not-tuple' })).toThrow(/must be \[reducerFn/);
      expect(() => createNamespacedReducer({ a: [counterReducer] })).toThrow(/must be \[reducerFn/);
    });
  });

  describe('composition', () => {
    const { reducer, initialState, dispatchHelpers } = createNamespacedReducer({
      counter: [counterReducer, { count: 0 }],
      toggles: [togglesReducer, { open: false }],
    });

    it('initialState merges all slice initial states', () => {
      expect(initialState).toEqual({
        counter: { count: 0 },
        toggles: { open: false },
      });
    });

    it('initialState is frozen', () => {
      expect(Object.isFrozen(initialState)).toBe(true);
    });

    it('reducer applies an action to every slice', () => {
      const s1 = reducer(initialState, { type: 'INCREMENT' });
      expect(s1.counter.count).toBe(1);
      expect(s1.toggles.open).toBe(false);

      const s2 = reducer(s1, { type: 'TOGGLE' });
      expect(s2.counter.count).toBe(1);
      expect(s2.toggles.open).toBe(true);
    });

    it('returns same reference when no slice changes (memoization)', () => {
      const state = reducer(initialState, { type: 'UNKNOWN' });
      expect(state).toBe(initialState);
    });

    it('returns new reference when at least one slice changes', () => {
      const state = reducer(initialState, { type: 'INCREMENT' });
      expect(state).not.toBe(initialState);
    });

    it('uses initial state when called with undefined state', () => {
      const state = reducer(undefined, { type: 'UNKNOWN' });
      expect(state).toEqual(initialState);
    });
  });

  describe('dispatchHelpers', () => {
    const { dispatchHelpers } = createNamespacedReducer({
      counter: [counterReducer, { count: 0 }],
      toggles: [togglesReducer, { open: false }],
    });

    it('exposes a helper per slice', () => {
      expect(Object.keys(dispatchHelpers).sort()).toEqual(['counter', 'toggles']);
    });

    it('helpers tag action with __slice metadata', () => {
      const tagged = dispatchHelpers.counter({ type: 'INCREMENT' });
      expect(tagged.__slice).toBe('counter');
      expect(tagged.type).toBe('INCREMENT');
    });

    it('helpers preserve original action fields', () => {
      const tagged = dispatchHelpers.toggles({ type: 'TOGGLE', payload: { x: 1 } });
      expect(tagged.payload).toEqual({ x: 1 });
    });
  });
});

describe('withPersistenceDispatch', () => {
  const noopReducer = (s = {}) => s;

  it('throws on non-function reducer', () => {
    expect(() => withPersistenceDispatch(null)).toThrow(TypeError);
  });

  it('returns the reducer + a shouldPersistAction helper', () => {
    const { reducer, shouldPersistAction: helper } = withPersistenceDispatch(noopReducer);
    expect(reducer).toBe(noopReducer);
    expect(typeof helper).toBe('function');
  });
});

describe('shouldPersistAction', () => {
  it('returns true for an untagged action', () => {
    expect(shouldPersistAction({ type: 'X' })).toBe(true);
  });

  it('returns true when persist is true', () => {
    expect(shouldPersistAction({ type: 'X', persist: true })).toBe(true);
  });

  it('returns false when persist is explicitly false', () => {
    expect(shouldPersistAction({ type: 'X', persist: false })).toBe(false);
  });

  it('returns true for non-object input (defensive default)', () => {
    expect(shouldPersistAction(null)).toBe(true);
    expect(shouldPersistAction(undefined)).toBe(true);
  });

  it('treats falsy-but-not-false (e.g. 0) as persist=true', () => {
    expect(shouldPersistAction({ type: 'X', persist: 0 })).toBe(true);
  });
});
