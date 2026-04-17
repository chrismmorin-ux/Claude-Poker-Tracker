// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.mock('../../utils/errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
  DEBUG: false,
  AppError: class AppError extends Error {},
  ERROR_CODES: { INVALID_INPUT: 'E201' },
}));

import { resetDBPool, initDB } from '../../utils/persistence/database';
import { putDraft, getDraft } from '../../utils/persistence/draftsStorage';
import { createPlayer, getPlayerById } from '../../utils/persistence/playersStorage';
import { usePlayerEditor } from '../usePlayerEditor';

beforeEach(async () => {
  resetDBPool();
  globalThis.indexedDB = new IDBFactory();
  globalThis.window = globalThis.window || {};
  globalThis.window.indexedDB = globalThis.indexedDB;
  await initDB();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// -----------------------------------------------------------------------------
// Create mode
// -----------------------------------------------------------------------------

describe('usePlayerEditor — create mode, no existing draft', () => {
  it('starts with default empty fields', async () => {
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));
    expect(result.current.fields.name).toBe('');
    expect(result.current.draftBanner).toBeNull();
  });

  it('pre-fills name from nameSeed when provided', async () => {
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create', nameSeed: 'Mi' } }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));
    expect(result.current.fields.name).toBe('Mi');
  });

  it('updateField updates form state and triggers autosave (create only)', async () => {
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => { result.current.updateField('name', 'Mike'); });
    expect(result.current.fields.name).toBe('Mike');

    // Draft autosave is debounced 500ms — wait and check.
    await new Promise(r => setTimeout(r, 700));
    const stored = await getDraft('guest');
    expect(stored?.draft?.name).toBe('Mike');
  });

  it('updateAvatarFeature merges into avatarFeatures sub-object', async () => {
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => {
      result.current.updateAvatarFeature('hair', 'hair.buzz');
      result.current.updateAvatarFeature('beard', 'beard.goatee');
    });
    expect(result.current.fields.avatarFeatures).toEqual({
      hair: 'hair.buzz',
      beard: 'beard.goatee',
    });
  });
});

describe('usePlayerEditor — create mode with existing draft', () => {
  it('shows draft banner on mount', async () => {
    await putDraft('guest', { name: 'Mike' }, null);
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.draftBanner).toBe('visible'));
    // Fields NOT yet populated with draft — user must explicitly Resume.
    expect(result.current.fields.name).toBe('');
  });

  it('resumeDraft populates fields from stored draft and dismisses banner', async () => {
    await putDraft('guest', {
      name: 'Mike',
      avatarFeatures: { hair: 'hair.buzz' },
    }, null);
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.draftBanner).toBe('visible'));

    await act(async () => { await result.current.resumeDraft(); });
    expect(result.current.fields.name).toBe('Mike');
    expect(result.current.fields.avatarFeatures).toEqual({ hair: 'hair.buzz' });
    expect(result.current.draftBanner).toBe('dismissed');
  });

  it('discardDraft clears draft and resets fields', async () => {
    await putDraft('guest', { name: 'Old Draft' }, null);
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create', nameSeed: 'Mi' } }),
    );
    await waitFor(() => expect(result.current.draftBanner).toBe('visible'));

    await act(async () => { await result.current.discardDraft(); });
    expect(result.current.fields.name).toBe('Mi');  // falls back to seed
    expect(result.current.draftBanner).toBe('dismissed');
    expect(await getDraft('guest')).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Save (create)
// -----------------------------------------------------------------------------

describe('usePlayerEditor — save in create mode', () => {
  it('commits player and clears draft atomically', async () => {
    const onSaveComplete = vi.fn();
    const { result } = renderHook(() =>
      usePlayerEditor({
        editorContext: { mode: 'create' },
        onSaveComplete,
      }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => { result.current.updateField('name', 'Mike'); });
    await new Promise(r => setTimeout(r, 600)); // wait for autosave

    let newId;
    await act(async () => { newId = await result.current.save(); });
    expect(typeof newId).toBe('number');

    const player = await getPlayerById(newId);
    expect(player.name).toBe('Mike');
    expect(player.nameSource).toBe('user');

    // Draft cleared
    expect(await getDraft('guest')).toBeNull();

    // onSaveComplete fired
    expect(onSaveComplete).toHaveBeenCalledWith(expect.objectContaining({
      mode: 'create',
      playerId: newId,
    }));
  });

  it('applies autoName when name is blank + seatContext present', async () => {
    const { result } = renderHook(() =>
      usePlayerEditor({
        editorContext: {
          mode: 'create',
          seatContext: { seat: 3, sessionId: 1 },
        },
      }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => { result.current.updateAvatarFeature('beard', 'beard.goatee'); });
    await new Promise(r => setTimeout(r, 600));

    let newId;
    await act(async () => { newId = await result.current.save(); });
    const player = await getPlayerById(newId);
    expect(player.name).toBe('Seat 3 — Goatee');
    expect(player.nameSource).toBe('auto');
  });

  it('persists avatarFeatures + nameSource on create', async () => {
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => {
      result.current.updateField('name', 'Mike');
      result.current.updateAvatarFeature('hair', 'hair.short-wavy');
      result.current.updateAvatarFeature('hairColor', 'color.black');
    });

    let newId;
    await act(async () => { newId = await result.current.save(); });
    const player = await getPlayerById(newId);
    expect(player.avatarFeatures).toEqual({
      hair: 'hair.short-wavy',
      hairColor: 'color.black',
    });
  });

  it('sets saveError on failure, does not throw', async () => {
    // Force failure via commitDraft: create a player first, then attempt to
    // create another with the same name — but commitDraft doesn't pre-check
    // unique name (see draftsStorage tests). Trigger via validation instead:
    // passing a non-string avatarFeatures.hair.
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => {
      result.current.updateField('name', 'Mike');
      // Inject non-string value via direct state write — bypassing
      // updateAvatarFeature's type assumptions; the validation layer rejects.
      result.current.updateAvatarFeature('hair', 42);
    });

    let returned;
    await act(async () => { returned = await result.current.save(); });
    expect(returned).toBeNull();
    expect(result.current.saveError).toBeInstanceOf(Error);
  });
});

// -----------------------------------------------------------------------------
// Duplicate name detection (non-blocking)
// -----------------------------------------------------------------------------

describe('usePlayerEditor — duplicate detection', () => {
  it('surfaces duplicate when an existing player has same name', async () => {
    const allPlayers = [{ playerId: 1, name: 'Mike' }];
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' }, allPlayers }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => { result.current.updateField('name', 'Mike'); });
    expect(result.current.duplicate).toEqual({ playerId: 1, name: 'Mike' });
  });

  it('is case-insensitive', async () => {
    const allPlayers = [{ playerId: 1, name: 'Mike' }];
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' }, allPlayers }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => { result.current.updateField('name', 'MIKE'); });
    expect(result.current.duplicate?.name).toBe('Mike');
  });

  it('ignores the currently-being-edited player in edit mode', async () => {
    const allPlayers = [{ playerId: 7, name: 'Mike' }];
    const { result } = renderHook(() =>
      usePlayerEditor({
        editorContext: { mode: 'edit', playerId: 7 },
        allPlayers,
      }),
    );
    // Edit mode hydrates from allPlayers
    await waitFor(() => expect(result.current.fields.name).toBe('Mike'));
    expect(result.current.duplicate).toBeNull();
  });

  it('returns null when name is empty', async () => {
    const allPlayers = [{ playerId: 1, name: 'Mike' }];
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' }, allPlayers }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));
    expect(result.current.duplicate).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// Edit mode
// -----------------------------------------------------------------------------

describe('usePlayerEditor — edit mode', () => {
  it('hydrates fields from existing player', async () => {
    const allPlayers = [{
      playerId: 7,
      name: 'Mike',
      nickname: 'Big Mike',
      notes: 'plays too many hands',
      avatarFeatures: { hair: 'hair.buzz' },
    }];
    const { result } = renderHook(() =>
      usePlayerEditor({
        editorContext: { mode: 'edit', playerId: 7 },
        allPlayers,
      }),
    );
    await waitFor(() => expect(result.current.fields.name).toBe('Mike'));
    expect(result.current.fields.nickname).toBe('Big Mike');
    expect(result.current.fields.notes).toBe('plays too many hands');
    expect(result.current.fields.avatarFeatures).toEqual({ hair: 'hair.buzz' });
  });

  it('save in edit mode updates player record in place', async () => {
    // Seed in DB first
    const playerId = await createPlayer({ name: 'Mike', notes: 'old notes' }, 'guest');
    const allPlayers = [await getPlayerById(playerId)];

    const { result } = renderHook(() =>
      usePlayerEditor({
        editorContext: { mode: 'edit', playerId },
        allPlayers,
      }),
    );
    await waitFor(() => expect(result.current.fields.name).toBe('Mike'));

    act(() => { result.current.updateField('notes', 'new notes'); });
    await act(async () => { await result.current.save(); });

    const updated = await getPlayerById(playerId);
    expect(updated.notes).toBe('new notes');
    expect(updated.name).toBe('Mike');
  });

  it('does not autosave in edit mode (no draft churn)', async () => {
    const allPlayers = [{ playerId: 7, name: 'Mike' }];
    const { result } = renderHook(() =>
      usePlayerEditor({
        editorContext: { mode: 'edit', playerId: 7 },
        allPlayers,
      }),
    );
    await waitFor(() => expect(result.current.fields.name).toBe('Mike'));

    act(() => { result.current.updateField('notes', 'hello'); });
    await new Promise(r => setTimeout(r, 700));

    // Draft should NOT exist — edit mode writes direct, no autosave.
    expect(await getDraft('guest')).toBeNull();
  });
});

// -----------------------------------------------------------------------------
// flushPendingDraft
// -----------------------------------------------------------------------------

describe('usePlayerEditor — flushPendingDraft', () => {
  it('writes any in-flight debounced save before returning', async () => {
    const { result } = renderHook(() =>
      usePlayerEditor({ editorContext: { mode: 'create' } }),
    );
    await waitFor(() => expect(result.current.isDraftLoading).toBe(false));

    act(() => { result.current.updateField('name', 'Mike'); });
    // Don't wait for debounce — flush immediately
    await act(async () => { await result.current.flushPendingDraft(); });
    const stored = await getDraft('guest');
    expect(stored?.draft?.name).toBe('Mike');
  });
});
