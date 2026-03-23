/**
 * useSyncBridge.js — Listens for hand data from the Ignition extension
 *
 * The extension's app-bridge.js content script posts captured hands
 * via window.postMessage. This hook listens for those messages,
 * deduplicates, creates online sessions, and saves to IndexedDB.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { saveOnlineHand } from '../utils/persistence/handsStorage';
import { getOrCreateOnlineSession } from '../utils/persistence/sessionsStorage';

const MSG_TYPE_HANDS = 'POKER_SYNC_HANDS';
const MSG_TYPE_ACK = 'POKER_SYNC_ACK';
const MSG_TYPE_STATUS = 'POKER_SYNC_STATUS';

/**
 * @param {string} userId - Current user ID
 * @returns {{ isExtensionConnected, lastSyncTime, importedCount, syncError, importFromJson }}
 */
const useSyncBridge = (userId) => {
  const [isExtensionConnected, setIsExtensionConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [importedCount, setImportedCount] = useState(0);
  const [syncError, setSyncError] = useState(null);

  const processedIds = useRef(new Set());
  const sessionCache = useRef(new Map()); // tableId → sessionId
  const lastStatusTime = useRef(0);
  const isProcessing = useRef(false);

  // Restore processed IDs from sessionStorage (survives hot reload)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('poker_sync_processed_ids');
      if (saved) {
        const ids = JSON.parse(saved);
        processedIds.current = new Set(ids);
        setImportedCount(ids.length);
      }
    } catch (_) {}
  }, []);

  // Save processed IDs to sessionStorage
  const persistProcessedIds = useCallback(() => {
    try {
      const ids = Array.from(processedIds.current).slice(-1000); // Keep last 1000
      sessionStorage.setItem('poker_sync_processed_ids', JSON.stringify(ids));
    } catch (_) {}
  }, []);

  // Import a batch of hands
  const importHands = useCallback(async (hands) => {
    if (isProcessing.current) return;
    isProcessing.current = true;

    try {
      let imported = 0;
      let lastCaptureId = null;

      for (const hand of hands) {
        // Dedup by captureId
        if (!hand.captureId || processedIds.current.has(hand.captureId)) {
          continue;
        }

        try {
          // Get or create session for this table
          const tableId = hand.tableId || 'unknown_table';
          let sessionId = sessionCache.current.get(tableId);
          if (!sessionId) {
            sessionId = await getOrCreateOnlineSession(tableId, userId);
            sessionCache.current.set(tableId, sessionId);
          }

          await saveOnlineHand(hand, sessionId, userId);
          processedIds.current.add(hand.captureId);
          lastCaptureId = hand.captureId;
          imported++;
        } catch (e) {
          console.warn('[SyncBridge] Failed to import hand:', e.message);
        }
      }

      if (imported > 0) {
        setImportedCount(prev => prev + imported);
        setLastSyncTime(Date.now());
        setSyncError(null);
        persistProcessedIds();

        // ACK back to extension so it advances watermark
        if (lastCaptureId) {
          window.postMessage({ type: MSG_TYPE_ACK, lastCaptureId }, '*');
        }
      }
    } catch (e) {
      setSyncError(e.message);
    } finally {
      isProcessing.current = false;
    }
  }, [userId, persistProcessedIds]);

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
    return processedIds.current.size;
  }, [importHands]);

  // Listen for messages from extension
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.source !== window) return;

      if (event.data?.type === MSG_TYPE_HANDS) {
        importHands(event.data.hands || []);
      }

      if (event.data?.type === MSG_TYPE_STATUS) {
        lastStatusTime.current = Date.now();
        setIsExtensionConnected(true);
      }
    };

    window.addEventListener('message', handleMessage);

    // Check connection status — if no status message in 10s, mark disconnected
    const connectionCheck = setInterval(() => {
      const elapsed = Date.now() - lastStatusTime.current;
      setIsExtensionConnected(elapsed < 10000);
    }, 5000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearInterval(connectionCheck);
    };
  }, [importHands]);

  return {
    isExtensionConnected,
    lastSyncTime,
    importedCount,
    syncError,
    importFromJson,
  };
};

export default useSyncBridge;
