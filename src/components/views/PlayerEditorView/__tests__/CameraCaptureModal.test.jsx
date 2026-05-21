// @vitest-environment jsdom
/**
 * CameraCaptureModal — FSM-state and lifecycle tests.
 *
 * The full 3-stage flow (source → preparing → cropping → saving) involves
 * react-easy-crop which renders an interactive canvas-backed cropper not
 * meaningfully unit-testable in jsdom. Pinch/drag/zoom interactions and
 * canvas blob generation belong in Playwright (visual regression suite).
 *
 * Coverage here is what's tractable in jsdom:
 *   - Initial render is the 'source' stage with both Camera and Upload buttons.
 *   - Close + Cancel buttons fire onClose.
 *   - File-pick triggers downscale; success transitions stage to 'cropping'.
 *   - File-pick downscale failure transitions stage back to 'source' with
 *     the standard failure copy.
 *   - Accept button is disabled until croppedAreaPixels is set.
 *   - Save success fires onSaved + onClose; modal-close happens via the
 *     unmount controlled by the parent.
 *   - Save failure transitions stage back to 'cropping' with failure copy;
 *     raw err.message is NOT shown to user.
 *   - Concurrent accept tap during 'saving' is impossible (button disabled).
 *   - Retake from any stage returns to 'source' and clears error.
 *
 * Per WS-184 / SPR-076.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CameraCaptureModal } from '../CameraCaptureModal';

// react-easy-crop renders a Cropper that uses real DOM canvas APIs —
// stub it so jsdom doesn't crash. The mock exposes a way to fire
// onCropComplete from inside tests so we can simulate "crop is positioned."
let mockOnCropCompleteRef = null;
vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }) => {
    mockOnCropCompleteRef = onCropComplete;
    return <div data-testid="mock-cropper" />;
  },
}));

vi.mock('../../../../utils/persistence/savePhotoAtomically', () => ({
  savePhotoAtomically: vi.fn(),
}));

vi.mock('../../../../utils/playerMatching/generateCroppedBlob', () => ({
  generateCroppedBlob: vi.fn(),
}));

vi.mock('../../../../utils/playerMatching/downscaleImageBlob', () => ({
  downscaleImageBlob: vi.fn(),
}));

import { savePhotoAtomically } from '../../../../utils/persistence/savePhotoAtomically';
import { generateCroppedBlob } from '../../../../utils/playerMatching/generateCroppedBlob';
import { downscaleImageBlob } from '../../../../utils/playerMatching/downscaleImageBlob';

const FAILURE_COPY = "Couldn't process this photo. Try again — if it keeps failing, you can also Upload from your gallery.";

const fakeFile = (name = 'shot.jpg') => new File(['fake'], name, { type: 'image/jpeg' });

const setupObjectUrl = () => {
  let counter = 0;
  global.URL.createObjectURL = vi.fn(() => `blob:mock-url-${++counter}`);
  global.URL.revokeObjectURL = vi.fn();
};

beforeEach(() => {
  setupObjectUrl();
  mockOnCropCompleteRef = null;
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const fireCameraInputChange = () => {
  const input = screen.getByTestId('camera-capture-input');
  Object.defineProperty(input, 'files', {
    value: [fakeFile()],
    writable: false,
    configurable: true,
  });
  fireEvent.change(input);
};

const reachCroppingStage = async (downscaledBlob) => {
  downscaleImageBlob.mockResolvedValueOnce(downscaledBlob ?? new Blob(['ds'], { type: 'image/jpeg' }));
  await act(async () => {
    fireCameraInputChange();
    // Wait for the async dispatch chain to land.
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(screen.getByTestId('camera-capture-stage-crop')).toBeDefined());
};

describe('CameraCaptureModal — initial render', () => {
  it('renders the source stage with Take / Upload buttons on mount', () => {
    render(<CameraCaptureModal playerId={1} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByTestId('camera-capture-modal')).toBeDefined();
    expect(screen.getByTestId('camera-capture-stage-source')).toBeDefined();
    expect(screen.getByTestId('camera-capture-take')).toBeDefined();
    expect(screen.getByTestId('camera-upload')).toBeDefined();
  });

  it('mounts with FSM stage = source', () => {
    render(<CameraCaptureModal playerId={1} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByTestId('camera-capture-modal').getAttribute('data-fsm-stage')).toBe('source');
  });

  it('Cancel button fires onClose', () => {
    const onClose = vi.fn();
    render(<CameraCaptureModal playerId={1} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('camera-capture-cancel'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Close (X) button fires onClose', () => {
    const onClose = vi.fn();
    render(<CameraCaptureModal playerId={1} onClose={onClose} onSaved={vi.fn()} />);
    fireEvent.click(screen.getByTestId('camera-capture-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('CameraCaptureModal — file-pick + downscale (Bug A)', () => {
  it('transitions source → cropping when downscale succeeds', async () => {
    render(<CameraCaptureModal playerId={1} onClose={vi.fn()} onSaved={vi.fn()} />);
    await reachCroppingStage();

    expect(screen.getByTestId('camera-capture-modal').getAttribute('data-fsm-stage')).toBe('cropping');
    expect(downscaleImageBlob).toHaveBeenCalledTimes(1);
    // Asserts the WS-184 D1 ratification: downscale max edge is 1500.
    expect(downscaleImageBlob).toHaveBeenCalledWith(expect.any(File), 1500);
  });

  it('returns to source stage with failure copy when downscale fails', async () => {
    downscaleImageBlob.mockRejectedValueOnce(new Error('canvas: 2d context unavailable'));
    render(<CameraCaptureModal playerId={1} onClose={vi.fn()} onSaved={vi.fn()} />);

    await act(async () => {
      fireCameraInputChange();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('camera-capture-error')).toBeDefined());
    expect(screen.getByTestId('camera-capture-error').textContent).toBe(FAILURE_COPY);
    expect(screen.getByTestId('camera-capture-modal').getAttribute('data-fsm-stage')).toBe('source');
    // Both source-stage buttons remain visible so user can re-try Take photo or escape to Upload.
    expect(screen.getByTestId('camera-capture-take')).toBeDefined();
    expect(screen.getByTestId('camera-upload')).toBeDefined();
    // Raw platform error text must NOT reach the user.
    expect(screen.getByTestId('camera-capture-error').textContent).not.toMatch(/2d context/i);
  });
});

describe('CameraCaptureModal — Accept (Bugs B, C, D, E)', () => {
  it('Accept button is disabled until croppedAreaPixels is set (Bug C)', async () => {
    render(<CameraCaptureModal playerId={1} onClose={vi.fn()} onSaved={vi.fn()} />);
    await reachCroppingStage();

    const acceptBtn = screen.getByTestId('camera-capture-accept');
    expect(acceptBtn.hasAttribute('disabled')).toBe(true);

    // Simulate the cropper firing onCropComplete (user positioned the crop).
    act(() => {
      mockOnCropCompleteRef({}, { x: 0, y: 0, width: 200, height: 200 });
    });
    await waitFor(() => {
      expect(screen.getByTestId('camera-capture-accept').hasAttribute('disabled')).toBe(false);
    });
  });

  it('save success fires onSaved(blobId, photoUrl) + onClose; modal closes (Bug B + Bug E)', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const fakeBlob = new Blob(['cropped'], { type: 'image/jpeg' });
    generateCroppedBlob.mockResolvedValueOnce(fakeBlob);
    savePhotoAtomically.mockResolvedValueOnce({ blobId: 42, photoBlobId: 42 });

    render(<CameraCaptureModal playerId={7} onClose={onClose} onSaved={onSaved} />);
    await reachCroppingStage();
    act(() => {
      mockOnCropCompleteRef({}, { x: 0, y: 0, width: 200, height: 200 });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('camera-capture-accept'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(savePhotoAtomically).toHaveBeenCalledWith(7, fakeBlob);
    expect(onSaved).toHaveBeenCalledTimes(1);
    // Bug E fix: onSaved receives BOTH blobId and a photoUrl so the parent
    // can update its avatar overlay without re-fetching the blob from IDB.
    const [calledBlobId, calledPhotoUrl] = onSaved.mock.calls[0];
    expect(calledBlobId).toBe(42);
    expect(calledPhotoUrl).toMatch(/^blob:mock-url-/);
  });

  it('save failure shows standard failure copy and returns FSM to cropping (Bug D)', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    generateCroppedBlob.mockResolvedValueOnce(new Blob(['cropped'], { type: 'image/jpeg' }));
    savePhotoAtomically.mockRejectedValueOnce(
      new Error('Photo save aborted (player not found or write failed)'),
    );

    render(<CameraCaptureModal playerId={7} onClose={onClose} onSaved={onSaved} />);
    await reachCroppingStage();
    act(() => {
      mockOnCropCompleteRef({}, { x: 0, y: 0, width: 200, height: 200 });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('camera-capture-accept'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('camera-capture-error')).toBeDefined());
    expect(screen.getByTestId('camera-capture-error').textContent).toBe(FAILURE_COPY);
    // Raw platform error must NOT leak to the user.
    expect(screen.getByTestId('camera-capture-error').textContent).not.toMatch(/aborted|player not found/i);
    expect(screen.getByTestId('camera-capture-modal').getAttribute('data-fsm-stage')).toBe('cropping');
    // Modal stays open so the user can Retake or re-tap Accept; onClose NOT fired.
    expect(onClose).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('concurrent accept tap during save is impossible — button is disabled (Bug C)', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    let resolveSave;
    generateCroppedBlob.mockResolvedValueOnce(new Blob(['cropped'], { type: 'image/jpeg' }));
    savePhotoAtomically.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));

    render(<CameraCaptureModal playerId={7} onClose={onClose} onSaved={onSaved} />);
    await reachCroppingStage();
    act(() => {
      mockOnCropCompleteRef({}, { x: 0, y: 0, width: 200, height: 200 });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('camera-capture-accept'));
      await Promise.resolve();
    });

    // After first tap, button must be disabled (FSM in 'saving').
    const acceptBtn = screen.getByTestId('camera-capture-accept');
    expect(acceptBtn.hasAttribute('disabled')).toBe(true);
    expect(acceptBtn.textContent).toContain('Saving');

    // A second click attempt while disabled is a no-op — savePhotoAtomically called once.
    fireEvent.click(acceptBtn);
    expect(savePhotoAtomically).toHaveBeenCalledTimes(1);

    // Resolve the in-flight save so the test cleans up.
    await act(async () => {
      resolveSave({ blobId: 1, photoBlobId: 1 });
      await Promise.resolve();
    });
  });
});

describe('CameraCaptureModal — Retake', () => {
  it('returns to source stage and clears error after a save failure', async () => {
    generateCroppedBlob.mockResolvedValueOnce(new Blob(['cropped'], { type: 'image/jpeg' }));
    savePhotoAtomically.mockRejectedValueOnce(new Error('any error'));

    render(<CameraCaptureModal playerId={1} onClose={vi.fn()} onSaved={vi.fn()} />);
    await reachCroppingStage();
    act(() => {
      mockOnCropCompleteRef({}, { x: 0, y: 0, width: 200, height: 200 });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('camera-capture-accept'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(screen.getByTestId('camera-capture-error')).toBeDefined());
    fireEvent.click(screen.getByTestId('camera-capture-retake'));

    await waitFor(() => {
      expect(screen.getByTestId('camera-capture-modal').getAttribute('data-fsm-stage')).toBe('source');
    });
    expect(screen.queryByTestId('camera-capture-error')).toBeNull();
  });
});

describe('CameraCaptureModal — onAcceptOverride (prototype path)', () => {
  it('invokes onAcceptOverride and closes without calling savePhotoAtomically/onSaved', async () => {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const onAcceptOverride = vi.fn(async () => {});
    generateCroppedBlob.mockResolvedValueOnce(new Blob(['cropped'], { type: 'image/jpeg' }));

    render(
      <CameraCaptureModal
        playerId={1}
        onClose={onClose}
        onSaved={onSaved}
        onAcceptOverride={onAcceptOverride}
      />,
    );
    await reachCroppingStage();
    act(() => {
      mockOnCropCompleteRef({}, { x: 0, y: 0, width: 200, height: 200 });
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('camera-capture-accept'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onAcceptOverride).toHaveBeenCalledTimes(1);
    expect(savePhotoAtomically).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
