/**
 * seedDrillAssumptions.js - Dev-only seeding of sample VillainAssumption records
 *
 * Populates the assumptionEngine state + IDB `villainAssumptions` store with 3-5
 * canonical assumptions matching the examples in `canonical-assumptions.md`.
 * Use to manually verify the PresessionDrillView UI when `ENABLE_PRESESSION_DRILL`
 * is flipped to true.
 *
 * Usage (browser console):
 *   window.__seedDrillAssumptions()       // Populate 3 canonical assumptions
 *   window.__clearDrillAssumptions()      // Remove them
 *
 * Follows the __dev__/ pattern from seedTestData.js + seedRangeTestData.js.
 */

import {
  saveAssumptionBatch,
  clearAllAssumptions,
  loadAllAssumptions,
} from '../utils/persistence/assumptionStorage';
import { produceAssumptions } from '../utils/assumptionEngine';

// =============================================================================
// FIXTURES — three canonical-example villains with tendency data
// =============================================================================

const makeFishStationTendency = () => ({
  villainId: 'seed-fish-station',
  style: 'Fish',
  totalObservations: 54,
  adaptationObservations: 8,
  observedRates: {
    foldToRiverBet: { rate: 0.17, n: 52, lastUpdated: new Date().toISOString() },
    callFrequencyVsSmallBet: { rate: 0.71, n: 48, lastUpdated: new Date().toISOString() },
  },
});

const makeNitTightTendency = () => ({
  villainId: 'seed-nit-tight',
  style: 'Nit',
  totalObservations: 71,
  adaptationObservations: 3,
  observedRates: {
    foldToCbet: { rate: 0.78, n: 71, lastUpdated: new Date().toISOString() },
    // Session 18 — Nit over-folds turn barrels too
    foldToTurnBarrel: { rate: 0.72, n: 58, lastUpdated: new Date().toISOString() },
  },
});

const makeLagTendency = () => ({
  villainId: 'seed-lag-aggressive',
  style: 'LAG',
  totalObservations: 92,
  adaptationObservations: 6,
  observedRates: {
    foldToRiverBet: { rate: 0.20, n: 35, lastUpdated: new Date().toISOString() },
    // Session 18 — LAG is a range-cbettor
    cbetFrequency: { rate: 0.91, n: 88, lastUpdated: new Date().toISOString() },
  },
});

// =============================================================================
// PRODUCE + PERSIST
// =============================================================================

/**
 * Seed 3 canonical assumptions into IDB. Safe to call multiple times — idempotent
 * via `saveAssumption` upsert semantics.
 *
 * Game-state contexts chosen to match each recipe's applicability:
 *   - seed-fish-station → river spot (foldToRiverBet recipe)
 *   - seed-nit-tight    → dry IP flop (foldToCbet recipe)
 *   - seed-lag-aggressive → paired turn (thinValueFrequency recipe will not fire; foldToRiverBet fires instead)
 *
 * Produces 3 assumptions total, one per villain, using the real producer.
 */
export const seedDrillAssumptions = async () => {
  const riverState = {
    street: 'river',
    position: 'OOP',
    texture: 'any',
    spr: 4,
    heroIsAggressor: true,
    betSizePot: 0.75,
    nodeId: 'seed-river',
  };
  const dryFlopIPState = {
    street: 'flop',
    position: 'IP',
    texture: 'dry',
    spr: 6,
    heroIsAggressor: true,
    nodeId: 'seed-dry-flop',
  };
  // Session 18 — turn barrel spot for foldToTurnBarrel recipe
  const turnBarrelState = {
    street: 'turn',
    position: 'IP',
    texture: 'any',
    spr: 4,
    heroIsAggressor: true,
    betSizePot: 0.66,
    nodeId: 'seed-turn-barrel',
  };
  // Session 18 — flop defender spot for cbetFrequency recipe
  const flopDefenderState = {
    street: 'flop',
    position: 'IP',
    texture: 'any',
    spr: 8,
    heroIsAggressor: false,
    villainIsAggressor: true,
    betSizePot: 0.50,
    nodeId: 'seed-flop-defender',
  };

  const sessionContext = { villainBBDelta: 0, stake: 'cash' };

  const allAssumptions = [];

  // Villain 1: Fish station on river
  const fishAssumptions = produceAssumptions(makeFishStationTendency(), riverState, sessionContext);
  allAssumptions.push(...fishAssumptions);

  // Villain 2: Nit tight — dry flop + turn barrel
  const nitAssumptions = produceAssumptions(makeNitTightTendency(), dryFlopIPState, sessionContext);
  allAssumptions.push(...nitAssumptions);
  const nitTurnAssumptions = produceAssumptions(makeNitTightTendency(), turnBarrelState, sessionContext);
  allAssumptions.push(...nitTurnAssumptions);

  // Villain 3: LAG — river bluff-prune + flop defender vs range-bettor
  const lagAssumptions = produceAssumptions(makeLagTendency(), riverState, sessionContext);
  allAssumptions.push(...lagAssumptions);
  const lagDefenderAssumptions = produceAssumptions(makeLagTendency(), flopDefenderState, sessionContext);
  allAssumptions.push(...lagDefenderAssumptions);

  if (allAssumptions.length === 0) {
    console.warn('[seedDrillAssumptions] No assumptions produced — priors may have been too tight. Nothing saved.');
    return { produced: 0, saved: 0 };
  }

  await saveAssumptionBatch(allAssumptions);

  console.log(`[seedDrillAssumptions] Produced + saved ${allAssumptions.length} assumptions:`);
  for (const a of allAssumptions) {
    console.log(`  ● ${a.id} — ${a.narrative?.citationShort ?? a.claim.predicate}`);
  }
  console.log('\nTo visually verify the drill:');
  console.log('  1. Set ENABLE_PRESESSION_DRILL = true in src/components/views/PresessionDrillView/index.jsx');
  console.log('  2. Reload the app');
  console.log('  3. In console: setCurrentScreen("presessionDrill")   (or navigate via your dev harness)');
  console.log('  4. Select one or more seed-* villains + a time budget + Start Drill');

  return { produced: allAssumptions.length, saved: allAssumptions.length };
};

/**
 * Remove all drill seed assumptions (clears entire store for simplicity).
 * Use when done with manual verification.
 */
export const clearDrillAssumptions = async () => {
  await clearAllAssumptions();
  console.log('[seedDrillAssumptions] Cleared villainAssumptions store.');
};

/**
 * Inspect — list all currently-persisted assumptions.
 */
export const inspectDrillAssumptions = async () => {
  const all = await loadAllAssumptions();
  console.log(`[seedDrillAssumptions] ${all.length} persisted assumption(s):`);
  for (const a of all) {
    console.log(`  ● ${a.id} — villain=${a.villainId} predicate=${a.claim?.predicate} actionable=${a.quality?.actionableInDrill}`);
  }
  return all;
};

// =============================================================================
// EXPOSE ON WINDOW (DEBUG only)
// =============================================================================

if (typeof window !== 'undefined') {
  window.__seedDrillAssumptions = seedDrillAssumptions;
  window.__clearDrillAssumptions = clearDrillAssumptions;
  window.__inspectDrillAssumptions = inspectDrillAssumptions;
}
