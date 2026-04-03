/**
 * harness.js — Visual test harness for side panel rendering.
 *
 * Imports the extracted render functions and scenario fixtures,
 * then renders each scenario into the sidebar DOM on button click.
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
import { renderStreetCard } from '../render-street-card.js';
import { ALL_FIXTURES } from '../__tests__/fixtures.js';

// Inject CSS design tokens
injectTokens();

// =========================================================================
// DOM REFERENCES
// =========================================================================

const $ = (id) => document.getElementById(id);

const showEl = (el) => { if (el) el.classList.remove('hidden'); };
const hideEl = (el) => { if (el) el.classList.add('hidden'); };

// =========================================================================
// SCENARIO RENDERING
// =========================================================================

function applyScenario(name) {
  const fixture = ALL_FIXTURES[name];
  if (!fixture) return;

  // Mark active scenario in picker
  document.querySelectorAll('.scenario-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.scenario === name);
  });
  $('active-scenario').textContent = name;

  // Compute focused villain
  const focusedVillainSeat = computeFocusedVillain({
    pinnedVillainSeat: fixture.pinnedVillainSeat ?? null,
    lastGoodAdvice: fixture.lastGoodAdvice,
    currentLiveContext: fixture.currentLiveContext,
    currentTableState: fixture.currentTableState,
  });

  const hasHands = fixture.cachedSeatStats && Object.keys(fixture.cachedSeatStats).length > 0;

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
  const appConnected = !!fixture.lastGoodExploits?.appConnected;
  const pipeline = fixture.lastGoodExploits
    ? { tableCount: 1, tables: { '1': {} }, appConnected }
    : null;
  const handCount = fixture.cachedSeatStats
    ? Object.values(fixture.cachedSeatStats).reduce((s, v) => s + (v?.sampleSize || 0), 0)
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
  if (arc && fixture.cachedSeatStats) {
    arc.innerHTML = buildSeatArcHTML(
      fixture.cachedSeatStats,
      fixture.currentTableState,
      fixture.cachedSeatMap || null,
      {
        currentLiveContext: fixture.currentLiveContext,
        appSeatData: fixture.appSeatData || {},
        focusedVillainSeat,
        pinnedVillainSeat: fixture.pinnedVillainSeat ?? null,
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
      fixture.lastGoodAdvice,
      fixture.currentLiveContext,
      {
        focusedVillainSeat,
        pinnedVillainSeat: fixture.pinnedVillainSeat ?? null,
        appSeatData: fixture.appSeatData || {},
        currentTableState: fixture.currentTableState,
        currentLiveContext: fixture.currentLiveContext,
      }
    );
    showEl(header);
    header.className = result.className;
    header.innerHTML = result.html;
  }

  // Street card
  const streetCard = $('street-card');
  if (streetCard) {
    const street = fixture.currentLiveContext?.currentStreet
      || fixture.lastGoodAdvice?.currentStreet || null;
    renderStreetCard(
      street,
      fixture.lastGoodAdvice,
      fixture.currentLiveContext,
      fixture.appSeatData || {},
      focusedVillainSeat,
      fixture.lastGoodTournament
    );
  }

  // Deep expander
  const deepBtn = $('deep-expander-btn');
  const deepContent = $('deep-expander-content');
  if (deepBtn && deepContent) {
    const result = buildDeepExpanderHTML(fixture.lastGoodAdvice);
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
  if (tournamentBar && fixture.lastGoodTournament) {
    showEl(tournamentBar);
    const t = fixture.lastGoodTournament;
    let barHtml = '';
    if (t.heroMRatio != null) {
      barHtml += `<span style="font-weight:bold;color:#eab308">M ${t.heroMRatio.toFixed(1)}</span>`;
    }
    barHtml += `<span style="margin:0 4px;color:var(--text-muted)">·</span>`;
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

// =========================================================================
// BUILD SCENARIO PICKER
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

// Auto-load first scenario
const firstScenario = Object.keys(ALL_FIXTURES)[0];
if (firstScenario) applyScenario(firstScenario);
