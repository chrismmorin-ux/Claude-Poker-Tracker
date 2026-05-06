// @vitest-environment jsdom
/**
 * CameraCaptureModal smoke tests.
 *
 * The full 3-stage flow (source → crop → save) involves react-easy-crop
 * which renders an interactive canvas-backed cropper not meaningfully
 * unit-testable in jsdom. The pinch/drag/zoom interactions and canvas
 * blob generation belong in Playwright (visual regression suite).
 *
 * Coverage here is what's tractable in jsdom:
 *   - Initial render is the 'source' stage with both Camera and Upload
 *     buttons.
 *   - Close + Cancel buttons fire onClose.
 *
 * Replaces the prior 8-test suite that asserted the old 2-stage flow
 * with the cropToSquare auto-crop pipeline (removed 2026-05-06 in favor
 * of manual pinch-zoom + drag positioning per owner ask).
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CameraCaptureModal } from '../CameraCaptureModal';

// react-easy-crop renders a Cropper that uses real DOM canvas APIs —
// stub it so jsdom doesn't crash.
vi.mock('react-easy-crop', () => ({
  default: () => <div data-testid="mock-cropper" />,
}));

vi.mock('../../../../utils/persistence/savePhotoAtomically', () => ({
  savePhotoAtomically: vi.fn(),
}));

vi.mock('../../../../utils/playerMatching/generateCroppedBlob', () => ({
  generateCroppedBlob: vi.fn(),
}));

describe('CameraCaptureModal — smoke', () => {
  it('renders the source stage with Take / Upload buttons on mount', () => {
    render(<CameraCaptureModal playerId={1} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByTestId('camera-capture-modal')).toBeDefined();
    expect(screen.getByTestId('camera-capture-stage-source')).toBeDefined();
    expect(screen.getByTestId('camera-capture-take')).toBeDefined();
    expect(screen.getByTestId('camera-upload')).toBeDefined();
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
