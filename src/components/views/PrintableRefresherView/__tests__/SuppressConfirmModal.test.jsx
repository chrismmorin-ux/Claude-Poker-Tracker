// @vitest-environment jsdom
/**
 * SuppressConfirmModal.test.jsx — confirm + cancel + un-suppress flow.
 *
 * PRF Phase 5 — Session 19 (PRF-G5-UI).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuppressConfirmModal } from '../SuppressConfirmModal';

describe('SuppressConfirmModal — suppress flow', () => {
  it('renders title with class name', () => {
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Suppress math class');
  });

  it('renders explainer copy that is CD-clean (no engagement / no imperative)', () => {
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const text = screen.getByRole('dialog').textContent;
    expect(text).not.toMatch(/master|streak|level up|unlock|trending|you must|always|never/i);
  });

  it('Confirm button is disabled when checkbox not ticked', () => {
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const confirmBtn = screen.getByRole('button', { name: /Suppress class/i });
    expect(confirmBtn).toBeDisabled();
  });

  it('Confirm button enables after checkbox ticked', () => {
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    const confirmBtn = screen.getByRole('button', { name: /Suppress class/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it('onConfirm fires after checkbox + Confirm button click', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Suppress class/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
  });

  it('Cancel button always enabled and fires onCancel', () => {
    const onCancel = vi.fn();
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc keypress fires onCancel', () => {
    const onCancel = vi.fn();
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalled();
  });

  it('backdrop click fires onCancel', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={onCancel} />
    );
    const backdrop = container.querySelector('.refresher-modal-backdrop');
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows error message when onConfirm rejects', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('writer rejected'));
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Suppress class/i }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('writer rejected'));
  });
});

describe('SuppressConfirmModal — un-suppress flow', () => {
  it('renders un-suppress title when currentlySuppressed=true', () => {
    render(<SuppressConfirmModal classId="exceptions" currentlySuppressed={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Un-suppress exceptions class');
  });

  it('uses different explainer copy for un-suppress', () => {
    render(<SuppressConfirmModal classId="exceptions" currentlySuppressed={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/will appear in the catalog and print-export again/i)).toBeInTheDocument();
  });

  it('button label changes to "Un-suppress class"', () => {
    render(<SuppressConfirmModal classId="exceptions" currentlySuppressed={true} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Un-suppress class/i })).toBeInTheDocument();
  });
});

describe('SuppressConfirmModal — accessibility', () => {
  it('dialog has aria-modal=true and labelledby', () => {
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'suppress-modal-title');
  });

  it('Cancel + Confirm buttons each have ≥44px tap targets', () => {
    render(<SuppressConfirmModal classId="math" currentlySuppressed={false} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Cancel/i })).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByRole('button', { name: /Suppress class/i })).toHaveStyle({ minHeight: '44px' });
  });
});
