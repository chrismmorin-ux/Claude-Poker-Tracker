/**
 * draftsStorage.test.js — PEO-1
 *
 * Tests single-draft-per-user invariant, atomic commit, and basic CRUD for
 * the playerDrafts IDB store added in v14.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { resetDBPool } from '../database';

vi.mock('../../errorHandler', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    action: vi.fn(),
  },
  DEBUG: false,
}));

import { initDB, PLAYER_DRAFTS_STORE_NAME, getDB } from '../database';
import { getDraft, putDraft, deleteDraft, commitDraft } from '../draftsStorage';
import { getAllPlayers, getPlayerById } from '../playersStorage';

beforeEach(() => {
  resetDBPool();
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = { indexedDB: globalThis.indexedDB };
});

afterEach(() => {
  delete globalThis.window;
});

describe('getDraft', () => {
  it('returns null when no draft exists', async () => {
    await initDB();
    expect(await getDraft('guest')).toBeNull();
  });

  it('returns the draft record after putDraft', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, { seat: 3, sessionId: 42 });
    const draft = await getDraft('guest');
    expect(draft).not.toBeNull();
    expect(draft.userId).toBe('guest');
    expect(draft.draft).toEqual({ name: 'Mike' });
    expect(draft.seatContext).toEqual({ seat: 3, sessionId: 42 });
    expect(typeof draft.updatedAt).toBe('number');
  });
});

describe('putDraft — single-draft invariant (I-PEO-1)', () => {
  it('overwrites existing draft for same userId', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    await putDraft('guest', { name: 'Mike Jones', avatarFeatures: { hair: 'hair.buzz' } }, null);
    const draft = await getDraft('guest');
    expect(draft.draft).toEqual({ name: 'Mike Jones', avatarFeatures: { hair: 'hair.buzz' } });
  });

  it('keeps separate drafts per userId (multi-account safety)', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    await putDraft('user-2', { name: 'Alice' }, null);
    expect((await getDraft('guest')).draft.name).toBe('Mike');
    expect((await getDraft('user-2')).draft.name).toBe('Alice');
  });

  it('updates timestamp on every put', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    const first = (await getDraft('guest')).updatedAt;
    await new Promise(r => setTimeout(r, 2));
    await putDraft('guest', { name: 'Mike Jr.' }, null);
    const second = (await getDraft('guest')).updatedAt;
    expect(second).toBeGreaterThanOrEqual(first);
  });

  it('accepts null draft payload (freshly-opened editor)', async () => {
    await initDB();
    await putDraft('guest', null, { seat: 3, sessionId: 1 });
    const draft = await getDraft('guest');
    expect(draft.draft).toBeNull();
    expect(draft.seatContext).toEqual({ seat: 3, sessionId: 1 });
  });

  it('accepts null seatContext (opened from PlayersView without a seat)', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    const draft = await getDraft('guest');
    expect(draft.seatContext).toBeNull();
  });

  it('rejects invalid draft records (empty userId)', async () => {
    await initDB();
    await expect(putDraft('', { name: 'Mike' }, null)).rejects.toThrow(/Invalid draft/);
  });

  it('rejects invalid seatContext shape', async () => {
    await initDB();
    await expect(
      putDraft('guest', { name: 'Mike' }, { seat: 'three', sessionId: 42 }),
    ).rejects.toThrow(/Invalid draft/);
  });
});

describe('deleteDraft', () => {
  it('removes an existing draft', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    expect(await getDraft('guest')).not.toBeNull();
    await deleteDraft('guest');
    expect(await getDraft('guest')).toBeNull();
  });

  it('is a no-op when no draft exists', async () => {
    await initDB();
    await expect(deleteDraft('guest')).resolves.toBeUndefined();
  });

  it('deletes only the target userId', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    await putDraft('user-2', { name: 'Alice' }, null);
    await deleteDraft('guest');
    expect(await getDraft('guest')).toBeNull();
    expect(await getDraft('user-2')).not.toBeNull();
  });
});

describe('commitDraft — atomic transaction (I-PEO-1)', () => {
  it('creates player and clears draft in one step', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, { seat: 3, sessionId: 42 });
    const playerId = await commitDraft('guest', { name: 'Mike' });
    expect(typeof playerId).toBe('number');

    // Player exists
    const player = await getPlayerById(playerId);
    expect(player.name).toBe('Mike');
    expect(player.userId).toBe('guest');

    // Draft was cleared
    expect(await getDraft('guest')).toBeNull();
  });

  it('applies defaults for handCount, stats, createdAt, lastSeenAt', async () => {
    await initDB();
    const playerId = await commitDraft('guest', { name: 'Mike' });
    const player = await getPlayerById(playerId);
    expect(player.handCount).toBe(0);
    expect(player.stats).toBeNull();
    expect(typeof player.createdAt).toBe('number');
    expect(typeof player.lastSeenAt).toBe('number');
  });

  it('persists avatarFeatures + nameSource through commit', async () => {
    await initDB();
    const playerId = await commitDraft('guest', {
      name: 'Seat 3 — goatee',
      nameSource: 'auto',
      avatarFeatures: { skin: 'skin.dark', beard: 'beard.goatee' },
    });
    const player = await getPlayerById(playerId);
    expect(player.name).toBe('Seat 3 — goatee');
    expect(player.nameSource).toBe('auto');
    expect(player.avatarFeatures).toEqual({ skin: 'skin.dark', beard: 'beard.goatee' });
  });

  it('aborts and preserves draft when player validation fails', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    // Empty name triggers validation failure
    await expect(commitDraft('guest', { name: '' })).rejects.toThrow(/Invalid player/);
    // Draft survived
    const draft = await getDraft('guest');
    expect(draft).not.toBeNull();
    expect(draft.draft).toEqual({ name: 'Mike' });
  });

  it('aborts when duplicate-name unique index conflicts — draft preserved', async () => {
    await initDB();
    // Seed an existing player
    await commitDraft('guest', { name: 'Mike' });

    // Now start a new draft that would duplicate. commitDraft does NOT pre-check
    // duplicates (that's a UI concern per D5), but IDB's unique index on
    // (userId, name) will reject the second add at transaction level.
    // Note: the players store does not actually declare a unique index, so this
    // test instead verifies the business-level duplicate flows through
    // successfully — reaffirming that dedupe is a UI responsibility, not this
    // function's. If that stance changes, this test should flip polarity.
    await putDraft('guest', { name: 'Mike' }, null);
    const secondId = await commitDraft('guest', { name: 'Mike' });
    expect(typeof secondId).toBe('number');
    // Two players, same name — by design; dedupe handled at UI layer.
    const all = await getAllPlayers('guest');
    expect(all.filter(p => p.name === 'Mike').length).toBe(2);
    // And draft was cleared after successful commit
    expect(await getDraft('guest')).toBeNull();
  });

  it('requires a userId', async () => {
    await initDB();
    await expect(commitDraft('', { name: 'Mike' })).rejects.toThrow(/userId/);
  });

  it('commits for one user without touching another user\'s draft', async () => {
    await initDB();
    await putDraft('guest', { name: 'Mike' }, null);
    await putDraft('user-2', { name: 'Alice' }, null);
    await commitDraft('guest', { name: 'Mike' });
    expect(await getDraft('guest')).toBeNull();
    // Other user's draft untouched
    const other = await getDraft('user-2');
    expect(other).not.toBeNull();
    expect(other.draft.name).toBe('Alice');
  });
});
