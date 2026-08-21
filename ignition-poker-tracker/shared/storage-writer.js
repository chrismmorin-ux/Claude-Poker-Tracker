/**
 * shared/storage-writer.js — Session storage queue for hand delivery
 *
 * Writes completed hand records to chrome.storage.session as a delivery queue.
 * The app-bridge content script listens via chrome.storage.onChanged and forwards
 * hands to the React app. This bypasses the service worker entirely, making hand
 * delivery immune to MV3 SW suspension.
 *
 * Callable from any extension context (content scripts, SW).
 */

import { SESSION_KEYS, STORAGE_KEYS } from './constants.js';
import * as errors from './error-reporter.js';

// Track whether storage access has been lost (context invalidated).
// Once true, all storage operations silently no-op instead of flooding console.
let _storageDead = false;
const _checkStorage = () => {
  if (_storageDead) return false;
  try {
    if (!chrome?.storage?.session) { _storageDead = true; return false; }
    return true;
  } catch (_) { _storageDead = true; return false; }
};

const QUEUE_KEY = SESSION_KEYS.HAND_QUEUE;
const SEQ_KEY = SESSION_KEYS.HAND_QUEUE_SEQ;
export const MAX_QUEUE = 500;

// Cross-tab lock names — navigator.locks provides mutual exclusion across
// all extension contexts (content scripts, SW) sharing the same origin.
const QUEUE_LOCK = 'poker_hand_queue_lock';

// ============================================================================
// DURABLE JOURNAL (WS-358)
// ============================================================================
//
// The delivery queue lives in chrome.storage.session, which Chrome wipes when
// the browser closes. Before WS-358 that made the queue the ONLY copy of a
// captured hand: if the app tab was never opened, every hand died with the
// browser, and past MAX_QUEUE the oldest were evicted silently. For a founder
// playing real money that is unacceptable data loss with no warning.
//
// The journal is a write-through mirror in chrome.storage.local — it survives
// browser close and crash. Entries are removed only when the app ACKs the hand
// (dequeueHands). On startup, restoreJournalToQueue() replays anything still
// un-ACKed back into the session queue, so a session played with no app tab
// open syncs the next time the app is opened.
//
// TRADEOFF (deliberate): chrome.storage.session defaults to TRUSTED_CONTEXTS,
// so content scripts cannot read it; chrome.storage.local has no such control,
// meaning our own ISOLATED-world content scripts on the casino origin can read
// the journal. Casino *page* scripts still cannot — chrome.storage is not
// exposed to page JS at all. Trading that narrow widening for durability of
// money-hand data is the right side of the bet.
const JOURNAL_KEY = STORAGE_KEYS.HAND_JOURNAL;
const DROPPED_KEY = STORAGE_KEYS.HAND_JOURNAL_DROPPED;
const SINK_LAST_SEEN_KEY = STORAGE_KEYS.SINK_LAST_SEEN_AT;
const QUOTA_FAIL_KEY = STORAGE_KEYS.HAND_JOURNAL_QUOTA_FAILURES;
const JOURNAL_LOCK = 'poker_hand_journal_lock';
export const MAX_JOURNAL = 5000;

const _checkLocal = () => {
  try { return !!chrome?.storage?.local; } catch (_) { return false; }
};

/**
 * Write-through append to the durable journal. Best-effort: a journal failure
 * must never block the delivery queue, which is the live path.
 * @param {Object} handRecord - Already stamped with captureId by enqueueHand
 */
const journalAppend = (handRecord) => {
  if (!_checkLocal()) return Promise.resolve({ journalled: false, reason: 'unavailable' });
  return navigator.locks.request(JOURNAL_LOCK, async () => {
    try {
      const result = await chrome.storage.local.get([JOURNAL_KEY, DROPPED_KEY]);
      const journal = result[JOURNAL_KEY] || [];
      let dropped = result[DROPPED_KEY] || 0;

      if (journal.some(h => h.captureId === handRecord.captureId)) {
        return { journalled: true, duplicate: true };
      }
      journal.push(handRecord);

      // Cap breach here IS permanent loss — count it so it can be surfaced
      // instead of vanishing.
      //
      // WS-515: MAX_JOURNAL is NOT the binding ceiling and this branch is
      // effectively dead. chrome.storage.local's default quota is 10MB, and a
      // measured 9-handed record averages ~4,965 bytes (p95 ~9,185) — so the
      // quota arrives at roughly 2,100 hands, well before 5,000, and holding
      // 5,000 would need ~44MB at p95. The extension now requests
      // `unlimitedStorage`, which removes the ceiling rather than budgeting
      // under it; the cap and this counter stay as the backstop.
      if (journal.length > MAX_JOURNAL) {
        const overflow = journal.length - MAX_JOURNAL;
        journal.splice(0, overflow);
        dropped += overflow;
        errors.report('storage', new Error('Hand journal cap exceeded — oldest hands permanently dropped'), {
          op: 'journalEvict', overflow, totalDropped: dropped,
        });
      }

      await chrome.storage.local.set({ [JOURNAL_KEY]: journal, [DROPPED_KEY]: dropped });
      return { journalled: true };
    } catch (e) {
      // WS-515: the failure that actually happens is a quota throw from
      // `set`, and it used to land here and be swallowed — reported to
      // `errors` and nowhere else. `HAND_JOURNAL_DROPPED`, the entire
      // mechanism built so loss "can be surfaced instead of vanishing", lives
      // in the eviction branch above, which never runs. So the one failure
      // that occurs was the one failure the counter could not see, and
      // `enqueueHand` went on to report `success: true` for a hand with no
      // durable copy.
      const quota = isQuotaError(e);
      if (quota) {
        await _bumpQuotaFailureCount();
      }
      errors.report('storage', e, { op: 'journalAppend', quota });
      return { journalled: false, reason: quota ? 'quota' : 'error', error: e?.message };
    }
  });
};

/** Does this storage error mean we ran out of room? */
export const isQuotaError = (e) => {
  const msg = String(e?.message || e || '');
  return /quota|QUOTA_BYTES|exceeded the quota|storage quota/i.test(msg);
};

/** Bump the durable quota-failure counter. Best-effort; never throws. */
const _bumpQuotaFailureCount = async () => {
  try {
    const r = await chrome.storage.local.get(QUOTA_FAIL_KEY);
    await chrome.storage.local.set({ [QUOTA_FAIL_KEY]: (r[QUOTA_FAIL_KEY] || 0) + 1 });
  } catch (_) {
    // If we cannot even record the failure, the surface below still reports
    // headroom, and enqueueHand still returns journalled:false.
  }
};

// ============================================================================
// TWO CONSUMERS, ONE JOURNAL
// ============================================================================
//
// The journal originally had exactly one consumer — the app — so an entry was
// removed the moment the app ACKed it. The local session sink is a SECOND
// consumer, and it is frequently offline (it only runs on G16, and G16 is
// shutdown-prone). An entry dropped on the app's ACK alone would be gone before
// the sink ever saw it, which is precisely the loss WS-358 exists to prevent.
//
// So an entry now carries two flags and leaves only when BOTH consumers are
// satisfied. Entries written before this change have neither flag; absent reads
// as false, which is correct — anything still in the journal is by definition
// un-ACKed by the app.
//
// THE BOUND, AND THE COST IT ACCEPTS.
//
// If the sink is never installed, "satisfied by the sink" would never arrive and
// the journal would fill until it hit a wall. That wall is NOT MAX_JOURNAL.
//
// WS-615 correction: this comment originally read "MAX_JOURNAL (5000 hands, ~9MB
// measured against a 10MB quota)", implying ~1.8 KB/hand. Measured over 500
// records built through the real HandStateMachine, a 9-handed record averages
// 4,965 B (p95 9,185) — so 5,000 hands is ~24 MB at mean and ~44 MB at p95, and
// the 10MB quota binds first at ~2,100 hands (~650 with frame capture active).
// MAX_JOURNAL was never reachable. `unlimitedStorage` now removes the ceiling
// entirely, but SINK_STALE_MS must not be re-derived from the 5,000 figure.
//
// So sink retention applies only while the sink has been SEEN
// within SINK_STALE_MS. Past that the sink is treated as not in use and the
// journal reverts to exactly its pre-existing app-only behaviour.
//
// The cost, named: if the sink stays down for longer than SINK_STALE_MS while the
// founder plays, those hands still reach the app and IndexedDB — they are not
// lost — but they will not backfill to the sink, and a review for them has to be
// rebuilt from the app's own export instead. Every ordinary outage (browser
// restart, sink crash, reboot, a weekend away) is far inside the window.
const SINK_STALE_MS = 3 * 24 * 60 * 60 * 1000;

/** Has the sink been seen recently enough that the journal should hold hands for it? */
const sinkRetentionActive = async () => {
  if (!_checkLocal()) return false;
  try {
    const r = await chrome.storage.local.get(SINK_LAST_SEEN_KEY);
    const seen = Number(r?.[SINK_LAST_SEEN_KEY] || 0);
    return seen > 0 && (Date.now() - seen) < SINK_STALE_MS;
  } catch (_) {
    return false;
  }
};

/** Record that the sink answered. Cheap, and it is what arms retention. */
export const noteSinkSeen = async () => {
  if (!_checkLocal()) return;
  try {
    await chrome.storage.local.set({ [SINK_LAST_SEEN_KEY]: Date.now() });
  } catch (e) {
    errors.report('storage', e, { op: 'noteSinkSeen' });
  }
};

/**
 * Mark journal entries as ACKed by one consumer, and drop those both consumers have.
 * @param {Set<string>} idSet
 * @param {'app'|'sink'} consumer
 */
const journalAck = (idSet, consumer) => {
  if (!_checkLocal()) return Promise.resolve();
  return navigator.locks.request(JOURNAL_LOCK, async () => {
    try {
      const holdForSink = await sinkRetentionActive();
      const result = await chrome.storage.local.get(JOURNAL_KEY);
      const journal = result[JOURNAL_KEY] || [];
      const flag = consumer === 'sink' ? '_ackSink' : '_ackApp';

      const next = [];
      let changed = false;
      for (const h of journal) {
        const entry = idSet.has(h.captureId) && !h[flag]
          ? (changed = true, { ...h, [flag]: true })
          : h;
        // The app is always required. The sink is required only while retention is armed —
        // otherwise an uninstalled sink would pin every hand forever.
        const done = entry._ackApp && (!holdForSink || entry._ackSink);
        if (done) changed = true; else next.push(entry);
      }
      if (changed) await chrome.storage.local.set({ [JOURNAL_KEY]: next });
    } catch (e) {
      errors.report('storage', e, { op: `journalAck:${consumer}` });
    }
  });
};

const journalPrune = (idSet) => journalAck(idSet, 'app');

/**
 * Every hand the journal is holding, for export.
 *
 * The popup's Export button used to ask the service worker for a staging buffer that had been
 * removed, got `[]`, and wrote a valid-looking empty file. This is the real source.
 */
export const getJournalHands = async () => {
  if (!_checkLocal()) return [];
  try {
    const result = await chrome.storage.local.get(JOURNAL_KEY);
    return result[JOURNAL_KEY] || [];
  } catch (e) {
    errors.report('storage', e, { op: 'getJournalHands' });
    return [];
  }
};

/** The sink's ACK. Also arms retention, since an ACK proves the sink is there. */
export const journalAckSink = async (captureIds) => {
  if (!captureIds || captureIds.length === 0) return;
  await noteSinkSeen();
  await journalAck(new Set(captureIds), 'sink');
};

/**
 * Hands the sink has not confirmed yet — the backfill payload after an outage.
 * Oldest first, so a capped backfill makes progress from the front rather than
 * re-sending the same tail forever.
 */
export const journalPendingForSink = async (limit = 250) => {
  if (!_checkLocal()) return [];
  try {
    const result = await chrome.storage.local.get(JOURNAL_KEY);
    const journal = result[JOURNAL_KEY] || [];
    return journal.filter(h => !h._ackSink).slice(0, limit);
  } catch (e) {
    errors.report('storage', e, { op: 'journalPendingForSink' });
    return [];
  }
};

/**
 * Replay un-ACKed journal hands into the session delivery queue.
 * Called on SW startup/install — this is what makes a browser restart
 * (or a whole session played with no app tab open) non-lossy.
 * @returns {Promise<{ restored: number, dropped: number }>}
 */
export const restoreJournalToQueue = async () => {
  if (!_checkStorage() || !_checkLocal()) return { restored: 0, dropped: 0 };
  try {
    const local = await chrome.storage.local.get([JOURNAL_KEY, DROPPED_KEY]);
    const journal = local[JOURNAL_KEY] || [];
    const dropped = local[DROPPED_KEY] || 0;
    if (journal.length === 0) return { restored: 0, dropped };

    return await navigator.locks.request(QUEUE_LOCK, async () => {
      const result = await chrome.storage.session.get(QUEUE_KEY);
      const queue = result[QUEUE_KEY] || [];
      const present = new Set(queue.map(h => h.captureId));
      const missing = journal.filter(h => !present.has(h.captureId));
      if (missing.length === 0) return { restored: 0, dropped };

      // Oldest-first, and keep the queue inside its cap. Anything beyond the
      // cap stays in the journal and is picked up on the next restore pass.
      const merged = [...missing, ...queue].slice(-MAX_QUEUE);
      await chrome.storage.session.set({ [QUEUE_KEY]: merged });
      return { restored: missing.length, dropped };
    });
  } catch (e) {
    errors.report('storage', e, { op: 'restoreJournal' });
    return { restored: 0, dropped: 0 };
  }
};

/**
 * Journal depth + permanent-loss counter, for the side panel's sync indicator.
 * @returns {Promise<{ pending: number, dropped: number }>}
 */
export const getJournalStatus = async () => {
  if (!_checkLocal()) return { pending: 0, dropped: 0 };
  try {
    const result = await chrome.storage.local.get([JOURNAL_KEY, DROPPED_KEY]);
    const journal = result[JOURNAL_KEY] || [];
    return {
      pending: journal.length,
      // How many hands are waiting on the SINK specifically. A number that keeps climbing is
      // the visible symptom of a sink that is down, which is the whole point of surfacing it.
      pendingSink: journal.filter(h => !h._ackSink).length,
      dropped: result[DROPPED_KEY] || 0,
    };
  } catch (_) {
    return { pending: 0, dropped: 0 };
  }
};

/**
 * Generate a deterministic capture ID from hand content.
 * Same hand always produces the same ID (dedup key).
 */
const generateCaptureId = (handRecord) => {
  const handNum = handRecord.ignitionMeta?.handNumber || Date.now();
  const tableId = handRecord.tableId || 'unknown';
  return `${tableId}_${handNum}`;
};

/**
 * Enqueue a completed hand for delivery to the app.
 * Uses navigator.locks for cross-tab serialization (safe with multi-table).
 * @param {Object} handRecord - Validated hand record from the state machine
 * @returns {Promise<{ success: boolean, queueLength: number }>}
 */
export const enqueueHand = (handRecord) => {
  if (!_checkStorage()) return Promise.resolve({ success: false, queueLength: -1 });
  return navigator.locks.request(QUEUE_LOCK, async () => {
    try {
      const result = await chrome.storage.session.get([QUEUE_KEY, SEQ_KEY]);
      const queue = result[QUEUE_KEY] || [];
      const seq = (result[SEQ_KEY] || 0) + 1;

      handRecord.captureId = generateCaptureId(handRecord);
      handRecord.capturedAt = Date.now();
      handRecord._seq = seq;

      // Dedup by captureId
      if (queue.some(h => h.captureId === handRecord.captureId)) {
        return { success: true, queueLength: queue.length, duplicate: true };
      }

      queue.push(handRecord);

      // Enforce max queue size — evict oldest. Not data loss: the durable
      // journal still holds these, and restoreJournalToQueue replays them
      // once the app drains the queue below the cap.
      if (queue.length > MAX_QUEUE) {
        queue.splice(0, queue.length - MAX_QUEUE);
      }

      await chrome.storage.session.set({ [QUEUE_KEY]: queue, [SEQ_KEY]: seq });

      // Write-through to the durable journal. Awaited so a hand is never
      // reported enqueued while its only durable copy is still in flight.
      // A journal failure still does NOT block the live delivery path — that
      // reasoning was and remains correct.
      //
      // WS-515: what was wrong is what we then TOLD the caller. The failure
      // was swallowed and this returned `success: true` for a hand whose only
      // durable copy had just been lost to a full quota. "Do not block on a
      // journal problem" and "report success for a hand with no durable copy"
      // are separate decisions, and only the first is right. `journalled`
      // distinguishes "queued and journalled" from "queued only".
      const journalResult = await journalAppend(handRecord);

      return {
        success: true,
        queueLength: queue.length,
        journalled: journalResult?.journalled !== false,
        ...(journalResult?.journalled === false
          ? { journalFailure: journalResult.reason || 'error' }
          : {}),
      };
    } catch (e) {
      if (!_storageDead) errors.report('storage', e, { op: 'enqueue' });
      return { success: false, queueLength: -1 };
    }
  });
};

/**
 * Remove delivered hands from the queue.
 * Called by app-bridge after forwarding hands to the React app.
 * @param {string[]} captureIds - IDs of hands to remove
 * @returns {Promise<number>} Number of hands removed
 */
export const dequeueHands = (captureIds) => {
  if (!captureIds || captureIds.length === 0) return Promise.resolve(0);
  const idSet = new Set(captureIds);

  return navigator.locks.request(QUEUE_LOCK, async () => {
    try {
      const result = await chrome.storage.session.get(QUEUE_KEY);
      const queue = result[QUEUE_KEY] || [];
      const kept = queue.filter(h => !idSet.has(h.captureId));
      const removed = queue.length - kept.length;
      if (removed > 0) {
        await chrome.storage.session.set({ [QUEUE_KEY]: kept });
      }
      // App has the hands — release the durable copies. Pruning on ACK (not
      // on enqueue) is what makes the journal a safety net rather than a log.
      await journalPrune(idSet);
      return removed;
    } catch (e) {
      if (!_storageDead) errors.report('storage', e, { op: 'dequeue' });
      return 0;
    }
  });
};

/**
 * Get all queued hands (for cold-start drain or diagnostics).
 * @returns {Promise<Object[]>}
 */
export const getQueuedHands = async () => {
  try {
    const result = await chrome.storage.session.get(QUEUE_KEY);
    return result[QUEUE_KEY] || [];
  } catch (e) {
    if (!_storageDead) errors.report('storage', e, { op: 'readQueue' });
    return [];
  }
};

/**
 * Get queue length without loading all hand data.
 * @returns {Promise<number>}
 */
export const getQueueLength = async () => {
  try {
    const result = await chrome.storage.session.get(QUEUE_KEY);
    return (result[QUEUE_KEY] || []).length;
  } catch (e) {
    return 0;
  }
};

/**
 * Clear the delivery queue.
 * @returns {Promise<void>}
 */
export const clearQueue = async () => {
  await chrome.storage.session.set({ [QUEUE_KEY]: [], [SEQ_KEY]: 0 });
};

// ============================================================================
// SIDE PANEL HANDS — persistent mirror for HUD stats (not drained by ACK)
// ============================================================================

const SIDE_PANEL_KEY = SESSION_KEYS.SIDE_PANEL_HANDS;
const MAX_SIDE_PANEL_HANDS = 200;

/**
 * Append a completed hand to the side panel mirror.
 * Unlike the delivery queue, this store is never drained — hands persist
 * for the entire browser session so the side panel can compute stats
 * even after the app has ACK'd and dequeued the delivery copies.
 *
 * No lock needed: single writer (ignition-capture.js content script).
 * @param {Object} handRecord - Validated hand record (must have captureId)
 * @returns {Promise<void>}
 */
export const appendSidePanelHand = async (handRecord) => {
  if (!_checkStorage()) return;
  try {
    const result = await chrome.storage.session.get(SIDE_PANEL_KEY);
    const hands = result[SIDE_PANEL_KEY] || [];

    // Dedup by captureId
    if (hands.some(h => h.captureId === handRecord.captureId)) return;

    hands.push(handRecord);

    // Cap at max — evict oldest
    if (hands.length > MAX_SIDE_PANEL_HANDS) {
      hands.splice(0, hands.length - MAX_SIDE_PANEL_HANDS);
    }

    await chrome.storage.session.set({ [SIDE_PANEL_KEY]: hands });
  } catch (e) {
    if (!_storageDead) errors.report('storage', e, { op: 'sidePanelAppend' });
  }
};

/**
 * Read all side panel hands (for stats computation on panel open).
 * @returns {Promise<Object[]>}
 */
export const getSidePanelHands = async () => {
  try {
    const result = await chrome.storage.session.get(SIDE_PANEL_KEY);
    return result[SIDE_PANEL_KEY] || [];
  } catch (e) {
    if (!_storageDead) errors.report('storage', e, { op: 'sidePanelRead' });
    return [];
  }
};

// ============================================================================
// LIVE CONTEXT — in-progress hand state (throttled, single-key overwrite)
// ============================================================================

const LIVE_CONTEXT_KEY = SESSION_KEYS.LIVE_CONTEXT;
const LIVE_CONTEXT_THROTTLE = 200;
let liveContextPending = null;
let liveContextTimer = null;

/**
 * Write live hand context to session storage (throttled).
 * Only the latest context matters — older writes are dropped.
 * @param {Object} context - From HandStateMachine.getLiveHandContext()
 */
export const writeLiveContext = (context) => {
  if (!_checkStorage()) return;
  liveContextPending = context;
  if (!liveContextTimer) {
    liveContextTimer = setTimeout(() => {
      liveContextTimer = null;
      const ctx = liveContextPending;
      liveContextPending = null;
      if (!ctx || _storageDead) return;
      try {
        chrome.storage.session.set({
          [LIVE_CONTEXT_KEY]: { ...ctx, _persistedAt: Date.now() },
        });
      } catch (e) {
        if (!_storageDead) errors.report('storage', e, { op: 'writeLiveContext' });
      }
    }, LIVE_CONTEXT_THROTTLE);
  }
};

/** Clear the live context throttle timer (for version-upgrade cleanup). */
export const clearLiveContextTimer = () => {
  if (liveContextTimer) {
    clearTimeout(liveContextTimer);
    liveContextTimer = null;
    liveContextPending = null;
  }
};

/**
 * Read live context from session storage (for cold-start).
 * Returns null if stale (> 5s old) or missing.
 * @returns {Promise<Object|null>}
 */
export const readLiveContext = async () => {
  try {
    const result = await chrome.storage.session.get(LIVE_CONTEXT_KEY);
    const ctx = result[LIVE_CONTEXT_KEY];
    if (ctx && ctx._persistedAt && (Date.now() - ctx._persistedAt < 5000)) {
      return ctx;
    }
    return null;
  } catch (_) {
    return null;
  }
};

// ============================================================================
// CONNECTION STATE — single source of truth for capture + bridge alive status
// ============================================================================

const CONN_STATE_KEY = SESSION_KEYS.CONNECTION_STATE;
const CONN_STATE_LOCK = 'poker_conn_state_lock';

/**
 * Update connection state. Merges fields into existing state so capture
 * and bridge scripts can write independently without overwriting each other.
 * Uses navigator.locks for cross-tab serialization.
 * @param {Object} update - Fields to merge: { captureAlive?, appBridgeAlive? }
 */
export const writeConnectionState = (update) => {
  if (!_checkStorage()) return Promise.resolve();
  return navigator.locks.request(CONN_STATE_LOCK, async () => {
    try {
      const result = await chrome.storage.session.get(CONN_STATE_KEY);
      const current = result[CONN_STATE_KEY] || {};
      await chrome.storage.session.set({
        [CONN_STATE_KEY]: { ...current, ...update, timestamp: Date.now() },
      });
    } catch (e) {
      if (!_storageDead) errors.report('storage', e, { op: 'writeConnectionState' });
    }
  });
};

/**
 * Read current connection state.
 * @returns {Promise<{ captureAlive: boolean, appBridgeAlive: boolean, timestamp: number } | null>}
 */
export const readConnectionState = async () => {
  try {
    const result = await chrome.storage.session.get(CONN_STATE_KEY);
    return result[CONN_STATE_KEY] || null;
  } catch (_) {
    return null;
  }
};

// ===========================================================================
// CAPTURE GAP LEDGER — durable record of intervals when capture was DEAD
// ===========================================================================
//
// WS-516. The silence detector raises a banner when capture stops. A banner is a
// display, and a display the founder dismissed leaves no trace. What poisons the
// corpus is not the missing hands themselves — it is that a session with an
// unrecorded hole is INDISTINGUISHABLE from a genuinely short session. Any k/n
// taken over it is silently conditioned on the interval where capture happened
// to be alive, which is not a population anyone chose and cannot be reconstructed
// after the fact.
//
// This ledger makes the hole a fact in the data rather than a moment in the UI.
// It lives in chrome.storage.local for the same reason the hand journal does: it
// has to survive browser close, which is exactly when a session ends.

const CAPTURE_GAPS_KEY = STORAGE_KEYS.CAPTURE_GAPS;
const CAPTURE_GAPS_LOCK = 'poker_capture_gaps_lock';
export const MAX_CAPTURE_GAPS = 500;

/**
 * Record an interval during which capture was dead.
 *
 * @param {Object} gap
 * @param {number} gap.from       - epoch ms of the last observed activity
 * @param {number} gap.to         - epoch ms at which capture resumed, or was observed still dead
 * @param {string} gap.reason     - why capture was considered dead ('silence_timeout', ...)
 * @param {boolean} gap.resumed   - true if traffic came back, false if still dead when recorded
 * @param {string} [gap.tableKey] - stable table identity, when one was seated
 * @returns {Promise<void>} never rejects — a ledger failure must not break capture
 */
export const recordCaptureGap = (gap) => {
  if (!_checkLocal()) return Promise.resolve();
  if (!gap || typeof gap.from !== 'number' || typeof gap.to !== 'number') return Promise.resolve();
  // A zero or negative interval is not a gap. Recording one would put noise into
  // a ledger whose entire value is that every entry means something.
  if (gap.to <= gap.from) return Promise.resolve();

  return navigator.locks.request(CAPTURE_GAPS_LOCK, async () => {
    try {
      const result = await chrome.storage.local.get(CAPTURE_GAPS_KEY);
      const gaps = result[CAPTURE_GAPS_KEY] || [];

      const entry = {
        from: gap.from,
        to: gap.to,
        ms: gap.to - gap.from,
        reason: gap.reason || 'unknown',
        resumed: !!gap.resumed,
        tableKey: gap.tableKey || null,
        recordedAt: Date.now(),
      };

      // Idempotence: the detector observes the same ongoing gap on consecutive
      // ticks. Two entries sharing a start are one hole seen twice, so keep the
      // one that knows most — the later `to`.
      const existing = gaps.findIndex(g => g.from === entry.from);
      if (existing !== -1) {
        if (gaps[existing].to >= entry.to) return;
        gaps[existing] = entry;
      } else {
        gaps.push(entry);
      }

      // Unlike the hand journal, eviction here loses a MARKER rather than data.
      // Still reported: a ledger that silently forgets holes has precisely the
      // defect it exists to fix.
      if (gaps.length > MAX_CAPTURE_GAPS) {
        const overflow = gaps.length - MAX_CAPTURE_GAPS;
        gaps.splice(0, overflow);
        errors.report('storage', new Error('Capture-gap ledger cap exceeded — oldest gap markers dropped'), {
          op: 'captureGapEvict', overflow,
        });
      }

      await chrome.storage.local.set({ [CAPTURE_GAPS_KEY]: gaps });
    } catch (e) {
      errors.report('storage', e, { op: 'recordCaptureGap' });
    }
  });
};

/**
 * Read the capture-gap ledger.
 * @returns {Promise<Array<Object>>} oldest first; [] when unavailable
 */
export const getCaptureGaps = async () => {
  if (!_checkLocal()) return [];
  try {
    const result = await chrome.storage.local.get(CAPTURE_GAPS_KEY);
    return result[CAPTURE_GAPS_KEY] || [];
  } catch (_) {
    return [];
  }
};

// ===========================================================================
// JOURNAL STORAGE HEALTH — WS-515
// ===========================================================================
//
// The ceiling that actually binds is chrome.storage.local's quota, not
// MAX_JOURNAL. With `unlimitedStorage` granted the quota is lifted, but a limit
// nobody can observe approaching is the same defect one layer up — so the bytes
// in use and the failure count are readable rather than inferred.

/** Default chrome.storage.local quota WITHOUT `unlimitedStorage`. */
export const DEFAULT_LOCAL_QUOTA_BYTES = 10 * 1024 * 1024;

/**
 * Measured size of a real 9-handed hand record, from 500 records built through
 * HandStateMachine and serialized as chrome.storage stores them:
 *
 *     mean 4,965 B   p50 4,382 B   p95 9,185 B   max 9,961 B
 *
 * Which puts the 10MB quota at ~2,100 hands (mean) or ~1,140 (p95) — and ~650
 * when frame capture reserves its 4.5MB. MAX_JOURNAL = 5000 would need ~44MB at
 * p95, so it was never the binding limit.
 *
 * Caveat, because the number is load-bearing: record size is dominated by
 * action-sequence length, and this distribution is synthetic (real hands, real
 * builder, chosen action spread). The direction is robust — the quota binds
 * long before MAX_JOURNAL — but the exact figure should be re-derived from real
 * captures. WS-224 is the raw-capture ticket that would supply them.
 */
export const MEASURED_RECORD_BYTES = Object.freeze({
  mean: 4965, p50: 4382, p95: 9185, max: 9961, n: 500,
});

/**
 * Journal storage health, for a founder-visible surface.
 * @returns {Promise<{bytesInUse:number|null, entries:number, dropped:number,
 *   quotaFailures:number, estRemainingHands:number|null, unlimited:boolean}>}
 */
export const getJournalStorageHealth = async () => {
  const out = {
    bytesInUse: null, entries: 0, dropped: 0, quotaFailures: 0,
    estRemainingHands: null, unlimited: false,
  };
  if (!_checkLocal()) return out;
  try {
    const r = await chrome.storage.local.get([JOURNAL_KEY, DROPPED_KEY, QUOTA_FAIL_KEY]);
    out.entries = (r[JOURNAL_KEY] || []).length;
    out.dropped = r[DROPPED_KEY] || 0;
    out.quotaFailures = r[QUOTA_FAIL_KEY] || 0;

    try {
      out.unlimited = !!chrome?.runtime?.getManifest?.()?.permissions?.includes('unlimitedStorage');
    } catch (_) { /* manifest unavailable in some test contexts */ }

    if (typeof chrome.storage.local.getBytesInUse === 'function') {
      out.bytesInUse = await chrome.storage.local.getBytesInUse(null);
      if (!out.unlimited && Number.isFinite(out.bytesInUse)) {
        const remaining = DEFAULT_LOCAL_QUOTA_BYTES - out.bytesInUse;
        out.estRemainingHands = Math.max(0, Math.floor(remaining / MEASURED_RECORD_BYTES.mean));
      }
    }
  } catch (e) {
    errors.report('storage', e, { op: 'getJournalStorageHealth' });
  }
  return out;
};

/** Clear the ledger. Test/maintenance only — never called on the live path. */
export const clearCaptureGaps = async () => {
  if (!_checkLocal()) return;
  try {
    await chrome.storage.local.remove(CAPTURE_GAPS_KEY);
  } catch (_) { /* best-effort */ }
};
