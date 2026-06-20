# DCOMP Wave 4 / Auditpass 3 / Finding 13 (MT-62) — Offline-Fallback Verification Report

**Date:** 2026-06-13
**Verifier:** Claude (main) — code-trace verification
**Work item:** WS-082 (legacy DCOMP-W4-A3-F13)
**Program:** design
**Scope:** Confirm the analysis pipeline degrades gracefully when the Ignition extension disconnects mid-session, and document the observed behavior.

## Summary

**Status: PASS — the analysis pipeline degrades gracefully on mid-session extension disconnect. No data loss, no hard failure, no corruption risk.**

The core architectural finding: **the Ignition extension is an *augmentation*, not a dependency.** Captured hands are persisted to IndexedDB on arrival, and the analysis pipeline reads from IndexedDB — never live from the extension. A mid-session disconnect therefore cannot lose in-progress data or break analysis; it only pauses *new* hand ingestion and silences outbound advice pushes to the HUD.

**One gap identified (minor, UX-only):** no automatic reconnect after the 120s heartbeat timeout — the user must manually reload the page to resume live capture. The app remains fully functional in the disconnected state; this is a convenience gap, not a resilience failure. Tracked as a follow-up item (see [Follow-up](#follow-up)).

---

## Architecture verified

### Connection mechanism: WebSocket capture → chrome.runtime.Port → window.postMessage

The extension → app sync path is a multi-hop relay (not a direct WebSocket from the app's perspective):

1. **Capture** — `ignition-poker-tracker/content/ignition-capture.js` probes the Ignition page WebSocket, builds hand records, and sends `{ type: 'hand_complete', hand }` over a `chrome.runtime.Port` to the service worker.
2. **Relay/queue** — `ignition-poker-tracker/background/service-worker.js` enqueues each hand into `chrome.storage.session` and pushes `push_hand` to the app-bridge port. The service worker outlives any single port disconnect.
3. **Bridge** — the app-bridge content script forwards hands to the React app via `window.postMessage` (`BRIDGE_MSG.HANDS`).
4. **Consume + persist** — `src/hooks/useSyncBridge.js` validates each hand and calls `saveOnlineHand(hand, sessionId, userId)` → **IndexedDB**. Only successfully-saved hands are ACK'd back; failures stay queued in the service worker for retry.

### Disconnect detection — two layers

- **Immediate:** when the capture port drops, the service worker sends `push_connection_state { captureAlive: false }`, which propagates to the app and flips `isExtensionConnected` → `false`.
- **Heartbeat fallback:** `useSyncBridge.js` polls STATUS every **60s** (`HEARTBEAT_INTERVAL`); if **120s** (`HEARTBEAT_TIMEOUT`) elapses with no response, it forces `isExtensionConnected = false`.

### Graceful-degradation guarantees

| Concern | Behavior on mid-session disconnect | Verdict |
|---------|------------------------------------|---------|
| **In-progress data** | Hands already saved to IndexedDB persist; hands still in the service-worker session queue survive the port drop and retry on reconnect. | ✓ No loss |
| **Analysis pipeline** | `useOnlineAnalysis` reads hands from IndexedDB (`getHandsBySessionId`) and recomputes the tendency map every ~5s — independent of live connectivity. | ✓ Continues |
| **Outbound advice** | `pushExploits()` / `pushAdvice()` guard on `connectedRef.current` and silently no-op while disconnected. | ✓ Safe no-op |
| **Manual entry path** | TableView records live hands straight to IndexedDB via `saveHand()` with zero extension involvement. | ✓ Fully independent |
| **Repeated import failure** | Circuit breaker stops importing after 3 consecutive failures, auto-resets after 60s; failed hands stay queued. | ✓ No corruption / no thrash |

### User-visible experience (`src/components/views/OnlineView.jsx`)

- Connection-status dot + label: green "Extension connected" / gray "Extension not detected".
- Amber banner on protocol-version mismatch (live advice suppressed until reload/dismiss).
- Red sync-error banner when the circuit breaker trips.
- Empty-state copy adapts: "Waiting for hands…" when connected vs. "Install extension or import from file" when not.

The side-panel HUD degrades to a "waiting for live hand data" / IDLE state and recovers on reconnect. (A previously-identified stale-`appConnected` cache bug on app crash is already fixed via the `clearForAppDisconnect()` transition handler in `side-panel.js`, covered by `app-disconnect-clearing.test.js`.)

---

## Gap & follow-up
<a id="follow-up"></a>

**Gap:** After the 120s heartbeat timeout there is no automatic reconnect attempt — the user must manually reload the page to resume live capture. The app degrades safely (stays fully usable, no data loss), so this is a UX-convenience gap rather than a resilience defect.

**Follow-up ticket:** **WS-228** — add an auto-reconnect / exponential-backoff attempt after heartbeat timeout so live capture resumes without a manual page reload.

---

## Verification method note

This was a code-trace verification (sync-path data flow + disconnect-state handling + persistence boundaries), appropriate because the relevant guarantees are structural — they live in the data-flow topology (IndexedDB as the analysis source of truth, extension as a write-ahead augmentation) rather than in time-gated visual states. A live device-walk reproducing a real mid-session disconnect remains available as an optional deeper gate but is not required to substantiate the PASS verdict.
