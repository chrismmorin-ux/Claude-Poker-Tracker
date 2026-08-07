/**
 * mergeHeroEvChunks.mjs — chunk persistence + refusal logic for the hero-EV pass (WS-433).
 *
 * The `mergeEntryMap.mjs` (WS-323) pattern, transferred: a long run persists each
 * completed WAVE as a chunk file, and a resumed run replays admission deterministically —
 * a wave whose chunk exists is seeded from disk instead of re-executed. Because seeds
 * derive from position in the stable enumeration, resumed work is input-identical to
 * uninterrupted work: a chunk boundary changes no input to any cell.
 *
 * REFUSALS, not warnings (the mergeEntryMap doctrine): a chunk whose stamp disagrees
 * with the current run on any MUST_MATCH field is not a slice of this run and cannot be
 * seeded. `engineDirty` is deliberately NOT in MUST_MATCH — it is OR-ed and surfaced,
 * exactly as `mergeEntryMap.mjs:139` does — because refusing dirty-tree resume would
 * just push people to commit noise, while hiding it would stamp a lie.
 *
 * Chunks are wave-aligned by construction (a chunk is written only when its wave fully
 * completes, atomically), so resume never faces a partial chunk: coverage is exact
 * (from, to) lookup, and gap/overlap detection reduces to "the file for this wave either
 * exists whole or does not exist".
 */

import fs from 'node:fs';
import path from 'node:path';

// v2 (WS-431): fragments carry full decision `records` when capture is on, and the stamp
// carries `decisionRecord` (schema version | null) as a MUST_MATCH field. v1 chunks are
// refused by the schemaVersion mismatch — they cannot say whether records are present.
export const HERO_EV_CHUNK_SCHEMA = 'hero-ev-chunk-v2';

/** Stamp fields that MUST agree between a chunk and the run seeding from it. */
export const MUST_MATCH = [
  'schemaVersion',
  'enumerationHash',
  'dealBookHash',
  'engineCommit',
  'playerKeyScheme',
  'seedScheme',
  'equitySeed',
  'refinementClock',
  'decisionRecord',
  'config',
  'behaviorPolicy',
];

/**
 * Build the stamp a run writes into every chunk and validates every loaded chunk
 * against. All values must be JSON-stable (the comparison is on canonical JSON).
 */
export const buildChunkStamp = ({
  enumerationHash,
  dealBookHash = null,
  engineCommit = null,
  engineDirty = null,
  playerKeyScheme,
  seedScheme,
  equitySeed,
  refinementClock = 'wall',
  decisionRecord = null,
  config,
  behaviorPolicy,
}) => ({
  schemaVersion: HERO_EV_CHUNK_SCHEMA,
  enumerationHash,
  dealBookHash,
  engineCommit,
  engineDirty,
  playerKeyScheme,
  seedScheme,
  equitySeed,
  refinementClock,
  decisionRecord,
  config,
  behaviorPolicy,
});

const canon = (v) => JSON.stringify(v ?? null);

/** Fields on which two stamps disagree — empty array means compatible. */
export const stampMismatches = (a, b) => MUST_MATCH.filter((f) => canon(a?.[f]) !== canon(b?.[f]));

const pad6 = (n) => String(n).padStart(6, '0');

export const chunkPath = (dir, from, to) => path.join(dir, `players-${pad6(from)}-${pad6(to)}.json`);

/**
 * Write one completed wave atomically (`.tmp` + rename): a chunk either exists whole or
 * does not exist, which is what makes resume's coverage logic exact.
 */
export const writeChunk = (dir, { from, to, ofTotal, stamp, fragments, failures }) => {
  fs.mkdirSync(dir, { recursive: true });
  const file = chunkPath(dir, from, to);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify({
    slice: { unit: 'player', from, to, ofTotal },
    stamp,
    fragments,
    failures,
  }));
  fs.renameSync(tmp, file);
  return file;
};

/**
 * Load the chunk for one wave, validating its stamp. Returns null when no chunk exists;
 * THROWS on a stamp mismatch or a malformed file — a run must never silently seed from
 * a chunk that belongs to a different measurement.
 */
export const loadChunk = (dir, { from, to, ofTotal, stamp }) => {
  const file = chunkPath(dir, from, to);
  if (!fs.existsSync(file)) return null;

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`hero-ev resume refused: chunk ${file} is unreadable (${err.message}). Delete it to re-run its wave.`);
  }

  const mismatches = stampMismatches(parsed.stamp, stamp);
  if (mismatches.length > 0) {
    throw new Error(
      `hero-ev resume refused: chunk ${file} disagrees with this run on [${mismatches.join(', ')}]. `
      + 'It is not a slice of this measurement — recompose the run or point --chunk-dir elsewhere.',
    );
  }
  if (parsed.slice?.from !== from || parsed.slice?.to !== to) {
    throw new Error(`hero-ev resume refused: chunk ${file} carries slice ${JSON.stringify(parsed.slice)}, expected [${from}, ${to}).`);
  }
  if (Number.isFinite(ofTotal) && parsed.slice?.ofTotal !== ofTotal) {
    throw new Error(
      `hero-ev resume refused: chunk ${file} was written against ${parsed.slice?.ofTotal} qualifying players; `
      + `this run enumerates ${ofTotal}. The enumeration changed, so slice indices no longer name the same players.`,
    );
  }
  if (!Array.isArray(parsed.fragments)) {
    throw new Error(`hero-ev resume refused: chunk ${file} carries no fragments array.`);
  }
  return { fragments: parsed.fragments, failures: parsed.failures ?? [], engineDirty: parsed.stamp?.engineDirty ?? null };
};

/**
 * Scan a chunk dir and report coverage against an expected wave list — the standalone
 * inspection helper (tests, tooling). Execution-path resume uses exact `loadChunk`
 * lookups instead.
 */
export const scanChunkCoverage = (dir, waves) => {
  const present = [];
  const missing = [];
  for (const w of waves) {
    (fs.existsSync(chunkPath(dir, w.from, w.to)) ? present : missing).push(w);
  }
  return { present, missing };
};
