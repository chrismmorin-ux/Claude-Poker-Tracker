/**
 * questionGenerators.js — turns a scenario into a numeric estimate question.
 *
 * The Estimate Drill asks specific hand-type-precise questions like:
 *   "What % of BB-call range is top-pair-or-better on K72r?"
 *   "What % of BTN-open range is outright air on 654r?"
 *   "What % of BB-call range holds a strong draw on 6♣5♥2♥?"
 *
 * Each question derives its truth value from the hand-type breakdown, so
 * the drill's ground truth is always engine-precise (not a fuzzy bucket).
 *
 * The generator is deterministic given a scenario + seed — useful for
 * reproducing a drill session, testing, or replaying a missed question.
 *
 * Pure module.
 */

import {
  handTypeBreakdown,
  pctMadeFlushPlus,
  pctMadeStraightPlus,
  pctSetTripsTwoPair,
  pctTopPairPlus,
  pctAnyPairPlus,
  pctStrongDraws,
  pctWeakDraws,
  pctAir,
} from './handTypeBreakdown';
import { archetypeRangeFor, contextLabel } from './archetypeRanges';
import { parseBoard } from '../pokerCore/cardParser';
import { parseFlopString } from './scenarioLibrary';

/**
 * Registry of tier-level questions. Each question resolves its truth via
 * the corresponding aggregate helper from handTypeBreakdown.
 */
export const TIER_QUESTIONS = [
  {
    id: 'top_pair_plus',
    label: 'top pair or better',
    promptSuffix: 'is top-pair-or-better (one-pair tier up through made hands)',
    resolve: (bd) => pctTopPairPlus(bd),
  },
  {
    id: 'nut_region',
    label: 'nut region (straight+ ∪ sets ∪ trips ∪ two-pair)',
    promptSuffix: 'has a straight+ or set/trips/two-pair',
    resolve: (bd) => pctMadeStraightPlus(bd) + pctSetTripsTwoPair(bd),
  },
  {
    id: 'made_flush_plus',
    label: 'flush or better',
    promptSuffix: 'has a made flush or better',
    resolve: (bd) => pctMadeFlushPlus(bd),
  },
  {
    id: 'made_straight_plus',
    label: 'made straight or better',
    promptSuffix: 'has a made straight or better',
    resolve: (bd) => pctMadeStraightPlus(bd),
  },
  {
    id: 'any_pair_plus',
    label: 'any pair or better',
    promptSuffix: 'has at least a pair',
    resolve: (bd) => pctAnyPairPlus(bd),
  },
  {
    id: 'strong_draws',
    label: 'strong draws (combo / flush draw / OESD)',
    promptSuffix: 'holds a strong draw (combo draw, flush draw, or OESD)',
    resolve: (bd) => pctStrongDraws(bd),
  },
  {
    id: 'weak_draws',
    label: 'weak draws (gutshot + overcards)',
    promptSuffix: 'holds a weak draw (gutshot or overcards only)',
    resolve: (bd) => pctWeakDraws(bd),
  },
  {
    id: 'air',
    label: 'air',
    promptSuffix: 'is outright air (no pair, no draw, no overcards)',
    resolve: (bd) => pctAir(bd),
  },
];

/** Small deterministic PRNG so tests can snapshot question generation. */
const mulberry32 = (seed) => {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Generate an Estimate-mode question from a scenario.
 *
 * @param {object} scenario — from SCENARIOS in scenarioLibrary
 * @param {number} [seed=Date.now()]
 * @returns {{
 *   scenarioId, questionId, prompt, label, truth, ctx, rangeLabel,
 *   board, scenario,
 * }}
 */
export const generateEstimateQuestion = (scenario, seed = Date.now()) => {
  const rand = mulberry32(seed);

  // Which side do we ask about?
  const sides = [scenario.context];
  if (scenario.opposingContext) sides.push(scenario.opposingContext);
  const ctx = sides[Math.floor(rand() * sides.length)];

  // Pick a question type. For scenarios tagged "capped", favor questions
  // that expose the capping (nut_region, made_straight_plus) — but keep
  // variety.
  const qSpec = TIER_QUESTIONS[Math.floor(rand() * TIER_QUESTIONS.length)];

  const range = archetypeRangeFor(ctx);
  const board = parseBoard(parseFlopString(scenario.board));
  const bd = handTypeBreakdown(range, board);
  const truth = qSpec.resolve(bd);

  const rangeLabel = contextLabel(ctx);
  const boardLabel = scenario.board;

  return {
    scenarioId: scenario.id,
    questionId: qSpec.id,
    prompt: `What % of ${rangeLabel} range on ${boardLabel} ${qSpec.promptSuffix}?`,
    label: qSpec.label,
    truth,
    ctx,
    rangeLabel,
    board,
    scenario,
  };
};
