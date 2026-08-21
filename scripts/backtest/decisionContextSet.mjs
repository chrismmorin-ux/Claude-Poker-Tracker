/**
 * decisionContextSet.mjs — WS-540 Phase 1. The ARM-INDEPENDENT decision set.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS, AND WHY NOTHING EXISTING COULD BE USED INSTEAD
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Every durable artifact the hero-EV pass writes today is keyed to the arms that ran:
 * the decision row carries `piOursByArm` (heroEvTask.mjs), the JSONL sidecar spreads that
 * row, and the atom projection walks `for (const arm of arms)` and reads
 * `row.piOursByArm[arm.id]` (decisionRecordAtoms.mjs). A rung authored TOMORROW has no
 * entry in any of them and cannot get one by re-reading them — so the only way to score it
 * was to walk the corpus again and regenerate a decision set identical by construction.
 *
 * `--resume` is not this. It resumes an interrupted run of the SAME arm roster from chunk
 * files; it has no concept of a new arm meeting an old decision set.
 *
 * This module is the missing object: the decision as the scoring half sees it, with
 * NOTHING an arm produced. Write it once, score any number of rungs against it forever.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE COST MODEL THIS RESTS ON — MEASURED TWICE, AND THE FIRST TWO GUESSES WERE WRONG
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `run-rule-ladder.mjs`'s header records two refuted predictions about where this
 * pipeline's time goes. Neither was measured before it was believed. So this one was:
 *
 *     decoupleableShare 0.9957   armShare 0.0043   (93 decisions, out/ws540-opt2.json)
 *     decoupleableShare 0.995    armShare 0.005    (1,498 decisions, 2026-08-21 gate)
 *
 * The second reading is the one that licenses this file: it re-measured at 16x the sample
 * BEFORE any of this was written, because the first reading was one day old and had been
 * the opposite (0.007) that same morning, before two perf fixes landed. A share that
 * recent is a fact about today, not an architectural constant.
 *
 * At 0.017 s/decision and 7,295 B/decision (n=268 samples), a 100,000-decision set is
 * ~730 MB and ~33 minutes to produce. Scoring a new rung against it costs `armShare`.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * ONE BUILDER, TWO CONSUMERS — the drift this prevents
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `buildDecisionContext` is used BOTH by the byte probe in heroEvTask and by the writer
 * here. That is deliberate. The probe existed first and measured a shape ("exactly the
 * payload Phase 1 would write"); had the writer been authored separately, the measured
 * size and the written size would have been free to diverge silently, and the sizing
 * decision above would have been made against a shape that never shipped.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THE RANGE IS BASE64 AND NOT JSON
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `ctx.rangeBefore` is a 169-cell `Float64Array`. `JSON.stringify` of a typed array yields
 * `{"0":0.5,"1":0,...}` — an OBJECT, which does not round-trip back to a `Float64Array`,
 * and which every downstream consumer (`sampleCombos`, `narrowByBoard`) would then be
 * handed instead of the typed array it expects. Base64 of the underlying buffer both
 * round-trips exactly and is smaller than the JSON form.
 *
 * The range is stored ONCE, under `holding`. `rangeBefore` is not stored beside it: they
 * are the SAME `Float64Array` reference by construction —
 * `decisionAccumulator.js` derives `rangeBefore = holdingBelief(holdingBefore).range` and
 * emits that same `holdingBefore` on the payload, and `holdingBelief` is a pure accessor.
 * Storing both would invite them to disagree. `restoreDecisionContext` re-derives it, and
 * `assertRangeRecovery` checks that re-derivation against a live `ctx` rather than taking
 * the docblock's word — the same discipline `run-rule-ladder.mjs` used when it checked
 * `computeBoardPercentileTable` over 9,122 combos instead of trusting its docblock.
 */

import { createWriteStream } from 'node:fs';
import { open, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { once } from 'node:events';
import { hashObjectSync, hashStringSync, stableStringify } from './contentHashNode.mjs';

export const DECISION_CONTEXT_SCHEMA_VERSION = 1;

/** Cells in a preflop-class range. Asserted on decode so a wrong-width buffer cannot pass. */
export const RANGE_CELLS = 169;

// ---------------------------------------------------------------- range codec

/**
 * A `Float64Array` as base64, or null.
 *
 * `.buffer` is NOT used directly: a typed array may be a VIEW onto a larger buffer with a
 * non-zero `byteOffset`, in which case `Buffer.from(arr.buffer)` silently encodes the whole
 * backing store and the decode comes back shifted. `byteOffset`/`byteLength` are passed
 * explicitly so a view encodes as what it actually is.
 */
export const encodeRange = (range) => {
  if (range == null) return null;
  if (!ArrayBuffer.isView(range)) {
    throw new TypeError(`decisionContextSet.encodeRange: expected a typed array, got ${typeof range}`);
  }
  return Buffer.from(range.buffer, range.byteOffset, range.byteLength).toString('base64');
};

/** Inverse of `encodeRange`. Returns a real `Float64Array`, never a plain object. */
export const decodeRange = (b64) => {
  if (b64 == null) return null;
  const buf = Buffer.from(b64, 'base64');
  if (buf.byteLength % 8 !== 0) {
    throw new Error(`decisionContextSet.decodeRange: ${buf.byteLength} bytes is not a whole number of float64s`);
  }
  const cells = buf.byteLength / 8;
  if (cells !== RANGE_CELLS) {
    throw new Error(`decisionContextSet.decodeRange: expected ${RANGE_CELLS} cells, got ${cells}`);
  }
  // Copy rather than view: `buf` may sit inside Node's pooled allocator, and a view onto
  // the pool would alias whatever is written there next.
  const out = new Float64Array(cells);
  for (let i = 0; i < cells; i++) out[i] = buf.readDoubleLE(i * 8);
  return out;
};

/** A holding handle, serialised. `truth` is deliberately dropped — see `holdingKnowledge`. */
export const encodeHolding = (holding) => {
  if (holding == null) return null;
  return { range: encodeRange(holding.range), provenance: holding.provenance ?? null };
};

/** Inverse of `encodeHolding`. `truth: null` — a replay must call `holdingTruth` explicitly. */
export const decodeHolding = (enc) => {
  if (enc == null) return null;
  return Object.freeze({ range: decodeRange(enc.range), provenance: enc.provenance ?? null, truth: null });
};

// ---------------------------------------------------------------- the row

/**
 * The arm-independent decision context. THE one definition — the byte probe in
 * `heroEvTask` and the writer below both call this, so a measured size is a written size.
 *
 * Everything here is either read by an arm, or is identity/outcome the estimator needs.
 * Nothing an arm PRODUCED belongs in it; that is what makes a later rung scorable.
 */
export const buildDecisionContext = ({
  stable, playerId, handId, order, hand, holding, board, handIdx,
  street, heroSeat, buttonSeat, opponentSeat, facingAction, isAgg, isIP,
  texture, posCategory, situationKey, contextAction, rangeEquityPct, segmentation,
  observedAction, observedAmount, geometry, sizeBucket, netBB, netBBUnraked,
  wentToShowdown, pool, decisionSeed, playersInPot,
}) => ({
  stable,
  playerId,
  handId,
  order,
  hand,
  holding: holding ?? null,
  board: board ?? null,
  handIdx: handIdx ?? null,
  street,
  heroSeat,
  buttonSeat: buttonSeat ?? null,
  opponentSeat: opponentSeat ?? null,
  facingAction,
  isAgg,
  isIP,
  texture,
  posCategory,
  situationKey: situationKey ?? null,
  contextAction: contextAction ?? null,
  rangeEquityPct: rangeEquityPct ?? null,
  segmentation: segmentation ?? null,
  observedAction,
  observedAmount: observedAmount ?? null,
  geometry,
  sizeBucket,
  netBB,
  netBBUnraked,
  wentToShowdown,
  pool,
  decisionSeed,
  playersInPot,
});

/** The wire form: the row with its range encoded. Pure; does not mutate the input. */
export const encodeDecisionContext = (row) => ({ ...row, holding: encodeHolding(row.holding) });

/** The wire form, decoded. `holding.range` comes back as a real `Float64Array`. */
export const decodeDecisionContext = (row) => ({ ...row, holding: decodeHolding(row.holding) });

// ---------------------------------------------------------------- identity

/**
 * Row identity, EXCLUDING execution forensics — the same split `atomSetHash` uses against
 * the record's `contentHash`. Two runs of the same config over the same corpus produce
 * bit-identical context rows and therefore the same set hash, which is what lets a Result
 * Card say two rungs were scored on the same decisions and be checkable on it.
 */
export const decisionContextRowHash = (row) => hashObjectSync(encodeDecisionContext(row));

// ---------------------------------------------------------------- writer

/**
 * Append-only JSONL writer with a rolling content hash.
 *
 * Rolling rather than hash-at-close so a 730 MB set never has to be re-read to be named,
 * and so a truncated file cannot present a valid-looking hash: the manifest is written
 * only by `close()`.
 */
export const openContextSetWriter = async (path, { meta = {} } = {}) => {
  await mkdir(dirname(path), { recursive: true });
  const stream = createWriteStream(path, { encoding: 'utf8', flags: 'w' });
  let rows = 0;
  let rolling = hashStringSync('');

  const write = async (row) => {
    const line = `${stableStringify(encodeDecisionContext(row))}\n`;
    rolling = hashStringSync(rolling + decisionContextRowHash(row));
    rows += 1;
    if (!stream.write(line)) await once(stream, 'drain');
  };

  const close = async () => {
    await new Promise((resolve, reject) => {
      stream.end((err) => (err ? reject(err) : resolve()));
    });
    const manifest = {
      schemaVersion: DECISION_CONTEXT_SCHEMA_VERSION,
      rows,
      // MEASUREMENT identity — no wall clock, no host, no worker count. See the docblock.
      contentHash: rolling,
      meta,
    };
    const mf = await open(`${path}.manifest.json`, 'w');
    try { await mf.writeFile(JSON.stringify(manifest, null, 2)); } finally { await mf.close(); }
    return manifest;
  };

  return { write, close, path, get rows() { return rows; } };
};

// ---------------------------------------------------------------- reader

/**
 * Stream a set back, verifying the rolling hash as it goes.
 *
 * The hash is checked at the END and the mismatch THROWS. A consumer that silently scored
 * a truncated or substituted set would produce a plausible number against decisions it was
 * never handed — the exact failure the Standard of Record exists to make impossible.
 */
export async function* readContextSet(path, { verify = true } = {}) {
  const fh = await open(path, 'r');
  let rolling = hashStringSync('');
  try {
    let buf = '';
    for await (const chunk of fh.createReadStream({ encoding: 'utf8' })) {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (!line.trim()) continue;
        const row = decodeDecisionContext(JSON.parse(line));
        if (verify) rolling = hashStringSync(rolling + decisionContextRowHash(row));
        yield row;
      }
    }
    if (buf.trim()) {
      const row = decodeDecisionContext(JSON.parse(buf));
      if (verify) rolling = hashStringSync(rolling + decisionContextRowHash(row));
      yield row;
    }
  } finally {
    await fh.close();
  }
  if (verify) {
    const mf = await open(`${path}.manifest.json`, 'r');
    let manifest;
    try { manifest = JSON.parse(await mf.readFile('utf8')); } finally { await mf.close(); }
    if (manifest.contentHash !== rolling) {
      throw new Error(
        `decisionContextSet: content hash mismatch for ${path}\n`
        + `  manifest ${manifest.contentHash}\n  actual   ${rolling}\n`
        + '  The set on disk is not the set the manifest names. Refusing rather than scoring it.',
      );
    }
  }
}

// ---------------------------------------------------------------- replay ctx

/**
 * Fields a replayed `ctx` can serve. Anything outside this set is a field the persisted
 * row does not carry, and reading it must fail rather than return `undefined`.
 */
export const REPLAY_CTX_FIELDS = Object.freeze([
  'rangeBefore', 'board', 'holding', 'hand', 'handId', 'handIdx', 'order',
  'street', 'texture', 'posCategory', 'isAgg', 'isIP', 'facingAction', 'contextAction',
  'situationKey', 'playerSeat', 'buttonSeat', 'opponentSeat', 'rangeEquityPct',
  'segmentation', 'action', 'amount',
]);

/**
 * Rebuild a scoring `ctx` from a persisted row, behind a Proxy that REFUSES unknown fields.
 *
 * ── WHY THE PROXY, and it is not defensive decoration ──
 * The set of `ctx` fields an arm reads is NOT closed by construction. `fromMarginalFrequency`
 * (strategyArm.mjs) takes a caller-supplied `spec.applies(ctx, geo)` predicate, which may
 * read any field ever placed on a `ctx`. Today no live caller exists, so the closure happens
 * to be {facingAction, street, texture, posCategory, isAgg, isIP, contextAction, rangeBefore,
 * board}; tomorrow an arm can widen it without touching this file.
 *
 * Without the Proxy that widening is SILENT: the new field reads `undefined`, the rule
 * quietly does not fire, the rung scores lower, and the ladder reports that the rule bought
 * nothing. That is a wrong answer wearing the shape of a finding — and the ladder's entire
 * product is "what did one rule buy". With the Proxy it is a loud crash naming the field.
 *
 * `has` is trapped too: a `'x' in ctx` guard would otherwise let an arm branch on absence
 * and reach the same silent-wrong-answer outcome through the back door.
 */
export const restoreDecisionContext = (row, { strict = true } = {}) => {
  const base = {
    rangeBefore: row.holding ? row.holding.range : null,
    board: row.board,
    holding: row.holding,
    hand: row.hand,
    handId: row.handId,
    handIdx: row.handIdx,
    order: row.order,
    street: row.street,
    texture: row.texture,
    posCategory: row.posCategory,
    isAgg: row.isAgg,
    isIP: row.isIP,
    facingAction: row.facingAction,
    contextAction: row.contextAction,
    situationKey: row.situationKey,
    playerSeat: row.heroSeat,
    buttonSeat: row.buttonSeat,
    opponentSeat: row.opponentSeat,
    rangeEquityPct: row.rangeEquityPct,
    segmentation: row.segmentation,
    action: row.observedAction,
    amount: row.observedAmount,
  };
  if (!strict) return base;
  const allowed = new Set(REPLAY_CTX_FIELDS);
  return new Proxy(base, {
    get(target, prop, receiver) {
      // Symbols and inspection hooks are host machinery, never arm reads.
      if (typeof prop === 'symbol' || prop === 'toJSON' || prop === 'constructor') {
        return Reflect.get(target, prop, receiver);
      }
      if (!allowed.has(prop)) {
        throw new Error(
          `decisionContextSet: arm read ctx.${String(prop)}, which the persisted decision set `
          + 'does not carry. Add it to the context row (and re-produce the set) rather than '
          + 'letting it read undefined — a missing field scores as "the rule did not fire", '
          + 'which is indistinguishable from a real null result.',
        );
      }
      return Reflect.get(target, prop, receiver);
    },
    has(target, prop) {
      if (typeof prop !== 'symbol' && !allowed.has(prop)) {
        throw new Error(`decisionContextSet: arm probed 'in' for ctx.${String(prop)}, which the set does not carry.`);
      }
      return Reflect.has(target, prop);
    },
  });
};

/**
 * Check the recovery claim against a LIVE ctx instead of trusting the docblock.
 *
 * The claim is that `holdingBelief(holding).range` IS `ctx.rangeBefore` — same object, per
 * `decisionAccumulator`. It is load-bearing: the whole replay path rebuilds the range that
 * way. `run-rule-ladder.mjs` set the precedent by checking `computeBoardPercentileTable`
 * over 9,122 combos rather than believing its "any divergence is a bug" docblock.
 *
 * @returns {{ok: boolean, checked: number, mismatches: Array}}
 */
export const assertRangeRecovery = (liveCtx, restored) => {
  const a = liveCtx?.rangeBefore ?? null;
  const b = restored?.rangeBefore ?? null;
  if (a == null && b == null) return { ok: true, checked: 0, mismatches: [] };
  if (a == null || b == null) {
    return { ok: false, checked: 0, mismatches: [{ cell: null, live: a == null ? 'null' : 'present', restored: b == null ? 'null' : 'present' }] };
  }
  if (a.length !== b.length) {
    return { ok: false, checked: 0, mismatches: [{ cell: null, live: a.length, restored: b.length }] };
  }
  const mismatches = [];
  for (let i = 0; i < a.length; i++) {
    // Bit-exact: this survived a float64 round-trip, so anything but equality is a codec bug.
    if (a[i] !== b[i]) mismatches.push({ cell: i, live: a[i], restored: b[i] });
    if (mismatches.length >= 8) break;
  }
  return { ok: mismatches.length === 0, checked: a.length, mismatches };
};
