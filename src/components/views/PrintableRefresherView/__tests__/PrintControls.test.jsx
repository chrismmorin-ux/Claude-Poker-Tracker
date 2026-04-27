// @vitest-environment jsdom
/**
 * PrintControls.test.jsx — render + W-URC-1 wiring + debounce + accessibility.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

const patchConfigMock = vi.fn().mockResolvedValue(undefined);
let mockPrefs;

vi.mock('../../../../contexts', () => ({
  useRefresher: () => ({
    config: { printPreferences: mockPrefs },
    patchConfig: patchConfigMock,
  }),
}));

import { PrintControls } from '../PrintControls';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockPrefs = {
    pageSize: 'letter',
    cardsPerSheet: 12,
    colorMode: 'auto',
    includeLineage: true,
    includeCodex: false,
  };
});

afterEach(() => {
  vi.useRealTimers();
});

describe('PrintControls — render', () => {
  it('renders all 4 toggle groups (Page, Cards/sheet, Color, Footer)', () => {
    render(<PrintControls />);
    expect(screen.getByText('Page')).toBeInTheDocument();
    expect(screen.getByText('Cards/sheet')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('renders both page-size buttons (Letter / A4)', () => {
    render(<PrintControls />);
    expect(screen.getByRole('button', { name: /Letter/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /A4/ })).toBeInTheDocument();
  });

  it('renders all 4 cards-per-sheet buttons (12 / 6 / 4 / 1)', () => {
    render(<PrintControls />);
    expect(screen.getByRole('button', { name: /12-up/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /6-up/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /4-up/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1-up/ })).toBeInTheDocument();
  });

  it('renders both color-mode buttons (Color / B&W)', () => {
    render(<PrintControls />);
    expect(screen.getByRole('button', { name: /Color \(auto\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Black & white/ })).toBeInTheDocument();
  });

  it('renders the lineage-footer toggle reflecting current state', () => {
    render(<PrintControls />);
    expect(screen.getByRole('button', { name: /Lineage footer: On/ })).toBeInTheDocument();
  });

  it('renders the includeCodex disabled toggle with tooltip + aria-disabled', () => {
    render(<PrintControls />);
    const codex = screen.getByRole('button', { name: /Personal codex: Phase 2\+/ });
    expect(codex).toBeDisabled();
    expect(codex).toHaveAttribute('aria-disabled', 'true');
    expect(codex).toHaveAttribute('title', 'Personal codex export available in Phase 2+');
  });
});

describe('PrintControls — aria-pressed reflects current state', () => {
  it('Letter button has aria-pressed=true when pageSize=letter', () => {
    render(<PrintControls />);
    expect(screen.getByRole('button', { name: /Letter/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /A4/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('12-up button has aria-pressed=true when cardsPerSheet=12', () => {
    render(<PrintControls />);
    expect(screen.getByRole('button', { name: /12-up/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /6-up/ })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Color (auto) button has aria-pressed=true when colorMode=auto', () => {
    render(<PrintControls />);
    expect(screen.getByRole('button', { name: /Color \(auto\)/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Black & white/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('PrintControls — W-URC-1 patchConfig wiring', () => {
  it('clicking A4 schedules patchConfig({ printPreferences: { pageSize: "a4" } }) after debounce', async () => {
    render(<PrintControls />);
    fireEvent.click(screen.getByRole('button', { name: /A4/ }));
    expect(patchConfigMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(patchConfigMock).toHaveBeenCalledWith({
      printPreferences: { pageSize: 'a4' },
    });
  });

  it('clicking 6-up schedules patchConfig with cardsPerSheet=6 after debounce', async () => {
    render(<PrintControls />);
    fireEvent.click(screen.getByRole('button', { name: /6-up/ }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(patchConfigMock).toHaveBeenCalledWith({
      printPreferences: { cardsPerSheet: 6 },
    });
  });

  it('clicking Black & white schedules patchConfig with colorMode=bw after debounce', async () => {
    render(<PrintControls />);
    fireEvent.click(screen.getByRole('button', { name: /Black & white/ }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(patchConfigMock).toHaveBeenCalledWith({
      printPreferences: { colorMode: 'bw' },
    });
  });

  it('toggling Lineage footer flips includeLineage', async () => {
    render(<PrintControls />);
    fireEvent.click(screen.getByRole('button', { name: /Lineage footer: On/ }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(patchConfigMock).toHaveBeenCalledWith({
      printPreferences: { includeLineage: false },
    });
  });

  it('rapid changes within debounce window collapse into a single patchConfig call', async () => {
    render(<PrintControls />);
    fireEvent.click(screen.getByRole('button', { name: /A4/ }));
    fireEvent.click(screen.getByRole('button', { name: /6-up/ }));
    fireEvent.click(screen.getByRole('button', { name: /Black & white/ }));
    expect(patchConfigMock).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(patchConfigMock).toHaveBeenCalledTimes(1);
    expect(patchConfigMock).toHaveBeenCalledWith({
      printPreferences: {
        pageSize: 'a4',
        cardsPerSheet: 6,
        colorMode: 'bw',
      },
    });
  });

  it('clicking includeCodex (disabled) does not call patchConfig', async () => {
    render(<PrintControls />);
    const codex = screen.getByRole('button', { name: /Personal codex: Phase 2\+/ });
    fireEvent.click(codex);
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(patchConfigMock).not.toHaveBeenCalled();
  });

  it('surfaces writer rejection inline as role="alert"', async () => {
    patchConfigMock.mockRejectedValueOnce(new Error('Boom — invalid patch'));
    render(<PrintControls />);
    fireEvent.click(screen.getByRole('button', { name: /A4/ }));
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    // Allow promise rejection to flush
    await act(async () => {
      await Promise.resolve();
    });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(/Boom — invalid patch/);
  });
});

describe('PrintControls — accessibility', () => {
  it('all enabled toggle buttons have minHeight ≥ 44px (H-ML06)', () => {
    render(<PrintControls />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach((b) => {
      // Disabled codex button still has minHeight
      expect(b).toHaveStyle({ minHeight: '44px' });
    });
  });

  it('section has aria-label="Print preferences"', () => {
    const { container } = render(<PrintControls />);
    const section = container.querySelector('section[aria-label="Print preferences"]');
    expect(section).not.toBeNull();
  });
});
