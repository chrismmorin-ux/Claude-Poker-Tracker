/**
 * Test fixtures derived from spike-data/SPIKE_REPORT.md
 */

// Raw WebSocket messages (byteLength|JSON format)
export const RAW_MESSAGES = {
  gameMessage: '123|{"seq":1,"tDiff":50,"data":{"pid":"CO_DEALER_SEAT","seat":5}}',
  lobbyMessage: '50|{"tournament":"MTT","status":"running","players":100}',
  malformedJson: '50|{not valid json}',
  noPipe: '{"seq":1,"data":{"pid":"CO_DEALER_SEAT","seat":5}}',
  noData: '20|{"seq":1,"tDiff":0}',
  noPid: '30|{"seq":1,"data":{"seat":5}}',
};

// Card encoding (Ignition: 0-51 integer, Ace-low)
export const CARDS = {
  aceClubs: 0,     // A♣ (rank 0=A, suit 0=c)
  twoClubs: 1,     // 2♣
  kingClubs: 12,   // K♣
  aceDiamonds: 13, // A♦
  nineDiamonds: 21, // 9♦
  eightDiamonds: 20, // 8♦
  kingHearts: 38,  // K♥
  aceSpades: 39,   // A♠
  kingSpades: 51,  // K♠
  faceDown: 32896, // 0x8080
};

// Expected decoded values
export const DECODED_CARDS = {
  0: 'Ac', 1: '2c', 12: 'Kc',
  13: 'Ad', 20: '8d', 21: '9d',
  26: 'Ah', 38: 'Kh', 39: 'As', 51: 'Ks',
};

// CO_CARDTABLE_INFO payload (hero at seat 5)
export const HOLE_CARDS_PAYLOAD = {
  seat1: [32896, 32896],  // face-down
  seat2: [32896, 32896],
  seat3: [32896, 32896],
  seat5: [20, 38],        // 8d, Kh — hero's real cards
  seat7: [32896, 32896],
  seat9: [32896, 32896],
};

// CO_BCARD3_INFO (flop)
export const FLOP_PAYLOAD = { bcard: [39, 21, 13] }; // As, 9d, Ad

// CO_BCARD1_INFO (turn)
export const TURN_PAYLOAD = { pos: 4, card: 1 }; // 2c

// CO_BCARD1_INFO (river)
export const RIVER_PAYLOAD = { pos: 5, card: 51 }; // Ks

// CO_SELECT_INFO payloads
export const ACTION_PAYLOADS = {
  check:  { seat: 3, btn: 64,   bet: 0,   account: 10000 },
  bet:    { seat: 5, btn: 128,  bet: 100, account: 9900 },
  call:   { seat: 7, btn: 256,  bet: 100, account: 9900 },
  raise:  { seat: 9, btn: 512,  bet: 300, account: 9700 },
  fold:   { seat: 1, btn: 1024, bet: 0,   account: 10000 },
};

// CO_BLIND_INFO payloads
export const BLIND_PAYLOADS = {
  sb: { seat: 8, account: 9950, btn: 2, bet: 50,  dead: 0 },
  bb: { seat: 9, account: 9900, btn: 4, bet: 100, dead: 0 },
  posted: { seat: 3, account: 9900, btn: 8, bet: 100, dead: 0 },
};

// CO_RESULT_INFO
export const RESULT_PAYLOAD = {
  account: [4580, 3070, 9000, 10760, 10000, 8750, 16270, 17200, 9930],
  handHi7: [1, 4, 0, 5, 6],
};

// CO_PCARD_INFO (showdown reveal)
export const REVEAL_PAYLOAD = { type: 0, seat: 9, card: [51, 48] }; // Ks, Js

// CO_SHOW_INFO
export const SHOW_PAYLOAD = { seat: 9, btn: 8192 };  // show
export const MUCK_PAYLOAD = { seat: 8, btn: 32768 };  // muck

// CO_CHIPTABLE_INFO
export const CHIP_TABLE_PAYLOAD = { curPot: [5000, 2000] }; // 50.00 + 20.00 = 70.00

// CO_TABLE_STATE values
export const TABLE_STATES = {
  reset: 0,
  setup: 2,
  blinds: 4,
  preflop: 8,
  flop: 16,
  turn: 32,
  river: 64,
  showdownCash: 32768,
  resultsCash: 65536,
  showdownTourney: 4096,
  resultsTourney: 8192,
};

// Full hand sequence (simplified cash game)
export const FULL_HAND_SEQUENCE = [
  { pid: 'PLAY_STAGE_INFO', payload: { stageNo: '12345' } },
  { pid: 'CO_DEALER_SEAT', payload: { seat: 5 } },
  { pid: 'CO_TABLE_STATE', payload: { state: 4 } },  // blinds
  { pid: 'CO_BLIND_INFO', payload: { seat: 8, account: 9950, btn: 2, bet: 50, dead: 0 } },
  { pid: 'CO_BLIND_INFO', payload: { seat: 9, account: 9900, btn: 4, bet: 100, dead: 0 } },
  { pid: 'CO_TABLE_STATE', payload: { state: 8 } },  // preflop
  { pid: 'CO_CARDTABLE_INFO', payload: {
    seat1: [32896, 32896], seat3: [32896, 32896],
    seat5: [20, 38], seat7: [32896, 32896],
    seat8: [32896, 32896], seat9: [32896, 32896],
  }},
  { pid: 'CO_SELECT_INFO', payload: { seat: 1, btn: 1024, bet: 0, account: 10000 } }, // fold
  { pid: 'CO_SELECT_INFO', payload: { seat: 3, btn: 256, bet: 100, account: 9900 } }, // call
  { pid: 'CO_SELECT_INFO', payload: { seat: 5, btn: 512, bet: 300, account: 9700 } }, // raise
  { pid: 'CO_SELECT_INFO', payload: { seat: 7, btn: 1024, bet: 0, account: 10000 } }, // fold
  { pid: 'CO_SELECT_INFO', payload: { seat: 8, btn: 1024, bet: 0, account: 9950 } }, // fold
  { pid: 'CO_SELECT_INFO', payload: { seat: 9, btn: 256, bet: 300, account: 9600 } }, // call
  { pid: 'CO_SELECT_INFO', payload: { seat: 3, btn: 256, bet: 300, account: 9600 } }, // call
  { pid: 'CO_CHIPTABLE_INFO', payload: { curPot: [95000] } },
  { pid: 'CO_TABLE_STATE', payload: { state: 16 } }, // flop
  { pid: 'CO_BCARD3_INFO', payload: { bcard: [39, 21, 13] } },
  { pid: 'CO_SELECT_INFO', payload: { seat: 3, btn: 64, bet: 0, account: 9600 } }, // check
  { pid: 'CO_SELECT_INFO', payload: { seat: 5, btn: 128, bet: 500, account: 9200 } }, // bet
  { pid: 'CO_SELECT_INFO', payload: { seat: 9, btn: 1024, bet: 0, account: 9600 } }, // fold
  { pid: 'CO_SELECT_INFO', payload: { seat: 3, btn: 256, bet: 500, account: 9100 } }, // call
  { pid: 'CO_CHIPTABLE_INFO', payload: { curPot: [105000] } },
  { pid: 'CO_TABLE_STATE', payload: { state: 32 } }, // turn
  { pid: 'CO_BCARD1_INFO', payload: { pos: 4, card: 1 } },
  { pid: 'CO_SELECT_INFO', payload: { seat: 3, btn: 64, bet: 0, account: 9100 } }, // check
  { pid: 'CO_SELECT_INFO', payload: { seat: 5, btn: 64, bet: 0, account: 9200 } }, // check
  { pid: 'CO_TABLE_STATE', payload: { state: 64 } }, // river
  { pid: 'CO_BCARD1_INFO', payload: { pos: 5, card: 51 } },
  { pid: 'CO_SELECT_INFO', payload: { seat: 3, btn: 64, bet: 0, account: 9100 } }, // check
  { pid: 'CO_SELECT_INFO', payload: { seat: 5, btn: 128, bet: 800, account: 8400 } }, // bet
  { pid: 'CO_SELECT_INFO', payload: { seat: 3, btn: 1024, bet: 0, account: 9100 } }, // fold
  { pid: 'CO_POT_INFO', payload: { returnHi: [0, 0, 0, 0, 10500, 0, 0, 0, 0] } },
  { pid: 'CO_TABLE_STATE', payload: { state: 65536 } }, // results
  { pid: 'PLAY_STAGE_END_REQ', payload: {} },
];
