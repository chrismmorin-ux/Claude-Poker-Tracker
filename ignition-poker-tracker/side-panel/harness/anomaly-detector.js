/**
 * anomaly-detector.js — Rule engine that flags rendering problems.
 *
 * Evaluates the telemetry log after each render step and returns
 * new anomalies. Rules detect temporal issues that static tests miss.
 */

const STREETS = new Set(['preflop', 'flop', 'turn', 'river']);

export class AnomalyDetector {
  /**
   * @param {import('./render-telemetry.js').RenderTelemetry} telemetry
   */
  constructor(telemetry) {
    this.telemetry = telemetry;
    /** @type {Anomaly[]} */
    this.anomalies = [];
  }

  /** Run all rules. Returns only NEW anomalies since last check. */
  check() {
    const prevCount = this.anomalies.length;
    this._checkRapidContentFlip();
    this._checkStaleStreet();
    this._checkContentRegression();
    this._checkRenderStorm();
    return this.anomalies.slice(prevCount);
  }

  reset() { this.anomalies = []; }

  // ── Rules ──────────────────────────────────────────────────────────────

  /** >3 content type changes within 1 second window. */
  _checkRapidContentFlip() {
    const now = Date.now();
    const recent = this.telemetry.log.filter(e => e.timestamp > now - 1000 && !e.skipped);
    if (recent.length < 4) return;
    const types = recent.map(e => e.contentType);
    let changes = 0;
    for (let i = 1; i < types.length; i++) {
      if (types[i] !== types[i - 1]) changes++;
    }
    if (changes > 3) {
      this._add('rapid-content-flip', 'error',
        `${changes} content type changes in 1s: ${[...new Set(types)].join(' \u2192 ')}`);
    }
  }

  /** Street card shows different street than currentLiveContext. */
  _checkStaleStreet() {
    const { log } = this.telemetry;
    if (log.length === 0) return;
    const last = log[log.length - 1];
    if (!STREETS.has(last.contentType)) return;
    const keyStreet = last.renderKey.split('|')[1];
    if (keyStreet && STREETS.has(keyStreet) && keyStreet !== last.contentType) {
      this._add('stale-street', 'error',
        `Displaying ${last.contentType} but live context is ${keyStreet}`);
    }
  }

  /** Live street content regresses to between-hands without hand ending. */
  _checkContentRegression() {
    const nonSkipped = this.telemetry.log.filter(e => !e.skipped);
    if (nonSkipped.length < 2) return;
    const prev = nonSkipped[nonSkipped.length - 2];
    const curr = nonSkipped[nonSkipped.length - 1];
    if (STREETS.has(prev.contentType) && curr.contentType === 'between') {
      this._add('content-regression', 'warning',
        `Content went from ${prev.contentType} \u2192 between-hands (step ${curr.stepIndex})`);
    }
  }

  /** >10 non-skipped renders in 1 second. */
  _checkRenderStorm() {
    const now = Date.now();
    const recent = this.telemetry.log.filter(e => e.timestamp > now - 1000 && !e.skipped);
    if (recent.length > 10) {
      this._add('render-storm', 'error',
        `${recent.length} non-skipped renders in 1s (limit: 10)`);
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────

  _add(rule, severity, message) {
    const step = this.telemetry._stepIndex;
    // Deduplicate: same rule at same step
    if (this.anomalies.some(a => a.rule === rule && a.stepIndex === step)) return;
    this.anomalies.push({ rule, severity, message, timestamp: Date.now(), stepIndex: step });
  }
}
