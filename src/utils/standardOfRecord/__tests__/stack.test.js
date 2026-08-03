/**
 * stack.test.js — the layer vocabulary and the registration refusal (WS-324).
 *
 * The load-bearing test in this file is "a stackless surface THROWS". AC1 says such a surface
 * "cannot be registered, it is not merely warned about", and the difference between a throw
 * and a warning is the entire value of the declaration — a warning lets the next WS-291
 * register anyway.
 */

import { describe, it, expect } from 'vitest';
import {
  STACK_LAYERS,
  TERMINAL_LAYER,
  LAYER_GROUND_TRUTH,
  layerIndex,
  isStackLayer,
  buildLayer,
  stackProblems,
  isValidStack,
  firstStructuralDivergence,
} from '../stack.js';
import { buildSurfaceEntry } from '../surfaceRegistry.js';

const fullStack = () => [
  buildLayer({ layer: 'range', inputs: ['situationKey'], outputType: 'rangeVector', assumptions: ['priorWeight'] }),
  buildLayer({ layer: 'equity', inputs: ['range', 'board'], outputType: 'scalar', assumptions: ['monteCarloSamples'] }),
  buildLayer({ layer: 'foldProbability', inputs: ['range', 'betSize'], outputType: 'scalar', assumptions: ['foldCurve'] }),
  buildLayer({ layer: 'ev', inputs: ['equity', 'foldProbability', 'pot'], outputType: 'scalar', assumptions: [] }),
  buildLayer({ layer: 'action', inputs: ['ev'], outputType: 'actionDistribution', assumptions: [] }),
];

const actionOnlyStack = () => [
  buildLayer({ layer: 'action', inputs: ['situationKey'], outputType: 'actionDistribution', assumptions: [] }),
];

describe('the layer vocabulary', () => {
  it('is ordered and frozen — order is shared, not a caller choice', () => {
    expect(STACK_LAYERS).toEqual(['range', 'equity', 'foldProbability', 'ev', 'action']);
    expect(Object.isFrozen(STACK_LAYERS)).toBe(true);
  });

  it('places every layer before the terminal action layer', () => {
    for (const layer of STACK_LAYERS) {
      if (layer !== TERMINAL_LAYER) {
        expect(layerIndex(layer)).toBeLessThan(layerIndex(TERMINAL_LAYER));
      }
    }
  });

  it('rejects an unknown layer at descriptor construction', () => {
    expect(() => buildLayer({ layer: 'vibes' })).toThrow(/not one of/);
  });

  it('records ground truth as a property of the layer, with null meaning none exists', () => {
    expect(LAYER_GROUND_TRUTH.range).toBe('revealedHolding');
    expect(LAYER_GROUND_TRUTH.ev).toBe('realizedChips');
    // `action` has no ground truth of its own. Null must be distinguishable from "not wired".
    expect(LAYER_GROUND_TRUTH.action).toBeNull();
    expect(Object.prototype.hasOwnProperty.call(LAYER_GROUND_TRUTH, 'action')).toBe(true);
  });

  it('carries ground truth onto the descriptor so probes never redefine it', () => {
    expect(buildLayer({ layer: 'range' }).groundTruth).toBe('revealedHolding');
  });
});

describe('stack validation', () => {
  it('accepts the full canonical stack', () => {
    expect(stackProblems(fullStack())).toEqual([]);
    expect(isValidStack(fullStack())).toBe(true);
  });

  it('accepts a SUBSET — a card mapping situation straight to action has no equity layer', () => {
    expect(stackProblems(actionOnlyStack())).toEqual([]);
  });

  it('refuses a REORDERING, because "first divergent layer" needs a fixed order', () => {
    const reordered = [
      buildLayer({ layer: 'equity' }),
      buildLayer({ layer: 'range' }),
      buildLayer({ layer: 'action' }),
    ];
    const problems = stackProblems(reordered);
    expect(problems.some((p) => /canonical order/.test(p))).toBe(true);
  });

  it('refuses a duplicated layer', () => {
    const dupe = [
      buildLayer({ layer: 'range' }),
      buildLayer({ layer: 'range' }),
      buildLayer({ layer: 'action' }),
    ];
    expect(stackProblems(dupe).some((p) => /more than once/.test(p))).toBe(true);
  });

  it('requires the action layer — a surface emitting no action distribution is not a surface', () => {
    const noAction = [buildLayer({ layer: 'range' }), buildLayer({ layer: 'equity' })];
    expect(stackProblems(noAction).some((p) => /"action" layer/.test(p))).toBe(true);
  });

  it('refuses an empty or non-array stack', () => {
    expect(stackProblems([])).toEqual(['stack must declare at least one layer']);
    expect(stackProblems(null)).toEqual(['stack must be an array of layer descriptors']);
    expect(stackProblems('range')).toEqual(['stack must be an array of layer descriptors']);
  });

  it('requires inputs and assumptions to be arrays — empty is a positive claim', () => {
    const bad = [{ layer: 'action', inputs: 'ev', assumptions: 'none' }];
    const problems = stackProblems(bad);
    expect(problems.some((p) => /inputs must be an array/.test(p))).toBe(true);
    expect(problems.some((p) => /assumptions must be an array/.test(p))).toBe(true);
  });
});

describe('surface registration REFUSES an undeclared stack (AC1)', () => {
  it('THROWS rather than warns when stack is absent', () => {
    expect(() => buildSurfaceEntry({
      surfaceId: 'srf-unstacked',
      surfaceKind: 'Declared',
    })).toThrow(/cannot be registered without a valid stack/);
  });

  it('throws when the stack is present but malformed', () => {
    expect(() => buildSurfaceEntry({
      surfaceId: 'srf-bad',
      surfaceKind: 'Field',
      stack: [buildLayer({ layer: 'range' })], // no action layer
    })).toThrow(/cannot be registered without a valid stack/);
  });

  it('names the offending surface and the specific problem in the message', () => {
    let message = '';
    try {
      buildSurfaceEntry({ surfaceId: 'srf-named', surfaceKind: 'Read', stack: [] });
    } catch (e) {
      message = e.message;
    }
    expect(message).toMatch(/srf-named/);
    expect(message).toMatch(/at least one layer/);
  });

  it('registers a surface that declares a valid stack, and freezes it', () => {
    const entry = buildSurfaceEntry({
      surfaceId: 'srf-ok',
      surfaceKind: 'Declared',
      sources: ['SRC-012'],
      stack: fullStack(),
    });
    expect(entry.surfaceId).toBe('srf-ok');
    expect(entry.origin).toBe('authored');
    expect(entry.stack).toHaveLength(5);
    expect(Object.isFrozen(entry.stack)).toBe(true);
  });

  it('still refuses a missing surfaceId and an unknown kind — stack did not displace them', () => {
    expect(() => buildSurfaceEntry({ surfaceKind: 'Declared', stack: fullStack() }))
      .toThrow(/surfaceId is required/);
    expect(() => buildSurfaceEntry({ surfaceId: 'x', surfaceKind: 'Guess', stack: fullStack() }))
      .toThrow(/is not one of/);
  });
});

/**
 * Founder directive 2026-08-03: AC4 (layer attribution) is deferred to WS-350, and the
 * substrate poured in this sprint must not harden in a way that makes it harder later.
 *
 * These are the properties Phase 3 will need. If a future change breaks one, it will break
 * HERE — loudly, in the sprint that broke it — rather than silently a quarter later when
 * someone tries to build attribution on a foundation that quietly stopped supporting it.
 */
describe('stays attribution-ready for Phase 3 (WS-350)', () => {
  it('keeps the layer order total, so "the FIRST divergent layer" stays well-defined', () => {
    const indices = STACK_LAYERS.map(layerIndex);
    expect(indices).toEqual([...indices].sort((a, b) => a - b));
    expect(new Set(indices).size).toBe(STACK_LAYERS.length);
  });

  it('keeps every layer nameable, so attribution can point at one', () => {
    for (const layer of STACK_LAYERS) expect(isStackLayer(layer)).toBe(true);
  });

  it('records which layers HAVE ground truth — attribution needs to know where it can anchor', () => {
    const anchorable = STACK_LAYERS.filter((l) => LAYER_GROUND_TRUTH[l] !== null);
    // If this ever drops to zero, no layer can be scored independently and attribution
    // degenerates into re-describing the top-level difference.
    expect(anchorable.length).toBeGreaterThanOrEqual(4);
  });

  it('exposes the STRUCTURAL half of divergence without defining a measure `d`', () => {
    // Phase 3 supplies the quantitative half. This half must already work and must NOT have
    // been implemented by smuggling in a divergence metric — ADR-009 permits exactly one
    // comparison path and it is not this module's to create.
    expect(typeof firstStructuralDivergence).toBe('function');
    const src = firstStructuralDivergence.toString();
    for (const forbidden of ['kl', 'entropy', 'divergenceOf', 'evDiff']) {
      expect(src.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });

  it('keeps assumptions per-layer, so a fault register can point at one rather than at "the model"', () => {
    const layer = buildLayer({ layer: 'range', assumptions: ['PRIOR_WEIGHT', 'MIN_CONTINUATION_WEIGHT'] });
    expect(layer.assumptions).toHaveLength(2);
  });
});

describe('structural divergence', () => {
  it('is null for two stacks declaring the same layers', () => {
    expect(firstStructuralDivergence(fullStack(), fullStack())).toBeNull();
  });

  it('names the first layer one stack has and the other does not', () => {
    expect(firstStructuralDivergence(fullStack(), actionOnlyStack())).toBe('range');
  });

  it('reports in canonical order, not in declaration order', () => {
    const noEquity = [
      buildLayer({ layer: 'range' }),
      buildLayer({ layer: 'foldProbability' }),
      buildLayer({ layer: 'action' }),
    ];
    // range matches; equity is the first mismatch even though foldProbability differs too.
    expect(firstStructuralDivergence(fullStack(), noEquity)).toBe('equity');
  });
});
