#!/usr/bin/env node
/**
 * generate-handhq-reference.mjs — WS-263 codegen for the HandHQ Reference-tier pool table.
 *
 * Reads the WS-262 mining output (combined.json — pooled per-seat-bucket, per-stake
 * (k, n) count pairs) and emits src/utils/exploitEngine/handhqReferencePool.js as a
 * frozen, provenance-stamped static data module.
 *
 * Usage: node scripts/generate-handhq-reference.mjs [path/to/combined.json]
 *
 * Deterministic: fixed stake/stat/bucket ordering, no timestamps — running twice on the
 * same input produces byte-identical output, so regeneration diffs cleanly.
 *
 * Scope is an explicit allowlist (NEV-12: never blind-iterate external JSON keys):
 * only the 6max/full buckets and the six STAT_COUNT_FIELDS stats. fold_curve, barrels,
 * open3b, and river_sd are WS-264/WS-265 scope and MUST NOT land here.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const INPUT = process.argv[2] || 'C:/Users/chris/data/phh-mining/out/combined.json';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'utils', 'exploitEngine', 'handhqReferencePool.js');

// Allowlists — fixed order for deterministic output.
const SEAT_BUCKETS = ['6max', 'full'];
const STATS = ['vpip', 'pfr', 'threeBet', 'cbet', 'foldToCbet', 'foldTo3Bet'];

// Mined labels are buy-in denominated (25NL = $25 max buy-in = $0.10/$0.25 blinds).
// `canonical` matches poolBaseline.canonicalStakeLabel output for the blind pair.
const STAKE_MAP = [
  { minedLabel: '25NLH',   blinds: [0.1, 0.25], canonical: '0.1-0.25' },
  { minedLabel: '50NLH',   blinds: [0.25, 0.5], canonical: '0.25-0.5' },
  { minedLabel: '100NLH',  blinds: [0.5, 1],    canonical: '0.5-1' },
  { minedLabel: '200NLH',  blinds: [1, 2],      canonical: '1-2' },
  { minedLabel: '400NLH',  blinds: [2, 4],      canonical: '2-4' },
  { minedLabel: '600NLH',  blinds: [3, 6],      canonical: '3-6' },
  { minedLabel: '1000NLH', blinds: [5, 10],     canonical: '5-10' },
];

const fail = (msg) => { console.error(`generate-handhq-reference: ${msg}`); process.exit(1); };

const raw = JSON.parse(readFileSync(INPUT, 'utf8'));

let totalHands = 0;
const entries = STAKE_MAP.map(({ minedLabel, blinds, canonical }) => {
  const buckets = {};
  for (const bucket of SEAT_BUCKETS) {
    const src = raw[bucket]?.[minedLabel];
    if (!src) fail(`missing ${bucket}/${minedLabel} in ${INPUT}`);
    if (!Number.isFinite(src.hands) || src.hands <= 0) fail(`${bucket}/${minedLabel}: bad hands count`);
    const stats = {};
    for (const stat of STATS) {
      const c = src.stats?.[stat];
      if (!c || !Number.isFinite(c.k) || !Number.isFinite(c.n)) fail(`${bucket}/${minedLabel}/${stat}: missing (k, n)`);
      if (c.n <= 0 || c.k < 0 || c.k > c.n) fail(`${bucket}/${minedLabel}/${stat}: invalid counts k=${c.k} n=${c.n}`);
      stats[stat] = { k: c.k, n: c.n };
    }
    buckets[bucket] = { hands: src.hands, stats };
    totalHands += src.hands;
  }
  return { bb: blinds[1], canonical, minedLabel, buckets };
});

const statLines = (stats) => STATS
  .map((s) => `        ${s}: { k: ${stats[s].k}, n: ${stats[s].n} },`)
  .join('\n');

const entryLines = entries.map((e) => `  {
    bb: ${e.bb},
    canonical: '${e.canonical}',
    minedLabel: '${e.minedLabel}',
    buckets: {
${SEAT_BUCKETS.map((b) => `      '${b}': {
        hands: ${e.buckets[b].hands},
        stats: {
${statLines(e.buckets[b].stats).replace(/^ {8}/gm, '          ')}
        },
      },`).join('\n')}
    },
  },`).join('\n');

const module_ = `/**
 * handhqReferencePool.js — GENERATED, do not hand-edit.
 * Regenerate: node scripts/generate-handhq-reference.mjs
 *
 * Imported Reference-tier online pool aggregates (WS-262 mining → WS-263 import).
 *
 * PROVENANCE (2026-07-25 · WS-262/WS-263 / docs/provenance registry SRC-011):
 *   HandHQ subset of uoftcprg/phh-dataset — 21.6M real-money online NLHE cash hands,
 *   6 networks, 25NL–1000NL, July 2009 (docs/research/mass-pool-data-2026-07-25.md).
 *   Reference-class data (Exploit Model 3-class doctrine): a yardstick, NEVER
 *   founder-observed pool data — poolBaseline blends it strictly BELOW the
 *   founder-observed pool, which overrides it as real hands accumulate.
 *
 * BINDING RULES:
 *   - ONLINE segments only. Never served to live/* segments (domain spec, founder-
 *     ratified 2026-07-22: live and online are distinct populations, never merged).
 *   - Stake mapping is nearest-stake (founder decision 2026-07-25): mined labels are
 *     buy-in denominated (25NLH = $0.10/$0.25 blinds); micro segments below 25NL
 *     resolve to 25NL, the softest mined pool. The gap is recorded in SRC-011.
 *   - Seat buckets: '6max' (≤6 dealt in) vs 'full' (≥7) — the two differ on every
 *     stat (e.g. 25NL VPIP 28.6% vs 22.0%). Unknown table size → pooled counts.
 *   - STALENESS: July 2009 era. Self-limiting by design — per-stat prior weights
 *     (10–35 pseudocounts) keep this a deliberately weak prior that any observed
 *     data quickly overrides.
 *   - foldTo3Bet mirrors the app's CURRENT stat semantics (folds facing ANY preflop
 *     raise — the WS-236/WS-254 definitional quirk). If WS-254 changes the app
 *     definition, re-mine with matched semantics and regenerate.
 */

const deepFreeze = (obj) => {
  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object') deepFreeze(v);
  }
  return Object.freeze(obj);
};

export const HANDHQ_REFERENCE_META = deepFreeze({
  sourceId: 'SRC-011',
  corpus: 'HandHQ pooled online NLHE cash (uoftcprg/phh-dataset), 6 networks, July 2009',
  totalHands: ${totalHands},
  research: 'docs/research/mass-pool-data-2026-07-25.md',
  generator: 'scripts/generate-handhq-reference.mjs',
});

/** Ascending by big blind — nearest-stake resolution scans this order (ties → lower). */
export const HANDHQ_REFERENCE_STAKES = deepFreeze([
${entryLines}
]);
`;

writeFileSync(OUT, module_, 'utf8');
console.log(`wrote ${OUT} (${entries.length} stakes × ${SEAT_BUCKETS.length} buckets, ${totalHands} hands)`);
