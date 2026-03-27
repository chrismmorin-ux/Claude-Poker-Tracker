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

        // Detect protocol version mismatch
        const extVersion = event.data.protocolVersion;
        if (extVersion !== undefined && extVersion !== PROTOCOL_VERSION) {
          setVersionMismatch(true);
          versionMismatchRef.current = true;
          logger.warn('SyncBridge', 'Protocol version mismatch: extension=' + extVersion + ' app=' + PROTOCOL_VERSION + '. Hand imports halted.');
        } else {
          setVersionMismatch(false);
          versionMismatchRef.current = false;
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
    window.postMessage({
      type: BRIDGE_MSG.STATUS,
      request: true,
      _v: PROTOCOL_VERSION,
    }, window.location.origin);

    // Heartbeat: poll extension every 60s, mark disconnected after 120s silence.
    // Connection state is now primarily driven by session storage changes from
    // the extension. This heartbeat is a fallback safety net.
    const HEARTBEAT_INTERVAL = 60_000;
    const HEARTBEAT_TIMEOUT = 120_000;
    const heartbeat = setInterval(() => {
      window.postMessage({
        type: BRIDGE_MSG.STATUS,
        request: true,
        _v: PROTOCOL_VERSION,
      }, window.location.origin);

      if (Date.now() - lastHeartbeatResponse.current > HEARTBEAT_TIMEOUT) {
        setIsExtensionConnected(false);
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(heartbeat);
    };
  }, [importHands]);

  // Allow user to force-continue despite version mismatch
  const dismissVersionMismatch = useCallback(() => {
    setVersionMismatch(false);
    versionMismatchRef.current = false;
    logger.warn('SyncBridge', 'Version mismatch dismissed by user — resuming imports');
  }, []);

  return {
    isExtensionConnected,
    versionMismatch,
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

