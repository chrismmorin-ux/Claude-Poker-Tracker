/**
 * equityWorker.js — Web Worker for Monte Carlo equity computation (RT-10).
 *
 * Offloads handVsRange and exactEnumerateEquity from the main thread.
 * Accepts Float64Array villain ranges via Transferable (zero-copy).
 *
 * Protocol (single):
 *   IN:  { id, heroCards, villainRange (Float64Array), board, options }
 *   OUT: { id, result } or { id, error }
 *
 * Protocol (batch — RT-116, 2026-04-21):
 *   IN:  { id, batch: true, requests: [{ heroCards, villainRange, board, options }, ...] }
 *   OUT: { id, results: [{ result } | { error }, ...] }       // order matches requests
 *   OUT: { id, error }                                         // whole-batch failure
 *
 * Batch is for bucket-EV tables — 8 hero buckets × 3 archetypes collapse
 * from 24 round-trips to 1. Per-request failures are returned in the results
 * array as `{ error }`, so one bad combo does not fail the batch.
 */

import { handVsRange } from '../utils/pokerCore/monteCarloEquity';

const runOne = (req) =>
  handVsRange(req.heroCards, req.villainRange, req.board, req.options)
    .then((result) => ({ result }))
    .catch((err) => ({ error: err && err.message ? err.message : String(err) }));

self.onmessage = ({ data }) => {
  const { id } = data;

  if (data.batch) {
    const requests = Array.isArray(data.requests) ? data.requests : [];
    if (requests.length === 0) {
      self.postMessage({ id, results: [] });
      return;
    }
    Promise.all(requests.map(runOne))
      .then((results) => self.postMessage({ id, results }))
      .catch((err) => self.postMessage({ id, error: err && err.message ? err.message : String(err) }));
    return;
  }

  // Single-request path (unchanged).
  const { heroCards, villainRange, board, options } = data;
  handVsRange(heroCards, villainRange, board, options)
    .then((result) => self.postMessage({ id, result }))
    .catch((err) => self.postMessage({ id, error: err.message }));
};
