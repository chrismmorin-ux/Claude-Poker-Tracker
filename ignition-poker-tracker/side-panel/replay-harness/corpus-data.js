/**
 * corpus-data.js — exposes S1–S5 corpus events + seed hands for browser replay.
 *
 * Reuses the builders from `test/replay/recorder.js` (pure JS, no node deps).
 * Those builders are the source of truth for the `.jsonl` files on disk; using
 * them directly avoids reparsing + guarantees seedHands are included (the .jsonl
 * format doesn't carry seedHands, only events).
 */

import {
  buildS1Partial,
  buildS2StreetMismatch,
  buildS3PlanPanelRace,
  buildS4BetweenHandsOverlap,
  buildS5ExcessiveMutations,
  buildS6InvariantViolation,
  buildS7AdviceStale,
  buildS8NoTable,
  buildS9PipelineRecovery,
  buildS10Tournament,
  buildS11HeroFolded,
  buildS12RiverDecision,
  buildS13CheckedFlop,
} from '../../test/replay/recorder.js';

export const CORPUS = {
  S1: buildS1Partial(),
  S2: buildS2StreetMismatch(),
  S3: buildS3PlanPanelRace(),
  S4: buildS4BetweenHandsOverlap(),
  S5: buildS5ExcessiveMutations(),
  S6: buildS6InvariantViolation(),
  S7: buildS7AdviceStale(),
  S8: buildS8NoTable(),
  S9: buildS9PipelineRecovery(),
  S10: buildS10Tournament(),
  S11: buildS11HeroFolded(),
  S12: buildS12RiverDecision(),
  S13: buildS13CheckedFlop(),
};

export const CORPUS_IDS = Object.keys(CORPUS);
