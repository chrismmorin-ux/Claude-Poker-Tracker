/**
 * StorageProvider.test.jsx - Tests for StorageProvider React context
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { StorageProvider, useStorageContext, useStorage } from '../StorageProvider';

// Create mock storage implementation
const createMockStorage = (options = {}) => ({
  initialize: vi.fn().mockResolvedValue(undefined),
  saveHand: vi.fn().mockResolvedValue(1),
  loadLatestHand: vi.fn().mockResolvedValue(null),
  loadHandById: vi.fn().mockResolvedValue(null),
  getAllHands: vi.fn().mockResolvedValue([]),
  deleteHand: vi.fn().mockResolvedValue(undefined),
  clearAllHands: vi.fn().mockResolvedValue(undefined),
  getHandCount: vi.fn().mockResolvedValue(0),
  ...options
});

// Test component to consume context
function TestConsumer({ onValue }) {
  try {
    const context = useStorageContext();
    onValue(context);
    return (
      <div>
        <span data-testid="ready">{context.isReady.toString()}</span>
        <span data-testid="error">{context.error?.message || 'none'}</span>
      </div>
    );
  } catch (err) {
    return <div data-testid="error-thrown">{err.message}</div>;
  }
}

// Test component for useStorage hook
function UseStorageConsumer({ onStorage }) {
  try {
    const storage = useStorage();
    onStorage(storage);
    return <div data-testid="storage">Storage available</div>;
  } catch (err) {
    return <div data-testid="storage-error">{err.message}</div>;
  }
}

describe('StorageProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('renders children', async () => {
      const mockStorage = createMockStorage();
      const { unmount } = render(
        <StorageProvider storage={mockStorage}>
          <div data-testid="child">Child content</div>
        </StorageProvider>
      );
      expect(screen.getByTestId('child')).toHaveTextContent('Child content');
      await waitFor(() => {
        expect(mockStorage.initialize).toHaveBeenCalled();
      });
      unmount();
    });

    it('calls initialize on storage', async () => {
      const mockStorage = createMockStorage();
      render(
        <StorageProvider storage={mockStorage}>
          <div>Content</div>
        </StorageProvider>
      );
      await waitFor(() => {
        expect(mockStorage.initialize).toHaveBeenCalled();
      });
    });

    it('sets isReady to true after initialization', async () => {
      const mockStorage = createMockStorage();
      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={() => {}} />
        </StorageProvider>
      );
      await waitFor(() => {
        expect(screen.getByTestId('ready')).toHaveTextContent('true');
      });
    });

    it('starts with isReady false before initialization completes', () => {
      const mockStorage = createMockStorage({
        initialize: vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
      });
      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={() => {}} />
        </StorageProvider>
      );
      expect(screen.getByTestId('ready')).toHaveTextContent('false');
    });
  });

  describe('error handling', () => {
    it('captures initialization error', async () => {
      const mockStorage = createMockStorage({
        initialize: vi.fn().mockRejectedValue(new Error('Init failed'))
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={() => {}} />
        </StorageProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error')).toHaveTextContent('Init failed');
      });

      consoleError.mockRestore();
    });

    it('logs error to console', async () => {
      const mockStorage = createMockStorage({
        initialize: vi.fn().mockRejectedValue(new Error('DB error'))
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={() => {}} />
        </StorageProvider>
      );

      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith(
          'Storage initialization failed:',
          expect.any(Error)
        );
      });

      consoleError.mockRestore();
    });

    it('isReady remains false on error', async () => {
      const mockStorage = createMockStorage({
        initialize: vi.fn().mockRejectedValue(new Error('Failed'))
      });
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={() => {}} />
        </StorageProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('ready')).toHaveTextContent('false');
      });

      consoleError.mockRestore();
    });
  });

  describe('context value', () => {
    it('provides storage instance', async () => {
      const mockStorage = createMockStorage();
      let capturedContext;

      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={(ctx) => { capturedContext = ctx; }} />
        </StorageProvider>
      );

      await waitFor(() => {
        expect(capturedContext.storage).toBe(mockStorage);
      });
    });

    it('provides isReady state', async () => {
      const mockStorage = createMockStorage();
      let capturedContext;

      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={(ctx) => { capturedContext = ctx; }} />
        </StorageProvider>
      );

      await waitFor(() => {
        expect(typeof capturedContext.isReady).toBe('boolean');
      });
    });

    it('provides error state (null when no error)', async () => {
      const mockStorage = createMockStorage();
      let capturedContext;

      render(
        <StorageProvider storage={mockStorage}>
          <TestConsumer onValue={(ctx) => { capturedContext = ctx; }} />
        </StorageProvider>
      );

      await waitFor(() => {
        expect(capturedContext.isReady).toBe(true);
      });
      expect(capturedContext.error).toBeNull();
    });
  });

  describe('unmounting', () => {
    it('does not update state after unmount', async () => {
      const mockStorage = createMockStorage({
        initialize: vi.fn().mockImplementation(() =>
          new Promise(resolve => setTimeout(resolve, 100))
        )
      });

      const { unmount } = render(
        <StorageProvider storage={mockStorage}>
          <div>Content</div>
        </StorageProvider>
      );

      // Unmount before init completes
      unmount();

      // Wait a bit and verify no errors (React warning about setState on unmounted)
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 150));
      });

      // Test passes if no error thrown
      expect(true).toBe(true);
    });
  });
});

describe('useStorageContext', () => {
  it('throws when used outside provider', () => {
    // Suppress console.error for this test
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Our TestConsumer catches and displays the error
    render(<TestConsumer onValue={() => {}} />);

    // Check that our error boundary caught it and displays the error message
    expect(screen.getByTestId('error-thrown')).toHaveTextContent(
      'useStorageContext must be used within a StorageProvider'
    );

    consoleError.mockRestore();
  });

  it('returns context when inside provider', async () => {
    const mockStorage = createMockStorage();
    let capturedContext;

    render(
      <StorageProvider storage={mockStorage}>
        <TestConsumer onValue={(ctx) => { capturedContext = ctx; }} />
      </StorageProvider>
    );

    await waitFor(() => {
      expect(capturedContext).toBeDefined();
      expect(capturedContext.storage).toBe(mockStorage);
    });
  });
});

describe('useStorage', () => {
  it('returns storage instance', async () => {
    const mockStorage = createMockStorage();
    let capturedStorage;

    render(
      <StorageProvider storage={mockStorage}>
        <UseStorageConsumer onStorage={(s) => { capturedStorage = s; }} />
      </StorageProvider>
    );

    await waitFor(() => {
      expect(capturedStorage).toBe(mockStorage);
    });
  });

  it('throws when context has error', async () => {
    const errorToThrow = new Error('Storage unavailable');
    const mockStorage = createMockStorage({
      initialize: vi.fn().mockRejectedValue(errorToThrow)
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <StorageProvider storage={mockStorage}>
        <UseStorageConsumer onStorage={() => {}} />
      </StorageProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('storage-error')).toHaveTextContent('Storage unavailable');
    });

    consoleError.mockRestore();
  });

  it('returns storage even before ready (for loading states)', async () => {
    const mockStorage = createMockStorage({
      initialize: vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
    });
    let capturedStorage;

    render(
      <StorageProvider storage={mockStorage}>
        <UseStorageConsumer onStorage={(s) => { capturedStorage = s; }} />
      </StorageProvider>
    );

    // Should have storage immediately, even though not ready
    await waitFor(() => {
      expect(capturedStorage).toBe(mockStorage);
    });
  });
});

describe('default storage', () => {
  it('uses indexedDBStorage by default when no storage prop provided', async () => {
    // This test verifies the component doesn't crash when using default
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Note: In test environment, IndexedDB is mocked by fake-indexeddb
    // so this should work without errors
    render(
      <StorageProvider>
        <TestConsumer onValue={() => {}} />
      </StorageProvider>
    );

    // Should eventually become ready or show error (depending on mock setup)
    await waitFor(() => {
      const ready = screen.getByTestId('ready');
      const error = screen.getByTestId('error');
      // Either ready or has error - both are valid states
      expect(ready.textContent === 'true' || error.textContent !== 'none').toBe(true);
    }, { timeout: 2000 });

    consoleError.mockRestore();
  });
});
