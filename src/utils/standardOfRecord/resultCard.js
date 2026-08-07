/**
 * resultCard.js — the standardized scorecard every comparative claim resolves to.
 *
 * ADR-009's binding rule: any artefact making a COMPARATIVE claim about strategy, model
 * quality, or EV must resolve to one of these. Not every number — a debug count or an
 * exploratory check is not a claim. The trigger is a number someone could act on or cite.
 *
 * THIS SHAPE WAS NOT INVENTED HERE. `scripts/backtest/heroEvReport.buildHeroEvReport` already
 * emits `{schemaVersion, caveat, treatment, admissibility, provenance, generatedFrom}` and
 * already computes a single admissibility verdict so that "every consumer — the readiness
 * gate, a dashboard, a future FSA surface — inherits one verdict instead of each re-deriving
 * the rules and one of them getting it wrong." That module got there first and got it right;
 * this schema is that object generalized, and the retrofit in WS-322 maps it across rather
 * than replacing it.
 *
 * WHAT THE RESULT CARD ADDS that hero-EV did not have: a Match (which surface, against which
 * Deal Book, against which Field), a stated estimand, an explicit cluster unit, and the
 * replication manifest. The first three are what let two Result Cards be compared at all; the
 * fourth is what lets either of them be checked six months later.
 */

import {
  SOR_SCHEMA_VERSIONS,
  SOR_SCHEMAS,
  StandardOfRecordError,
  checkAgainstSchema,
} from './schemas.js';
import { manifestProblems } from './manifest.js';
import { fragilityCaveat } from './fragility.js';

/**
 * Legal cluster units.
 *
 * HANDS IS NOT ON THIS LIST, deliberately. POKER_THEORY §14.3: the per-hand form gives the
 * right unit for variance, but hands are NOT independent within a session, so a confidence
 * interval clustered on hands is narrower than the data supports. The repo has already been
 * bitten by a version of this — an interrupted run reported a tight CI from three contributing
 * players and passed a gate that decides whether the founder stops building. Naming the
 * cluster unit as a required field is how that stops being something a reader has to know to
 * check.
 */
export const CLUSTER_UNITS = Object.freeze(['sessions', 'players']);

/**
 * Build a Result Card.
 *
 * @param {Object} input
 * @param {string} input.resultCardId - the greppable token WS-329's scanner looks for
 * @param {Object} input.match - { surfaceId, dealBookId, fieldId }
 * @param {string} input.estimand - WHAT was measured, in words
 * @param {string} input.treatment - how to read the number; ipsEstimator.TREATMENT supplies this
 * @param {Object} input.metrics - the figures
 * @param {string} input.clusterUnit - one of CLUSTER_UNITS
 * @param {Object} input.admissibility - may this be quoted, and why not
 * @param {Object} input.manifest - a replication manifest from manifest.js
 * @param {Object|null} [input.census]
 * @param {Object|null} [input.warrantAttribution]
 * @param {string|null} [input.atomSetHash] - the atom set this card was computed from
 * @param {number|null} [input.atomCount]
 * @param {number|null} [input.anchorGeneration]
 * @param {Object|null} [input.fragility] - margin-to-flip, from fragility.buildFragility
 * @param {Object|null} [input.flipRegister] - reversal history, from fragility.buildFlipRegister
 * @param {Object|null} [input.comparisonCensus] - contrasts drawn vs merely possible
 * @param {Object|null} [input.decisionRecord] - {contentHash, rowCount, schemaVersion} of the
 *   per-decision JSONL record the headline was computed from — by hash, never by path (WS-431)
 */
export const buildResultCard = ({
  resultCardId,
  match,
  estimand,
  treatment,
  metrics,
  clusterUnit,
  admissibility,
  manifest,
  census = null,
  warrantAttribution = null,
  atomSetHash = null,
  atomCount = null,
  anchorGeneration = null,
  fragility = null,
  flipRegister = null,
  comparisonCensus = null,
  decisionRecord = null,
} = {}) => {
  const card = {
    schemaVersion: SOR_SCHEMA_VERSIONS.resultCard,
    resultCardId,
    match,
    estimand,
    treatment,
    metrics,
    clusterUnit,
    admissibility,
    manifest,
    census,
    warrantAttribution,
    atomSetHash,
    atomCount,
    anchorGeneration,
    fragility,
    flipRegister,
    comparisonCensus,
    decisionRecord,
  };
  const problems = resultCardProblems(card);
  if (problems.length) {
    throw new StandardOfRecordError(
      `Result Card is incomplete:\n  - ${problems.join('\n  - ')}`,
      { problems },
    );
  }
  return card;
};

/**
 * Problems with a Result Card, as strings. Empty means valid.
 *
 * Exported separately from the builder for the same reason `manifestProblems` is: WS-329's
 * scanner has to be able to check an artifact it did not build, and a check that can disagree
 * with its constructor is worse than no check.
 */
export const resultCardProblems = (card) => {
  const problems = checkAgainstSchema(card, SOR_SCHEMAS.resultCard, { label: 'resultCard' });
  if (problems.length) return problems;

  if (!CLUSTER_UNITS.includes(card.clusterUnit)) {
    problems.push(
      `resultCard.clusterUnit must be one of ${CLUSTER_UNITS.join(' | ')} — got "${card.clusterUnit}". ` +
      'Hands are not independent within a session, so a hand-clustered interval understates variance.',
    );
  }

  const match = card.match ?? {};
  for (const key of ['surfaceId', 'dealBookId', 'fieldId']) {
    if (!match[key]) {
      problems.push(
        `resultCard.match.${key} is missing — a Match is Surface x Deal Book x Field, and a ` +
        'result that cannot name all three cannot be compared to another result',
      );
    }
  }

  if (!card.estimand) {
    problems.push(
      'resultCard.estimand is empty — two instruments only corroborate each other if they are ' +
      'measuring the same quantity (AS-710), which cannot be established from numbers alone',
    );
  }

  // A flip history joins on WHAT WAS MEASURED. A register carrying a different estimand than
  // the card is comparing reversal counts across two different questions, which produces a
  // number that looks like stability evidence and is not.
  if (card.flipRegister && card.flipRegister.estimand !== card.estimand) {
    problems.push(
      `resultCard.flipRegister.estimand ("${card.flipRegister.estimand}") does not match ` +
      `resultCard.estimand ("${card.estimand}") — a reversal history only means something ` +
      'against the same measured quantity (AS-710)',
    );
  }

  problems.push(...manifestProblems(card.manifest ?? {}));
  return problems;
};

/**
 * The caveat this card must carry when quoted, or null when there is genuinely nothing to say.
 *
 * THIS IS THE READER for `fragility` and `flipRegister`. Per WS-328's anti-rot rule, a captured
 * field ships with a query that reads it, written at capture time — and the reason those two
 * fields exist at all is the founder's observation that decision nodes flip repeatedly and
 * that overconfidence creeps in where statistics blends with decision modelling. A flip count
 * stored but never rendered would reproduce that exact failure inside the mechanism built to
 * prevent it.
 */
export const cardCaveat = (card) => fragilityCaveat(card?.flipRegister, card?.fragility);

/**
 * True when this card should not be quoted without its caveat.
 *
 * Separated from `cardCaveat` so a surface can DECIDE to show something (a badge, an
 * interstitial) without first rendering the prose.
 */
export const needsCaveat = (card) => cardCaveat(card) !== null;

/** Convenience predicate. Prefer `resultCardProblems` when you want to tell the user why. */
export const isValidResultCard = (card) => resultCardProblems(card).length === 0;
