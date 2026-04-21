/**
 * multiwayFrameworks.js — frameworks that apply when > 1 villain is in the pot.
 *
 * These are STRUCTURAL frameworks — they apply based on the scenario's
 * multiway flag (or villain-count) rather than board-specific range math.
 * They are additive to the existing postflop frameworks: on a multiway
 * board, BOTH the base frameworks (range advantage, board tilt, etc.) AND
 * the relevant multiway frameworks apply.
 *
 * Scenario contract extension for multiway:
 *   s.multiway: boolean (true when ≥ 2 villains remain)
 *   s.numVillains: number (count of active non-hero players)
 *   s.hasCallersBehind: boolean (hero is first to act with villains yet-to-act)
 *   s.scenarioAction: 'preflop-open' | 'preflop-facing-3bet' | 'flop' | ...
 *
 * For Line Mode these fields are pulled from the node's setup + path; the
 * frameworks are declared directly on nodes via `node.frameworks` and the
 * registry is used only for name lookups in the chip renderer.
 *
 * Pure module — no imports from UI, state, or persistence layers.
 */

const isMultiway = (s) => {
  if (!s) return false;
  if (typeof s.multiway === 'boolean') return s.multiway;
  if (typeof s.numVillains === 'number') return s.numVillains >= 2;
  return false;
};

const n = (s) => (typeof s?.numVillains === 'number' ? s.numVillains : 2);

// ---------- 1. Fold equity compression ---------- //

export const FOLD_EQUITY_COMPRESSION = {
  id: 'fold_equity_compression',
  name: 'Fold Equity Compression',
  shortDescription:
    'P(all fold) = ∏ P(fold_i). Each extra villain multiplies your required fold rate geometrically.',
  subcases: [
    { id: 'two_way',  claim: '2 villains — fold equity compresses ~25% per villain', band: null },
    { id: 'three_way', claim: '3+ villains — bluff EV collapses', band: null },
  ],
  applies: (s) => {
    if (!isMultiway(s)) return null;
    return { subcase: n(s) >= 3 ? 'three_way' : 'two_way', favored: null, details: { numVillains: n(s) } };
  },
  narrate: (s, match) => {
    const villains = match.details.numVillains;
    const perPlayerFold = 0.65;
    const compressed = Math.pow(perPlayerFold, villains);
    return (
      `With ${villains} villains, if each folds ${Math.round(perPlayerFold * 100)}% of the time vs your `
      + `bluff, all-folds drops to ${(compressed * 100).toFixed(1)}%. `
      + `Required bluff-frequency compression: even one more villain makes any bluff-heavy line structurally -EV. `
      + `Value betting can still be right; pure bluffs rarely are.`
    );
  },
};

// ---------- 2. Nut necessity ---------- //

export const NUT_NECESSITY = {
  id: 'nut_necessity',
  name: 'Nut Necessity',
  shortDescription:
    'In multiway, SOMEONE has it. Thin value becomes -EV because the second-best hand probability rises.',
  subcases: [
    { id: 'thin_value_dies', claim: 'Thin value hands lose EV — bet with top-of-range or check', band: null },
    { id: 'nut_bet_size',   claim: 'Nut hands benefit from larger sizings (more callers to extract from)', band: null },
  ],
  applies: (s) => {
    if (!isMultiway(s)) return null;
    return { subcase: 'thin_value_dies', favored: null, details: { numVillains: n(s) } };
  },
  narrate: (s, match) => {
    const villains = match.details.numVillains;
    return (
      `Multiway thin-value math: with ${villains} villains holding random continue-ranges, the probability `
      + `that at least one has you beat rises sharply. A hand that's 65% vs one villain's call range is often `
      + `< 50% vs ${villains} independent continue ranges combined. Tighten value thresholds — middle pair that `
      + `prints HU is a check-call in 3-way, and a check-fold in 4-way+. Nut hands (set+) get the opposite `
      + `treatment: more callers = more value, so bet bigger and build the pot.`
    );
  },
};

// ---------- 3. Bluff frequency collapse ---------- //

export const BLUFF_FREQUENCY_COLLAPSE = {
  id: 'bluff_frequency_collapse',
  name: 'Bluff Frequency Collapse',
  shortDescription:
    'Cbet frequency drops ~40% per added villain on most textures. MDF math inverts multiway.',
  subcases: [
    { id: 'two_way',   claim: '2 villains — bluff frequency cut by ~30-40%', band: null },
    { id: 'three_way', claim: '3+ villains — bluff only with high-equity semi-bluffs', band: null },
  ],
  applies: (s) => {
    if (!isMultiway(s)) return null;
    return { subcase: n(s) >= 3 ? 'three_way' : 'two_way', favored: null, details: { numVillains: n(s) } };
  },
  narrate: (s, match) => {
    const base = 0.65;
    const villains = match.details.numVillains;
    const adjusted = base * Math.pow(0.65, villains - 1);
    return (
      `HU cbet frequency baseline ~${Math.round(base * 100)}%; at ${villains} villains it drops toward `
      + `~${Math.round(adjusted * 100)}%. Pure bluffs (no equity when called) are almost always -EV — `
      + `cbet only with (a) nut/near-nut value, (b) high-equity semi-bluffs that realize when called, or `
      + `(c) boards where the multiway ranges are dominated by high-card whiffs. Defenders float wider because `
      + `they expect your bluff frequency to be lower.`
    );
  },
};

// ---------- 4. Squeeze geometry ---------- //

export const SQUEEZE_GEOMETRY = {
  id: 'squeeze_geometry',
  name: 'Squeeze Geometry',
  shortDescription:
    'Open + N calls creates pot odds that make a squeeze uniquely profitable. Flats behind narrow hero\'s MW range.',
  subcases: [
    { id: 'squeeze_window',   claim: 'Facing open + ≥ 1 cold call — squeeze window open', band: null },
    { id: 'facing_squeeze',   claim: 'Hero opened, caller flats, villain squeezes — hero range capped', band: null },
  ],
  applies: (s) => {
    if (!isMultiway(s)) return null;
    if (s.scenarioAction === 'preflop-open' || s.scenarioAction === 'squeeze') {
      return { subcase: 'squeeze_window', favored: null, details: { numVillains: n(s) } };
    }
    if (s.scenarioAction === 'facing-squeeze') {
      return { subcase: 'facing_squeeze', favored: null, details: { numVillains: n(s) } };
    }
    return { subcase: 'squeeze_window', favored: null, details: { numVillains: n(s) } };
  },
  narrate: (s, match) =>
    `Squeeze math: open (e.g., 2.5bb) + 1 cold call (2.5bb) + blinds (1.5bb) ≈ 6.5bb dead money. A 10-12bb `
    + `squeeze needs far less fold equity than a standard 3bet because more chips are already in. When hero is `
    + `the one FACING a squeeze with a caller still to act, the call range narrows drastically: hero cannot call `
    + `light because the caller can over-squeeze. Hand-class shift: premium pairs (JJ+) stay; suited broadways `
    + `and suited connectors drop. 4bet-or-fold is often the correct frame with AK/QQ-equivalents.`,
};

// ---------- 5. Equity redistribution ---------- //

export const EQUITY_REDISTRIBUTION = {
  id: 'equity_redistribution',
  name: 'Equity Redistribution',
  shortDescription:
    '3-way equity ≠ sum of HU equities. Split pots, chop outs, dominated redraws change the math.',
  subcases: [
    { id: 'default', claim: 'Equity redistribution applies', band: null },
  ],
  applies: (s) => (isMultiway(s) ? { subcase: 'default', favored: null, details: { numVillains: n(s) } } : null),
  narrate: (s, match) =>
    `Equity recalibration: a hand with 55% vs villain A and 55% vs villain B does NOT have 55% 3-way. `
    + `3-way equity is typically 35-45% for the same hand because:\n`
    + `  • Split/chop outcomes reassign pot slices\n`
    + `  • Dominated-redraw scenarios stack (e.g., both villains have better pairs)\n`
    + `  • Backdoor outs that win HU may not win when a second villain blocks or out-flushes you\n`
    + `Pot-odds thresholds for calling bets shift accordingly — a price that's great HU is break-even 3-way. `
    + `Verify with range-vs-range math, not pairwise equity.`,
};

// ---------- 6. Position with callers ---------- //

export const POSITION_WITH_CALLERS = {
  id: 'position_with_callers',
  name: 'Position With Callers',
  shortDescription:
    'IP vs one caller + one yet-to-act is NOT the same as IP vs two completed callers.',
  subcases: [
    { id: 'callers_behind',   claim: 'Villain behind can squeeze / raise — hero range tightens', band: null },
    { id: 'callers_in_front', claim: 'All players already acted — cleaner decisions', band: null },
  ],
  applies: (s) => {
    if (!isMultiway(s)) return null;
    if (s.hasCallersBehind) {
      return { subcase: 'callers_behind', favored: null, details: { numVillains: n(s) } };
    }
    return { subcase: 'callers_in_front', favored: null, details: { numVillains: n(s) } };
  },
  narrate: (s, match) => {
    if (match.subcase === 'callers_behind') {
      return (
        `Caller-behind geometry: hero must call from the middle of the action with at least one player still `
        + `to act. The yet-to-act player has iso-raise / squeeze options that force hero to fold — so hero's `
        + `calling range must be robust to pressure. Suited connectors and small pairs (set-mining hands) are `
        + `OK because they play easily; middling offsuit broadways that have 3-way disadvantages should fold `
        + `even when pot odds suggest call.`
      );
    }
    return (
      `Callers-already-closed: all decisions are made and the pot is locked in. Hero can realize equity more `
      + `cleanly — no squeeze risk, no iso raises. Flatting becomes more defensible because downstream streets `
      + `play normally multiway rather than forcing preflop all-ins.`
    );
  },
};

// ---------- 7. Hand class shift ---------- //

export const HAND_CLASS_SHIFT = {
  id: 'hand_class_shift',
  name: 'Hand Class Shift',
  shortDescription:
    'Hand values reorder in multiway. Low pairs ↑ (set-mining), offsuit broadways ↓ (domination), suited connectors depend on callers.',
  subcases: [
    { id: 'default', claim: 'Multiway hand-class valuations apply', band: null },
  ],
  applies: (s) => (isMultiway(s) ? { subcase: 'default', favored: null, details: { numVillains: n(s) } } : null),
  narrate: (s, match) =>
    `Multiway hand-class reordering:\n`
    + `  • Low pocket pairs (22-66): VALUE UP — set-mining benefits from multiple villains (more pot when we flop it).\n`
    + `  • Offsuit broadways (KJo, QJo): VALUE DOWN — domination risk rises; more villains, more likely someone has you dominated.\n`
    + `  • Suited connectors (76s, 87s): CONDITIONAL — strong multiway if implied odds are high (deep stacks + loose opponents), weak if stacks are short.\n`
    + `  • Premium pairs (JJ+): VALUE UP — bigger pots when value-bet, but play more cautiously on scary boards.\n`
    + `  • Ax suited: VALUE UP for blocker/flush potential; AK becomes less dominant because more villains carry draws.\n`
    + `Standard HU ranking tables are wrong multiway — recalibrate before opening/flatting/calling.`,
};

// ---------- Registry ---------- //

export const MULTIWAY_FRAMEWORKS = {
  FOLD_EQUITY_COMPRESSION,
  NUT_NECESSITY,
  BLUFF_FREQUENCY_COLLAPSE,
  SQUEEZE_GEOMETRY,
  EQUITY_REDISTRIBUTION,
  POSITION_WITH_CALLERS,
  HAND_CLASS_SHIFT,
};

export const MULTIWAY_FRAMEWORK_ORDER = [
  FOLD_EQUITY_COMPRESSION,
  NUT_NECESSITY,
  BLUFF_FREQUENCY_COLLAPSE,
  SQUEEZE_GEOMETRY,
  EQUITY_REDISTRIBUTION,
  POSITION_WITH_CALLERS,
  HAND_CLASS_SHIFT,
];
