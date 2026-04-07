/**
 * equityWorker.js — Web Worker for Monte Carlo equity computation (RT-10)
 *
 * Offloads handVsRange and exactEnumerateEquity from the main thread.
 * Accepts Float64Array villain ranges via Transferable (zero-copy).
 *
 * Protocol:
 *   IN:  { id, heroCards, villainRange (Float64Array), board, options }
 *   OUT: { id, result } or { id, error }
 */

import { handVsRange } from '../utils/exploitEngine/monteCarloEquity';

self.onmessage = ({ data }) => {
  const { id, heroCards, villainRange, board, options } = data;

  // villainRange arrives as Float64Array via Transferable
  handVsRange(heroCards, villainRange, board, options)
    .then(result => self.postMessage({ id, result }))
    .catch(err => self.postMessage({ id, error: err.message }));
};
