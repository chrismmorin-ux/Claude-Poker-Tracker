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
 *
 * TWO DIFFERENT FOLD QUANTITIES ARE EMITTED, UNDER NAMES THAT CANNOT BE SWAPPED (WS-371).
 *
 *   `stats.foldTo3Bet`            P(fold | a raise preceded this seat's FIRST preflop
 *                                 action). Denominator `facedRaisePreflop`. Mostly
 *                                 fold-to-an-OPEN. This is what the app computes and what
 *                                 the name misdescribes.
 *   `HANDHQ_OPENER_FACING_3BET`   P(fold | this seat RAISED and was then 3-bet).
 *                                 Denominator = opens that faced a 3-bet. The quantity the
 *                                 name `foldTo3Bet` claims.
 *
 * On the same corpus and the same seat buckets they read 82.3% and 48.4% — a 33.9pp gap.
 * The generator ASSERTS the signature of the broad one (`foldTo3Bet.n === threeBet.n`,
 * true in all 14 rows because both count the same opportunity) so that a re-mine which
 * changes the semantics fails here rather than silently redefining every consumer.
 *
 * It also emits the miner's directly measured BETWEEN-PLAYER mean and sd for three of the
 * stats. Detectors judge one player, so a detector threshold has to be derived against the
 * distribution over PLAYERS, not against the hand-weighted table mean (in which multitabling
 * regulars dominate).
 *
 *   `HANDHQ_FOLD_VS_PREFLOP_RAISE_SPREAD`  foldTo3Bet   (WS-371)
 *   `HANDHQ_THREE_BET_SPREAD`              threeBet     (WS-376)
 *   `HANDHQ_FOLD_TO_CBET_SPREAD`           foldToCbet   (WS-376)
 *
 * All three come from the SAME `overdispersion` block that was already mined, pooled by the
 * SAME `poolSpread` routine — so WS-376 needed no re-mine, and the fact that re-running
 * `poolSpread` over `foldTo3Bet` still reproduces WS-371's published 72.95/79.80 is the
 * check that the other two are on the same footing.
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const INPUT = process.argv[2] || 'C:/Users/chris/data/phh-mining/out/combined.json';
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'utils', 'exploitEngine', 'handhqReferencePool.js');

// Allowlists — fixed order for deterministic output.
const SEAT_BUCKETS = ['6max', 'full'];
const STATS = ['vpip', 'pfr', 'threeBet', 'cbet', 'foldToCbet', 'foldTo3Bet'];

/**
 * The stats whose BETWEEN-PLAYER spread is emitted (WS-371 for the first, WS-376 for the
 * other two). Every stat in `STATS` carries an `overdispersion` block in the per-site files;
 * only the ones a detector threshold is derived from are emitted, so that adding an export
 * here is a deliberate edit rather than a blind fan-out over external JSON keys (NEV-12).
 */
const SPREAD_STATS = ['foldTo3Bet', 'threeBet', 'foldToCbet'];

/**
 * The conditioning set of every emitted stat, as DATA rather than prose (WS-371).
 *
 * A rate without its conditioning set is not a number anyone can act on: 82.3% and 48.4%
 * are both true of these same hands and these same players and differ only in what was
 * conditioned on. `foldTo3Bet` is the one whose key does not match its conditional, and it
 * is kept only because `poolBaseline.STAT_COUNT_FIELDS` binds to that key; consumers read
 * it through `preflopFoldQuantities.js`, which names it correctly.
 */
const STAT_CONDITIONING = {
  vpip: 'dealt in preflop',
  pfr: 'dealt in preflop',
  threeBet: 'a raise preceded this seat\'s first preflop action',
  cbet: 'was preflop aggressor and saw the flop',
  foldToCbet: 'faced a flop c-bet',
  foldTo3Bet: 'a raise preceded this seat\'s first preflop action — NOT "was 3-bet". '
    + 'Denominator is facedRaisePreflop, so this is fold-vs-ANY-preflop-raise and is '
    + 'dominated by folding to an open. For fold-vs-3-bet see HANDHQ_OPENER_FACING_3BET.',
};

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

// ---------------------------------------------------------------------------
// The definitional signature of the BROAD fold quantity (WS-371).
//
// `threeBet` and `foldTo3Bet` are the two branches of ONE opportunity — "a raise preceded
// this seat's first preflop action" — so they share a denominator exactly. That equality
// is the machine-checkable statement of what `foldTo3Bet` actually measures. If a re-mine
// ever breaks it, the semantics changed and every consumer needs re-auditing, so fail here
// rather than ship a table whose rows quietly mean something new.
// ---------------------------------------------------------------------------
for (const e of entries) {
  for (const bucket of SEAT_BUCKETS) {
    const s = e.buckets[bucket].stats;
    if (s.foldTo3Bet.n !== s.threeBet.n) {
      fail(
        `${bucket}/${e.minedLabel}: foldTo3Bet.n (${s.foldTo3Bet.n}) !== threeBet.n (${s.threeBet.n}). `
        + 'These share the facedRaisePreflop denominator by construction. A difference means the '
        + 'miner changed the foldTo3Bet conditioning set — re-audit weaknessDetector, '
        + 'villainObservations, preflopFoldResolver and poolBaseline before regenerating.',
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Per-site families the combine step does not carry per seat bucket (WS-371).
//
// `combined.json` holds `open3b` only corpus-wide, i.e. pooled across ALL dealt-in counts
// including the `hu` and `short` buckets this table excludes — so quoting it beside these
// rows would repeat the WS-325 scope error in a new place. The per-site files DO carry
// `open3b` and `overdispersion` per seat bucket, and their per-stat (k, n) reconcile
// EXACTLY with `combined.json`, which is asserted below before either family is used.
// ---------------------------------------------------------------------------
const MINED_LABELS = STAKE_MAP.map((s) => s.minedLabel);
const siteFileRe = new RegExp(`^[A-Z]+-(${MINED_LABELS.join('|')})\\.json$`);
const siteFiles = readdirSync(dirname(INPUT)).filter((f) => siteFileRe.test(f)).sort();
if (!siteFiles.length) fail(`no per-site mining files (SITE-<stake>.json) beside ${INPUT}`);

const zeroNarrow = () => ({ n: 0, fold: 0, call: 0, fourBet: 0 });
const narrow = Object.fromEntries(SEAT_BUCKETS.map((b) => [b, zeroNarrow()]));
const spreadRows = Object.fromEntries(
  SPREAD_STATS.map((s) => [s, Object.fromEntries(SEAT_BUCKETS.map((b) => [b, []]))]),
);
const siteCheck = {}; // `${bucket}/${label}` → { hands, stats: { stat: {k, n} } }

for (const file of siteFiles) {
  const label = file.replace(/^[A-Z]+-/, '').replace(/\.json$/, '');
  const site = JSON.parse(readFileSync(join(dirname(INPUT), file), 'utf8'));
  for (const bucket of SEAT_BUCKETS) {
    const v = site[bucket];
    if (!v) continue;
    const key = `${bucket}/${label}`;
    const acc = siteCheck[key] || (siteCheck[key] = { hands: 0, stats: Object.fromEntries(STATS.map((s) => [s, { k: 0, n: 0 }])) });
    acc.hands += v.hands || 0;
    for (const stat of STATS) {
      const c = v.stats?.[stat];
      if (c) { acc.stats[stat].k += c.k; acc.stats[stat].n += c.n; }
    }
    const o3 = v.open3b;
    if (o3) {
      narrow[bucket].n += o3.open_faced_3bet || 0;
      narrow[bucket].fold += o3.fold || 0;
      narrow[bucket].call += o3.call || 0;
      narrow[bucket].fourBet += o3.fourbet || 0;
    }
    for (const stat of SPREAD_STATS) {
      const od = v.overdispersion?.[stat];
      if (od && od.players > 0) spreadRows[stat][bucket].push(od);
    }
  }
}

// Scope check: the per-site sums must BE the table, or the two families below describe a
// different population than the rows they ship beside.
for (const e of entries) {
  for (const bucket of SEAT_BUCKETS) {
    const acc = siteCheck[`${bucket}/${e.minedLabel}`];
    if (!acc) fail(`per-site files carry no ${bucket}/${e.minedLabel}; cannot verify scope`);
    if (acc.hands !== e.buckets[bucket].hands) {
      fail(`${bucket}/${e.minedLabel}: per-site hands ${acc.hands} !== combined ${e.buckets[bucket].hands}`);
    }
    for (const stat of STATS) {
      const a = acc.stats[stat];
      const c = e.buckets[bucket].stats[stat];
      if (a.k !== c.k || a.n !== c.n) {
        fail(`${bucket}/${e.minedLabel}/${stat}: per-site (${a.k}, ${a.n}) !== combined (${c.k}, ${c.n})`);
      }
    }
  }
}

for (const bucket of SEAT_BUCKETS) {
  if (narrow[bucket].n <= 0) fail(`${bucket}: no open3b (opener-facing-3bet) observations`);
  for (const stat of SPREAD_STATS) {
    if (!spreadRows[stat][bucket].length) fail(`${bucket}: no overdispersion.${stat} segments`);
  }
}

/**
 * Pool per-segment between-player moments by the law of total variance, weighted by the
 * player count each segment measured. Within-segment spread plus the spread BETWEEN
 * segment means — dropping the second term would understate the field.
 */
const poolSpread = (rows) => {
  const players = rows.reduce((s, r) => s + r.players, 0);
  const mean = rows.reduce((s, r) => s + r.players * r.mean, 0) / players;
  const variance = rows.reduce((s, r) => s + r.players * (r.sd_between ** 2 + (r.mean - mean) ** 2), 0) / players;
  return { players, mean, sdBetween: Math.sqrt(variance) };
};
const round6 = (x) => Math.round(x * 1e6) / 1e6;
const spread = Object.fromEntries(SPREAD_STATS.map((stat) => [stat, Object.fromEntries(
  SEAT_BUCKETS.map((b) => {
    const p = poolSpread(spreadRows[stat][b]);
    return [b, {
      players: p.players,
      mean: round6(p.mean),
      sdBetween: round6(p.sdBetween),
      segments: spreadRows[stat][b].length,
    }];
  }),
)]));

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
 *   - \`stats.foldTo3Bet\` IS NOT FOLD-TO-A-3-BET (WS-236/WS-254/WS-371). It mirrors the
 *     app's stat, whose denominator is \`facedRaisePreflop\`, so it answers "how often does
 *     this seat fold when a raise is already in front of them" — mostly folding to an OPEN.
 *     The key survives only because \`poolBaseline.STAT_COUNT_FIELDS\` binds to it; read it
 *     through \`preflopFoldQuantities.js\`, never by that name. The quantity the name claims
 *     is \`HANDHQ_OPENER_FACING_3BET\` below, and the two differ by 33.9pp on these very
 *     hands (82.3% vs 48.4%). Every conditioning set is declared in
 *     \`HANDHQ_REFERENCE_META.statConditioning\`.
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
  /**
   * What each stat is CONDITIONED ON (WS-371). A rate without its conditioning set is not
   * a number anyone can act on, and one of these keys does not match its own conditional.
   */
  statConditioning: ${JSON.stringify(STAT_CONDITIONING, null, 2).replace(/\n/g, '\n  ')},
  research: 'docs/research/mass-pool-data-2026-07-25.md',
  generator: 'scripts/generate-handhq-reference.mjs',
});

/**
 * FOLD VS A 3-BET, AFTER THIS SEAT OPENED — the quantity \`stats.foldTo3Bet\` is named for
 * and does not measure (WS-371).
 *
 * Conditioning set: this seat RAISED preflop and a later seat 3-bet them. Denominator is
 * that opportunity, not \`facedRaisePreflop\`. Same corpus, same 6max/full seat buckets and
 * same 27 site x stake segments as the rows above, so the two are directly comparable:
 *
 *     fold vs any preflop raise   22,867,051 / 27,800,827 = 82.3%   (stats.foldTo3Bet)
 *     fold vs a 3-bet after open     609,756 /  1,260,802 = 48.4%   (this export)
 *
 * A 33.9pp gap on identical hands, differing only in what was conditioned on. Anything
 * priced against the first number as though it were the second is pricing fold equity that
 * is not there.
 *
 * \`residual\` is opens that faced a 3-bet and resolved without a recorded fold/call/4-bet
 * (opener already all-in, or a truncated hand). Declared rather than silently folded into
 * a denominator.
 *
 * NOT PER STAKE by design here: the per-stake cells are thin enough at the top stakes
 * (n = 19,840 at 600NL full) that they would invite over-reading, and no consumer resolves
 * this quantity per stake today. The spread is real and recorded: 6max runs 41.6% (25NL) to
 * 55.4% (1000NL).
 *
 * ONLINE 2009. A live 9-handed 1/2-1/3 reading taken from this is TRANSFERRED, not measured.
 */
export const HANDHQ_OPENER_FACING_3BET = deepFreeze({
  conditioning: 'this seat raised preflop, then faced a 3-bet',
  /** No app-side counter produces this yet — \`extract3BetStats\` does not split it out. */
  appStatField: null,
  seatBuckets: ${JSON.stringify(
    Object.fromEntries(SEAT_BUCKETS.map((b) => [b, {
      n: narrow[b].n,
      fold: narrow[b].fold,
      call: narrow[b].call,
      fourBet: narrow[b].fourBet,
      residual: narrow[b].n - narrow[b].fold - narrow[b].call - narrow[b].fourBet,
    }])),
    null,
    2,
  ).replace(/\n/g, '\n  ')},
  pooled: ${JSON.stringify({
    n: SEAT_BUCKETS.reduce((s, b) => s + narrow[b].n, 0),
    fold: SEAT_BUCKETS.reduce((s, b) => s + narrow[b].fold, 0),
    call: SEAT_BUCKETS.reduce((s, b) => s + narrow[b].call, 0),
    fourBet: SEAT_BUCKETS.reduce((s, b) => s + narrow[b].fourBet, 0),
    residual: SEAT_BUCKETS.reduce((s, b) => s + (narrow[b].n - narrow[b].fold - narrow[b].call - narrow[b].fourBet), 0),
  }, null, 2).replace(/\n/g, '\n  ')},
});

/**
 * BETWEEN-PLAYER distribution of \`stats.foldTo3Bet\` — measured, not derived (WS-371).
 *
 * From the miner's own \`overdispersion\` block: for every site x stake x seat bucket it
 * recorded the mean and standard deviation ACROSS PLAYERS with n >= 30 preflop
 * opportunities. Pooled here by the law of total variance, weighted by player count.
 *
 * WHY A DETECTOR MUST USE THIS AND NOT THE TABLE MEAN. The rows above are hand-weighted,
 * so a multitabling regular counts thousands of times and one recreational player once.
 * A weakness rule judges ONE PLAYER, so the question "is this player unusual" has to be
 * asked against the distribution over players. The two means differ materially — 82.3%
 * hand-weighted against 75.8% player-weighted — and only the second has a spread attached.
 *
 * The implied prior weight, mean(1-mean)/sd^2 - 1, is 8.0 — independent corroboration of
 * the \`PER_STAT_PRIOR_WEIGHT.foldTo3Bet = 10\` that WS-262 measured by method of moments.
 */
export const HANDHQ_FOLD_VS_PREFLOP_RAISE_SPREAD = deepFreeze({
  conditioning: ${JSON.stringify(STAT_CONDITIONING.foldTo3Bet.split(' — ')[0])},
  playerMinN: 30,
  seatBuckets: ${JSON.stringify(spread.foldTo3Bet, null, 2).replace(/\n/g, '\n  ')},
});

/**
 * BETWEEN-PLAYER distribution of \`stats.threeBet\` — measured, not derived (WS-376).
 *
 * Same \`overdispersion\` block, same law-of-total-variance pooling, same n >= 30 player gate
 * as the export above. Emitted because \`V-PF-RARELY-3BETS-VS-PF-RAISE\` fires BELOW a bar and
 * the bar has to come from the player distribution, not the hand-weighted rows (4.45%).
 *
 * READ THE SHAPE, NOT JUST THE MOMENTS. This quantity is bounded at 0, right-skewed, and its
 * sd is roughly its mean, so mean - 1sd is 0.85% (6max) and 0.04% (full) — the second is
 * below the smallest rate any finite sample can express. A symmetric mean +/- k*sd bar is the
 * wrong instrument here; \`preflopFoldQuantities.js\` moment-matches a Beta to these numbers
 * and takes a percentile instead. The moments are what is measured; the bar is derived from
 * them there, where the derivation is written down.
 */
export const HANDHQ_THREE_BET_SPREAD = deepFreeze({
  conditioning: ${JSON.stringify(STAT_CONDITIONING.threeBet)},
  playerMinN: 30,
  seatBuckets: ${JSON.stringify(spread.threeBet, null, 2).replace(/\n/g, '\n  ')},
});

/**
 * BETWEEN-PLAYER distribution of \`stats.foldToCbet\` — measured, not derived (WS-376).
 *
 * SAMPLE DEPTH IS MATERIALLY THINNER THAN THE PREFLOP SPREADS, and that is a property of the
 * gate rather than of the corpus: clearing n >= 30 FLOP C-BETS FACED is much harder than
 * clearing n >= 30 preflop opportunities, so this rests on ~19k players against ~106k for
 * \`foldTo3Bet\`. The sd is correspondingly less well determined. Quote \`players\` beside any
 * bar derived from it; do not fall back to the hand-weighted table, which answers a
 * different question (it weights a multitabling regular thousands of times).
 */
export const HANDHQ_FOLD_TO_CBET_SPREAD = deepFreeze({
  conditioning: ${JSON.stringify(STAT_CONDITIONING.foldToCbet)},
  playerMinN: 30,
  seatBuckets: ${JSON.stringify(spread.foldToCbet, null, 2).replace(/\n/g, '\n  ')},
});

/** Ascending by big blind — nearest-stake resolution scans this order (ties → lower). */
export const HANDHQ_REFERENCE_STAKES = deepFreeze([
${entryLines}
]);
`;

writeFileSync(OUT, module_, 'utf8');
console.log(`wrote ${OUT} (${entries.length} stakes × ${SEAT_BUCKETS.length} buckets, ${totalHands} hands)`);
