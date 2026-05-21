// @vitest-environment jsdom
/**
 * shapeMasteryStorage.test.js — IDB CRUD wrapper tests for SLS v26 stores.
 *
 * Round-trip on `shapeMastery` (singleton per user) + `shapeLessons`
 * (append-only completion history). Mirrors `refresherStore.test.js` pattern.
 *
 * SLS Stream D — SPR-081 / WS-040.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDB,
  closeDB,
  resetDBPool,
  DB_NAME,
  SHAPE_MASTERY_STORE_NAME,
  SHAPE_LESSONS_STORE_NAME,
} from '../database';
import {
  getShapeMastery,
  putShapeMastery,
  deleteShapeMastery,
  appendLessonCompletion,
  listLessonCompletions,
  clearLessonCompletions,
} from '../shapeMasteryStorage';

const deleteEntireDB = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = (e) => reject(e.target.error);
    req.onblocked = () => resolve();
  });

beforeEach(async () => {
  closeDB();
  resetDBPool();
  await deleteEntireDB();
});

afterEach(async () => {
  closeDB();
  resetDBPool();
});

describe('shapeMastery store', () => {
  it('store exists at v26 with correct keyPath', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(SHAPE_MASTERY_STORE_NAME)).toBe(true);
    const tx = db.transaction(SHAPE_MASTERY_STORE_NAME, 'readonly');
    const store = tx.objectStore(SHAPE_MASTERY_STORE_NAME);
    expect(store.keyPath).toBe('userId');
    expect(store.autoIncrement).toBe(false);
  });

  it('getShapeMastery returns null for an unknown user', async () => {
    const record = await getShapeMastery('unknown-user-id');
    expect(record).toBeNull();
  });

  it('putShapeMastery + getShapeMastery round-trip', async () => {
    const record = {
      userId: 'guest',
      enrolled: true,
      enrolledAt: 1715600000000,
      descriptors: {
        silhouette: {
          posterior: { alpha: 8, beta: 2 },
          declaredLevel: 'known',
          userMuteState: 'already-known',
          mutedAt: 1715600000000,
          lastValidatedAt: null,
          lastInteractedAt: 1715600000000,
          schemaVersion: 1,
        },
      },
      schemaVersion: '1.0.0',
    };
    await putShapeMastery(record);
    const loaded = await getShapeMastery('guest');
    expect(loaded).toEqual(record);
  });

  it('putShapeMastery rejects records without userId', async () => {
    await expect(putShapeMastery({ enrolled: true })).rejects.toThrow(/userId/);
    await expect(putShapeMastery({ userId: 42 })).rejects.toThrow(/userId/);
    await expect(putShapeMastery(null)).rejects.toThrow(/userId/);
  });

  it('deleteShapeMastery removes the record', async () => {
    await putShapeMastery({
      userId: 'guest',
      enrolled: true,
      enrolledAt: 1,
      descriptors: {},
      schemaVersion: '1.0.0',
    });
    await deleteShapeMastery('guest');
    const loaded = await getShapeMastery('guest');
    expect(loaded).toBeNull();
  });
});

describe('shapeLessons store', () => {
  it('store exists at v26 with correct keyPath + 3 indexes', async () => {
    const db = await getDB();
    expect(db.objectStoreNames.contains(SHAPE_LESSONS_STORE_NAME)).toBe(true);
    const tx = db.transaction(SHAPE_LESSONS_STORE_NAME, 'readonly');
    const store = tx.objectStore(SHAPE_LESSONS_STORE_NAME);
    expect(store.keyPath).toBe('id');
    expect(store.autoIncrement).toBe(false);
    expect(store.indexNames.contains('by_userId')).toBe(true);
    expect(store.indexNames.contains('by_descriptorId')).toBe(true);
    expect(store.indexNames.contains('by_completedAt')).toBe(true);
  });

  it('appendLessonCompletion derives id from userId:lessonId:completedAt', async () => {
    await appendLessonCompletion({
      userId: 'guest',
      lessonId: 'silhouette-intro',
      descriptorId: 'silhouette',
      completedAt: 1000,
      accuracy: 0.8,
      totalSpots: 5,
      correctSpots: 4,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    const records = await listLessonCompletions('guest');
    expect(records.length).toBe(1);
    expect(records[0].id).toBe('guest:silhouette-intro:1000');
  });

  it('appendLessonCompletion rejects malformed records', async () => {
    await expect(
      appendLessonCompletion({ lessonId: 'x', descriptorId: 'y', completedAt: 1 }),
    ).rejects.toThrow();
    await expect(
      appendLessonCompletion({ userId: 'g', descriptorId: 'y', completedAt: 1 }),
    ).rejects.toThrow();
  });

  it('listLessonCompletions returns user records in descending completedAt order', async () => {
    const make = (lessonId, completedAt, descriptorId = 'silhouette') => ({
      userId: 'guest',
      lessonId,
      descriptorId,
      completedAt,
      accuracy: 1,
      totalSpots: 1,
      correctSpots: 1,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    await appendLessonCompletion(make('a', 100));
    await appendLessonCompletion(make('b', 300));
    await appendLessonCompletion(make('c', 200));
    const records = await listLessonCompletions('guest');
    expect(records.map((r) => r.completedAt)).toEqual([300, 200, 100]);
  });

  it('listLessonCompletions filters by descriptorId', async () => {
    await appendLessonCompletion({
      userId: 'guest',
      lessonId: 'a',
      descriptorId: 'silhouette',
      completedAt: 1,
      accuracy: 1,
      totalSpots: 1,
      correctSpots: 1,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    await appendLessonCompletion({
      userId: 'guest',
      lessonId: 'b',
      descriptorId: 'saddle',
      completedAt: 2,
      accuracy: 1,
      totalSpots: 1,
      correctSpots: 1,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    const silhouetteRecords = await listLessonCompletions('guest', {
      descriptorId: 'silhouette',
    });
    expect(silhouetteRecords.length).toBe(1);
    expect(silhouetteRecords[0].descriptorId).toBe('silhouette');
  });

  it('listLessonCompletions filters by since timestamp', async () => {
    const make = (completedAt) => ({
      userId: 'guest',
      lessonId: `l${completedAt}`,
      descriptorId: 'silhouette',
      completedAt,
      accuracy: 1,
      totalSpots: 1,
      correctSpots: 1,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    await appendLessonCompletion(make(100));
    await appendLessonCompletion(make(500));
    await appendLessonCompletion(make(900));
    const recent = await listLessonCompletions('guest', { since: 400 });
    expect(recent.map((r) => r.completedAt)).toEqual([900, 500]);
  });

  it('listLessonCompletions never returns records for other users', async () => {
    await appendLessonCompletion({
      userId: 'guest',
      lessonId: 'a',
      descriptorId: 'silhouette',
      completedAt: 1,
      accuracy: 1,
      totalSpots: 1,
      correctSpots: 1,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    await appendLessonCompletion({
      userId: 'other-user',
      lessonId: 'b',
      descriptorId: 'silhouette',
      completedAt: 2,
      accuracy: 1,
      totalSpots: 1,
      correctSpots: 1,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    const guestRecords = await listLessonCompletions('guest');
    expect(guestRecords.length).toBe(1);
    expect(guestRecords[0].lessonId).toBe('a');
  });

  it('clearLessonCompletions removes all records for a user', async () => {
    await appendLessonCompletion({
      userId: 'guest',
      lessonId: 'a',
      descriptorId: 'silhouette',
      completedAt: 1,
      accuracy: 1,
      totalSpots: 1,
      correctSpots: 1,
      sessionIncognito: false,
      schemaVersion: 1,
    });
    await clearLessonCompletions('guest');
    const records = await listLessonCompletions('guest');
    expect(records.length).toBe(0);
  });
});
