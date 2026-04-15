/**
 * shared/settings.js — foundation flag reader/observer.
 *
 * One boolean flag lives in chrome.storage.local:
 *   - settings.debugDiagnostics (gates 0.7 diagnostics link + 4.3 model audit)
 *
 * Defaults false. This module is the single owner of the read path so
 * R-5.1 (single ownership of settings state) holds.
 *
 * Consumers:
 *   - side-panel/side-panel.js boots via `loadSettings()` and wires
 *     `observeSettings()` to `scheduleRender('settings_change')`.
 *   - options/options.js writes via `writeSetting()`.
 *
 * No per-zone render function should read chrome.storage.local directly —
 * always go through the coordinator snapshot.
 */

import { STORAGE_KEYS, SETTINGS_DEFAULTS } from './constants.js';

export const SETTINGS_KEYS = Object.freeze([
  STORAGE_KEYS.SETTINGS_DEBUG_DIAGNOSTICS,
]);

/**
 * Read settings keys from chrome.storage.local. Missing values fall back
 * to SETTINGS_DEFAULTS. Returns a plain object keyed by camelCase short
 * names (matching the part after `settings.`) so consumers read
 * `settings.debugDiagnostics`, not the full storage key.
 *
 * @returns {Promise<{debugDiagnostics: boolean}>}
 */
export async function loadSettings() {
  const raw = await chrome.storage.local.get(SETTINGS_KEYS);
  return normalize(raw);
}

/**
 * Register an onChanged observer that fires `onChange(newSettings)` when
 * either settings key flips in chrome.storage.local. Returns an unsubscribe
 * function.
 *
 * The callback receives the full settings object (re-read), not a diff — SR-6.1
 * consumers (coordinator observer → scheduleRender) don't need deltas and
 * re-reading keeps the single-source-of-truth contract simple.
 */
export function observeSettings(onChange) {
  const listener = async (changes, areaName) => {
    if (areaName !== 'local') return;
    const touched = SETTINGS_KEYS.some(k => Object.prototype.hasOwnProperty.call(changes, k));
    if (!touched) return;
    const next = await loadSettings();
    onChange(next);
  };
  chrome.storage.onChanged.addListener(listener);
  return () => chrome.storage.onChanged.removeListener(listener);
}

/** Write a single setting. Used by the options page. */
export async function writeSetting(key, value) {
  if (!SETTINGS_KEYS.includes(key)) {
    throw new Error(`writeSetting: unknown key ${key}`);
  }
  await chrome.storage.local.set({ [key]: Boolean(value) });
}

function normalize(raw) {
  const get = (k) => {
    if (Object.prototype.hasOwnProperty.call(raw, k)) return Boolean(raw[k]);
    return Boolean(SETTINGS_DEFAULTS[k]);
  };
  return {
    debugDiagnostics: get(STORAGE_KEYS.SETTINGS_DEBUG_DIAGNOSTICS),
  };
}
