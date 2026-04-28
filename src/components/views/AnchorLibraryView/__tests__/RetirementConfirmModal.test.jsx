/**
 * RetirementConfirmModal.test.jsx — confirm modal render + 2-tap-reset gating.
 *
 * EAL Phase 6 — Session 21 (S21).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetirementConfirmModal } from '../RetirementConfirmModal';
import { buildRetirementCopy } from '../../../../utils/anchorLibrary/retirementCopy';

const sampleAnchor = {
  id: 'anchor:test:1',
  archetypeName: 'Nit Over-Fold to River Overbet',
  status: 'active',
};

describe('RetirementConfirmModal — render gate', () => {
  it('returns null when copy=null (modal closed)', () => {
    const { container } = render(<RetirementConfirmModal copy={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders dialog when copy bundle provided', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} />);
    expect(screen.getByTestId('retirement-modal')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders title + subText', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} />);
    expect(screen.getByTestId('retirement-modal-title').textContent).toContain('Retire');
    expect(screen.getByTestId('retirement-modal-title').textContent).toContain(sampleAnchor.archetypeName);
    expect(screen.getByTestId('retirement-modal-subtext').textContent).toContain('Retired anchors');
  });

  it('exposes data-action + data-destructive attributes', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} />);
    const dialog = screen.getByTestId('retirement-modal');
    expect(dialog.getAttribute('data-action')).toBe('retire');
    expect(dialog.getAttribute('data-destructive')).toBe('false');
  });

  it('aria-labelledby + aria-describedby point to title + subtext IDs', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} />);
    const dialog = screen.getByTestId('retirement-modal');
    expect(dialog.getAttribute('aria-labelledby')).toBe('retirement-modal-title');
    expect(dialog.getAttribute('aria-describedby')).toBe('retirement-modal-subtext');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });
});

describe('RetirementConfirmModal — Cancel + Confirm dispatch', () => {
  it('Cancel button invokes onCancel', () => {
    const onCancel = vi.fn();
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('retirement-modal-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Confirm button invokes onConfirm (non-destructive)', () => {
    const onConfirm = vi.fn();
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('retirement-modal-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('Cancel + Confirm buttons have ≥44×44 tap targets', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} />);
    const cancel = screen.getByTestId('retirement-modal-cancel');
    const confirm = screen.getByTestId('retirement-modal-confirm');
    expect(parseInt(cancel.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
    expect(parseInt(confirm.style.minHeight, 10)).toBeGreaterThanOrEqual(44);
  });

  it('does not crash when callbacks are omitted', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} />);
    expect(() => fireEvent.click(screen.getByTestId('retirement-modal-cancel'))).not.toThrow();
    expect(() => fireEvent.click(screen.getByTestId('retirement-modal-confirm'))).not.toThrow();
  });
});

describe('RetirementConfirmModal — Reset variation (destructive 2-tap)', () => {
  it('shows destructive checkbox label', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('reset', sampleAnchor)} />);
    expect(screen.getByTestId('retirement-modal-destructive-checkbox-label')).toBeInTheDocument();
    expect(screen.getByTestId('retirement-modal-destructive-checkbox-label').textContent).toContain('I understand');
  });

  it('Confirm button is disabled until checkbox ticked', () => {
    const onConfirm = vi.fn();
    render(<RetirementConfirmModal copy={buildRetirementCopy('reset', sampleAnchor)} onConfirm={onConfirm} />);
    const confirm = screen.getByTestId('retirement-modal-confirm');
    expect(confirm.getAttribute('aria-disabled')).toBe('true');
    expect(confirm.getAttribute('data-confirm-disabled')).toBe('true');
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('checkbox tick enables Confirm', () => {
    const onConfirm = vi.fn();
    render(<RetirementConfirmModal copy={buildRetirementCopy('reset', sampleAnchor)} onConfirm={onConfirm} />);
    const checkbox = screen.getByTestId('retirement-modal-destructive-checkbox');
    fireEvent.click(checkbox);
    const confirm = screen.getByTestId('retirement-modal-confirm');
    expect(confirm.getAttribute('data-confirm-disabled')).toBe('false');
    fireEvent.click(confirm);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('exposes data-destructive=true on the dialog', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('reset', sampleAnchor)} />);
    expect(screen.getByTestId('retirement-modal').getAttribute('data-destructive')).toBe('true');
  });

  it('non-destructive variants do NOT render the checkbox', () => {
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} />);
    expect(screen.queryByTestId('retirement-modal-destructive-checkbox')).toBeNull();
    expect(screen.queryByTestId('retirement-modal-destructive-checkbox-label')).toBeNull();
  });

  it('reopening the same destructive variant resets checkbox to unticked', () => {
    const { rerender } = render(<RetirementConfirmModal copy={buildRetirementCopy('reset', sampleAnchor)} />);
    fireEvent.click(screen.getByTestId('retirement-modal-destructive-checkbox'));
    expect(screen.getByTestId('retirement-modal-confirm').getAttribute('data-confirm-disabled')).toBe('false');

    // Close, reopen with different anchor → checkbox should reset
    rerender(<RetirementConfirmModal copy={null} />);
    rerender(<RetirementConfirmModal copy={buildRetirementCopy('reset', { id: 'anchor:test:2', archetypeName: 'Other' })} />);
    expect(screen.getByTestId('retirement-modal-confirm').getAttribute('data-confirm-disabled')).toBe('true');
  });
});

describe('RetirementConfirmModal — backdrop + Escape close paths', () => {
  it('clicking the backdrop invokes onCancel', () => {
    const onCancel = vi.fn();
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('retirement-modal-backdrop'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the dialog does NOT trigger backdrop close', () => {
    const onCancel = vi.fn();
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} onCancel={onCancel} />);
    fireEvent.click(screen.getByTestId('retirement-modal'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Escape key invokes onCancel', () => {
    const onCancel = vi.fn();
    render(<RetirementConfirmModal copy={buildRetirementCopy('retire', sampleAnchor)} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Escape key does nothing when modal is closed (copy=null)', () => {
    const onCancel = vi.fn();
    render(<RetirementConfirmModal copy={null} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).not.toHaveBeenCalled();
  });
});
