/**
 * situationKey.js — THE canonical definition of "a spot" (WS-317, FSA Phase 1).
 *
 * Lives in pokerCore because two engines need it and neither owns it:
 * `exploitEngine/decisionAccumulator` buckets VILLAIN decisions, and
 * `skillAssessment/deriveSituationKey` buckets HERO decisions. Both had their own
 * builder and both were read by positional `split(':')` at fourteen call sites.
 *
 * WHY THIS EXISTS. The exploit-model architecture charter (§6) has named the canonical
 * situation key the "first build dependency" since 2026-06-18: every frame — Equilibrium,
 * Field, Read — must key off ONE definition of a spot or comparing them is comparing
 * coordinate systems rather than surfaces. `decisionGeometry.mjs` already makes the small
 * version of this argument about the pot convention: "deriving it three times would be
 * three chances to disagree." This is that argument at the scale of the join itself.
 *
 * THE DEFECT IT REPLACES. The key was a `:`-delimited string read by index:
 *
 *     const ctxAction = key.split(':')[6] || 'unknown';     // decisionAccumulator.js:551
 *
 * Two arities existed — 7 axes for villain, 8 for hero (WS-146 added `preflopAggressor`) —
 * so a 7-axis reader pointed at an 8-axis key silently returns plausible wrong answers for
 * anything past its expectation, and the `|| 'unknown'` fallback hides the failure. That is
 * the exact family this engine has already been bitten by three times (WS-285's unmeasured
 * ordering comment, WS-291's doc the data refuted, WS-300's index list naming the wrong
 * hands): a structure asserting something nothing checks.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * CARRYING IS NOT KEYING — the distinction this module is built around.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * A spot has more properties than the ones that give it its IDENTITY. `IDENTITY_AXES` are
 * the axes whose values decide whether two decisions land in the same bucket. Everything in
 * `CARRIED_AXES` travels WITH a decision, is queryable, and deliberately does NOT affect
 * bucketing.
 *
 * This matters because widening bucket identity re-partitions every historical measurement.
 * SPR band and players-remaining genuinely belong in a spot definition — engine doctrine
 * treats SPR as a first-principles input, and WS-274 established that players-remaining is
 * about WHO, not how many. But promoting either into identity multiplies bucket count and
 * thins every cell, which is a change that must be MEASURED (does the finer partition
 * predict better, or does it just shrink n?) rather than assumed. So they are carried now
 * and promoted later, deliberately, with a number attached.
 *
 * `source` and `pool` are carried for a different reason: the promoted data-source registry
 * requires provenance to survive the join at row grain, and the Five-Surface Atlas cannot
 * tell its three Field surfaces apart (HandHQ 2009 online / Ignition current online /
 * live 1/3) without pool identity riding along. Neither should ever enter identity — a
 * bucket must not fragment by where its evidence came from, or cross-source comparison
 * becomes impossible by construction.
 */

/**
 * The seven axes that define bucket identity, IN WIRE ORDER.
 *
 * Order is load-bearing: it is the serialized format, and heroLeaks persists these strings
 * inside a composite primary key `[playerId, situationKey]` (IDB v22). Reordering silently
 * invalidates every stored leak. Append-only.
 */
export const IDENTITY_AXES = Object.freeze([
  'street',
  'texture',
  'posCategory',
  'isAgg',
  'isIP',
  'facingAction',
  'contextAction',
]);

/**
 * The eighth axis, hero-side only.
 *
 * Added WS-146 / SPR-040 to distinguish hero's preflop role on postflop streets. The villain
 * accumulator does not derive it, so villain keys are legitimately 7-axis and hero keys are
 * 8-axis. That is a real difference in what is known, not an inconsistency to paper over —
 * hence a parser that reports arity rather than one that guesses.
 */
export const HERO_AXIS = 'preflopAggressor';

export const HERO_AXES = Object.freeze([...IDENTITY_AXES, HERO_AXIS]);

/**
 * Hero's own holding, as one of the 169 rank-pair classes ('AA', 'AKs', 'JTo', ...).
 *
 * WHY THIS IS NOT AN IDENTITY AXIS, AND NEVER WILL BE. Every axis above describes the SPOT —
 * the situation two different holdings can share. This one describes what hero is holding IN
 * that spot, which is a different kind of fact: it is the QUERY, not the bucket. Putting it in
 * `IDENTITY_AXES` would multiply every bucket by 169 and, worse, would change the serialized
 * wire format that `heroLeaks` persists inside the composite primary key
 * `[playerId, situationKey]` (IDB v22) — silently invalidating every stored leak, which is
 * exactly what the append-only note on `IDENTITY_AXES` warns about.
 *
 * So it is neither keyed nor carried: `formatSituationKey` never emits it and
 * `withCarriedContext` never attaches it. It exists solely so a DECLARED surface can MATCH on
 * it — a Strategy Card that cannot say "AKo" cannot express a preflop chart at all, and the
 * 169-cell Entry Map (WS-323) is precisely a preflop chart. See `MATCHABLE_AXES` in
 * `standardOfRecord/strategyCard.js`, the one place this axis is legal.
 *
 * Values are the notations produced by `preflopEquity.handClassToNotation` — that function is
 * the vocabulary, so there is no second spelling of a hand class to disagree with.
 */
export const HAND_AXIS = 'handClass';

/**
 * Axes CARRIED with a decision but deliberately NOT part of bucket identity.
 * See the "carrying is not keying" note above before promoting any of these.
 */
export const CARRIED_AXES = Object.freeze([
  'sprBand',          // engine SPR zone — promote only with a measurement
  'playersRemaining', // per WS-274 this is WHO, not a count — resolve seats, do not tally
  'source',           // SRC-* id; registry requires provenance to survive the join
  'pool',             // stake + venue class; FSA cannot separate its Field surfaces without it
  // ── WS-333 geometry coordinates ──────────────────────────────────────────────────────
  // Added CARRIED, not keyed, for exactly the reason stated above: promoting a coordinate
  // into identity re-partitions every historical measurement, so it must be MEASURED first.
  // The measurement is `scripts/backtest/geometryAblation.mjs` (AS-711); promotion is a
  // separate, later decision that arrives with a number attached.
  'sBucket',          // bet-to-pot ratio bucket — the argument of the pot-odds identity
  'closesAction',     // does MATCHING close the betting? SB's call does not; BB's does.
                      // A geometry property, NOT a position label: SB and BB are both OOP
                      // preflop and differ here, which is what makes it a real coordinate
                      // rather than a rename of isIP (HIERARCHY_ORDER[1]).
]);

const SEP = ':';

/** Thrown rather than returning a wrong-but-plausible parse. */
export class SituationKeyError extends Error {
  constructor(message, key) {
    super(message);
    this.name = 'SituationKeyError';
    this.key = key;
  }
}

/**
 * Serialize a situation key.
 *
 * Emits the 7-axis form unless `preflopAggressor` is supplied, in which case the 8-axis
 * hero form. Byte-identical to what `decisionAccumulator.buildSituationKey` and
 * `buildHeroSituationKey` produced before this module existed — the wire format is frozen
 * because it is persisted, so this migration changes who parses the string, not the string.
 *
 * @param {Object} fields axis values
 * @returns {string}
 */
export const formatSituationKey = (fields = {}) => {
  const core = IDENTITY_AXES.map((axis) => fields[axis]);
  const pfa = fields[HERO_AXIS];
  return (pfa === undefined || pfa === null ? core : [...core, pfa]).join(SEP);
};

/**
 * Parse a situation key into named axes.
 *
 * Returns `arity` so a caller can tell a villain key from a hero key instead of inferring it
 * from whether a field came back undefined. `preflopAggressor` is `null` — not `undefined` —
 * on 7-axis keys, so "absent because villain-side" is distinguishable from "typo'd axis".
 *
 * @param {string} key
 * @returns {{street:string, texture:string, posCategory:string, isAgg:string, isIP:string,
 *            facingAction:string, contextAction:string, preflopAggressor:(string|null),
 *            arity:number}}
 * @throws {SituationKeyError} on anything that is not a well-formed key — a malformed key is
 *   a bug at the producer, and returning a partly-undefined object would propagate it far
 *   from its cause, which is exactly how `split(':')[6] || 'unknown'` hid problems.
 */
export const parseSituationKey = (key) => {
  if (typeof key !== 'string' || key.length === 0) {
    throw new SituationKeyError('situation key must be a non-empty string', key);
  }
  const parts = key.split(SEP);
  if (parts.length !== IDENTITY_AXES.length && parts.length !== HERO_AXES.length) {
    throw new SituationKeyError(
      `situation key must have ${IDENTITY_AXES.length} or ${HERO_AXES.length} axes, got ${parts.length}`,
      key,
    );
  }
  const out = {};
  IDENTITY_AXES.forEach((axis, i) => { out[axis] = parts[i]; });
  out[HERO_AXIS] = parts.length === HERO_AXES.length ? parts[HERO_AXES.length - 1] : null;
  out.arity = parts.length;
  return out;
};

/** Parse without throwing. Returns `null` on a malformed key. */
export const tryParseSituationKey = (key) => {
  try {
    return parseSituationKey(key);
  } catch {
    return null;
  }
};

/**
 * Read ONE axis by name.
 *
 * The direct replacement for `key.split(':')[N]`. Use this instead of an index anywhere a
 * single axis is wanted — it is the whole point of the module that no caller knows a
 * position. `fallback` is returned only when the key is malformed or the axis is absent
 * (e.g. `preflopAggressor` on a villain key), never to paper over a shape change.
 */
export const axisOf = (key, axis, fallback = undefined) => {
  if (!IDENTITY_AXES.includes(axis) && axis !== HERO_AXIS) {
    throw new SituationKeyError(`unknown situation-key axis "${axis}"`, key);
  }
  const parsed = tryParseSituationKey(key);
  if (!parsed) return fallback;
  const value = parsed[axis];
  return value === null || value === undefined ? fallback : value;
};

/**
 * True when `key` starts with the given street.
 *
 * Replaces `key.startsWith(street + ':')`, which only worked because `street` happens to be
 * axis 0 — a prefix match is a positional assumption wearing different syntax.
 */
export const isStreet = (key, street) => axisOf(key, 'street', null) === street;

/**
 * Attach carried (non-identity) context to a decision.
 *
 * Returns a plain record pairing the key with its carried axes. Kept separate from the key
 * string on purpose: the string is the persisted identity and must not grow, while carried
 * context is free to gain axes without re-partitioning anything or touching a reader.
 */
export const withCarriedContext = (key, carried = {}) => {
  const context = {};
  for (const axis of CARRIED_AXES) {
    context[axis] = carried[axis] ?? null;
  }
  return { situationKey: key, ...context };
};

// =============================================================================
// AXIS DERIVATION (WS-318)
// =============================================================================
//
// These moved here from `exploitEngine/decisionAccumulator` because they were the reason
// hero-side and villain-side keys could disagree about what axis 3 MEANS. The villain
// accumulator derived all seven axes; the two hero-side producers derived three and put a
// primitive action where `isAgg` belongs. Nothing compared the two shapes, so the weakness
// matcher compared `'bet'` against `'agg'` and returned false for every hand ever played.
//
// They are pure by construction — `streetActions` and `aggSeat` are PARAMETERS, not
// computed here — for two reasons. It keeps this module free of a `handAnalysis` import
// (which would close a cycle, since `handAnalysis` imports this file), and it lets the
// accumulator keep its per-street caches on a hot path that runs over thousands of hands.

/**
 * Determine the primary opponent seat on this street (for IP/OOP).
 * Scans street actions for the most recent non-player seat that acted.
 */
export const findPrimaryOpponent = (streetActions, playerSeat) => {
  const ps = String(playerSeat);
  for (let i = streetActions.length - 1; i >= 0; i--) {
    if (String(streetActions[i].seat) !== ps) return streetActions[i].seat;
  }
  return null;
};

/**
 * Determine what action the player is facing (last aggressive action before theirs).
 *
 * @returns {'none'|'bet'|'raise'}
 */
export const deriveFacingAction = (streetActions, entryOrder, playerSeat, primitives) => {
  const ps = String(playerSeat);
  let facing = 'none';
  for (const e of streetActions) {
    if (e.order >= entryOrder) break;
    if (String(e.seat) === ps) continue;
    if (e.action === primitives.BET) facing = 'bet';
    else if (e.action === primitives.RAISE) facing = 'raise';
  }
  return facing;
};

/** Check if any bet/raise happened before this entry on the street. */
export const isFirstToAct = (streetActions, entryOrder, playerSeat, primitives) => {
  const ps = String(playerSeat);
  for (const e of streetActions) {
    if (e.order >= entryOrder) break;
    if (String(e.seat) === ps) continue;
    if (e.action === primitives.BET || e.action === primitives.RAISE) return false;
  }
  return true;
};

/**
 * Derive the contextual meta-action from primitive + context.
 *
 * This is the axis the weakness matcher keys on (WS-318 founder decision). It is strictly
 * richer than `isAgg`: `cbet` already means "aggressor, first to act, facing nothing", so
 * matching on it subsumes matching on role while also distinguishing a c-bet from a
 * check-give-up — two lines the old comparison could not tell apart even in principle.
 *
 * @param {string} primitive - 'bet'|'check'|'call'|'raise'|'fold'
 * @param {boolean} isAgg - Is this player the street aggressor?
 * @param {boolean} firstToAct - Is this the first aggressive action on street?
 * @param {'none'|'bet'|'raise'} facing - What action is being faced?
 * @returns {string} Contextual action label
 */
export const deriveContextAction = (primitive, isAgg, firstToAct, facing, primitives) => {
  if (facing === 'none' && firstToAct) {
    if (isAgg) return primitive === primitives.BET ? 'cbet' : 'check_give_up';
    return primitive === primitives.BET ? 'donk' : 'check';
  }

  if (facing === 'none' && !firstToAct) {
    if (primitive === primitives.BET) return 'stab';
    if (primitive === primitives.CHECK) return 'check_back';
  }

  if (facing === 'bet') {
    if (primitive === primitives.CALL) return 'call';
    if (primitive === primitives.RAISE) return 'raise';
    if (primitive === primitives.FOLD) return 'fold';
  }

  if (facing === 'raise') {
    if (primitive === primitives.CALL) return 'call_raise';
    if (primitive === primitives.RAISE) return 'reraise';
    if (primitive === primitives.FOLD) return 'fold_to_raise';
  }

  return primitive;
};

/**
 * Assemble all seven identity axes for one decision.
 *
 * THE point of this function is that there is exactly one of it. Every producer of a
 * situation key — villain accumulation, hero replay coaching, hero significance scoring —
 * goes through here, so a key from any of them is comparable to a key from any other.
 * That comparability is what WS-318 restored; it had never held.
 *
 * @param {Object} args
 * @param {Array}  args.streetActions - timeline entries for this street (caller-supplied)
 * @param {string|number|null} args.aggSeat - street aggressor seat (caller-supplied)
 * @param {Object} args.primitives - PRIMITIVE_ACTIONS (injected; pokerCore takes no constants dep)
 * @returns {{street,texture,posCategory,isAgg,isIP,facingAction,contextAction}}
 */
export const buildSpotAxes = ({
  street, texture = 'unknown', posCategory, playerSeat, entryOrder,
  primitive, streetActions = [], aggSeat = null, isIP = false, primitives,
}) => {
  const isAgg = aggSeat !== null && String(aggSeat) === String(playerSeat);
  const facing = deriveFacingAction(streetActions, entryOrder, playerSeat, primitives);
  const firstAct = isFirstToAct(streetActions, entryOrder, playerSeat, primitives);
  return {
    street,
    texture,
    posCategory,
    isAgg: isAgg ? 'agg' : 'def',
    isIP: isIP ? 'ip' : 'oop',
    facingAction: facing,
    contextAction: deriveContextAction(primitive, isAgg, firstAct, facing, primitives),
  };
};

/**
 * Human-readable names for `contextAction`, for anything shown to the founder.
 *
 * WS-318 acceptance: the weakness message used to render the raw `isAgg` axis, producing
 * "in flop agg spots" — not a phrase a poker player uses. These are the words for the thing
 * that actually happened at the table.
 */
export const CONTEXT_ACTION_LABELS = Object.freeze({
  cbet: 'c-bet',
  check_give_up: 'check-give-up',
  donk: 'donk-bet',
  check: 'check',
  stab: 'stab',
  check_back: 'check-back',
  call: 'call',
  raise: 'raise',
  fold: 'fold',
  call_raise: 'call-vs-raise',
  reraise: 're-raise',
  fold_to_raise: 'fold-to-raise',
});

/** Display name for a contextAction, falling back to the raw value. */
export const contextActionLabel = (contextAction) =>
  CONTEXT_ACTION_LABELS[contextAction] || contextAction;

/**
 * Do two situation keys describe the same spot for weakness-matching purposes?
 *
 * ONE definition, three call sites (`heroAnalysis.matchHeroWeakness` and both branches of
 * `handSignificance`). They were three copies of one idea and had already drifted; the
 * ticket's acceptance criteria require they cannot drift again.
 *
 * Matches on **street + contextAction** — the founder decision recorded on WS-318. The
 * discarded alternative was `isAgg`, which is what the code appeared to do but never
 * actually did: hero keys carried a primitive action in that slot, so the comparison was
 * `'bet' === 'agg'` and no hand in the app's history ever matched.
 *
 * Deliberately NOT matched on: texture (hero-side producers may not have computed a board
 * texture and pass 'unknown'), position, and IP — a leak is a leak wherever you sit, and
 * requiring all seven axes to agree would make matches vanishingly rare on live sample
 * sizes. Widen this only with a measurement attached.
 */
export const matchesWeaknessSpot = (keyA, keyB) => {
  const a = tryParseSituationKey(keyA);
  const b = tryParseSituationKey(keyB);
  if (!a || !b) return false;
  return a.street === b.street && a.contextAction === b.contextAction;
};
