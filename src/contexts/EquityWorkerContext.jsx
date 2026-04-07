/**
 * EquityWorkerContext.jsx — Singleton Web Worker for Monte Carlo equity (RT-27)
 *
 * Provides `computeEquity(heroCards, villainRange, board, options)` via context.
 * Single Worker instance shared across the entire app. Falls back to main-thread
 * handVsRange when Workers are unavailable (SSR, test, CSP restriction).
 *
 * isWorkerReady is reactive (useState) so consumers can conditionally render.
 */

import { createContext, useContext, useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { handVsRange } from '../utils/exploitEngine/monteCarloEquity';

const EquityWorkerContext = createContext(null);

export const EquityWorkerProvider = ({ children }) => {
  const [isWorkerReady, setIsWorkerReady] = useState(false);
  const workerRef = useRef(null);
  const pendingRef = useRef(new Map());
  const nextIdRef = useRef(0);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;

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
        } else {
          pending.resolve(data.result);
        }
      };

      worker.onerror = (err) => {
        for (const [, p] of pendingRef.current) {
          p.reject(new Error(`Worker error: ${err.message}`));
        }
        pendingRef.current.clear();
      };

      workerRef.current = worker;
      setIsWorkerReady(true);

      return () => {
        worker.terminate();
        workerRef.current = null;
        setIsWorkerReady(false);
        for (const [, p] of pendingRef.current) {
          p.reject(new Error('Worker terminated'));
        }
        pendingRef.current.clear();
      };
    } catch {
      setIsWorkerReady(false);
    }
  }, []);

  const computeEquity = useCallback((heroCards, villainRange, board, options) => {
    if (!workerRef.current) {
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
  }, []);

  const value = useMemo(() => ({
    computeEquity,
    isWorkerReady,
  }), [computeEquity, isWorkerReady]);

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
