// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BackToTableBar from '../BackToTableBar';

describe('<BackToTableBar />', () => {
  it('renders title and both buttons', () => {
    render(<BackToTableBar onBack={vi.fn()} onSave={vi.fn()} title="New Player" />);
    expect(screen.getByTestId('back-to-table-btn')).toBeTruthy();
    expect(screen.getByTestId('save-player-btn')).toBeTruthy();
    expect(screen.getByText('New Player')).toBeTruthy();
  });

  it('fires onBack when Back clicked', () => {
    const onBack = vi.fn();
    render(<BackToTableBar onBack={onBack} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('back-to-table-btn'));
    expect(onBack).toHaveBeenCalled();
  });

  it('fires onSave when Save clicked', () => {
    const onSave = vi.fn();
    render(<BackToTableBar onBack={vi.fn()} onSave={onSave} />);
    fireEvent.click(screen.getByTestId('save-player-btn'));
    expect(onSave).toHaveBeenCalled();
  });

  it('renders "Saving…" label and disables Save when isSaving=true', () => {
    render(<BackToTableBar onBack={vi.fn()} onSave={vi.fn()} isSaving />);
    const btn = screen.getByTestId('save-player-btn');
    expect(btn.textContent).toBe('Saving…');
    expect(btn.disabled).toBe(true);
  });

  it('Save is never disabled when not saving (D5 non-blocking)', () => {
    render(<BackToTableBar onBack={vi.fn()} onSave={vi.fn()} />);
    expect(screen.getByTestId('save-player-btn').disabled).toBe(false);
  });
});
