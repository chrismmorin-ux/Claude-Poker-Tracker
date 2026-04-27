// @vitest-environment jsdom
/**
 * AnchorObservationModal.test.jsx
 *
 * EAL Phase 6 Stream D B3 — Session 16.
 *
 * Mocks `useAnchorObservationCapture` so tests focus on the modal's UI
 * behavior, not on orchestrator internals (covered in S15 hook suites).
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('../../../../hooks/useAnchorObservationCapture', () => ({
  useAnchorObservationCapture: vi.fn(),
}));

import { useAnchorObservationCapture } from '../../../../hooks/useAnchorObservationCapture';
import { AnchorObservationModal } from '../AnchorObservationModal';

const makeCaptureHook = ({
  draft = null,
  isEnrolled = true,
  saveResult = null,
  save = null,
  discard = vi.fn(),
  updateDraft = vi.fn(),
} = {}) => ({
  draft,
  hasDraft: draft !== null,
  isOpen: true,
  openCapture: vi.fn(),
  closeCapture: vi.fn(),
  isEnrolled,
  updateDraft,
  discard,
  save:
    save ||
    vi.fn(
      () =>
        saveResult || {
          ok: true,
          record: {
            id: 'obs:hand-int:0',
            handId: 'hand-int',
            ownerTags: ['villain-overfold'],
            origin: 'owner-captured',
          },
        },
    ),
});

beforeEach(() => {
  vi.clearAllMocks();
});

// ───────────────────────────────────────────────────────────────────────────
// Render — initial state
// ───────────────────────────────────────────────────────────────────────────

describe('initial render', () => {
  it('renders with title "Tag pattern" and is a labelled dialog', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('heading', { level: 2 })).toHaveTextContent('Tag pattern');
  });

  it('renders all 8 fixed-enum tag chips', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const expected = [
      'villain-overfold',
      'villain-overbluff',
      'villain-overcall',
      'hero-overfolded',
      'unusual-sizing',
      'perception-gap',
      'style-mismatch',
      'session-context',
    ];
    for (const tag of expected) {
      expect(screen.getByRole('button', { name: tag })).toBeInTheDocument();
    }
  });

  it('Save button is disabled before any tag is selected', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('Cancel button is always present and labelled', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders the resume banner when hasDraft is true', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({
      draft: { id: 'draft:hand-int', handId: 'hand-int', ownerTags: ['villain-overfold'] },
    }));
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    expect(screen.getByText(/Resumed your earlier draft/)).toBeInTheDocument();
  });

  it('hides the resume banner when no draft exists', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    expect(screen.queryByText(/Resumed your earlier draft/)).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Tag selection enables Save
// ───────────────────────────────────────────────────────────────────────────

describe('tag selection', () => {
  it('toggling a fixed-enum tag enables Save', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('toggling chip again deselects it (Save disables again)', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const chip = screen.getByRole('button', { name: 'villain-overfold' });
    fireEvent.click(chip); // on
    fireEvent.click(chip); // off
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('aria-pressed reflects selection state', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const chip = screen.getByRole('button', { name: 'villain-overfold' });
    expect(chip).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(chip);
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('custom tag alone does NOT enable Save (must have ≥1 enum)', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const input = screen.getByLabelText('Custom tag (optional)');
    fireEvent.change(input, { target: { value: 'custom-thing' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add custom tag' }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('custom tag is added on Enter key', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const input = screen.getByLabelText('Custom tag (optional)');
    fireEvent.change(input, { target: { value: 'custom-tag-enter' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('custom-tag-enter')).toBeInTheDocument();
  });

  it('Add button is disabled when custom tag input is empty', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Add custom tag' })).toBeDisabled();
  });

  it('selected custom tags can be removed via the X button', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const input = screen.getByLabelText('Custom tag (optional)');
    fireEvent.change(input, { target: { value: 'removable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add custom tag' }));
    expect(screen.getByText('removable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Remove tag removable' }));
    expect(screen.queryByText('removable')).toBeNull();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Note + char counter
// ───────────────────────────────────────────────────────────────────────────

describe('note', () => {
  it('renders the note textarea + 0/280 counter', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    expect(screen.getByLabelText(/Note \(optional/)).toBeInTheDocument();
    expect(screen.getByTestId('anchor-note-counter')).toHaveTextContent('0/280');
  });

  it('updates counter on note input', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Note \(optional/), {
      target: { value: 'hello' },
    });
    expect(screen.getByTestId('anchor-note-counter')).toHaveTextContent('5/280');
  });

  it('counter aria-live becomes polite at ≥260 chars', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const textarea = screen.getByLabelText(/Note \(optional/);
    fireEvent.change(textarea, { target: { value: 'x'.repeat(259) } });
    expect(screen.getByTestId('anchor-note-counter'))
      .toHaveAttribute('aria-live', 'off');
    fireEvent.change(textarea, { target: { value: 'x'.repeat(260) } });
    expect(screen.getByTestId('anchor-note-counter'))
      .toHaveAttribute('aria-live', 'polite');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Incognito toggle (red line #9 — primary-visible)
// ───────────────────────────────────────────────────────────────────────────

describe('incognito toggle', () => {
  it('is primary-visible when enrolled (default off)', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ isEnrolled: true }));
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const toggle = screen.getByTestId('anchor-incognito-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).not.toBeChecked();
    expect(toggle).not.toBeDisabled();
  });

  it('is forced-on + disabled when not-enrolled (red line #9 + I-WR-5)', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ isEnrolled: false }));
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const toggle = screen.getByTestId('anchor-incognito-toggle');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
  });

  it('shows enrollment-off explainer when not-enrolled', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ isEnrolled: false }));
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    expect(screen.getByText(/Enrollment is off in Settings/)).toBeInTheDocument();
  });

  it('user can toggle on when enrolled', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ isEnrolled: true }));
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const toggle = screen.getByTestId('anchor-incognito-toggle');
    fireEvent.click(toggle);
    expect(toggle).toBeChecked();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Save flow
// ───────────────────────────────────────────────────────────────────────────

describe('save', () => {
  it('passes selected tags + note + incognito to save() and closes on ok', () => {
    const save = vi.fn(() => ({
      ok: true,
      record: {
        id: 'obs:hand-int:0',
        handId: 'hand-int',
        ownerTags: ['villain-overfold'],
      },
    }));
    const onClose = vi.fn();
    const onSaved = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ save, isEnrolled: true }));
    render(
      <AnchorObservationModal
        handId="hand-int"
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.change(screen.getByLabelText(/Note \(optional/), {
      target: { value: 'flush board' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0][0]).toMatchObject({
      ownerTags: ['villain-overfold'],
      note: 'flush board',
      contributesToCalibration: true, // enrolled, not incognito
    });
    expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'obs:hand-int:0' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('sends contributesToCalibration=false when incognito is on', () => {
    const save = vi.fn(() => ({ ok: true, record: { id: 'x' } }));
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ save, isEnrolled: true }));
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.click(screen.getByTestId('anchor-incognito-toggle'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(save.mock.calls[0][0].contributesToCalibration).toBe(false);
  });

  it('renders inline errors + does NOT close on save failure', () => {
    const save = vi.fn(() => ({ ok: false, errors: ['simulated failure'] }));
    const onClose = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ save, isEnrolled: true }));
    render(<AnchorObservationModal handId="hand-int" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('alert')).toHaveTextContent('simulated failure');
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Cancel + dirty-draft confirm sheet
// ───────────────────────────────────────────────────────────────────────────

describe('cancel / dirty-draft', () => {
  it('Cancel with no dirty draft closes immediately', () => {
    const onClose = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('anchor-dirty-confirm')).toBeNull();
  });

  it('Cancel with dirty draft routes to confirm sheet', () => {
    const onClose = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('anchor-dirty-confirm')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Discard from confirm sheet calls discard() + onClose', () => {
    const onClose = vi.fn();
    const discard = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ discard }));
    render(<AnchorObservationModal handId="hand-int" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard draft' }));
    expect(discard).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Keep-for-later from confirm sheet closes WITHOUT calling discard', () => {
    const onClose = vi.fn();
    const discard = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook({ discard }));
    render(<AnchorObservationModal handId="hand-int" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep draft for later' }));
    expect(discard).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Back-to-capture from confirm sheet returns to the form', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('anchor-dirty-confirm')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to capture' }));
    expect(screen.queryByTestId('anchor-dirty-confirm')).toBeNull();
    // Form is back; tag chip still selected
    expect(screen.getByRole('button', { name: 'villain-overfold' }))
      .toHaveAttribute('aria-pressed', 'true');
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Esc + backdrop close
// ───────────────────────────────────────────────────────────────────────────

describe('keyboard + backdrop dismissal', () => {
  it('Esc with no dirty draft closes immediately', () => {
    const onClose = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc with dirty draft routes to confirm sheet (does not close)', () => {
    const onClose = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByTestId('anchor-dirty-confirm')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Esc inside confirm sheet returns to capture form', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('anchor-dirty-confirm')).toBeNull();
  });

  it('backdrop click routes through dirty-draft check', () => {
    const onClose = vi.fn();
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    const { container } = render(
      <AnchorObservationModal handId="hand-int" onClose={onClose} />,
    );
    const backdrop = container.querySelector('[role="presentation"]');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);

    onClose.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'villain-overfold' }));
    fireEvent.click(backdrop);
    expect(screen.getByTestId('anchor-dirty-confirm')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────────────────────────────────────────────────
// Streets + actions
// ───────────────────────────────────────────────────────────────────────────

describe('street + action selection', () => {
  it('renders 5 street options (whole hand + 4 streets)', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(<AnchorObservationModal handId="hand-int" onClose={vi.fn()} />);
    const radiogroup = screen.getByRole('radiogroup', { name: 'Street selection' });
    expect(within(radiogroup).getAllByRole('radio')).toHaveLength(5);
  });

  it('disables specified streets via disabledStreets prop', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(
      <AnchorObservationModal
        handId="hand-int"
        onClose={vi.fn()}
        disabledStreets={['turn', 'river']}
      />,
    );
    const radios = screen.getAllByRole('radio');
    const turnRadio = radios.find((r) => r.value === 'turn');
    const riverRadio = radios.find((r) => r.value === 'river');
    expect(turnRadio).toBeDisabled();
    expect(riverRadio).toBeDisabled();
  });

  it('does not render the action dropdown when no street is selected', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(
      <AnchorObservationModal
        handId="hand-int"
        onClose={vi.fn()}
        availableActions={[
          { value: 0, label: 'check' },
          { value: 1, label: 'bet 50%' },
        ]}
      />,
    );
    expect(screen.queryByLabelText(/Anchor to action/)).toBeNull();
  });

  it('renders the action dropdown when a street is selected and actions are provided', () => {
    useAnchorObservationCapture.mockReturnValue(makeCaptureHook());
    render(
      <AnchorObservationModal
        handId="hand-int"
        onClose={vi.fn()}
        availableActions={[
          { value: 0, label: 'check' },
          { value: 1, label: 'bet 50%' },
        ]}
      />,
    );
    const turnRadio = screen.getAllByRole('radio').find((r) => r.value === 'turn');
    fireEvent.click(turnRadio);
    expect(screen.getByLabelText(/Anchor to action/)).toBeInTheDocument();
  });
});
