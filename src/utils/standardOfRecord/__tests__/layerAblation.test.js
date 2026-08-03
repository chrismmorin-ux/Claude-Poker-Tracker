/**
 * layerAblation.test.js — substitution from stored atoms, and the proof it stays there.
 *
 * The first block is the load-bearing one. WS-324 criterion #5 asks that an ablation run "from
 * stored atoms alone, with the engine NOT invoked". A comment claiming that is a promise; a test
 * that reads the module's own import list is a fact. If someone later reaches for
 * `postflopNarrower` from here to make one question easier, this fails immediately rather than
 * six months later when a number turns out to have been recomputed by an engine that had moved.
 */

import { readFileSync } from 'node:fs';
import { describe, test, expect } from 'vitest';

import {
  substituteLayer, substitutionReach, ablateLayer, exactlyAblatable, emissionFor,
} from '../layerAblation.js';
import { ATOMS_BEFORE, ATOM_SET_MANIFEST } from '../__fixtures__/ws291AtomSet.js';

const SOURCE = readFileSync(new URL('../layerAblation.js', import.meta.url), 'utf8');
const ATOM = ATOMS_BEFORE[0];

describe('CRITERION #5 — the engine is not on this path, and that is asserted not asserted-in-prose', () => {
  const imports = [...SOURCE.matchAll(/^import\s[^;]*?from\s+'([^']+)';/gms)].map((m) => m[1]);

  test('every import is local to standardOfRecord/ or a node builtin', () => {
    expect(imports.length).toBeGreaterThan(0);
    for (const spec of imports) {
      expect(spec, `layerAblation.js reached outside its own directory: "${spec}"`)
        .toMatch(/^(\.\/[A-Za-z0-9_.-]+\.js|node:[a-z]+)$/);
    }
  });

  test('nothing from an engine, a range builder, or a backtest script is imported', () => {
    for (const forbidden of ['exploitEngine', 'rangeEngine', 'pokerCore', 'handAnalysis', 'backtest', 'holdingKnowledge']) {
      expect(SOURCE, `layerAblation.js imports ${forbidden}`)
        .not.toMatch(new RegExp(`from\\s+'[^']*${forbidden}`));
    }
  });

  test('substitution runs with no functions supplied at all', () => {
    // Nothing to evaluate means nothing to pin, means nothing that can have moved.
    expect(() => substituteLayer(ATOM, 'range', 0.9)).not.toThrow();
  });
});

describe('substituteLayer — immutable, and marked', () => {
  test('returns a new atom and leaves the original untouched', () => {
    const before = emissionFor(ATOM, 'range').value;
    const after = substituteLayer(ATOM, 'range', 0.99);
    expect(emissionFor(after, 'range').value).toBe(0.99);
    expect(emissionFor(ATOM, 'range').value).toBe(before);
    expect(after).not.toBe(ATOM);
  });

  test('the substituted layer is STAMPED, so an ablated atom cannot pass as a recorded one', () => {
    const after = substituteLayer(ATOM, 'range', 0.99, { origin: 'revealed-holding' });
    expect(emissionFor(after, 'range').substituted).toBe(true);
    expect(emissionFor(after, 'range').substitutedFrom).toBe('revealed-holding');
    expect(after.ablated).toEqual({ layer: 'range', origin: 'revealed-holding' });
  });

  test('untouched layers keep their exact recorded emissions', () => {
    const after = substituteLayer(ATOM, 'range', 0.99);
    for (const layer of ['equity', 'foldProbability', 'ev', 'action']) {
      expect(emissionFor(after, layer)).toBe(emissionFor(ATOM, layer));
    }
  });

  test('refuses to substitute into a layer the atom never declared', () => {
    const noRange = { ...ATOM, layers: ATOM.layers.filter((l) => l.layer !== 'range') };
    expect(() => substituteLayer(noRange, 'range', 0.5))
      .toThrow(/does not declare layer "range"/);
  });

  test('refuses an unknown layer name rather than inventing one', () => {
    expect(() => substituteLayer(ATOM, 'vibes', 1)).toThrow(/unknown layer "vibes"/);
  });

  test('refuses an unknown valueKind', () => {
    expect(() => substituteLayer(ATOM, 'range', 1, { valueKind: 'approximate' }))
      .toThrow(/valueKind must be/);
  });
});

describe('substitutionReach — the module says what it cannot answer', () => {
  test('a range substitution can speak to range, and to nothing downstream', () => {
    const reach = substitutionReach('range');
    expect(reach.answerable).toEqual(['range']);
    expect(reach.unanswerable).toEqual(['equity', 'foldProbability', 'ev', 'action']);
  });

  test('the reason points at the pinned-replay path rather than just refusing', () => {
    expect(substitutionReach('equity').reason).toMatch(/PINNED layer functions|layerAttribution/);
  });

  test('the terminal layer has nothing downstream, and says so with a null reason', () => {
    const reach = substitutionReach('action');
    expect(reach.unanswerable).toEqual([]);
    expect(reach.reason).toBeNull();
  });
});

describe('ablateLayer — per-decision replacements, and counted skips', () => {
  test('substitutes across a set and carries the reach with the result', () => {
    const out = ablateLayer({
      atoms: ATOMS_BEFORE, layer: 'range', replacementFor: () => 0.55,
    });
    expect(out.n).toBe(ATOMS_BEFORE.length);
    expect(out.atoms.every((a) => emissionFor(a, 'range').value === 0.55)).toBe(true);
    expect(out.reach.unanswerable).toContain('action');
  });

  test('a replacement of undefined SKIPS the row and records which one', () => {
    const out = ablateLayer({
      atoms: ATOMS_BEFORE,
      layer: 'range',
      replacementFor: (a) => (a.atomId === 'atom-003' ? undefined : 0.5),
    });
    expect(out.n).toBe(ATOMS_BEFORE.length - 1);
    expect(out.skipped).toEqual(['atom-003']);
  });

  test('a constant replacement must be stated as a function — no silent broadcast', () => {
    expect(() => ablateLayer({ atoms: ATOMS_BEFORE, layer: 'range', replacementFor: 0.5 }))
      .toThrow(/`replacementFor\(atom\)` is required/);
  });
});

describe('exactlyAblatable — the sampling rate is READ, never inferred', () => {
  test('keeps only rows whose layer value was recorded full', () => {
    const mixed = ATOMS_BEFORE.map((a, i) => (i < 2 ? {
      ...a,
      layers: a.layers.map((l) => (l.layer === 'range' ? { ...l, valueKind: 'compressed' } : l)),
    } : a));
    const out = exactlyAblatable(mixed, 'range', ATOM_SET_MANIFEST);
    expect(out.n).toBe(ATOMS_BEFORE.length - 2);
    expect(out.nTotal).toBe(ATOMS_BEFORE.length);
  });

  test('reports the manifest\'s RECORDED rate, not the observed fraction of full rows', () => {
    // These two numbers differ here on purpose: 4 of 6 rows are full, but the manifest records
    // a rate of 1. That gap is exactly the signal `decisionAtom.js` refuses to destroy — a low
    // sampling rate, a crashed run, and a filter that dropped rows are three different facts.
    const mixed = ATOMS_BEFORE.map((a, i) => (i < 2 ? {
      ...a,
      layers: a.layers.map((l) => (l.layer === 'range' ? { ...l, valueKind: 'compressed' } : l)),
    } : a));
    const out = exactlyAblatable(mixed, 'range', ATOM_SET_MANIFEST);
    expect(out.fullSampleRate).toBe(1);
    expect(out.n / out.nTotal).not.toBe(out.fullSampleRate);
  });

  test('with no manifest the rate is null, never guessed from the rows', () => {
    expect(exactlyAblatable(ATOMS_BEFORE, 'range').fullSampleRate).toBeNull();
  });
});
