/**
 * driver.js — browser-side replay driver for SR-3 panel inventory.
 *
 * Mirrors `test/replay/replayer.js` but runs in a real browser so Playwright can
 * screenshot the real IIFE's DOM. Exposes `window.__replay` with:
 *
 *   loadCorpus(id)        — install stubs + seed + load side-panel.js IIFE
 *   stepNext()            — execute one corpus event + drain microtasks + advance clock
 *   stepAll()             — run to end
 *   stepUntil(pred)       — run until predicate returns true for a step
 *   snapshotLabel()       — returns {adviceStreet, contextStreet, handNumber, ...}
 *   reset()               — reload page for a clean run
 *
 * Event flow copies replayer.js lines 95–164 verbatim (same clock advance pattern,
 * same microtask drain depth). Divergence is a bug.
 */

import { installChromeStub } from './chrome-stub.js';
import { CORPUS, CORPUS_IDS } from './corpus-data.js';

// Real-timer helpers. We deliberately do NOT install the jsdom-style fake clock
// here: replacing window.setTimeout/Date/requestAnimationFrame on a real browser
// page breaks Playwright's CDP evaluation channel (it times out waiting for
// globals that never auto-advance). The vitest replayer keeps the fake clock
// for determinism; the browser harness trades that for wall-clock replay that
// Playwright can actually drive.
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms | 0)));
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
async function drainMicrotasks(n = 10) {
  for (let i = 0; i < n; i++) await Promise.resolve();
}

let state = null;

function loadSidePanelScript() {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = './side-panel.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load side-panel.js bundle'));
    document.head.appendChild(script);
  });
}

async function loadCorpus(id) {
  if (state) throw new Error('Corpus already loaded. Call reset() to start over.');
  const corpus = CORPUS[id];
  if (!corpus) throw new Error(`Unknown corpus: ${id}. Available: ${CORPUS_IDS.join(', ')}`);

  const chromeHandle = installChromeStub(window);

  if (corpus.seedHands && corpus.seedHands.length > 0) {
    chromeHandle.sessionStore['side_panel_hands'] = corpus.seedHands;
  }

  await loadSidePanelScript();

  // Drain init microtasks + one rAF.
  await drainMicrotasks();
  await nextFrame();

  const panelPort = chromeHandle.ports['side-panel'];
  if (!panelPort) {
    throw new Error('Harness init failed: side-panel port never opened.');
  }

  state = {
    id,
    label: corpus.label,
    events: corpus.events,
    cursor: 0,
    lastT: 0,
    lastMessages: { advice: null, context: null },
    panelPort,
    chromeHandle,
    drained: false,
  };

  document.body.dataset.replayCorpus = id;
  document.body.dataset.replayStatus = 'loaded';

  return { id, label: corpus.label, eventCount: corpus.events.length };
}

function snapshotLabel() {
  if (!state) return null;
  return {
    corpus: state.id,
    cursor: state.cursor,
    eventCount: state.events.length,
    lastT: state.lastT,
    adviceStreet: state.lastMessages.advice?.currentStreet ?? null,
    contextStreet: state.lastMessages.context?.currentStreet ?? null,
    handNumber: state.lastMessages.context?.handNumber ?? null,
  };
}

async function stepNext() {
  if (!state) throw new Error('loadCorpus first');

  if (state.cursor >= state.events.length) {
    if (!state.drained) {
      // Final drain — wait 100ms wall-clock to let render-coordinator's 80ms
      // coalesce + rAF paths fire, then a final microtask drain.
      await sleep(100);
      await drainMicrotasks();
      state.drained = true;
      document.body.dataset.replayStatus = 'complete';
      return { index: state.events.length, type: 'final_drain', t: state.lastT, msgType: null };
    }
    return null;
  }

  const ev = state.events[state.cursor++];
  const delta = Math.max(0, (ev.t | 0) - state.lastT);
  if (delta > 0) await sleep(delta);
  state.lastT = ev.t | 0;

  let msgType = null;
  if (ev.type === 'inject') {
    const msg = ev.message;
    msgType = msg?.type ?? null;
    if (msg?.type === 'push_action_advice') state.lastMessages.advice = msg.advice;
    if (msg?.type === 'push_live_context') state.lastMessages.context = msg.context;
    state.panelPort.inject(msg);
    await drainMicrotasks();
    await nextFrame();
  } else if (ev.type === 'snapshot') {
    await sleep(100);
    await drainMicrotasks();
  } else if (ev.type === 'fast_snapshot') {
    await sleep(20);
    await drainMicrotasks();
  } else if (ev.type === 'advance') {
    await sleep(ev.ms | 0);
  }

  document.body.dataset.replayCursor = String(state.cursor);

  return { index: state.cursor - 1, type: ev.type, t: ev.t, msgType };
}

async function stepAll() {
  const log = [];
  let s;
  while ((s = await stepNext())) log.push(s);
  return log;
}

async function stepUntil(predicate) {
  let s;
  while ((s = await stepNext())) {
    if (predicate(s)) return s;
  }
  return null;
}

function reset() {
  state = null;
  delete document.body.dataset.replayCorpus;
  delete document.body.dataset.replayStatus;
  delete document.body.dataset.replayCursor;
  window.location.reload();
}

// Inject a stylesheet that disables transitions/animations during replay —
// prevents screenshot flake from in-flight CSS transitions.
function injectStillFrameCSS() {
  const style = document.createElement('style');
  style.id = 'replay-still-frame';
  style.textContent = `
    *, *::before, *::after {
      transition: none !important;
      animation: none !important;
    }
  `;
  document.head.appendChild(style);
}

injectStillFrameCSS();

window.__replay = {
  loadCorpus,
  stepNext,
  stepAll,
  stepUntil,
  snapshotLabel,
  reset,
  corpusIds: CORPUS_IDS,
};

// Log to console for interactive use.
console.log('[replay-harness] ready. Available corpora:', CORPUS_IDS);
console.log('[replay-harness] usage: await window.__replay.loadCorpus("S1"); await window.__replay.stepAll();');
