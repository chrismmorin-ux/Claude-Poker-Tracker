// @vitest-environment jsdom
/**
 * PlayerEditorView.test.jsx — orchestrator integration (PEO-2 + regression)
 *
 * Regression guard: after a successful save, `loadAllPlayers` MUST be called
 * so the in-memory `allPlayers` reducer state reflects the new record.
 * Without this, the picker + PlayersView show stale "No players yet" state
 * immediately after the editor closes. This bug was caught by Playwright
 * visual verification post-PEO-3 cutover; keep this test forever.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/react';

vi.mock('../../../../utils/errorHandler', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), action: vi.fn() },
  DEBUG: false,
  AppError: class AppError extends Error {},
  ERROR_CODES: { INVALID_INPUT: 'E201' },
}));

// ---- Context + persistence mocks ---------------------------------------
const mockUI = {
  editorContext: { mode: 'create', seatContext: null, prevScreen: 'players' },
  closePlayerEditor: vi.fn(),
};

const mockPlayer = {
  allPlayers: [],
  assignPlayerToSeat: vi.fn(),
  linkPlayerToPriorHandsInSession: vi.fn(() => Promise.resolve({ handIds: [], undoToken: 'n' })),
  undoRetroactiveLink: vi.fn(),
  loadAllPlayers: vi.fn(() => Promise.resolve()),
};

const mockToast = { addToast: vi.fn() };

vi.mock('../../../../contexts/UIContext', () => ({
  useUI: () => mockUI,
}));
vi.mock('../../../../contexts/PlayerContext', () => ({
  usePlayer: () => mockPlayer,
}));
vi.mock('../../../../contexts/ToastContext', () => ({
  useToast: () => mockToast,
}));

// Mock the editor hook so the view's save button triggers onSaveComplete
// deterministically without wiring the full persistence stack.
vi.mock('../../../../hooks/usePlayerEditor', () => ({
  usePlayerEditor: ({ onSaveComplete, editorContext }) => ({
    fields: {
      name: 'Mike',
      nickname: '',
      avatarFeatures: { skin: 'skin.medium' },
      notes: '',
      hat: false,
      sunglasses: false,
      avatar: '',
    },
    isDraftLoading: false,
    draftBanner: null,
    resumeDraft: vi.fn(),
    discardDraft: vi.fn(),
    updateField: vi.fn(),
    updateAvatarFeature: vi.fn(),
    duplicate: null,
    isSaving: false,
    saveError: null,
    save: vi.fn(async () => {
      // Simulate a successful save
      await onSaveComplete({
        mode: editorContext.mode,
        playerId: 42,
        seatContext: editorContext.seatContext,
      });
      return 42;
    }),
    flushPendingDraft: vi.fn(() => Promise.resolve()),
  }),
  DEFAULT_FIELDS: {},
  normalizeFields: (x) => x,
}));

// Avatar renderer is heavy; stub it out — we're testing orchestration.
vi.mock('../../../ui/PlayerAvatar', () => ({
  default: () => <div data-testid="player-avatar" />,
}));

import { PlayerEditorView } from '../PlayerEditorView';

describe('<PlayerEditorView /> — save lifecycle regression guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUI.editorContext = { mode: 'create', seatContext: null, prevScreen: 'players' };
  });

  it('calls loadAllPlayers after save completes (prevents stale allPlayers bug)', async () => {
    const { getByTestId } = render(<PlayerEditorView />);

    fireEvent.click(getByTestId('save-player-btn'));

    await waitFor(() => {
      expect(mockPlayer.loadAllPlayers).toHaveBeenCalled();
    });
  });

  it('loadAllPlayers runs before closePlayerEditor on create path', async () => {
    const callOrder = [];
    mockPlayer.loadAllPlayers.mockImplementationOnce(async () => { callOrder.push('load'); });
    mockUI.closePlayerEditor.mockImplementationOnce(() => { callOrder.push('close'); });

    const { getByTestId } = render(<PlayerEditorView />);
    fireEvent.click(getByTestId('save-player-btn'));

    await waitFor(() => {
      expect(callOrder).toEqual(['load', 'close']);
    });
  });

  it('loadAllPlayers also runs on edit path', async () => {
    mockUI.editorContext = { mode: 'edit', playerId: 7, prevScreen: 'players' };
    const { getByTestId } = render(<PlayerEditorView />);
    fireEvent.click(getByTestId('save-player-btn'));
    await waitFor(() => {
      expect(mockPlayer.loadAllPlayers).toHaveBeenCalled();
    });
  });

  it('still closes editor if loadAllPlayers throws (non-fatal)', async () => {
    mockPlayer.loadAllPlayers.mockImplementationOnce(() => Promise.reject(new Error('db hiccup')));
    const { getByTestId } = render(<PlayerEditorView />);
    fireEvent.click(getByTestId('save-player-btn'));
    await waitFor(() => {
      expect(mockUI.closePlayerEditor).toHaveBeenCalled();
    });
  });

  it('with seatContext present, calls assignPlayerToSeat + linkPlayerToPriorHandsInSession', async () => {
    mockUI.editorContext = {
      mode: 'create',
      seatContext: { seat: 3, sessionId: 42 },
      prevScreen: 'table',
    };
    const { getByTestId } = render(<PlayerEditorView />);
    fireEvent.click(getByTestId('save-player-btn'));
    await waitFor(() => {
      expect(mockPlayer.assignPlayerToSeat).toHaveBeenCalledWith(3, 42);
      expect(mockPlayer.linkPlayerToPriorHandsInSession).toHaveBeenCalledWith(3, 42, 42);
    });
  });

  it('does not call assignPlayerToSeat when no seatContext (PlayersView create path)', async () => {
    mockUI.editorContext = { mode: 'create', seatContext: null, prevScreen: 'players' };
    const { getByTestId } = render(<PlayerEditorView />);
    fireEvent.click(getByTestId('save-player-btn'));
    await waitFor(() => {
      expect(mockUI.closePlayerEditor).toHaveBeenCalled();
    });
    expect(mockPlayer.assignPlayerToSeat).not.toHaveBeenCalled();
  });
});
