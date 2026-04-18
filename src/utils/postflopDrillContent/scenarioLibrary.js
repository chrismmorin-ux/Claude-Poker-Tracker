/**
 * scenarioLibrary.js — curated teaching scenarios grouped by framework.
 *
 * Each entry is a deliberately chosen range-vs-board (or range-vs-range) spot
 * that exemplifies one framework's subcase. The scenarioValidator test takes
 * this library, resolves archetype ranges + parses boards, classifies with
 * framework `applies()`, and asserts the expected subcase matches.
 *
 * Adding a new scenario here is the standard way to expand drill content —
 * the validator auto-picks it up.
 *
 * Shape:
 *   {
 *     id:               unique string
 *     context:          { position, action, vs? }       — focal range
 *     opposingContext?: { position, action, vs? } | null — optional
 *     board:            string                           — 3 card strings joined
 *                                                          e.g. 'As Kh 7d'
 *     primary:          framework id
 *     expectedSubcase:  subcase id the primary framework should return
 *     tags?:            string[]
 *     notes?:           string
 *   }
 *
 * Card string format matches `parseBoard` in pokerCore: rank+suit where
 * suit is one of '♠♥♦♣' OR 's/h/d/c' (accepted by local helpers below).
 */

// Helper to keep the file readable — uses ASCII suit letters internally, we
// translate to unicode at parse time so the library is easy to read and diff.
const ASCII_SUITS = { s: '♠', h: '♥', d: '♦', c: '♣' };
const normCard = (card) => {
  const trimmed = card.trim();
  if (trimmed.length !== 2) return trimmed;
  const suit = ASCII_SUITS[trimmed[1]] || trimmed[1];
  return trimmed[0] + suit;
};
/** Turn "As Kh 7d" into ["A♠","K♥","7♦"] for parseBoard. */
export const parseFlopString = (str) => str.split(/\s+/).filter(Boolean).map(normCard);

export const SCENARIOS = [
  // ================= RANGE_DECOMPOSITION (always applies) =================
  {
    id: 'decomp_btn_open_k72r',
    context: { position: 'BTN', action: 'open' },
    board: 'Ks 7h 2d',
    primary: 'range_decomposition',
    expectedSubcase: 'always',
    tags: ['dry-board'],
    notes: 'BTN open on K72r — the reference decomposition spot.',
  },
  {
    id: 'decomp_utg_open_654',
    context: { position: 'UTG', action: 'open' },
    board: '6c 5h 4d',
    primary: 'range_decomposition',
    expectedSubcase: 'always',
    tags: ['wet-board', 'low'],
    notes: 'UTG open range heavily whiffs this low connected board.',
  },
  {
    id: 'decomp_bb_3bet_aj4',
    context: { position: 'BB', action: 'threeBet', vs: 'BTN' },
    opposingContext: { position: 'BTN', action: 'open' },
    board: 'As Jd 4c',
    primary: 'range_decomposition',
    expectedSubcase: 'always',
    tags: ['polarized-3bet', 'ace-high'],
    notes: 'BB 3bet range polarized — TT+/AJs+/KQs for value + A5s/A2s blockers. On AJ4 the value hands crush; blockers have pair outs.',
  },
  {
    id: 'decomp_btn_open_t98',
    context: { position: 'BTN', action: 'open' },
    opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
    board: 'Ts 9s 8d',
    primary: 'range_decomposition',
    expectedSubcase: 'always',
    tags: ['wet-middling', 'two-tone'],
    notes: 'Wet middling board — lots of straights possible for both ranges; two-tone adds flush equity.',
  },
  {
    id: 'decomp_bb_call_mono_at5',
    context: { position: 'BB', action: 'call', vs: 'BTN' },
    opposingContext: { position: 'BTN', action: 'open' },
    board: 'Ah Th 5h',
    primary: 'range_decomposition',
    expectedSubcase: 'always',
    tags: ['monotone', 'ace-high'],
    notes: 'Monotone A-high — BB has many hearts combos; nut advantage depends on who holds A♥.',
  },

  // ================= RANGE_ADVANTAGE =================
  {
    id: 'adv_btn_open_vs_bb_call_ak7',
    context:          { position: 'BTN', action: 'open' },
    opposingContext:  { position: 'BB',  action: 'call', vs: 'BTN' },
    board: 'As Kh 7d',
    primary: 'range_advantage',
    expectedSubcase: 'significant',
    tags: ['classic'],
    notes: 'BTN opens, BB defends — AK7r is the textbook PFR-favored flop.',
  },
  {
    id: 'adv_btn_open_vs_bb_call_654',
    context:          { position: 'BTN', action: 'open' },
    opposingContext:  { position: 'BB',  action: 'call', vs: 'BTN' },
    board: '6h 5d 4c',
    primary: 'range_advantage',
    // On 654 rainbow, BB's defending range matches BTN's closely — the
    // structural-fallback heuristic returns neutral. When MC equity is
    // attached (Explorer mode), the signed delta becomes more informative,
    // but the subcase under the structural heuristic is neutral.
    expectedSubcase: 'neutral',
    tags: ['classic', 'low-connected'],
    notes: 'Low connected board — BB defend range catches up; neutral under structural heuristic.',
  },
  {
    id: 'adv_utg_open_vs_bb_call_akq',
    context: { position: 'UTG', action: 'open' },
    opposingContext: { position: 'BB', action: 'call', vs: 'UTG' },
    board: 'As Kd Qh',
    primary: 'range_advantage',
    expectedSubcase: 'significant',
    tags: ['broadway', 'tight-range'],
    notes: "UTG's tight range is exceptionally broadway-heavy; BB's wide call range has few AK/KQ combos. Strongly UTG-favored.",
  },
  {
    id: 'adv_btn_open_vs_bb_call_q98',
    context: { position: 'BTN', action: 'open' },
    opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
    board: 'Qd 9c 8s',
    primary: 'range_advantage',
    expectedSubcase: 'neutral',
    tags: ['middling', 'wet'],
    notes: 'Middling wet board; ranges roughly equal under tier-weighted heuristic. Real delta requires MC.',
  },
  {
    id: 'adv_btn_open_vs_bb_call_j87',
    context: { position: 'BTN', action: 'open' },
    opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
    board: 'Jh 8h 7c',
    primary: 'range_advantage',
    expectedSubcase: 'moderate',
    tags: ['two-tone', 'middling'],
    notes: "Two-tone J87. BB's low-suited-connector-heavy flat range outperforms BTN's broadway-heavy open — moderate BB edge.",
  },

  // ================= NUT_ADVANTAGE =================
  {
    id: 'nut_btn_open_vs_bb_call_aq7',
    context:          { position: 'BTN', action: 'open' },
    opposingContext:  { position: 'BB',  action: 'call', vs: 'BTN' },
    board: 'Ah Qd 7s',
    primary: 'nut_advantage',
    expectedSubcase: 'real',
    tags: ['classic'],
    notes: 'BTN has AA/AQ/QQ/77 combos BB doesn\'t — nut advantage is real.',
  },
  {
    id: 'nut_btn_open_vs_bb_call_765',
    context: { position: 'BTN', action: 'open' },
    opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
    board: '7s 6d 5c',
    primary: 'nut_advantage',
    expectedSubcase: 'real',
    tags: ['low-connected', 'bb-favored'],
    notes: "BB's flat range has more small pairs (55, 66, 77), more suited connectors (76s, 65s), and 98/89 straights. Nut advantage flips to BB.",
  },
  {
    id: 'nut_bb_3bet_vs_btn_akq',
    context: { position: 'BB', action: 'threeBet', vs: 'BTN' },
    opposingContext: { position: 'BTN', action: 'open' },
    board: 'As Kd Qh',
    primary: 'nut_advantage',
    expectedSubcase: 'crushing',
    tags: ['polar-3bet', 'broadway'],
    notes: "BB 3bet range — TT+/AJs+/KQs/A5-A2s — crushes BTN open on AKQ. Sets/two-pair/straights share is lopsided.",
  },
  {
    id: 'nut_btn_open_vs_bb_call_k72',
    context: { position: 'BTN', action: 'open' },
    opposingContext: { position: 'BB', action: 'call', vs: 'BTN' },
    board: 'Ks 7h 2d',
    primary: 'nut_advantage',
    expectedSubcase: 'nominal',
    tags: ['dry', 'nominal'],
    notes: 'BTN has KK/77/22 sets BB does not (BB 3bets KK). But both ranges have KQ/K-something two pair candidates. Nut advantage is real but not crushing.',
  },

  // ================= RANGE_MORPHOLOGY =================
  {
    id: 'morph_bb_call_capped_ak7',
    context: { position: 'BB', action: 'call', vs: 'BTN' },
    board: 'Ah Kd 7s',
    primary: 'range_morphology',
    // BB defending flat vs BTN excludes AA and KK (they 3bet for value), so
    // the only nuts on A-K-7 is 77 (pocket set). Engine's isCapped gate
    // (nuts.pct < 2) should trigger because 77 is ~0.5% of BB's range.
    expectedSubcase: 'capped',
    tags: ['capped-range', 'classic'],
    notes: 'BB call range has no AA/KK → only 77 sets as nuts on AK7. Genuinely capped.',
  },
  {
    id: 'morph_bb_call_condensed_j98',
    context: { position: 'BB', action: 'call', vs: 'BTN' },
    board: 'Jd 9h 8c',
    primary: 'range_morphology',
    // BB defend vs BTN on J98 hits LOTS of medium-strength (pairs, open-enders);
    // some nuts (QT, T7s for straights) but heavy medium.
    expectedSubcase: 'linear',
    tags: ['wet-middling'],
  },
  {
    id: 'morph_bb_3bet_vs_btn_765',
    context: { position: 'BB', action: 'threeBet', vs: 'BTN' },
    board: '7s 6d 5c',
    primary: 'range_morphology',
    expectedSubcase: 'capped',
    tags: ['polar-3bet', 'low-board'],
    notes: 'BB 3bet on 765 — range is AA/KK/QQ/AK/KQ + A5/A2s blockers. Little connects with low board except 55 (set). Ranges polarize to overpairs vs air on low.',
  },
  {
    id: 'morph_btn_open_linear_k72',
    context: { position: 'BTN', action: 'open' },
    board: 'Ks 7h 2d',
    primary: 'range_morphology',
    expectedSubcase: 'linear',
    tags: ['dry-high', 'merged'],
    notes: 'BTN open on K72 — linear/merged: overpairs, TPTK, TP-weak, mid-low pairs, air. Top-down distribution.',
  },
  {
    id: 'morph_utg_open_654',
    context: { position: 'UTG', action: 'open' },
    board: '6c 5h 4d',
    primary: 'range_morphology',
    expectedSubcase: 'condensed',
    tags: ['low-connected', 'overpair-heavy'],
    notes: "UTG's broadway-heavy range on 654 condenses into overpairs (77-AA) + overcards — few nuts, low air, mostly medium-strength. Classic condensed shape.",
  },

  // ================= BOARD_TILT =================
  {
    id: 'tilt_high_akq',
    context: { position: 'BTN', action: 'open' },
    board: 'Ah Kd Qs',
    primary: 'board_tilt',
    expectedSubcase: 'high_favors_pfr',
    tags: ['broadway'],
  },
  {
    id: 'tilt_low_754',
    context: { position: 'BTN', action: 'open' },
    board: '7c 5h 4d',
    primary: 'board_tilt',
    expectedSubcase: 'low_favors_defender',
    tags: ['low-connected'],
  },
  {
    id: 'tilt_paired_k77',
    context: { position: 'BTN', action: 'open' },
    board: 'Kh 7s 7d',
    primary: 'board_tilt',
    expectedSubcase: 'paired',
    tags: ['paired'],
  },
  {
    id: 'tilt_monotone_ah9h4h',
    context: { position: 'BTN', action: 'open' },
    board: 'Ah 9h 4h',
    primary: 'board_tilt',
    expectedSubcase: 'monotone',
    tags: ['monotone'],
  },

  // ================= CAPPED_RANGE_CHECK =================
  {
    id: 'capped_bb_call_ak7',
    context: { position: 'BB', action: 'call', vs: 'BTN' },
    board: 'Ah Kd 7s',
    primary: 'capped_range_check',
    expectedSubcase: 'capped_no_aces',
    tags: ['classic', 'capped'],
  },
  {
    id: 'capped_bb_call_kq2',
    context: { position: 'BB', action: 'call', vs: 'CO' },
    board: 'Kh Qd 2s',
    primary: 'capped_range_check',
    expectedSubcase: 'capped_no_kings',
    tags: ['capped'],
  },
  {
    id: 'capped_bb_call_utg_ak7',
    context: { position: 'BB', action: 'call', vs: 'UTG' },
    board: 'Ac Kh 7d',
    primary: 'capped_range_check',
    expectedSubcase: 'capped_no_aces',
    tags: ['capped', 'tight-opener'],
    notes: "BB flat vs UTG open — even narrower than vs BTN, still no AA/KK in flat range. Heavy cap.",
  },
  {
    id: 'capped_sb_call_btn_kq8',
    context: { position: 'SB', action: 'call', vs: 'BTN' },
    board: 'Ks Qh 8d',
    primary: 'capped_range_check',
    expectedSubcase: 'capped_no_kings',
    tags: ['sb-defend', 'capped'],
    notes: 'SB flat vs BTN excludes KK (3bets). Top set not in caller range.',
  },
  {
    id: 'capped_btn_call_co_qj5',
    context: { position: 'BTN', action: 'call', vs: 'CO' },
    board: 'Qs Jc 5h',
    primary: 'capped_range_check',
    expectedSubcase: 'capped_no_sets_high',
    tags: ['btn-flat', 'capped-middle'],
    notes: 'BTN flat vs CO excludes QQ+ (3bet). Q-high board tops out at top-two-pair for the caller.',
  },

  // ================= WHIFF_RATE =================
  {
    id: 'whiff_utg_open_654',
    context: { position: 'UTG', action: 'open' },
    board: '6c 5h 4d',
    primary: 'whiff_rate',
    // UTG open is broadway-heavy but EVERY combo has overcards to pair or an
    // overpair. Under pedagogical bucketing (overcards → weakDraw), UTG has
    // near-zero true air on 654. Teaching point: tight ranges connect via
    // overpairs + pair-up equity — the real problem on 654 is *nut advantage*
    // (no small sets), not whiff rate.
    expectedSubcase: 'well_connected',
    tags: ['teaching-tension'],
    notes: 'Counter-intuitive: UTG on 654 looks like it whiffs, but pedagogical air is near zero. Nut advantage is the real issue.',
  },
  {
    id: 'whiff_btn_open_kq9',
    context: { position: 'BTN', action: 'open' },
    board: 'Kh Qd 9s',
    primary: 'whiff_rate',
    // BTN is the widest open but KQ9 only directly connects with pairs of
    // K/Q/9. Many low suited connectors / small-A hands whiff or only hold
    // backdoor equity → moderate_whiff (30–50%).
    expectedSubcase: 'moderate_whiff',
    tags: ['connects-moderate'],
  },
  {
    id: 'whiff_btn_open_732',
    context: { position: 'BTN', action: 'open' },
    board: '7s 3h 2d',
    primary: 'whiff_rate',
    // Pedagogical air is promoted: most BTN combos have overcards → weakDraw.
    expectedSubcase: 'well_connected',
    tags: ['disconnected-low', 'overcard-driven'],
    notes: "Despite the board being disconnected + low, BTN's range is almost entirely overcards → everything pulls pair-up equity and escapes 'air'. Teaching tension: a wide range RARELY has true air.",
  },
  {
    id: 'whiff_btn_open_akq',
    context: { position: 'BTN', action: 'open' },
    board: 'As Kd Qh',
    primary: 'whiff_rate',
    expectedSubcase: 'light_whiff',
    tags: ['broadway-heavy'],
    notes: 'BTN connects heavily; what misses usually has overcards-to-pair or gutshots. Low but non-zero air (offsuit disconnects).',
  },
  {
    id: 'whiff_bb_3bet_vs_btn_low',
    context: { position: 'BB', action: 'threeBet', vs: 'BTN' },
    board: '7c 4d 2s',
    primary: 'whiff_rate',
    expectedSubcase: 'well_connected',
    tags: ['polar-3bet', 'low-board'],
    notes: 'BB 3bet range is overpair-dominated on low board — very little true air. Overcards + pairs everywhere.',
  },
];

/**
 * Index scenarios by primary framework id for the Library UI.
 */
export const scenariosByFramework = () => {
  const out = {};
  for (const s of SCENARIOS) {
    (out[s.primary] ||= []).push(s);
  }
  return out;
};
