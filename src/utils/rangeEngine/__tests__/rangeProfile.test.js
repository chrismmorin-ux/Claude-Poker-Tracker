import { describe, it, expect } from 'vitest';
import {
  PROFILE_VERSION,
  RANGE_ACTIONS,
  RANGE_POSITIONS,
  createEmptyProfile,
  serializeProfile,
  deserializeProfile,
} from '../rangeProfile';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('PROFILE_VERSION', () => {
  it('equals 3', () => {
    expect(PROFILE_VERSION).toBe(3);
  });
});

describe('RANGE_ACTIONS', () => {
  it('contains exactly 5 actions', () => {
    expect(RANGE_ACTIONS).toHaveLength(5);
  });

  it('contains fold', () => {
    expect(RANGE_ACTIONS).toContain('fold');
  });

  it('contains limp', () => {
    expect(RANGE_ACTIONS).toContain('limp');
  });

  it('contains open', () => {
    expect(RANGE_ACTIONS).toContain('open');
  });

  it('contains coldCall', () => {
    expect(RANGE_ACTIONS).toContain('coldCall');
  });

  it('contains threeBet', () => {
    expect(RANGE_ACTIONS).toContain('threeBet');
  });
});

describe('RANGE_POSITIONS', () => {
  it('contains exactly 5 positions', () => {
    expect(RANGE_POSITIONS).toHaveLength(5);
  });

  it('contains EARLY', () => {
    expect(RANGE_POSITIONS).toContain('EARLY');
  });

  it('contains MIDDLE', () => {
    expect(RANGE_POSITIONS).toContain('MIDDLE');
  });

  it('contains LATE', () => {
    expect(RANGE_POSITIONS).toContain('LATE');
  });

  it('contains SB', () => {
    expect(RANGE_POSITIONS).toContain('SB');
  });

  it('contains BB', () => {
    expect(RANGE_POSITIONS).toContain('BB');
  });
});

// ---------------------------------------------------------------------------
// createEmptyProfile
// ---------------------------------------------------------------------------

describe('createEmptyProfile', () => {
  it('returns an object with playerId matching the argument', () => {
    const profile = createEmptyProfile(42, 'user-1');
    expect(profile.playerId).toBe(42);
  });

  it('returns an object with userId matching the argument', () => {
    const profile = createEmptyProfile(42, 'user-1');
    expect(profile.userId).toBe('user-1');
  });

  it('formats profileKey as userId_playerId', () => {
    const profile = createEmptyProfile(99, 'alice');
    expect(profile.profileKey).toBe('alice_99');
  });

  it('formats profileKey correctly when playerId is a string', () => {
    const profile = createEmptyProfile('seat5', 'bob');
    expect(profile.profileKey).toBe('bob_seat5');
  });

  it('sets handsProcessed to 0', () => {
    const profile = createEmptyProfile(1, 'u');
    expect(profile.handsProcessed).toBe(0);
  });

  it('sets profileVersion to PROFILE_VERSION', () => {
    const profile = createEmptyProfile(1, 'u');
    expect(profile.profileVersion).toBe(PROFILE_VERSION);
  });

  it('sets traits to null', () => {
    const profile = createEmptyProfile(1, 'u');
    expect(profile.traits).toBeNull();
  });

  it('sets showdownAnchors to an empty array', () => {
    const profile = createEmptyProfile(1, 'u');
    expect(profile.showdownAnchors).toEqual([]);
  });

  it('sets lastUpdatedAt to a recent timestamp', () => {
    const before = Date.now();
    const profile = createEmptyProfile(1, 'u');
    const after = Date.now();
    expect(profile.lastUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(profile.lastUpdatedAt).toBeLessThanOrEqual(after);
  });

  describe('actionCounts shape', () => {
    it('has an actionCounts entry for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.actionCounts).toHaveProperty(pos);
      }
    });

    it('has an actionCounts entry for every action within each position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        for (const action of RANGE_ACTIONS) {
          expect(profile.actionCounts[pos]).toHaveProperty(action);
        }
      }
    });

    it('initialises every actionCount to 0', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        for (const action of RANGE_ACTIONS) {
          expect(profile.actionCounts[pos][action]).toBe(0);
        }
      }
    });
  });

  describe('opportunities shape', () => {
    it('has an opportunities entry for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.opportunities).toHaveProperty(pos);
      }
    });

    it('initialises noRaiseFaced to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.opportunities[pos].noRaiseFaced).toBe(0);
      }
    });

    it('initialises facedRaise to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.opportunities[pos].facedRaise).toBe(0);
      }
    });

    it('initialises total to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.opportunities[pos].total).toBe(0);
      }
    });

    it('initialises showdownsSeen to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.opportunities[pos].showdownsSeen).toBe(0);
      }
    });
  });

  describe('ranges shape', () => {
    it('has a ranges entry for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.ranges).toHaveProperty(pos);
      }
    });

    it('has a Float64Array for every position/action combination', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        for (const action of RANGE_ACTIONS) {
          expect(profile.ranges[pos][action]).toBeInstanceOf(Float64Array);
        }
      }
    });

    it('each Float64Array has length 169', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        for (const action of RANGE_ACTIONS) {
          expect(profile.ranges[pos][action]).toHaveLength(169);
        }
      }
    });

    it('all grid cells are initialised to 0', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        for (const action of RANGE_ACTIONS) {
          const grid = profile.ranges[pos][action];
          expect(grid.every(v => v === 0)).toBe(true);
        }
      }
    });
  });

  describe('subActionCounts shape', () => {
    it('has a subActionCounts entry for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.subActionCounts).toHaveProperty(pos);
      }
    });

    it('initialises limpFold to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.subActionCounts[pos].limpFold).toBe(0);
      }
    });

    it('initialises limpCall to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.subActionCounts[pos].limpCall).toBe(0);
      }
    });

    it('initialises limpRaise to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.subActionCounts[pos].limpRaise).toBe(0);
      }
    });

    it('initialises limpNoRaise to 0 for every position', () => {
      const profile = createEmptyProfile(1, 'u');
      for (const pos of RANGE_POSITIONS) {
        expect(profile.subActionCounts[pos].limpNoRaise).toBe(0);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// serializeProfile
// ---------------------------------------------------------------------------

describe('serializeProfile', () => {
  it('converts every Float64Array range to a plain Array', () => {
    const profile = createEmptyProfile(1, 'u');
    const serialized = serializeProfile(profile);
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(Array.isArray(serialized.ranges[pos][action])).toBe(true);
        expect(serialized.ranges[pos][action]).not.toBeInstanceOf(Float64Array);
      }
    }
  });

  it('each serialized range has length 169', () => {
    const profile = createEmptyProfile(1, 'u');
    const serialized = serializeProfile(profile);
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(serialized.ranges[pos][action]).toHaveLength(169);
      }
    }
  });

  it('preserves non-range fields unchanged', () => {
    const profile = createEmptyProfile(7, 'user-xyz');
    const serialized = serializeProfile(profile);
    expect(serialized.playerId).toBe(7);
    expect(serialized.userId).toBe('user-xyz');
    expect(serialized.profileKey).toBe('user-xyz_7');
    expect(serialized.handsProcessed).toBe(0);
    expect(serialized.profileVersion).toBe(PROFILE_VERSION);
    expect(serialized.traits).toBeNull();
    expect(serialized.showdownAnchors).toEqual([]);
  });

  it('preserves non-zero values written into a range grid', () => {
    const profile = createEmptyProfile(1, 'u');
    profile.ranges['EARLY']['open'][0] = 0.75;
    profile.ranges['BB']['threeBet'][168] = 0.5;
    const serialized = serializeProfile(profile);
    expect(serialized.ranges['EARLY']['open'][0]).toBe(0.75);
    expect(serialized.ranges['BB']['threeBet'][168]).toBe(0.5);
  });

  it('does not mutate the original profile', () => {
    const profile = createEmptyProfile(1, 'u');
    serializeProfile(profile);
    expect(profile.ranges['EARLY']['open']).toBeInstanceOf(Float64Array);
  });
});

// ---------------------------------------------------------------------------
// deserializeProfile
// ---------------------------------------------------------------------------

describe('deserializeProfile', () => {
  it('converts every plain Array range back to a Float64Array', () => {
    const profile = createEmptyProfile(1, 'u');
    const serialized = serializeProfile(profile);
    const restored = deserializeProfile(serialized);
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(restored.ranges[pos][action]).toBeInstanceOf(Float64Array);
      }
    }
  });

  it('each restored Float64Array has length 169', () => {
    const profile = createEmptyProfile(1, 'u');
    const serialized = serializeProfile(profile);
    const restored = deserializeProfile(serialized);
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(restored.ranges[pos][action]).toHaveLength(169);
      }
    }
  });

  it('preserves non-range fields through the full round-trip', () => {
    const profile = createEmptyProfile(55, 'carol');
    const restored = deserializeProfile(serializeProfile(profile));
    expect(restored.playerId).toBe(55);
    expect(restored.userId).toBe('carol');
    expect(restored.profileKey).toBe('carol_55');
    expect(restored.handsProcessed).toBe(0);
    expect(restored.profileVersion).toBe(PROFILE_VERSION);
    expect(restored.traits).toBeNull();
    expect(restored.showdownAnchors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Serialize / deserialize round-trip
// ---------------------------------------------------------------------------

describe('serialize/deserialize round-trip', () => {
  it('preserves all-zero grids', () => {
    const profile = createEmptyProfile(1, 'u');
    const restored = deserializeProfile(serializeProfile(profile));
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        expect(restored.ranges[pos][action].every(v => v === 0)).toBe(true);
      }
    }
  });

  it('preserves a single non-zero cell written before serialization', () => {
    const profile = createEmptyProfile(1, 'u');
    profile.ranges['MIDDLE']['limp'][42] = 0.9;
    const restored = deserializeProfile(serializeProfile(profile));
    expect(restored.ranges['MIDDLE']['limp'][42]).toBeCloseTo(0.9, 10);
  });

  it('preserves non-zero values across every position and action', () => {
    const profile = createEmptyProfile(1, 'u');
    let cellIndex = 0;
    const expected = {};
    for (const pos of RANGE_POSITIONS) {
      expected[pos] = {};
      for (const action of RANGE_ACTIONS) {
        const value = (cellIndex % 169) * 0.001;
        profile.ranges[pos][action][cellIndex % 169] = value;
        expected[pos][action] = { index: cellIndex % 169, value };
        cellIndex += 13;
      }
    }
    const restored = deserializeProfile(serializeProfile(profile));
    for (const pos of RANGE_POSITIONS) {
      for (const action of RANGE_ACTIONS) {
        const { index, value } = expected[pos][action];
        expect(restored.ranges[pos][action][index]).toBeCloseTo(value, 10);
      }
    }
  });

  it('preserves actionCounts through round-trip', () => {
    const profile = createEmptyProfile(1, 'u');
    profile.actionCounts['LATE']['open'] = 7;
    const restored = deserializeProfile(serializeProfile(profile));
    expect(restored.actionCounts['LATE']['open']).toBe(7);
  });

  it('preserves opportunities through round-trip', () => {
    const profile = createEmptyProfile(1, 'u');
    profile.opportunities['SB'].noRaiseFaced = 12;
    profile.opportunities['SB'].facedRaise = 3;
    const restored = deserializeProfile(serializeProfile(profile));
    expect(restored.opportunities['SB'].noRaiseFaced).toBe(12);
    expect(restored.opportunities['SB'].facedRaise).toBe(3);
  });

  it('preserves subActionCounts through round-trip', () => {
    const profile = createEmptyProfile(1, 'u');
    profile.subActionCounts['BB'].limpCall = 5;
    const restored = deserializeProfile(serializeProfile(profile));
    expect(restored.subActionCounts['BB'].limpCall).toBe(5);
  });

  it('preserves showdownAnchors through round-trip', () => {
    const profile = createEmptyProfile(1, 'u');
    profile.showdownAnchors.push({ handIndex: 10, action: 'open', pos: 'EARLY' });
    const restored = deserializeProfile(serializeProfile(profile));
    expect(restored.showdownAnchors).toHaveLength(1);
    expect(restored.showdownAnchors[0].handIndex).toBe(10);
  });

  it('produces independent Float64Arrays — mutating the restored profile does not affect re-deserialization', () => {
    const profile = createEmptyProfile(1, 'u');
    const serialized = serializeProfile(profile);
    const restored = deserializeProfile(serialized);
    restored.ranges['EARLY']['fold'][0] = 99;
    // Re-deserialize from the same serialized record (unchanged)
    const restored2 = deserializeProfile(serialized);
    expect(restored2.ranges['EARLY']['fold'][0]).toBe(0);
  });
});
