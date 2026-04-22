/**
 * EquityWorkerContext.jsx — Singleton Web Worker for Monte Carlo equity (RT-27)
 *
 * Provides `computeEquity(heroCards, villainRange, board, options)` via context.
 * Single Worker instance shared across the entire app. Falls back to main-thread
 * handVsRange when Workers are unavailable (SSR, test, CSP restriction).
 *
 * isWorkerReady is reactive (useState) so consumers can conditionally render.
 * RT-32: Auto-restarts crashed Workers (max 3 attempts), exposes isWorkerHealthy.
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { handVsRange } from '../utils/pokerCore/monteCarloEquity';

const EquityWorkerContext = createContext(null);

const MAX_RESTARTS = 3;
const RESTART_DELAY_MS = 100;
const RAPID_CRASH_WINDOW_MS = 500;

export const EquityWorkerProvider = ({ children }) => {
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const [isWorkerHealthy, setIsWorkerHealthy] = useState(true);
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const nextIdRef = useRef(0);
  const restartCountRef = useRef(0);
  const lastCrashTimeRef = useRef(0);
  const restartTimerRef = useRef(null);
  const healthyTimerRef = useRef(null); // RT-40: resets restart counter after stability period

  useEffect(() => {
    if (typeof Worker === 'undefined') {
      setIsWorkerHealthy(false);
      return;
    }

    const rejectAllPending = (message) => {
      for (const [, p] of pendingRef.current) {
        p.reject(new Error(message));
      }
      pendingRef.current.clear();
    };

    const createWorker = () => {
      try {
        const worker = new Worker(
          new URL('../workers/equityWorker.js', import.meta.url),
          { type: 'module' }
        );

        worker.onmessage = ({ data }) => {
          const pending = pendingRef.current.get(data.id);
          if (!pending) return;
          pendingRef.current.delete(data.id);

          if (data.error) {
            pending.reject(new Error(data.error));
          } else if (Array.isArray(data.results)) {
            // RT-116 batch response — resolve with the full array. Per-item
            // errors are delivered as `{ error }` entries inside `results`;
            // the batch promise itself only rejects on whole-batch failure.
            pending.resolve(data.results);
          } else {
            pending.resolve(data.result);
          }
        };

        worker.onerror = (err) => {
          rejectAllPending(`Worker error: ${err?.message || 'unknown'}`);

          // RT-40: Cancel healthy timer on crash
          if (healthyTimerRef.current) {
            clearTimeout(healthyTimerRef.current);
            healthyTimerRef.current = null;
          }

          // Rapid crash detection: if two crashes within RAPID_CRASH_WINDOW_MS, count extra
          const now = Date.now();
          if (now - lastCrashTimeRef.current < RAPID_CRASH_WINDOW_MS) {
            restartCountRef.current++;
          }
          lastCrashTimeRef.current = now;
          restartCountRef.current++;

          workerRef.current = null;
          setIsWorkerReady(false);

          if (restartCountRef.current <= MAX_RESTARTS) {
            restartTimerRef.current = setTimeout(() => {
              restartTimerRef.current = null;
              createWorker();
            }, RESTART_DELAY_MS);
          } else {
            setIsWorkerHealthy(false);
          }
        };

        workerRef.current = worker;
        setIsWorkerReady(true);
        setIsWorkerHealthy(true);

        // RT-40: Reset restart counter after 5 minutes of stable operation
        if (healthyTimerRef.current) clearTimeout(healthyTimerRef.current);
        healthyTimerRef.current = setTimeout(() => {
          restartCountRef.current = 0;
          healthyTimerRef.current = null;
        }, 5 * 60 * 1000);
      } catch {
        setIsWorkerReady(false);
        setIsWorkerHealthy(false);
      }
    };

    createWorker();

    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      if (healthyTimerRef.current) {
        clearTimeout(healthyTimerRef.current);
        healthyTimerRef.current = null;
      }
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      setIsWorkerReady(false);
      rejectAllPending('Worker terminated');
    };
  }, []);

  const computeEquity = useCallback((heroCards, villainRange, board, options) => {
    if (!workerRef.current) {
      if (!isWorkerHealthy) {
        // Fallback to main-thread when worker permanently failed
        return handVsRange(heroCards, villainRange, board, options);
      }
      // Worker temporarily down during restart — also fallback
      return handVsRange(heroCards, villainRange, board, options);
    }

    return new Promise((resolve, reject) => {
      const id = nextIdRef.current++;
      pendingRef.current.set(id, { resolve, reject });

      const rangeCopy = new Float64Array(villainRange);
      workerRef.current.postMessage(
        { id, heroCards, board, villainRange: rangeCopy, options },
        [rangeCopy.buffer]
      );
    });
  }, [isWorkerHealthy]);

  /**
   * RT-116 — batch equity computation. Collapses N round-trips into 1
   * postMessage. Per-request errors are returned inline as `{ error }` entries
   * in the results array so one malformed combo does not fail the batch.
   *
   * @param {Array<{ heroCards: number[], villainRange: Float64Array, board: number[], options?: object }>} requests
   * @returns {Promise<Array<{ result?: any, error?: string }>>}
   */
  const computeEquityBatch = useCallback((requests) => {
    if (!Array.isArray(requests)) {
      return Promise.reject(new Error('computeEquityBatch: requests must be an array'));
    }
    if (requests.length === 0) {
      return Promise.resolve([]);
    }
    if (!workerRef.current) {
      // Fallback to main-thread — still single-threaded but matches the
      // batch return shape so callers don't branch on worker health.
      return Promise.all(requests.map((r) =>
        handVsRange(r.heroCards, r.villainRange, r.board, r.options)
          .then((result) => ({ result }))
          .catch((err) => ({ error: err && err.message ? err.message : String(err) })),
      ));
    }

    return new Promise((resolve, reject) => {
      const id = nextIdRef.current++;
      pendingRef.current.set(id, { resolve, reject });

      // Clone ranges before posting; transfer each buffer so the worker
      // receives them zero-copy. Buffers are distinct across requests.
      const transfer = [];
      const serializedRequests = requests.map((r) => {
        const rangeCopy = new Float64Array(r.villainRange);
        transfer.push(rangeCopy.buffer);
        return {
          heroCards: r.heroCards,
          board: r.board,
          villainRange: rangeCopy,
          options: r.options,
        };
      });
      workerRef.current.postMessage({ id, batch: true, requests: serializedRequests }, transfer);
    });
  }, [isWorkerHealthy]);

  const value = useMemo(() => ({
    computeEquity,
    computeEquityBatch,
    isWorkerReady,
    isWorkerHealthy,
  }), [computeEquity, computeEquityBatch, isWorkerReady, isWorkerHealthy]);

  return (
    <EquityWorkerContext.Provider value={value}>
      {children}
    </EquityWorkerContext.Provider>
  );
};

export const useEquityWorker = () => {
  const ctx = useContext(EquityWorkerContext);
  if (!ctx) throw new Error('useEquityWorker must be used within EquityWorkerProvider');
  return ctx;
};
