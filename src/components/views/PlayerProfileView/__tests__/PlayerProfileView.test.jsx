// @vitest-environment jsdom
/**
 * @file Tests for PlayerProfileView — render, fallback, navigation.
 * Per WS-162 / SPR-035.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { PlayerProfileView } from '../PlayerProfileView';

afterEach(() => cleanup());

const mockUI = vi.hoisted(() => ({
  current: {
    profilePlayerId: null,
    closePlayerProfile: vi.fn(),
    openPlayerEditor: vi.fn(),
  },
}));

const mockPlayer = vi.hoisted(() => ({
  current: {
    getPlayerById: vi.fn(),
  },
}));

const mockSightings = vi.hoisted(() => ({ records: [] }));

vi.mock('../../../../contexts', () => ({
  useUI: () => mockUI.current,
  usePlayer: () => mockPlayer.current,
  useSession: () => ({ currentSession: null }),
}));

vi.mock('../../../../utils/persistence/sightingLogsStore', () => ({
  getSightingsForPlayer: async () => mockSightings.records,
  appendSighting: async () => 1,
}));

beforeEach(() => {
  mockUI.current.profilePlayerId = null;
  mockUI.current.closePlayerProfile = vi.fn();
  mockUI.current.openPlayerEditor = vi.fn();
  mockPlayer.current.getPlayerById = vi.fn();
  mockSightings.records = [];
});

describe('PlayerProfileView — missing player', () => {
  it('renders fallback when profilePlayerId is null', () => {
    mockUI.current.profilePlayerId = null;
    render(<PlayerProfileView />);
    expect(screen.getByTestId('player-profile-missing')).toBeDefined();
  });

  it('renders fallback when player not found', () => {
    mockUI.current.profilePlayerId = 'p999';
    mockPlayer.current.getPlayerById = vi.fn(() => null);
    render(<PlayerProfileView />);
    expect(screen.getByTestId('player-profile-missing')).toBeDefined();
    expect(screen.getByTestId('player-profile-missing').textContent).toMatch(/p999/);
  });

  it('back button on fallback calls closePlayerProfile', () => {
    mockUI.current.profilePlayerId = 'p1';
    mockPlayer.current.getPlayerById = vi.fn(() => null);
    render(<PlayerProfileView />);
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockUI.current.closePlayerProfile).toHaveBeenCalledTimes(1);
  });
});

describe('PlayerProfileView — full render', () => {
  const stockPlayer = {
    playerId: 'p1',
    name: 'Test Player',
    nickname: null,
    lastSeenAt: 1700000000000,
    ageDecade: '30s',
    ethnicityTags: ['Hispanic'],
    wardrobe: ['black-hoodie'],
    jewelry: [],
    logo: [],
  };

  beforeEach(() => {
    mockUI.current.profilePlayerId = 'p1';
    mockPlayer.current.getPlayerById = vi.fn(() => stockPlayer);
  });

  it('renders header with name + last seen + edit button', async () => {
    render(<PlayerProfileView />);
    await waitFor(() => {
      expect(screen.getByTestId('player-profile-view')).toBeDefined();
    });
    expect(screen.getByTestId('player-profile-name').textContent).toMatch(/Test Player/);
    expect(screen.getByTestId('player-profile-edit-button')).toBeDefined();
  });

  it('back button calls closePlayerProfile', async () => {
    render(<PlayerProfileView />);
    await waitFor(() => screen.getByTestId('player-profile-view'));
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(mockUI.current.closePlayerProfile).toHaveBeenCalledTimes(1);
  });

  it('edit button calls openPlayerEditor with mode=edit + playerId', async () => {
    render(<PlayerProfileView />);
    await waitFor(() => screen.getByTestId('player-profile-edit-button'));
    fireEvent.click(screen.getByTestId('player-profile-edit-button'));
    expect(mockUI.current.openPlayerEditor).toHaveBeenCalledWith({ mode: 'edit', playerId: 'p1' });
  });

  it('renders attribute stability rows for the 5 PIO attributes', async () => {
    render(<PlayerProfileView />);
    await waitFor(() => screen.getByTestId('player-profile-stability'));
    expect(screen.getByTestId('player-profile-stability-row-ageDecade')).toBeDefined();
    expect(screen.getByTestId('player-profile-stability-row-ethnicityTags')).toBeDefined();
    expect(screen.getByTestId('player-profile-stability-row-wardrobe')).toBeDefined();
    expect(screen.getByTestId('player-profile-stability-row-jewelry')).toBeDefined();
    expect(screen.getByTestId('player-profile-stability-row-logo')).toBeDefined();
  });

  it('renders empty sighting history when no sightings', async () => {
    mockSightings.records = [];
    render(<PlayerProfileView />);
    await waitFor(() => screen.getByTestId('player-profile-sighting-empty'));
    expect(screen.getByTestId('player-profile-sighting-empty').textContent).toMatch(/No sightings/i);
  });

  it('renders sighting history when records present', async () => {
    mockSightings.records = [
      {
        sightingId: 1,
        playerId: 'p1',
        capturedAt: 1700000000000,
        venueId: 'v1',
        featuresSeen: ['ageDecade', 'wardrobe'],
        attributes: { ageDecade: '30s', wardrobe: ['black-hoodie'] },
      },
    ];
    render(<PlayerProfileView />);
    await waitFor(() => {
      const rows = screen.queryAllByTestId('player-profile-sighting-row');
      expect(rows.length).toBe(1);
    });
  });

  it('add-sighting affordance opens the modal', async () => {
    render(<PlayerProfileView />);
    await waitFor(() => screen.getByTestId('player-profile-add-sighting'));
    fireEvent.click(screen.getByTestId('player-profile-add-sighting'));
    expect(screen.getByTestId('add-sighting-modal')).toBeDefined();
  });
});

describe('PlayerProfileView — autonomy red line #5 (no shame copy)', () => {
  it('shell copy never contains rank labels or shame patterns', async () => {
    mockUI.current.profilePlayerId = 'p1';
    mockPlayer.current.getPlayerById = vi.fn(() => ({
      playerId: 'p1',
      name: 'A',
      ageDecade: '30s',
      ethnicityTags: [],
      wardrobe: [],
      jewelry: [],
      logo: [],
    }));
    render(<PlayerProfileView />);
    await waitFor(() => screen.getByTestId('player-profile-view'));
    const text = screen.getByTestId('player-profile-view').textContent || '';
    expect(text).not.toMatch(/wrong/i);
    expect(text).not.toMatch(/missed/i);
    expect(text).not.toMatch(/are you sure/i);
    expect(text).not.toMatch(/great job/i);
  });
});
