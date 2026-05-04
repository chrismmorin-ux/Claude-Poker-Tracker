// @vitest-environment jsdom
/**
 * @file Tests for PlayerPhotoAvatar — photo render + initial-letter fallback.
 * Per WS-161 / SPR-036.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';

afterEach(() => cleanup());

const mockGetPhotoBlob = vi.hoisted(() => vi.fn());

vi.mock('../../../utils/persistence/playerPhotosStore', () => ({
  getPhotoBlob: (...args) => mockGetPhotoBlob(...args),
}));

const revoked = vi.hoisted(() => ({ count: 0, urls: [] }));

beforeEach(() => {
  revoked.count = 0;
  revoked.urls = [];
  global.URL.createObjectURL = vi.fn(() => 'blob://fake-url');
  global.URL.revokeObjectURL = vi.fn((url) => {
    revoked.count += 1;
    revoked.urls.push(url);
  });
  mockGetPhotoBlob.mockReset();
});

const { PlayerPhotoAvatar } = await import('../PlayerPhotoAvatar');

describe('PlayerPhotoAvatar', () => {
  it('renders initial-letter fallback when player has no photoBlobId', () => {
    render(<PlayerPhotoAvatar player={{ name: 'Alice', photoBlobId: null }} />);
    expect(screen.getByTestId('player-photo-avatar-fallback')).toBeDefined();
    expect(screen.getByTestId('player-photo-avatar-fallback').textContent).toBe('A');
  });

  it('renders fallback with "?" when player has no name', () => {
    render(<PlayerPhotoAvatar player={{ photoBlobId: null }} />);
    expect(screen.getByTestId('player-photo-avatar-fallback').textContent).toBe('?');
  });

  it('renders <img> when blob loads', async () => {
    mockGetPhotoBlob.mockResolvedValueOnce({
      blobId: 7,
      blob: new Blob(['fake'], { type: 'image/jpeg' }),
    });
    render(<PlayerPhotoAvatar player={{ name: 'Alice', photoBlobId: 7 }} />);
    await waitFor(() => {
      expect(screen.getByTestId('player-photo-avatar-image')).toBeDefined();
    });
    const img = screen.getByTestId('player-photo-avatar-image');
    expect(img.getAttribute('src')).toBe('blob://fake-url');
    expect(img.getAttribute('alt')).toBe('Alice');
  });

  it('falls back to initial when blob fetch returns null', async () => {
    mockGetPhotoBlob.mockResolvedValueOnce(null);
    render(<PlayerPhotoAvatar player={{ name: 'Alice', photoBlobId: 99 }} />);
    // No image renders; fallback persists
    await waitFor(() => {
      expect(screen.getByTestId('player-photo-avatar-fallback')).toBeDefined();
    });
  });

  it('falls back to initial when blob fetch throws', async () => {
    mockGetPhotoBlob.mockRejectedValueOnce(new Error('IDB error'));
    render(<PlayerPhotoAvatar player={{ name: 'Alice', photoBlobId: 99 }} />);
    await waitFor(() => {
      expect(screen.getByTestId('player-photo-avatar-fallback')).toBeDefined();
    });
  });

  it('cleans up object URL on unmount', async () => {
    mockGetPhotoBlob.mockResolvedValueOnce({
      blobId: 7,
      blob: new Blob(['x'], { type: 'image/jpeg' }),
    });
    const { unmount } = render(<PlayerPhotoAvatar player={{ name: 'A', photoBlobId: 7 }} />);
    await waitFor(() => screen.getByTestId('player-photo-avatar-image'));
    unmount();
    expect(revoked.count).toBeGreaterThanOrEqual(1);
    expect(revoked.urls).toContain('blob://fake-url');
  });
});
