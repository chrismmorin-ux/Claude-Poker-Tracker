/**
 * harness.js — Visual test harness for side panel rendering.
 *
 * Two modes:
 *   1. Static: click a fixture button to render one state snapshot
 *   2. Temporal: click a scenario to replay a timed state sequence
 *      with telemetry recording and anomaly detection
 *
 * No chrome.* APIs needed — all render functions are pure.
 */

import { injectTokens } from '../../shared/design-tokens.js';
import {
  computeFocusedVillain,
  buildUnifiedHeaderHTML,
  buildSeatArcHTML,
  buildDeepExpanderHTML,
  buildStatusBar,
} from '../render-orchestrator.js';
import { renderStreetCard, resetStreetCardState } from '../render-street-card.js';
import { ALL_FIXTURES } from '../__tests__/fixtures.js';
import { TEMPORAL_SCENARIOS } from './temporal-scenarios.js';
import { TemporalPlayer } from './temporal-player.js';

// Inject CSS design tokens
injectTokens();

// =========================================================================
// DOM REFERENCES
// =========================================================================

const $ = (id) => document.getElementById(id);

const showEl = (el) => { if (el) el.classList.remove('hidden'); };
const hideEl = (el) => { if (el) el.classList.add('hidden'); };

// =========================================================================
// CORE RENDER — applies a raw state object to all DOM sections
// =========================================================================

function applyState(state) {
  if (!state) return;

  // Compute focused villain
  const focusedVillainSeat = computeFocusedVillain({
    pinnedVillainSeat: state.pinnedVillainSeat ?? null,
    lastGoodAdvice: state.lastGoodAdvice,
    currentLiveContext: state.currentLiveContext,
    currentTableState: state.currentTableState,
  });

  const hasHands = state.cachedSeatStats && Object.keys(state.cachedSeatStats).length > 0;

  // Visibility
  if (hasHands) {
    hideEl($('no-table'));
    hideEl($('pipeline-health'));
    showEl($('hud-content'));
  } else {
    showEl($('no-table'));
    showEl($('pipeline-health'));
    hideEl($('hud-content'));
  }

  // Status bar
  const appConnected = !!state.lastGoodExploits?.appConnected;
  const pipeline = state.lastGoodExploits
    ? { tableCount: 1, tables: { '1': {} }, appConnected }
    : null;
  const handCount = state.cachedSeatStats
    ? Object.values(state.cachedSeatStats).reduce((s, v) => s + (v?.sampleSize || 0), 0)
    : 0;
  const status = buildStatusBar(pipeline, hasHands ? handCount : 0);
  const dot = $('status-dot');
  const text = $('status-text');
  if (dot) dot.className = status.dotClass;
  if (text) text.textContent = status.text || 'Waiting...';
  $('hand-count').textContent = hasHands ? handCount : 0;

  // App connection badge
  const appBadge = $('app-status');
  if (appBadge) {
    if (appConnected) {
      appBadge.className = 'app-status connected';
      appBadge.textContent = 'App synced';
    } else {
      appBadge.className = 'app-status disconnected';
      appBadge.textContent = 'App not open';
    }
  }

  // Seat arc
  const arc = $('seat-arc');
  if (arc && state.cachedSeatStats) {
    arc.innerHTML = buildSeatArcHTML(
      state.cachedSeatStats,
      state.currentTableState,
      state.cachedSeatMap || null,
      {
        currentLiveContext: state.currentLiveContext,
        appSeatData: state.appSeatData || {},
        focusedVillainSeat,
        pinnedVillainSeat: state.pinnedVillainSeat ?? null,
        containerWidth: arc.offsetWidth || 380,
      }
    );
  } else if (arc) {
    arc.innerHTML = '';
  }

  // Unified header
  const header = $('unified-header');
  if (header) {
    const result = buildUnifiedHeaderHTML(
      state.lastGoodAdvice,
      state.currentLiveContext,
      {
        focusedVillainSeat,
        pinnedVillainSeat: state.pinnedVillainSeat ?? null,
        appSeatData: state.appSeatData || {},
        currentTableState: state.currentTableState,
        currentLiveContext: state.currentLiveContext,
      }
    );
    showEl(header);
    header.className = result.className;
    header.innerHTML = result.html;
  }

  // Street card
  const streetCard = $('street-card');
  if (streetCard) {
    const street = state.currentLiveContext?.currentStreet
      || state.lastGoodAdvice?.currentStreet || null;
    renderStreetCard(
      street,
      state.lastGoodAdvice,
      state.currentLiveContext,
      state.appSeatData || {},
      focusedVillainSeat,
      state.lastGoodTournament
    );
  }

  // Deep expander
  const deepBtn = $('deep-expander-btn');
  const deepContent = $('deep-expander-content');
  if (deepBtn && deepContent) {
    const result = buildDeepExpanderHTML(state.lastGoodAdvice);
    if (result.showButton) {
      showEl(deepBtn);
      deepContent.innerHTML = result.html;
      // Auto-open for harness visibility
      deepContent.classList.add('open');
      const chevron = $('deep-expander-chevron');
      if (chevron) chevron.classList.add('open');
      // Init collapsible toggles
      for (const hdr of deepContent.querySelectorAll('.deep-header')) {
        hdr.addEventListener('click', () => {
          hdr.parentElement.classList.toggle('open');
        });
      }
    } else {
      hideEl(deepBtn);
      deepContent.innerHTML = '';
    }
  }

  // Tournament bar
  const tournamentBar = $('tournament-bar');
  if (tournamentBar && state.lastGoodTournament) {
    showEl(tournamentBar);
    const t = state.lastGoodTournament;
    let barHtml = '';
    if (t.heroMRatio != null) {
      barHtml += `<span style="font-weight:bold;color:#eab308">M ${t.heroMRatio.toFixed(1)}</span>`;
    }
    barHtml += `<span style="margin:0 4px;color:var(--text-muted)">\u00B7</span>`;
    barHtml += `<span>Lvl ${(t.currentLevelIndex || 0) + 1}</span>`;
    if (t.playersRemaining) {
      barHtml += `<span style="margin-left:4px">${t.playersRemaining}/${t.totalEntrants || '?'}</span>`;
    }
    tournamentBar.innerHTML = barHtml;
  } else if (tournamentBar) {
    hideEl(tournamentBar);
  }

  // Scroll to top
  document.querySelector('.panel-content')?.scrollTo(0, 0);
}

/** Apply a named fixture (wrapper for static mode). */
function applyScenario(name) {
  const fixture = ALL_FIXTURES[name];
  if (!fixture) return;

  // Mark active scenario in picker
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scenario === name);
  });
  $('active-scenario').textContent = name;

  resetStreetCardState();
  applyState(fixture);
}

// =========================================================================
// BUILD STATIC SCENARIO PICKER
// =========================================================================

const picker = $('scenario-picker');
for (const name of Object.keys(ALL_FIXTURES)) {
  const btn = document.createElement('button');
  btn.className = 'scenario-btn';
  btn.dataset.scenario = name;
  btn.textContent = name.replace(/([A-Z])/g, ' $1').trim();
  btn.addEventListener('click', () => applyScenario(name));
  picker.appendChild(btn);
}

// Deep expander toggle
const deepBtn = $('deep-expander-btn');
if (deepBtn) {
  deepBtn.addEventListener('click', () => {
    const content = $('deep-expander-content');
    const chevron = $('deep-expander-chevron');
    content.classList.toggle('open');
    if (chevron) chevron.classList.toggle('open');
  });
}

// =========================================================================
// TEMPORAL REPLAY MODE
// =========================================================================

let player = null;

function renderAnomalyBadge(anomaly) {
  const el = document.createElement('div');
  el.className = `anomaly-badge anomaly-${anomaly.severity}`;
  el.dataset.stepIndex = anomaly.stepIndex;
  el.textContent = `[Step ${anomaly.stepIndex}] [${anomaly.rule}] ${anomaly.message}`;
  return el;
}

function startTemporal(key) {
  const scenario = TEMPORAL_SCENARIOS[key];
  if (!scenario) return;

  // Reset state
  resetStreetCardState();
  const alertsEl = $('anomaly-alerts');
  const logEl = $('telemetry-log');
  const statusEl = $('temporal-status');
  const stepEl = $('temporal-step');
  if (alertsEl) alertsEl.innerHTML = '';
  if (logEl) logEl.innerHTML = '';
  if (statusEl) statusEl.textContent = `Playing: ${scenario.name}`;
  if (stepEl) stepEl.textContent = '';

  // Mark active temporal button
  document.querySelectorAll('.temporal-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scenario === key);
  });

  player = new TemporalPlayer(applyState, {
    onStep(step, index, renderEvent, anomalies) {
      // Update step counter
      if (stepEl) {
        stepEl.textContent = `Step ${index + 1}/${scenario.steps.length}: ${step.label}`;
      }
      // Append to telemetry log
      if (logEl) {
        const row = document.createElement('div');
        row.className = 'telemetry-row' + (renderEvent.skipped ? ' skipped' : '');
        const skipTag = renderEvent.skipped ? ' (skip)' : '';
        row.textContent = `#${index} ${renderEvent.contentType}${skipTag} nodes=${renderEvent.domNodeCount}`;
        if (step.label) row.title = step.label;
        logEl.appendChild(row);
        logEl.scrollTop = logEl.scrollHeight;
      }
      // Render anomaly badges
      if (alertsEl) {
        for (const a of anomalies) {
          alertsEl.appendChild(renderAnomalyBadge(a));
        }
      }
    },
    onComplete(anomalies) {
      if (statusEl) {
        statusEl.textContent = anomalies.length
          ? `Done \u2014 ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} detected`
          : 'Done \u2014 no anomalies';
      }
    },
  });
  player.play(scenario);
}

// Build temporal scenario picker
const temporalPicker = $('temporal-picker');
if (temporalPicker) {
  for (const [key, scenario] of Object.entries(TEMPORAL_SCENARIOS)) {
    const btn = document.createElement('button');
    btn.className = 'scenario-btn temporal-btn';
    btn.dataset.scenario = key;
    btn.textContent = scenario.name;
    btn.title = scenario.description;
    btn.addEventListener('click', () => startTemporal(key));
    temporalPicker.appendChild(btn);
  }
}

// Temporal controls
$('btn-step')?.addEventListener('click', () => player?.step());
$('btn-pause')?.addEventListener('click', () => player?.pause());
$('btn-resume')?.addEventListener('click', () => player?.resume());
$('btn-stop')?.addEventListener('click', () => player?.stop());

// =========================================================================
// AUTO-LOAD FIRST STATIC SCENARIO
// =========================================================================

const firstScenario = Object.keys(ALL_FIXTURES)[0];
if (firstScenario) applyScenario(firstScenario);
