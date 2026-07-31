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
 * Axes CARRIED with a decision but deliberately NOT part of bucket identity.
 * See the "carrying is not keying" note above before promoting any of these.
 */
export const CARRIED_AXES = Object.freeze([
  'sprBand',          // engine SPR zone — promote only with a measurement
  'playersRemaining', // per WS-274 this is WHO, not a count — resolve seats, do not tally
  'source',           // SRC-* id; registry requires provenance to survive the join
  'pool',             // stake + venue class; FSA cannot separate its Field surfaces without it
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
