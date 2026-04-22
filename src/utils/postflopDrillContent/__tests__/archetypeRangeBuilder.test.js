import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ARCHETYPE_BUCKET_MULTIPLIERS,
  listKnownArchetypes,
  isKnownArchetype,
  buildArchetypeWeightedRange,
  aggregateBucketWeights,
} from '../archetypeRangeBuilder';
import { parseRangeString } from '../../pokerCore/rangeMatrix';
import { parseBoard } from '../../pokerCore/cardParser';
import { archetypeRangeFor } from '../archetypeRanges';

const flop = (...cards) => parseBoard(cards);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DRILL_CONTENT_ROOT = path.resolve(__dirname, '..');
const DRILL_CONTENT_GLOBAL_ROOT = path.resolve(__dirname, '..', '..', 'drillContent');

describe('ARCHETYPE_BUCKET_MULTIPLIERS — structure', () => {
  it('covers fish, reg, pro (v1)', () => {
    expect(listKnownArchetypes().sort()).toEqual(['fish', 'pro', 'reg']);
  });

  it('every archetype has a multiplier for every segmenter bucket', () => {
    const buckets = ['nuts', 'strong', 'marginal', 'draw', 'air'];
    for (const a of listKnownArchetypes()) {
      for (const b of buckets) {
        expect(ARCHETYPE_BUCKET_MULTIPLIERS[a][b]).toBeTypeOf('number');
      }
    }
  });

  it('reg is the identity baseline (all multipliers = 1.0)', () => {
    const reg = ARCHETYPE_BUCKET_MULTIPLIERS.reg;
    for (const b of Object.keys(reg)) expect(reg[b]).toBe(1.0);
  });

  it('fish up-weights strong/marginal relative to reg', () => {
    expect(ARCHETYPE_BUCKET_MULTIPLIERS.fish.strong).toBeGreaterThan(ARCHETYPE_BUCKET_MULTIPLIERS.reg.strong);
    expect(ARCHETYPE_BUCKET_MULTIPLIERS.fish.marginal).toBeGreaterThan(ARCHETYPE_BUCKET_MULTIPLIERS.reg.marginal);
  });

  it('pro under-weights marginal + over-weights draws/air relative to reg', () => {
    expect(ARCHETYPE_BUCKET_MULTIPLIERS.pro.marginal).toBeLessThan(ARCHETYPE_BUCKET_MULTIPLIERS.reg.marginal);
    expect(ARCHETYPE_BUCKET_MULTIPLIERS.pro.draw).toBeGreaterThan(ARCHETYPE_BUCKET_MULTIPLIERS.reg.draw);
    expect(ARCHETYPE_BUCKET_MULTIPLIERS.pro.air).toBeGreaterThan(ARCHETYPE_BUCKET_MULTIPLIERS.reg.air);
  });

  it('tables are frozen', () => {
    for (const a of listKnownArchetypes()) {
      expect(Object.isFrozen(ARCHETYPE_BUCKET_MULTIPLIERS[a])).toBe(true);
    }
    expect(Object.isFrozen(ARCHETYPE_BUCKET_MULTIPLIERS)).toBe(true);
  });
});

describe('isKnownArchetype', () => {
  it('accepts known archetype strings', () => {
    expect(isKnownArchetype('fish')).toBe(true);
    expect(isKnownArchetype('reg')).toBe(true);
    expect(isKnownArchetype('pro')).toBe(true);
  });
  it('rejects unknowns and non-strings', () => {
    expect(isKnownArchetype('whale')).toBe(false);
    expect(isKnownArchetype('')).toBe(false);
    expect(isKnownArchetype(null)).toBe(false);
    expect(isKnownArchetype(42)).toBe(false);
  });
});

describe('buildArchetypeWeightedRange — error paths', () => {
  it('throws on unknown archetype', () => {
    const range = parseRangeString('AA');
    expect(() => buildArchetypeWeightedRange({
      archetype: 'whale',
      baseRange: range,
      board: flop('K♠', '7♥', '2♦'),
    })).toThrow(/unknown archetype/);
  });

  it('throws on invalid board', () => {
    const range = parseRangeString('AA');
    expect(() => buildArchetypeWeightedRange({
      archetype: 'fish',
      baseRange: range,
      board: [],
    })).toThrow(/3-5 encoded cards/);
  });
});

describe('buildArchetypeWeightedRange — reweight semantics', () => {
  it('reg reweighting preserves total weight (identity baseline)', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const board = flop('K♠', '7♥', '2♦');
    const reg = buildArchetypeWeightedRange({ archetype: 'reg', baseRange: range, board });
    // Reg has all 1.0 multipliers, so total weight after reweighting should
    // equal the pre-reweight total weight.
    const baselineWeight = reg.combos.reduce((s, c) => s + c.weight, 0);
    expect(reg.totalWeight).toBeCloseTo(baselineWeight, 6);
  });

  it('fish has higher strong+marginal weight than reg on same board + range', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const board = flop('K♠', '7♥', '2♦');
    const reg = buildArchetypeWeightedRange({ archetype: 'reg', baseRange: range, board });
    const fish = buildArchetypeWeightedRange({ archetype: 'fish', baseRange: range, board });
    const regAgg = aggregateBucketWeights(reg);
    const fishAgg = aggregateBucketWeights(fish);
    const regStrongMarginal = (regAgg.strong || 0) + (regAgg.marginal || 0);
    const fishStrongMarginal = (fishAgg.strong || 0) + (fishAgg.marginal || 0);
    expect(fishStrongMarginal).toBeGreaterThan(regStrongMarginal);
  });

  it('pro has higher draw+air weight than reg on same board + range', () => {
    const range = archetypeRangeFor({ position: 'BTN', action: 'open' });
    const board = flop('T♥', '9♥', '6♠'); // lots of draws on this board
    const reg = buildArchetypeWeightedRange({ archetype: 'reg', baseRange: range, board });
    const pro = buildArchetypeWeightedRange({ archetype: 'pro', baseRange: range, board });
    const regAgg = aggregateBucketWeights(reg);
    const proAgg = aggregateBucketWeights(pro);
    const regDrawAir = (regAgg.draw || 0) + (regAgg.air || 0);
    const proDrawAir = (proAgg.draw || 0) + (proAgg.air || 0);
    expect(proDrawAir).toBeGreaterThan(regDrawAir);
  });

  it('combos carry bucket + handType for downstream consumers', () => {
    const range = parseRangeString('AA');
    const out = buildArchetypeWeightedRange({
      archetype: 'fish',
      baseRange: range,
      board: flop('K♠', '7♥', '2♦'),
    });
    expect(out.combos.length).toBe(6); // AA × 6 combos
    for (const c of out.combos) {
      expect(c.bucket).toBeTruthy();
      expect(c.handType).toBeTruthy();
    }
  });

  it('multipliers field on the return value matches the declared table', () => {
    const range = parseRangeString('AA');
    const out = buildArchetypeWeightedRange({
      archetype: 'fish',
      baseRange: range,
      board: flop('K♠', '7♥', '2♦'),
    });
    expect(out.multipliers).toEqual(ARCHETYPE_BUCKET_MULTIPLIERS.fish);
  });
});

// =============================================================================
// RT-112 linter test — NEV-03 prevention
// =============================================================================
//
// Scans every `.js` file in postflopDrillContent/ + drillContent/ (excluding
// this module and __tests__/) for direct `archetype === 'literal'` or
// `archetype == 'literal'` comparisons. Such patterns would branch on the
// archetype label as a decision input, violating the first-principles rule
// that archetype must flow through table-lookup multipliers only.
//
// archetypeRangeBuilder.js is the legal home of archetype-keyed logic and is
// explicitly exempted.

const FORBIDDEN_PATTERN = /\barchetype\s*={2,3}\s*['"`]/;

const scanDir = (dir) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (name === '__tests__' || name === '__snapshots__') continue;
      out.push(...scanDir(full));
    } else if (name.endsWith('.js') || name.endsWith('.jsx')) {
      out.push(full);
    }
  }
  return out;
};

describe('RT-112 linter — archetype as table-key not decision-branch', () => {
  it('postflopDrillContent and drillContent have no `archetype === "literal"` comparisons outside archetypeRangeBuilder', () => {
    const files = [...scanDir(DRILL_CONTENT_ROOT), ...scanDir(DRILL_CONTENT_GLOBAL_ROOT)];
    const violations = [];
    for (const f of files) {
      if (path.basename(f) === 'archetypeRangeBuilder.js') continue; // legal home
      const src = fs.readFileSync(f, 'utf-8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (FORBIDDEN_PATTERN.test(line)) {
          violations.push(`${path.relative(DRILL_CONTENT_ROOT, f)}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    if (violations.length > 0) {
      console.error('[RT-112] archetype-as-decision violations:\n' + violations.join('\n'));
    }
    expect(violations).toEqual([]);
  });
});
