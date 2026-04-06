/**
 * popup/popup.js — Sprint 2: Pipeline status + hand viewer
 */

import { injectTokens } from '../shared/design-tokens.js';
import { MSG } from '../shared/constants.js';
import { escapeHtml } from '../side-panel/render-utils.js';

injectTokens();

const $ = (id) => document.getElementById(id);

// ===========================================================================
// STATUS UPDATE
// ===========================================================================
const updateStatus = async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const isIgnition = tab?.url?.includes('ignitioncasino.eu') || tab?.url?.includes('ignitioncasino.net');
    const dot = $('status-dot');
    const text = $('status-text');

    if (!isIgnition) {
      dot.className = 'dot red';
      text.textContent = 'Not on Ignition Casino';
      return;
    }

    // Get pipeline status
    const pipeline = await chrome.runtime.sendMessage({ type: MSG.GET_PIPELINE_STATUS });

    if (!pipeline) {
      dot.className = 'dot yellow';
      text.textContent = 'Service worker not responding';
      return;
    }

    {
      const { tables, tableCount, completedHands, storedHands } = pipeline;

      $('hands-count').textContent = storedHands || completedHands || 0;
      $('tables-count').textContent = tableCount || 0;
      $('ws-count').textContent = completedHands || 0;

      if (completedHands > 0) {
        dot.className = 'dot green';
        text.textContent = `Capturing — ${storedHands} hands stored`;
      } else if (tableCount > 0) {
        dot.className = 'dot green';
        text.textContent = `Connected to ${tableCount} table(s) — waiting for hand completion`;
      } else {
        dot.className = 'dot yellow';
        text.textContent = 'On Ignition — open a poker table to start capturing';
      }

      renderTables(tables);
    }

    // Load captured hands
    const handsData = await chrome.runtime.sendMessage({ type: MSG.GET_CAPTURED_HANDS });
    if (handsData?.hands) {
      renderCapturedHands(handsData.hands);
    }
  } catch (e) {
    $('status-dot').className = 'dot red';
    $('status-text').textContent = 'Error: ' + e.message;
    $('error').textContent = e.stack;
    $('error').style.display = 'block';
  }
};

// ===========================================================================
// TAB SWITCHING
// ===========================================================================
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    $(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ===========================================================================
// RENDER TABLES
// ===========================================================================
const renderTables = (tables) => {
  const container = $('tables-container');
  const entries = Object.entries(tables || {});

  if (entries.length === 0) {
    container.innerHTML = '<div class="table-card" style="color:#666">No active tables</div>';
    return;
  }

  container.innerHTML = entries.map(([connId, state]) => {
    const safeConnId = escapeHtml(String(connId));
    const safeState = escapeHtml(String(state.state || ''));
    const safeHero = escapeHtml(String(state.heroSeat || '?'));
    const safeDealer = escapeHtml(String(state.dealerSeat || '?'));
    const safePot = escapeHtml(String((state.pot || 0).toFixed ? (state.pot || 0).toFixed(2) : state.pot || 0));
    const safeHands = escapeHtml(String(state.completedHands || 0));
    return `
    <div class="table-card">
      <div class="table-header">
        <span class="table-name">Table #${safeConnId}</span>
        <span class="state-badge state-${safeState}">${safeState}</span>
      </div>
      <div class="table-detail">
        <span>Hero: Seat ${safeHero}</span>
        <span>Button: ${safeDealer}</span>
        <span>Pot: $${safePot}</span>
        <span>Hands: ${safeHands}</span>
      </div>
    </div>`;
  }).join('');
};

// ===========================================================================
// RENDER CAPTURED HANDS
// ===========================================================================
const renderCapturedHands = (hands) => {
  const area = $('hands-log');
  if (!hands || hands.length === 0) {
    area.textContent = 'No hands captured yet.\n\nPlay hands at an Ignition poker table\nand they will appear here automatically.';
    return;
  }

  area.innerHTML = '';
  const recent = hands.slice(-50).reverse();

  for (const hand of recent) {
    const div = document.createElement('div');
    div.className = 'log-entry hand';

    const gs = hand.gameState || {};
    const cs = hand.cardState || {};
    const street = gs.currentStreet || '?';
    const hero = cs.holeCards?.filter(c => c).join(' ') || '??';
    const board = cs.communityCards?.filter(c => c).join(' ') || '';
    const actions = gs.actionSequence?.length || 0;
    const time = hand.timestamp ? new Date(hand.timestamp).toLocaleTimeString() : '';

    div.textContent = `${time} | ${hero} | ${board || '(no board)'} | ${street} | ${actions} actions | btn:${gs.dealerButtonSeat}`;
    area.appendChild(div);
  }
};

// ===========================================================================
// EXPORT
// ===========================================================================
const exportHands = async () => {
  try {
    const result = await chrome.runtime.sendMessage({ type: MSG.GET_CAPTURED_HANDS });
    const data = JSON.stringify(result.hands || [], null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ignition-hands-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    $('error').textContent = 'Export failed: ' + e.message;
    $('error').style.display = 'block';
  }
};

// ===========================================================================
// EVENT LISTENERS
// ===========================================================================
$('btn-refresh').addEventListener('click', updateStatus);
$('btn-export').addEventListener('click', exportHands);
$('btn-clear').addEventListener('click', async () => {
  await chrome.runtime.sendMessage({ type: MSG.CLEAR_CAPTURED_HANDS });
  updateStatus();
});

// Initial load + auto-refresh
updateStatus();
setInterval(updateStatus, 3000);
