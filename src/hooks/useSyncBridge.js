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

/**
 * @param {string} userId - Current user ID
 * @returns {{ isExtensionConnected, versionMismatch, lastSyncTime, importedCount, syncError, importFromJson, liveHandState, pushExploits, pushAdvice }}
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

  const sessionCache = useRef(new Map()); // tableId -> sessionId
  const lastHandStateKey = useRef(null);

  // Import a batch of hands — dedup handled by saveOnlineHand (captureId check)
  const importHands = useCallback(async (hands) => {
    let imported = 0;

    for (const hand of hands) {
      try {
        // Get or create session for this table
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
      } catch (e) {
        logger.warn('SyncBridge', 'Failed to import hand:', hand.captureId, e.message);
      }
    }

    if (imported > 0) {
      setImportedCount(prev => prev + imported);
      setLastSyncTime(Date.now());
      setSyncError(null);
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

  // Push exploit data to extension
  const pushExploits = useCallback((tendencyMap, handCount) => {
    if (!isExtensionConnected) return;
    const entries = Object.entries(tendencyMap);
    if (entries.length === 0) return;

    const seats = entries.map(([seat, data]) => ({
      seat,
      style: data.style || null,
      sampleSize: data.sampleSize || 0,
      exploits: (data.exploits || []).map(e => ({
        id: e.id, label: e.label, category: e.category,
        street: e.street, statBasis: e.statBasis,
        scoring: e.scoring || null,
        tier: e.tier || 'speculative',
      })),
      weaknesses: (data.weaknesses || []).slice(0, 10).map(w => ({
        id: w.id, label: w.label, category: w.category,
        severity: w.severity, confidence: w.confidence,
      })),
      briefings: (data.briefings || []).slice(0, 5).map(b => ({
        ruleId: b.ruleId, label: b.label,
        scoring: b.scoring || null,
        evidenceBreakdown: b.evidenceBreakdown || null,
        handExamples: b.handExamples || null,
        riskAnalysis: b.riskAnalysis || null,
      })),
      observations: (data.observations || []).slice(0, 15).map(o => ({
        id: o.id, heroContext: o.heroContext,
        heroContextLabel: o.heroContextLabel,
        signal: o.signal, severity: o.severity,
        confidence: o.confidence, tier: o.tier,
        street: o.street, evidence: o.evidence,
      })),
      stats: {
        cbet: data.cbet ?? (data.rawStats?.pfAggressorFlops > 0
          ? Math.round((data.rawStats?.cbetCount || 0) / data.rawStats.pfAggressorFlops * 100) : null),
        foldToCbet: data.foldToCbet ?? (data.rawStats?.facedCbet > 0
          ? Math.round((data.rawStats?.foldedToCbet || 0) / data.rawStats.facedCbet * 100) : null),
        threeBet: data.threeBet ?? null,
      },
      villainHeadline: data.villainProfile?.headline || null,
    }));

    window.postMessage({
      type: BRIDGE_MSG.EXPLOITS,
      seats,
      handCount,
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    }, window.location.origin);
  }, [isExtensionConnected]);

  // Push action advice to extension
  const pushAdvice = useCallback((advice) => {
    if (!advice || !isExtensionConnected) return;

    window.postMessage({
      type: BRIDGE_MSG.ACTION_ADVICE,
      advice: {
        villainSeat: advice.villainSeat,
        villainStyle: advice.villainStyle,
        villainSampleSize: advice.villainSampleSize,
        heroAlreadyActed: advice.heroAlreadyActed,
        confidence: advice.confidence,
        dataQuality: advice.dataQuality || null,
        situation: advice.situation,
        situationLabel: advice.situationLabel,
        heroEquity: advice.heroEquity,
        boardTexture: advice.boardTexture,
        segmentation: advice.segmentation,
        foldPct: advice.foldPct,
        recommendations: advice.recommendations,
        currentStreet: advice.currentStreet,
        potSize: advice.potSize,
        villainBet: advice.villainBet,
        playerStats: advice.playerStats,
      },
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    }, window.location.origin);
  }, [isExtensionConnected]);

  // Listen for messages from extension (relayed via app-bridge content script)
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window) return;

      if (event.data?.type === BRIDGE_MSG.HANDS) {
        importHands(event.data.hands || []);
      }

      if (event.data?.type === BRIDGE_MSG.STATUS) {
        setIsExtensionConnected(event.data.connected !== false);

        // Detect protocol version mismatch
        const extVersion = event.data.protocolVersion;
        if (extVersion !== undefined && extVersion !== PROTOCOL_VERSION) {
          setVersionMismatch(true);
          logger.warn('SyncBridge', 'Protocol version mismatch: extension=' + extVersion + ' app=' + PROTOCOL_VERSION);
        } else {
          setVersionMismatch(false);
        }
      }

      if (event.data?.type === BRIDGE_MSG.HAND_STATE) {
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

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [importHands]);

  return {
    isExtensionConnected,
    versionMismatch,
    lastSyncTime,
    importedCount,
    syncError,
    importFromJson,
    liveHandState,
    pushExploits,
    pushAdvice,
  };
};

