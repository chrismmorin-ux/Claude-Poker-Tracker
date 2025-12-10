/**
 * Tests for errorLog.js utility
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getErrorLog,
  logError,
  logErrorObject,
  clearErrorLog,
  getErrorCount,
  getRecentErrors,
  exportErrorLog,
} from '../errorLog';
import { AppError } from '../errorHandler';

const STORAGE_KEY = 'poker-tracker-error-log';

describe('errorLog', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  describe('getErrorLog', () => {
    it('returns empty array when no errors logged', () => {
      expect(getErrorLog()).toEqual([]);
    });

    it('returns parsed entries from localStorage', () => {
      const entries = [
        { id: '1', code: 'E101', message: 'Test error' },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
      expect(getErrorLog()).toEqual(entries);
    });

    it('returns empty array if localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, 'not valid json');
      expect(getErrorLog()).toEqual([]);
    });

    it('returns empty array if localStorage contains non-array', () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
      expect(getErrorLog()).toEqual([]);
    });
  });

  describe('logError', () => {
    it('logs error with all required fields', () => {
      const entry = logError({
        code: 'E101',
        message: 'Test error message',
        stack: 'Error at line 1',
        context: {
          view: 'TableView',
          sessionActive: true,
          handCount: 5,
        },
      });

      expect(entry.id).toMatch(/^[0-9a-f-]{36}$/); // UUID format
      expect(entry.timestamp).toBeCloseTo(Date.now(), -2);
      expect(entry.code).toBe('E101');
      expect(entry.message).toBe('Test error message');
      expect(entry.stack).toBe('Error at line 1');
      expect(entry.context.view).toBe('TableView');
      expect(entry.context.sessionActive).toBe(true);
      expect(entry.context.handCount).toBe(5);
      expect(entry.userAgent).toBeDefined();
      expect(entry.appVersion).toBe('v115');
    });

    it('persists entry to localStorage', () => {
      logError({ code: 'E101', message: 'Test' });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      expect(stored).toHaveLength(1);
      expect(stored[0].code).toBe('E101');
    });

    it('uses default context values when not provided', () => {
      const entry = logError({ code: 'E101', message: 'Test' });

      expect(entry.context.view).toBe('unknown');
      expect(entry.context.sessionActive).toBe(false);
      expect(entry.context.handCount).toBe(0);
    });

    it('truncates long stack traces', () => {
      const longStack = 'x'.repeat(3000);
      const entry = logError({ code: 'E101', message: 'Test', stack: longStack });

      expect(entry.stack.length).toBe(2000);
    });

    it('handles null stack', () => {
      const entry = logError({ code: 'E101', message: 'Test', stack: null });
      expect(entry.stack).toBeNull();
    });

    it('enforces FIFO limit of 50 entries', () => {
      // Add 55 entries
      for (let i = 0; i < 55; i++) {
        logError({ code: 'E101', message: `Error ${i}` });
      }

      const entries = getErrorLog();
      expect(entries).toHaveLength(50);
      // First 5 should be removed (FIFO)
      expect(entries[0].message).toBe('Error 5');
      expect(entries[49].message).toBe('Error 54');
    });

    it('allows additional context properties', () => {
      const entry = logError({
        code: 'E101',
        message: 'Test',
        context: {
          view: 'TableView',
          customField: 'customValue',
        },
      });

      expect(entry.context.customField).toBe('customValue');
    });
  });

  describe('logErrorObject', () => {
    it('logs Error object with defaults', () => {
      const error = new Error('Something went wrong');
      const entry = logErrorObject(error);

      expect(entry.code).toBe('E401'); // Default code
      expect(entry.message).toBe('Something went wrong');
      expect(entry.stack).toContain('Error: Something went wrong');
    });

    it('logs AppError with its code', () => {
      const error = new AppError('E301', 'DB failed', { operation: 'save' });
      const entry = logErrorObject(error);

      expect(entry.code).toBe('E301');
      expect(entry.message).toContain('DB failed');
      expect(entry.context.operation).toBe('save');
    });

    it('merges AppError context with provided context', () => {
      const error = new AppError('E301', 'DB failed', { operation: 'save' });
      const entry = logErrorObject(error, 'E301', { view: 'HistoryView' });

      expect(entry.context.operation).toBe('save');
      expect(entry.context.view).toBe('HistoryView');
    });

    it('uses custom error code when provided', () => {
      const error = new Error('Custom error');
      const entry = logErrorObject(error, 'E205');

      expect(entry.code).toBe('E205');
    });
  });

  describe('clearErrorLog', () => {
    it('removes all entries from localStorage', () => {
      logError({ code: 'E101', message: 'Test 1' });
      logError({ code: 'E102', message: 'Test 2' });

      expect(getErrorCount()).toBe(2);

      clearErrorLog();

      expect(getErrorCount()).toBe(0);
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });
  });

  describe('getErrorCount', () => {
    it('returns 0 for empty log', () => {
      expect(getErrorCount()).toBe(0);
    });

    it('returns correct count', () => {
      logError({ code: 'E101', message: 'Test 1' });
      logError({ code: 'E102', message: 'Test 2' });
      logError({ code: 'E103', message: 'Test 3' });

      expect(getErrorCount()).toBe(3);
    });
  });

  describe('getRecentErrors', () => {
    it('returns empty array when no errors', () => {
      expect(getRecentErrors()).toEqual([]);
    });

    it('returns most recent entries in reverse order (newest first)', () => {
      logError({ code: 'E101', message: 'First' });
      logError({ code: 'E102', message: 'Second' });
      logError({ code: 'E103', message: 'Third' });

      const recent = getRecentErrors(3);

      expect(recent).toHaveLength(3);
      expect(recent[0].message).toBe('Third');
      expect(recent[1].message).toBe('Second');
      expect(recent[2].message).toBe('First');
    });

    it('respects count parameter', () => {
      logError({ code: 'E101', message: 'First' });
      logError({ code: 'E102', message: 'Second' });
      logError({ code: 'E103', message: 'Third' });

      const recent = getRecentErrors(2);

      expect(recent).toHaveLength(2);
      expect(recent[0].message).toBe('Third');
      expect(recent[1].message).toBe('Second');
    });

    it('returns all entries if count exceeds available', () => {
      logError({ code: 'E101', message: 'Only one' });

      const recent = getRecentErrors(10);

      expect(recent).toHaveLength(1);
    });
  });

  describe('exportErrorLog', () => {
    it('returns valid JSON string', () => {
      logError({ code: 'E101', message: 'Test error' });

      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(parsed.appVersion).toBe('v115');
      expect(parsed.exportedAt).toBeDefined();
      expect(parsed.errorCount).toBe(1);
      expect(parsed.errors).toHaveLength(1);
    });

    it('sanitizes error entries for privacy', () => {
      logError({
        code: 'E101',
        message: 'Test error',
        stack: 'Full stack trace here',
        context: {
          view: 'TableView',
          sessionActive: true,
          handCount: 5,
          sensitiveField: 'should not appear',
        },
      });

      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);
      const error = parsed.errors[0];

      // Should have sanitized fields
      expect(error.hasStack).toBe(true);
      expect(error.stack).toBeUndefined(); // Full stack not included
      expect(error.context.view).toBe('TableView');
      expect(error.context.sessionActive).toBe(true);
      expect(error.context.handCount).toBe(5);
      // Sensitive fields should be filtered
      expect(error.context.sensitiveField).toBeUndefined();
      // Browser name instead of full userAgent
      expect(error.browser).toBeDefined();
      expect(error.userAgent).toBeUndefined();
    });

    it('includes browser name instead of full userAgent', () => {
      logError({ code: 'E101', message: 'Test' });

      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);
      const error = parsed.errors[0];

      // Should have browser name, not full userAgent
      expect(error.browser).toBeDefined();
      expect(['Chrome', 'Firefox', 'Safari', 'Edge', 'Other', 'unknown']).toContain(error.browser);
    });

    it('limits export to 10 most recent errors', () => {
      // Add 15 errors
      for (let i = 0; i < 15; i++) {
        logError({ code: 'E101', message: `Error ${i}` });
      }

      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(parsed.errors).toHaveLength(10);
      // Should be most recent 10, newest first
      expect(parsed.errors[0].message).toBe('Error 14');
      expect(parsed.errors[9].message).toBe('Error 5');
    });

    it('handles empty error log', () => {
      const exported = exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(parsed.errorCount).toBe(0);
      expect(parsed.errors).toEqual([]);
    });
  });

  describe('localStorage error handling', () => {
    it('handles localStorage quota exceeded gracefully', () => {
      // Mock localStorage.setItem to throw QuotaExceededError
      const originalSetItem = localStorage.setItem;
      let callCount = 0;
      localStorage.setItem = vi.fn((key, value) => {
        callCount++;
        if (callCount === 1) {
          const error = new Error('QuotaExceededError');
          error.name = 'QuotaExceededError';
          throw error;
        }
        // Second call (with trimmed data) should succeed
        return originalSetItem.call(localStorage, key, value);
      });

      // This should not throw
      expect(() => logError({ code: 'E101', message: 'Test' })).not.toThrow();

      localStorage.setItem = originalSetItem;
    });
  });
});
