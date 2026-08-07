/**
 * rederiveFromRecord.mjs — recompute the headline from the persisted record alone (WS-431).
 *
 * THE INVERSION. WS-410 Stage 1: "a test must show that estimateEdge's headline number is
 * REDERIVABLE from the persisted record alone, to within the stated tolerance. If the
 * aggregate cannot be recomputed from the record, the record is not yet the product."
 * This module is that recomputation, as a real instrument rather than test-local code —
 * a reader that answers "does the record still support the number the card quotes"
 * for any closed record file.
 *
 * It consumes NOTHING but the file text: rows are canonicalized by stable(p,k,d), the
 * content hash is RECOMPUTED and checked against the summary line (a tampered or
 * mis-assembled record refuses rather than rederiving a different number), and every
 * estimator parameter comes from the meta line — never from ipsEstimator defaults, which
 * is the entire point: a default not recorded is reproducible only by luck.
 */

import { estimateEdge } from './ipsEstimator.mjs';
import { canonicalRowCompare, DECISION_RECORD_SCHEMA_VERSION } from './decisionRecord.mjs';
import { createHash } from 'node:crypto';

/**
 * Parse a record file's text into {meta, rows, summary}, canonicalized and hash-verified.
 *
 * Throws on: no meta line, no summary line (an unclosed file is a BIASED SUBSAMPLE of
 * players — its aggregate must never be quoted, so it is refused, not warned about), a
 * rowCount that disagrees with the rows on disk, or a contentHash that does not recompute.
 */
export const readDecisionRecord = (text) => {
  let meta = null;
  let summary = null;
  const entries = [];
  for (const ln of text.split('\n')) {
    if (!ln) continue;
    let obj;
    try { obj = JSON.parse(ln); } catch { continue; }
    if (obj.kind === 'meta') meta = obj;
    else if (obj.kind === 'summary') summary = obj;
    else if (obj.kind === 'decision') entries.push({ ln, row: obj, stable: obj.stable });
  }
  if (!meta) throw new Error('readDecisionRecord: no meta line — this is not a decision record file.');
  if (!summary) {
    throw new Error(
      'readDecisionRecord: no summary line — the file was never closed. EVAL players are '
      + 'walked sequentially, so a truncated record is a biased subsample of PLAYERS; its '
      + 'aggregate must not be rederived or quoted. (Each row remains individually valid.)',
    );
  }
  entries.sort(canonicalRowCompare);
  if (summary.rowCount !== entries.length) {
    throw new Error(
      `readDecisionRecord: summary says ${summary.rowCount} row(s), the file holds ${entries.length} — `
      + 'the record was modified after close or assembled from mismatched parts.',
    );
  }
  if (summary.contentHash) {
    const h = createHash('sha256');
    h.update(`decision-record-v${summary.schemaVersion ?? DECISION_RECORD_SCHEMA_VERSION}\n`);
    for (const e of entries) { h.update(e.ln); h.update('\n'); }
    const recomputed = `sha256:${h.digest('hex')}`;
    if (recomputed !== summary.contentHash) {
      throw new Error(
        `readDecisionRecord: contentHash does not recompute (summary ${summary.contentHash}, `
        + `recomputed ${recomputed}) — refusing to rederive a number from rows the card did not stand on.`,
      );
    }
  }
  return { meta, rows: entries.map((e) => e.row), summary };
};

/**
 * Rederive the headline estimate from the record text alone.
 *
 * Every estimator parameter is taken from meta.estimator; a record without the full
 * block is refused — that is the rederivability criterion failing loudly rather than a
 * default silently standing in for the recorded run's actual configuration.
 */
export const rederiveHeadline = (text, { label = 'rederived-from-record' } = {}) => {
  const { meta, rows, summary } = readDecisionRecord(text);
  const est = meta.estimator ?? {};
  const required = ['weightCap', 'bootstrapSeed', 'bootstrapResamples', 'bootstrapAlpha'];
  const missing = required.filter((k) => !Number.isFinite(est[k]));
  if (missing.length) {
    throw new Error(
      `rederiveHeadline: meta.estimator is missing [${missing.join(', ')}] — the headline is not `
      + 'rederivable from this file alone. (Records written before schema v2 predate the block.)',
    );
  }
  const headline = estimateEdge(rows, {
    weightCap: est.weightCap,
    seed: est.bootstrapSeed,
    resamples: est.bootstrapResamples,
    alpha: est.bootstrapAlpha,
    label,
  });
  return { headline, rowsRead: rows.length, meta, summary };
};
