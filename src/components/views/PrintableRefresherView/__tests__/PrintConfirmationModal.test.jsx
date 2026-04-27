// @vitest-environment jsdom
/**
 * PrintConfirmationModal.test.jsx — modal render + onConfirm wiring + a11y.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PrintConfirmationModal } from '../PrintConfirmationModal';

const baseContext = {
  cardIds: ['PRF-MATH-AUTO-PROFIT', 'PRF-MATH-POT-ODDS'],
  perCardSnapshots: {
    'PRF-MATH-AUTO-PROFIT': { contentHash: 'sha256:a', version: '1' },
    'PRF-MATH-POT-ODDS': { contentHash: 'sha256:b', version: '1' },
  },
  cardCount: 2,
  pageCount: 1,
  pageSize: 'letter',
  cardsPerSheet: 12,
  colorMode: 'auto',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('PrintConfirmationModal — basic render', () => {
  it('renders the title "Confirm batch print"', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Confirm batch print/);
  });

  it('renders the batch summary with cardCount, pageCount, pageSize, cardsPerSheet, colorMode', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const summary = screen.getByText(/about to print/i).parentElement;
    expect(summary.textContent).toMatch(/2/);
    expect(summary.textContent).toMatch(/1/);
    expect(summary.textContent).toMatch(/Letter/);
    expect(summary.textContent).toMatch(/12-up/);
    expect(summary.textContent).toMatch(/Color \(auto\)/);
  });

  it('uses singular for cardCount=1 / pageCount=1', () => {
    render(
      <PrintConfirmationModal
        context={{ ...baseContext, cardCount: 1, pageCount: 1 }}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    // Text contains <strong> tags, so getByText with exact match fails on the
    // multi-node text. Read the parent element's textContent + assert the
    // singular forms appear (no trailing "s" before "across" or end-of-summary).
    const summary = screen.getByText(/about to print/i).parentElement;
    expect(summary.textContent).toMatch(/1 card across/);
    expect(summary.textContent).toMatch(/1 page on/);
  });

  it('renders the date input defaulting to today (YYYY-MM-DD)', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dateInput = screen.getByLabelText(/Print date/);
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    expect(dateInput.value).toBe(`${yyyy}-${mm}-${dd}`);
  });

  it('renders the optional label input with placeholder', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/Batch label/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Home game refresh/)).toBeInTheDocument();
  });

  it('renders the factual reminder copy (CD-1)', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText(/Disable browser headers/)).toBeInTheDocument();
    expect(screen.getByText(/cut off/)).toBeInTheDocument();
  });

  it('renders Cancel + Confirm buttons', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Cancel/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm and open print dialog/ })).toBeInTheDocument();
  });

  it('Confirm button is enabled by default (no checkbox gate, unlike Suppress modal)', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Confirm and open print dialog/ })).not.toBeDisabled();
  });
});

describe('PrintConfirmationModal — accessibility', () => {
  it('dialog has aria-modal=true + aria-labelledby pointing to title', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAttribute('aria-labelledby', 'print-confirm-title');
  });

  it('all buttons have minHeight ≥ 44px (H-ML06)', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    screen.getAllByRole('button').forEach((b) => {
      expect(b).toHaveStyle({ minHeight: '44px' });
    });
  });

  it('date + label inputs have minHeight ≥ 44px', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByLabelText(/Print date/)).toHaveStyle({ minHeight: '44px' });
    expect(screen.getByLabelText(/Batch label/)).toHaveStyle({ minHeight: '44px' });
  });
});

describe('PrintConfirmationModal — interactions', () => {
  it('Cancel button calls onCancel', () => {
    const onCancel = vi.fn();
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /Cancel/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('Esc key fires onCancel', () => {
    const onCancel = vi.fn();
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking the backdrop fires onCancel', () => {
    const onCancel = vi.fn();
    const { container } = render(
      <PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={onCancel} />
    );
    const backdrop = container.querySelector('.refresher-modal-backdrop');
    fireEvent.click(backdrop);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('clicking inside the dialog does NOT fire onCancel', () => {
    const onCancel = vi.fn();
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('typing into the label input updates the value', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const labelInput = screen.getByLabelText(/Batch label/);
    fireEvent.change(labelInput, { target: { value: 'home game' } });
    expect(labelInput.value).toBe('home game');
  });

  it('changing the date input updates the value', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const dateInput = screen.getByLabelText(/Print date/);
    fireEvent.change(dateInput, { target: { value: '2026-04-20' } });
    expect(dateInput.value).toBe('2026-04-20');
  });
});

describe('PrintConfirmationModal — Confirm flow', () => {
  it('Confirm calls onConfirm with { printedAt, label } from inputs', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<PrintConfirmationModal context={baseContext} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Batch label/), { target: { value: 'test-batch' } });
    fireEvent.change(screen.getByLabelText(/Print date/), { target: { value: '2026-04-27' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm and open print dialog/ }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith({ printedAt: '2026-04-27', label: 'test-batch' });
    });
  });

  it('label trims whitespace + null when empty', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<PrintConfirmationModal context={baseContext} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Batch label/), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm and open print dialog/ }));
    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ label: null }));
    });
  });

  it('onConfirm rejection surfaces error inline as role="alert"', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('I-WR-6 perCardSnapshots completeness violation'));
    render(<PrintConfirmationModal context={baseContext} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirm and open print dialog/ }));
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/I-WR-6/);
    });
  });

  it('Confirm button shows "Recording…" during submit', async () => {
    let resolveFn;
    const onConfirm = vi.fn(() => new Promise((r) => { resolveFn = r; }));
    render(<PrintConfirmationModal context={baseContext} onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Confirm and open print dialog/ }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Recording/ })).toBeInTheDocument();
    });
    resolveFn();
  });

  it('Confirm button is disabled when printedAt is empty', () => {
    render(<PrintConfirmationModal context={baseContext} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Print date/), { target: { value: '' } });
    expect(screen.getByRole('button', { name: /Confirm and open print dialog/ })).toBeDisabled();
  });
});

describe('PrintConfirmationModal — handles missing context defensively', () => {
  it('renders with cardCount=0 / pageCount=0 fallback when context is null', () => {
    render(<PrintConfirmationModal context={null} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    const summary = screen.getByText(/about to print/i).parentElement;
    expect(summary.textContent).toMatch(/0 cards/);
    expect(summary.textContent).toMatch(/0 pages/);
  });
});
