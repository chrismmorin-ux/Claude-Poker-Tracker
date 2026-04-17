/**
 * matchupLibrary.js — curated seed matchups grouped by framework.
 *
 * Every entry is a deliberately chosen teaching example. The validator test
 * (frameworkValidator.test.js) takes this library, runs exact equity through
 * the preflop enumerator, and asserts every claim's band holds numerically.
 *
 * Adding a new matchup here is the standard way to expand drill content —
 * the validator auto-picks it up.
 *
 * Shape: { id, a, b, primary, subcase, tags, notes? }
 *   - `primary` is the framework id whose band we assert against.
 *   - `subcase` identifies which band inside the primary framework applies.
 */

export const MATCHUP_LIBRARY = [
  // ========== Domination — kicker dominated (~70%) ==========
  { id: 'ako_aqo',  a: 'AKo', b: 'AQo', primary: 'domination', subcase: 'kicker_dominated', tags: ['classic', 'broadway'] },
  { id: 'ako_ajo',  a: 'AKo', b: 'AJo', primary: 'domination', subcase: 'kicker_dominated', tags: ['broadway'] },
  { id: 'aks_aqs',  a: 'AKs', b: 'AQs', primary: 'domination', subcase: 'kicker_dominated', tags: ['broadway', 'suited'] },
  { id: 'aqo_ato',  a: 'AQo', b: 'ATo', primary: 'domination', subcase: 'kicker_dominated', tags: ['broadway'] },
  { id: 'kqo_kjo',  a: 'KQo', b: 'KJo', primary: 'domination', subcase: 'kicker_dominated', tags: ['broadway'] },
  { id: 'kjo_k9o',  a: 'KJo', b: 'K9o', primary: 'domination', subcase: 'kicker_dominated' },
  { id: 'qjo_q8o',  a: 'QJo', b: 'Q8o', primary: 'domination', subcase: 'kicker_dominated' },
  { id: 'ajo_a3o',  a: 'AJo', b: 'A3o', primary: 'domination', subcase: 'kicker_dominated', tags: ['big-gap'] },

  // ========== Domination — pair dominates kicker (pair above other's kicker, ~92%) ==========
  { id: 'aa_ako',   a: 'AA',  b: 'AKo', primary: 'domination', subcase: 'pair_dominates_kicker', tags: ['crushing', 'classic'] },
  { id: 'aa_aqs',   a: 'AA',  b: 'AQs', primary: 'domination', subcase: 'pair_dominates_kicker', tags: ['crushing'] },
  { id: 'aa_a2o',   a: 'AA',  b: 'A2o', primary: 'domination', subcase: 'pair_dominates_kicker', tags: ['crushing'] },
  { id: 'jj_j5o',   a: 'JJ',  b: 'J5o', primary: 'domination', subcase: 'pair_dominates_kicker' },
  { id: '88_83o',   a: '88',  b: '83o', primary: 'domination', subcase: 'pair_dominates_kicker' },

  // ========== Domination — pair vs shared overcard (pair has lower rank, ~68%) ==========
  { id: 'kk_aks',   a: 'KK',  b: 'AKs', primary: 'domination', subcase: 'pair_vs_shared_over', tags: ['underpair-live'] },
  { id: 'qq_aqo',   a: 'QQ',  b: 'AQo', primary: 'domination', subcase: 'pair_vs_shared_over' },
  { id: 'jj_ajs',   a: 'JJ',  b: 'AJs', primary: 'domination', subcase: 'pair_vs_shared_over' },
  { id: 'tt_ato',   a: 'TT',  b: 'ATo', primary: 'domination', subcase: 'pair_vs_shared_over' },
  { id: '77_a7o',   a: '77',  b: 'A7o', primary: 'domination', subcase: 'pair_vs_shared_over', tags: ['small-pair'] },

  // ========== Pair over Pair (~82%) ==========
  { id: 'aa_kk',    a: 'AA',  b: 'KK',  primary: 'pair_over_pair', subcase: 'pair_over_pair', tags: ['classic', 'coolers'] },
  { id: 'aa_qq',    a: 'AA',  b: 'QQ',  primary: 'pair_over_pair', subcase: 'pair_over_pair', tags: ['classic'] },
  { id: 'aa_22',    a: 'AA',  b: '22',  primary: 'pair_over_pair', subcase: 'pair_over_pair', tags: ['max-gap'] },
  { id: 'kk_qq',    a: 'KK',  b: 'QQ',  primary: 'pair_over_pair', subcase: 'pair_over_pair' },
  { id: 'jj_tt',    a: 'JJ',  b: 'TT',  primary: 'pair_over_pair', subcase: 'pair_over_pair' },
  { id: 'tt_22',    a: 'TT',  b: '22',  primary: 'pair_over_pair', subcase: 'pair_over_pair' },
  { id: '77_44',    a: '77',  b: '44',  primary: 'pair_over_pair', subcase: 'pair_over_pair', tags: ['small'] },

  // ========== Race — pair vs two overs (~54%) ==========
  { id: '77_ako',   a: '77',  b: 'AKo', primary: 'race', subcase: 'pair_vs_two_overs', tags: ['classic-race'] },
  { id: '77_aks',   a: '77',  b: 'AKs', primary: 'race', subcase: 'pair_vs_two_overs', tags: ['race'] },
  { id: '88_ako',   a: '88',  b: 'AKo', primary: 'race', subcase: 'pair_vs_two_overs' },
  { id: '99_aqs',   a: '99',  b: 'AQs', primary: 'race', subcase: 'pair_vs_two_overs' },
  { id: 'tt_ako',   a: 'TT',  b: 'AKo', primary: 'race', subcase: 'pair_vs_two_overs' },
  { id: '22_ako',   a: '22',  b: 'AKo', primary: 'race', subcase: 'pair_vs_two_overs', tags: ['tiny-pair'] },
  { id: '55_kjo',   a: '55',  b: 'KJo', primary: 'race', subcase: 'pair_vs_two_overs' },

  // ========== Race — pair vs split (one over, one under) (~68%) ==========
  { id: '88_a5o',   a: '88',  b: 'A5o', primary: 'race', subcase: 'pair_vs_split' },
  { id: '99_k6o',   a: '99',  b: 'K6o', primary: 'race', subcase: 'pair_vs_split' },
  { id: 'tt_a5o',   a: 'TT',  b: 'A5o', primary: 'race', subcase: 'pair_vs_split' },
  { id: '77_q3o',   a: '77',  b: 'Q3o', primary: 'race', subcase: 'pair_vs_split' },
  { id: '66_k5o',   a: '66',  b: 'K5o', primary: 'race', subcase: 'pair_vs_split' },

  // ========== Race — pair vs two unders (~86%) ==========
  { id: 'tt_87s',   a: 'TT',  b: '87s', primary: 'race', subcase: 'pair_vs_two_unders' },
  { id: 'jj_87o',   a: 'JJ',  b: '87o', primary: 'race', subcase: 'pair_vs_two_unders' },
  { id: 'qq_54s',   a: 'QQ',  b: '54s', primary: 'race', subcase: 'pair_vs_two_unders' },
  { id: 'aa_72o',   a: 'AA',  b: '72o', primary: 'race', subcase: 'pair_vs_two_unders', tags: ['max-dominate'] },
  { id: '77_32o',   a: '77',  b: '32o', primary: 'race', subcase: 'pair_vs_two_unders' },
  { id: '99_65s',   a: '99',  b: '65s', primary: 'race', subcase: 'pair_vs_two_unders' },

  // ========== Broadway vs Connector (blocker-heavy — no fixed band, modifier-driven) ==========
  { id: 'ako_jts',  a: 'AKo', b: 'JTs', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector', tags: ['blocker-max'] },
  { id: 'aks_jts',  a: 'AKs', b: 'JTs', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector', tags: ['blocker-max', 'both-suited'] },
  { id: 'ako_t9s',  a: 'AKo', b: 'T9s', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector' },
  { id: 'ako_98s',  a: 'AKo', b: '98s', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector' },
  { id: 'ako_76s',  a: 'AKo', b: '76s', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector', tags: ['blocker-min'] },
  { id: 'ako_54s',  a: 'AKo', b: '54s', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector', tags: ['wheel-live'] },
  { id: 'aqo_jts',  a: 'AQo', b: 'JTs', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector' },
  { id: 'kqo_t9s',  a: 'KQo', b: 'T9s', primary: 'broadway_vs_connector', subcase: 'broadway_vs_connector' },

  // ========== Curiosities / library-browsing favorites (no hard-asserted band) ==========
  { id: 't9s_54s',  a: 'T9s', b: '54s', primary: 'straight_coverage', subcase: 'coverage', tags: ['connector-vs-connector'] },
  { id: 'jts_87s',  a: 'JTs', b: '87s', primary: 'straight_coverage', subcase: 'coverage', tags: ['connector-vs-connector'] },
];

/**
 * Group matchups by their primary framework for fast lookup in UI.
 */
export const MATCHUPS_BY_FRAMEWORK = MATCHUP_LIBRARY.reduce((acc, m) => {
  (acc[m.primary] = acc[m.primary] || []).push(m);
  return acc;
}, {});

/**
 * Find a matchup by id.
 */
export const findMatchup = (id) => MATCHUP_LIBRARY.find((m) => m.id === id) || null;
