/**
 * temporal-scenarios.js — Declarative state sequences for temporal replay.
 *
 * Each scenario is an array of steps with timing that simulate how the
 * sidebar receives data during real play. Steps reference existing fixtures
 * from fixtures.js and can apply partial patches.
 *
 * Shape: { delay, fixtureKey, patch?, label, screenshot? }
 */

export const TEMPORAL_SCENARIOS = {

  // ── 1. New hand transition ──────────────────────────────────────────────
  newHandTransition: {
    name: 'New Hand Transition',
    description: 'Between hands → DEALING → PREFLOP → advice arrives',
    steps: [
      { delay: 0,    fixtureKey: 'betweenHands',     label: 'Between hands — villain scouting',      screenshot: true },
      { delay: 2000, fixtureKey: 'preflopNoAdvice',
        patch: { currentLiveContext: { state: 'DEALING', currentStreet: null } },
        label: 'DEALING state — advice pending',    screenshot: true },
      { delay: 300,  fixtureKey: 'preflopNoAdvice',   label: 'PREFLOP — still no advice',             screenshot: true },
      { delay: 800,  fixtureKey: 'preflopWithAdvice', label: 'Preflop advice arrives',                screenshot: true },
    ],
  },

  // ── 2. Street transition with advice gap ────────────────────────────────
  streetTransitionWithGap: {
    name: 'Street Transition (advice gap)',
    description: 'Preflop advice → flop dealt (no advice) → flop advice arrives',
    steps: [
      { delay: 0,    fixtureKey: 'preflopWithAdvice', label: 'Preflop with advice',                   screenshot: true },
      { delay: 1500, fixtureKey: 'flopWithAdvice',
        patch: { lastGoodAdvice: null },
        label: 'Flop dealt — advice pending',         screenshot: true },
      { delay: 1200, fixtureKey: 'flopWithAdvice',    label: 'Flop advice arrives',                   screenshot: true },
    ],
  },

  // ── 3. Rapid-fire WS messages ──────────────────────────────────────────
  rapidFireWS: {
    name: 'Rapid-fire WS (50 in 1s)',
    description: '50 context pushes, only 2 change state — tests change detection',
    steps: (() => {
      const steps = [
        { delay: 0, fixtureKey: 'flopWithAdvice', label: 'Initial flop state', screenshot: true },
      ];
      // 48 identical pushes (should all be skipped by change detection)
      for (let i = 0; i < 48; i++) {
        steps.push({ delay: 20, fixtureKey: 'flopWithAdvice', label: `Duplicate WS frame ${i + 2}` });
      }
      // 1 real state change (pot increases)
      steps.push({
        delay: 20, fixtureKey: 'flopWithAdvice',
        patch: { currentLiveContext: { pot: 42 } },
        label: 'Pot update (real change)', screenshot: true,
      });
      // 1 more identical after the change
      steps.push({
        delay: 20, fixtureKey: 'flopWithAdvice',
        patch: { currentLiveContext: { pot: 42 } },
        label: 'Duplicate after pot change',
      });
      return steps;
    })(),
  },

  // ── 4. Table switch ────────────────────────────────────────────────────
  tableSwitch: {
    name: 'Table Switch',
    description: 'Active hand → state cleared → new table data',
    steps: [
      { delay: 0,    fixtureKey: 'flopWithAdvice', label: 'Active hand on table 1',                  screenshot: true },
      { delay: 1500, fixtureKey: 'nullEdges',      label: 'State cleared (table switch)',             screenshot: true },
      { delay: 500,  fixtureKey: 'betweenHands',   label: 'New table data arrives',                  screenshot: true },
    ],
  },

  // ── 5. Pinned villain folds ────────────────────────────────────────────
  pinnedVillainFolds: {
    name: 'Pinned Villain Folds',
    description: 'Pinned villain active → folds → advice retargets',
    steps: [
      { delay: 0,    fixtureKey: 'pinnedVillainOverride', label: 'Pinned villain S1 active',          screenshot: true },
      { delay: 1500, fixtureKey: 'pinnedVillainFolded',   label: 'Pinned villain S1 folds',           screenshot: true },
      { delay: 1000, fixtureKey: 'flopWithAdvice',        label: 'Advice retargets to S3',            screenshot: true },
    ],
  },

  // ── 6. App disconnect/reconnect ────────────────────────────────────────
  appDisconnectReconnect: {
    name: 'App Disconnect/Reconnect',
    description: 'Exploits present → app disconnects → reconnects',
    steps: [
      { delay: 0,    fixtureKey: 'flopWithAdvice',   label: 'App connected — full exploits',         screenshot: true },
      { delay: 1500, fixtureKey: 'appDisconnected',  label: 'App disconnected — degraded',           screenshot: true },
      { delay: 2000, fixtureKey: 'flopWithAdvice',   label: 'App reconnected — exploits restored',   screenshot: true },
    ],
  },

  // ── 7. Hero folds mid-hand ─────────────────────────────────────────────
  heroFoldsMidHand: {
    name: 'Hero Folds Mid-Hand',
    description: 'Active on flop → hero folds → observing → hand completes',
    steps: [
      { delay: 0,    fixtureKey: 'flopWithAdvice', label: 'Active on flop with advice',              screenshot: true },
      { delay: 1500, fixtureKey: 'heroFolded',     label: 'Hero folds — observing mode',             screenshot: true },
      { delay: 3000, fixtureKey: 'betweenHands',   label: 'Hand completes — between hands',          screenshot: true },
    ],
  },

  // ── 8. Stale context timeout ───────────────────────────────────────────
  staleContextTimeout: {
    name: 'Stale Context Timeout',
    description: 'Active flop → no updates for extended period → between-hands fallback',
    steps: [
      { delay: 0,    fixtureKey: 'flopWithAdvice', label: 'Active flop — last known state',          screenshot: true },
      { delay: 5000, fixtureKey: 'betweenHands',   label: 'Stale timeout — falls back to between',   screenshot: true },
    ],
  },
};
