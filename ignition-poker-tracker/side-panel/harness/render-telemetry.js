/**
 * render-telemetry.js — Records what each render produces for anomaly detection.
 *
 * After each harness render, call record() to snapshot the DOM state and
 * classify what content type was displayed. The log drives anomaly detection.
 */

export class RenderTelemetry {
  constructor() {
    /** @type {RenderEvent[]} */
    this.log = [];
    this.renderCount = 0;
    this._stepIndex = 0;
    this._prevInnerHTML = '';
  }

  /** Set the current scenario step index. */
  setStep(index) { this._stepIndex = index; }

  /**
   * Snapshot the street-card DOM and record a render event.
   * @param {Object} state - The fixture/state object that was rendered
   * @param {HTMLElement|null} streetCardEl - The #street-card element
   * @returns {RenderEvent}
   */
  record(state, streetCardEl) {
    const contentType = this._classifyContent(state);
    const currentHtml = streetCardEl?.innerHTML ?? '';
    const skipped = currentHtml === this._prevInnerHTML;
    this._prevInnerHTML = currentHtml;

    const event = {
      timestamp: Date.now(),
      stepIndex: this._stepIndex,
      contentType,
      skipped,
      renderKey: this._buildKey(state),
      domNodeCount: streetCardEl?.childElementCount ?? 0,
      streetCardText: (streetCardEl?.textContent ?? '').slice(0, 80).trim(),
    };
    this.log.push(event);
    this.renderCount++;
    return event;
  }

  /** Clear all state for a new scenario. */
  reset() {
    this.log = [];
    this.renderCount = 0;
    this._stepIndex = 0;
    this._prevInnerHTML = '';
  }

  /** Classify what content type the state would produce. */
  _classifyContent(state) {
    if (!state.cachedSeatStats || Object.keys(state.cachedSeatStats).length === 0) return 'noTable';
    const lc = state.currentLiveContext;
    if (!lc || lc.state === 'IDLE' || lc.state === 'COMPLETE') return 'between';
    return lc.currentStreet || 'between';
  }

  /** Build a lightweight state fingerprint. */
  _buildKey(state) {
    const lc = state.currentLiveContext;
    return [
      lc?.state, lc?.currentStreet,
      (lc?.foldedSeats || []).length,
      (lc?.actionSequence || []).length,
      lc?.pot,
      state.lastGoodAdvice?.currentStreet,
      state.lastGoodAdvice?.recommendations?.[0]?.action,
      state.pinnedVillainSeat ?? '',
    ].join('|');
  }
}
