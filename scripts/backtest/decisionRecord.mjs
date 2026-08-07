/**
 * decisionRecord.mjs — the FULL per-decision record a multi-hour run must leave behind.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE RULE THIS MODULE EXISTS TO ENFORCE (founder, 2026-08-05):
 *
 *   "A run that costs hours must persist a record whose SHAPE admits questions nobody
 *    asked when it was designed. The aggregate is a VIEW over that record, not the
 *    product of it. If answering a new decomposition question requires re-running, the
 *    record was the wrong shape."
 *
 * The failure this prevents is concrete and has already happened here: a pass that ran
 * for 103 minutes held the engine's full candidate set, its per-combo equities, its stage
 * ledger and its geometry in memory at every decision, wrote out a 40-line summary, and
 * discarded the rest. Every later question — which combos leak, which spots pay, which
 * near-ties a change would flip — costs another night.
 *
 * SO: prefer RAW over DERIVED. `pi_ours`, `pi_pool`, `w_d` and `R_d` are stored
 * separately and never pre-multiplied; the contribution of a decision to the aggregate is
 * a computation someone does later, not a number written here. Anything pre-aggregated at
 * write time is a question foreclosed.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHERE IT GOES, AND WHY IT IS A SIDECAR
 *
 * The heavy part — every sampled combo, its equity, the engine's WHOLE ranked candidate
 * list with EVs, and the refinement stage ledger — is roughly 10-15 KB per decision per
 * arm. At 900 decisions across two arms that is ~15-25 MB, which is fine on disk and
 * ruinous inside the `--out` artifact that a human opens and that the report re-parses.
 *
 * So it streams to a JSONL sidecar, one line per decision, written with `writeSync` as
 * each decision completes. Two consequences, both deliberate:
 *
 *   1. An interrupted run keeps every line it already wrote. A partial run is a BIASED
 *      SUBSAMPLE and its aggregate must never be quoted (EVAL players are walked
 *      sequentially) — but each individual row is a complete, valid observation, and
 *      losing 600 of them to a buffered stream on SIGINT would be a pure waste.
 *   2. Re-analysis is a streaming read. No question about this run needs the engine.
 *
 * NOTHING IN THE ESTIMATOR READS THIS FILE. `ipsEstimator.estimateEdge` consumes only
 * `piOurs` / `piPool` / `observedAction` / `netBB` / `playerId` off the in-memory row,
 * exactly as before, so the `populationControl == 0.000` identity is untouched by
 * construction rather than by test.
 */

import { openSync, writeSync, closeSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { RANKS, SUITS } from '../../src/constants/gameConstants.js';
import { cardRank, cardSuit } from '../../src/utils/pokerCore/cardParser.js';

/**
 * Bumped when a field is ADDED. Never when one is removed — fields are not removed. A
 * reader of a v1 file must keep working against a v3 writer, the same additive contract
 * `scripts/standardOfRecord/check-additive.mjs` holds over the Result Card schemas.
 *
 * v2 (WS-431): the meta line carries the estimator constants without which the headline
 * is not rederivable from this file alone (`estimator.weightCap` / `bootstrapSeed` /
 * `bootstrapResamples` / `bootstrapAlpha`), and `close()` appends a `kind: 'summary'`
 * line carrying `rowCount` + `contentHash` over the canonicalized decision rows.
 */
export const DECISION_RECORD_SCHEMA_VERSION = 2;

/**
 * The canonical row order — `stable(p, k, d)`, the same comparator `heroEvRunner.foldAll`
 * uses. Rows hit disk in ARRIVAL order (completion order under the worker pool), which is
 * deliberate: sorting at write time would require either buffering (an interrupted run
 * loses its tail) or a close-time rewrite (violates every-line-readable-before-close).
 * Readers canonicalize by sorting on `stable`; the content hash is computed over the
 * canonicalized bytes, so it is run-invariant across serial/pool and fresh/resumed runs.
 */
export const canonicalRowCompare = (a, b) => (
  ((a?.stable?.p ?? -1) - (b?.stable?.p ?? -1))
  || ((a?.stable?.k ?? -1) - (b?.stable?.k ?? -1))
  || ((a?.stable?.d ?? -1) - (b?.stable?.d ?? -1))
);

/** `A♠` from the 0-51 encoding. RANKS is A..2 descending, so index by `12 - rank`. */
export const cardLabel = (encoded) => {
  if (!Number.isInteger(encoded) || encoded < 0 || encoded > 51) return null;
  return `${RANKS[12 - cardRank(encoded)]}${SUITS[cardSuit(encoded)]}`;
};

/** `A♠K♦` — the human handle for a specific two-card holding. */
export const comboLabel = (c1, c2) => {
  const a = cardLabel(c1);
  const b = cardLabel(c2);
  return (a && b) ? `${a}${b}` : null;
};

/** `AKs` / `AKo` / `AA` — the 169-cell class, for pooling across suits. */
export const comboClass = (c1, c2) => {
  if (!Number.isInteger(c1) || !Number.isInteger(c2)) return null;
  const r1 = cardRank(c1); const r2 = cardRank(c2);
  const hi = RANKS[12 - Math.max(r1, r2)];
  const lo = RANKS[12 - Math.min(r1, r2)];
  if (r1 === r2) return `${hi}${lo}`;
  return `${hi}${lo}${cardSuit(c1) === cardSuit(c2) ? 's' : 'o'}`;
};

/**
 * One villain response branch, stripped to numbers.
 *
 * `pct` and `ev` and nothing else: `heroResponse` is a label derived from them, and the
 * prose the engine attaches is the single largest thing on a recommendation.
 */
const compactVillainResponse = (vr) => {
  if (!vr || typeof vr !== 'object') return null;
  const out = {};
  for (const [branch, v] of Object.entries(vr)) {
    if (!v || typeof v !== 'object') continue;
    out[branch] = {
      pct: Number.isFinite(v.pct) ? v.pct : null,
      ev: Number.isFinite(v.ev) ? v.ev : null,
      heroResponse: v.heroResponse ?? null,
    };
  }
  return Object.keys(out).length ? out : null;
};

/**
 * One CANDIDATE action, as the engine ranked it.
 *
 * THE WHOLE LIST IS KEPT, NOT THE WINNER. The near-ties are where a future improvement
 * flips the argmax, so `[{bet: 3.88}, {check: 3.40}]` is worth strictly more than `bet` —
 * it says how much a change would have to be worth to matter here. `recommendations`
 * arrives sorted descending by `ev`, and that order is preserved.
 *
 * `reasoning` and `handPlan` are DROPPED: they are generated English, they are by far the
 * largest fields on the object, and every fact in them is present as a number elsewhere on
 * this record. That is the one place this module is lossy, and it is named here.
 */
export const compactCandidate = (rec) => {
  if (!rec) return null;
  return {
    action: rec.action ?? null,
    ev: Number.isFinite(rec.ev) ? rec.ev : null,
    sizing: Number.isFinite(rec.sizing) ? rec.sizing : (rec.sizing ?? null),
    // Which depth actually produced this candidate's EV — 1 means it is the fast answer.
    depth: rec.depth ?? null,
    mixFrequency: rec.mixFrequency ?? null,
    isDonk: rec.isDonk ?? null,
    blockerBluff: rec.blockerBluff ?? null,
    blockerMotivated: rec.blockerMotivated ?? null,
    blockerScore: Number.isFinite(rec.blockerScore) ? rec.blockerScore : null,
    icmTax: Number.isFinite(rec.icmTax) ? rec.icmTax : null,
    villainResponse: compactVillainResponse(rec.villainResponse),
    villainPrediction: rec.villainPrediction
      ? {
        confidence: rec.villainPrediction.confidence ?? null,
        effectiveN: rec.villainPrediction.effectiveN ?? null,
        source: rec.villainPrediction.source ?? null,
      }
      : null,
  };
};

/**
 * The refinement stage ledger, kept whole.
 *
 * REPRODUCIBILITY FORENSICS. `gameTreeEvaluator` gates depth-2/3 on `Date.now()`
 * (`isTimeBudgetExceeded`), so identical inputs give different advice under machine load.
 * That is a known irreproducibility source and it is currently invisible after the fact.
 * Carrying `budgetSkipped` / `overBudget` / `ranStages` / `errored` per combo makes it
 * possible to ask, of a finished run, HOW MUCH of it was decided by the clock — without
 * re-running under a different load and comparing, which is the only alternative.
 */
export const compactLatency = (lat) => {
  if (!lat) return null;
  return {
    phase: lat.phase ?? null,
    totalMs: lat.totalMs ?? null,
    budgetMs: lat.budgetMs ?? null,
    preRefinementMs: lat.preRefinementMs ?? null,
    overBudget: lat.overBudget ?? null,
    budgetSkipped: lat.budgetSkipped ?? null,
    ranStages: lat.ranStages ?? null,
    errored: lat.errored ?? null,
    noCandidate: lat.noCandidate ?? null,
    incomplete: lat.incomplete ?? null,
  };
};

/**
 * Hero's ACTUAL holding, when the corpus revealed it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * READ THIS BEFORE USING IT FOR ANYTHING COMPARATIVE.
 *
 * The corpus masks hole cards pre-showdown (`d dh p1 ????`). This field is therefore
 * non-null only where hero reached showdown AND turned the hand over — which is an event
 * DOWNSTREAM of the very decision being scored. Conditioning on it:
 *
 *   · contains zero fold decisions, because a player who folds never shows;
 *   · over-represents hands that called down, i.e. the stronger half of every range;
 *   · is exactly the selection `heroPolicy.mjs` was written to avoid, which is why
 *     `pi_ours` marginalizes over hero's inferred RANGE instead.
 *
 * So this is a DIAGNOSTIC and a browsing handle — "show me the hands where the engine
 * wanted to barrel and I had air" — never an estimator input. `truthAvailable` is stored
 * beside it so the size of the selection is itself measurable rather than assumed.
 *
 * `coverage` is whatever `holdingKnowledge.scoreCoverage` returned: where the hand hero
 * actually held sat inside the range we believed they had. That is a calibration reading
 * on the range engine, available for free at every showdown, and it has never been kept.
 */
export const compactHeroTruth = (truth) => {
  if (!truth) return { truthAvailable: false, reason: 'not-revealed' };
  if (truth.refused) {
    return { truthAvailable: false, reason: truth.reason ?? 'refused', revealed: truth.revealed ?? null };
  }
  const { revealed, revealedAt, refused, ...coverage } = truth;
  return {
    truthAvailable: true,
    reason: null,
    revealed: revealed ?? null,
    comboLabel: Array.isArray(revealed) ? comboLabel(revealed[0], revealed[1]) : null,
    comboClass: Array.isArray(revealed) ? comboClass(revealed[0], revealed[1]) : null,
    revealedAt: revealedAt ?? null,
    coverage,
  };
};

/**
 * A JSONL sink. `writeSync` per line, on purpose.
 *
 * A buffered `createWriteStream` loses its tail when a multi-hour run is killed, and the
 * tail is the only part that was not already known. 900 synchronous ~15 KB writes over
 * four hours is not a cost worth optimising against that.
 *
 * The FIRST line is a `kind: 'meta'` object; every other line is `kind: 'decision'`. A
 * self-describing file needs no second file to explain it, and a reader that filters on
 * `kind` cannot mistake one for the other.
 */
export const openDecisionSink = (path, meta = {}) => {
  mkdirSync(dirname(path), { recursive: true });
  const fd = openSync(path, 'w');
  let written = 0;
  const line = (obj) => writeSync(fd, `${JSON.stringify(obj)}\n`);

  line({
    kind: 'meta',
    schemaVersion: DECISION_RECORD_SCHEMA_VERSION,
    writtenAt: new Date().toISOString(),
    ...meta,
    caveat:
      'DECISION-LEVEL RECORD. Every line after this one is one scored decision, complete '
      + 'and independently valid. The AGGREGATE over these lines is only quotable if the '
      + 'run completed: EVAL players are walked sequentially, so a truncated file is a '
      + 'biased subsample of players, not a random subsample of decisions.',
  });

  return {
    path,
    write(record) { line({ kind: 'decision', ...record }); written++; },
    get count() { return written; },
    /**
     * v2: canonicalize + hash before closing, then append a `kind: 'summary'` line.
     *
     * The hash preimage is the decision LINES (original bytes, not re-serialized), sorted
     * by `stable(p, k, d)`, prefixed by the schema version. The meta line is excluded —
     * it carries `writtenAt`, which would break run-invariance; run identity lives in the
     * meta fields themselves and on the replication manifest.
     *
     * Returns `{ rowCount, contentHash }` — the by-hash reference a Result Card carries
     * (never the path; atomStore.mjs:15-17 doctrine). On a hashing failure the rows on
     * disk are untouched and the return carries `contentHash: null` with `error`, so a
     * caller can distinguish "no sink ran" from "sink ran, reference unavailable".
     */
    close() {
      let summary;
      try {
        const rows = [];
        for (const ln of readFileSync(path, 'utf8').split('\n')) {
          if (!ln) continue;
          let obj;
          try { obj = JSON.parse(ln); } catch { continue; }
          if (obj.kind === 'decision') rows.push({ ln, stable: obj.stable });
        }
        rows.sort(canonicalRowCompare);
        const h = createHash('sha256');
        h.update(`decision-record-v${DECISION_RECORD_SCHEMA_VERSION}\n`);
        for (const r of rows) { h.update(r.ln); h.update('\n'); }
        summary = {
          rowCount: rows.length,
          contentHash: `sha256:${h.digest('hex')}`,
          canonicalOrder: 'stable(p,k,d)',
        };
        line({ kind: 'summary', schemaVersion: DECISION_RECORD_SCHEMA_VERSION, ...summary });
      } catch (err) {
        summary = { rowCount: written, contentHash: null, error: err?.message || String(err) };
      }
      try { closeSync(fd); } catch { /* the lines already on disk are what matter */ }
      return summary;
    },
  };
};
