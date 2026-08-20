/**
 * conductCard.js — the record form for what ONE player DID, as a rule, in his own terms.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, AND WHY IT IS NOT A READ.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * FOUNDER, 2026-08-18: *"My read on a villain is that he'll overfold to me. This villain
 * profile has got zero elements of overfolding, overbetting, or overanything — it's his game
 * in his terms, and that makes it not a read."*
 *
 * The objection is structural. **"Over-" is a comparative operator**: overfold, overbet and
 * overcall each need a second argument — over relative to WHAT. A Conduct Card has no second
 * argument anywhere in it, so it cannot express a read even in principle, and that is the
 * property which makes it the canonical record rather than a limitation of it.
 *
 * Three objects, separated by what their second argument is:
 *
 *   | object        | second argument | example                            | form         |
 *   |---------------|-----------------|------------------------------------|--------------|
 *   | Conduct Card  | NONE            | "I fold 89% here"                  | THIS FILE    |
 *   | Appraisal     | a STANDARD      | "that fold was -EV"                | Result Card  |
 *   | Read          | HERO            | "he overfolds TO ME"               | Result Card  |
 *
 * Only the first makes no comparative claim, so only the first needs a new form: ADR-009
 * already binds the other two to Result Cards with declared `metrics` variants, and minting
 * card types for them would create the second comparison path the ADR forbids.
 *
 * PAIRED WITH THE STRATEGY CARD. A Strategy Card is a `Declared` surface — what someone SAYS
 * they will do, on purpose, with reasons. A Conduct Card is what a player DID. Same kind of
 * object, opposite provenance, which is why the names are siblings.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE `Read` SURFACE-KIND COLLISION — documented, not renamed.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `SURFACE_KINDS` carries `Read` = "what our model believes THIS villain does", which IS this
 * object: the register's DEFINITION is right and its WORD is wrong, because poker already uses
 * "read" for the relational claim. The enum is shipped and frozen and retyping it would break
 * the additive contract, so the collision is recorded here and in VOCABULARY.md instead.
 * **code-`Read` means Conduct.**
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHAT A CARD MUST DECLARE ABOUT ITS OWN IGNORANCE.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Two fields exist because of failures that actually happened, both on 2026-08-18:
 *
 * `separatorSearch` — a rule was published as a MIX ("nothing he could see separates this")
 * and an independent search over 113,704 OR-combinations refuted it at corrected p = 0.024.
 * The test was not wrong; it examined ONE FEATURE AT A TIME and the card did not say so. A
 * card that cannot state how hard it looked lets "no separator found" read as "no separator
 * exists" — WS-291's mechanism in miniature. Declaring the search arity is what makes a mix
 * verdict falsifiable rather than merely confident.
 *
 * `occupancy` — the card is dense where the subject played and silent where he did not. Any
 * best-response computed outside his occupancy walks into the holes and reports OUR missing
 * data as HIS weakness. The bound has to ride on the card, because the consumer that would
 * misuse it is exactly the one that will not think to ask.
 */

import {
  SOR_SCHEMA_VERSIONS,
  SOR_SCHEMAS,
  StandardOfRecordError,
  checkAgainstSchema,
} from './schemas.js';
import { REGISTER_VERSION_PATTERN } from './faultRegister.js';

/**
 * Why a rule's action split is not pure. A CLOSED list, and the wording of each verdict is
 * load-bearing — `mix` says what was searched, not what exists.
 *
 * These map onto the exception verdicts the villain-archetype specification already names
 * (`resolved-subrule` / `resolved-noise` / `unresolvable-here`); the mapping is stated so the
 * two vocabularies cannot drift into meaning different things.
 */
export const MIX_VERDICTS = Object.freeze({
  /** No exceptions at all. The only verdict permitted to use "always" or "never". */
  ALWAYS: 'always',
  /**
   * No separator was found AT THE DECLARED SEARCH ARITY. Spec analogue: `resolved-noise`,
   * with the null stated — and the null here is the arity, which is why `separatorSearch`
   * is required. NEVER to be reported as "nothing separates this".
   */
  MIX: 'mix',
  /**
   * A feature DOES separate it, but every cut lands under the sample floor. Spec analogue:
   * `resolved-subrule`. Actionable: it names the feature and the blocker is sample size.
   */
  HIDDEN_CONDITION: 'hidden-cond',
  /**
   * Nothing observable separates it, but the revealed holdings do. Spec analogue:
   * `unresolvable-here`, and it says what would resolve it: the range-inference layer,
   * never more corpus.
   */
  NEEDS_CARDS: 'needs-cards',
});

const VERDICT_VALUES = Object.freeze(Object.values(MIX_VERDICTS));
export const isMixVerdict = (v) => VERDICT_VALUES.includes(v);

/**
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * SIZING VOCABULARY (v3, WS-578) — the words, here; the boundaries, in the producer.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A rule's action distribution used to be over the action NAME alone, so a raise to 3.5bb and
 * a raise to 12bb were the same row. Measured on villain 2: `my_raise_to_bb` populated on
 * 1,676 of 1,676 aggressive actions and reaching the card on ZERO rules. That is not an
 * approximation gap — a simulator stepping an environment needs `(action, amount)`, so WS-580
 * and WS-582 both stall on it, and averaging two sizes describes a player who does not exist.
 *
 * WHY THE BOUNDARIES ARE NOT IN THIS FILE. `src/` must not import from `scripts/`, and the
 * lattice is a property of the corpus the producer measured, not of the record form. So the
 * numbers live in `scripts/villainArchetype/sizingBands.mjs` — and, more importantly, THEY
 * RIDE ON EVERY CARD (`card.sizingBanding.arms[].regimes`). A card carrying only a scheme name
 * and a version would still be silently re-basable by a later lattice change; a card carrying
 * its own boundary table cannot be. What this file owns is the closed vocabulary both sides
 * must agree on, and the structural refusals below.
 */
export const SIZING_REGIMES = Object.freeze({
  /** Preflop. A 0.5bb LATTICE in big blinds — 99.5% of observed preflop raises sit on it. */
  PREFLOP_BB: 'preflop-raise-to-bb',
  /**
   * Every other street. The cumulative amount he put the bet TO, over the pot INCLUDING the
   * live bet. Named on the card rather than assumed: `decisionLabeler` deleted a field that
   * conflated this with the incremental cost under a legend saying only "fraction of the pot".
   */
  POSTFLOP_POT_FRACTION: 'postflop-raise-to-over-pot',
});

const SIZING_REGIME_VALUES = Object.freeze(Object.values(SIZING_REGIMES));

/**
 * The cell for decisions of a sized action whose size could not be derived.
 *
 * NOT dropped and not merged into a neighbour. The bands must sum to the action's own k, which
 * is the same constraint the action distribution already satisfies against n — a missing size
 * silently absorbed somewhere is a sizing policy narrowed without anyone deciding to narrow it.
 */
export const SIZING_UNSIZED_BAND = 'unsized';

/** Actions that HAVE a size. Everything else carries `sizing: null`, explicitly. */
export const SIZED_ACTIONS = Object.freeze(['bet', 'raise']);

/**
 * Actions with no meaningful size — WS-578 AC2. `sizing: null` is a POSITIVE statement that no
 * sizing exists here; an absent key would mean "sizing was not recorded", and the two must stay
 * distinguishable forever (the same absent-vs-empty discriminator rule `omitted` follows on the
 * decision atom). A call is at a price someone else set; a fold and a check move no chips.
 */
export const UNSIZED_ACTIONS = Object.freeze(['fold', 'check', 'call']);

/**
 * THE CLOSED ENUM OF HELD-OUT REFUSALS (v4, WS-551).
 *
 * DECLARED HERE, IN `src/`, AND IMPORTED BY THE SCORER. The record form owns the vocabulary and
 * the instrument owns the method — the same direction the sizing lattice runs in, and the reason
 * is the one this directory has been bitten by twice: an enum written out in both places is two
 * representations that never have to agree, so the validator would eventually accept a reason the
 * producer no longer emits, or refuse one it does.
 *
 * A held-out score RANKS CARDS. It is therefore a number someone acts on and cites — a
 * comparative claim, which per `.claude/rules/sparsity-refuse-or-shrink.md` REFUSES rather than
 * shrinking. The refusal is NAMED, never a blank and never a small number that reads measured.
 */
export const HELD_OUT_REFUSAL_REASONS = Object.freeze({
  INSUFFICIENT_FIT: 'insufficient-fit-decisions',
  INSUFFICIENT_EVAL_HANDS: 'insufficient-eval-hands',
  INSUFFICIENT_EVAL_DECISIONS: 'insufficient-eval-decisions',
  DEGENERATE_SPLIT: 'degenerate-split',
  COVERAGE_BELOW_FLOOR: 'coverage-below-floor',
  CARD_NOT_EVALUABLE: 'card-not-evaluable',
  NO_INDUCED_RULES: 'no-induced-rules',
});
const HELD_OUT_REFUSAL_SET = new Set(Object.values(HELD_OUT_REFUSAL_REASONS));
export const isHeldOutRefusal = (r) => HELD_OUT_REFUSAL_SET.has(r);

/**
 * THREE VALUES, NOT TWO. An interval wholly BELOW zero means the BASELINE beat the card, which is
 * the most consequential thing this instrument can report — and a better/not-better label would
 * file it under "no lift" and lose it. It happened on the first real run.
 */
export const HELD_OUT_VERDICTS = Object.freeze(['card-better', 'card-worse', 'inconclusive']);

/** The two orders a hand sequence can be in. `arrival` is NOT time and must never read as it. */
export const HELD_OUT_SPLIT_BASES = Object.freeze(['day+arrival', 'arrival']);

/** The record form's own kind tag, so a foreign object cannot land in this field. */
export const HELD_OUT_SCORE_KIND = 'conduct-card-held-out-score';

/** Spec-vocabulary equivalents, so the two registers cannot silently diverge. */
export const VERDICT_SPEC_ANALOGUE = Object.freeze({
  always: null,
  mix: 'resolved-noise',
  'hidden-cond': 'resolved-subrule',
  'needs-cards': 'unresolvable-here',
});

/**
 * Build one MIX — a spot, and the FULL distribution of what he did in it.
 *
 * FOUNDER, 2026-08-18: *"If we allow for a rule to be to mix, then we will have a new shape of
 * rule that allows us to still be precise at lower rule count and less statistical variance by
 * just giving it a mixing %."*
 *
 * Measured the moment it was wired: 34 rules -> 15, coverage unchanged at 100%, accuracy
 * 83.0% -> 84.4%, rules with an interval wider than 30pp 4 -> 1.
 *
 * The residue is NEVER discarded. A rule reporting a majority action and dropping the rest is
 * rejected by `conductCardProblems`, not merely flagged — the founder's standing rule 5 is
 * that a rule's residue IS his range in that spot, and it is the most informative part of the
 * row.
 */
/**
 * Freeze one action's sizing block, refusing a banding that has dropped decisions.
 *
 * The throw is deliberate and it mirrors the residue throw one level up. WS-578's first accept
 * criterion asks for exactly this symmetry: "the bands sum to the action's own k — enforced by
 * a throw, the same way `buildMix` already refuses an action distribution that does not sum to
 * n. A dropped residue here is a silently narrowed sizing policy."
 *
 * Both arms are checked, not just the primary. An alternate arm that quietly lost rows would
 * make the arm DELTA — which `unmeasured-constants.md` requires be reported as a result — a
 * measurement of the bug rather than of the banding.
 */
const freezeSizing = (sizing, { ruleId, action, k }) => {
  if (sizing == null) return null;
  if (typeof sizing !== 'object') {
    throw new StandardOfRecordError('sizing must be an object or explicitly null', { ruleId, action });
  }
  for (const key of ['bands', 'altBands']) {
    const bands = sizing[key];
    if (bands === undefined && key === 'altBands') continue;
    if (!Array.isArray(bands) || bands.length === 0) {
      throw new StandardOfRecordError(`sizing.${key} must be a non-empty array of bands`, { ruleId, action });
    }
    const summed = bands.reduce((s, b) => s + (b.k || 0), 0);
    if (summed !== k) {
      throw new StandardOfRecordError(
        `sizing.${key} must account for every decision of this action — a dropped residue here `
        + 'is a silently narrowed sizing policy',
        { ruleId, action, k, summed },
      );
    }
  }
  const freezeBands = (bands) => Object.freeze(bands.map((b) => Object.freeze({ ...b })));
  return Object.freeze({
    ...sizing,
    bands: freezeBands(sizing.bands),
    ...(sizing.altBands ? { altBands: freezeBands(sizing.altBands) } : {}),
  });
};

export const buildMix = ({
  ruleId,
  when,
  n,
  actions,
  verdict,
  separators = [],
  shown = [],
  streets = null,
}) => {
  if (!ruleId) throw new StandardOfRecordError('mix requires a ruleId');
  if (!Array.isArray(actions) || actions.length === 0) {
    throw new StandardOfRecordError('mix requires at least one action', { ruleId });
  }
  if (!isMixVerdict(verdict)) {
    throw new StandardOfRecordError('mix verdict must be on the closed list', {
      ruleId, verdict, legal: VERDICT_VALUES,
    });
  }
  const total = actions.reduce((s, a) => s + a.k, 0);
  if (total !== n) {
    // The residue is the range. A distribution that does not sum to its own denominator has
    // dropped decisions somewhere, and dropped decisions are exactly what this form forbids.
    throw new StandardOfRecordError('mix actions must account for every decision in the leaf', {
      ruleId, n, summed: total,
    });
  }
  return Object.freeze({
    ruleId,
    when,
    n,
    actions: Object.freeze(actions.map((a) => Object.freeze({
      action: a.action,
      k: a.k,
      rate: a.k / n,
      ci: Object.freeze([a.ci[0], a.ci[1]]),
      // ABSENT vs NULL is load-bearing (WS-578 AC2). Absent = this card predates sizing, or
      // its producer did not record any. Null = "no sizing exists for this action", stated
      // positively. Only a caller that passes the key at all gets one of the two.
      ...('sizing' in a
        ? { sizing: freezeSizing(a.sizing, { ruleId, action: a.action, k: a.k }) }
        : {}),
    }))),
    verdict,
    specAnalogue: VERDICT_SPEC_ANALOGUE[verdict],
    separators: Object.freeze(separators.map((s) => Object.freeze({ ...s }))),
    shown: Object.freeze(shown.map((s) => Object.freeze({ ...s }))),
    streets: streets ? Object.freeze({ ...streets }) : null,
  });
};

/**
 * Build a Conduct Card.
 *
 * Every argument is required for the same reason the Result Card's manifest fields are: the
 * failure this form exists inside of was never a wrong number, it was a number nobody could
 * re-derive well enough to tell that it was wrong.
 */
export const buildConductCard = ({
  cardId,
  subjectId,
  dealBook,
  evidence,
  rules,
  residual,
  unresolved,
  separatorSearch,
  induction,
  gates,
  occupancy,
  manifest,
  disclaimerRegisterVersion,
  population,
  provenance = null,
  rulesetHash = null,
  sizingBanding = null,
  score = null,
}) => {
  const card = {
    cardId,
    /**
     * The ruleset as an identity: a hash of the sorted set of content-addressed rule ids.
     * Order-independent, so two runs that find the same spots in a different order agree.
     *
     * It exists because `cardId` used to be a slug of `subjectId` alone — every re-derivation
     * of a subject produced the same id, and five cards for one subject with 19, 25, 18, 18 and
     * 25 rules all claimed to be the same card. An id that cannot distinguish two cards cannot
     * be cited by anything downstream.
     */
    rulesetHash,
    schemaVersion: SOR_SCHEMA_VERSIONS.conductCard,
    subjectId,
    // See the collision note in the header: the shipped enum value for this object is `Read`.
    surfaceKind: 'Read',
    dealBook,
    evidence,
    rules,
    residual,
    // Recorded as a constant, never computed, so nobody reads it as an achievement: the last
    // rule is always "everything else", so coverage is 1 by construction and rule count is
    // the quantity that carries information.
    coverage: 1,
    unresolved,
    separatorSearch,
    induction,
    gates,
    occupancy,
    manifest,
    disclaimerRegisterVersion,
    contentHash: null,
    population,
    // The era coordinates (v2). `population` is prose and prose does not sort; a trajectory
    // has to be plotted against something that does.
    provenance,
    /**
     * v3 (WS-578) — THE SIZING LATTICE, carried ON the card rather than looked up.
     *
     * Null is a positive declaration that this card records no sizing at all, which is a
     * different fact from a card that predates the field. Both arms' full boundary tables ride
     * here, so a later lattice change cannot silently re-base a stored card, and the shrinkage
     * declaration rides here too, so a consumer reading only the header still learns that the
     * per-band values are posterior means and not counts.
     */
    sizingBanding,
    /**
     * v4 (WS-551) — THE HELD-OUT SCORE, the only number on this object that could ever fall.
     *
     * Null is the positive declaration that this card was never scored, which is a different fact
     * from a v3 card that could not be. A producer that has a score stamps it here rather than in
     * a file beside the card: a sidecar and a card are two objects that can be separated, and the
     * figure that ranks a card belongs to the card.
     */
    score,
  };
  const problems = conductCardProblems(card);
  if (problems.length) {
    throw new StandardOfRecordError('conduct card is not valid', { cardId, problems });
  }
  return card;
};

/**
 * The sizing refusals for ONE action of ONE rule (v3, WS-578).
 *
 * GATED ON THE CARD DECLARING A BANDING, deliberately. A v2 card carries no sizing anywhere
 * and must not start failing because a later schema grew a field — that is the additive
 * contract. But the moment a card declares `sizingBanding`, EVERY action must say what it does
 * about sizing, because a card that records sizing on some actions and silently omits it on
 * others is the shape that makes "he never bets big here" indistinguishable from "we did not
 * write it down".
 *
 * The version check is the anti-re-basing one. A band cell measured under S2 v1 is not a cell
 * of S2 v2, and a reader that quietly accepted the mismatch would be comparing two lattices
 * while reporting one — WS-291's mechanism, which is the reason this whole directory exists.
 */
const sizingProblems = (card, rule, action) => {
  const problems = [];
  const banding = card?.sizingBanding;
  if (!banding) {
    // `sizing: null` is always legal — it says "this action has no size", which is true whether
    // or not the card banded anything. A subject who never bet or raised produces a card with
    // no banding AND an explicit null on every action, and that card is correct.
    if (action.sizing !== undefined && action.sizing !== null) {
      problems.push(
        `rule ${rule.ruleId}, action ${action.action}: carries a sizing block but the card `
        + 'declares no sizingBanding — the lattice a band was measured on must ride on the card, '
        + 'or nothing downstream can tell which boundaries the cell means',
      );
    }
    return problems;
  }

  const where = `rule ${rule.ruleId}, action ${action.action}`;
  if (action.sizing === undefined) {
    problems.push(
      `${where}: the card declares a sizingBanding, so every action must state its sizing — `
      + 'null for an action that has none, an object for one that does. An absent key makes '
      + '"no size exists" and "we did not record it" the same value.',
    );
    return problems;
  }

  const isSized = SIZED_ACTIONS.includes(action.action);
  if (action.sizing === null) {
    // AC2: fold / check / call carry null EXPLICITLY. A bet or raise may not.
    if (isSized) {
      problems.push(`${where}: a ${action.action} has a size and it is populated on every observed one — null here discards it`);
    }
    return problems;
  }
  if (!isSized && !UNSIZED_ACTIONS.includes(action.action)) {
    // An action neither list knows about. Reported rather than assumed either way.
    problems.push(`${where}: action is on neither the sized nor the unsized list — say which it is before banding it`);
  } else if (!isSized) {
    problems.push(`${where}: ${action.action} moves no chips at a price it chose, so a sizing distribution over it is a category error — use null`);
  }

  const s = action.sizing;
  /**
   * A CELL IS `(regime, band)`, NOT `band`. Induced rules span streets — villain 2 has leaves
   * carrying `["preflop","flop"]` and `["turn","preflop","flop","river"]` — so one (rule,
   * action) genuinely holds decisions measured in both regimes. Every band therefore names its
   * own regime, and a band that does not is refused: a preflop 3.5bb cell sitting unlabelled
   * beside a 0.6x flop cell makes a bb lattice and a pot fraction look commensurable, which is
   * exactly the pooling the two-regime split exists to prevent.
   */
  if (!Array.isArray(s.regimes) || s.regimes.length === 0
      || s.regimes.some((x) => !SIZING_REGIME_VALUES.includes(x))) {
    problems.push(`${where}: sizing.regimes must list which of ${SIZING_REGIME_VALUES.join(' / ')} this action's decisions were measured in`);
  }

  const armFor = (id) => (banding.arms || []).find((x) => x && x.scheme === id) || null;
  const primary = armFor(s.scheme);
  if (!primary) {
    problems.push(`${where}: sizing.scheme "${s.scheme}" is not one of the arms the card declares`);
  } else if (s.schemeVersion !== primary.version) {
    problems.push(
      `${where}: banded under ${s.scheme} v${s.schemeVersion} but the card declares `
      + `${s.scheme} v${primary.version}. REFUSED rather than re-read — cells measured under one `
      + 'lattice are not cells of another.',
    );
  }

  // The residue, again, at read time. `buildMix` throws on it at author time; a card that
  // arrived from disk never went through `buildMix`, and the check that only runs on the write
  // path is the check that is not there when it matters.
  const checkBands = (bands, label, armId) => {
    if (!Array.isArray(bands) || bands.length === 0) {
      problems.push(`${where}: sizing.${label} is empty — a sized action with no band distribution records nothing`);
      return;
    }
    const summed = bands.reduce((x, b) => x + (b.k || 0), 0);
    if (summed !== action.k) {
      problems.push(`${where}: sizing.${label} sums to ${summed} but the action's k is ${action.k} — decisions were dropped`);
    }
    const arm = armFor(armId);
    const unsized = banding.unsizedBand || SIZING_UNSIZED_BAND;
    for (const b of bands) {
      if (!SIZING_REGIME_VALUES.includes(b.regime)) {
        problems.push(`${where}: sizing.${label} band "${b.band}" does not name a regime on the closed list — a bb lattice cell and a pot-fraction cell are not comparable and must never sit unlabelled in one list`);
      } else if (arm) {
        const legal = new Set([...(arm.regimes?.[b.regime] || []).map((x) => x.name), unsized]);
        if (!legal.has(b.band)) {
          problems.push(`${where}: sizing.${label} band "${b.band}" is not in the ${armId} table the card declares for ${b.regime}`);
        }
      }
      if (!Array.isArray(b.ci) || b.ci.length !== 2) {
        problems.push(`${where}: sizing.${label} band "${b.band}" ships no interval — every rate carries one, and a band rate is a rate`);
      }
      if (b.shrunk !== true) {
        // Every band value on this card IS a posterior mean toward its parent
        // (`.claude/rules/sparsity-refuse-or-shrink.md` — a sizing band is a decision input, so
        // the operation is shrink, not refuse). A band that does not say so would let a shrunk
        // number reach a surface looking measured, which is the exact indistinguishability the
        // rule exists to prevent: class is set by where the number ENDS UP.
        problems.push(`${where}: sizing.${label} band "${b.band}" does not carry the shrunk flag — a shrunk value that reaches a surface unmarked is indistinguishable from a measured one`);
      }
      if (b.shrunk === true && !b.shrunkToward) {
        problems.push(`${where}: sizing.${label} band "${b.band}" is marked shrunk but does not name its parent`);
      }
    }
  };
  checkBands(s.bands, 'bands', s.scheme);
  if (s.altBands !== undefined) checkBands(s.altBands, 'altBands', s.altScheme);

  return problems;
};

/**
 * The card-level sizing declaration. Separate from the per-action checks because a malformed
 * header invalidates every band under it, and reporting that once beats reporting it per rule.
 */
const sizingBandingProblems = (card) => {
  const b = card?.sizingBanding;
  if (b === undefined) {
    return ['sizingBanding is required (v3) — null is the positive declaration that this card records no sizing, and an absent key cannot be told apart from a producer that forgot'];
  }
  if (b === null) return [];
  const problems = [];
  if (!Array.isArray(b.arms) || b.arms.length === 0) {
    problems.push('sizingBanding.arms must list the banding arms — both are real arms per `unmeasured-constants.md`, and a card carrying one cannot report a delta');
    return problems;
  }
  for (const arm of b.arms) {
    if (!arm || typeof arm !== 'object') { problems.push('sizingBanding: an arm is not an object'); continue; }
    if (!arm.scheme) problems.push('sizingBanding: an arm does not name its scheme');
    if (!Number.isInteger(arm.version)) problems.push(`sizingBanding: arm ${arm.scheme} has no integer version — the version is what a loader refuses on`);
    if (!arm.regimes || typeof arm.regimes !== 'object') {
      problems.push(`sizingBanding: arm ${arm.scheme} carries no boundary table. A scheme name and a version can be re-based silently; a boundary table on the card cannot.`);
      continue;
    }
    for (const [regime, bands] of Object.entries(arm.regimes)) {
      if (!SIZING_REGIME_VALUES.includes(regime)) {
        problems.push(`sizingBanding: arm ${arm.scheme} declares unknown regime "${regime}"`);
      }
      if (!Array.isArray(bands) || bands.length === 0) {
        problems.push(`sizingBanding: arm ${arm.scheme} regime ${regime} has no bands`);
        continue;
      }
      // TOTALITY. A gap between two bands is a value that vanishes, and a vanished value is
      // exactly what the residue check downstream would then be unable to see.
      for (let i = 1; i < bands.length; i += 1) {
        if (bands[i].lo !== bands[i - 1].hi) {
          problems.push(`sizingBanding: arm ${arm.scheme} regime ${regime} is not a partition — band "${bands[i - 1].name}" ends at ${bands[i - 1].hi} and "${bands[i].name}" starts at ${bands[i].lo}; a value in the gap would be silently dropped`);
        }
      }
      if (bands[bands.length - 1].hi !== null) {
        problems.push(`sizingBanding: arm ${arm.scheme} regime ${regime} has a bounded top band — the tail must be open, or a size above it has nowhere to go`);
      }
    }
  }
  if (!b.primary || !b.arms.some((a) => a && a.scheme === b.primary)) {
    problems.push('sizingBanding.primary must name one of the declared arms — which arm a consumer takes is a DECLARED choice, never an implicit default that drifts');
  }
  if (!b.delta) {
    problems.push('sizingBanding.delta is required — `unmeasured-constants.md`: the difference between the arms IS the result, and a delta computed and not reported is the thing that rule forbids');
  }
  if (!b.shrinkage || typeof b.shrinkage !== 'object') {
    problems.push('sizingBanding.shrinkage is required — every band value on the card is a posterior mean, and a reader of the header must learn that without descending into a rule');
  }
  if (!b.conventions) {
    problems.push('sizingBanding.conventions is required — the postflop fraction has a numerator and a denominator that the repo has already conflated once, so the card states which it used');
  }
  return problems;
};

const isFinite_ = (x) => typeof x === 'number' && Number.isFinite(x);

/**
 * THE HELD-OUT SCORE (v4, WS-551) — the only figure on this card that could ever fall.
 *
 * Gated on the field being PRESENT, so a v3 card keeps validating: the additive contract means a
 * card written before the field existed must not start failing because a later schema grew one.
 * `null` is the positive declaration that this card was never scored.
 *
 * WHAT EACH CLAUSE STOPS, because every one of them is a way to publish a number that cannot lose:
 *
 *   REFUSED CARRIES NO BITS. A refusal that still ships figures is the defect, not a lenient
 *   version of one — it lets a number produced under an n the instrument declared unusable travel
 *   as though it had been measured, which is exactly the indistinguishability
 *   `sparsity-refuse-or-shrink.md` exists to remove.
 *
 *   `rankingMetric` NAMES `bits.complete`. `covered` scores only the rows the card governs, so a
 *   card that refused everything it was unsure of would score beautifully on it. `complete` scores
 *   every held-out row, off-support ones by the declared fallback, so refusing cannot improve it.
 *   A card ranked on `covered` is a card rewarded for declining to answer.
 *
 *   EVERY VERDICT HAS AN INTERVAL BEHIND IT. A verdict key with no matching `liftInterval` key is
 *   an assertion wearing a measurement's clothes — the same defect as the in-sample accuracy this
 *   whole field replaces, one level up.
 *
 *   THE SEED AND THE CUTS ARE IN THE MANIFEST. ADR-009's replication clause: the bootstrap draws
 *   randomness and the fold boundaries are load-bearing constants, so a card whose manifest omits
 *   them carries an interval nobody can ever redraw. A figure that cannot be re-derived is not a
 *   slightly worse figure; it is one nobody can tell is wrong.
 */
const scoreProblems = (card) => {
  const s = card?.score;
  if (s === undefined || s === null) return [];
  if (typeof s !== 'object' || Array.isArray(s)) return ['score must be an object or null'];

  const problems = [];
  if (s.kind !== HELD_OUT_SCORE_KIND) {
    problems.push(`score.kind must be "${HELD_OUT_SCORE_KIND}" — an untagged object in this field could be any number at all`);
  }
  if (!Number.isInteger(s.version) || s.version < 1) {
    problems.push('score.version must be a positive integer — the record form versions independently of the card');
  }

  const bitsKeys = (s.bits && typeof s.bits === 'object') ? Object.keys(s.bits) : [];
  if (!Object.prototype.hasOwnProperty.call(s, 'refused')) {
    problems.push('score.refused is required — null is the positive claim that the score ran, and an absent key cannot be told apart from a producer that forgot');
    return problems;
  }

  // ── the refusal path: a name, and no numbers ──
  if (s.refused !== null) {
    if (typeof s.refused !== 'object' || Array.isArray(s.refused)) {
      problems.push('score.refused must be null or an object carrying {reason, detail}');
      return problems;
    }
    if (!isHeldOutRefusal(s.refused.reason)) {
      problems.push(`score.refused.reason "${s.refused.reason}" is not on the closed list `
        + `(${Object.values(HELD_OUT_REFUSAL_REASONS).join(', ')}) — an unnamed refusal is a blank, and a blank is what this field exists to replace`);
    }
    if (typeof s.refused.detail !== 'string' || !s.refused.detail) {
      problems.push('score.refused.detail must say WHICH n fell short of WHICH floor — a reason code alone cannot be acted on');
    }
    if (bitsKeys.length) {
      problems.push('score.refused is set but score.bits carries numbers — a refusal that still ships figures is the defect: the number travels as though it were measured under an n the instrument itself declared unusable');
    }
    for (const k of ['lift', 'liftInterval', 'verdict']) {
      if (s[k] && typeof s[k] === 'object' && Object.keys(s[k]).length) {
        problems.push(`score.refused is set but score.${k} carries entries — same defect as bits: nothing was scored, so nothing may be compared`);
      }
    }
    return problems;
  }

  // ── the scored path ──
  if (s.unit !== 'bits/decision') {
    problems.push(`score.unit must be "bits/decision" — a unit change is a retype in disguise and every figure under it silently rescales (got "${s.unit}")`);
  }
  if (typeof s.scoringRule !== 'string' || !s.scoringRule) {
    problems.push('score.scoringRule must name the rule — log-loss is strictly proper and accuracy is not, and a reader cannot tell which produced the number without being told');
  }
  if (typeof s.rankingMetric !== 'string' || !/bits\.complete/.test(s.rankingMetric) || /bits\.covered/.test(s.rankingMetric)) {
    problems.push(`score.rankingMetric must name bits.complete and never bits.covered (got "${s.rankingMetric}") — refusing more decisions cannot improve \`complete\`, which is the only reason a card cannot score well by declining to answer`);
  }

  if (!s.bits || typeof s.bits !== 'object' || !s.bits.complete || typeof s.bits.complete !== 'object'
      || !s.bits.covered || typeof s.bits.covered !== 'object') {
    problems.push('score.bits must carry BOTH {complete, covered} — `covered` is the diagnostic and `complete` is the ranking number, and reporting one without the other loses the distinction that makes refusal unrewarding');
    return problems;
  }
  if (!isFinite_(s.bits.complete.card) || s.bits.complete.card < 0) {
    problems.push(`score.bits.complete.card must be a finite number >= 0 (got ${s.bits.complete.card}) — bits are a negative log2 of a probability, so a negative mean is impossible and an Infinity means a model assigned zero to something that happened`);
  }

  const intervals = (s.liftInterval && typeof s.liftInterval === 'object') ? s.liftInterval : null;
  const verdicts = (s.verdict && typeof s.verdict === 'object') ? s.verdict : null;
  if (!intervals || !verdicts) {
    problems.push('score.liftInterval and score.verdict are both required — a difference in mean bits with no interval is not a claim, and a verdict is the interval read out');
  } else {
    const ik = Object.keys(intervals).sort();
    const vk = Object.keys(verdicts).sort();
    if (ik.join('|') !== vk.join('|')) {
      problems.push(`score.verdict keys [${vk.join(', ')}] do not match score.liftInterval keys [${ik.join(', ')}] — a verdict with no interval behind it is an assertion, and an interval with no verdict leaves the reading to whoever renders it`);
    }
    if (!ik.length) {
      problems.push('score.liftInterval is empty — a bits figure with no named comparator means nothing; "0.93 bits/decision" is not a result until something else has been scored on the same rows');
    }
    for (const [k, ci] of Object.entries(intervals)) {
      if (!ci || typeof ci !== 'object') { problems.push(`score.liftInterval.${k} is not an object`); continue; }
      if (!isFinite_(ci.diff) || !isFinite_(ci.lo) || !isFinite_(ci.hi)) {
        problems.push(`score.liftInterval.${k} must carry finite {diff, lo, hi}`);
      } else if (ci.lo > ci.hi) {
        problems.push(`score.liftInterval.${k} has lo ${ci.lo} above hi ${ci.hi}`);
      }
      if (!isFinite_(ci.seed)) {
        problems.push(`score.liftInterval.${k} carries no seed — an interval that cannot be redrawn is reproducible only by luck`);
      }
      if (!Number.isInteger(ci.resamples) || ci.resamples < 1) {
        problems.push(`score.liftInterval.${k}.resamples must be a positive integer`);
      }
      if (ci.unit !== 'hand') {
        problems.push(`score.liftInterval.${k}.unit must be "hand" — decisions inside a hand are not independent, so a decision-resampled interval is narrower than the data supports`);
      }
      if (!isFinite_(s.bits.complete[k])) {
        problems.push(`score.liftInterval.${k} has no matching score.bits.complete.${k} — the interval compares the card against a baseline whose own bits are not on the record`);
      }
      if (!s.lift || !isFinite_(s.lift[k])) {
        problems.push(`score.lift.${k} is missing or not finite — the point estimate the interval is around must be on the record beside it`);
      }
    }
    for (const [k, v] of Object.entries(verdicts)) {
      if (!HELD_OUT_VERDICTS.includes(v)) {
        problems.push(`score.verdict.${k} "${v}" is not on the closed three-value list (${HELD_OUT_VERDICTS.join(', ')}) — two values would file "the baseline BEAT the card" under "no lift" and lose it`);
      }
    }
  }

  const cov = s.coverage;
  if (!cov || typeof cov !== 'object') {
    problems.push('score.coverage is required — the ranking number scores off-support rows by a fallback, so how much of the eval set the card actually governed is what says whether it measured the card or the fallback');
  } else {
    for (const k of ['evalDecisions', 'covered', 'offSupport']) {
      if (!isFinite_(cov[k])) problems.push(`score.coverage.${k} must be a count`);
    }
    if (!isFinite_(cov.share) || cov.share < 0 || cov.share > 1) {
      problems.push(`score.coverage.share must be a fraction in [0, 1] (got ${cov.share})`);
    }
    if (typeof cov.fallback !== 'string' || !cov.fallback) {
      problems.push('score.coverage.fallback must NAME what scored the off-support rows — an unnamed fallback lets a reader assume the rows were dropped, which is the version of this instrument that rewards refusing');
    }
  }

  const split = s.split;
  if (!split || typeof split !== 'object') {
    problems.push('score.split is required — a held-out number without its split is unreadable');
  } else {
    if (split.unit !== 'hand') {
      problems.push('score.split.unit must be "hand" — one holding drives a hand\'s flop, turn and river, so a by-decision split puts the same holding on both sides and grades the model on rows correlated with its own fit block');
    }
    if (!Array.isArray(split.cuts) || !split.cuts.length || !split.cuts.every(isFinite_)) {
      problems.push('score.split.cuts must list the fold boundaries — they set which rows were fit and which were scored, so they are load-bearing constants');
    } else {
      const ok = split.cuts.every((c, i) => c > 0 && c < 1 && (i === 0 || c > split.cuts[i - 1]));
      if (!ok) problems.push(`score.split.cuts must be strictly ascending within (0, 1) — got [${split.cuts.join(', ')}]`);
    }
    if (!HELD_OUT_SPLIT_BASES.includes(split.basis)) {
      problems.push(`score.split.basis must be one of ${HELD_OUT_SPLIT_BASES.join(' / ')} — "arrival" is corpus order and NOT time, and a walk-forward claim resting on it is a fallback passing as a measurement`);
    }
  }

  if (!s.floors || typeof s.floors !== 'object') {
    problems.push('score.floors is required — the n below which this instrument refuses is a chosen constant, and a score that does not carry it cannot be compared to one run under different floors');
  }
  if (!s.seam || typeof s.seam !== 'object' || typeof s.seam.scores !== 'string' || typeof s.seam.doesNotScore !== 'string') {
    problems.push('score.seam must state what was scored and what was NOT — the shipped ruleset is induced on ALL of the subject\'s decisions and therefore has no held-out data left; what this number grades is the same INDUCER refit per fold, and a card that let the two read as one identity would publish an out-of-sample figure about an in-sample object');
  }

  // ── ADR-009's replication clause ──
  const m = card?.manifest;
  const seedValues = (m && typeof m.seeds === 'object' && m.seeds) ? Object.values(m.seeds) : null;
  if (!seedValues) {
    problems.push('score is present but manifest.seeds is missing — the bootstrap draws randomness, and a seed that is never recorded is reproducible only by luck (ADR-009)');
  } else if (intervals) {
    for (const [k, ci] of Object.entries(intervals)) {
      if (isFinite_(ci?.seed) && !seedValues.includes(ci.seed)) {
        problems.push(`score.liftInterval.${k}.seed ${ci.seed} does not appear in manifest.seeds — the manifest is where a replication looks, and a seed living only on the figure it produced is not part of the manifest at all`);
      }
    }
  }
  const constValues = (m && typeof m.constants === 'object' && m.constants) ? Object.values(m.constants) : null;
  if (!constValues) {
    problems.push('score is present but manifest.constants is missing — the fold cuts are load-bearing constants and ADR-009 requires them read from the manifest, not from the number');
  } else if (Array.isArray(split?.cuts)) {
    const want = JSON.stringify(split.cuts);
    if (!constValues.some((v) => JSON.stringify(v) === want)) {
      problems.push(`score.split.cuts [${split.cuts.join(', ')}] do not appear in manifest.constants — a different cut set is a different question, and a manifest that cannot state which one ran cannot replicate the answer`);
    }
  }

  return problems;
};

/**
 * Everything wrong with a candidate card, as a list. Returns [] for a valid one.
 *
 * Returns rather than throws so a caller can report every problem at once — the same choice
 * `manifestProblems` and `resultCardProblems` make, and for the same reason: an author fixing
 * one error at a time through six round trips stops fixing them.
 */
export const conductCardProblems = (card) => {
  /**
   * `{ label }`, NOT a bare string. `checkAgainstSchema` destructures its third argument
   * (`schemas.js`: `({ label = 'object' } = {})`), so passing `'conductCard'` destructured a
   * string, found no `label` property, and fell through to the default. Every schema problem
   * this validator has ever emitted was therefore prefixed `object.` — "object.population is
   * required" — which names nothing and is exactly as useless on a Conduct Card as on a Result
   * Card, a census or a manifest. The messages looked fine, so nobody read them closely enough
   * to notice they could not identify what had failed. Fixed 2026-08-20 (WS-578).
   */
  const problems = checkAgainstSchema(card, SOR_SCHEMAS.conductCard, { label: 'conductCard' }) || [];
  if (!card || typeof card !== 'object') return problems.length ? problems : ['not an object'];

  if (card.schemaVersion !== SOR_SCHEMA_VERSIONS.conductCard) {
    problems.push(`schemaVersion ${card.schemaVersion} is not ${SOR_SCHEMA_VERSIONS.conductCard}`);
  }
  if (card.coverage !== 1) {
    problems.push('coverage must be exactly 1 — it is 1 by construction, and any other value means the residual clause is missing');
  }

  // ── the sizing lattice (v3), before the rules that are banded on it ──
  problems.push(...sizingBandingProblems(card));

  // ── the held-out score (v4) — the one figure here that could ever fall ──
  problems.push(...scoreProblems(card));

  // ── the separator search must be declared, and its arity is what a mix verdict means ──
  const ss = card.separatorSearch;
  if (!ss || typeof ss !== 'object') {
    problems.push('separatorSearch is required — a card that cannot say how hard it looked lets "no separator found" read as "no separator exists"');
  } else {
    if (!Number.isInteger(ss.arity) || ss.arity < 1) problems.push('separatorSearch.arity must be an integer >= 1');
    if (!ss.correction) problems.push('separatorSearch.correction must name the multiple-comparison correction applied');
    if (typeof ss.alpha !== 'number') problems.push('separatorSearch.alpha must be a number');
  }

  // ── the rules ──
  if (Array.isArray(card.rules)) {
    if (card.rules.length === 0) problems.push('a card with no rules describes nothing');
    for (const r of card.rules) {
      if (!r || typeof r !== 'object') { problems.push('a rule is not an object'); continue; }
      if (!isMixVerdict(r.verdict)) {
        problems.push(`rule ${r.ruleId}: verdict "${r.verdict}" is not on the closed list`);
      }
      if (!Array.isArray(r.actions) || r.actions.length === 0) {
        problems.push(`rule ${r.ruleId}: no action distribution — a majority label with the residue discarded is rejected, not flagged`);
        continue;
      }
      const summed = r.actions.reduce((s, a) => s + (a.k || 0), 0);
      if (summed !== r.n) {
        problems.push(`rule ${r.ruleId}: actions sum to ${summed} but n is ${r.n} — decisions were dropped`);
      }
      for (const a of r.actions) {
        if (!Array.isArray(a.ci) || a.ci.length !== 2) {
          problems.push(`rule ${r.ruleId}, action ${a.action}: every rate ships with its interval`);
        }
        problems.push(...sizingProblems(card, r, a));
      }
      // `always` is a claim about the exception set, not shorthand for a high rate.
      if (r.verdict === MIX_VERDICTS.ALWAYS && r.actions.length !== 1) {
        problems.push(`rule ${r.ruleId}: verdict "always" requires an EMPTY exception set, but ${r.actions.length} actions are present`);
      }
      // A hidden condition that does not name its feature is a shrug.
      if (r.verdict === MIX_VERDICTS.HIDDEN_CONDITION && !(r.separators || []).length) {
        problems.push(`rule ${r.ruleId}: verdict "hidden-cond" must name the separating feature`);
      }
    }

    // Every rule the card marks unresolved must actually be in the ruleset, and vice versa.
    const unresolvedIds = new Set((card.unresolved || []).map((u) => u.ruleId));
    const flagged = card.rules
      .filter((r) => r.verdict === MIX_VERDICTS.HIDDEN_CONDITION || r.verdict === MIX_VERDICTS.NEEDS_CARDS)
      .map((r) => r.ruleId);
    for (const id of flagged) {
      if (!unresolvedIds.has(id)) {
        problems.push(`rule ${id} carries an unresolved verdict but is missing from the unresolved list`);
      }
    }
    for (const u of card.unresolved || []) {
      if (!u.resolvedBy) {
        problems.push(`unresolved ${u.ruleId}: must state what WOULD resolve it — an unresolved row without a route is a caveat, not a work item`);
      }
    }
  }

  // ── the evidence budget, and the honesty it enforces ──
  const ev = card.evidence;
  if (ev && typeof ev === 'object') {
    if (typeof ev.decisions !== 'number' || ev.decisions <= 0) problems.push('evidence.decisions must be a positive count');
    if (typeof ev.revealedDecisions !== 'number') problems.push('evidence.revealedDecisions is required — the card must state its own card budget');
    if (ev.revealedDecisions > ev.decisions) problems.push('evidence.revealedDecisions exceeds evidence.decisions');
    // Free big-blind showdowns are not a sample of anything he chose. Carrying the voluntary
    // count separately is what stops a composition claim resting on hands he never entered.
    if (typeof ev.voluntarilyEnteredShown !== 'number') {
      problems.push('evidence.voluntarilyEnteredShown is required — showdowns he never chose to enter are not evidence about his range');
    }
  }

  // ── the gates ──
  if (Array.isArray(card.gates)) {
    const failed = card.gates.filter((g) => g && g.ok === false);
    if (failed.length) {
      problems.push(`${failed.length} instrument gate(s) failed — a card whose gates did not pass is not a thinner card, it is an unverified one`);
    }
    if (card.gates.length === 0) problems.push('gates is empty — the self-checks are what separate a card from an assertion');
  }

  // SHAPE, not merely presence. The register makes this argument about itself: a presence
  // check passes 'unknown', 'v1', or a hand-typed near-miss, and an unjoinable string is worse
  // than null because null announces that the card cannot name its register while a near-miss
  // quietly claims that it can. This is also the check that caught an un-awaited async call
  // stamping a Promise into the field on the very first live run.
  if (card.disclaimerRegisterVersion != null
      && !REGISTER_VERSION_PATTERN.test(String(card.disclaimerRegisterVersion))) {
    problems.push(
      `disclaimerRegisterVersion "${card.disclaimerRegisterVersion}" is not the shape registerVersion() mints `
      + '(FR-<epoch>+<12 hex>) — a stamp that cannot be joined back to a register version delivers none of what it is for',
    );
  }

  if (!card.population) {
    problems.push('population is required — a rate from one population quoted about another is transferred, not measured');
  }
  return problems;
};

export const isValidConductCard = (card) => conductCardProblems(card).length === 0;

/**
 * The standing caveat every consumer should print beside any figure taken off this card.
 *
 * Not modesty and not boilerplate: it states the estimand. The two clauses are the two ways a
 * reader goes wrong — reading a mix as a fact about the player rather than about the search,
 * and reading an online-2009 rate as if it had been measured on the founder's live game.
 */
export const conductCaveat = (card) => {
  const arity = card?.separatorSearch?.arity ?? null;
  const parts = [
    `Observed on ${card?.population ?? 'an unnamed population'}; every rate is TRANSFERRED, not measured, for any other game.`,
    arity === 1
      ? 'Mix verdicts mean NO SINGLE FEATURE separated the split — combinations were not searched, so a mix is provisional.'
      : `Mix verdicts were searched to arity ${arity}.`,
  ];
  if (card?.evidence) {
    const { decisions, revealedDecisions, voluntarilyEnteredShown } = card.evidence;
    parts.push(
      `Holdings known on ${revealedDecisions}/${decisions} decisions`
      + (typeof voluntarilyEnteredShown === 'number'
        ? `, of which ${voluntarilyEnteredShown} came from hands he voluntarily entered.` : '.'),
    );
  }
  return parts.join(' ');
};
