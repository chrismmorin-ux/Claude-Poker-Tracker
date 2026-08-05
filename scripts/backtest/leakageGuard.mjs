/**
 * leakageGuard.mjs — WS-273 acceptance gate, executable rather than prose.
 *
 * The ticket's acceptance criterion is: "no hand used for prior fitting may
 * appear in the scored set." That is the single most likely way to get a falsely
 * good number out of this harness, so it is enforced in code and proven by a
 * test that feeds it a deliberately poisoned run.
 *
 * There are THREE independent leakage channels, and closing one does not close
 * the others:
 *
 *   1. POOL-PRIOR LEAKAGE. The shipped Reference table (`handhqReferencePool.js`,
 *      SRC-011) was mined from ALL 12.9M corpus hands. Scoring any corpus hand
 *      against priors trained on it measures memorisation. Closed by scoring only
 *      EVAL-partition players against a reference table mined from POOL players
 *      alone — and by REFUSING to run against an unstamped table at all.
 *
 *   2. TEMPORAL LEAKAGE within a player. The per-villain model is personalised,
 *      so it must train on the player it predicts — but only on their PAST. A
 *      model trained on a player's later hands predicting their earlier ones is
 *      an ordering that never occurs at the table. Closed by walk-forward:
 *      every scored decision's hand index must fall strictly after the training
 *      prefix that produced the model.
 *
 *   3. PARTITION DRIFT. The Python miner and this runner must agree on who is a
 *      POOL player. Closed by the shared fixture in `partition.mjs`, and by
 *      re-checking each scored player's group here rather than trusting upstream.
 *
 * Violations THROW. A harness that silently downgrades a leak to a warning
 * produces exactly the number this ticket exists to prevent.
 *
 * WHAT CHANNEL 1 ACTUALLY DEFENDS (WS-284, 2026-08-05). For the life of WS-273
 * it defended nothing measurable: the villain-action scorecard was bit-identical
 * with and without a reference table, because the six scalar priors the tier
 * feeds never reach `queryActionDistribution` (see `statPriorScore.mjs` for the
 * severed path). A guard over a channel no reported number depends on is not
 * merely idle — it reads as evidence of rigour the numbers do not have. The
 * WS-284 stat-prior scorecard is the measurement channel 1 now protects, and
 * `assertReferenceTierLive` fails any run in which the tier is inert again.
 */

import { GROUPS, partitionOf, DEFAULT_POOL_PCT } from './partition.mjs';

/** Provenance stamp a reference table must carry to be usable in a backtest. */
export const REQUIRED_PARTITION_STAMP = 'pool-train';

/** Explicit opt-out: run with the Reference tier switched off entirely. */
export const REFERENCE_DISABLED = 'none';

export class LeakageError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'LeakageError';
    this.detail = detail;
  }
}

/**
 * Validate the reference table a run is about to use.
 *
 * Accepts either a stamped train-only table or the explicit `REFERENCE_DISABLED`
 * sentinel. It deliberately does NOT accept "no reference specified" — an
 * unstamped default would silently reintroduce channel 1, which is precisely the
 * failure mode that makes the ticket's gate unsatisfiable today.
 *
 * @param {Object|string|null} reference - stamped table, or REFERENCE_DISABLED
 * @param {number} [poolPct]
 * @returns {{ mode: 'pool-train'|'disabled', table: Array|null, provenance: Object|null }}
 */
export const validateReferenceTable = (reference, poolPct = DEFAULT_POOL_PCT) => {
  if (reference === REFERENCE_DISABLED) {
    return { mode: 'disabled', table: null, provenance: null };
  }

  if (!reference || typeof reference !== 'object') {
    throw new LeakageError(
      'Backtest refused: no reference table supplied. Pass a POOL-partition table ' +
      `or the explicit "${REFERENCE_DISABLED}" sentinel. The SHIPPED reference table ` +
      'was mined from the entire corpus and must never be used to score it.',
    );
  }

  const provenance = reference.provenance;
  if (!provenance || provenance.partition !== REQUIRED_PARTITION_STAMP) {
    throw new LeakageError(
      `Backtest refused: reference table is not stamped "${REQUIRED_PARTITION_STAMP}". ` +
      `Got partition=${JSON.stringify(provenance?.partition)}. An unstamped table is ` +
      'assumed to be the corpus-wide one and would leak into every scored hand.',
      { provenance },
    );
  }

  if (provenance.poolPct !== poolPct) {
    throw new LeakageError(
      `Backtest refused: reference table was mined at poolPct=${provenance.poolPct} ` +
      `but this run partitions at poolPct=${poolPct}. The EVAL set would not be ` +
      'disjoint from the players that trained the table.',
      { provenance, poolPct },
    );
  }

  if (!Array.isArray(reference.stakes) || reference.stakes.length === 0) {
    throw new LeakageError('Backtest refused: reference table carries no stake rows.', { provenance });
  }

  return { mode: 'pool-train', table: reference.stakes, provenance };
};

/**
 * Channel-2 ordering check, shared by every scored unit (a decision, a stat
 * window). One implementation so a new scored unit cannot accidentally ship a
 * weaker version of the walk-forward rule.
 */
const assertOrdering = ({ playerId, trainEndIdx, handIdx }, unit) => {
  if (!Number.isInteger(trainEndIdx) || !Number.isInteger(handIdx)) {
    throw new LeakageError(
      'Backtest refused: walk-forward indices must be integers.',
      { playerId, trainEndIdx, handIdx },
    );
  }
  if (handIdx < trainEndIdx) {
    throw new LeakageError(
      `Backtest refused: ${unit} for ${playerId} came from hand index ` +
      `${handIdx}, but the model trained on hands [0, ${trainEndIdx}). The model ` +
      'would be predicting a hand it had already seen.',
      { playerId, trainEndIdx, handIdx },
    );
  }
  return true;
};

/**
 * Guard instance for a single run. Tracks what it has checked so the run can
 * report its own integrity rather than asserting it.
 */
export class LeakageGuard {
  constructor({ poolPct = DEFAULT_POOL_PCT, reference = null } = {}) {
    this.poolPct = poolPct;
    const validated = validateReferenceTable(reference, poolPct);
    this.referenceMode = validated.mode;
    // The ONLY sanctioned way to obtain a usable reference table: it has passed
    // the provenance check. Callers must read it from here rather than from the
    // raw input, so an unvalidated table cannot reach the model.
    this.referenceTable = validated.table;
    this.referenceProvenance = validated.provenance;
    this.checkedPlayers = new Set();
    this.checkedDecisions = 0;
    this.checkedStatWindows = 0;
  }

  /**
   * Channel 3 + 1: this player must be in EVAL, so they contributed nothing to
   * the reference table.
   *
   * @param {string} playerId
   */
  assertEvalPlayer(playerId) {
    const group = partitionOf(playerId, this.poolPct);
    if (group !== GROUPS.EVAL) {
      throw new LeakageError(
        `Backtest refused: player ${playerId} is in the ${group} partition and its ` +
        'hands trained the reference priors. Only EVAL players may be scored.',
        { playerId, group },
      );
    }
    this.checkedPlayers.add(playerId);
    return true;
  }

  /**
   * Channel 2: a scored decision must come from a hand the model never trained on.
   *
   * `trainEndIdx` is exclusive — the model saw hands [0, trainEndIdx). A decision
   * at handIdx must therefore satisfy handIdx >= trainEndIdx.
   *
   * @param {Object} params
   * @param {string} params.playerId
   * @param {number} params.trainEndIdx
   * @param {number} params.handIdx
   */
  assertWalkForward({ playerId, trainEndIdx, handIdx }) {
    assertOrdering({ playerId, trainEndIdx, handIdx }, 'scored decision');
    this.checkedDecisions++;
    return true;
  }

  /**
   * Channel 2, for the WS-284 Reference-tier instrument.
   *
   * `statPriorScore.mjs` scores a whole WINDOW of hands rather than a single
   * decision: the belief formed from hands [0, trainEndIdx) is scored against the
   * realised rates over [handIdx, …). Same ordering requirement, different unit —
   * so it gets its own assertion and its own counter rather than being folded
   * into `decisionsChecked`, which would make the integrity report lie about how
   * many decisions a run scored.
   *
   * This is the assertion that finally has something to defend. Until WS-284 the
   * reference table could not influence any reported number, so no leakage
   * through it was observable; the stat-prior scorecard moves if the table is
   * mined from the players it scores.
   *
   * @param {Object} params
   * @param {string} params.playerId
   * @param {number} params.trainEndIdx - exclusive end of the training prefix
   * @param {number} params.handIdx     - first hand of the scored window
   */
  assertStatWindow({ playerId, trainEndIdx, handIdx }) {
    assertOrdering({ playerId, trainEndIdx, handIdx }, 'scored stat window');
    this.checkedStatWindows++;
    return true;
  }

  /** Integrity report, embedded in the run output so a result carries its own proof. */
  summary() {
    return {
      poolPct: this.poolPct,
      referenceMode: this.referenceMode,
      evalPlayersChecked: this.checkedPlayers.size,
      decisionsChecked: this.checkedDecisions,
      statWindowsChecked: this.checkedStatWindows,
    };
  }
}
