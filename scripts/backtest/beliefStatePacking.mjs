/**
 * beliefStatePacking.mjs — packed encodings for the Decision Atom `beliefState` field (WS-430).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, AND WHAT IT IS NOT.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `beliefState` (schemas.js:139) is "range per live opponent at the decision" — one 169-class
 * grid PER LIVE OPPONENT. As of WS-430 there is NO producer in the repo that writes it: every
 * atom in the real store carries `beliefState: null` (verified 97,454/97,454 on the WS-328
 * gen-1 set). This module defines the serialized shapes a future producer writes, so the cost
 * question ("can we afford to capture it?") is answered by MEASUREMENT rather than by shape
 * arguments. The measurement lives in `run-beliefstate-size.mjs`; the doctrine and the numbers
 * live in `docs/standard-of-record/VOCABULARY.md` (atom store operations section).
 *
 * Three shapes, all JSON-embeddable in the atom NDJSON line:
 *
 *   verbose  `{ schema:'beliefState.v1', opponents:[{ seat, classProbs:{AA:0.98,…169 keys} }] }`
 *            Human-readable, greppable, self-describing. The baseline.
 *   f32      Float32Array packed to base64 — 4 B/class binary (676 B for a 169 grid) before
 *            base64's 4/3 expansion. Lossless at float32 precision (~7 significant digits,
 *            far beyond what any propensity in this system can claim).
 *   q8       uint8 quantization against a per-grid scale — 1 B/class (169 B) before base64.
 *            Max absolute error is scale/510 (half a quantization step of scale/255).
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE CLASS ORDER IS INJECTED AND HASH-STAMPED, NEVER ASSUMED.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * A packed grid is meaningless without the class order it was packed under, and the order is
 * owned by `rangeMatrix.js` (`rangeIndex`/`decodeIndex`), not by this module — so callers pass
 * `classOrder` in (repo DI rule) and the pack stamps a hash of it. Unpacking under a different
 * order REFUSES rather than silently permuting every probability onto the wrong hand class —
 * that failure would survive every downstream aggregate and never look wrong.
 */

import { createHash } from 'node:crypto';

export class BeliefStatePackingError extends Error {
  constructor(message, detail = {}) {
    super(message);
    this.name = 'BeliefStatePackingError';
    Object.assign(this, detail);
  }
}

export const BELIEF_STATE_SCHEMAS = Object.freeze({
  verbose: 'beliefState.v1',
  f32: 'beliefState.f32.v1',
  q8: 'beliefState.q8.v1',
});

export const BELIEF_STATE_ENCODINGS = Object.freeze(['f32', 'q8']);

/** Worst-case absolute reconstruction error of a q8 grid packed at this scale. */
export const q8MaxAbsError = (scale) => scale / 510;

/** Short content hash of a class order — stamped into every pack, checked by every unpack. */
export const classOrderHash = (classOrder) => createHash('sha256')
  .update(classOrder.join('|'), 'utf8')
  .digest('hex')
  .slice(0, 12);

const assertClassOrder = (classOrder, where) => {
  if (!Array.isArray(classOrder) || classOrder.length === 0) {
    throw new BeliefStatePackingError(
      `${where}: classOrder is required — a packed grid without its class order is a list of `
      + 'numbers about nothing. Pass the 169-class order derived from rangeMatrix.',
    );
  }
  if (new Set(classOrder).size !== classOrder.length) {
    throw new BeliefStatePackingError(`${where}: classOrder contains duplicate class names`);
  }
};

const assertGrid = (grid, where) => {
  if (!Array.isArray(grid) && !ArrayBuffer.isView(grid)) {
    throw new BeliefStatePackingError(`${where}: grid must be an array of numbers`);
  }
  for (let i = 0; i < grid.length; i += 1) {
    if (!Number.isFinite(grid[i])) {
      throw new BeliefStatePackingError(
        `${where}: grid[${i}] is ${grid[i]} — a non-finite propensity cannot be packed, and `
        + 'defaulting it would make a corrupt belief indistinguishable from a real one',
        { index: i },
      );
    }
    if (grid[i] < 0) {
      throw new BeliefStatePackingError(
        `${where}: grid[${i}] is negative (${grid[i]}) — propensities are non-negative`,
        { index: i },
      );
    }
  }
};

// ── Grid level ──────────────────────────────────────────────────────────────────────────────

/** Pack one grid as little-endian float32, base64. Lossless at float32 precision. */
export const packGridF32 = (grid) => {
  assertGrid(grid, 'packGridF32');
  return Buffer.from(new Float32Array(grid).buffer).toString('base64');
};

/** @returns {number[]} */
export const unpackGridF32 = (b64) => {
  const buf = Buffer.from(b64, 'base64');
  if (buf.byteLength % 4 !== 0) {
    throw new BeliefStatePackingError(
      `unpackGridF32: payload is ${buf.byteLength} bytes, not a multiple of 4 — truncated or not f32`,
    );
  }
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4));
};

/**
 * Quantize one grid to uint8 against its own max. `scale` is carried alongside; an all-zero
 * grid packs with scale 0 and unpacks to zeros exactly.
 */
export const packGridQ8 = (grid) => {
  assertGrid(grid, 'packGridQ8');
  let scale = 0;
  for (let i = 0; i < grid.length; i += 1) if (grid[i] > scale) scale = grid[i];
  const q = new Uint8Array(grid.length);
  if (scale > 0) {
    for (let i = 0; i < grid.length; i += 1) q[i] = Math.round((grid[i] / scale) * 255);
  }
  return { scale, grid: Buffer.from(q.buffer).toString('base64') };
};

/** @returns {number[]} */
export const unpackGridQ8 = ({ scale, grid } = {}) => {
  if (!Number.isFinite(scale) || scale < 0) {
    throw new BeliefStatePackingError(`unpackGridQ8: scale is ${scale} — required and non-negative`);
  }
  const buf = Buffer.from(grid, 'base64');
  const out = new Array(buf.byteLength);
  for (let i = 0; i < buf.byteLength; i += 1) out[i] = (buf[i] / 255) * scale;
  return out;
};

// ── beliefState level ───────────────────────────────────────────────────────────────────────

const gridFromClassProbs = (classProbs, classOrder, seat) => {
  const grid = new Array(classOrder.length);
  for (let i = 0; i < classOrder.length; i += 1) {
    const v = classProbs?.[classOrder[i]];
    if (v === undefined) {
      throw new BeliefStatePackingError(
        `packBeliefState: opponent seat ${seat} is missing class "${classOrder[i]}". A producer `
        + 'writes the FULL grid; a missing class is ambiguous between "zero" and "never computed" '
        + 'and those have opposite meanings downstream.',
        { seat, className: classOrder[i] },
      );
    }
    grid[i] = v;
  }
  return grid;
};

/**
 * Pack a verbose beliefState (`beliefState.v1`) into `f32` or `q8`.
 *
 * @param {Object} verbose - { schema:'beliefState.v1', opponents:[{seat, classProbs}] }
 * @param {Object} params
 * @param {string} params.encoding - 'f32' | 'q8'
 * @param {string[]} params.classOrder - the 169-class order (rangeMatrix index order), injected
 */
export const packBeliefState = (verbose, { encoding, classOrder } = {}) => {
  assertClassOrder(classOrder, 'packBeliefState');
  if (!BELIEF_STATE_ENCODINGS.includes(encoding)) {
    throw new BeliefStatePackingError(
      `packBeliefState: encoding must be ${BELIEF_STATE_ENCODINGS.join(' | ')}, got "${encoding}"`,
    );
  }
  if (verbose?.schema !== BELIEF_STATE_SCHEMAS.verbose || !Array.isArray(verbose.opponents)) {
    throw new BeliefStatePackingError(
      `packBeliefState: expected schema "${BELIEF_STATE_SCHEMAS.verbose}" with an opponents array`,
    );
  }
  const orderHash = classOrderHash(classOrder);
  const opponents = verbose.opponents.map(({ seat, classProbs }) => {
    const grid = gridFromClassProbs(classProbs, classOrder, seat);
    return encoding === 'f32'
      ? { seat, grid: packGridF32(grid) }
      : { seat, ...packGridQ8(grid) };
  });
  return {
    schema: BELIEF_STATE_SCHEMAS[encoding],
    classCount: classOrder.length,
    classOrderHash: orderHash,
    opponents,
  };
};

/**
 * Unpack any beliefState shape back to verbose. REFUSES a class-order mismatch: decoding under
 * the wrong order would permute every probability onto the wrong hand class and never look wrong.
 */
export const unpackBeliefState = (packed, { classOrder } = {}) => {
  assertClassOrder(classOrder, 'unpackBeliefState');
  if (packed?.schema === BELIEF_STATE_SCHEMAS.verbose) return packed;

  const encoding = Object.entries(BELIEF_STATE_SCHEMAS)
    .find(([, schema]) => schema === packed?.schema)?.[0];
  if (!encoding) {
    throw new BeliefStatePackingError(
      `unpackBeliefState: unknown schema "${packed?.schema}"`,
    );
  }
  if (packed.classOrderHash !== classOrderHash(classOrder)) {
    throw new BeliefStatePackingError(
      `unpackBeliefState: packed under class order ${packed.classOrderHash}, asked to unpack `
      + `under ${classOrderHash(classOrder)} — refusing to permute probabilities onto the wrong `
      + 'hand classes',
      { packedHash: packed.classOrderHash },
    );
  }
  const opponents = packed.opponents.map((opp) => {
    const grid = encoding === 'f32'
      ? unpackGridF32(opp.grid)
      : unpackGridQ8({ scale: opp.scale, grid: opp.grid });
    if (grid.length !== classOrder.length) {
      throw new BeliefStatePackingError(
        `unpackBeliefState: seat ${opp.seat} grid has ${grid.length} classes; classOrder has `
        + `${classOrder.length}`,
        { seat: opp.seat },
      );
    }
    const classProbs = {};
    for (let i = 0; i < classOrder.length; i += 1) classProbs[classOrder[i]] = grid[i];
    return { seat: opp.seat, classProbs };
  });
  return { schema: BELIEF_STATE_SCHEMAS.verbose, opponents };
};
