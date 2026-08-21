/**
 * backfillFromCapture.mjs — turn a raw Ignition WebSocket capture into sealed sessions.
 *
 * NO SHEBANG, DELIBERATELY — same reason as `reviewSession.mjs`: a test that imports a
 * shebanged `.mjs` breaks once vitest externalizes rather than transforms it, because
 * `new vm.Script` does not strip `#!` the way Node's module loader does.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHY THIS EXISTS
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The live sink only sees hands played while it is running. Four raw frame captures have
 * been sitting in `ignition-poker-tracker/spike-data/captures/` since June holding 117 real
 * hands — 104 with hero seated and 187 of 194 hero decisions carrying his actual hole cards,
 * MEASURED by replaying them through the production `TableManager`, not estimated.
 *
 * Those are the founder's own played hands, and the review pipeline had never been pointed
 * at them. This makes that a one-line operation rather than a bespoke script each time.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE SESSION BOUNDARY USES THE HAND'S OWN CLOCK, AND ONLY THAT ONE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The live sink runs two clocks (see `openSession`): record time decides MEMBERSHIP, wall
 * clock decides the IDLE SEAL. A backfill has no wall clock worth consulting — every hand
 * "arrives" in the same second — so membership is the only question and the hand's own
 * timestamp is the only admissible answer. Splitting on arrival here would collapse four
 * months of play into one session, which is the exact bug the two-clock note warns about.
 *
 * Sessions therefore split on (tableId, gap > idleMs) over RECORD time.
 *
 * AND THE RECORD'S OWN CLOCK IS NOT USABLE HERE — a dry run caught this before it wrote a
 * single session. `record-builder` stamps `timestamp`/`capturedAt` with `Date.now()` AT BUILD
 * TIME. Live that is within milliseconds of the hand, which is why it has never been wrong.
 * On a replay it is the REPLAY's clock: all twelve sessions came out dated today at 17:36,
 * two months after the hands were played. So the frame clock (`t`, written by the recorder as
 * each frame arrived) is threaded through and OVERWRITES the rebuilt record's timestamps, with
 * `backfilledClock: 'capture-frame-t'` stamped beside them so a reader can tell a
 * reconstructed time from a live one.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * PROVENANCE IS STAMPED, NEVER INFERRED
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A backfilled session is sealed with `sealedReason: 'backfill:<file>'`. A session that was
 * reconstructed from frames months later and one that was captured live are different facts
 * about how the record came to exist, and anything mining these sessions for a field policy
 * is entitled to know which it is holding.
 *
 * RUN
 *   node scripts/sessionSink/backfillFromCapture.mjs <capture.jsonl> [more.jsonl ...]
 *     [--root <storeRoot>] [--dry-run]
 */

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { TableManager } from '../../ignition-poker-tracker/shared/table-manager.js';
import { openSession, DEFAULT_SESSION_STORE_ROOT, DEFAULT_IDLE_MS } from './sessionStore.mjs';

const parseArgs = (argv) => {
  const args = { files: [] };
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dry-run') args.dryRun = true;
    else if (a.startsWith('--')) { args[a.slice(2)] = argv[i + 1]; i += 1; }
    else args.files.push(a);
  }
  return args;
};

/** Replay one raw capture through the production pipeline. Returns completed hand records. */
export const handsFromCapture = (file) => {
  const hands = [];
  const unidentifiable = [];
  // The frame currently being routed. A hand completes DURING a routeMessage call, so this is
  // the arrival time of the frame that finished it — the closest thing to a real play time the
  // capture holds, and the only one not contaminated by the replay clock.
  let frameT = null;
  const tm = new TableManager((rec) => {
    if (Number.isFinite(frameT)) {
      rec.timestamp = frameT;
      rec.capturedAt = frameT;
      if (rec.ignitionMeta) rec.ignitionMeta.capturedAt = frameT;
      rec.backfilledClock = 'capture-frame-t';
    }
    // captureId — the DEDUPE KEY, and the store throws without it.
    //
    // Live it is stamped by `enqueueHand` (storage-writer.js:305) as `<tableId>_<handNumber>`.
    // A backfill never goes through `enqueueHand`, so the same rule is applied here; keeping
    // the format identical is what lets a backfilled hand dedupe against the same hand if the
    // live sink ever sees it.
    //
    // ONE DELIBERATE DIFFERENCE: `generateCaptureId` falls back to `Date.now()` when
    // `handNumber` is missing. That is defensible live (a fresh id for an unidentifiable hand
    // beats dropping it) and WRONG here — a clock-derived id changes on every replay, so
    // re-running the backfill would write the same hand again under a new identity, forever.
    // A hand with no handNumber is therefore counted and skipped, never invented.
    const handNumber = rec?.ignitionMeta?.handNumber;
    if (handNumber == null || handNumber === '') { unidentifiable.push(rec); return; }
    rec.captureId = `${rec.tableId || 'unknown'}_${handNumber}`;
    hands.push(rec);
  }, () => {});
  const lines = readFileSync(file, 'utf8').split('\n');
  let frames = 0;
  let threw = 0;
  let undatedFrames = 0;
  for (const line of lines) {
    if (!line) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }
    // CONNECTION LIFECYCLE — replayed, not skipped.
    //
    // This loop used to accept only `kind === 'msg'`, so the replay never told
    // TableManager that a socket opened or closed. That is not a small omission:
    // reconnect handling is ENTIRELY driven by those events. A close is what
    // marks a machine disconnected, and a reconnect is only distinguishable from
    // a second concurrent table on the same URL by whether the old socket closed
    // (the game WS URL carries no table identifier — one URL is shared by up to
    // five connIds across these captures).
    //
    // So without this branch the harness silently exercised a lifecycle that
    // does not occur, and any conclusion it produced about reconnects — session
    // partitioning included — was measured on the wrong thing. The captures have
    // carried these frames all along (`kind:'conn'`, `event:'opened'|'closed'`,
    // code 1005 on the real closes); nothing was missing but the wiring.
    if (rec.kind === 'conn') {
      frameT = Number.isFinite(Number(rec.t)) ? Number(rec.t) : frameT;
      try {
        if (rec.event === 'creating' || rec.event === 'opened') {
          tm.registerConnection(rec.connId, rec.url);
        } else if (rec.event === 'closed') {
          // Pass the frame's own clock, not wall time — a replay must not have
          // its grace windows decided by when the replay happens to run.
          tm.handleConnectionClosed(rec.connId, frameT ?? Date.now());
        }
      } catch { threw += 1; }
      continue;
    }
    if (rec.kind !== 'msg') continue;
    frames += 1;
    frameT = Number.isFinite(Number(rec.t)) ? Number(rec.t) : null;
    if (frameT === null) undatedFrames += 1;
    // A garbled frame is one frame, never the run. The live producer survives them too.
    try { tm.routeMessage(rec.connId, rec.data, rec.url); } catch { threw += 1; }
  }
  return { hands, frames, threw, undatedFrames, unidentifiable };
};

/**
 * Split completed hands into sessions on (tableId, idle gap) over the hands' OWN timestamps.
 * A hand with no usable timestamp cannot be placed on the clock, so it is REPORTED, never
 * silently folded into whichever session happens to be open.
 */
export const splitIntoSessions = (hands, idleMs = DEFAULT_IDLE_MS) => {
  const undatable = [];
  const dated = [];
  for (const h of hands) {
    const t = Number(h?.timestamp ?? h?.capturedAt);
    if (!Number.isFinite(t)) { undatable.push(h); continue; }
    dated.push({ hand: h, t, tableId: h?.tableId ?? null });
  }
  dated.sort((a, b) => a.t - b.t || String(a.tableId).localeCompare(String(b.tableId)));

  const open = new Map(); // tableId -> current session bucket
  const sessions = [];
  for (const entry of dated) {
    const key = String(entry.tableId);
    const cur = open.get(key);
    if (cur && entry.t - cur.lastT <= idleMs) {
      cur.hands.push(entry.hand);
      cur.lastT = entry.t;
      continue;
    }
    const bucket = { tableId: entry.tableId, startedAtMs: entry.t, lastT: entry.t, hands: [entry.hand] };
    open.set(key, bucket);
    sessions.push(bucket);
  }
  return { sessions, undatable };
};

const main = async () => {
  const args = parseArgs(process.argv);
  if (!args.files.length) {
    console.error('Usage: node scripts/sessionSink/backfillFromCapture.mjs <capture.jsonl> [...] '
      + '[--root <storeRoot>] [--dry-run]');
    process.exit(2);
  }
  const root = typeof args.root === 'string' ? args.root : DEFAULT_SESSION_STORE_ROOT;

  /**
   * EVERY FILE IS POOLED BEFORE ANYTHING IS WRITTEN, and the reason is not tidiness.
   *
   * The captures OVERLAP: `table_1781552298957001 @ 2026-06-15T19:38` appears in both the
   * 06-15 and the 06-19 file, and `table_1781552467900001` appears with 4 hands in one and 10
   * in the other. Written per-file, the second pass would open a live session with an id that
   * is already sealed in `closed/` and then rename over it — clobbering the larger capture
   * with the smaller one, silently, with a success message.
   *
   * Pooling makes the overlap a DEDUPE on `captureId` (the same key the live sink uses for
   * journal backfill) instead of a race between two writers for one directory.
   */
  const seen = new Set();
  const pooled = [];
  let duplicatesAcrossFiles = 0;
  const provenance = [];

  for (const file of args.files) {
    const { hands, frames, threw, undatedFrames, unidentifiable } = handsFromCapture(file);
    const heroHands = hands.filter((h) => h?.gameState?.mySeat != null).length;
    console.log(`${basename(file)}: ${frames} frames -> ${hands.length} hands `
      + `(${heroHands} with hero, ${threw} frame(s) threw, ${undatedFrames} frame(s) had no clock, `
      + `${unidentifiable.length} hand(s) with no handNumber skipped)`);
    provenance.push(basename(file));
    for (const h of hands) {
      const id = h?.captureId;
      if (!id) continue;
      if (seen.has(id)) { duplicatesAcrossFiles += 1; continue; }
      seen.add(id);
      pooled.push(h);
    }
  }
  console.log(`pooled: ${pooled.length} unique hands (${duplicatesAcrossFiles} duplicate across files)`);

  const { sessions, undatable } = splitIntoSessions(pooled);
  if (undatable.length) {
    console.log(`WARNING: ${undatable.length} hand(s) carry no usable clock and were NOT written. `
      + 'A hand that cannot be placed on the timeline cannot be assigned to a session, and '
      + 'guessing which one would corrupt every time-keyed reading downstream.');
  }

  const reason = `backfill:${provenance.join(',')}`;
  let totalWritten = 0;
  let totalHero = 0;
  for (const s of sessions) {
    const startedAt = new Date(s.startedAtMs).toISOString();
    const heroCount = s.hands.filter((h) => h?.gameState?.mySeat != null).length;
    totalHero += heroCount;
    if (args.dryRun) {
      console.log(`  [dry] ${s.tableId} @ ${startedAt}: ${s.hands.length} hands, ${heroCount} with hero`);
      continue;
    }
    const session = await openSession({ tableId: s.tableId, startedAt, root });
    let accepted = 0;
    let duplicate = 0;
    for (const h of s.hands) {
      const t = Number(h?.timestamp ?? h?.capturedAt);
      const res = await session.accept(h, t, t);
      if (res.accepted) accepted += 1; else duplicate += 1;
    }
    const sealed = await session.seal({ reason });
    totalWritten += accepted;
    console.log(`  ${session.sessionId}: ${accepted} written, ${duplicate} duplicate, `
      + `${heroCount} with hero -> ${sealed.dir}`);
  }
  console.log(`${args.dryRun ? '[dry] ' : ''}${sessions.length} session(s), `
    + `${args.dryRun ? pooled.length : totalWritten} hand(s), ${totalHero} with hero`);
};

if (process.argv[1] && process.argv[1].endsWith('backfillFromCapture.mjs')) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
