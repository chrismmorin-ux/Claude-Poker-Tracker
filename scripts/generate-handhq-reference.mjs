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
 *
 * THE ROW COUNT MUST RECONCILE (WS-325). The allowlist above is a FILTER, and until the
 * MDF stack audit it was a silent one: the emitted header claimed the corpus figure
 * ("21.6M hands") while the table it stamped was built from 12.9M, because the miner's
 * `hu` (2 players) and `short` (3-5 players) buckets never survive the combine step.
 * 40.2% of the mined corpus was dropped and nothing said so, so every reader of the
 * header over-stated the evidence behind every served prior by 67%.
 *
 * `MINED_CORPUS` below declares where those rows went, and the generator ASSERTS the
 * reconciliation (table + excluded === corpus) rather than commenting it. A future
 * mining run with different totals fails here instead of shipping a header that quietly
 * stops being true.
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

/**
 * The seat-bucket boundaries the corpus was ACTUALLY mined at, from `phh_miner.py`'s
 * `table_bucket(n)`: n==2 → hu, n<=5 → short, n==6 → 6max, else full.
 *
 * Note this is NOT the boundary `poolBaseline.buildPoolIndex` uses to pick a villain's
 * bucket (`pids.length <= 6 ? 'sixMax' : 'full'`), so a villain observed at a 3-to-5-handed
 * table is served a row mined from EXACTLY-6-handed tables. Recorded here so the mismatch
 * is a readable property of the data rather than an assumption a consumer has to guess.
 */
const SEAT_BUCKET_DEFINITION = { '6max': 'dealt-in == 6', full: 'dealt-in >= 7' };

/**
 * The mined corpus and the buckets this table excludes, from the WS-262 mining report
 * (`C:\\Users\\chris\\data\\phh-mining\\out\\report.md`, 27 site×stake segments).
 * `hu` is a different game and its exclusion was always intended; `short` was not
 * documented anywhere before WS-325.
 */
const MINED_CORPUS = {
  hands: 21606087,
  excluded: {
    hu: { hands: 2977180, reason: 'heads-up (dealt-in == 2) — a different game; excluded by design' },
    short: { hands: 5701743, reason: 'short-handed (dealt-in 3-5) — mined but never combined; no row exists to serve it' },
  },
};

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

// Row-count reconciliation (WS-325). The combine step upstream already dropped `hu` and
// `short`, so this generator cannot recompute them — but it CAN refuse to emit a table
// whose declared provenance does not add up.
const excludedHands = Object.values(MINED_CORPUS.excluded).reduce((s, e) => s + e.hands, 0);
if (totalHands + excludedHands !== MINED_CORPUS.hands) {
  fail(
    `row count does not reconcile: table ${totalHands} + excluded ${excludedHands} ` +
    `!== mined corpus ${MINED_CORPUS.hands}. Either the input is from a different mining ` +
    'run, or the excluded-bucket totals in MINED_CORPUS are stale. Do not ship an ' +
    'unreconciled table.',
  );
}

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
 *   HandHQ subset of uoftcprg/phh-dataset — 6 networks, 25NL–1000NL, July 2009
 *   (docs/research/mass-pool-data-2026-07-25.md). Reference-class data (Exploit Model
 *   3-class doctrine): a yardstick, NEVER founder-observed pool data — poolBaseline
 *   blends it strictly BELOW the founder-observed pool, which overrides it as real
 *   hands accumulate.
 *
 * ROW COUNT — QUOTE \`totalHands\`, NOT THE CORPUS SIZE (WS-325). This table is built
 *   from ${totalHands.toLocaleString('en-US')} hands, not the ${MINED_CORPUS.hands.toLocaleString('en-US')} of the mined corpus.
 *   The difference is declared in \`HANDHQ_REFERENCE_META.excludedSeatBuckets\` and the
 *   generator refuses to emit a table that does not reconcile.
 *
 * BINDING RULES:
 *   - ONLINE segments only. Never served to live/* segments (domain spec, founder-
 *     ratified 2026-07-22: live and online are distinct populations, never merged).
 *   - Stake mapping is nearest-stake (founder decision 2026-07-25): mined labels are
 *     buy-in denominated (25NLH = $0.10/$0.25 blinds); micro segments below 25NL
 *     resolve to 25NL, the softest mined pool. The gap is recorded in SRC-011.
 *   - Seat buckets are mined at '6max' = EXACTLY 6 dealt in, 'full' = ≥7 — the two
 *     differ on every stat (25NL VPIP 28.6% vs 22.0%). Unknown table size → pooled
 *     counts. \`poolBaseline.buildPoolIndex\` assigns a villain to '6max' at ≤6 dealt
 *     in, so 3-to-5-handed villains are served the exactly-6 row; the 3-to-5-handed
 *     hands themselves were mined and then dropped at the combine step (they are
 *     looser: VPIP 29.7% vs 27.0%, PFR 17.7% vs 14.7% pooled across stakes).
 *   - STALENESS: July 2009 era. Self-limiting by design — per-stat prior weights
 *     (10–35 pseudocounts) keep this a deliberately weak prior that any observed
 *     data quickly overrides.
 *   - WEIGHTING: every (k, n) here is HAND-weighted (raw count sums), so multitabling
 *     regulars dominate. The WS-262 research recommends PLAYER-weighted numbers for
 *     seeding and the two differ materially (25NL 6max VPIP: 28.6% hand-weighted vs
 *     ~0.37-0.41 player-weighted). Nothing downstream records which one it received.
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
  /** Hands actually behind this table. Reconciled at generation; see excludedSeatBuckets. */
  totalHands: ${totalHands},
  /** Hands in the full mined corpus, of which this table keeps \`totalHands\`. */
  minedCorpusHands: ${MINED_CORPUS.hands},
  /** Where the difference went. totalHands + these === minedCorpusHands (asserted). */
  excludedSeatBuckets: ${JSON.stringify(MINED_CORPUS.excluded, null, 2).replace(/\n/g, '\n  ')},
  /** The boundaries the corpus was mined at — NOT the ones buildPoolIndex assigns. */
  seatBucketDefinition: ${JSON.stringify(SEAT_BUCKET_DEFINITION)},
  /** Raw count sums, so multitabling regulars dominate. See WS-262 caveat 6. */
  weighting: 'hand-weighted',
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
