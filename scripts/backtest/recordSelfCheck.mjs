/**
 * recordSelfCheck.mjs — the standing check that stops the decision record becoming dead
 * weight (WS-431). Sibling of `atomsSelfCheck.mjs`, whose registry is decisionAtom-specific.
 *
 * THE RULE, TRANSFERRED: every field of `SOR_SCHEMAS.decisionRecord` (and the meta/summary
 * line schemas) ships with a reader registered HERE. `missingRecordReaders` is a set diff —
 * add a field to the schema without a reader and it returns the field's name, and
 * `openDecisionSink` THROWS AT OPEN. Failing at run start costs seconds; the alternative is
 * discovering after a multi-hour pass that a field was captured and never queryable — the
 * predictionAudit rot, which is the failure this whole subsystem exists to stop.
 *
 * Readers run over CANONICALIZED rows (sorted by stable(p,k,d) — callers use
 * `canonicalRowCompare` from decisionRecord.mjs) plus the parsed meta and summary lines.
 * Each declares a READER_DEPTHS value; the check reports the mix, never a boolean.
 */

import { SOR_SCHEMAS, READER_DEPTHS, DECISION_RECORD_META_SCHEMA, DECISION_RECORD_SUMMARY_SCHEMA } from '../../src/utils/standardOfRecord/schemas.js';

const D = READER_DEPTHS;

const count = (rows, pred) => rows.reduce((n, r) => n + (pred(r) ? 1 : 0), 0);
const presentShare = (rows, field) => (rows.length
  ? count(rows, (r) => r[field] !== null && r[field] !== undefined) / rows.length
  : null);
const histogram = (rows, keyOf) => {
  const h = {};
  for (const r of rows) {
    const k = String(keyOf(r));
    h[k] = (h[k] ?? 0) + 1;
  }
  return h;
};
const topN = (h, n = 6) => Object.fromEntries(
  Object.entries(h).sort((a, b) => b[1] - a[1]).slice(0, n),
);
const numStats = (xs) => {
  const v = xs.filter(Number.isFinite);
  if (!v.length) return { n: 0 };
  const sorted = [...v].sort((a, b) => a - b);
  return {
    n: v.length,
    min: sorted[0],
    median: sorted[Math.floor(sorted.length / 2)],
    max: sorted[sorted.length - 1],
    mean: v.reduce((s, x) => s + x, 0) / v.length,
  };
};
/** presence + share, the honest default for a nullable capture field. */
const presence = (field, question) => ({
  field, depth: D.DESCRIPTIVE, question,
  read: (rows) => ({ presentShare: presentShare(rows, field) }),
});

/** ONE READER PER ROW FIELD — the forcing question restated at the point of reading. */
export const RECORD_READERS = Object.freeze([
  { field: 'schemaVersion', depth: D.DESCRIPTIVE,
    question: 'Are all rows in this file the same schema version?',
    read: (rows) => ({ versions: histogram(rows, (r) => r.schemaVersion) }) },

  { field: 'playerId', depth: D.INFERENTIAL,
    question: 'How many clusters back the CI — enough for a cluster bootstrap to mean anything?',
    read: (rows) => {
      const perPlayer = histogram(rows, (r) => r.playerId);
      return { players: Object.keys(perPlayer).length, decisionsPerPlayer: numStats(Object.values(perPlayer)) };
    } },

  { field: 'handId', depth: D.INFERENTIAL,
    question: 'How many decisions share a hand — the within-hand correlation the bootstrap must absorb?',
    read: (rows) => ({ decisionsPerHand: numStats(Object.values(histogram(rows, (r) => `${r.playerId}|${r.handId}`))) }) },

  { field: 'order', depth: D.DESCRIPTIVE,
    question: 'Where in hands do scored decisions sit?',
    read: (rows) => ({ order: numStats(rows.map((r) => r.order)) }) },

  { field: 'stable', depth: D.INFERENTIAL,
    question: 'Is the canonical coordinate present and duplicate-free — i.e. is this file one measurement?',
    read: (rows) => {
      const keys = rows.filter((r) => r.stable).map((r) => `${r.stable.p}|${r.stable.k}|${r.stable.d}`);
      return { withStable: keys.length, total: rows.length, duplicates: keys.length - new Set(keys).size };
    } },

  { field: 'observedAction', depth: D.INFERENTIAL,
    question: 'What did the conditioning events look like — is any action class starved?',
    read: (rows) => ({ actions: histogram(rows, (r) => r.observedAction) }) },

  presence('observedAmount', 'How often did the observed action carry a sizing?'),

  { field: 'netBB', depth: D.INFERENTIAL,
    question: 'What outcome scale is the estimator averaging — and how fat is the tail decision-weighting concentrates on?',
    read: (rows) => ({ netBB: numStats(rows.map((r) => r.netBB)), absTailMax: numStats(rows.map((r) => Math.abs(r.netBB))).max }) },

  presence('netBBUnraked', 'Can rake sensitivity be re-derived from this file (unraked twin present)?'),

  { field: 'street', depth: D.INFERENTIAL,
    question: 'Which streets carry the record — is the river (where flips concentrate) represented?',
    read: (rows) => ({ streets: histogram(rows, (r) => r.street) }) },

  presence('heroSeat', 'Is the positional axis populated?'),
  presence('buttonSeat', 'Can relative position be derived (button known)?'),
  presence('opponentSeat', 'Is villain identity present (WS-410 §4.3 correction)?'),
  presence('board', 'Are raw boards present for future texture re-bucketing?'),
  presence('boardLabels', 'Are human board handles present?'),

  { field: 'situationKey', depth: D.DESCRIPTIVE,
    question: 'How much of the situation space did this run touch?',
    read: (rows) => {
      const h = histogram(rows.filter((r) => r.situationKey), (r) => r.situationKey);
      return { distinctKeys: Object.keys(h).length, top: topN(h) };
    } },

  presence('contextAction', 'Is the facing-action context recorded?'),
  presence('isAgg', 'Is the initiative flag populated?'),
  presence('isIP', 'Is the IP/OOP flag populated?'),
  presence('rangeEquityPct', 'Is range-vs-range equity available as a conditioning axis?'),
  presence('segmentation', 'Is range composition (strength segments) captured?'),
  presence('geometry', 'Are raw pot/bet/stack coordinates captured (SPR from state, not labels)?'),

  { field: 'piOurs', depth: D.INFERENTIAL,
    question: 'Did our policy actually emit distributions — the estimator numerator source?',
    read: (rows) => ({
      withDistribution: count(rows, (r) => Object.keys(r.piOurs ?? {}).length > 0),
      total: rows.length,
      conditional: 'P(distribution | row written)',
    }) },

  presence('evStats', 'Are primary-arm EV/depth statistics present (how much did the clock decide)?'),

  { field: 'piOursByArm', depth: D.DESCRIPTIVE,
    question: 'Which arms are represented, uniformly across rows?',
    read: (rows) => {
      const armSets = histogram(rows, (r) => Object.keys(r.piOursByArm ?? {}).sort().join(','));
      return { armSets };
    } },

  { field: 'piPool', depth: D.INFERENTIAL,
    question: 'Did the behavior policy cover the observed nodes — the estimator denominator source?',
    read: (rows) => ({
      withDistribution: count(rows, (r) => Object.keys(r.piPool ?? {}).length > 0),
      total: rows.length,
    }) },

  { field: 'poolEvidenceN', depth: D.DESCRIPTIVE,
    question: 'How much of the pool policy is evidence rather than prior?',
    read: (rows) => ({ evidenceN: numStats(rows.map((r) => r.poolEvidenceN)) }) },

  presence('piPbr', 'Is the pool-best-response ceiling present where computable?'),
  presence('piPbrBySweep', 'Is the PBR shrink sweep captured for ceiling re-derivation?'),

  { field: 'slices', depth: D.DESCRIPTIVE,
    question: 'Which declared slice axes arrived?',
    read: (rows) => {
      const seen = {};
      for (const r of rows) for (const k of Object.keys(r.slices ?? {})) seen[k] = (seen[k] ?? 0) + 1;
      return { axesPresent: seen };
    } },

  presence('pPoolObserved', 'Is the weight denominator stored so the weight is checkable?'),
  presence('pOursObservedByArm', 'Is the weight numerator stored per arm?'),

  { field: 'wRawByArm', depth: D.INFERENTIAL,
    question: 'Where does the estimator cap bind — how much of the edge rests on clipped weights?',
    read: (rows, { weightCap = 20 } = {}) => {
      const raws = rows.flatMap((r) => Object.values(r.wRawByArm ?? {})).filter(Number.isFinite);
      return {
        weights: numStats(raws),
        aboveCapShare: raws.length ? raws.filter((w) => w > weightCap).length / raws.length : null,
        conditional: `P(raw weight > cap=${weightCap} | weight finite)`,
      };
    } },

  { field: 'heroTruth', depth: D.INFERENTIAL,
    question: 'How selected is the revealed-truth subsample — the selection that must never become an estimator input?',
    read: (rows) => {
      const avail = count(rows, (r) => r.heroTruth?.truthAvailable === true);
      return {
        truthAvailable: avail, total: rows.length,
        selectionShare: rows.length ? avail / rows.length : null,
        reasons: topN(histogram(rows.filter((r) => r.heroTruth && !r.heroTruth.truthAvailable), (r) => r.heroTruth.reason)),
      };
    } },

  presence('evStatsByArm', 'Are per-arm depth/budget forensics present?'),
  presence('combosByArm', 'Is per-combo detail (the 103-minute-run answer) present?'),
  presence('policyDiagByArm', 'Are per-row production diagnostics present?'),

  { field: 'pbrSkipReason', depth: D.DESCRIPTIVE,
    question: 'WHY is the PBR ceiling null where it is null?',
    read: (rows) => ({ reasons: topN(histogram(rows.filter((r) => r.pbrSkipReason), (r) => r.pbrSkipReason)) }) },

  { field: 'omitted', depth: D.DESCRIPTIVE,
    question: 'What was DELIBERATELY not captured, and for what stated reason?',
    read: (rows) => {
      const reasons = {};
      for (const r of rows) for (const [f, why] of Object.entries(r.omitted ?? {})) reasons[`${f}: ${why}`] = (reasons[`${f}: ${why}`] ?? 0) + 1;
      return { omissions: reasons };
    } },
]);

/** Readers for the meta line — run identity + rederivability inputs. */
export const META_READERS = Object.freeze([
  { field: 'kind', depth: D.DESCRIPTIVE, question: 'Is the first line self-describing?', read: (m) => ({ kind: m?.kind ?? null }) },
  { field: 'schemaVersion', depth: D.DESCRIPTIVE, question: 'Which schema wrote this file?', read: (m) => ({ schemaVersion: m?.schemaVersion ?? null }) },
  { field: 'writtenAt', depth: D.DESCRIPTIVE, question: 'When was it written (excluded from the hash)?', read: (m) => ({ writtenAt: m?.writtenAt ?? null }) },
  { field: 'run', depth: D.DESCRIPTIVE, question: 'Which runner produced it?', read: (m) => ({ run: m?.run ?? null }) },
  { field: 'dealBookId', depth: D.DESCRIPTIVE, question: 'Which Deal Book identity?', read: (m) => ({ dealBookId: m?.dealBookId ?? null }) },
  { field: 'dealBookHash', depth: D.INFERENTIAL, question: 'Is this record comparable to a given card (same Deal Book hash)?', read: (m) => ({ dealBookHash: m?.dealBookHash ?? null }) },
  { field: 'engineCommit', depth: D.DESCRIPTIVE, question: 'Which engine version produced the rows?', read: (m) => ({ engineCommit: m?.engineCommit ?? null }) },
  { field: 'engineDirty', depth: D.DESCRIPTIVE, question: 'Was the tree dirty (surfaced, never hidden)?', read: (m) => ({ engineDirty: m?.engineDirty ?? null }) },
  { field: 'arms', depth: D.DESCRIPTIVE, question: 'What do the per-arm keys mean?', read: (m) => ({ arms: m?.arms ?? null }) },
  { field: 'constants', depth: D.DESCRIPTIVE, question: 'Which load-bearing constants were active?', read: (m) => ({ constantNames: Object.keys(m?.constants ?? {}) }) },
  { field: 'estimator', depth: D.INFERENTIAL,
    question: 'Can the headline be rederived from this file alone — cap, seed, resamples, alpha all present?',
    read: (m) => {
      const e = m?.estimator ?? {};
      const required = ['weightCap', 'bootstrapSeed', 'bootstrapResamples', 'bootstrapAlpha'];
      return { present: required.filter((k) => Number.isFinite(e[k])), missing: required.filter((k) => !Number.isFinite(e[k])) };
    } },
  { field: 'caveat', depth: D.DESCRIPTIVE, question: 'Does the file warn its own reader about truncation bias?', read: (m) => ({ hasCaveat: Boolean(m?.caveat) }) },
]);

/** Readers for the summary line the v2 close() appends. */
export const SUMMARY_READERS = Object.freeze([
  { field: 'kind', depth: D.DESCRIPTIVE, question: 'Did the file close (summary present)?', read: (s) => ({ closed: s?.kind === 'summary' }) },
  { field: 'schemaVersion', depth: D.DESCRIPTIVE, question: 'Summary written under which schema?', read: (s) => ({ schemaVersion: s?.schemaVersion ?? null }) },
  { field: 'rowCount', depth: D.INFERENTIAL, question: 'Does the summary count match the rows actually on disk?', read: (s, { rowsOnDisk = null } = {}) => ({ rowCount: s?.rowCount ?? null, rowsOnDisk, agrees: rowsOnDisk === null ? null : s?.rowCount === rowsOnDisk }) },
  { field: 'contentHash', depth: D.INFERENTIAL, question: 'Is the by-hash reference present so a card can point at this record?', read: (s) => ({ contentHash: s?.contentHash ?? null }) },
  { field: 'canonicalOrder', depth: D.DESCRIPTIVE, question: 'Which sort was the hash computed under?', read: (s) => ({ canonicalOrder: s?.canonicalOrder ?? null }) },
]);

/**
 * The set diff that IS the enforcement. Schema injection is test-only, exactly as
 * `atomsSelfCheck.mjs:320-321` puts it: a gate that can be handed a friendly schema is
 * not a gate.
 */
export const missingRecordReaders = ({
  recordSchema = SOR_SCHEMAS.decisionRecord,
  metaSchema = DECISION_RECORD_META_SCHEMA,
  summarySchema = DECISION_RECORD_SUMMARY_SCHEMA,
} = {}) => {
  const missing = [];
  const rowReaders = new Set(RECORD_READERS.map((r) => r.field));
  for (const f of recordSchema) if (!rowReaders.has(f.name)) missing.push(`decisionRecord.${f.name}`);
  const metaReaders = new Set(META_READERS.map((r) => r.field));
  for (const f of metaSchema) if (!metaReaders.has(f.name)) missing.push(`decisionRecord.meta.${f.name}`);
  const summaryReaders = new Set(SUMMARY_READERS.map((r) => r.field));
  for (const f of summarySchema) if (!summaryReaders.has(f.name)) missing.push(`decisionRecord.summary.${f.name}`);
  return missing;
};

/**
 * Run every reader over canonicalized rows + meta + summary. Returns the depth mix and
 * per-field reports rather than a boolean — descriptive coverage is legitimate, but only
 * when it is visible.
 */
export const recordSelfCheck = (rows, meta = null, summary = null, opts = {}) => {
  const missing = missingRecordReaders();
  const reports = {};
  const failedReaders = [];
  const runAll = (readers, subject, prefix) => {
    for (const r of readers) {
      try {
        reports[`${prefix}${r.field}`] = { depth: r.depth, question: r.question, ...r.read(subject, opts) };
      } catch (err) {
        failedReaders.push({ field: `${prefix}${r.field}`, error: err?.message || String(err) });
      }
    }
  };
  runAll(RECORD_READERS, rows, '');
  runAll(META_READERS, meta, 'meta.');
  runAll(SUMMARY_READERS, summary, 'summary.');
  const all = [...RECORD_READERS, ...META_READERS, ...SUMMARY_READERS];
  return {
    ok: missing.length === 0 && failedReaders.length === 0,
    missingReaders: missing,
    failedReaders,
    depthMix: histogram(all, (r) => r.depth),
    reports,
  };
};
