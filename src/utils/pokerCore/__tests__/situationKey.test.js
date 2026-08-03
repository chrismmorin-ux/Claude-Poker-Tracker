/**
 * situationKey.test.js — WS-317 (FSA Phase 1).
 *
 * Two jobs. The first half tests the module. The second half tests the CODEBASE — it fails
 * if anyone reintroduces positional parsing of a situation key anywhere in src/ or scripts/.
 * That kind of test is usually a smell, but here the positional read IS the defect being
 * fixed: fourteen call sites each independently knew that contextAction lived at index 6,
 * and one of them (heroAnalysis) had silently been reading isAgg while calling it an action
 * type for as long as it existed. A module nobody is required to use would not have stopped
 * that, and would not stop the next one.
 */

import { describe, test, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  IDENTITY_AXES,
  HERO_AXES,
  HERO_AXIS,
  HAND_AXIS,
  CARRIED_AXES,
  SituationKeyError,
  formatSituationKey,
  parseSituationKey,
  tryParseSituationKey,
  axisOf,
  isStreet,
  withCarriedContext,
} from '../situationKey';

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), '../../../..');

const VILLAIN_FIELDS = {
  street: 'flop',
  texture: 'dry',
  posCategory: 'LATE',
  isAgg: 'agg',
  isIP: 'ip',
  facingAction: 'check',
  contextAction: 'cbet',
};
const VILLAIN_KEY = 'flop:dry:LATE:agg:ip:check:cbet';
const HERO_KEY = 'flop:dry:LATE:agg:ip:check:cbet:pfc';

describe('wire format is frozen', () => {
  // heroLeaks persists these strings inside a COMPOSITE PRIMARY KEY [playerId, situationKey]
  // (IDB v22). Changing the separator, the axis order, or the arity silently orphans every
  // stored leak — there is no migration that can recover a key whose meaning moved.
  test('7-axis villain key serializes exactly as before WS-317', () => {
    expect(formatSituationKey(VILLAIN_FIELDS)).toBe(VILLAIN_KEY);
  });

  test('8-axis hero key serializes exactly as before WS-317', () => {
    expect(formatSituationKey({ ...VILLAIN_FIELDS, preflopAggressor: 'pfc' })).toBe(HERO_KEY);
  });

  test('axis order is the documented order', () => {
    expect(IDENTITY_AXES).toEqual([
      'street', 'texture', 'posCategory', 'isAgg', 'isIP', 'facingAction', 'contextAction',
    ]);
    expect(HERO_AXES[HERO_AXES.length - 1]).toBe(HERO_AXIS);
  });

  test('round-trips both arities', () => {
    for (const key of [VILLAIN_KEY, HERO_KEY]) {
      const parsed = parseSituationKey(key);
      expect(formatSituationKey(parsed)).toBe(key);
    }
  });

  // ── WS-323: HAND_AXIS is matchable, never keyed ────────────────────────────────────────
  //
  // The Entry Map needs a card to be able to say "AKo", which required a new axis. The whole
  // safety of that addition rests on it staying OUT of the wire format: the moment a holding
  // reaches the serialized key, every stored heroLeaks row under [playerId, situationKey] is
  // orphaned. These three tests are what make that a checked property rather than a promise.
  test('handClass is absent from both identity axis lists', () => {
    expect(IDENTITY_AXES).not.toContain(HAND_AXIS);
    expect(HERO_AXES).not.toContain(HAND_AXIS);
    expect(CARRIED_AXES).not.toContain(HAND_AXIS);
  });

  test('supplying a handClass does NOT change the serialized key', () => {
    expect(formatSituationKey({ ...VILLAIN_FIELDS, [HAND_AXIS]: 'AKo' })).toBe(VILLAIN_KEY);
    expect(formatSituationKey({ ...VILLAIN_FIELDS, preflopAggressor: 'pfc', [HAND_AXIS]: 'AKo' }))
      .toBe(HERO_KEY);
  });

  test('withCarriedContext does not attach a handClass', () => {
    const ctx = withCarriedContext(VILLAIN_KEY, { [HAND_AXIS]: 'AKo', sprBand: 'mid' });
    expect(ctx).not.toHaveProperty(HAND_AXIS);
    expect(ctx.sprBand).toBe('mid');
  });
});

describe('parsing distinguishes arity instead of guessing', () => {
  test('villain key reports arity 7 and a NULL hero axis', () => {
    const k = parseSituationKey(VILLAIN_KEY);
    expect(k.arity).toBe(7);
    // null, not undefined: "absent because villain-side" must be distinguishable from
    // "you asked for an axis that does not exist".
    expect(k[HERO_AXIS]).toBeNull();
  });

  test('hero key reports arity 8 and the hero axis', () => {
    const k = parseSituationKey(HERO_KEY);
    expect(k.arity).toBe(8);
    expect(k[HERO_AXIS]).toBe('pfc');
  });

  test('every axis lands on its own name, both arities', () => {
    for (const key of [VILLAIN_KEY, HERO_KEY]) {
      const k = parseSituationKey(key);
      expect(k.street).toBe('flop');
      expect(k.texture).toBe('dry');
      expect(k.posCategory).toBe('LATE');
      expect(k.isAgg).toBe('agg');
      expect(k.isIP).toBe('ip');
      expect(k.facingAction).toBe('check');
      expect(k.contextAction).toBe('cbet');
    }
  });

  test('malformed keys THROW rather than returning a partly-undefined object', () => {
    // `split(':')[6] || 'unknown'` propagated bad keys far from their cause. A wrong-arity
    // key is a producer bug and should surface where it is produced.
    for (const bad of ['', 'flop', 'a:b:c:d:e:f', 'a:b:c:d:e:f:g:h:i', null, undefined, 42]) {
      expect(() => parseSituationKey(bad)).toThrow(SituationKeyError);
    }
  });

  test('tryParse returns null instead of throwing', () => {
    expect(tryParseSituationKey('nope')).toBeNull();
    expect(tryParseSituationKey(HERO_KEY)).not.toBeNull();
  });
});

describe('axisOf replaces indexing', () => {
  test('reads any identity axis by name on both arities', () => {
    for (const key of [VILLAIN_KEY, HERO_KEY]) {
      expect(axisOf(key, 'contextAction')).toBe('cbet');
      expect(axisOf(key, 'isAgg')).toBe('agg');
    }
  });

  test('hero axis falls back on a villain key, resolves on a hero key', () => {
    expect(axisOf(VILLAIN_KEY, HERO_AXIS, 'none')).toBe('none');
    expect(axisOf(HERO_KEY, HERO_AXIS, 'none')).toBe('pfc');
  });

  test('an unknown axis name throws — a typo must not read as a fallback', () => {
    expect(() => axisOf(VILLAIN_KEY, 'contextaction')).toThrow(SituationKeyError);
    expect(() => axisOf(VILLAIN_KEY, 'sprBand')).toThrow(SituationKeyError);
  });

  test('isStreet replaces prefix matching, including the near-miss case', () => {
    expect(isStreet(VILLAIN_KEY, 'flop')).toBe(true);
    expect(isStreet(VILLAIN_KEY, 'turn')).toBe(false);
    // `startsWith('flo:')`-style partial matches must not pass.
    expect(isStreet(VILLAIN_KEY, 'flo')).toBe(false);
  });
});

describe('carrying is not keying', () => {
  test('carried axes are NOT part of the serialized identity', () => {
    // The whole point: adding provenance or SPR to a decision must not re-partition
    // historical buckets. If this ever fails, every measured number moved.
    const withExtras = formatSituationKey({
      ...VILLAIN_FIELDS,
      sprBand: 'deep', playersRemaining: 3, source: 'SRC-014', pool: 'live-1-3',
    });
    expect(withExtras).toBe(VILLAIN_KEY);
  });

  test('carried context travels beside the key, fully populated', () => {
    const ctx = withCarriedContext(VILLAIN_KEY, { sprBand: 'deep', source: 'SRC-014' });
    expect(ctx.situationKey).toBe(VILLAIN_KEY);
    expect(ctx.sprBand).toBe('deep');
    expect(ctx.source).toBe('SRC-014');
    // Unsupplied carried axes are explicitly null, so "not recorded" is visible rather
    // than the field simply being missing.
    expect(ctx.playersRemaining).toBeNull();
    expect(ctx.pool).toBeNull();
    for (const axis of CARRIED_AXES) expect(axis in ctx).toBe(true);
  });

  test('a mixed-source aggregate can report its own composition — no external bookkeeping', () => {
    // WS-317's provenance acceptance criterion, and the promoted registry's row-grain rule
    // made executable: source travels ON the row, so an aggregate built from several sources
    // can state its own mix without anyone having tracked it alongside.
    //
    // SCAFFOLDING, HONESTLY LABELLED: this proves the CONTRACT. No production path calls
    // withCarriedContext yet — wiring one is the first task of the next phase, and until
    // then this capability is inert. Saying so here rather than letting it be discovered.
    const rows = [
      withCarriedContext(VILLAIN_KEY, { source: 'SRC-012', pool: 'online-50nl-2009' }),
      withCarriedContext(VILLAIN_KEY, { source: 'SRC-012', pool: 'online-50nl-2009' }),
      withCarriedContext(VILLAIN_KEY, { source: 'SRC-014', pool: 'live-1-3' }),
    ];

    // The aggregation: same bucket identity for all three (source is NOT in the key), so
    // they group together — which is the point. A bucket must not fragment by where its
    // evidence came from, or cross-source comparison is impossible by construction.
    const bucketIds = new Set(rows.map((r) => r.situationKey));
    expect(bucketIds.size).toBe(1);

    const composition = rows.reduce((acc, r) => {
      acc[r.source] = (acc[r.source] || 0) + 1;
      return acc;
    }, {});
    expect(composition).toEqual({ 'SRC-012': 2, 'SRC-014': 1 });

    // And the scope question the registry cares about: is this aggregate admissible as
    // evidence about live play? Answerable from the rows alone.
    const liveShare = rows.filter((r) => r.pool === 'live-1-3').length / rows.length;
    expect(liveShare).toBeCloseTo(1 / 3, 10);
  });

  test('a carried axis can be added without any reader changing', () => {
    // The acceptance criterion, made executable: readers destructure by name, so an
    // unknown extra field is inert to all of them.
    const ctx = withCarriedContext(HERO_KEY, { sprBand: 'shallow' });
    const asIfNewAxisExisted = { ...ctx, tableSize: 6 };
    expect(parseSituationKey(asIfNewAxisExisted.situationKey).contextAction).toBe('cbet');
    expect(formatSituationKey(parseSituationKey(asIfNewAxisExisted.situationKey))).toBe(HERO_KEY);
  });
});

// ============================================================================
// The codebase guard.
// ============================================================================

const SCAN_DIRS = ['src', 'scripts'];
const SKIP_FILE = 'situationKey.js';

/** Recursively collect .js/.mjs source files, excluding tests. */
const collectSources = (dir, out = []) => {
  const abs = path.join(REPO_ROOT, dir);
  if (!fs.existsSync(abs)) return out;
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
      collectSources(rel, out);
    } else if (/\.(js|mjs)$/.test(entry.name)
      && !/\.test\.(js|mjs)$/.test(entry.name)
      && entry.name !== SKIP_FILE) {
      out.push(rel);
    }
  }
  return out;
};

describe('no source file parses a situation key positionally (WS-317)', () => {
  const files = collectSources(SCAN_DIRS[0]).concat(collectSources(SCAN_DIRS[1]));

  test('the scan actually found files (guard against a silently empty test)', () => {
    // A codebase check that matches nothing passes vacuously and reads as a green light.
    expect(files.length).toBeGreaterThan(100);
  });

  test('no positional destructure of a colon-split', () => {
    // Deliberately NOT keyed on the variable being named `situationKey`. The first draft of
    // this guard matched only `situationKey|sk|key`.split(':') and MISSED two live sites in
    // handSignificance.js that used `hk` and `vk` — both carrying the same isAgg-named-as-
    // action defect. A guard that only catches the naming convention you thought of is a
    // guard that agrees with you. Match the SHAPE instead: a colon-split destructured into
    // an array pattern is a positional read regardless of what the variable is called.
    //
    // Other colon-delimited strings exist (composite ids, numeric pairs), so a line may opt
    // out with the marker `not-a-situation-key` on it or the line above. The opt-out is
    // explicit and greppable ON PURPOSE: narrowing the pattern to avoid false positives is
    // exactly the move that let the two handSignificance sites through. Make someone assert
    // it, rather than quietly agreeing it is fine.
    const OPT_OUT = 'not-a-situation-key';
    const offenders = [];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return; // comments may quote the old form
        const destructured = /\[[^\]]*\]\s*=\s*[\w.?[\]]+\s*\.split\(\s*['"]:['"]\s*\)/.test(line);
        const indexed = /\.split\(\s*['"]:['"]\s*\)\s*\[\s*\d+\s*\]/.test(line);
        const sliced = /\.split\(\s*['"]:['"]\s*\)\s*\.slice\(/.test(line);
        if (!(destructured || indexed || sliced)) return;
        if (line.includes(OPT_OUT) || (lines[i - 1] || '').includes(OPT_OUT)) return;
        offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });

  test('no situation-key-named variable is colon-split at all', () => {
    const offenders = [];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        if (/situation_?[Kk]ey\w*\s*\.split\(\s*['"]:['"]\s*\)/.test(line)) {
          offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });

  test('no street prefix-matching on a situation key', () => {
    const STREETS = ['preflop', 'flop', 'turn', 'river'];
    const offenders = [];
    for (const rel of files) {
      const src = fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
      src.split('\n').forEach((line, i) => {
        if (/^\s*(\/\/|\*)/.test(line)) return;
        const literal = STREETS.some((s) => line.includes(`startsWith('${s}:')`) || line.includes(`startsWith("${s}:")`));
        const composed = /startsWith\(\s*\w+\s*\+\s*['"]:['"]\s*\)/.test(line);
        if (literal || composed) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(offenders).toEqual([]);
  });
});
