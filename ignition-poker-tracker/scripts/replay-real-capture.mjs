/**
 * replay-real-capture.mjs — feed a real captured .jsonl through the REAL pipeline.
 *
 * Reproduces the production producer→SW-gate path:
 *   raw frame → TableManager.routeMessage → HSM.getLiveHandContext()
 *             → validateMessage('live_context', {context})   [the SW drop gate]
 *
 * Usage: node scripts/replay-real-capture.mjs <path-to.jsonl>
 */
import { readFileSync } from 'fs';
import { TableManager } from '../shared/table-manager.js';
import { validateMessage } from '../shared/message-schemas.js';

const file = process.argv[2];
if (!file) { console.error('pass the .jsonl path'); process.exit(1); }

const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean);
const records = lines.map((l) => JSON.parse(l));
const msgs = records.filter((r) => r.kind === 'msg');

const tm = new TableManager();

let frameNo = 0;
let parseThrows = 0;
let validateFails = 0;
let validatePass = 0;
let nullCtx = 0;
const failReasons = {};
const failSamples = [];
let lastStreet = null;
const streetSeen = {};
let lastValidByStreet = {};

const pid = (data) => {
  const m = /\{[^|]*"pid":"([^"]+)"/.exec(data);
  return m ? m[1] : null;
};

// Model the producer's change-gate both ways to quantify cross-hand drops.
// OLD: single global key, no handNumber. NEW: per-conn key incl. handNumber.
const oldKey = (c) => `${c.state}|${c.currentStreet}|${(c.activeSeatNumbers||[]).length}|${(c.foldedSeats||[]).length}|${(c.actionSequence||[]).length}|${c.pot||0}`;
const newKey = (c) => `${c.handNumber}|${oldKey(c)}`;
let prevOld = null;
const prevNewByConn = new Map();
let oldSends = 0, newSends = 0;
let oldHandStartDrops = 0; // first frame of a new hand the OLD gate would skip
const handsSeen = new Set();

for (const r of msgs) {
  frameNo++;
  let threw = null;
  try {
    tm.routeMessage(r.connId, r.data, r.url);
  } catch (e) { threw = e; parseThrows++; }

  const hsm = tm.getHSM(r.connId);
  if (!hsm) continue;
  let ctx;
  try { ctx = hsm.getLiveHandContext(); } catch (e) { ctx = null; }
  if (!ctx) { nullCtx++; continue; }

  if (ctx.currentStreet && ctx.currentStreet !== lastStreet) {
    lastStreet = ctx.currentStreet;
    streetSeen[ctx.currentStreet] = (streetSeen[ctx.currentStreet] || 0) + 1;
  }

  // --- producer change-gate modeling (old vs new) ---
  const ok = oldKey(ctx);
  const nk = newKey(ctx);
  const conn = String(r.connId);
  const isNewHand = ctx.handNumber != null && !handsSeen.has(`${conn}:${ctx.handNumber}`);
  if (ctx.handNumber != null) handsSeen.add(`${conn}:${ctx.handNumber}`);
  if (ok !== prevOld) { oldSends++; } else if (isNewHand) { oldHandStartDrops++; }
  prevOld = ok;
  const pn = prevNewByConn.get(conn);
  if (nk !== pn) newSends++;
  prevNewByConn.set(conn, nk);

  const err = validateMessage('live_context', { type: 'live_context', context: ctx });
  if (err) {
    validateFails++;
    const key = err.replace(/\d+/g, 'N');
    failReasons[key] = (failReasons[key] || 0) + 1;
    if (failSamples.length < 12) {
      failSamples.push({
        frame: frameNo, pid: pid(r.data), err,
        street: ctx.currentStreet, state: ctx.state,
        heroSeat: ctx.heroSeat,
        active: ctx.activeSeatNumbers, folded: ctx.foldedSeats,
      });
    }
  } else {
    validatePass++;
    lastValidByStreet[ctx.currentStreet] = (lastValidByStreet[ctx.currentStreet] || 0) + 1;
  }
}

const diag = tm.getDiagnosticData?.() || {};
console.log('===== REAL-CAPTURE REPLAY =====');
console.log('msg frames:            ', msgs.length);
console.log('parse throws:          ', parseThrows);
console.log('tables created:        ', tm.getTableCount());
console.log('completed hands (HSM): ', tm.getCompletedHandCount?.());
console.log('total parsed messages: ', tm.totalParsedMessages);
console.log('pidCounts:             ', JSON.stringify(tm.pidCounts || {}, null, 0));
console.log('');
console.log('--- live_context SW gate (the HUD-drop test) ---');
console.log('PASS validations:      ', validatePass);
console.log('FAIL validations:      ', validateFails, '  <-- each is a silently-dropped HUD update');
console.log('null context frames:   ', nullCtx);
console.log('streets reached:       ', JSON.stringify(streetSeen));
console.log('valid pushes by street:', JSON.stringify(lastValidByStreet));
console.log('');
console.log('--- failure reasons (digits → N) ---');
for (const [k, v] of Object.entries(failReasons)) console.log(`  ${v}x  ${k}`);
console.log('');
console.log('--- first failure samples ---');
for (const s of failSamples) console.log(' ', JSON.stringify(s));
console.log('');
console.log('--- producer change-gate (cross-hand drop test) ---');
console.log('distinct hands:        ', handsSeen.size);
console.log('OLD gate sends:        ', oldSends, '(single global key, no handNumber)');
console.log('OLD hand-start drops:  ', oldHandStartDrops, '  <-- new-hand updates a collision would skip');
console.log('NEW gate sends:        ', newSends, '(per-conn key incl. handNumber)');
