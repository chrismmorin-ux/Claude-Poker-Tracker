/**
 * temporal-player.js — Playback engine for temporal replay scenarios.
 *
 * Drives the harness through a sequence of state steps with timing,
 * records telemetry, checks for anomalies, and sets data attributes
 * for Playwright coordination.
 */

import { ALL_FIXTURES } from '../__tests__/fixtures.js';
import { RenderTelemetry } from './render-telemetry.js';
import { AnomalyDetector } from './anomaly-detector.js';

/**
 * Deep-merge source into target (one level of object nesting).
 * Arrays and primitives in source overwrite target.
 */
function deepMerge(target, source) {
  const out = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      out[key] = deepMerge(target[key], source[key]);
    } else {
      out[key] = source[key];
    }
  }
  return out;
}

export class TemporalPlayer {
  /**
   * @param {function(Object): void} applyFn - Renders a state object into the harness DOM
   * @param {Object} [callbacks]
   * @param {function(Object, number, Object, Object[]): void} [callbacks.onStep]
   * @param {function(Object[]): void} [callbacks.onComplete]
   */
  constructor(applyFn, callbacks = {}) {
    this.applyFn = applyFn;
    this.callbacks = callbacks;
    this.telemetry = new RenderTelemetry();
    this.detector = new AnomalyDetector(this.telemetry);
    this._timers = [];
    this._playing = false;
    this._stepIndex = 0;
    this._scenario = null;
    this._paused = false;
  }

  /** Start auto-playing a scenario from the beginning. */
  play(scenario) {
    this.stop();
    this._scenario = scenario;
    this._playing = true;
    this._paused = false;
    this._stepIndex = 0;
    this.telemetry.reset();
    this.detector.reset();
    this._setStatus('playing');
    this._scheduleFrom(0);
  }

  pause() {
    this._paused = true;
    this._clearTimers();
    this._setStatus('paused');
  }

  resume() {
    this._paused = false;
    this._setStatus('playing');
    this._scheduleFrom(this._stepIndex);
  }

  /** Advance exactly one step (for Playwright manual stepping). */
  step() {
    if (!this._scenario) return;
    if (this._stepIndex >= this._scenario.steps.length) return;
    this._executeStep(this._stepIndex);
    this._stepIndex++;
    if (this._stepIndex >= this._scenario.steps.length) {
      this._complete();
    }
  }

  stop() {
    this._clearTimers();
    this._playing = false;
    this._paused = false;
    this._setStatus('idle');
  }

  // ── Internal ───────────────────────────────────────────────────────────

  _scheduleFrom(startIndex) {
    const steps = this._scenario.steps;
    let cumDelay = 0;
    for (let i = startIndex; i < steps.length; i++) {
      cumDelay += steps[i].delay;
      const idx = i;
      const timer = setTimeout(() => {
        if (this._paused) return;
        this._executeStep(idx);
        this._stepIndex = idx + 1;
        if (this._stepIndex >= steps.length) this._complete();
      }, cumDelay);
      this._timers.push(timer);
    }
  }

  _executeStep(index) {
    const step = this._scenario.steps[index];
    this.telemetry.setStep(index);

    // Build merged state: base fixture + patch
    const base = step.fixtureKey ? { ...(ALL_FIXTURES[step.fixtureKey] || {}) } : {};
    const state = step.patch ? deepMerge(base, step.patch) : base;

    // Apply to harness DOM
    this.applyFn(state);

    // Record telemetry
    const streetCard = document.getElementById('street-card');
    const renderEvent = this.telemetry.record(state, streetCard);

    // Check anomalies
    const newAnomalies = this.detector.check();

    // Set Playwright coordination attributes
    if (step.screenshot) {
      const wrapper = document.querySelector('.panel-wrapper');
      if (wrapper) wrapper.dataset.screenshotReady = String(index);
    }

    // Callback
    this.callbacks.onStep?.(step, index, renderEvent, newAnomalies);
  }

  _complete() {
    this._playing = false;
    this._setStatus('done');
    this.callbacks.onComplete?.(this.detector.anomalies);
  }

  _clearTimers() {
    this._timers.forEach(clearTimeout);
    this._timers = [];
  }

  _setStatus(state) {
    const el = document.getElementById('temporal-status');
    if (el) el.dataset.state = state;
  }
}
