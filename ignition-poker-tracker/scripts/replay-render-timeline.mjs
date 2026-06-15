/**
 * replay-render-timeline.mjs — reproduce the side panel's REAL-TIME view-state
 * from a real capture, to diagnose thrashing/lag (the dynamic behavior the test
 * suite never exercised).
 *
 * Pipeline modeled, in virtual time using each frame's millisecond timestamp:
 *   frame → TableManager → getLiveHandContext              (real)
 *         → per-conn change-gate (handNumber fingerprint)  (real producer logic)
 *         → 200ms content throttle  → 200ms SW throttle     (leading + trailing)
 *         → handleLiveContextPush sequence (real FSM + classifier)
 *         → slot owner / mode it would render
 *
 * Reports: frames the throttle stack DROPS (lag / "won't keep up"), and the
 * slot-owner flip timeline with rapid (<1s) flips ("swaps / disappearing").
 *
 * Usage: node scripts/replay-render-timeline.mjs <capture.jsonl> [--timeline]
 */
import { readFileSync } from 'fs';
import { TableManager } from '../shared/table-manager.js';
import { betweenHandsFsm } from '../side-panel/fsms/between-hands.fsm.js';
import { classifyBetweenHandsMode } from '../side-panel/render-orchestrator.js';

const file = process.argv[2];
const showTimeline = process.argv.includes('--timeline');
if (!file) { console.error('pass the .jsonl path'); process.exit(1); }

const WINDOW = 200;       // ms throttle window (content and SW each)
const RAPID = 1000;       // ms: slot flips closer than this read as visible thrash
const MODE_A_MS = 10_000; // reflection→observing timer

const records = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const msgs = records.filter((r) => r.kind === 'msg').sort((a, b) => a.t - b.t);

const fp = (c) => `${c.handNumber}|${c.state}|${c.currentStreet}|${(c.activeSeatNumbers||[]).length}|${(c.foldedSeats||[]).length}|${(c.actionSequence||[]).length}|${c.pot||0}`;
const isLive = (c) => c.state && c.state !== 'IDLE' && c.state !== 'COMPLETE';

// 1) frames → distinct state-change contexts (per-conn, handNumber-keyed gate)
const tm = new TableManager();
const distinct = [];
const prevKeyByConn = new Map();
for (const r of msgs) {
  try { tm.routeMessage(r.connId, r.data, r.url); } catch { /* parse already proven clean */ }
  const conn = String(r.connId);
  const hsm = tm.getHSM(conn);
  if (!hsm) continue;
  const ctx = hsm.getLiveHandContext();
  if (!ctx) continue;
  const k = fp(ctx);
  if (k === prevKeyByConn.get(conn)) continue; // change-gate
  prevKeyByConn.set(conn, k);
  distinct.push({ t: r.t, ctx });
}

// 2) leading + trailing throttle (one window). Returns delivered events; counts drops.
function throttle(events) {
  const out = [];
  let windowEnd = -Infinity, pending = null, dropped = 0;
  for (const e of events) {
    if (pending && e.t >= windowEnd) { out.push({ t: windowEnd, ctx: pending.ctx }); pending = null; }
    if (e.t >= windowEnd) { out.push(e); windowEnd = e.t + WINDOW; }
    else { if (pending) dropped++; pending = e; } // overwriting a pending = a state never shown
  }
  if (pending) out.push({ t: windowEnd, ctx: pending.ctx });
  return { out, dropped };
}

const c1 = throttle(distinct);           // content → SW
const c2 = throttle(c1.out);             // SW → panel
const delivered = c2.out;

// 3) replay the panel handler sequence over delivered contexts → slot-owner timeline
let fsm = betweenHandsFsm.initial;
let prevHand = null, prevFolded = false, modeAStart = null;
const timeline = [];
for (const { t, ctx } of delivered) {
  const heroSeat = ctx.heroSeat;
  const heroFolded = heroSeat != null && (ctx.foldedSeats || []).includes(heroSeat);
  const newHand = ctx.handNumber !== prevHand;
  if (newHand) { fsm = betweenHandsFsm.transition(fsm, 'handNew').state; modeAStart = null; }
  if (!prevFolded && heroFolded && isLive(ctx)) modeAStart = t; // start reflection timer
  const betweenHandsOrIdle = ctx.state === 'IDLE' || ctx.state === 'COMPLETE';
  fsm = betweenHandsFsm.transition(fsm, 'liveContextArrived', { betweenHandsOrIdle }).state;
  const modeAExpired = (fsm === 'modeAExpired') || (modeAStart != null && (t - modeAStart) >= MODE_A_MS);
  const mode = classifyBetweenHandsMode(ctx, heroSeat, null, modeAExpired);
  const fsmClaimsSlot = fsm === 'active' || fsm === 'modeAExpired';
  const claimSlot = fsmClaimsSlot || mode !== null;
  const slot = claimSlot ? `between-hands:${mode || fsm}` : (isLive(ctx) ? 'street-card' : 'none');
  timeline.push({ t, slot, state: ctx.state, hand: ctx.handNumber });
  prevHand = ctx.handNumber; prevFolded = heroFolded;
}

// 4) flip metrics
let flips = 0, rapidFlips = 0; const transitions = [];
for (let i = 1; i < timeline.length; i++) {
  if (timeline[i].slot !== timeline[i - 1].slot) {
    flips++;
    const dt = timeline[i].t - timeline[i - 1].t;
    if (dt < RAPID) rapidFlips++;
    transitions.push({ dt, from: timeline[i - 1].slot, to: timeline[i].slot, state: timeline[i].state });
  }
}

const span = (msgs[msgs.length - 1].t - msgs[0].t) / 1000;
console.log('===== RENDER-TIMELINE REPLAY =====');
console.log('distinct state changes:   ', distinct.length, `over ${span.toFixed(0)}s`);
console.log('delivered to panel:       ', delivered.length);
console.log('DROPPED by throttle stack:', c1.dropped + c2.dropped, ` (content ${c1.dropped} + SW ${c2.dropped}) — states the HUD never showed`);
console.log('');
console.log('--- slot-owner thrash ---');
console.log('total slot flips:         ', flips);
console.log('RAPID flips (<1s apart):  ', rapidFlips, '  <-- visible flicker / disappearing panels');
console.log('');
console.log('--- rapid transitions (dt ms : from -> to) ---');
for (const tr of transitions.filter(t => t.dt < RAPID).slice(0, 30)) {
  console.log(`  ${String(tr.dt).padStart(4)}ms  ${tr.from}  ->  ${tr.to}`);
}
if (showTimeline) {
  console.log('\n--- full slot timeline ---');
  let last = null;
  for (const e of timeline) { if (e.slot !== last) { console.log(`  +${((e.t-msgs[0].t)/1000).toFixed(1)}s  h${e.hand}  ${e.state.padEnd(9)}  ${e.slot}`); last = e.slot; } }
}
