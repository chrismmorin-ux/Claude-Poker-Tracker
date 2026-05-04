// @vitest-environment jsdom
/**
 * @file Tests for CameraCaptureModal — 2-stage capture flow.
 * Per WS-161 / SPR-036.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

afterEach(() => cleanup());

const mockCrop = vi.hoisted(() => vi.fn());
const mockSave = vi.hoisted(() => vi.fn());

vi.mock('../../../../utils/playerMatching/cropToSquare', () => ({
  cropToSquare: (...args) => mockCrop(...args),
}));

vi.mock('../../../../utils/persistence/savePhotoAtomically', () => ({
  savePhotoAtomically: (...args) => mockSave(...args),
}));

// URL.createObjectURL is unavailable in jsdom by default.
beforeEach(() => {
  global.URL.createObjectURL = vi.fn(() => 'blob://fake');
  global.URL.revokeObjectURL = vi.fn();
  mockCrop.mockReset();
  mockSave.mockReset();
});

const { CameraCaptureModal } = await import('../CameraCaptureModal');

describe('CameraCaptureModal — Stage 1 (capture)', () => {
  it('renders modal + hidden file input on mount', () => {
    render(<CameraCaptureModal playerId="p1" onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByTestId('camera-capture-modal')).toBeDefined();
    expect(screen.getByTestId('camera-capture-input')).toBeDefined();
    expect(screen.getByTestId('camera-capture-stage-1')).toBeDefined();
  });

  it('close button calls onClose', () => {
    const onClose = vi.fn();
    render(<CameraCaptureModal playerId="p1" onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('camera-capture-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('cancel from Stage 1 closes the modal', () => {
    const onClose = vi.fn();
    render(<CameraCaptureModal playerId="p1" onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('camera-capture-cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('CameraCaptureModal — file selection → preview', () => {
  it('crops file + transitions to preview stage', async () => {
    const croppedBlob = new Blob(['cropped'], { type: 'image/jpeg' });
    mockCrop.mockResolvedValueOnce(croppedBlob);

    render(<CameraCaptureModal playerId="p1" onClose={vi.fn()} onSaved={vi.fn()} />);

    const input = screen.getByTestId('camera-capture-input');
    const file = new File(['fake-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('camera-capture-stage-2')).toBeDefined();
    });
    expect(mockCrop).toHaveBeenCalledWith(file);
    expect(screen.getByTestId('camera-capture-preview')).toBeDefined();
    expect(screen.getByTestId('camera-capture-retake')).toBeDefined();
    expect(screen.getByTestId('camera-capture-accept')).toBeDefined();
  });

  it('user dismissing native picker (no file) closes modal', () => {
    const onClose = vi.fn();
    render(<CameraCaptureModal playerId="p1" onClose={onClose} onSaved={vi.fn()} />);

    const input = screen.getByTestId('camera-capture-input');
    fireEvent.change(input, { target: { files: [] } });
    expect(onClose).toHaveBeenCalled();
  });

  it('crop error displays + does not transition to preview', async () => {
    mockCrop.mockRejectedValueOnce(new Error('decode failed'));

    render(<CameraCaptureModal playerId="p1" onClose={vi.fn()} onSaved={vi.fn()} />);
    const input = screen.getByTestId('camera-capture-input');
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByTestId('camera-capture-error').textContent).toMatch(/decode/);
    });
    expect(screen.queryByTestId('camera-capture-stage-2')).toBeNull();
  });
});

describe('CameraCaptureModal — Stage 2 (preview)', () => {
  const setupPreview = async () => {
    const croppedBlob = new Blob(['cropped'], { type: 'image/jpeg' });
    mockCrop.mockResolvedValueOnce(croppedBlob);
    const utils = render(
      <CameraCaptureModal playerId="p1" onClose={vi.fn()} onSaved={vi.fn()} />,
    );
    const input = screen.getByTestId('camera-capture-input');
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => screen.getByTestId('camera-capture-stage-2'));
    return { utils, croppedBlob };
  };

  it('Accept calls savePhotoAtomically + onSaved with blobId', async () => {
    const onSaved = vi.fn();
    mockCrop.mockResolvedValueOnce(new Blob(['c'], { type: 'image/jpeg' }));
    mockSave.mockResolvedValueOnce({ blobId: 7, photoBlobId: 7 });

    render(<CameraCaptureModal playerId="p1" onClose={vi.fn()} onSaved={onSaved} />);
    const input = screen.getByTestId('camera-capture-input');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => screen.getByTestId('camera-capture-accept'));
    fireEvent.click(screen.getByTestId('camera-capture-accept'));
    await waitFor(() => expect(mockSave).toHaveBeenCalled());
    expect(mockSave).toHaveBeenCalledWith('p1', expect.any(Blob));
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith(7));
  });

  it('Save error keeps modal open + displays error', async () => {
    mockCrop.mockResolvedValueOnce(new Blob(['c'], { type: 'image/jpeg' }));
    mockSave.mockRejectedValueOnce(new Error('IDB write failed'));

    render(<CameraCaptureModal playerId="p1" onClose={vi.fn()} onSaved={vi.fn()} />);
    const input = screen.getByTestId('camera-capture-input');
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] },
    });
    await waitFor(() => screen.getByTestId('camera-capture-accept'));
    fireEvent.click(screen.getByTestId('camera-capture-accept'));
    await waitFor(() => {
      expect(screen.getByTestId('camera-capture-error').textContent).toMatch(/IDB write failed/);
    });
    // Modal stays in preview stage with retake/accept available
    expect(screen.getByTestId('camera-capture-stage-2')).toBeDefined();
  });
});
