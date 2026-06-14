/**
 * options/options.js — settings UI.
 *
 * Reads debug-diagnostics flag on load, writes on toggle. All I/O goes
 * through shared/settings.js so there is one owner for the read/write path.
 */

import { STORAGE_KEYS } from '../shared/constants.js';
import { loadSettings, writeSetting } from '../shared/settings.js';
import {
  isCaptureEnabled,
  setCaptureEnabled,
  collectFrames,
  toJsonl,
  clearFrames,
} from '../shared/frame-capture.js';

const el = (id) => document.getElementById(id);
const statusEl = () => el('status');

function flashStatus(msg) {
  const s = statusEl();
  if (!s) return;
  s.textContent = msg;
  clearTimeout(flashStatus._t);
  flashStatus._t = setTimeout(() => { s.textContent = ''; }, 2500);
}

function downloadText(filename, text, mime) {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function init() {
  const settings = await loadSettings();
  el('debugDiagnostics').checked = settings.debugDiagnostics;

  el('debugDiagnostics').addEventListener('change', async (e) => {
    await writeSetting(STORAGE_KEYS.SETTINGS_DEBUG_DIAGNOSTICS, e.target.checked);
    flashStatus(`Debug diagnostics ${e.target.checked ? 'on' : 'off'}`);
  });

  // --- Raw frame capture ---
  el('captureRawFrames').checked = await isCaptureEnabled();

  el('captureRawFrames').addEventListener('change', async (e) => {
    await setCaptureEnabled(e.target.checked);
    flashStatus(
      e.target.checked
        ? 'Capture ON — play a few hands, then Export.'
        : 'Capture off.',
    );
  });

  el('exportFrames').addEventListener('click', async () => {
    const records = await collectFrames();
    if (!records.length) {
      flashStatus('No frames captured yet. Turn capture on and open an Ignition table.');
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    downloadText(`ignition-frames-${stamp}.jsonl`, toJsonl(records), 'application/x-ndjson');
    const msgs = records.filter((r) => r.kind === 'msg').length;
    flashStatus(`Exported ${records.length} records (${msgs} frames).`);
  });

  el('clearFrames').addEventListener('click', async () => {
    const n = await clearFrames();
    flashStatus(n ? `Cleared ${n} capture buffer(s).` : 'Nothing to clear.');
  });
}

init().catch(e => {
  const s = statusEl();
  if (s) s.textContent = `Failed to load settings: ${e.message}`;
});
