/**
 * sessionStore.mjs — hand-record policy over the shared NDJSON capture discipline.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT A SESSION IS HERE, AND WHY IT IS DERIVED RATHER THAN DECLARED
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A session is a contiguous run of hands at one table with no gap longer than `idleMs`.
 *
 * It is NOT a UI event, and that is deliberate. The extension has no "I am done playing"
 * button, the founder closes the browser without ceremony, and a session that depended on a
 * clean shutdown would lose its last hand every time the laptop died — which for a
 * shutdown-prone G16 is routine, not exceptional. A boundary derived from the data survives
 * every one of those, because the evidence for it is the hands themselves.
 *
 * The cost, stated: a long break at the same table splits into two sessions, and two short
 * sessions inside `idleMs` merge into one. Both are recoverable after the fact from the
 * per-hand timestamps, because nothing is aggregated at seal time — the record keeps the
 * hands, and the session boundary is a view over them.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * IDENTITY AND IDEMPOTENCE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Every hand carries the `captureId` that `enqueueHand` already stamped, and that is the id
 * this store dedupes on. It has to be idempotent rather than merely careful: the extension
 * backfills un-ACKed hands from its durable journal whenever the sink comes back, so the SAME
 * hand arriving twice is the normal case, not an error case. `append` returns `duplicate`
 * instead of throwing, so a replay is a no-op rather than an incident.
 */

import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  openNdjsonWriter,
  readLenient,
  readManifest,
  readProvisional,
} from '../lib/ndjsonStore.mjs';

/**
 * Store root. Outside the repo by default, matching the existing bulk-data convention
 * (`C:/Users/chris/data/sor-atoms`, `C:/Users/chris/data/phh-mining`).
 *
 * NOT `out/` — that directory is treated repo-wide as disposable scratch, and these are hands
 * that were actually played. They cannot be recomputed by re-running anything.
 */
export const DEFAULT_SESSION_STORE_ROOT =
  process.env.POKER_SESSION_STORE || 'C:/Users/chris/data/poker-sessions';

export const HANDS_FILE = 'hands.ndjson';
export const LIVE_DIR = 'live';
export const CLOSED_DIR = 'closed';

/** Default idle gap that seals a session. 20 minutes: longer than a table break, shorter than a meal. */
export const DEFAULT_IDLE_MS = 20 * 60 * 1000;

/**
 * MEASURED, not estimated (repo doctrine — see WS-430's bytes/atom).
 *
 * Measured 2026-08-21 over 117 hand records produced by replaying ALL FOUR captures in
 * `ignition-poker-tracker/spike-data/captures/` through the production
 * `TableManager.routeMessage` path: mean 1766 B, p50 1795 B, p95 2260 B, max 2613 B.
 *
 * The preflight uses the MAX rather than the mean, because a preflight that is right on average
 * still refuses too late for the session it is protecting.
 */
export const MEASURED_HAND_BYTES = Object.freeze({
  mean: 1766, p50: 1795, p95: 2260, max: 2613, n: 117,
  measuredAt: '2026-08-21',
  source: 'ignition-poker-tracker/spike-data/captures/*.jsonl via TableManager.routeMessage',
});

/** A generous ceiling for one session. 5000 hands is far past a human sitting. */
export const EXPECTED_HANDS_PER_SESSION = 5000;

const pad = (n) => String(n).padStart(2, '0');

/** Compact, sortable, filesystem-safe session id. */
export const sessionIdFor = (tableId, startedAt) => {
  const d = new Date(startedAt);
  const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`
    + `-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
  const safeTable = String(tableId ?? 'unknown').replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 48);
  return `sess-${stamp}-${safeTable}`;
};

/**
 * One open session, writing through to disk.
 *
 * Deliberately holds NO hands in memory beyond their ids — the file is the record, and a sink
 * that buffered would turn its own crash into data loss, which is the whole thing this exists
 * to prevent.
 */
export const openSession = async ({
  tableId,
  startedAt,
  root = DEFAULT_SESSION_STORE_ROOT,
  now = () => new Date().toISOString(),
  statfsImpl,
  openImpl,
} = {}) => {
  const sessionId = sessionIdFor(tableId, startedAt);
  const dir = join(root, LIVE_DIR, sessionId);
  await mkdir(join(root, LIVE_DIR), { recursive: true });

  const writer = await openNdjsonWriter({
    setId: sessionId,
    root,
    dir,
    dataFile: HANDS_FILE,
    idField: 'captureId',
    manifestExtras: { kind: 'poker-session', tableId: tableId ?? null, startedAt },
    expectedRecords: EXPECTED_HANDS_PER_SESSION,
    bytesPerRecord: MEASURED_HAND_BYTES.max,
    checkpointEveryRecords: 25,
    now,
    ...(statfsImpl ? { statfsImpl } : {}),
    ...(openImpl ? { openImpl } : {}),
  });

  /**
   * TWO CLOCKS, AND THEY ARE NOT INTERCHANGEABLE — this is a real bug caught by the real-capture
   * test, not a stylistic split.
   *
   * `lastHandAt` is the hand's OWN timestamp, and it decides SESSION MEMBERSHIP. It has to be the
   * record's clock: when the extension backfills fifty un-ACKed hands after the sink was down,
   * they all arrive inside a second. Judged by arrival they would collapse into one session
   * regardless of when they were actually played, which is precisely wrong.
   *
   * `lastArrivalAt` is wall-clock, and it decides the IDLE SEAL. It has to be the wall clock:
   * "the founder stopped playing" is a statement about hands NOT arriving, and no record
   * timestamp exists for a hand that never came. Judged by record time, a backfill of last
   * week's hands would seal instantly while a live table that went quiet would stay open forever.
   */
  let lastHandAt = Date.parse(startedAt);
  let lastArrivalAt = Date.now();

  return {
    sessionId,
    tableId: tableId ?? null,
    dir,
    get handCount() { return writer.count; },
    get lastHandAt() { return lastHandAt; },
    get lastArrivalAt() { return lastArrivalAt; },

    /**
     * Accept one hand. Returns `{ accepted, duplicate }` rather than throwing on a repeat,
     * because journal backfill replays hands by design and a replay is not an incident.
     */
    async accept(hand, atMs = Date.now(), arrivedAtMs = Date.now()) {
      if (!hand?.captureId) {
        throw new Error('sessionStore: hand has no captureId — the sink dedupes on it, and a '
          + 'hand without one cannot be replayed safely from the extension journal');
      }
      // A duplicate still counts as contact: the extension is talking to us, so the session is
      // not idle even though nothing new was written.
      lastArrivalAt = arrivedAtMs;
      if (writer.has(hand.captureId)) return { accepted: false, duplicate: true };
      await writer.append(hand);
      lastHandAt = atMs;
      return { accepted: true, duplicate: false };
    },

    /** Seal the session and move it out of `live/`, so "open" and "done" are directory facts. */
    async seal({ reason = 'idle' } = {}) {
      const manifest = await writer.finalize({
        extras: { sealedReason: reason, endedAt: now() },
      });
      const closedDir = join(root, CLOSED_DIR, sessionId);
      await mkdir(join(root, CLOSED_DIR), { recursive: true });
      await rename(dir, closedDir);
      return { ...manifest, dir: closedDir };
    },
  };
};

/** Sealed sessions, newest first. */
export const listClosedSessions = async (root = DEFAULT_SESSION_STORE_ROOT) => {
  const base = join(root, CLOSED_DIR);
  let entries;
  try {
    entries = await readdir(base);
  } catch {
    return [];
  }
  const out = [];
  for (const id of entries) {
    const manifest = await readManifest(join(base, id));
    if (manifest) out.push({ ...manifest, dir: join(base, id) });
  }
  return out.sort((a, b) => String(b.setId).localeCompare(String(a.setId)));
};

/**
 * Read a session's hands.
 *
 * A sealed session reads STRICTLY — its hash is published and a bad line must be loud. A live or
 * interrupted one reads leniently and reports `corruptTail`, because losing every durable hand
 * over one torn byte is the worse failure by far.
 */
export const readSessionHands = async (dir) => {
  const manifest = await readManifest(dir);
  const { records, corruptTail } = await readLenient(join(dir, HANDS_FILE));
  return {
    hands: records,
    corruptTail,
    manifest,
    provisional: manifest ? null : await readProvisional(dir),
    complete: Boolean(manifest) && !corruptTail,
  };
};

/**
 * Status written on EVERY tick, whether or not anything happened.
 *
 * `compute-feed.ps1` established why in this fleet: a missing timestamp is indistinguishable
 * from a dead task. A sink that only writes status when it has news is a sink that looks
 * identical to one that died three hours ago.
 */
export const writeStatus = async (root, status) => {
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'sink-status.json'), `${JSON.stringify(status, null, 2)}\n`, 'utf8');
};

export const readStatus = async (root = DEFAULT_SESSION_STORE_ROOT) => {
  try {
    return JSON.parse(await readFile(join(root, 'sink-status.json'), 'utf8'));
  } catch {
    return null;
  }
};
