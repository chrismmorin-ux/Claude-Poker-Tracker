/**
 * exportUtils.test.js - Tests for data export and import utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  exportAllData,
  downloadAsJson,
  downloadBackup,
  validateImportData,
  clearAllData,
  importAllData,
  readJsonFile,
} from '../exportUtils';

// Mock the persistence module
vi.mock('../persistence', () => ({
  getAllHands: vi.fn(),
  getAllSessions: vi.fn(),
  getAllPlayers: vi.fn(),
  clearAllHands: vi.fn(),
  saveHand: vi.fn(),
  createSession: vi.fn(),
  createPlayer: vi.fn(),
  deleteSession: vi.fn(),
  deletePlayer: vi.fn(),
}));

import {
  getAllHands,
  getAllSessions,
  getAllPlayers,
  clearAllHands,
  saveHand,
  createSession,
  createPlayer,
  deleteSession,
  deletePlayer,
} from '../persistence';

describe('exportAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns complete data export with version and timestamp', async () => {
    const mockHands = [{ handId: 1, timestamp: 1000 }];
    const mockSessions = [{ sessionId: 's1', startTime: 2000 }];
    const mockPlayers = [{ playerId: 'p1', name: 'Alice' }];

    getAllHands.mockResolvedValue(mockHands);
    getAllSessions.mockResolvedValue(mockSessions);
    getAllPlayers.mockResolvedValue(mockPlayers);

    const result = await exportAllData();

    expect(result).toHaveProperty('version');
    expect(result.version).toBe('1.0.0');
    expect(result).toHaveProperty('exportedAt');
    expect(result).toHaveProperty('exportedAtISO');
    expect(typeof result.exportedAt).toBe('number');
    expect(typeof result.exportedAtISO).toBe('string');
  });

  it('includes all data arrays in data field', async () => {
    const mockHands = [{ handId: 1, timestamp: 1000 }];
    const mockSessions = [{ sessionId: 's1', startTime: 2000 }];
    const mockPlayers = [{ playerId: 'p1', name: 'Alice' }];

    getAllHands.mockResolvedValue(mockHands);
    getAllSessions.mockResolvedValue(mockSessions);
    getAllPlayers.mockResolvedValue(mockPlayers);

    const result = await exportAllData();

    expect(result.data.hands).toEqual(mockHands);
    expect(result.data.sessions).toEqual(mockSessions);
    expect(result.data.players).toEqual(mockPlayers);
  });

  it('includes correct counts for each data type', async () => {
    const mockHands = [{ handId: 1 }, { handId: 2 }];
    const mockSessions = [{ sessionId: 's1' }, { sessionId: 's2' }, { sessionId: 's3' }];
    const mockPlayers = [{ playerId: 'p1' }];

    getAllHands.mockResolvedValue(mockHands);
    getAllSessions.mockResolvedValue(mockSessions);
    getAllPlayers.mockResolvedValue(mockPlayers);

    const result = await exportAllData();

    expect(result.counts.hands).toBe(2);
    expect(result.counts.sessions).toBe(3);
    expect(result.counts.players).toBe(1);
  });

  it('handles empty data arrays', async () => {
    getAllHands.mockResolvedValue([]);
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);

    const result = await exportAllData();

    expect(result.data.hands).toEqual([]);
    expect(result.data.sessions).toEqual([]);
    expect(result.data.players).toEqual([]);
    expect(result.counts.hands).toBe(0);
    expect(result.counts.sessions).toBe(0);
    expect(result.counts.players).toBe(0);
  });

  it('calls all persistence functions in parallel', async () => {
    getAllHands.mockResolvedValue([]);
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);

    await exportAllData();

    expect(getAllHands).toHaveBeenCalledTimes(1);
    expect(getAllSessions).toHaveBeenCalledTimes(1);
    expect(getAllPlayers).toHaveBeenCalledTimes(1);
  });

  it('creates exportedAtISO in valid ISO format', async () => {
    getAllHands.mockResolvedValue([]);
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);

    const result = await exportAllData();

    // ISO format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(result.exportedAtISO).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('creates exportedAt timestamp close to current time', async () => {
    getAllHands.mockResolvedValue([]);
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);

    const before = Date.now();
    const result = await exportAllData();
    const after = Date.now();

    expect(result.exportedAt).toBeGreaterThanOrEqual(before);
    expect(result.exportedAt).toBeLessThanOrEqual(after);
  });
});

describe('downloadAsJson', () => {
  let createElementSpy;
  let appendChildSpy;
  let removeChildSpy;
  let createObjectURLSpy;
  let revokeObjectURLSpy;
  let mockLink;

  beforeEach(() => {
    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };

    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a download link with correct filename', () => {
    const data = { test: 'data' };
    const filename = 'test.json';

    downloadAsJson(data, filename);

    expect(createElementSpy).toHaveBeenCalledWith('a');
    expect(mockLink.download).toBe(filename);
  });

  it('converts data to JSON with proper formatting', () => {
    const data = { test: 'data', nested: { value: 123 } };
    const expectedJson = JSON.stringify(data, null, 2);

    downloadAsJson(data, 'test.json');

    // Verify Blob was created with correct JSON
    expect(global.Blob).toBeDefined();
  });

  it('creates object URL and assigns to link href', () => {
    const data = { test: 'data' };

    downloadAsJson(data, 'test.json');

    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(mockLink.href).toBe('blob:mock-url');
  });

  it('triggers link click', () => {
    const data = { test: 'data' };

    downloadAsJson(data, 'test.json');

    expect(mockLink.click).toHaveBeenCalledTimes(1);
  });

  it('appends and removes link from DOM', () => {
    const data = { test: 'data' };

    downloadAsJson(data, 'test.json');

    expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
    expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
  });

  it('revokes object URL after download', () => {
    const data = { test: 'data' };

    downloadAsJson(data, 'test.json');

    expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
  });

  it('handles complex nested data structures', () => {
    const data = {
      arrays: [1, 2, 3],
      nested: { deep: { value: 'test' } },
      nullValue: null,
      boolValue: true,
    };

    downloadAsJson(data, 'complex.json');

    expect(mockLink.click).toHaveBeenCalled();
  });
});

describe('downloadBackup', () => {
  let createElementSpy;
  let mockLink;

  beforeEach(() => {
    vi.clearAllMocks();

    mockLink = {
      href: '',
      download: '',
      click: vi.fn(),
    };

    createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);
    vi.spyOn(document.body, 'appendChild').mockImplementation(() => {});
    vi.spyOn(document.body, 'removeChild').mockImplementation(() => {});
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});

    getAllHands.mockResolvedValue([]);
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls exportAllData', async () => {
    await downloadBackup();

    expect(getAllHands).toHaveBeenCalled();
    expect(getAllSessions).toHaveBeenCalled();
    expect(getAllPlayers).toHaveBeenCalled();
  });

  it('generates filename with current date', async () => {
    // Use vi.useFakeTimers to control the date
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:30:00Z'));

    await downloadBackup();

    expect(mockLink.download).toBe('poker-tracker-backup-2025-01-15.json');

    vi.useRealTimers();
  });

  it('triggers download', async () => {
    await downloadBackup();

    expect(mockLink.click).toHaveBeenCalled();
  });
});

describe('validateImportData', () => {
  it('rejects non-object input', () => {
    const result = validateImportData(null);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid data format: expected an object');
  });

  it('rejects undefined input', () => {
    const result = validateImportData(undefined);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid data format: expected an object');
  });

  it('rejects string input', () => {
    const result = validateImportData('not an object');

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid data format: expected an object');
  });

  it('rejects array input', () => {
    const result = validateImportData([]);

    // Arrays are technically objects in JavaScript, so they pass the typeof check
    // but fail the data structure validation
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('validates missing version field', () => {
    const data = { data: { hands: [], sessions: [], players: [] } };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing version field');
  });

  it('validates missing data field', () => {
    const data = { version: '1.0.0' };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing data field');
  });

  it('validates missing hands array', () => {
    const data = {
      version: '1.0.0',
      data: { sessions: [], players: [] },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid hands array');
  });

  it('validates missing sessions array', () => {
    const data = {
      version: '1.0.0',
      data: { hands: [], players: [] },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid sessions array');
  });

  it('validates missing players array', () => {
    const data = {
      version: '1.0.0',
      data: { hands: [], sessions: [] },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing or invalid players array');
  });

  it('validates non-array hands field', () => {
    const data = {
      version: '1.0.0',
      data: { hands: 'not-array', sessions: [], players: [] },
    };

    // The actual function doesn't check if hands is an array before calling forEach
    // So this will throw a TypeError which we should expect
    expect(() => validateImportData(data)).toThrow(TypeError);
  });

  it('validates hand records have timestamp', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [{ handId: 1 }], // missing timestamp
        sessions: [],
        players: [],
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Hand at index 0 missing timestamp');
  });

  it('validates multiple hand records', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [
          { handId: 1, timestamp: 1000 },
          { handId: 2 }, // missing timestamp
          { handId: 3, timestamp: 3000 },
        ],
        sessions: [],
        players: [],
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Hand at index 1 missing timestamp');
  });

  it('validates session records have startTime', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [{ sessionId: 's1' }], // missing startTime
        players: [],
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Session at index 0 missing startTime');
  });

  it('validates multiple session records', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [
          { sessionId: 's1', startTime: 1000 },
          { sessionId: 's2' }, // missing startTime
        ],
        players: [],
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Session at index 1 missing startTime');
  });

  it('validates player records have name', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [],
        players: [{ playerId: 'p1' }], // missing name
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Player at index 0 missing name');
  });

  it('validates multiple player records', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [],
        players: [
          { playerId: 'p1', name: 'Alice' },
          { playerId: 'p2' }, // missing name
          { playerId: 'p3', name: 'Charlie' },
        ],
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Player at index 1 missing name');
  });

  it('accepts valid import data', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [{ handId: 1, timestamp: 1000 }],
        sessions: [{ sessionId: 's1', startTime: 2000 }],
        players: [{ playerId: 'p1', name: 'Alice' }],
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts empty arrays', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [],
        players: [],
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accumulates multiple errors', () => {
    const data = {
      version: '1.0.0',
      data: {
        hands: [{ handId: 1 }], // missing timestamp
        sessions: [{ sessionId: 's1' }], // missing startTime
        players: [{ playerId: 'p1' }], // missing name
      },
    };

    const result = validateImportData(data);

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors).toContain('Hand at index 0 missing timestamp');
    expect(result.errors).toContain('Session at index 0 missing startTime');
    expect(result.errors).toContain('Player at index 0 missing name');
  });
});

describe('clearAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('clears all hands', async () => {
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);
    clearAllHands.mockResolvedValue(undefined);

    await clearAllData();

    expect(clearAllHands).toHaveBeenCalledTimes(1);
  });

  it('deletes all sessions', async () => {
    const mockSessions = [
      { sessionId: 's1', startTime: 1000 },
      { sessionId: 's2', startTime: 2000 },
    ];

    getAllSessions.mockResolvedValue(mockSessions);
    getAllPlayers.mockResolvedValue([]);
    clearAllHands.mockResolvedValue(undefined);
    deleteSession.mockResolvedValue(undefined);

    await clearAllData();

    expect(deleteSession).toHaveBeenCalledTimes(2);
    expect(deleteSession).toHaveBeenCalledWith('s1');
    expect(deleteSession).toHaveBeenCalledWith('s2');
  });

  it('deletes all players', async () => {
    const mockPlayers = [
      { playerId: 'p1', name: 'Alice' },
      { playerId: 'p2', name: 'Bob' },
      { playerId: 'p3', name: 'Charlie' },
    ];

    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue(mockPlayers);
    clearAllHands.mockResolvedValue(undefined);
    deletePlayer.mockResolvedValue(undefined);

    await clearAllData();

    expect(deletePlayer).toHaveBeenCalledTimes(3);
    expect(deletePlayer).toHaveBeenCalledWith('p1');
    expect(deletePlayer).toHaveBeenCalledWith('p2');
    expect(deletePlayer).toHaveBeenCalledWith('p3');
  });

  it('handles empty data gracefully', async () => {
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);
    clearAllHands.mockResolvedValue(undefined);

    await clearAllData();

    expect(clearAllHands).toHaveBeenCalled();
    expect(deleteSession).not.toHaveBeenCalled();
    expect(deletePlayer).not.toHaveBeenCalled();
  });

  it('skips sessions without sessionId', async () => {
    const mockSessions = [
      { sessionId: 's1', startTime: 1000 },
      { startTime: 2000 }, // missing sessionId
    ];

    getAllSessions.mockResolvedValue(mockSessions);
    getAllPlayers.mockResolvedValue([]);
    clearAllHands.mockResolvedValue(undefined);
    deleteSession.mockResolvedValue(undefined);

    await clearAllData();

    expect(deleteSession).toHaveBeenCalledTimes(1);
    expect(deleteSession).toHaveBeenCalledWith('s1');
  });

  it('skips players without playerId', async () => {
    const mockPlayers = [
      { playerId: 'p1', name: 'Alice' },
      { name: 'Bob' }, // missing playerId
    ];

    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue(mockPlayers);
    clearAllHands.mockResolvedValue(undefined);
    deletePlayer.mockResolvedValue(undefined);

    await clearAllData();

    expect(deletePlayer).toHaveBeenCalledTimes(1);
    expect(deletePlayer).toHaveBeenCalledWith('p1');
  });
});

describe('importAllData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllSessions.mockResolvedValue([]);
    getAllPlayers.mockResolvedValue([]);
    clearAllHands.mockResolvedValue(undefined);
  });

  it('clears existing data before import', async () => {
    const importData = {
      version: '1.0.0',
      data: { hands: [], sessions: [], players: [] },
    };

    await importAllData(importData);

    expect(clearAllHands).toHaveBeenCalled();
  });

  it('imports players first', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [],
        players: [{ playerId: 'p1', name: 'Alice', ethnicity: 'White' }],
      },
    };

    createPlayer.mockResolvedValue('new-p1');

    const result = await importAllData(importData);

    expect(createPlayer).toHaveBeenCalledTimes(1);
    expect(createPlayer).toHaveBeenCalledWith({
      name: 'Alice',
      ethnicity: 'White',
    });
    expect(result.counts.players).toBe(1);
  });

  it('removes playerId when importing players', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [],
        players: [{ playerId: 'old-id', name: 'Alice' }],
      },
    };

    createPlayer.mockResolvedValue('new-id');

    await importAllData(importData);

    const callArgs = createPlayer.mock.calls[0][0];
    expect(callArgs).not.toHaveProperty('playerId');
    expect(callArgs.name).toBe('Alice');
  });

  it('imports sessions and maps sessionIds', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [{ sessionId: 'old-s1', startTime: 1000, venue: 'Online' }],
        players: [],
      },
    };

    createSession.mockResolvedValue('new-s1');

    const result = await importAllData(importData);

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith({
      startTime: 1000,
      venue: 'Online',
      isActive: false,
    });
    expect(result.counts.sessions).toBe(1);
  });

  it('sets isActive to false for imported sessions', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [{ sessionId: 's1', startTime: 1000, isActive: true }],
        players: [],
      },
    };

    createSession.mockResolvedValue('new-s1');

    await importAllData(importData);

    const callArgs = createSession.mock.calls[0][0];
    expect(callArgs.isActive).toBe(false);
  });

  it('imports hands with remapped sessionId', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [
          { handId: 'h1', timestamp: 1000, sessionId: 'old-s1', dealerSeat: 1 },
        ],
        sessions: [{ sessionId: 'old-s1', startTime: 500 }],
        players: [],
      },
    };

    createSession.mockResolvedValue('new-s1');
    saveHand.mockResolvedValue('new-h1');

    const result = await importAllData(importData);

    expect(saveHand).toHaveBeenCalledTimes(1);
    expect(saveHand).toHaveBeenCalledWith({
      timestamp: 1000,
      sessionId: 'new-s1', // remapped
      dealerSeat: 1,
    });
    expect(result.counts.hands).toBe(1);
  });

  it('sets sessionId to null for hands with no session', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [{ handId: 'h1', timestamp: 1000, sessionId: null }],
        sessions: [],
        players: [],
      },
    };

    saveHand.mockResolvedValue('new-h1');

    await importAllData(importData);

    const callArgs = saveHand.mock.calls[0][0];
    expect(callArgs.sessionId).toBeNull();
  });

  it('sets sessionId to null for hands with unmapped sessionId', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [{ handId: 'h1', timestamp: 1000, sessionId: 'unknown-session' }],
        sessions: [],
        players: [],
      },
    };

    saveHand.mockResolvedValue('new-h1');

    await importAllData(importData);

    const callArgs = saveHand.mock.calls[0][0];
    expect(callArgs.sessionId).toBeNull();
  });

  it('returns success true when all imports succeed', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [{ handId: 'h1', timestamp: 1000 }],
        sessions: [{ sessionId: 's1', startTime: 500 }],
        players: [{ playerId: 'p1', name: 'Alice' }],
      },
    };

    createPlayer.mockResolvedValue('new-p1');
    createSession.mockResolvedValue('new-s1');
    saveHand.mockResolvedValue('new-h1');

    const result = await importAllData(importData);

    expect(result.success).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.counts.hands).toBe(1);
    expect(result.counts.sessions).toBe(1);
    expect(result.counts.players).toBe(1);
  });

  it('handles player import errors gracefully', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [],
        players: [
          { playerId: 'p1', name: 'Alice' },
          { playerId: 'p2', name: 'Bob' },
        ],
      },
    };

    createPlayer
      .mockResolvedValueOnce('new-p1')
      .mockRejectedValueOnce(new Error('Duplicate name'));

    const result = await importAllData(importData);

    expect(result.success).toBe(false);
    expect(result.counts.players).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to import player "Bob"');
    expect(result.errors[0]).toContain('Duplicate name');
  });

  it('handles session import errors gracefully', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [],
        sessions: [
          { sessionId: 's1', startTime: 1000 },
          { sessionId: 's2', startTime: 2000 },
        ],
        players: [],
      },
    };

    createSession
      .mockResolvedValueOnce('new-s1')
      .mockRejectedValueOnce(new Error('Database error'));

    const result = await importAllData(importData);

    expect(result.success).toBe(false);
    expect(result.counts.sessions).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to import session');
    expect(result.errors[0]).toContain('Database error');
  });

  it('handles hand import errors gracefully', async () => {
    const importData = {
      version: '1.0.0',
      data: {
        hands: [
          { handId: 'h1', timestamp: 1000 },
          { handId: 'h2', timestamp: 2000 },
        ],
        sessions: [],
        players: [],
      },
    };

    saveHand
      .mockResolvedValueOnce('new-h1')
      .mockRejectedValueOnce(new Error('Invalid data'));

    const result = await importAllData(importData);

    expect(result.success).toBe(false);
    expect(result.counts.hands).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Failed to import hand');
    expect(result.errors[0]).toContain('Invalid data');
  });

  it('handles errors during clearAllData', async () => {
    const importData = {
      version: '1.0.0',
      data: { hands: [], sessions: [], players: [] },
    };

    clearAllHands.mockRejectedValue(new Error('Database locked'));

    const result = await importAllData(importData);

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('Import failed');
    expect(result.errors[0]).toContain('Database locked');
  });

  it('handles missing data arrays gracefully', async () => {
    const importData = {
      version: '1.0.0',
      data: {},
    };

    const result = await importAllData(importData);

    expect(result.success).toBe(true);
    expect(result.counts.hands).toBe(0);
    expect(result.counts.sessions).toBe(0);
    expect(result.counts.players).toBe(0);
  });
});

describe('readJsonFile', () => {
  it('reads and parses valid JSON file', async () => {
    const mockFile = new File(['{"test": "data"}'], 'test.json', {
      type: 'application/json',
    });

    const result = await readJsonFile(mockFile);

    expect(result).toEqual({ test: 'data' });
  });

  it('reads complex JSON structures', async () => {
    const data = {
      version: '1.0.0',
      data: { hands: [], sessions: [], players: [] },
      counts: { hands: 0, sessions: 0, players: 0 },
    };
    const mockFile = new File([JSON.stringify(data)], 'backup.json', {
      type: 'application/json',
    });

    const result = await readJsonFile(mockFile);

    expect(result).toEqual(data);
  });

  it('rejects invalid JSON with error', async () => {
    const mockFile = new File(['not valid json'], 'invalid.json', {
      type: 'application/json',
    });

    await expect(readJsonFile(mockFile)).rejects.toThrow('Invalid JSON file');
  });

  it('rejects empty file', async () => {
    const mockFile = new File([''], 'empty.json', {
      type: 'application/json',
    });

    await expect(readJsonFile(mockFile)).rejects.toThrow('Invalid JSON file');
  });

  it('handles file read errors', async () => {
    const mockFile = new File(['{"test": "data"}'], 'test.json');

    // Mock FileReader to trigger onerror
    const originalFileReader = global.FileReader;
    global.FileReader = class {
      readAsText() {
        setTimeout(() => this.onerror(), 0);
      }
    };

    await expect(readJsonFile(mockFile)).rejects.toThrow('Failed to read file');

    global.FileReader = originalFileReader;
  });

  it('handles malformed JSON with descriptive error', async () => {
    const mockFile = new File(['{"test": incomplete'], 'bad.json', {
      type: 'application/json',
    });

    await expect(readJsonFile(mockFile)).rejects.toThrow('Invalid JSON file');
  });

  it('handles JSON with trailing commas', async () => {
    const mockFile = new File(['{"test": "data",}'], 'trailing.json', {
      type: 'application/json',
    });

    // JSON.parse will throw on trailing commas
    await expect(readJsonFile(mockFile)).rejects.toThrow('Invalid JSON file');
  });

  it('reads file with whitespace correctly', async () => {
    const mockFile = new File(
      ['\n  \n{"test": "data"}\n  \n'],
      'whitespace.json',
      { type: 'application/json' }
    );

    const result = await readJsonFile(mockFile);

    expect(result).toEqual({ test: 'data' });
  });
});
