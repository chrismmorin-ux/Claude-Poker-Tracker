/**
 * drillAnalytics.js — RT-114 taxonomy-aware aggregators over postflop drill
 * attempt arrays.
 *
 * Takes a flat `drills[]` array (as returned by `loadPostflopDrills` in the
 * persistence layer) and produces `{ [archetypeId]: stats }` or
 * `{ [bucketId]: stats }` maps. Records with unknown archetype/bucket IDs
 * (including legacy records written before RT-114 that have neither field)
 * are silently skipped — `droppedUnknown` counts them so callers can surface
 * the count as a diagnostic.
 *
 * Persistence imports from this module (not the other way around): the
 * persistence layer is taxonomy-agnostic; it stores whatever the caller
 * writes. This module is where the canonical taxonomies bind to attempt
 * data.
 *
 * Pure module — zero side effects except for a single dev-mode
 * `console.warn` when records are dropped.
 */

import { isKnownArchetype } from './archetypeRangeBuilder';
import { isKnownBucket } from './bucketTaxonomy';

const emptyStats = () => ({ attempts: 0, correct: 0, accuracy: 0 });

const finalize = (map) => {
  const out = Object.create(null);
  for (const [id, s] of Object.entries(map)) {
    out[id] = {
      attempts: s.attempts,
      correct: s.correct,
      accuracy: s.attempts ? s.correct / s.attempts : 0,
    };
  }
  return out;
};

/**
 * Aggregate attempts by `archetypeId`.
 *
 * Records without a valid archetypeId (unknown, legacy-no-archetype,
 * type-mismatched) are dropped. The return value includes `droppedUnknown`
 * so a UI can show "N attempts have no archetype tag" as a diagnostic.
 *
 * @param {Array<object>} drills — from `loadPostflopDrills`
 * @returns {{ byArchetype: Record<string, {attempts, correct, accuracy}>, droppedUnknown: number }}
 */
export const aggregateByArchetype = (drills) => {
  const map = Object.create(null);
  let droppedUnknown = 0;
  for (const d of drills || []) {
    const id = d?.archetypeId;
    if (!isKnownArchetype(id)) { droppedUnknown += 1; continue; }
    if (!map[id]) map[id] = emptyStats();
    map[id].attempts += 1;
    if (d.correct) map[id].correct += 1;
  }
  if (droppedUnknown > 0 && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[drillAnalytics] aggregateByArchetype dropped ${droppedUnknown} attempt(s) with unknown archetypeId`);
  }
  return { byArchetype: finalize(map), droppedUnknown };
};

/**
 * Aggregate attempts by `bucketId`.
 *
 * Same semantics as `aggregateByArchetype` but over the bucket taxonomy from
 * `bucketTaxonomy.js`.
 *
 * @param {Array<object>} drills
 * @returns {{ byBucket: Record<string, {attempts, correct, accuracy}>, droppedUnknown: number }}
 */
export const aggregateByBucket = (drills) => {
  const map = Object.create(null);
  let droppedUnknown = 0;
  for (const d of drills || []) {
    const id = d?.bucketId;
    if (!isKnownBucket(id)) { droppedUnknown += 1; continue; }
    if (!map[id]) map[id] = emptyStats();
    map[id].attempts += 1;
    if (d.correct) map[id].correct += 1;
  }
  if (droppedUnknown > 0 && typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[drillAnalytics] aggregateByBucket dropped ${droppedUnknown} attempt(s) with unknown bucketId`);
  }
  return { byBucket: finalize(map), droppedUnknown };
};

/**
 * Two-dimensional cross-tab: bucket × archetype. Useful for bucket-EV
 * teaching diagnostics — "where am I weak on air vs fish" kind of question.
 *
 * Legacy / untagged records are counted into `droppedUnknown`.
 *
 * @param {Array<object>} drills
 * @returns {{ byBucketArchetype: Record<string, Record<string, {attempts, correct, accuracy}>>, droppedUnknown: number }}
 */
export const aggregateByBucketArchetype = (drills) => {
  const map = Object.create(null);
  let droppedUnknown = 0;
  for (const d of drills || []) {
    const bid = d?.bucketId;
    const aid = d?.archetypeId;
    if (!isKnownBucket(bid) || !isKnownArchetype(aid)) {
      droppedUnknown += 1;
      continue;
    }
    if (!map[bid]) map[bid] = Object.create(null);
    if (!map[bid][aid]) map[bid][aid] = emptyStats();
    map[bid][aid].attempts += 1;
    if (d.correct) map[bid][aid].correct += 1;
  }
  // Finalize nested map — compute accuracy.
  const out = Object.create(null);
  for (const bid of Object.keys(map)) {
    out[bid] = Object.create(null);
    for (const aid of Object.keys(map[bid])) {
      const s = map[bid][aid];
      out[bid][aid] = {
        attempts: s.attempts,
        correct: s.correct,
        accuracy: s.attempts ? s.correct / s.attempts : 0,
      };
    }
  }
  return { byBucketArchetype: out, droppedUnknown };
};
