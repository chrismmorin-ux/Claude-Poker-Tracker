// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../errorLog', () => ({ logErrorObject: vi.fn() }));
vi.mock('../errorHandler', () => ({
  logger: { error: vi.fn(), warn: vi.fn() },
  ERROR_CODES: { PERSISTENCE_DEGRADED: 'E307' },
}));

import { logErrorObject } from '../errorLog';
import {
  reportPersistenceFailure,
  reportPersistenceHealthy,
  getPersistenceFailures,
  getPersistenceFailureCount,
  __resetPersistenceHealth,
} from '../persistenceHealth';

beforeEach(() => {
  __resetPersistenceHealth();
  vi.clearAllMocks();
});

describe('persistenceHealth', () => {
  it('reports nothing when every subsystem is fine', () => {
    expect(getPersistenceFailureCount()).toBe(0);
    expect(getPersistenceFailures()).toEqual([]);
  });

  it('records a failure with its subsystem and message', () => {
    reportPersistenceFailure('hands', new Error('IDB open failed'));

    const failures = getPersistenceFailures();
    expect(failures).toHaveLength(1);
    expect(failures[0].subsystem).toBe('hands');
    expect(failures[0].message).toBe('IDB open failed');
    expect(failures[0].at).toEqual(expect.any(Number));
  });

  it('writes to the exportable error log as E307', () => {
    const err = new Error('IDB open failed');
    reportPersistenceFailure('hands', err);

    // Console-only would be invisible on a phone — a bug report has to carry it.
    expect(logErrorObject).toHaveBeenCalledWith(err, 'E307', expect.objectContaining({
      subsystem: 'hands',
    }));
  });

  it('counts each failing subsystem once, not each report', () => {
    reportPersistenceFailure('hands', new Error('a'));
    reportPersistenceFailure('hands', new Error('b'));
    reportPersistenceFailure('sessions', new Error('c'));

    expect(getPersistenceFailureCount()).toBe(2);
  });

  it('clears a subsystem once it initialises successfully', () => {
    // userId changes re-run init; a guest-session failure must not keep
    // alarming after a signed-in retry succeeds.
    reportPersistenceFailure('players', new Error('boom'));
    expect(getPersistenceFailureCount()).toBe(1);

    reportPersistenceHealthy('players');
    expect(getPersistenceFailureCount()).toBe(0);
  });

  it('leaves other subsystems alone when one recovers', () => {
    reportPersistenceFailure('hands', new Error('a'));
    reportPersistenceFailure('sessions', new Error('b'));

    reportPersistenceHealthy('hands');

    expect(getPersistenceFailures().map((f) => f.subsystem)).toEqual(['sessions']);
  });

  it('survives a thrown non-Error value', () => {
    reportPersistenceFailure('settings', 'plain string failure');
    expect(getPersistenceFailures()[0].message).toBe('plain string failure');
  });
});
