/**
 * handLossAudit.js — has a hand already been silently lost?
 *
 * WS-565. The launch sweep of 2026-08-19 proved silent hand loss is POSSIBLE
 * (`usePersistence.js:211` is the only production `saveHand` call site; its catch at
 * `:214-216` terminates at `console.error`, and the `lastSavedAt` it returns is discarded
 * by `useAppState.js:85-93`). Nobody asked whether it has already HAPPENED. This answers
 * that from the device's own IndexedDB.
 *
 * WHY THE COMPARISON IS VALID — the load-bearing detail. Two INDEPENDENT write paths
 * maintain the two numbers:
 *
 *   hand rows  ← `usePersistence.js:211`  saveHand(...)          (debounced 1500ms)
 *   handCount  ← `sessionReducer.js:163`  handCount + 1
 *                then persisted by `useSessionPersistence.js:162` in a SEPARATE
 *                debounced session auto-save
 *
 * They do not share a transaction. So when a hand write fails silently, the counter still
 * increments and persists, and the difference survives as evidence. If they shared a
 * transaction both would fail together and this audit could detect nothing.
 *
 * READ THE RESULT CAREFULLY. A gap is EVIDENCE, not proof — the two saves are debounced
 * independently, so a session that was open when the tab closed can show a benign gap of
 * one. `suspectSessions` applies that rule; `gap >= 2`, or any gap on a session that ended
 * cleanly (`isActive: false`, `endTime` set), is the signal that matters.
 *
 * Shipped in production on purpose. The Settings > Data & About panel calls this via a
 * "Check for lost hands" button, because the founder plays on a phone where a console
 * paste is not reachable. It lives under utils/persistence rather than __dev__ for the
 * same reason: it is a data-integrity check, not a development aid.
 *
 * Usage (dev console, on the device that holds the real data):
 *   await window.__handLossAudit()          // print the report
 *   await window.__handLossAudit({ json: true })   // return the raw object
 *
 * This module is READ-ONLY. It opens the database at its existing version and never
 * writes, never migrates, never deletes. Opening with `undefined` as the version is
 * deliberate: passing a number could trigger an upgrade, and an upgrade is exactly the
 * hazard WS-560 is about.
 */

const DB_NAME = 'PokerTrackerDB';
const HANDS_STORE = 'hands';
const SESSIONS_STORE = 'sessions';

function openReadOnly() {
  return new Promise((resolve, reject) => {
    // No version argument — attach to whatever exists. Never upgrade.
    const req = indexedDB.open(DB_NAME);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB open blocked — close other tabs of this app and retry.'));
    req.onupgradeneeded = () => {
      // Reaching here means the DB did not exist. Abort rather than create one.
      req.transaction?.abort();
      reject(new Error('No PokerTrackerDB on this device — nothing to audit.'));
    };
  });
}

function getAll(db, storeName) {
  return new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(storeName)) {
      resolve([]);
      return;
    }
    const tx = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

/**
 * @param {{ json?: boolean }} [opts]
 * @returns {Promise<Object>} the audit result
 */
export async function handLossAudit(opts = {}) {
  const db = await openReadOnly();
  const dbVersion = db.version;
  const stores = Array.from(db.objectStoreNames);

  const [sessions, hands] = await Promise.all([
    getAll(db, SESSIONS_STORE),
    getAll(db, HANDS_STORE),
  ]);
  db.close();

  // Actual rows per session, counted from the hands store itself.
  const actualBySession = new Map();
  let handsWithNoSession = 0;
  for (const h of hands) {
    const sid = h?.sessionId;
    if (sid === undefined || sid === null) {
      handsWithNoSession += 1;
      continue;
    }
    actualBySession.set(sid, (actualBySession.get(sid) || 0) + 1);
  }

  const rows = sessions.map((s) => {
    const sessionId = s.sessionId ?? s.id;
    const recorded = typeof s.handCount === 'number' ? s.handCount : 0;
    const actual = actualBySession.get(sessionId) || 0;
    const ended = s.isActive === false || s.endTime != null;
    const gap = recorded - actual;
    return {
      sessionId,
      venue: s.venue ?? null,
      startTime: s.startTime ?? null,
      ended,
      recorded,
      actual,
      gap,
      // A closed session should have reconciled. An open one may legitimately
      // trail by a single debounce window.
      suspect: gap >= 2 || (gap >= 1 && ended),
    };
  });

  rows.sort((a, b) => (b.gap - a.gap) || ((b.startTime || 0) - (a.startTime || 0)));

  const suspect = rows.filter((r) => r.suspect);
  const totalRecorded = rows.reduce((n, r) => n + r.recorded, 0);
  const totalActual = rows.reduce((n, r) => n + r.actual, 0);

  const result = {
    auditedAt: new Date().toISOString(),
    dbName: DB_NAME,
    dbVersion,
    storeCount: stores.length,
    stores,
    sessionCount: rows.length,
    totalRecorded,
    totalActual,
    totalGap: totalRecorded - totalActual,
    orphanHands: handsWithNoSession,
    negativeGapSessions: rows.filter((r) => r.gap < 0).length,
    suspectSessions: suspect,
    rows,
  };

  if (!opts.json) printReport(result);
  return result;
}

function printReport(r) {
  const line = (s) => console.log(s);
  line('');
  line('═══ HAND-LOSS AUDIT (WS-565) — read-only ═══');
  line(`  audited      ${r.auditedAt}`);
  line(`  DB version   ${r.dbVersion}    (code expects 28 — a lower number means this`);
  line(`               device has not yet run the newer migrations; see WS-560)`);
  line(`  stores       ${r.storeCount} present`);
  line(`  sessions     ${r.sessionCount}`);
  line(`  hand rows    ${r.totalActual} actual  vs  ${r.totalRecorded} counted   gap = ${r.totalGap}`);
  if (r.orphanHands) line(`  ORPHANS      ${r.orphanHands} hand row(s) carry no sessionId`);
  if (r.negativeGapSessions) {
    line(`  NEGATIVE     ${r.negativeGapSessions} session(s) hold MORE rows than counted —`);
    line(`               that is a counter bug, not a loss. Worth its own look.`);
  }
  line('');

  if (!r.sessionCount) {
    line('  No sessions on this device. Nothing to audit — run this where the real data lives.');
    line('');
    return;
  }

  if (!r.suspectSessions.length) {
    line('  RESULT: no evidence of silent hand loss on this device.');
    line('');
    line('  This does NOT clear the defect — it means it has not bitten yet, so WS-556 is');
    line('  PREVENTIVE rather than urgent. A gap of 1 on a still-open session is benign:');
    line('  the two debounced saves land independently.');
  } else {
    line(`  RESULT: ${r.suspectSessions.length} SUSPECT SESSION(S) — hands were counted and are not on disk.`);
    line('');
    line('  session  venue                 counted  actual  gap  ended');
    for (const s of r.suspectSessions) {
      const v = String(s.venue ?? '—').slice(0, 20).padEnd(20);
      line(`  ${String(s.sessionId).padStart(7)}  ${v}  ${String(s.recorded).padStart(7)}  ${String(s.actual).padStart(6)}  ${String(s.gap).padStart(3)}  ${s.ended ? 'yes' : 'no'}`);
    }
    line('');
    line('  This is EVIDENCE of the WS-556 defect having already fired. Record it on WS-556');
    line('  with today\'s date, and treat WS-556 as urgent rather than preventive.');
  }
  line('');
  line('  Full detail: await window.__handLossAudit({ json: true })');
  line('');
}

if (typeof window !== 'undefined') {
  window.__handLossAudit = handLossAudit;
}

export default handLossAudit;
