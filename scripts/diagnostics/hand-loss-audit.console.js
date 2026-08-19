/**
 * hand-loss-audit.console.js — WS-565
 *
 * STANDALONE. Paste this whole file into the browser console on the device that holds the
 * real data, and it prints the report. No build, no import, no dev server. That matters:
 * `src/__dev__/handLossAudit.js` is the same audit, but `src/main.jsx` only loads the
 * `__dev__` block under `import.meta.env.DEV`, so on the deployed production build the
 * `window.__handLossAudit` helper does not exist — and the production build is where the
 * founder's actual hands are.
 *
 * READ-ONLY. Opens the database with no version argument, so it attaches to whatever
 * exists and can never trigger an upgrade. Never writes, never deletes.
 *
 * WHAT IT COMPARES, and why the comparison can see anything at all: hand rows are written
 * by `usePersistence.js:211` (saveHand, debounced 1500ms) while the per-session counter is
 * incremented at `sessionReducer.js:163` and persisted by a SEPARATE debounced save at
 * `useSessionPersistence.js:162`. Two independent write paths, no shared transaction — so
 * a silently failed hand write leaves the counter high and the row missing.
 *
 * A gap of 1 on a still-open session is benign (independent debounce windows).
 * A gap >= 2, or any gap on a session that ended cleanly, is the signal.
 */
(async () => {
  const DB_NAME = 'PokerTrackerDB';

  const openReadOnly = () => new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME); // no version — never upgrade
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked — close other tabs of this app and retry'));
    req.onupgradeneeded = () => {
      req.transaction && req.transaction.abort();
      reject(new Error('no PokerTrackerDB on this device — nothing to audit'));
    };
  });

  const getAll = (db, name) => new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(name)) return resolve([]);
    const r = db.transaction(name, 'readonly').objectStore(name).getAll();
    r.onsuccess = () => resolve(r.result || []);
    r.onerror = () => reject(r.error);
  });

  let db;
  try {
    db = await openReadOnly();
  } catch (e) {
    console.error('HAND-LOSS AUDIT could not open the database:', e.message);
    return;
  }

  const dbVersion = db.version;
  const stores = Array.from(db.objectStoreNames);
  const [sessions, hands] = await Promise.all([getAll(db, 'sessions'), getAll(db, 'hands')]);
  db.close();

  const actual = new Map();
  let orphans = 0;
  for (const h of hands) {
    const sid = h && h.sessionId;
    if (sid === undefined || sid === null) { orphans++; continue; }
    actual.set(sid, (actual.get(sid) || 0) + 1);
  }

  const rows = sessions.map((s) => {
    const sessionId = s.sessionId != null ? s.sessionId : s.id;
    const recorded = typeof s.handCount === 'number' ? s.handCount : 0;
    const found = actual.get(sessionId) || 0;
    const ended = s.isActive === false || s.endTime != null;
    const gap = recorded - found;
    return { sessionId, venue: s.venue || null, ended, recorded, actual: found, gap,
             suspect: gap >= 2 || (gap >= 1 && ended) };
  }).sort((a, b) => (b.gap - a.gap));

  const suspect = rows.filter((r) => r.suspect);
  const totRec = rows.reduce((n, r) => n + r.recorded, 0);
  const totAct = rows.reduce((n, r) => n + r.actual, 0);
  const negatives = rows.filter((r) => r.gap < 0).length;

  console.log('\n═══ HAND-LOSS AUDIT (WS-565) — read-only ═══');
  console.log('  audited     ', new Date().toISOString());
  console.log('  DB version  ', dbVersion, '  (code expects 28; lower = this device has not run');
  console.log('                the newer migrations — that is the WS-560 exposure question)');
  console.log('  stores      ', stores.length);
  console.log('  sessions    ', rows.length);
  console.log('  hand rows   ', totAct, 'actual vs', totRec, 'counted    gap =', totRec - totAct);
  if (orphans) console.log('  ORPHANS     ', orphans, 'hand row(s) carry no sessionId');
  if (negatives) console.log('  NEGATIVE    ', negatives, 'session(s) hold MORE rows than counted (counter bug, not loss)');

  if (!rows.length) {
    console.log('\n  No sessions on this device — run this where the real data lives.\n');
  } else if (!suspect.length) {
    console.log('\n  RESULT: no evidence of silent hand loss on this device.');
    console.log('  The defect is NOT cleared — it has not bitten yet, so WS-556 is PREVENTIVE.\n');
  } else {
    console.log('\n  RESULT:', suspect.length, 'SUSPECT SESSION(S) — hands counted, not on disk:');
    console.table(suspect);
    console.log('  This is EVIDENCE that WS-556 has already fired. Record it on WS-556 with');
    console.log('  today\'s date and treat WS-556 as urgent rather than preventive.\n');
  }

  return { dbVersion, stores, rows, suspect, totalRecorded: totRec, totalActual: totAct, orphans };
})();
