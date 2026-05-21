/**
 * migrationRegistry.js — single source of truth for IDB migration history.
 *
 * Each entry documents one schema version: what it adds/changes, who owns it,
 * and which migrationV* function in `migrations.js` implements it. The registry
 * is consumed by:
 *   - `migrations.js` — logs a summary at upgrade time so a missing/stale
 *     entry surfaces as a runtime error rather than silent drift.
 *   - `__tests__/migrationRegistry.test.js` — asserts completeness,
 *     additive-only semantics, owner integrity, and migrationFn linkage.
 *   - `scripts/check-idb-additive.sh` — companion CI gate forbids
 *     `deleteObjectStore` / `deleteIndex` in `migrations.js`.
 *
 * Resolves SYSTEM_MODEL.md §11 TD-16. Replaces inline ownership comment
 * blocks previously held in `database.js` lines 64–110.
 *
 * Authoring rules (binding):
 *   1. Entries are append-only. Never edit a shipped entry's `version`,
 *      `migrationFn`, `storesAdded`, or `owner` — those are historical facts.
 *      Description/notes may be improved.
 *   2. `storesRemoved` MUST stay `[]` for every entry, forever. Store removal
 *      would break replay from any prior version.
 *   3. A new migration adds a new entry whose `version` equals `DB_VERSION`
 *      in `database.js` after the bump. Test #6 enforces this alignment.
 *   4. `owner.program` MUST match an id in `.claude/workstream/programs/registry.yaml`.
 *      Test #4 enforces.
 */

export const KNOWN_PROGRAM_IDS = [
  'engineering',
  'anti-hallucination',
  'change-management',
  'design',
  'domain-correctness',
  'methodology-integrity',
  'launch',
];

/**
 * @typedef {Object} MigrationRegistryEntry
 * @property {number} version - Schema version this entry documents.
 * @property {string} name - Short human title.
 * @property {string} description - 1–3 sentences explaining what the migration does.
 * @property {string[]} storesAdded - Object stores created at this version.
 * @property {string[]} storesChanged - Object stores whose schema or records were modified (indexes, fields, data backfill).
 * @property {string[]} storesRemoved - MUST stay []. Tested.
 * @property {string[]} [indexesAdded] - Optional, when relevant.
 * @property {{program: string, project: string, projectRef?: string}} owner
 * @property {string|null} shippedAt - ISO date string when migration landed in main, or null if pre-CWOS (before 2026-05-01).
 * @property {string} migrationFn - Name of the exported migration function in `migrations.js`.
 * @property {string} [notes] - Optional commentary (idempotence pattern, dynamic-target rule, etc.).
 */

/** @type {MigrationRegistryEntry[]} */
export const MIGRATION_REGISTRY = [
  {
    version: 1,
    name: 'Hands store',
    description: 'Creates the foundational hands object store with timestamp + sessionId indexes.',
    storesAdded: ['hands'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['hands.timestamp', 'hands.sessionId'],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV1',
  },
  {
    version: 2,
    name: 'Sessions + activeSession stores',
    description: 'Creates the sessions store with startTime/endTime/isActive indexes and the activeSession singleton store.',
    storesAdded: ['sessions', 'activeSession'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['sessions.startTime', 'sessions.endTime', 'sessions.isActive'],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV2',
  },
  {
    version: 3,
    name: 'Session venue + gameType + rebuyTransactions',
    description: 'Data migration on sessions: adds venue/gameType defaults; converts legacy scalar `rebuy` into structured `rebuyTransactions` array.',
    storesAdded: [],
    storesChanged: ['sessions'],
    storesRemoved: [],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV3',
    notes: 'Skip-on-fresh-install (oldVersion > 0 guard in orchestrator).',
  },
  {
    version: 4,
    name: 'Session cashOut field',
    description: 'Data migration: defaults cashOut to null on all legacy sessions.',
    storesAdded: [],
    storesChanged: ['sessions'],
    storesRemoved: [],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV4',
    notes: 'Skip-on-fresh-install.',
  },
  {
    version: 5,
    name: 'Players store',
    description: 'Creates the players store with name/createdAt/lastSeenAt indexes for player-tendency aggregation.',
    storesAdded: ['players'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['players.name', 'players.createdAt', 'players.lastSeenAt'],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV5',
  },
  {
    version: 6,
    name: 'Settings store',
    description: 'Creates the settings singleton store keyed by id.',
    storesAdded: ['settings'],
    storesChanged: [],
    storesRemoved: [],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV6',
  },
  {
    version: 7,
    name: 'Multi-user userId scoping',
    description: 'Hybrid schema + data migration: adds userId indexes to hands/sessions/players and userId-keyed re-key on settings/activeSession; backfills legacy records to GUEST_USER_ID.',
    storesAdded: [],
    storesChanged: ['hands', 'sessions', 'players', 'settings', 'activeSession'],
    storesRemoved: [],
    indexesAdded: [
      'hands.userId',
      'hands.userId_timestamp',
      'sessions.userId',
      'sessions.userId_startTime',
      'players.userId',
      'players.userId_name',
    ],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV7',
    notes: 'Record-level settings.delete(1) + activeSession.delete(1) re-keying is NOT a store-removal — additive invariant preserved.',
  },
  {
    version: 8,
    name: 'actionSequence on hands',
    description: 'Data migration: converts per-street seatActions into ordered actionSequence array on hands records.',
    storesAdded: [],
    storesChanged: ['hands'],
    storesRemoved: [],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV8',
    notes: 'Skip-on-fresh-install.',
  },
  {
    version: 9,
    name: 'rangeProfiles store',
    description: 'Creates the rangeProfiles store keyed by profileKey for the Bayesian Range Engine.',
    storesAdded: ['rangeProfiles'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['rangeProfiles.playerId', 'rangeProfiles.userId'],
    owner: { program: 'domain-correctness', project: 'rangeEngine' },
    shippedAt: null,
    migrationFn: 'migrateV9',
  },
  {
    version: 10,
    name: 'exploitBriefings on players',
    description: 'Data migration: adds exploitBriefings field to player records for the Exploit Engine output cache.',
    storesAdded: [],
    storesChanged: ['players'],
    storesRemoved: [],
    owner: { program: 'domain-correctness', project: 'exploitEngine' },
    shippedAt: null,
    migrationFn: 'migrateV10',
    notes: 'Skip-on-fresh-install.',
  },
  {
    version: 11,
    name: 'tournaments store',
    description: 'Creates the tournaments store keyed by tournamentId with a unique sessionId index.',
    storesAdded: ['tournaments'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['tournaments.sessionId', 'tournaments.userId'],
    owner: { program: 'engineering', project: 'tournament' },
    shippedAt: null,
    migrationFn: 'migrateV11',
  },
  {
    version: 12,
    name: 'Online play source/tableId indexes',
    description: 'Adds source + tableId indexes on hands and sessions to support online-play filtering.',
    storesAdded: [],
    storesChanged: ['hands', 'sessions'],
    storesRemoved: [],
    indexesAdded: ['hands.source', 'sessions.source', 'sessions.tableId'],
    owner: { program: 'engineering', project: 'online' },
    shippedAt: null,
    migrationFn: 'migrateV12',
  },
  {
    version: 13,
    name: 'seatActions string → array normalization',
    description: 'Data migration: normalizes seatActions field on hands from legacy string shapes into uniform arrays; replaces per-load runtime normalization.',
    storesAdded: [],
    storesChanged: ['hands'],
    storesRemoved: [],
    owner: { program: 'engineering', project: 'baseline' },
    shippedAt: null,
    migrationFn: 'migrateV13',
    notes: 'Skip-on-fresh-install.',
  },
  {
    version: 14,
    name: 'playerDrafts store (PEO-1)',
    description: 'Creates the playerDrafts store keyed by userId for in-progress player editor autosave drafts.',
    storesAdded: ['playerDrafts'],
    storesChanged: [],
    storesRemoved: [],
    owner: {
      program: 'engineering',
      project: 'PEO',
      projectRef: 'C:/Users/chris/.claude/projects/C--Users-chris-OneDrive-Desktop-Claude-Poker-Tracker/memory/project_player_entry_overhaul.md',
    },
    shippedAt: '2026-04-16',
    migrationFn: 'migrateV14',
  },
  {
    version: 15,
    name: 'preflopDrills store',
    description: 'Creates the preflopDrills store keyed by drillId for preflop equity-drill attempt tracking.',
    storesAdded: ['preflopDrills'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['preflopDrills.userId', 'preflopDrills.drillType', 'preflopDrills.matchupKey', 'preflopDrills.userId_timestamp'],
    owner: { program: 'domain-correctness', project: 'preflopDrills' },
    shippedAt: null,
    migrationFn: 'migrateV15',
  },
  {
    version: 16,
    name: 'postflopDrills store',
    description: 'Creates the postflopDrills store keyed by drillId for postflop range-vs-board drill attempt tracking.',
    storesAdded: ['postflopDrills'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['postflopDrills.userId', 'postflopDrills.drillType', 'postflopDrills.scenarioKey', 'postflopDrills.userId_timestamp'],
    owner: { program: 'domain-correctness', project: 'postflopDrills' },
    shippedAt: null,
    migrationFn: 'migrateV16',
  },
  {
    version: 17,
    name: 'villainAssumptions store (Exploit Deviation Engine)',
    description: 'Creates the villainAssumptions store with compound key [villainId, id] and status/lastUpdated/schemaVersion indexes for the Exploit Deviation Engine.',
    storesAdded: ['villainAssumptions'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['villainAssumptions.villainId', 'villainAssumptions.status', 'villainAssumptions.lastUpdated', 'villainAssumptions.schemaVersion'],
    owner: { program: 'domain-correctness', project: 'exploitDeviation' },
    shippedAt: null,
    migrationFn: 'migrateV17',
    notes: 'No comment in orchestrator block (missing-comment case flagged during Refactor Sprint Item 3); origin: exploit-deviation Phase 6 Commit 7, architecture §8.1.',
  },
  {
    version: 18,
    name: 'subscription store (MPMF G5-B1)',
    description: 'Creates the subscription singleton store keyed by userId for entitlement state. Seeds the guest user record with tier=free / cohort=standard.',
    storesAdded: ['subscription'],
    storesChanged: [],
    storesRemoved: [],
    owner: { program: 'change-management', project: 'MPMF' },
    shippedAt: '2026-04-25',
    migrationFn: 'migrateV18',
    notes: 'Seed lands atomically inside the upgrade transaction so writers never need a "create-on-first-read" branch.',
  },
  {
    version: 19,
    name: 'Exploit Anchor Library (EAL) stores',
    description: 'Creates 4 main EAL stores + 1 drafts sidecar: exploitAnchors, anchorObservations, anchorObservationDrafts, anchorCandidates, perceptionPrimitives. Seeds 8 starter perception primitives.',
    storesAdded: ['exploitAnchors', 'anchorObservations', 'anchorObservationDrafts', 'anchorCandidates', 'perceptionPrimitives'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: [
      'exploitAnchors.villainId',
      'exploitAnchors.archetypeName',
      'exploitAnchors.polarity',
      'exploitAnchors.tier',
      'exploitAnchors.status',
      'exploitAnchors.lastUpdated',
      'exploitAnchors.schemaVersion',
      'anchorObservations.handId',
      'anchorObservations.createdAt',
      'anchorObservations.status',
      'anchorObservations.promotedToCandidateId',
      'anchorObservations.origin',
      'anchorObservationDrafts.handId',
      'anchorObservationDrafts.updatedAt',
      'anchorCandidates.status',
      'anchorCandidates.ownerPromotedAt',
      'anchorCandidates.archetypeName',
      'perceptionPrimitives.appliesToStyles',
      'perceptionPrimitives.lastUpdated',
    ],
    owner: {
      program: 'domain-correctness',
      project: 'EAL',
      projectRef: 'C:/Users/chris/.claude/projects/C--Users-chris-OneDrive-Desktop-Claude-Poker-Tracker/memory/project_exploit_anchor_library.md',
    },
    shippedAt: '2026-04-25',
    migrationFn: 'migrateV19',
    notes: 'Dynamic-target rule resolved to v19 (max(currentVersion+1, 19) per gate4-p3-decisions.md §2).',
  },
  {
    version: 20,
    name: 'Printable Refresher (PRF) stores',
    description: 'Creates the userRefresherConfig singleton store (seeded with default config) and the printBatches append-only store with a printedAt index.',
    storesAdded: ['userRefresherConfig', 'printBatches'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['printBatches.printedAt'],
    owner: {
      program: 'engineering',
      project: 'PRF',
      projectRef: 'C:/Users/chris/.claude/projects/C--Users-chris-OneDrive-Desktop-Claude-Poker-Tracker/memory/project_printable_refresher.md',
    },
    shippedAt: '2026-04-26',
    migrationFn: 'migrateV20',
    notes: 'Dynamic-target max(currentVersion+1, 18) resolved statically to 20 because EAL claimed v19 first. printBatches is append-only per I-WR-5; CI gate scripts/check-refresher-writers.sh enforces.',
  },
  {
    version: 21,
    name: 'telemetryConsent store (MPMF G5-B2)',
    description: 'Creates the telemetryConsent singleton store keyed by userId for first-launch + per-category telemetry consent state. Seeds guest record with firstLaunchSeenAt=null.',
    storesAdded: ['telemetryConsent'],
    storesChanged: [],
    storesRemoved: [],
    owner: { program: 'change-management', project: 'MPMF' },
    shippedAt: '2026-04-26',
    migrationFn: 'migrateV21',
    notes: 'Dedicated store (vs nested under settings) avoids write race between useSettingsPersistence and useTelemetryConsentPersistence.',
  },
  {
    version: 22,
    name: 'heroLeaks store (SCF G5)',
    description: 'Creates the heroLeaks store with composite keypath [playerId, situationKey] for hero-leak detection storage.',
    storesAdded: ['heroLeaks'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: ['heroLeaks.by_playerId', 'heroLeaks.by_situationKey', 'heroLeaks.by_severity'],
    owner: { program: 'domain-correctness', project: 'SCF' },
    shippedAt: '2026-05-03',
    migrationFn: 'migrateV22',
    notes: 'Read-allowed surfaces gated by skillAssessment/CLAUDE.md source-util-policy whitelist; live-table surfaces blacklisted per chris-live-player.md autonomy red line #8.',
  },
  {
    version: 23,
    name: 'PIO sightingLogs + playerPhotos + player schema extensions',
    description: 'Creates the sightingLogs append-only store (5 indexes) and playerPhotos blob store (1 index); extends players schema with ageDecade, ethnicityTags, wardrobe, jewelry, logo, photoBlobId defaults.',
    storesAdded: ['sightingLogs', 'playerPhotos'],
    storesChanged: ['players'],
    storesRemoved: [],
    indexesAdded: [
      'sightingLogs.by_playerId',
      'sightingLogs.by_playerId_sessionId',
      'sightingLogs.by_featuresSeen',
      'sightingLogs.by_capturedAt',
      'sightingLogs.by_venueId',
      'playerPhotos.by_playerId',
    ],
    owner: {
      program: 'domain-correctness',
      project: 'PIO',
    },
    shippedAt: '2026-05-04',
    migrationFn: 'migrateV23',
    notes: 'PIO-G4-MIG / SPR-034 / WS-160. Player schema extension is skip-on-fresh-install.',
  },
  {
    version: 24,
    name: 'players accessoryInventory + distinguishingMarks',
    description: 'Data migration: defaults distinguishingMarks=[] and accessoryInventory=[] on players; backfills accessoryInventory entries from legacy headwear/eyewear/hatColor/eyewearColor fields (idempotent).',
    storesAdded: [],
    storesChanged: ['players'],
    storesRemoved: [],
    owner: { program: 'domain-correctness', project: 'PIO' },
    shippedAt: '2026-05-06',
    migrationFn: 'migrateV24',
    notes: 'Legacy fields STAY (additive only). Removal blocked on consumer migration; tracked separately.',
  },
  {
    version: 25,
    name: 'PMC predictionAudit primitive (Phase 5a)',
    description: 'Data migration: defaults predictionAudit=null on legacy hands. New hands populate the field via predictionAuditWriter at hand-end (forward-only — no engine-replay backfill).',
    storesAdded: [],
    storesChanged: ['hands'],
    storesRemoved: [],
    owner: {
      program: 'domain-correctness',
      project: 'PMC',
      projectRef: 'C:/Users/chris/.claude/projects/C--Users-chris-OneDrive-Desktop-Claude-Poker-Tracker/memory/project_predictive_model_calibration.md',
    },
    shippedAt: '2026-05-09',
    migrationFn: 'migrateV25',
    notes: 'WS-177 / SPR-068. Skip-on-fresh-install (oldVersion > 0 guard). Q2 ratified forward-only.',
  },
  {
    version: 26,
    name: 'SLS Stream D — shapeMastery + shapeLessons stores',
    description: 'Schema-only migration adding shapeMastery (singleton per user, keyPath: userId) and shapeLessons (append-only completion history, keyPath: id, 3 indexes). Per docs/design/contracts/shape-mastery.md canonical shape + Q1-Q7 verdicts. Lesson catalog stays in code (lessonRegistry.js pattern) — this store is per-user history only.',
    storesAdded: ['shapeMastery', 'shapeLessons'],
    storesChanged: [],
    storesRemoved: [],
    indexesAdded: [
      'shapeLessons.by_userId',
      'shapeLessons.by_descriptorId',
      'shapeLessons.by_completedAt',
    ],
    owner: { program: 'design', project: 'SLS' },
    shippedAt: '2026-05-14',
    migrationFn: 'migrateV26',
    notes: 'WS-040 / SPR-081 read-only scope (B). Recovery writers (MUTE/RECALIBRATE/UNMUTE/RESET) deferred to fast-follow WS.',
  },
];

/**
 * Returns the owner of the migration that first added a store, or null if not found.
 *
 * @param {string} storeName
 * @returns {{program: string, project: string, projectRef?: string} | null}
 *
 * @example
 *   getStoreOwner('exploitAnchors')
 *   // → { program: 'domain-correctness', project: 'EAL', projectRef: '...' }
 */
export function getStoreOwner(storeName) {
  for (const entry of MIGRATION_REGISTRY) {
    if (entry.storesAdded.includes(storeName)) {
      return entry.owner;
    }
  }
  return null;
}

/**
 * Returns all registry entries that mention a store in either storesAdded or storesChanged.
 * Useful for forensic queries ("which migrations have touched `hands`?").
 *
 * @param {string} storeName
 * @returns {MigrationRegistryEntry[]}
 */
export function getVersionsForStore(storeName) {
  return MIGRATION_REGISTRY.filter(
    (entry) =>
      entry.storesAdded.includes(storeName) ||
      entry.storesChanged.includes(storeName),
  );
}

/**
 * Computes the cumulative set of stores that should exist after applying
 * every migration up to and including `version`. Pure derivation from the
 * registry — used by tests to verify monotonic growth.
 *
 * @param {number} version
 * @returns {Set<string>}
 */
export function getStoresAtVersion(version) {
  const stores = new Set();
  for (const entry of MIGRATION_REGISTRY) {
    if (entry.version > version) break;
    for (const name of entry.storesAdded) stores.add(name);
  }
  return stores;
}
