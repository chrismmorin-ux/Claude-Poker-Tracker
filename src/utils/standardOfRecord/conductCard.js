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
  };
  const problems = conductCardProblems(card);
  if (problems.length) {
    throw new StandardOfRecordError('conduct card is not valid', { cardId, problems });
  }
  return card;
};

/**
 * Everything wrong with a candidate card, as a list. Returns [] for a valid one.
 *
 * Returns rather than throws so a caller can report every problem at once — the same choice
 * `manifestProblems` and `resultCardProblems` make, and for the same reason: an author fixing
 * one error at a time through six round trips stops fixing them.
 */
export const conductCardProblems = (card) => {
  const problems = checkAgainstSchema(card, SOR_SCHEMAS.conductCard, 'conductCard') || [];
  if (!card || typeof card !== 'object') return problems.length ? problems : ['not an object'];

  if (card.schemaVersion !== SOR_SCHEMA_VERSIONS.conductCard) {
    problems.push(`schemaVersion ${card.schemaVersion} is not ${SOR_SCHEMA_VERSIONS.conductCard}`);
  }
  if (card.coverage !== 1) {
    problems.push('coverage must be exactly 1 — it is 1 by construction, and any other value means the residual clause is missing');
  }

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
