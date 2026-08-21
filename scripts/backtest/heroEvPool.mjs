/**
 * heroEvPool.mjs — worker-thread pool for the hero-EV pass (WS-433).
 *
 * Lifecycle: `createHeroEvPool` spawns and inits N workers once; `runWave` dispatches one
 * wave of player tasks (one in-flight task per worker) and resolves when the whole wave
 * has returned; `destroy` terminates the workers. The ORCHESTRATOR owns wave admission
 * and all stop rules — this module moves work, it never merges it and never decides it.
 *
 * Fragments return in COMPLETION order; the orchestrator folds them in CANONICAL order,
 * so nothing here can influence any accumulated number.
 *
 * Failure policy:
 *   - `task-error` (the task function threw for one player): recorded, wave continues —
 *     one malformed player must not kill a multi-hour pass.
 *   - worker CRASH (error/exit mid-task): the run fails loudly. A crash is evidence of an
 *     engine or environment defect, and silently retrying could mask a determinism bug.
 *     Completed fragments are already with the caller.
 */

import { Worker } from 'node:worker_threads';

export const createHeroEvPool = async ({
  config,           // serializable task config (engine arms only — no functions)
  behaviorPolicy,   // raw policy blob (revalidated per worker)
  reference,        // REFERENCE_DISABLED sentinel or stamped table JSON
  poolPct,
  workers,
  onRecord = null,  // (row) => void — decision-record sidecar rows, main thread owns files
  // WS-540 Phase 1 — arm-independent context rows. Same ownership rule: the worker produces,
  // the main thread owns the file. A `Float64Array` range crosses structuredClone intact.
  onContext = null,
  log = () => {},
}) => {
  if (!Number.isInteger(workers) || workers < 1) {
    throw new Error(`createHeroEvPool: workers must be a positive integer, got ${workers}`);
  }

  const workerUrl = new URL('./heroEvWorker.mjs', import.meta.url);
  const pool = [];
  let fatal = null;

  await Promise.all(Array.from({ length: workers }, (_, slot) => new Promise((resolve, reject) => {
    const w = new Worker(workerUrl);
    const entry = { w, slot, current: null, onMessage: null, failRun: null };
    w.on('message', (msg) => {
      if (msg.type === 'ready') { resolve(entry); return; }
      if (msg.type === 'init-error') {
        reject(new Error(`heroEvPool: worker ${slot} failed to init: ${msg.message}`));
        return;
      }
      entry.onMessage?.(msg);
    });
    w.on('error', (err) => {
      const wrapped = new Error(
        `heroEvPool: worker ${slot} errored${entry.current ? ` on player ${entry.current.playerId}` : ''}: ${err.message}`,
      );
      fatal = wrapped;
      if (entry.failRun) entry.failRun(wrapped); else reject(wrapped);
    });
    w.on('exit', (code) => {
      if (code !== 0 && entry.current) {
        const wrapped = new Error(
          `heroEvPool: worker ${slot} exited ${code} mid-task (player ${entry.current.playerId}) — `
          + 'refusing to continue; completed fragments are preserved',
        );
        fatal = wrapped;
        if (entry.failRun) entry.failRun(wrapped);
      }
    });
    w.postMessage({ type: 'init', config, behaviorPolicy, reference, poolPct });
    pool.push(entry);
  })));
  log(`pool: ${workers} workers ready`);

  /**
   * Run one wave. `entries` are planned players `{playerIndex, playerId}` in canonical
   * order; `handsFor`/`bareIdFor` resolve the payloads at dispatch time so hands are
   * cloned to exactly one worker.
   * @returns {Promise<{failures: Array}>} — fragments stream to `onFragment` on arrival.
   */
  const runWave = (entries, { handsFor, bareIdFor, onFragment }) => new Promise((resolveWave, rejectWave) => {
    if (fatal) { rejectWave(fatal); return; }
    const queue = [...entries];
    const failures = [];
    let inFlight = 0;

    const maybeDone = () => {
      if (inFlight === 0 && queue.length === 0) resolveWave({ failures });
    };

    const dispatch = (entry) => {
      if (fatal) return;
      const next = queue.shift();
      if (!next) { maybeDone(); return; }
      entry.current = next;
      inFlight++;
      entry.w.postMessage({
        type: 'task',
        playerIndex: next.playerIndex,
        playerKey: next.playerId,
        playerId: bareIdFor(next.playerId),
        hands: handsFor(next.playerId),
      });
    };

    for (const entry of pool) {
      entry.failRun = rejectWave;
      entry.onMessage = (msg) => {
        if (msg.type === 'result') {
          inFlight--;
          entry.current = null;
          onFragment(msg.fragment);
          dispatch(entry);
        } else if (msg.type === 'task-error') {
          inFlight--;
          entry.current = null;
          failures.push({ playerIndex: msg.playerIndex, playerKey: msg.playerKey, message: msg.message });
          log(`pool: player ${msg.playerKey} failed: ${msg.message}`);
          dispatch(entry);
        } else if (msg.type === 'record') {
          if (onRecord) onRecord(msg.row);
        } else if (msg.type === 'context') {
          if (onContext) onContext(msg.row);
        }
        // 'progress' messages are heartbeat only; the orchestrator logs at its own cadence.
      };
    }

    if (queue.length === 0) { resolveWave({ failures }); return; }
    for (const entry of pool) dispatch(entry);
  });

  const destroy = async () => {
    await Promise.allSettled(pool.map((e) => e.w.terminate()));
  };

  return { runWave, destroy };
};
