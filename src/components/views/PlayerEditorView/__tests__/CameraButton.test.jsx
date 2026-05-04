// @vitest-environment jsdom
/**
 * @file Tests for CameraButton — visibility gating + modal opening.
 * Per WS-161 / SPR-036.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { CameraButton } from '../CameraButton';

afterEach(() => cleanup());

const mockSettings = vi.hoisted(() => ({
  current: { privacy: { photoCaptureEnabled: false } },
}));

vi.mock('../../../../contexts/SettingsContext', () => ({
  useSettings: () => ({ settings: mockSettings.current }),
}));

vi.mock('../CameraCaptureModal', () => ({
  CameraCaptureModal: ({ playerId, onClose, onSaved }) => (
    <div data-testid="camera-capture-modal-stub">
      <span>Modal for {playerId}</span>
      <button data-testid="modal-close-stub" onClick={onClose}>Close</button>
      <button data-testid="modal-save-stub" onClick={() => onSaved?.(42)}>Save</button>
    </div>
  ),
}));

describe('CameraButton — gating', () => {
  it('renders nothing when photoCaptureEnabled=false', () => {
    mockSettings.current = { privacy: { photoCaptureEnabled: false } };
    const { container } = render(<CameraButton playerId="p1" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no playerId (e.g., create mode pre-save)', () => {
    mockSettings.current = { privacy: { photoCaptureEnabled: true } };
    const { container } = render(<CameraButton playerId={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders "Add photo" when enabled + no photoBlobId', () => {
    mockSettings.current = { privacy: { photoCaptureEnabled: true } };
    render(<CameraButton playerId="p1" />);
    expect(screen.getByTestId('player-editor-camera-button-trigger').textContent).toMatch(/Add photo/);
  });

  it('renders "Replace photo" when photoBlobId set', () => {
    mockSettings.current = { privacy: { photoCaptureEnabled: true } };
    render(<CameraButton playerId="p1" photoBlobId={42} />);
    expect(screen.getByTestId('player-editor-camera-button-trigger').textContent).toMatch(/Replace photo/);
  });
});

describe('CameraButton — modal interactions', () => {
  it('clicking the button opens the modal', () => {
    mockSettings.current = { privacy: { photoCaptureEnabled: true } };
    render(<CameraButton playerId="p1" />);
    expect(screen.queryByTestId('camera-capture-modal-stub')).toBeNull();
    fireEvent.click(screen.getByTestId('player-editor-camera-button-trigger'));
    expect(screen.getByTestId('camera-capture-modal-stub')).toBeDefined();
  });

  it('modal close closes the modal', () => {
    mockSettings.current = { privacy: { photoCaptureEnabled: true } };
    render(<CameraButton playerId="p1" />);
    fireEvent.click(screen.getByTestId('player-editor-camera-button-trigger'));
    fireEvent.click(screen.getByTestId('modal-close-stub'));
    expect(screen.queryByTestId('camera-capture-modal-stub')).toBeNull();
  });

  it('modal save calls onPhotoSaved with blobId + closes modal', () => {
    mockSettings.current = { privacy: { photoCaptureEnabled: true } };
    const onPhotoSaved = vi.fn();
    render(<CameraButton playerId="p1" onPhotoSaved={onPhotoSaved} />);
    fireEvent.click(screen.getByTestId('player-editor-camera-button-trigger'));
    fireEvent.click(screen.getByTestId('modal-save-stub'));
    expect(onPhotoSaved).toHaveBeenCalledWith(42);
    expect(screen.queryByTestId('camera-capture-modal-stub')).toBeNull();
  });
});
