/**
 * errorHandler.test.js - Tests for centralized error handling utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the module directly, but DEBUG depends on import.meta.env
// So we'll import and test the actual exports

describe('errorHandler', () => {
  let errorHandler;

  beforeEach(async () => {
    // Fresh import for each test
    vi.resetModules();
    errorHandler = await import('../errorHandler');
  });

  describe('ERROR_CODES', () => {
    it('has state error codes (E1xx)', () => {
      expect(errorHandler.ERROR_CODES.INVALID_STATE).toBe('E101');
      expect(errorHandler.ERROR_CODES.STATE_CORRUPTION).toBe('E102');
      expect(errorHandler.ERROR_CODES.REDUCER_FAILED).toBe('E103');
      expect(errorHandler.ERROR_CODES.HYDRATION_FAILED).toBe('E104');
    });

    it('has validation error codes (E2xx)', () => {
      expect(errorHandler.ERROR_CODES.INVALID_INPUT).toBe('E201');
      expect(errorHandler.ERROR_CODES.INVALID_ACTION).toBe('E202');
      expect(errorHandler.ERROR_CODES.INVALID_SEAT).toBe('E203');
      expect(errorHandler.ERROR_CODES.INVALID_CARD).toBe('E204');
      expect(errorHandler.ERROR_CODES.INVALID_STREET).toBe('E205');
      expect(errorHandler.ERROR_CODES.ACTION_SEQUENCE_INVALID).toBe('E206');
    });

    it('has persistence error codes (E3xx)', () => {
      expect(errorHandler.ERROR_CODES.DB_INIT_FAILED).toBe('E301');
      expect(errorHandler.ERROR_CODES.SAVE_FAILED).toBe('E302');
      expect(errorHandler.ERROR_CODES.LOAD_FAILED).toBe('E303');
      expect(errorHandler.ERROR_CODES.DELETE_FAILED).toBe('E304');
      expect(errorHandler.ERROR_CODES.MIGRATION_FAILED).toBe('E305');
      expect(errorHandler.ERROR_CODES.QUOTA_EXCEEDED).toBe('E306');
    });

    it('has component error codes (E4xx)', () => {
      expect(errorHandler.ERROR_CODES.RENDER_FAILED).toBe('E401');
      expect(errorHandler.ERROR_CODES.HANDLER_FAILED).toBe('E402');
      expect(errorHandler.ERROR_CODES.HOOK_FAILED).toBe('E403');
      expect(errorHandler.ERROR_CODES.PROP_INVALID).toBe('E404');
    });
  });

  describe('AppError', () => {
    it('creates error with code and message', () => {
      const error = new errorHandler.AppError('E101', 'Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error.code).toBe('E101');
      expect(error.message).toContain('[E101]');
      expect(error.message).toContain('Test error');
    });

    it('stores context', () => {
      const context = { handId: 123, seat: 5 };
      const error = new errorHandler.AppError('E102', 'Context test', context);

      expect(error.context).toEqual(context);
    });

    it('stores timestamp', () => {
      const before = new Date().toISOString();
      const error = new errorHandler.AppError('E103', 'Timestamp test');
      const after = new Date().toISOString();

      expect(error.timestamp).toBeDefined();
      expect(error.timestamp >= before).toBe(true);
      expect(error.timestamp <= after).toBe(true);
    });

    it('has AppError name', () => {
      const error = new errorHandler.AppError('E104', 'Name test');

      expect(error.name).toBe('AppError');
    });

    describe('toDebugString', () => {
      it('returns JSON with error details', () => {
        const error = new errorHandler.AppError('E105', 'Debug test', { data: 'test' });
        const debugStr = error.toDebugString();
        const parsed = JSON.parse(debugStr);

        expect(parsed.code).toBe('E105');
        expect(parsed.message).toContain('Debug test');
        expect(parsed.context).toEqual({ data: 'test' });
        expect(parsed.timestamp).toBeDefined();
      });

      it('includes partial stack trace', () => {
        const error = new errorHandler.AppError('E106', 'Stack test');
        const debugStr = error.toDebugString();
        const parsed = JSON.parse(debugStr);

        expect(parsed.stack).toBeDefined();
        // Should have limited lines
        expect(parsed.stack.split('\n').length).toBeLessThanOrEqual(4);
      });
    });

    describe('toUserString', () => {
      it('returns user-friendly message for known codes', () => {
        const error301 = new errorHandler.AppError('E301', 'DB init failed');
        expect(error301.toUserString()).toBe('Unable to connect to local storage. Your data may not be saved.');

        const error302 = new errorHandler.AppError('E302', 'Save failed');
        expect(error302.toUserString()).toBe('Failed to save. Please try again.');

        const error303 = new errorHandler.AppError('E303', 'Load failed');
        expect(error303.toUserString()).toBe('Failed to load data. Please refresh the page.');

        const error306 = new errorHandler.AppError('E306', 'Quota exceeded');
        expect(error306.toUserString()).toBe('Storage is full. Please clear some old hands.');

        const error401 = new errorHandler.AppError('E401', 'Render failed');
        expect(error401.toUserString()).toBe('Something went wrong. Please refresh the page.');
      });

      it('returns generic message for unknown codes', () => {
        const error = new errorHandler.AppError('E999', 'Unknown error');
        expect(error.toUserString()).toBe('An error occurred. Please try again.');
      });
    });
  });

  describe('logger', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = {
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    describe('info', () => {
      it('always logs with module prefix', () => {
        errorHandler.logger.info('TestModule', 'Info message', { data: 'test' });

        expect(consoleSpy.info).toHaveBeenCalledWith(
          '[TestModule]',
          'Info message',
          { data: 'test' }
        );
      });
    });

    describe('warn', () => {
      it('always logs with module prefix', () => {
        errorHandler.logger.warn('TestModule', 'Warning message');

        expect(consoleSpy.warn).toHaveBeenCalledWith(
          '[TestModule]',
          'Warning message'
        );
      });
    });

    describe('error', () => {
      it('logs AppError with debug string', () => {
        const appError = new errorHandler.AppError('E101', 'App error', { key: 'value' });
        errorHandler.logger.error('TestModule', appError);

        expect(consoleSpy.error).toHaveBeenCalled();
        const call = consoleSpy.error.mock.calls[0];
        expect(call[0]).toBe('[TestModule]');
        // Second arg should be the debug string (JSON)
        const parsed = JSON.parse(call[1]);
        expect(parsed.code).toBe('E101');
      });

      it('logs regular Error with formatted output', () => {
        const regularError = new Error('Regular error');
        errorHandler.logger.error('TestModule', regularError);

        expect(consoleSpy.error).toHaveBeenCalled();
        const call = consoleSpy.error.mock.calls[0];
        expect(call[0]).toBe('[TestModule]');
        expect(call[1].name).toBe('Error');
        expect(call[1].message).toBe('Regular error');
      });

      it('logs non-Error values directly', () => {
        errorHandler.logger.error('TestModule', 'String error');

        expect(consoleSpy.error).toHaveBeenCalledWith(
          '[TestModule]',
          'String error'
        );
      });
    });
  });

  describe('createModuleLogger', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = {
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('creates log function with module prefix', () => {
      const { log } = errorHandler.createModuleLogger('MyModule');

      log('Test message');

      // In dev mode, logger.debug calls console.log
      if (errorHandler.DEBUG) {
        expect(consoleSpy.log).toHaveBeenCalledWith('[MyModule]', 'Test message');
      }
    });

    it('creates logError function with module prefix', () => {
      const { logError } = errorHandler.createModuleLogger('MyModule');
      const error = new Error('Test error');

      logError(error);

      expect(consoleSpy.error).toHaveBeenCalled();
    });
  });

  describe('withErrorHandling', () => {
    let consoleSpy;

    beforeEach(() => {
      consoleSpy = {
        error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      };
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls the wrapped function with arguments', async () => {
      const mockFn = vi.fn().mockResolvedValue('result');
      const wrapped = errorHandler.withErrorHandling('Module', mockFn);

      await wrapped('arg1', 'arg2');

      expect(mockFn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('returns the result on success', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const wrapped = errorHandler.withErrorHandling('Module', mockFn);

      const result = await wrapped();

      expect(result).toBe('success');
    });

    it('logs and re-throws errors by default', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const wrapped = errorHandler.withErrorHandling('Module', mockFn);

      await expect(wrapped()).rejects.toThrow('Failed');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('returns fallback when rethrow is false', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const wrapped = errorHandler.withErrorHandling('Module', mockFn, {
        rethrow: false,
        fallback: 'default',
      });

      const result = await wrapped();

      expect(result).toBe('default');
      expect(consoleSpy.error).toHaveBeenCalled();
    });

    it('returns undefined fallback by default', async () => {
      const mockFn = vi.fn().mockRejectedValue(new Error('Failed'));
      const wrapped = errorHandler.withErrorHandling('Module', mockFn, {
        rethrow: false,
      });

      const result = await wrapped();

      expect(result).toBeUndefined();
    });
  });
});
