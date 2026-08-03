/**
 * strategyCard.js — load, validate, and execute a Declared surface.
 *
 * A Strategy Card is a declared, enclosed, warranted rule set. The founder's definition is
 * the short one: "a strategy just needs to account for all your hands." Three things follow
 * from that and all three are enforced here rather than asked for politely:
 *
 *   1. DOMAIN. The card declares its scope. Outside it the card ABSTAINS EXPLICITLY, and the
 *      abstention is counted. A card that quietly returns nothing outside its domain looks
 *      identical to a card that had no opinion, and those are different facts.
 *   2. TOTAL COVERAGE inside the domain, which requires a RESIDUAL CLAUSE — the declared
 *      fallback for states the named rules do not reach. Loading a card without one FAILS.
 *      The residual's EV share is a headline metric: how much of the money comes from the
 *      part nobody designed.
 *   3. WARRANT per rule. See warrants.js.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY A CARD IS A JS MODULE AND NOT YAML.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The requirement is that a card be human-readable AND executable FROM ONE ARTIFACT — not a
 * doc plus a separate implementation that can drift. YAML would have satisfied that, but the
 * repo has no YAML parser and a Card must be loadable in the browser (WS-323's Entry Map is
 * preflop-chart-shaped and belongs in the app) as well as in the Node harness. Adding a
 * runtime dependency to parse a format we control is a worse trade than exporting a plain
 * object from a `.card.js` file, which needs no parser, allows comments, and imports natively
 * on both sides.
 *
 * A card is therefore code, which means a card COULD compute rather than declare. The loader
 * does not try to prevent that — it validates the exported shape strictly, so a clever card
 * still has to end up as a well-formed, enclosed, warranted rule list. `rationale` is a
 * REQUIRED FIELD rather than a comment for the same reason: prose that matters should be data.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * REJECTION IS HARD, FROM DAY ONE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * ADR-009 stages ENFORCEMENT of the repo-wide standard behind the instrument — the invariant
 * ships advisory and flips when WS-322 and WS-328 land (WS-329). That staging is about the
 * standard, not about this loader. There are no legacy Strategy Cards to grandfather, so a
 * malformed card is a bug at the author, today, and the loader throws. An invariant nothing
 * can check is worse than none; so is a loader that warns.
 */

import { hashObject } from '../contentHash.js';
import {
  IDENTITY_AXES,
  HERO_AXIS,
  HAND_AXIS,
  CARRIED_AXES,
} from '../pokerCore/situationKey.js';
import {
  SOR_SCHEMA_VERSIONS,
  SOR_SCHEMAS,
  StandardOfRecordError,
  checkAgainstSchema,
} from './schemas.js';
import { normalizeWarrant, warrantProblems, warrantWarnings } from './warrants.js';

/**
 * The only axes a rule may match on.
 *
 * A card whose rules key off anything else "creates a sixth ad-hoc coordinate system and is
 * inadmissible" (WS-322). The keystone argument from `situationKey.js` applies verbatim: all
 * frames must key off ONE definition of a spot, or comparing them compares coordinate systems
 * rather than surfaces. Carried axes are matchable too — they travel with a decision and are
 * queryable; what they must not do is change bucket IDENTITY, and matching a rule does not.
 *
 * `HAND_AXIS` is here for the same reason and with the same limit. A card that cannot name a
 * holding cannot express a preflop chart — `when: { handClass: 'AKo' }` threw before WS-323 —
 * and a preflop chart is the most basic Declared surface there is. It is matchable ONLY; it is
 * not in `IDENTITY_AXES`, never reaches the serialized key, and so re-partitions nothing. See
 * the note on `HAND_AXIS` in situationKey.js for why hero's holding is the query rather than
 * the bucket.
 */
export const MATCHABLE_AXES = Object.freeze([
  ...IDENTITY_AXES,
  HERO_AXIS,
  HAND_AXIS,
  ...CARRIED_AXES,
]);

/** Distributions are compared to 1 with this tolerance. Float sums of thirds do not land exactly. */
const SUM_TOLERANCE = 1e-9;

/**
 * Desugar a rule's action into a distribution.
 *
 * `do: 'raise'` becomes `{ raise: 1 }`. Founder decision 2026-08-02: distributions are the
 * wire format, a bare action is sugar for a point mass. The reason is that the ENGINE'S OWN
 * output is a distribution — it is how advice is emitted and how pi_ours is built — so a
 * format that could not express a mix would be a format in which the engine itself could
 * never be registered as a Declared surface and compared against a hand-authored card. That
 * comparison is the whole point of ADR-009.
 *
 * Human-executability is preserved by convention rather than by restricting the format: a
 * card meant to be played at a table simply never writes a mix.
 */
export const desugarAction = (spec, { ruleId = '?' } = {}) => {
  if (typeof spec === 'string') {
    if (!spec) throw new StandardOfRecordError(`rule "${ruleId}" has an empty action`);
    return { [spec]: 1 };
  }
  if (spec === null || typeof spec !== 'object' || Array.isArray(spec)) {
    throw new StandardOfRecordError(
      `rule "${ruleId}" action must be an action name or a distribution object`,
      { ruleId },
    );
  }
  const out = {};
  for (const [action, weight] of Object.entries(spec)) {
    if (typeof weight !== 'number' || !Number.isFinite(weight)) {
      throw new StandardOfRecordError(
        `rule "${ruleId}" gives action "${action}" a non-numeric weight`, { ruleId },
      );
    }
    if (weight < 0) {
      throw new StandardOfRecordError(
        `rule "${ruleId}" gives action "${action}" a negative weight`, { ruleId },
      );
    }
    out[action] = weight;
  }
  const keys = Object.keys(out);
  if (keys.length === 0) {
    throw new StandardOfRecordError(`rule "${ruleId}" has an empty action distribution`, { ruleId });
  }
  const sum = keys.reduce((acc, k) => acc + out[k], 0);
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    // NOT renormalized. A distribution that does not sum to 1 means the author believes
    // something the arithmetic does not support, and silently fixing it would delete the
    // evidence of that. Same posture as parseSituationKey throwing rather than guessing.
    throw new StandardOfRecordError(
      `rule "${ruleId}" action distribution sums to ${sum}, not 1`,
      { ruleId, sum },
    );
  }
  return out;
};

const normalizeRule = (rule, index) => {
  const ruleId = rule?.id ?? `#${index}`;

  if (rule === null || typeof rule !== 'object' || Array.isArray(rule)) {
    throw new StandardOfRecordError(`rule ${ruleId} must be an object`, { ruleId });
  }

  // The positional-string rejection. `when: 'flop:wet:BTN:...'` is the exact defect WS-317
  // removed from the engine — a key read by position, silently returning plausible wrong
  // answers when a dimension is added. A card may not reintroduce it.
  if (typeof rule.when === 'string') {
    throw new StandardOfRecordError(
      `rule "${ruleId}" matches on a positional string key. Use an object of named axes ` +
      `(${MATCHABLE_AXES.slice(0, 4).join(', ')}, ...) — a ':'-delimited key is the defect WS-317 removed.`,
      { ruleId },
    );
  }
  if (rule.when === null || typeof rule.when !== 'object' || Array.isArray(rule.when)) {
    throw new StandardOfRecordError(`rule "${ruleId}" must have a "when" object`, { ruleId });
  }

  const when = {};
  for (const [axis, value] of Object.entries(rule.when)) {
    if (!MATCHABLE_AXES.includes(axis)) {
      throw new StandardOfRecordError(
        `rule "${ruleId}" matches on unknown axis "${axis}". Legal axes: ${MATCHABLE_AXES.join(', ')}. ` +
        'An axis outside this list is a new coordinate system, which makes the card uncomparable.',
        { ruleId, axis },
      );
    }
    when[axis] = value;
  }

  const problems = warrantProblems(rule.warrant, { ruleId });
  if (problems.length) throw new StandardOfRecordError(problems[0], { ruleId });

  return {
    id: ruleId,
    when,
    action: desugarAction(rule.do ?? rule.action, { ruleId }),
    warrant: normalizeWarrant(rule.warrant),
    note: rule.note ?? null,
  };
};

/**
 * Load and validate a Strategy Card.
 *
 * Throws `StandardOfRecordError` on anything malformed. Returns a normalized card whose
 * `contentHash` has been STAMPED BY THE LOADER — never trusted from the source. A card that
 * could assert its own hash could assert a hash for content it does not have, which is the
 * one thing a content hash exists to make impossible.
 *
 * Async because hashing is (Web Crypto's digest is async and the browser path has to work).
 * `loadStrategyCardSync` below is available where a hash is not needed.
 */
export const loadStrategyCard = async (source) => {
  const card = loadStrategyCardSync(source);
  card.contentHash = await hashObject(canonicalCardBody(card));
  return card;
};

/**
 * The validated-but-unhashed load. Exported because the Node harness sometimes needs a card
 * synchronously, and because every rejection this module performs happens here — the hash is
 * a stamp, not a check.
 */
export const loadStrategyCardSync = (source) => {
  if (source === null || typeof source !== 'object' || Array.isArray(source)) {
    throw new StandardOfRecordError('a Strategy Card must be an object');
  }

  const schemaVersion = source.schemaVersion ?? SOR_SCHEMA_VERSIONS.strategyCard;
  if (schemaVersion > SOR_SCHEMA_VERSIONS.strategyCard) {
    throw new StandardOfRecordError(
      `Strategy Card declares schemaVersion ${schemaVersion}; this loader understands ` +
      `${SOR_SCHEMA_VERSIONS.strategyCard}. Refusing rather than duck-typing it.`,
      { schemaVersion },
    );
  }

  const draft = { ...source, schemaVersion };

  // ENCLOSURE IS CHECKED, NOT ASSERTED. This is the first thing verified because it is the
  // one a card is most likely to be missing: named rules are the interesting part to write
  // and the fallback is the part everyone means to come back to.
  if (!draft.residual || typeof draft.residual !== 'object' || Array.isArray(draft.residual)) {
    throw new StandardOfRecordError(
      'Strategy Card has no residual clause. A card must account for every state inside its ' +
      'declared domain, and the residual is the declared fallback for the ones the named rules ' +
      'do not reach. Its EV share is a headline metric — how much of the money comes from the ' +
      'part nobody designed — so it cannot be implicit.',
      { cardId: draft.cardId ?? null },
    );
  }

  const problems = checkAgainstSchema(draft, SOR_SCHEMAS.strategyCard, { label: 'strategyCard' });
  if (problems.length) {
    throw new StandardOfRecordError(
      `Strategy Card is missing required fields:\n  - ${problems.join('\n  - ')}`,
      { problems },
    );
  }

  if (!Array.isArray(draft.rules) || draft.rules.length === 0) {
    throw new StandardOfRecordError('Strategy Card must declare at least one rule');
  }

  const rules = draft.rules.map(normalizeRule);

  const seen = new Set();
  for (const rule of rules) {
    if (seen.has(rule.id)) {
      throw new StandardOfRecordError(
        `Strategy Card has two rules with id "${rule.id}". Rule ids appear in every Decision ` +
        'Atom, so a duplicate makes attribution ambiguous.',
        { ruleId: rule.id },
      );
    }
    seen.add(rule.id);
  }

  const residual = {
    action: desugarAction(draft.residual.do ?? draft.residual.action, { ruleId: 'residual' }),
    rationale: draft.residual.rationale ?? null,
  };

  const warnings = rules.flatMap((r) => warrantWarnings(r.warrant, { ruleId: r.id }));

  return {
    cardId: draft.cardId,
    schemaVersion,
    surfaceKind: 'Declared',
    title: draft.title,
    rationale: draft.rationale,
    domain: draft.domain,
    rules,
    residual,
    warnings,
    contentHash: null,
  };
};

/**
 * The canonical body a card's hash is taken over.
 *
 * Deliberately excludes `contentHash` (self-reference) and `warnings` (derived, and a future
 * lint improvement would silently change every card's hash). Includes `rationale` — the prose
 * IS part of the declared strategy, and a card whose reasons changed is a different card.
 */
export const canonicalCardBody = (card) => ({
  cardId: card.cardId,
  schemaVersion: card.schemaVersion,
  title: card.title,
  rationale: card.rationale,
  domain: card.domain,
  rules: card.rules.map((r) => ({
    id: r.id,
    when: r.when,
    action: r.action,
    warrant: { class: r.warrant.class, claim: r.warrant.claim },
  })),
  residual: card.residual,
});

/** Reasons a card declined to act. Counted, never silently skipped. */
export const ABSTAIN_REASONS = Object.freeze({
  OUT_OF_DOMAIN: 'out-of-domain',
  DOMAIN_UNKNOWN: 'domain-unknown',
});

const inDomain = (domain, situation) => {
  if (!domain || typeof domain !== 'object') return { ok: true };
  for (const [key, constraint] of Object.entries(domain)) {
    const value = situation[key];
    if (value === undefined || value === null) {
      // The query does not carry the field the domain constrains, so we cannot show the spot
      // is inside the domain. Abstaining and counting it is honest; assuming it is inside
      // would let a card silently claim coverage it never demonstrated.
      return { ok: false, reason: ABSTAIN_REASONS.DOMAIN_UNKNOWN, field: key };
    }
    if (Array.isArray(constraint)) {
      // A two-number array is a numeric range; anything else is a set of allowed values.
      const isRange = constraint.length === 2 && constraint.every((n) => typeof n === 'number');
      if (isRange) {
        if (typeof value !== 'number' || value < constraint[0] || value > constraint[1]) {
          return { ok: false, reason: ABSTAIN_REASONS.OUT_OF_DOMAIN, field: key };
        }
      } else if (!constraint.includes(value)) {
        return { ok: false, reason: ABSTAIN_REASONS.OUT_OF_DOMAIN, field: key };
      }
    } else if (constraint !== value) {
      return { ok: false, reason: ABSTAIN_REASONS.OUT_OF_DOMAIN, field: key };
    }
  }
  return { ok: true };
};

const ruleMatches = (rule, situation) =>
  Object.entries(rule.when).every(([axis, expected]) => {
    const actual = situation[axis];
    return Array.isArray(expected) ? expected.includes(actual) : expected === actual;
  });

/**
 * Execute the card at one situation.
 *
 * FIRST MATCH WINS, so rule ORDER IS SEMANTIC — which is why `canonicalCardBody` hashes the
 * rules as an ordered array and a reorder produces a different card.
 *
 * Returns the shape a Decision Atom stores: the action distribution, which rule produced it,
 * and that rule's warrant. `ruleId: null` with `residual: true` is how the residual clause
 * announces itself, and it is the signal the residual-EV-share metric is computed from.
 *
 * @param {Object} card - a loaded card
 * @param {Object} situation - axis values, plus whatever fields the card's domain constrains
 */
export const evaluateCard = (card, situation = {}) => {
  const domain = inDomain(card.domain, situation);
  if (!domain.ok) {
    return {
      action: null,
      ruleId: null,
      warrant: null,
      residual: false,
      abstained: true,
      reason: domain.reason,
      field: domain.field,
    };
  }

  for (const rule of card.rules) {
    if (ruleMatches(rule, situation)) {
      return {
        action: rule.action,
        ruleId: rule.id,
        warrant: rule.warrant,
        residual: false,
        abstained: false,
        reason: null,
      };
    }
  }

  return {
    action: card.residual.action,
    ruleId: null,
    warrant: null,
    residual: true,
    abstained: false,
    reason: null,
  };
};
