/**
 * heroEvWorker.mjs — worker-thread entry for the hero-EV pass (WS-433).
 *
 * One isolate, one in-flight `scoreHeroEvPlayer` at a time — the pool never sends a second
 * task before the first returns. That single-flight rule is load-bearing twice over:
 *
 *   1. The engine evaluation awaits real macrotasks (`monteCarloEquity` batch chunking),
 *      so two interleaved evaluations in one isolate would interleave their awaits; any
 *      harness pattern that patches isolate globals around an await (the
 *      `dumpGameTreeEV.mjs` freeze pattern) corrupts under interleaving.
 *   2. The seeded equity streams are per-call; single-flight means stream draws are
 *      strictly sequential and reproducible regardless of which worker runs the call.
 *
 * The engine closure is imported DIRECTLY (bare Node ESM) — never through the Vite SSR
 * loader. The closure was made bare-loadable for exactly this (WS-433 extensionless-import
 * codemod), and `check-engine-bare-import.mjs` guards the property.
 *
 * Functions cannot cross the thread boundary, so the sidecar/progress callbacks become
 * messages (`record`, `progress`) handled by the main thread, which owns all file handles.
 */

import { parentPort } from 'node:worker_threads';
import { LeakageGuard } from './leakageGuard.mjs';
import { validateBehaviorPolicy } from './behaviorPolicy.mjs';
import { rehydrateStrategy } from './strategyArm.mjs';
import { scoreHeroEvPlayer } from './heroEvTask.mjs';

if (!parentPort) throw new Error('heroEvWorker.mjs must be run as a worker thread');

let taskConfig = null;
let policy = null;
let guard = null;

const initWorker = async (msg) => {
  {
    {
      const { config, behaviorPolicy, reference, poolPct } = msg;
      // Each worker validates for itself: the guard's reference check and the policy
      // validation are cheap, and a worker that could score without them would be a
      // leakage channel the main thread cannot see.
      guard = new LeakageGuard({ poolPct, reference });
      policy = validateBehaviorPolicy(behaviorPolicy, poolPct);
      // WS-540 — rebuild strategy arms from their descriptors. `rehydrateStrategy` asserts the
      // content hash, so a worker that reconstructed a different card than the main thread
      // fails to initialise instead of quietly scoring the wrong strategy. Same reason each
      // worker re-validates the leakage guard and the behaviour policy for itself.
      const arms = [];
      for (const a of (config.arms ?? [])) {
        arms.push(a.strategyDescriptor
          // eslint-disable-next-line no-await-in-loop -- a handful of arms, once, at init
          ? { ...a, strategy: await rehydrateStrategy(a.strategyDescriptor, { armId: a.id }) }
          : a);
      }
      taskConfig = { ...config, arms };
    }
  }
};

parentPort.on('message', (msg) => {
  if (msg.type === 'init') {
    initWorker(msg).then(() => {
      parentPort.postMessage({ type: 'ready' });
    }).catch((err) => {
      parentPort.postMessage({ type: 'init-error', message: err?.message || String(err), stack: err?.stack ?? null });
    });
    return;
  }

  if (msg.type === 'task') {
    const { playerIndex, playerKey, playerId, hands } = msg;
    scoreHeroEvPlayer({
      playerIndex,
      playerKey,
      playerId,
      hands,
      config: taskConfig,
      policy,
      guard,
      emit: {
        onDecisionRecord: taskConfig.captureRecord
          ? (row) => parentPort.postMessage({ type: 'record', playerIndex, row })
          : null,
        onProgress: ({ decisionsScored }) => parentPort.postMessage({
          type: 'progress', playerIndex, decisionsScored,
        }),
      },
    }).then((fragment) => {
      parentPort.postMessage({ type: 'result', fragment });
    }).catch((err) => {
      parentPort.postMessage({
        type: 'task-error',
        playerIndex,
        playerKey,
        message: err?.message || String(err),
        stack: err?.stack ?? null,
      });
    });
  }
});
