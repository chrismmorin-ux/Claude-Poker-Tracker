// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePlayerPicker } from '../usePlayerPicker';

const players = [
  { playerId: 1, name: 'Mike', lastSeenAt: 3000, avatarFeatures: { beard: 'beard.goatee' } },
  { playerId: 2, name: 'Marcus', lastSeenAt: 2000, avatarFeatures: { beard: 'beard.full' } },
  { playerId: 3, name: 'Alice', lastSeenAt: 4000, avatarFeatures: { hair: 'hair.long' } },
  { playerId: 4, name: 'Michael', nickname: 'Mikey', lastSeenAt: 1000, avatarFeatures: { beard: 'beard.goatee' } },
];

describe('usePlayerPicker — results', () => {
  it('returns all players sorted by lastSeen desc when no filters', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    expect(result.current.results.map(r => r.player.playerId)).toEqual([3, 1, 2, 4]);
  });

  it('filters by name prefix case-insensitively', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => { result.current.setNameQuery('Mi'); });
    const ids = result.current.results.map(r => r.player.playerId);
    // Mike (3000), Michael (1000), plus Mikey (nickname) matches as Michael
    expect(ids).toContain(1);
    expect(ids).toContain(4);
    expect(ids).not.toContain(3);  // Alice — no prefix match
    expect(ids).not.toContain(2);  // Marcus — Mi is prefix, should match!
  });

  it('prefix match includes every name starting with the query', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => { result.current.setNameQuery('Ma'); });
    expect(result.current.results.map(r => r.player.playerId)).toEqual([2]); // Marcus
  });

  it('applies feature filter', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => { result.current.setFeatureFilter('beard', 'beard.goatee'); });
    expect(result.current.results.map(r => r.player.playerId).sort()).toEqual([1, 4]);
  });

  it('combines name + feature filters with AND semantics', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => {
      result.current.setNameQuery('Mi');
      result.current.setFeatureFilter('beard', 'beard.goatee');
    });
    // Both Mike and Michael start with "Mi" and have goatee
    expect(result.current.results.map(r => r.player.playerId).sort()).toEqual([1, 4]);
  });

  it('clearing feature filter removes it', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => {
      result.current.setFeatureFilter('beard', 'beard.goatee');
    });
    expect(result.current.results.length).toBe(2);
    act(() => { result.current.setFeatureFilter('beard', ''); });
    expect(result.current.results.length).toBe(4);
  });

  it('clearAll resets name query and all feature filters', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => {
      result.current.setNameQuery('Mi');
      result.current.setFeatureFilter('beard', 'beard.goatee');
    });
    expect(result.current.hasActiveFilters).toBe(true);
    act(() => { result.current.clearAll(); });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.results.length).toBe(4);
  });

  it('each result carries score metadata for highlighting', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => { result.current.setNameQuery('Mi'); });
    const mike = result.current.results.find(r => r.player.name === 'Mike');
    expect(mike.score.nameMatchStart).toBe(0);
    expect(mike.score.nameMatchEnd).toBe(2);
  });
});

describe('usePlayerPicker — batch mode', () => {
  it('starts inactive by default', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    expect(result.current.batchMode.active).toBe(false);
  });

  it('enterBatchMode activates with empty assignedSeats', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => { result.current.enterBatchMode(); });
    expect(result.current.batchMode.active).toBe(true);
    expect(result.current.batchMode.assignedSeats).toEqual([]);
  });

  it('exitBatchMode deactivates and clears assignedSeats', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => {
      result.current.enterBatchMode();
      result.current.markSeatAssigned(3);
    });
    act(() => { result.current.exitBatchMode(); });
    expect(result.current.batchMode.active).toBe(false);
    expect(result.current.batchMode.assignedSeats).toEqual([]);
  });

  it('markSeatAssigned ignores duplicates', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => {
      result.current.enterBatchMode();
      result.current.markSeatAssigned(3);
      result.current.markSeatAssigned(3);
    });
    expect(result.current.batchMode.assignedSeats).toEqual([3]);
  });

  it('batch mode ends when all 9 seats are assigned', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => { result.current.enterBatchMode(); });
    for (let s = 1; s <= 9; s += 1) {
      act(() => { result.current.markSeatAssigned(s); });
    }
    expect(result.current.batchMode.active).toBe(false);
  });

  it('nextUnassignedSeat returns lowest unassigned seat', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => {
      result.current.enterBatchMode();
      result.current.markSeatAssigned(1);
      result.current.markSeatAssigned(2);
      result.current.markSeatAssigned(4);
    });
    expect(result.current.nextUnassignedSeat()).toBe(3);
  });

  it('nextUnassignedSeat with justAssigned skips that seat', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => {
      result.current.enterBatchMode();
      result.current.markSeatAssigned(1);
    });
    expect(result.current.nextUnassignedSeat(2)).toBe(3);
  });

  it('nextUnassignedSeat returns null when batch not active', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    expect(result.current.nextUnassignedSeat()).toBeNull();
  });

  it('onAssignmentComplete advances to next seat in batch mode', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players, initialSeat: 3 }));
    act(() => { result.current.enterBatchMode(); });
    let response;
    act(() => { response = result.current.onAssignmentComplete(3); });
    expect(response.batchDone).toBe(false);
    expect(response.nextSeat).toBe(1);
    expect(result.current.currentSeat).toBe(1);
    // Query cleared for next seat
    expect(result.current.nameQuery).toBe('');
  });

  it('onAssignmentComplete returns batchDone=true when no more seats', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    act(() => { result.current.enterBatchMode(); });
    // Assign seats 1-8; then onAssignmentComplete(9) leaves no more.
    for (let s = 1; s <= 8; s += 1) {
      act(() => { result.current.markSeatAssigned(s); });
    }
    let response;
    act(() => { response = result.current.onAssignmentComplete(9); });
    expect(response.batchDone).toBe(true);
    expect(response.nextSeat).toBeNull();
  });

  it('onAssignmentComplete with batch inactive returns batchDone=true', () => {
    const { result } = renderHook(() => usePlayerPicker({ allPlayers: players }));
    let response;
    act(() => { response = result.current.onAssignmentComplete(3); });
    expect(response.batchDone).toBe(true);
    expect(response.nextSeat).toBeNull();
  });
});
