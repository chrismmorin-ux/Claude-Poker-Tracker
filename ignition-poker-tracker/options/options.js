/**
 * options/options.js — settings UI.
 *
 * Reads debug-diagnostics flag on load, writes on toggle. All I/O goes
 * through shared/settings.js so there is one owner for the read/write path.
 */

import { STORAGE_KEYS } from '../shared/constants.js';
import { loadSettings, writeSetting } from '../shared/settings.js';

const el = (id) => document.getElementById(id);
const statusEl = () => el('status');

function flashStatus(msg) {
  const s = statusEl();
  if (!s) return;
  s.textContent = msg;
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => { s.textContent = ''; }, 1500);
}

async function init() {
  const settings = await loadSettings();
  el('debugDiagnostics').checked = settings.debugDiagnostics;

  el('debugDiagnostics').addEventListener('change', async (e) => {
    await writeSetting(STORAGE_KEYS.SETTINGS_DEBUG_DIAGNOSTICS, e.target.checked);
    flashStatus(`Debug diagnostics ${e.target.checked ? 'on' : 'off'}`);
  });
}

init().catch(e => {
  const s = statusEl();
  if (s) s.textContent = `Failed to load settings: ${e.message}`;
});
