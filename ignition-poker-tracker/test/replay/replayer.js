/**
 * replayer.js — loads side-panel.js under a jsdom environment with stubbed
 * chrome runtime + fake clock, feeds a corpus event stream, and captures
 * DOM mutations + per-tick snapshots.
 *
 * Intended to run inside a vitest test with `@vitest-environment jsdom`.
 *
 * Export: async runReplay({ events, seedHands? }) → { mutations, snapshots }
 *
 * Mutation log schema (JSON-safe, deterministic):
 *   { t, type, target, attributeName?, oldValue?, addedCount?, removedCount?, textLen? }
 *
 * Snapshot schema (captured at every 'snapshot' event and after each 'inject' once
 * clock has drained):
 *   { t, seatArcHTML, planPanelVisible, betweenHandsVisible, adviceStreet, contextStreet, handNumber }
 *
 * Multi-replay isolation: each test file gets a fresh vitest worker (module scope),
 * so one corpus = one test file. Do NOT import multiple runReplay() calls in the
 * same test file — the side-panel.js IIFE runs once per module import. This is
 * documented as the single-replay-per-file constraint.
 *
 * seedHands: optional array of hand records to pre-load into
 *   chrome.storage.session['side_panel_hands'] BEFORE the IIFE loads.
 *   Hands must have { tableId: 'table_<connId>', gameState: { actionSequence: [...] } }.
 *   The replayer pairs this with a 'push_hands_updated' event injected automatically
 *   at t=0 (before any corpus events) so refreshHandStats fires on init.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { installChromeStub } from './chrome-stub.js';
import { installFakeClock } from './clock.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HTML_PATH = resolve(__dirname, '..', '..', 'side-panel', 'side-panel.html');

let _sidePanelLoaded = false;

/**
 * Reset the jsdom DOM to side-panel.html's body, install stubs, import side-panel.js.
 *
 * @param {Object[]} [seedHands] - Optional hand records pre-seeded into session storage.
 */
export async function setupHarness({ seedHands } = {}) {
  const htmlText = readFileSync(HTML_PATH, 'utf8');
  const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHTML = bodyMatch ? bodyMatch[1] : htmlText;
  document.body.innerHTML = bodyHTML;

  const chromeHandle = installChromeStub(globalThis);
  const clock = installFakeClock(globalThis);

  // Seed hand records BEFORE the IIFE loads so the first refreshHandStats call
  // (triggered by push_pipeline_status) finds them immediately.
  if (seedHands && seedHands.length > 0) {
    chromeHandle.sessionStore['side_panel_hands'] = seedHands;
  }

  if (!_sidePanelLoaded) {
    _sidePanelLoaded = true;
    await import('../../side-panel/side-panel.js');
  }

  // Drain the microtask queue — the IIFE calls chrome.runtime.connect() synchronously,
  // but some init-time async operations (queueMicrotask defers, storage reads) need
  // multiple ticks to settle.
  for (let _i = 0; _i < 10; _i++) await Promise.resolve();
  // Fire any 0-delay timers scheduled during init.
  clock.advance(0);

  const panelPort = chromeHandle.ports['side-panel'];
  if (!panelPort) {
    throw new Error('Harness init failed: side-panel port never opened. Check chrome stub.');
  }

  return { chromeHandle, clock, panelPort };
}

function collectSnapshot(t, lastMessages) {
  const seatArc = document.querySelector('#seat-arc, [data-testid="seat-arc"], .seat-arc-container');
  const planPanel = document.getElementById('plan-panel');
  const betweenHands = document.getElementById('between-hands');
  // Regions added for S6–S13 coverage. Optional selectors — if element is absent,
  // fields serialize as '' or false so snapshots remain JSON-safe + hashable.
  const statusText = document.getElementById('status-text');
  const actionBar = document.getElementById('action-bar');
  const noTable = document.getElementById('no-table');
  const recoveryBanner = document.getElementById('recovery-banner');
  const tournamentBar = document.getElementById('tournament-bar');
  const streetProgress = document.getElementById('street-progress');
  const hudContent = document.getElementById('hud-content');
  const ctx = lastMessages.context;
  const heroSeat = ctx?.heroSeat ?? null;
  const foldedSeats = Array.isArray(ctx?.foldedSeats) ? ctx.foldedSeats : [];
  return {
    t,
    seatArcHTML: seatArc ? seatArc.innerHTML : '',
    planPanelVisible: planPanel ? !planPanel.classList.contains('hidden') : false,
    betweenHandsVisible: betweenHands ? !betweenHands.classList.contains('hidden') : false,
    adviceStreet: lastMessages.advice?.currentStreet ?? null,
    contextStreet: lastMessages.context?.currentStreet ?? null,
    handNumber: lastMessages.context?.handNumber ?? null,
    // Added for SR-3 corpus extension (S6–S13):
    statusTextHTML: statusText ? statusText.innerHTML : '',
    actionBarHTML: actionBar ? actionBar.innerHTML : '',
    actionBarStale: actionBar ? actionBar.classList.contains('stale') : false,
    noTableVisible: noTable ? !noTable.classList.contains('hidden') : false,
    recoveryBannerVisible: recoveryBanner ? !recoveryBanner.classList.contains('hidden') : false,
    tournamentBarVisible: tournamentBar ? !tournamentBar.classList.contains('hidden') : false,
    tournamentBarHTML: tournamentBar ? tournamentBar.innerHTML : '',
    streetProgressHTML: streetProgress ? streetProgress.innerHTML : '',
    betweenHandsHTML: betweenHands ? betweenHands.innerHTML : '',
    hudContentVisible: hudContent ? !hudContent.classList.contains('hidden') : false,
    heroSeatFolded: heroSeat != null && foldedSeats.includes(heroSeat),
    heroSeat,
    foldedSeats: [...foldedSeats],
  };
}

export async function runReplay({ events, seedHands }) {
  const { clock, panelPort } = await setupHarness({ seedHands });

  const mutations = [];
  const snapshots = [];
  const lastMessages = { advice: null, context: null };

  const observer = new MutationObserver((records) => {
    for (const r of records) {
      mutations.push({
        t: clock.now(),
        type: r.type,
        target: (r.target.id || r.target.nodeName || '?').toString(),
        attributeName: r.attributeName ?? null,
        oldValue: r.oldValue ?? null,
        addedCount: r.addedNodes ? r.addedNodes.length : 0,
        removedCount: r.removedNodes ? r.removedNodes.length : 0,
        textLen: r.target.textContent ? r.target.textContent.length : 0,
      });
    }
  });
  observer.observe(document.body, {
    subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true,
  });

  let lastT = 0;
  for (const ev of events) {
    const delta = Math.max(0, (ev.t | 0) - lastT);
    if (delta > 0) clock.advance(delta);
    lastT = ev.t | 0;

    if (ev.type === 'inject') {
      const msg = ev.message;
      if (msg?.type === 'push_action_advice') lastMessages.advice = msg.advice;
      if (msg?.type === 'push_live_context') lastMessages.context = msg.context;
      panelPort.inject(msg);
      // Drain the microtask queue to depth 10 — async handlers like
      // handlePipelineStatus → refreshHandStats → chrome.storage.session.get
      // chain several awaits deep; one tick is not enough.
      for (let _i = 0; _i < 10; _i++) await Promise.resolve();
      clock.advance(0);
    } else if (ev.type === 'snapshot') {
      // Drain all pending renders. render-coordinator uses:
      //   - PRIORITY.IMMEDIATE → rAF callback (~16ms)
      //   - PRIORITY.NORMAL → 80ms coalesce timer + rAF
      // Advance 100ms to ensure both paths fire.
      clock.advance(100);
      for (let _i = 0; _i < 10; _i++) await Promise.resolve();
      snapshots.push(collectSnapshot(lastT, lastMessages));
    } else if (ev.type === 'fast_snapshot') {
      // Snapshot without draining the 80ms coalesce timer — captures the DOM
      // state BEFORE the next NORMAL-priority render executes. Only IMMEDIATE
      // renders (rAF=16ms) are drained. Used for race-window testing (S4).
      clock.advance(20);
      for (let _i = 0; _i < 10; _i++) await Promise.resolve();
      snapshots.push(collectSnapshot(lastT, lastMessages));
    } else if (ev.type === 'advance') {
      clock.advance(ev.ms | 0);
    }
  }

  // Final snapshot drain — advance 100ms to flush both 80ms coalesce + 16ms rAF
  clock.advance(100);
  for (let _i = 0; _i < 10; _i++) await Promise.resolve();
  snapshots.push(collectSnapshot(lastT, lastMessages));

  observer.disconnect();

  return { mutations, snapshots };
}

/**
 * Hash a replay output deterministically (simple FNV-1a over JSON).
 * For determinism self-test: same corpus, same environment → same hash.
 */
export function hashReplay({ mutations, snapshots }) {
  const payload = JSON.stringify({ mutations, snapshots });
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ('00000000' + (h >>> 0).toString(16)).slice(-8);
}
