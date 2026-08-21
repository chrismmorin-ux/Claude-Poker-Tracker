/**
 * storage-writer-journal.test.js — durable hand journal (WS-358).
 *
 * The bug this locks down: the delivery queue lived only in
 * chrome.storage.session, which Chrome wipes on browser close. If the app tab
 * was never opened, every captured hand died with the browser, and past the
 * queue cap the oldest were evicted with no warning at all. For a founder
 * playing real money that is silent, unbounded data loss.
 *
 * The journal is a write-through mirror in chrome.storage.local. These tests
 * assert the three properties that make it a safety net rather than a log:
 *   1. Enqueue mirrors durably.
 *   2. Only an app ACK releases the durable copy.
 *   3. A session wipe (browser close) is recoverable — hands replay.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

function makeStorageArea(store) {
  return {
    async get(keys) {
      if (keys == null) return { ...store };
      const ks = Array.isArray(keys) ? keys : [keys];
      const out = {};
      for (const k of ks) if (k in store) out[k] = store[k];
      return out;
    },
    async set(obj) {
      for (const [k, v] of Object.entries(obj)) store[k] = v;
    },
    async remove(keys) {
      const ks = Array.isArray(keys) ? keys : [keys];
      for (const k of ks) delete store[k];
    },
  };
}

function makeChromeStub() {
  const sessionStore = {};
  const localStore = {};
  return {
    chrome: {
      storage: {
        session: makeStorageArea(sessionStore),
        local: makeStorageArea(localStore),
      },
    },
    sessionStore,
    localStore,
  };
}

/** navigator.locks is absent in jsdom — serialize directly, which is what it does. */
const locksStub = { request: async (_name, cb) => cb() };

const hand = (n, tableId = 't1') => ({
  tableId,
  ignitionMeta: { handNumber: n },
  actions: [],
});

const QUEUE_KEY = 'hand_delivery_queue';
const JOURNAL_KEY = 'ignition_hand_journal';
const DROPPED_KEY = 'ignition_hand_journal_dropped';

describe('storage-writer — durable hand journal', () => {
  let stub;
  let sw;

  beforeEach(async () => {
    stub = makeChromeStub();
    globalThis.chrome = stub.chrome;
    // jsdom exposes navigator as a getter-only property — stubGlobal handles it.
    vi.stubGlobal('navigator', { locks: locksStub });
    // error-reporter writes through chrome.runtime in some paths; keep it inert.
    stub.chrome.runtime = { getManifest: () => ({ version: 'test' }) };
    sw = await import('../storage-writer.js?journal-test');
  });

  it('mirrors every enqueued hand into the durable journal', async () => {
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));

    expect(stub.sessionStore[QUEUE_KEY]).toHaveLength(2);
    expect(stub.localStore[JOURNAL_KEY]).toHaveLength(2);
    expect(stub.localStore[JOURNAL_KEY].map(h => h.captureId))
      .toEqual(stub.sessionStore[QUEUE_KEY].map(h => h.captureId));
  });

  it('keeps the durable copy until the app ACKs it', async () => {
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));
    const ids = stub.sessionStore[QUEUE_KEY].map(h => h.captureId);

    // ACK only the first hand.
    await sw.dequeueHands([ids[0]]);

    expect(stub.sessionStore[QUEUE_KEY]).toHaveLength(1);
    expect(stub.localStore[JOURNAL_KEY]).toHaveLength(1);
    expect(stub.localStore[JOURNAL_KEY][0].captureId).toBe(ids[1]);
  });

  // The core regression: this is exactly the browser-close path that used to
  // destroy an entire un-synced session.
  it('replays un-ACKed hands after a session wipe (browser close)', async () => {
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));
    await sw.enqueueHand(hand(3));
    const before = stub.sessionStore[QUEUE_KEY].map(h => h.captureId);

    // Simulate Chrome closing: session storage is gone, local survives.
    delete stub.sessionStore[QUEUE_KEY];

    const { restored } = await sw.restoreJournalToQueue();

    expect(restored).toBe(3);
    expect(stub.sessionStore[QUEUE_KEY].map(h => h.captureId)).toEqual(before);
  });

  it('does not duplicate hands already present in the queue on replay', async () => {
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));

    const { restored } = await sw.restoreJournalToQueue();

    expect(restored).toBe(0);
    expect(stub.sessionStore[QUEUE_KEY]).toHaveLength(2);
  });

  it('replays nothing once every hand has been ACKed', async () => {
    await sw.enqueueHand(hand(1));
    const ids = stub.sessionStore[QUEUE_KEY].map(h => h.captureId);
    await sw.dequeueHands(ids);

    delete stub.sessionStore[QUEUE_KEY];
    const { restored } = await sw.restoreJournalToQueue();

    expect(restored).toBe(0);
    expect(stub.localStore[JOURNAL_KEY]).toHaveLength(0);
  });

  it('survives a session queue eviction — the journal still holds the hand', async () => {
    // Overfill the session queue past MAX_QUEUE so the oldest is evicted there.
    for (let i = 1; i <= sw.MAX_QUEUE + 5; i++) await sw.enqueueHand(hand(i));

    expect(stub.sessionStore[QUEUE_KEY]).toHaveLength(sw.MAX_QUEUE);
    // Nothing lost durably: the journal cap is far higher than the queue cap.
    expect(stub.localStore[JOURNAL_KEY]).toHaveLength(sw.MAX_QUEUE + 5);
    expect(stub.localStore[DROPPED_KEY] || 0).toBe(0);
  });

  it('counts permanent loss instead of dropping silently at the journal cap', async () => {
    // Pre-seed a full journal so the next append breaches the cap.
    const full = Array.from({ length: sw.MAX_JOURNAL }, (_, i) => ({
      captureId: `seed_${i}`, tableId: 't0',
    }));
    stub.localStore[JOURNAL_KEY] = full;

    await sw.enqueueHand(hand(9001));

    expect(stub.localStore[JOURNAL_KEY]).toHaveLength(sw.MAX_JOURNAL);
    expect(stub.localStore[DROPPED_KEY]).toBe(1);

    const status = await sw.getJournalStatus();
    expect(status.dropped).toBe(1);
    expect(status.pending).toBe(sw.MAX_JOURNAL);
  });

  it('dedups by captureId so a replayed hand is journalled once', async () => {
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(1)); // same table + hand number → same captureId

    expect(stub.localStore[JOURNAL_KEY]).toHaveLength(1);
  });
});

/**
 * TWO CONSUMERS, ONE JOURNAL.
 *
 * The local session sink is a second consumer of the same journal, and it is offline far more
 * often than the app is — it only runs on G16, and G16 is shutdown-prone. Releasing an entry on
 * the app's ACK alone would destroy it before the sink ever saw it, which is the same class of
 * loss WS-358 was written to end.
 *
 * The bound matters as much as the retention: a founder who never installs the sink must not
 * accumulate 5000 undeliverable hands against a 10MB quota. So retention is armed only by
 * evidence that the sink exists, and it disarms when that evidence goes stale.
 */
describe('storage-writer — the journal serves the app AND the local sink', () => {
  let stub;
  let sw;

  const SINK_SEEN_KEY = 'ignition_sink_last_seen_at';
  const JOURNAL_KEY2 = 'ignition_hand_journal';
  const QUEUE_KEY2 = 'hand_delivery_queue';

  beforeEach(async () => {
    stub = makeChromeStub();
    globalThis.chrome = stub.chrome;
    vi.stubGlobal('navigator', { locks: locksStub });
    stub.chrome.runtime = { getManifest: () => ({ version: 'test' }) };
    sw = await import('../storage-writer.js?two-consumer-test');
  });

  it('releases on the app ACK alone when the sink has never been seen — unchanged behaviour', async () => {
    await sw.enqueueHand(hand(1));
    const [id] = stub.sessionStore[QUEUE_KEY2].map(h => h.captureId);

    await sw.dequeueHands([id]);

    // No sink has ever answered, so nothing is being held for it. This is the property that
    // stops an uninstalled sink from pinning the journal forever.
    expect(stub.localStore[JOURNAL_KEY2]).toHaveLength(0);
  });

  it('HOLDS the hand when the sink is live and only the app has ACKed', async () => {
    await sw.noteSinkSeen();
    await sw.enqueueHand(hand(1));
    const [id] = stub.sessionStore[QUEUE_KEY2].map(h => h.captureId);

    await sw.dequeueHands([id]);

    // The app has it; the sink has not. Dropping it here is exactly the loss being prevented.
    expect(stub.localStore[JOURNAL_KEY2]).toHaveLength(1);
    expect(stub.localStore[JOURNAL_KEY2][0]._ackApp).toBe(true);
    expect(stub.localStore[JOURNAL_KEY2][0]._ackSink).toBeUndefined();
  });

  it('releases only once BOTH consumers have ACKed', async () => {
    await sw.noteSinkSeen();
    await sw.enqueueHand(hand(1));
    const [id] = stub.sessionStore[QUEUE_KEY2].map(h => h.captureId);

    await sw.journalAckSink([id]);
    expect(stub.localStore[JOURNAL_KEY2]).toHaveLength(1); // app still outstanding

    await sw.dequeueHands([id]);
    expect(stub.localStore[JOURNAL_KEY2]).toHaveLength(0);
  });

  it('order does not matter — sink first or app first both release', async () => {
    await sw.noteSinkSeen();
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));
    const [a, b] = stub.sessionStore[QUEUE_KEY2].map(h => h.captureId);

    await sw.dequeueHands([a]);        // app first
    await sw.journalAckSink([a]);
    await sw.journalAckSink([b]);      // sink first
    await sw.dequeueHands([b]);

    expect(stub.localStore[JOURNAL_KEY2]).toHaveLength(0);
  });

  it('offers exactly the un-ACKed hands as the backfill payload', async () => {
    await sw.noteSinkSeen();
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));
    await sw.enqueueHand(hand(3));
    const ids = stub.sessionStore[QUEUE_KEY2].map(h => h.captureId);

    await sw.journalAckSink([ids[1]]);

    const pending = await sw.journalPendingForSink();
    expect(pending.map(h => h.captureId)).toEqual([ids[0], ids[2]]);
  });

  it('disarms retention when the sink has been gone too long, so the journal cannot grow forever', async () => {
    // Four days ago — past the 3-day retention window.
    stub.localStore[SINK_SEEN_KEY] = Date.now() - 4 * 24 * 60 * 60 * 1000;
    await sw.enqueueHand(hand(1));
    const [id] = stub.sessionStore[QUEUE_KEY2].map(h => h.captureId);

    await sw.dequeueHands([id]);

    // The sink is treated as not in use. The cost is named in the source: those hands reached
    // the app and IndexedDB, so they are not lost — they just will not backfill to the sink.
    expect(stub.localStore[JOURNAL_KEY2]).toHaveLength(0);
  });

  it('reports the sink backlog separately, so a dead sink is visible rather than silent', async () => {
    await sw.noteSinkSeen();
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));
    const ids = stub.sessionStore[QUEUE_KEY2].map(h => h.captureId);
    await sw.journalAckSink([ids[0]]);

    const status = await sw.getJournalStatus();
    expect(status).toMatchObject({ pending: 2, pendingSink: 1, dropped: 0 });
  });

  it('getJournalHands returns the real hands — the export button had been shipping []', async () => {
    await sw.enqueueHand(hand(1));
    await sw.enqueueHand(hand(2));

    const hands = await sw.getJournalHands();
    expect(hands).toHaveLength(2);
    expect(hands.every(h => h.captureId)).toBe(true);
  });
});
