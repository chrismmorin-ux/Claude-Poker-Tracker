/**
 * foldToOpenCurve — measure P(fold | seat, open size, stake) for a single unraised open, and
 * persist it in a form that a consumer cannot misread.
 *
 * WHAT THIS REPLACES, AND WHY THE REPLACEMENT IS NOT JUST AN EXTRA KEY.
 * `populationBaseline` wrote `.tmp-arch/field-seats.json`: per-player `{k, n, rate}` for four
 * seats, no size axis, no stake axis, no player id, no header. Three separate failures followed
 * from that shape, and all three are structural rather than bad luck:
 *
 *   1. NO SIZE AXIS. A min-open to 2bb and an open to 5bb shared a cell, so the card priced a
 *      2bb steal with a rate measured mostly against 3-4bb raises. Measured on 1,756 files the
 *      big blind folds 57.5% to a 2bb open and 80.0% to a 4bb one.
 *   2. NO PLAYER ID. The subject's own record (`{k:150, n:170}`) sat inside the field pool used
 *      as his control, and leave-one-out was not merely omitted — it was impossible to write.
 *   3. NO HEADER. The on-disk copy was produced at `MIN_OPPS=30` while the script's default was
 *      40, and no consumer could detect it. A number read under the wrong threshold looks
 *      exactly like a number read under the right one.
 *
 * So the artifact carries its own conditioning, its own provenance, and its own refusals, and
 * `loadFoldToOpenCurve` THROWS rather than returning something plausible.
 *
 * REFUSALS ARE WRITTEN DOWN, NOT OMITTED. A cell with too few players is persisted with
 * `status` and a reason. An absent key is indistinguishable from a lookup bug; a present
 * refusal carrying its shortfall is not. This is the same discipline as `coverageCensus`, whose
 * statuses this module reuses rather than inventing a parallel vocabulary.
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import {
  OPEN_SIZE_AXIS_VERSION, openSizeBucket, openSizeRange, openConditional,
} from './openSizeAxis.mjs';

export const FOLD_TO_OPEN_SCHEMA_VERSION = 1;

/**
 * Cell statuses, mirroring `src/utils/standardOfRecord/coverageCensus.js` CELL_STATUSES.
 * Duplicated as a frozen literal rather than imported because this file runs as a plain ESM
 * script against `scripts/`, while coverageCensus lives under `src/` behind the app's module
 * resolution. `curveProvenance.check.mjs` asserts the two sets agree, so a drift fails a check
 * rather than living quietly.
 */
export const CURVE_CELL_STATUS = Object.freeze({
  /** Examined, enough players to serve a rate. */
  HIT: 'hit',
  /** Examined, and the situation genuinely never arose. We looked and found none. */
  OBSERVED_ZERO: 'observed-zero',
  /** Cannot occur by construction — UTG facing a raise in an unopened pot. Not thinness. */
  UNREACHABLE: 'unreachable',
  /** Examined and reached, then discarded for want of support. Carries its shortfall. */
  DROPPED: 'dropped',
});

/** Seats that cannot face a single open in an unopened pot: the opener acts first. */
const STRUCTURALLY_UNREACHABLE = Object.freeze(['UTG']);

export const cellKey = (seat, bucket, stake) => `${seat}|${bucket}|${stake}`;

const quantile = (sorted, f) => (sorted.length
  ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(f * (sorted.length - 1))))]
  : null);

/**
 * Measure the curve over an already-selected file list.
 *
 * Single-threaded and side-effect free so it is testable on a synthetic hand list. Sharding for
 * a full-corpus run belongs to the caller, which knows about machines; this knows about hands.
 *
 * @param {Object} opts
 * @param {Array<{path,site,stakeLabel}>} opts.files - from `discoverCorpusFiles`/`selectCorpusFiles`
 * @param {Object} opts.selection - the WHOLE selection object; persisted verbatim
 * @param {string} opts.root - corpus root, for the header
 * @param {number} [opts.minCellN=40] - per-player minimum to enter a cell's player list
 * @param {number} [opts.minPlayersPerCell=40] - below this the cell refuses to serve a rate
 * @param {string[]} [opts.subjectIds=[]] - always retained regardless of `minCellN`
 * @param {AsyncIterable} [opts.handSource] - test seam; bypasses file reading entirely
 */
export const measureFoldToOpenCurve = async ({
  files = [], selection = null, root = null,
  minCellN = 40, minPlayersPerCell = 40, subjectIds = [],
  handSource = null, onProgress = null,
} = {}) => {
  const subjects = new Set(subjectIds.map(String));
  /** cellKey -> { seat, bucket, stake, players: Map<pid,{k,n}>, k, n, sizes: number[] } */
  const cells = new Map();
  const seatsSeen = new Set();
  const stakesSeen = new Set();
  const players = new Set();

  // Every row we look at and do NOT count gets a reason and a tally. A filter whose exclusions
  // are invisible is how a sample stops representing what its name says it represents.
  const excluded = {
    notPreflop: 0, notFacingSingleRaise: 0, limpedOrRaisedPot: 0,
    noAggressorSize: 0, unbucketable: 0, noBlinds: 0,
    // A THROW IS NOT A NOT-APPLICABLE. This tally exists because the first version of this
    // loop swallowed `labelDecisions` errors with a bare `catch { continue }`, and that hid a
    // real crash (decisionLabeler dereferenced a null geometry on every raise row) behind what
    // looked like an ordinary filter. Four rows in a twelve-row test vanished with no trace.
    labelThrew: 0,
  };
  const labelErrors = new Map();
  let hands = 0, counted = 0;

  const bump = (seat, bucket, stake, pid, folded, raiseToBB) => {
    const key = cellKey(seat, bucket, stake);
    let c = cells.get(key);
    if (!c) { c = { seat, bucket, stake, players: new Map(), k: 0, n: 0, sizes: [] }; cells.set(key, c); }
    let p = c.players.get(pid);
    if (!p) { p = { k: 0, n: 0 }; c.players.set(pid, p); }
    p.n++; c.n++; if (folded) { p.k++; c.k++; }
    c.sizes.push(raiseToBB);
  };

  const consume = (hand, stakeLabel) => {
    hands++;
    const g = hand?.gameState;
    const bbSize = g?.blinds?.bb;
    const sbSize = g?.blinds?.sb;
    if (!(bbSize > 0)) { excluded.noBlinds++; return; }
    // In big blinds, computed from the hand. NOT hardcoded to 1.5 — a hand with a straddle or a
    // non-standard blind structure must fall out of the unopened test rather than sneak through it.
    const blindTotalBB = (Number(sbSize ?? 0) + Number(bbSize)) / Number(bbSize);

    for (const seat of Object.keys(hand.seatPlayers || {})) {
      const pid = hand.seatPlayers[seat];
      if (pid == null) continue;
      let ds;
      try {
        ds = labelDecisions(hand, seat);
      } catch (err) {
        excluded.labelThrew++;
        const msg = String(err?.message ?? err).slice(0, 200);
        labelErrors.set(msg, (labelErrors.get(msg) ?? 0) + 1);
        continue;
      }
      for (const d of ds) {
        if (d.street !== 'preflop') { excluded.notPreflop++; continue; }
        if (d.facing !== 'a raise' || d.raisesFaced !== 1) { excluded.notFacingSingleRaise++; continue; }
        // THE UNOPENED-POT TEST. Do NOT use `limpersAhead === 0`: decisionLabeler sets that
        // field to null on every facing-a-raise row, so the filter would yield zero rows and
        // look like a corpus problem rather than a predicate bug.
        if (d.potBeforeBetBB == null || Math.abs(d.potBeforeBetBB - blindTotalBB) > 1e-6) {
          excluded.limpedOrRaisedPot++; continue;
        }
        // The raise-TO amount, read directly. Reconstructing it as `toCallBB + posted` is an
        // identity only for a seat holding exactly its blind, and silently wrong otherwise.
        const raiseToBB = d.aggressorToBB;
        if (raiseToBB == null || !Number.isFinite(raiseToBB)) { excluded.noAggressorSize++; continue; }
        const bucket = openSizeBucket(raiseToBB);
        if (bucket == null) { excluded.unbucketable++; continue; }

        seatsSeen.add(d.position); stakesSeen.add(stakeLabel); players.add(String(pid));
        bump(d.position, bucket, stakeLabel, String(pid), d.action === 'fold', raiseToBB);
        counted++;
      }
    }
  };

  if (handSource) {
    for await (const { hand, stakeLabel } of handSource) consume(hand, stakeLabel ?? 'synthetic');
  } else {
    let i = 0;
    for (const f of files) {
      for await (const hand of iterAppHands(f.path)) consume(hand, f.stakeLabel ?? 'unknown');
      if (onProgress && ++i % 25 === 0) onProgress({ files: i, total: files.length, hands });
    }
  }

  // ── shape the cells ───────────────────────────────────────────────────────────────────────
  const out = {};
  for (const [, c] of cells) {
    const kept = [];
    let below = 0;
    for (const [pid, p] of c.players) {
      if (p.n >= minCellN || subjects.has(pid)) kept.push({ pid, k: p.k, n: p.n, rate: p.k / p.n });
      else below++;
    }
    kept.sort((a, b) => (a.pid < b.pid ? -1 : a.pid > b.pid ? 1 : 0));
    const rates = kept.map((p) => p.rate).sort((a, b) => a - b);
    const sizes = c.sizes.slice().sort((a, b) => a - b);
    const enough = kept.length >= minPlayersPerCell;
    const range = openSizeRange(c.bucket);

    (out[c.seat] ||= {})[`${c.bucket}|${c.stake}`] = {
      seat: c.seat, bucket: c.bucket, stake: c.stake,
      raiseToBBRange: range,
      observedRaiseToBB: {
        median: quantile(sizes, 0.5),
        mean: sizes.length ? +(sizes.reduce((s, x) => s + x, 0) / sizes.length).toFixed(4) : null,
      },
      status: enough ? CURVE_CELL_STATUS.HIT : CURVE_CELL_STATUS.DROPPED,
      // Null, never zero. `metricsSchemas` states the rule directly: a 0/0 reported as 0 reads
      // as a measured absence, which is the opposite of what it is.
      unavailableReason: enough ? null
        : `playerCount ${kept.length} < minPlayersPerCell ${minPlayersPerCell}`,
      have: kept.length,
      need: minPlayersPerCell,
      playerCount: kept.length,
      playersBelowThreshold: below,
      players: kept,
      pooled: {
        k: c.k, n: c.n, rate: c.n ? c.k / c.n : null,
        conditional: openConditional({ seat: c.seat, bucket: c.bucket }),
      },
      betweenPlayer: rates.length ? {
        median: quantile(rates, 0.5),
        iqr: [quantile(rates, 0.25), quantile(rates, 0.75)],
        p2_5: quantile(rates, 0.025),
        p97_5: quantile(rates, 0.975),
        // Named so a reader is never left to assume a sampling interval. Below ~41 players the
        // 2.5th percentile of an empirical order statistic IS the minimum, and at one player it
        // has zero width — which reads as certainty and is the opposite.
        ciKind: rates.length >= 41 ? 'between-player empirical order statistic'
          : `between-player empirical order statistic, DEGENERATE at ${rates.length} players`,
        playerCount: rates.length,
      } : null,
    };
  }

  // Structural zeros are recorded as such. A seat that cannot occur must never be read as a
  // seat we failed to measure.
  for (const seat of STRUCTURALLY_UNREACHABLE) {
    if (!out[seat]) {
      out[seat] = {
        _structural: {
          status: CURVE_CELL_STATUS.UNREACHABLE,
          reason: `${seat} acts first in an unopened pot and therefore cannot face a single open; `
            + '0 rows by construction, not by thinness',
        },
      };
    }
  }

  return {
    artifact: 'fold-to-open-curve',
    schemaVersion: FOLD_TO_OPEN_SCHEMA_VERSION,
    axisVersion: OPEN_SIZE_AXIS_VERSION,
    corpus: {
      root, files: files.length, hands, countedDecisions: counted,
      distinctPlayers: players.size,
      stakes: [...stakesSeen].sort(),
      seats: [...seatsSeen].sort(),
      fileSelection: selection,
    },
    constants: {
      MIN_CELL_N: minCellN,
      MIN_PLAYERS_PER_CELL: minPlayersPerCell,
      OPEN_SIZE_AXIS_VERSION,
      SUBJECT_IDS_RETAINED: [...subjects].sort(),
    },
    conditioning: {
      street: 'preflop', facing: 'a raise', raisesThisStreet: 1,
      unopened: 'potBeforeBetBB === (sb + bb) / bb, computed per hand',
      sizeField: 'aggressorToBB (the cumulative raise-to amount), read directly',
      statement: 'P(fold | preflop, facing exactly one raise, unopened pot, seat, open-size bucket, stake)',
      excluded,
      // Surfaced, not just counted: a run that threw on thousands of rows produced a number
      // over a population nobody chose, and the count alone does not say what went wrong.
      labelErrors: Object.fromEntries([...labelErrors].sort((a, b) => b[1] - a[1]).slice(0, 10)),
    },
    cells: out,
  };
};

/**
 * Hash the MEASUREMENT, excluding the header.
 *
 * Full-depth and explicit. `emitConductCard` records what the shortcut costs: a
 * `JSON.stringify(obj, Object.keys(obj).sort())` one-liner reads like a key ordering and is
 * actually a replacer allowlist applied at every depth — it hashed 639 of 70,195 bytes, so
 * sabotaging every rate inside the object left the digest identical.
 */
export const foldToOpenContentHash = (cells) => {
  const h = createHash('sha256');
  for (const seat of Object.keys(cells).sort()) {
    for (const key of Object.keys(cells[seat]).sort()) {
      const c = cells[seat][key];
      h.update(`${seat} ${key} ${c.status ?? ''} ${c.playerCount ?? ''}`);
      h.update(` ${c.pooled?.k ?? ''}/${c.pooled?.n ?? ''} `);
      for (const p of c.players ?? []) h.update(`${p.pid}:${p.k}/${p.n} `);
    }
  }
  return `sha256:${h.digest('hex')}`;
};

export const writeFoldToOpenCurve = (artifact, path) => {
  const stamped = { ...artifact, contentHash: foldToOpenContentHash(artifact.cells) };
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(stamped, null, 2));
  return stamped;
};

/**
 * Read a curve, refusing anything a consumer would misread.
 *
 * THROWS rather than returning a best effort. The defect this closes is precise: the previous
 * artifact was generated at a threshold below its own default and no reader could tell, so a
 * number measured under one rule was consumed under another for as long as the file existed.
 * Every mismatch below is that same failure with a different constant in it.
 */
export const loadFoldToOpenCurve = (path, {
  expectAxisVersion = OPEN_SIZE_AXIS_VERSION,
  expectSchemaVersion = FOLD_TO_OPEN_SCHEMA_VERSION,
  expectMinCellN = null,
  expectMinPlayersPerCell = null,
  allowCollapsed = false,
  verifyContentHash = true,
} = {}) => {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const bad = (msg) => { throw new Error(`fold-to-open curve at ${path}: ${msg}`); };

  if (raw.artifact !== 'fold-to-open-curve') bad(`not a fold-to-open curve (artifact=${raw.artifact})`);
  if (raw.schemaVersion !== expectSchemaVersion) {
    bad(`schemaVersion ${raw.schemaVersion} != expected ${expectSchemaVersion} — re-measure, do not re-read`);
  }
  if (raw.axisVersion !== expectAxisVersion) {
    bad(`axisVersion ${raw.axisVersion} != expected ${expectAxisVersion} — the size lattice changed, `
      + 'so these cells were binned under a different rule');
  }
  if (expectMinCellN != null && raw.constants?.MIN_CELL_N !== expectMinCellN) {
    bad(`MIN_CELL_N ${raw.constants?.MIN_CELL_N} != expected ${expectMinCellN}`);
  }
  if (expectMinPlayersPerCell != null && raw.constants?.MIN_PLAYERS_PER_CELL !== expectMinPlayersPerCell) {
    bad(`MIN_PLAYERS_PER_CELL ${raw.constants?.MIN_PLAYERS_PER_CELL} != expected ${expectMinPlayersPerCell}`);
  }
  if (!allowCollapsed && raw.corpus?.fileSelection?.collapsed) {
    bad('the file selection COLLAPSED onto a subset of directories — this sample does not '
      + 'represent the population its name implies. Pass allowCollapsed to override deliberately.');
  }
  if (verifyContentHash) {
    const recomputed = foldToOpenContentHash(raw.cells ?? {});
    if (raw.contentHash !== recomputed) {
      bad(`contentHash does not recompute (${raw.contentHash} vs ${recomputed}) — the cells were edited`);
    }
  }
  return raw;
};

/** Look one cell up. Returns the cell (which may itself be a refusal), or null if never measured. */
export const curveCell = (curve, { seat, bucket, stake }) =>
  curve?.cells?.[seat]?.[`${bucket}|${stake}`] ?? null;
