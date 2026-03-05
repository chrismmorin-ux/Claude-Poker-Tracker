/**
 * seedTestData.js - Generate test players, sessions, and hands for exploit suggestion testing
 *
 * Creates 6 player archetypes at varying sample sizes to observe
 * when and how exploit suggestions appear with statistical confidence.
 *
 * Usage: import { seedTestData, clearTestData } from './seedTestData';
 *        await seedTestData();   // Populate DB
 *        await clearTestData();  // Remove seed data
 *
 * Also available via browser console:
 *        window.__seedTestData()
 *        window.__clearTestData()
 */

import { createPlayer, updatePlayer, getAllPlayers } from './persistence';
import { initDB, GUEST_USER_ID } from './persistence/database';

// =============================================================================
// PLAYER ARCHETYPES
// =============================================================================

const ARCHETYPES = [
  {
    name: 'Fishy Frank',
    nickname: 'The ATM',
    ethnicity: 'White/Caucasian',
    gender: 'Male',
    build: 'Heavy',
    styleTags: ['Fish', 'Calling Station'],
    notes: 'Seed player: extreme fish. VPIP ~65%, PFR ~8%, AF ~0.5, limps 50%+.',
    // Behavior: calls almost everything preflop, rarely raises, passive postflop
    behavior: {
      vpipRate: 0.65,    // calls/raises 65% of hands
      pfrRate: 0.08,     // only raises 8%
      postflopAggRate: 0.25, // mostly calls postflop (aggFreq 25% -> AF ~0.33)
      threeBetRate: 0.02,
      cbetRate: 0.30,
      limpRate: 0.55,    // limps more than half the time when no raise
    },
  },
  {
    name: 'Nitty Nancy',
    nickname: 'The Rock',
    ethnicity: 'Asian',
    gender: 'Female',
    build: 'Slim',
    styleTags: ['Nit', 'Tight'],
    notes: 'Seed player: extreme nit. VPIP ~10%, PFR ~8%, rarely 3-bets.',
    behavior: {
      vpipRate: 0.10,
      pfrRate: 0.08,
      postflopAggRate: 0.55,
      threeBetRate: 0.02,
      cbetRate: 0.80,
      limpRate: 0.05,
    },
  },
  {
    name: 'LAG Larry',
    nickname: 'Maniac',
    ethnicity: 'Hispanic/Latino',
    gender: 'Male',
    build: 'Muscular',
    styleTags: ['LAG (Loose-Aggressive)', 'Aggressive'],
    notes: 'Seed player: LAG. VPIP ~45%, PFR ~30%, high AF, 3-bets often.',
    behavior: {
      vpipRate: 0.45,
      pfrRate: 0.30,
      postflopAggRate: 0.72, // very aggressive postflop (AF ~2.6)
      threeBetRate: 0.15,
      cbetRate: 0.85,
      limpRate: 0.05,
    },
  },
  {
    name: 'TAG Tom',
    nickname: 'Solid',
    ethnicity: 'Black/African American',
    gender: 'Male',
    build: 'Average',
    styleTags: ['TAG (Tight-Aggressive)'],
    notes: 'Seed player: TAG baseline. VPIP ~22%, PFR ~18%, balanced AF. Should trigger few/no suggestions.',
    behavior: {
      vpipRate: 0.22,
      pfrRate: 0.18,
      postflopAggRate: 0.55,
      threeBetRate: 0.07,
      cbetRate: 0.65,
      limpRate: 0.05,
    },
  },
  {
    name: 'Calling Carl',
    nickname: 'Station',
    ethnicity: 'Middle Eastern',
    gender: 'Male',
    build: 'Heavy',
    styleTags: ['Calling Station', 'Passive'],
    notes: 'Seed player: calling station. Wide VPIP, huge VPIP-PFR gap, passive postflop.',
    behavior: {
      vpipRate: 0.50,
      pfrRate: 0.05,
      postflopAggRate: 0.20, // extremely passive (AF ~0.25)
      threeBetRate: 0.01,
      cbetRate: 0.20,
      limpRate: 0.60,
    },
  },
  {
    name: 'Tricky Tina',
    nickname: 'Chameleon',
    ethnicity: 'White/Caucasian',
    gender: 'Female',
    build: 'Slim',
    styleTags: ['Tricky', 'LAG (Loose-Aggressive)'],
    notes: 'Seed player: calls wide preflop but gets aggressive postflop. VPIP-PFR gap + high AF.',
    behavior: {
      vpipRate: 0.42,
      pfrRate: 0.12,
      postflopAggRate: 0.70, // aggressive postflop despite passive preflop
      threeBetRate: 0.04,
      cbetRate: 0.40,
      limpRate: 0.35,
    },
  },
];

// =============================================================================
// HAND GENERATION
// =============================================================================

// Seats assigned to each archetype
const SEAT_MAP = {
  'Fishy Frank': '2',
  'Nitty Nancy': '3',
  'LAG Larry': '4',
  'TAG Tom': '6',
  'Calling Carl': '7',
  'Tricky Tina': '8',
};

const MY_SEAT = 5; // Hero seat

/**
 * Generate a single hand record for a set of players.
 * Each player's actions are determined by their behavior profile + randomness.
 */
const generateHand = (playerMap, seatPlayers, handIndex, sessionId, totalHands) => {
  const seatActions = { preflop: {}, flop: {}, turn: {}, river: {} };
  const actionSequence = [];
  let order = 0;

  for (const [seat, playerId] of Object.entries(seatPlayers)) {
    if (Number(seat) === MY_SEAT) continue;
    const archetype = playerMap[playerId];
    if (!archetype) continue;
    const b = archetype.behavior;

    // Use deterministic counts so rates are accurate regardless of total hands
    const pfrCount = Math.round(b.pfrRate * totalHands);
    const vpipCount = Math.round(b.vpipRate * totalHands);
    const aggThreshold = Math.floor(b.postflopAggRate * 100);

    if (handIndex < pfrCount) {
      seatActions.preflop[seat] = ['raise'];
      actionSequence.push({ seat: Number(seat), action: 'raise', street: 'preflop', order: ++order });
    } else if (handIndex < vpipCount) {
      seatActions.preflop[seat] = ['call'];
      actionSequence.push({ seat: Number(seat), action: 'call', street: 'preflop', order: ++order });
    } else {
      seatActions.preflop[seat] = ['fold'];
      actionSequence.push({ seat: Number(seat), action: 'fold', street: 'preflop', order: ++order });
      continue;
    }

    // Postflop for hands that didn't fold
    for (const street of ['flop', 'turn', 'river']) {
      if (handIndex % 3 === 2 && street === 'river') break;
      const aggIdx = (handIndex * 7 + order) % 100;
      const isAggressive = aggIdx < aggThreshold;
      const action = isAggressive ? (aggIdx % 2 === 0 ? 'bet' : 'raise') : 'call';
      if (!seatActions[street][seat]) seatActions[street][seat] = [];
      seatActions[street][seat].push(action);
      actionSequence.push({ seat: Number(seat), action, street, order: ++order });
    }
  }

  // Hero always plays
  seatActions.preflop[String(MY_SEAT)] = ['call'];
  actionSequence.push({ seat: MY_SEAT, action: 'call', street: 'preflop', order: ++order });

  const timestamp = Date.now() - (totalHands - handIndex) * 60000;

  return {
    gameState: {
      currentStreet: 'showdown',
      dealerButtonSeat: ((handIndex % 9) + 1),
      mySeat: MY_SEAT,
      seatActions,
      actionSequence,
      absentSeats: [],
    },
    cardState: {
      communityCards: ['', '', '', '', ''],
      holeCards: ['', ''],
      holeCardsVisible: true,
      allPlayerCards: {},
    },
    seatPlayers,
    timestamp,
    version: '1.3.0',
    userId: GUEST_USER_ID,
    sessionId,
    sessionHandNumber: handIndex + 1,
    handDisplayId: `S${sessionId}-H${handIndex + 1}`,
  };
};

// =============================================================================
// SEED / CLEAR
// =============================================================================

const SEED_SESSION_ID = 99999;
const TOTAL_HANDS = 60; // Enough to see strong confidence on extreme players

/**
 * Seed test data: 6 players, 1 session, 60 hands.
 * Uses deterministic generation so stats precisely match behavior profiles.
 */
export const seedTestData = async () => {
  console.log('[seedTestData] Starting...');

  // 1. Create players
  const playerIds = {};
  for (const archetype of ARCHETYPES) {
    const { behavior, ...playerData } = archetype;
    const playerId = await createPlayer({
      ...playerData,
      handCount: TOTAL_HANDS,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    playerIds[archetype.name] = playerId;
    console.log(`[seedTestData] Created ${archetype.name} (ID: ${playerId})`);
  }

  // 2. Build seatPlayers map and reverse lookup
  const seatPlayers = { [String(MY_SEAT)]: 'hero' };
  const playerMap = {}; // playerId -> archetype
  for (const archetype of ARCHETYPES) {
    const seat = SEAT_MAP[archetype.name];
    const playerId = playerIds[archetype.name];
    seatPlayers[seat] = playerId;
    playerMap[playerId] = archetype;
  }

  // 3. Generate hands deterministically
  const db = await initDB();
  const hands = [];

  for (let i = 0; i < TOTAL_HANDS; i++) {
    hands.push(generateHand(playerMap, seatPlayers, i, SEED_SESSION_ID, TOTAL_HANDS));
  }

  // Batch save to IndexedDB
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['hands'], 'readwrite');
    const store = tx.objectStore('hands');
    for (const hand of hands) {
      store.add(hand);
    }
    tx.oncomplete = () => {
      console.log(`[seedTestData] Saved ${hands.length} hands`);
      resolve();
    };
    tx.onerror = (e) => reject(e.target.error);
  });

  db.close();

  console.log('[seedTestData] Done! Players created:');
  for (const [name, id] of Object.entries(playerIds)) {
    const seat = SEAT_MAP[name];
    const arch = ARCHETYPES.find(a => a.name === name);
    console.log(`  Seat ${seat}: ${name} (ID ${id}) — VPIP ~${Math.round(arch.behavior.vpipRate * 100)}%, PFR ~${Math.round(arch.behavior.pfrRate * 100)}%`);
  }
  console.log(`\nTotal hands: ${TOTAL_HANDS}, Session ID: ${SEED_SESSION_ID}`);
  console.log('Navigate to Players View and expand exploit notes to see suggestions.');

  return { playerIds, seatPlayers, handCount: TOTAL_HANDS };
};

/**
 * Remove all seed data: delete seed players and session hands.
 */
export const clearTestData = async () => {
  console.log('[clearTestData] Removing seed data...');

  // Find and delete seed players by name
  const allPlayers = await getAllPlayers();
  const seedNames = new Set(ARCHETYPES.map(a => a.name));

  for (const player of allPlayers) {
    if (seedNames.has(player.name)) {
      const { deletePlayer } = await import('./persistence');
      await deletePlayer(player.playerId);
      console.log(`[clearTestData] Deleted player: ${player.name} (ID ${player.playerId})`);
    }
  }

  // Delete hands with session ID 99999
  const db = await initDB();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(['hands'], 'readwrite');
    const store = tx.objectStore('hands');
    const index = store.index('sessionId');
    const req = index.getAllKeys(SEED_SESSION_ID);
    req.onsuccess = () => {
      const keys = req.result;
      for (const key of keys) {
        store.delete(key);
      }
      console.log(`[clearTestData] Deleted ${keys.length} hands from session ${SEED_SESSION_ID}`);
      resolve();
    };
    req.onerror = (e) => reject(e.target.error);
    tx.oncomplete = () => db.close();
  });

  console.log('[clearTestData] Done!');
};

// Expose on window for console access
if (typeof window !== 'undefined') {
  window.__seedTestData = seedTestData;
  window.__clearTestData = clearTestData;
}
