/**
 * useSyncBridge.js — Bidirectional bridge between the main app and Ignition extension
 *
 * Inbound: listens for hand data + live state from extension via window.postMessage
 * Outbound: pushes exploit data + action advice back to extension
 *
 * The extension uses chrome.runtime.Port for reliable, ordered delivery.
 * Deduplication is handled by deterministic captureId in saveOnlineHand().
 *
 * Protocol constants must stay in sync with:
 *   ignition-poker-tracker/shared/constants.js (BRIDGE_MSG + PROTOCOL_VERSION)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/errorHandler';
import { saveOnlineHand } from '../utils/persistence/handsStorage';
import { getOrCreateOnlineSession } from '../utils/persistence/sessionsStorage';
import { BRIDGE_MSG, PROTOCOL_VERSION } from '../utils/bridgeProtocol';
import {
  readReloadFlag, clearReloadFlag,
  readDismissedFlag, writeDismissedFlag, clearDismissedFlag,
} from '../utils/versionMismatchStorage';
import {
  buildExploitSeat, buildActionAdvice, buildTournament, buildErrorReport,
  validateHandForRelay, validateLiveContext, validateStatus,
} from '@extension-shared/wire-schemas.js';
import { validateHandRecord } from '@extension-shared/hand-format.js';

/**
 * @param {string} userId - Current user ID
 * @returns {{ isExtensionConnected, versionMismatch, lastSyncTime, importedCount, syncError, importFromJson, liveHandState, lastImportedTableSession, pushExploits, pushAdvice, pushTournament }}
 */
// Named useSyncBridgeImpl to avoid collision with the context consumer
// in SyncBridgeContext.jsx, which also exports `useSyncBridge`.
// All consumers should import from contexts/, not directly from this hook.
export const useSyncBridgeImpl = (userId) => {
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [versionMismatch, setVersionMismatch] = useState(false);
  const [extProtocolVersion, setExtProtocolVersion] = useState(null);
  const [extManifestVersion, setExtManifestVersion] = useState(null);
  const [postReloadStatus, setPostReloadStatus] = useState(null);
  // WS-077: subjective override for "I know about the mismatch, continue
  // anyway." Decoupled from the objective `versionMismatch` so we can keep
  // the underlying signal alive while the user proceeds — used to suppress
  // live-flow advice (whose source data is the most version-sensitive
  // surface) regardless of dismiss state, while still resuming hand
  // imports. Initialized from sessionStorage so a refresh inside the same
  // session preserves the user's choice.
  const [dismissedDespiteMismatch, setDismissedDespiteMismatch] = useState(() => readDismissedFlag());
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [importedCount, setImportedCount] = useState(0);
  const [syncError, setSyncError] = useState(null);
  const [liveHandState, setLiveHandState] = useState(null);
  const [lastImportedTableSession, setLastImportedTableSession] = useState(null);

  const sessionCache = useRef(new Map()); // tableId -> sessionId
  const lastHandStateKey = useRef(null);
  const lastHeartbeatResponse = useRef(Date.now());
  const connectedRef = useRef(false);
  const consecutiveFailures = useRef(0);
  const circuitBreakerTrippedAt = useRef(null);
  const versionMismatchRef = useRef(false);
  // WS-228: escalating-backoff reconnect after a disconnect. Independent of
  // the import circuit breaker above (which governs IDB-save failures, not
  // connectivity). reconnectAttemptRef drives the backoff exponent;
  // reconnectTimerRef holds the pending probe timer so the connection-state
  // effect can cancel it on recovery.
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef(null);
  // Pre-reload version snapshot — set on mount if sessionStorage flag exists.
  // Held in a ref so the first STATUS comparison after mount can decide
  // whether the reload actually fixed the mismatch ('recovered') or not
  // ('still-mismatched'). Cleared by `clearPostReloadStatus()`.
  const reloadFlagRef = useRef(readReloadFlag());

  // Sync ref so push callbacks can read connection state without re-creating
  useEffect(() => { connectedRef.current = isExtensionConnected; }, [isExtensionConnected]);

  // Import a batch of hands — dedup handled by saveOnlineHand (captureId check)
  // Circuit breaker: stops processing after 3 consecutive failures, auto-resets after 60s
  const CIRCUIT_BREAKER_THRESHOLD = 3;
  const CIRCUIT_BREAKER_RESET_MS = 60_000;

  const importHands = useCallback(async (hands) => {
    // Check circuit breaker — auto-reset after timeout
    if (circuitBreakerTrippedAt.current) {
      if (Date.now() - circuitBreakerTrippedAt.current > CIRCUIT_BREAKER_RESET_MS) {
        circuitBreakerTrippedAt.current = null;
        consecutiveFailures.current = 0;
        setSyncError(null);
      } else {
        // Don't ACK — hands stay in queue for retry after breaker resets
        logger.warn('SyncBridge', `Circuit breaker active — skipping ${hands.length} hand(s)`);
        return;
      }
    }

    let imported = 0;
    let lastTableId = null;
    let lastSessionId = null;
    const handledIds = []; // IDs of hands successfully imported or detected as duplicates

    for (const hand of hands) {
      try {
        const tableId = hand.tableId || 'unknown_table';
        let sessionId = sessionCache.current.get(tableId);
        if (!sessionId) {
          sessionId = await getOrCreateOnlineSession(tableId, userId);
          sessionCache.current.set(tableId, sessionId);
        }

        const result = await saveOnlineHand(hand, sessionId, userId);
        if (result !== -1) { // -1 = duplicate, skipped
          imported++;
        }
        // Both success and duplicate are "handled" — safe to dequeue
        if (hand.captureId) handledIds.push(hand.captureId);
        lastTableId = tableId;
        lastSessionId = sessionId;
        consecutiveFailures.current = 0; // Reset on success
      } catch (e) {
        // Failed hands are NOT added to handledIds — they stay in the queue
        consecutiveFailures.current++;
        logger.warn('SyncBridge', `Import failed (${consecutiveFailures.current}/${CIRCUIT_BREAKER_THRESHOLD}):`, hand.captureId, e.message);
        reportError('import', e.message, hand.captureId);

        if (consecutiveFailures.current >= CIRCUIT_BREAKER_THRESHOLD) {
          circuitBreakerTrippedAt.current = Date.now();
          setSyncError(`Import circuit breaker tripped after ${CIRCUIT_BREAKER_THRESHOLD} consecutive failures`);
          logger.warn('SyncBridge', 'Circuit breaker tripped — pausing imports for 60s');
          break;
        }
      }
    }

    // ACK only hands that were successfully handled — failed hands stay in queue
    if (handledIds.length > 0) {
      window.postMessage({
        type: BRIDGE_MSG.ACK,
        captureIds: handledIds,
        _v: PROTOCOL_VERSION,
      }, window.location.origin);
    }

    if (imported > 0) {
      setImportedCount(prev => prev + imported);
      setLastSyncTime(Date.now());
      setSyncError(null);

      if (lastTableId && lastSessionId) {
        setLastImportedTableSession({ tableId: lastTableId, sessionId: lastSessionId });
      }
    }
  }, [userId]);

  // Import from JSON file (manual fallback)
  const importFromJson = useCallback(async (jsonData) => {
    let hands;
    if (typeof jsonData === 'string') {
      hands = JSON.parse(jsonData);
    } else if (Array.isArray(jsonData)) {
      hands = jsonData;
    } else {
      throw new Error('Expected JSON array of hand records');
    }

    await importHands(hands);
  }, [importHands]);

  // Push exploit data to extension (stable ref — reads connection state from ref)
  const pushExploits = useCallback((tendencyMap, handCount) => {
    if (!connectedRef.current) return;
    const entries = Object.entries(tendencyMap);
    if (entries.length === 0) return;

    const seats = entries.map(([seat, data]) => buildExploitSeat(seat, data));

    window.postMessage({
      type: BRIDGE_MSG.EXPLOITS,
      seats,
      handCount,
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    }, window.location.origin);
  }, []);

  // Push action advice to extension (stable ref)
  const pushAdvice = useCallback((advice) => {
    if (!advice || !connectedRef.current) return;

    window.postMessage({
      type: BRIDGE_MSG.ACTION_ADVICE,
      advice: buildActionAdvice(advice),
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    }, window.location.origin);
  }, []);

  // Report an error back to the extension for correlation tracking (stable ref)
  const reportError = useCallback((category, message, correlationId) => {
    window.postMessage({
      type: BRIDGE_MSG.ERROR_REPORT,
      report: buildErrorReport({ category, message, correlationId }),
      _v: PROTOCOL_VERSION,
    }, window.location.origin);
  }, []);

  // Push tournament state to extension (stable ref)
  const pushTournament = useCallback((tournamentData) => {
    if (!connectedRef.current) return;
    window.postMessage({
      type: BRIDGE_MSG.TOURNAMENT,
      tournament: buildTournament(tournamentData),
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    }, window.location.origin);
  }, []);

  // Probe the extension for its connection STATUS. The app-bridge content
  // script answers via window.postMessage (see app-bridge outboundListener).
  // Stable ref — used by the mount probe, the 60s heartbeat, and the WS-228
  // reconnect backoff.
  const requestStatus = useCallback(() => {
    window.postMessage({
      type: BRIDGE_MSG.STATUS,
      request: true,
      _v: PROTOCOL_VERSION,
    }, window.location.origin);
  }, []);

  // Listen for messages from extension (relayed via app-bridge content script)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window) return;

      if (event.data?.type === BRIDGE_MSG.HANDS) {
        // Hard stop: refuse hand imports during version mismatch
        if (versionMismatchRef.current) {
          logger.warn('SyncBridge', `Dropping ${event.data.hands?.length || 0} hand(s) — protocol version mismatch`);
          return;
        }
        const rawHands = event.data.hands || [];
        const validHands = rawHands.filter(h => {
          // Wire-level validation (structure, field types, card formats)
          const wireV = validateHandForRelay(h);
          if (!wireV.valid) { logger.warn('SyncBridge', 'Wire validation failed:', wireV.errors); return false; }
          // App-level validation (record shape matches persistence schema)
          const appV = validateHandRecord(h);
          if (!appV.valid) { logger.warn('SyncBridge', 'Record validation failed:', appV.errors); return false; }
          return true;
        });
        if (validHands.length > 0) importHands(validHands);
      }

      if (event.data?.type === BRIDGE_MSG.STATUS && !event.data.request) {
        const sv = validateStatus(event.data);
        if (!sv.valid) {
          logger.warn('SyncBridge', 'Invalid status message:', sv.errors);
          return;
        }
        lastHeartbeatResponse.current = Date.now();
        setIsExtensionConnected(event.data.connected !== false);

        // Capture both versions for the diagnostic surface (WS-076).
        // protocolVersion is an integer; extensionVersion (NEW, optional)
        // is the manifest string like "0.9.0" — older extension builds may
        // omit it, so default to null rather than undefined.
        const extVersion = event.data.protocolVersion;
        const manifestVersion = event.data.extensionVersion ?? null;
        if (extVersion !== undefined) setExtProtocolVersion(extVersion);
        setExtManifestVersion(manifestVersion);

        // Detect protocol version mismatch. WS-077 splits the user-override
        // (`dismissedDespiteMismatch`) from the objective signal:
        //   mismatched + !dismissed → gate imports, surface banner
        //   mismatched +  dismissed → un-gate imports per user choice, pip shows
        //   !mismatched              → clear both signals + storage flag
        const mismatched = extVersion !== undefined && extVersion !== PROTOCOL_VERSION;
        if (mismatched) {
          setVersionMismatch(true);
          // Read the latest dismissed value from a ref-safe source: state may
          // be stale inside this closure (handler captured at mount), so read
          // sessionStorage directly. Cheap; sessionStorage is in-memory.
          const dismissed = readDismissedFlag();
          versionMismatchRef.current = !dismissed;
          if (!dismissed) {
            logger.warn('SyncBridge', 'Protocol version mismatch: extension=' + extVersion + ' app=' + PROTOCOL_VERSION + '. Hand imports halted.');
          }
        } else {
          setVersionMismatch(false);
          versionMismatchRef.current = false;
          // Versions reconverged — user's dismiss override is no longer
          // meaningful. Clear it both in state and in sessionStorage so a
          // subsequent re-mismatch starts fresh. Read from sessionStorage
          // (not closure-captured state) since this useEffect is created
          // once at mount with `[importHands]` deps; closure-captured state
          // would be stale after the user dismisses.
          if (readDismissedFlag()) {
            setDismissedDespiteMismatch(false);
            clearDismissedFlag();
          }
        }

        // Resolve post-reload verification flag (WS-076). The flag was
        // written pre-reload from the diagnostic modal; on the first
        // STATUS comparison after mount we either confirm recovery or
        // surface "still mismatched" copy. Subsequent STATUS messages
        // are no-ops because reloadFlagRef.current is cleared.
        if (reloadFlagRef.current && extVersion !== undefined) {
          setPostReloadStatus(mismatched ? 'still-mismatched' : 'recovered');
          reloadFlagRef.current = null;
        }
      }

      if (event.data?.type === BRIDGE_MSG.HAND_STATE) {
        const lv = validateLiveContext(event.data);
        if (!lv.valid) {
          logger.warn('SyncBridge', 'Invalid hand state:', lv.errors);
          return;
        }
        // Debounce: only update if hand state actually changed
        const key = `${event.data.handNumber}:${event.data.currentStreet}:${event.data.actionSequence?.length}`;
        if (key !== lastHandStateKey.current) {
          lastHandStateKey.current = key;
          setLiveHandState(event.data);
        }
      }
    };

    window.addEventListener('message', handleMessage);

    // Probe for extension on mount — bridge responds if already connected
    requestStatus();

    // Heartbeat: poll extension every 60s, mark disconnected after 120s silence.
    // Connection state is now primarily driven by session storage changes from
    // the extension. This heartbeat is a fallback safety net.
    const HEARTBEAT_INTERVAL = 60_000;
    const HEARTBEAT_TIMEOUT = 120_000;
    const heartbeat = setInterval(() => {
      requestStatus();

      if (Date.now() - lastHeartbeatResponse.current > HEARTBEAT_TIMEOUT) {
        setIsExtensionConnected(false);
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(heartbeat);
    };
  }, [importHands, requestStatus]);

  // WS-228: auto-reconnect after a disconnect. The 60s heartbeat above only
  // re-probes lazily; this controller escalates probing while disconnected so
  // a transient drop (MV3 service-worker idle-spin-down, brief port loss)
  // recovers in seconds instead of up to a minute, with no manual page reload.
  //
  // Triggered whenever isExtensionConnected is false — not only after the 120s
  // heartbeat timeout — because the recoverable transient drop surfaces via a
  // `connected:false` STATUS / push_connection_state long before any timeout.
  // On a valid `connected:true` STATUS response the message handler flips
  // isExtensionConnected → true, this effect re-runs, and the backoff stops;
  // the service worker then re-pushes its session-queued hands and the
  // pushExploits/pushAdvice guards re-open (connectedRef), so queued work
  // flushes without user action.
  //
  // Limitation (Chrome MV3): if the app-bridge content script's context was
  // invalidated (extension updated/disabled) or it was never injected
  // (extension enabled after this tab loaded), no probe can revive it — only a
  // page reload re-injects a content script. This controller recovers the
  // transient case; the context-dead case still needs a reload.
  useEffect(() => {
    // Mirror the port layer's backoff bounds (shared/port-connect.js).
    const RECONNECT_INITIAL_DELAY = 2_000;
    const RECONNECT_MAX_DELAY = 30_000;

    if (isExtensionConnected) {
      // Recovered (or never lost) — stand down and reset backoff.
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      reconnectAttemptRef.current = 0;
      return undefined;
    }

    // Disconnected — escalating-backoff probe loop. Self-reschedules until the
    // effect re-runs on reconnect (cleanup clears the pending timer).
    let cancelled = false;
    const scheduleProbe = () => {
      if (cancelled) return;
      const attempt = reconnectAttemptRef.current;
      const delay = Math.min(
        RECONNECT_INITIAL_DELAY * Math.pow(1.5, attempt),
        RECONNECT_MAX_DELAY,
      );
      reconnectTimerRef.current = setTimeout(() => {
        if (cancelled) return;
        requestStatus();
        reconnectAttemptRef.current += 1;
        scheduleProbe();
      }, delay);
    };
    scheduleProbe();

    return () => {
      cancelled = true;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [isExtensionConnected, requestStatus]);

  // Allow user to force-continue despite version mismatch (WS-077). The
  // user's override is decoupled from the objective `versionMismatch`
  // signal: imports resume (versionMismatchRef.current=false un-gates the
  // hand-import path at line ~199), but `versionMismatch` itself stays
  // true so consumers (OnlineAnalysisContext) can keep suppressing
  // version-sensitive surfaces (live-flow advice). The choice is persisted
  // to sessionStorage so an in-session refresh doesn't re-prompt.
  const dismissVersionMismatch = useCallback(() => {
    setDismissedDespiteMismatch(true);
    versionMismatchRef.current = false;
    writeDismissedFlag();
    logger.warn('SyncBridge', 'Version mismatch dismissed by user — imports resumed; live advice remains suppressed');
  }, []);

  // Clear the post-reload status after the consumer has handled it
  // (e.g., shown a recovery toast). Also wipes the sessionStorage flag.
  const clearPostReloadStatus = useCallback(() => {
    setPostReloadStatus(null);
    clearReloadFlag();
  }, []);

  return {
    isExtensionConnected,
    versionMismatch,
    dismissedDespiteMismatch,
    extProtocolVersion,
    extManifestVersion,
    appProtocolVersion: PROTOCOL_VERSION,
    postReloadStatus,
    clearPostReloadStatus,
    dismissVersionMismatch,
    lastSyncTime,
    importedCount,
    syncError,
    importFromJson,
    liveHandState,
    lastImportedTableSession,
    pushExploits,
    pushAdvice,
    pushTournament,
    reportError,
  };
};

