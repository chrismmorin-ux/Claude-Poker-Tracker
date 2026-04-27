// @vitest-environment jsdom
/**
 * RefresherSettings.test.jsx — Settings section for the Printable Refresher.
 *
 * PRF Phase 5 — Session 24 (PRF-G5-UI).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const patchConfigMock = vi.fn().mockResolvedValue(undefined);
let mockState;

vi.mock('../../../../contexts', () => ({
  useRefresher: () => mockState,
}));

import { RefresherSettings } from '../RefresherSettings';

beforeEach(() => {
  vi.clearAllMocks();
  mockState = {
    config: { notifications: { staleness: false } },
    patchConfig: patchConfigMock,
  };
});

describe('RefresherSettings — render', () => {
  it('renders the section heading "Printable Refresher"', () => {
    render(<RefresherSettings />);
    expect(screen.getByRole('heading', { level: 3, name: 'Printable Refresher' })).toBeInTheDocument();
  });

  it('renders the staleness-toggle label + explainer copy', () => {
    render(<RefresherSettings />);
    expect(screen.getByText('Show staleness banner')).toBeInTheDocument();
    expect(screen.getByText(/Surface a banner.*Default is off/i)).toBeInTheDocument();
  });

  it('renders Off + On buttons in a labeled group', () => {
    render(<RefresherSettings />);
    expect(screen.getByRole('group', { name: /Staleness banner toggle/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Off' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'On' })).toBeInTheDocument();
  });

  it('exposes data-testid="refresher-settings-section" for CI introspection', () => {
    const { container } = render(<RefresherSettings />);
    expect(container.querySelector('[data-testid="refresher-settings-section"]')).not.toBeNull();
  });
});

describe('RefresherSettings — aria-pressed reflects staleness state', () => {
  it('Off button aria-pressed=true when staleness is false (default)', () => {
    render(<RefresherSettings />);
    expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('On button aria-pressed=true when staleness is true', () => {
    mockState.config = { notifications: { staleness: true } };
    render(<RefresherSettings />);
    expect(screen.getByRole('button', { name: 'On' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('Off is the default when notifications field is missing', () => {
    mockState.config = {};
    render(<RefresherSettings />);
    expect(screen.getByRole('button', { name: 'Off' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('RefresherSettings — accessibility', () => {
  it('all buttons have minHeight ≥ 44px (H-ML06)', () => {
    render(<RefresherSettings />);
    screen.getAllByRole('button').forEach((b) => {
      // Tailwind class min-h-[44px] resolves to minHeight: 44px in the rendered style
      const style = window.getComputedStyle(b);
      // Vitest jsdom doesn't compute Tailwind; check the className instead
      expect(b.className).toMatch(/min-h-\[44px\]/);
    });
  });
});

describe('RefresherSettings — patchConfig wiring', () => {
  it('clicking On calls patchConfig({ notifications: { staleness: true } })', async () => {
    render(<RefresherSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    await waitFor(() => {
      expect(patchConfigMock).toHaveBeenCalledWith({
        notifications: { staleness: true },
      });
    });
  });

  it('clicking Off calls patchConfig({ notifications: { staleness: false } })', async () => {
    mockState.config = { notifications: { staleness: true } };
    render(<RefresherSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'Off' }));
    await waitFor(() => {
      expect(patchConfigMock).toHaveBeenCalledWith({
        notifications: { staleness: false },
      });
    });
  });

  it('rapid double-click is safely guarded by pending flag (only first call dispatches)', async () => {
    let resolveFn;
    patchConfigMock.mockImplementationOnce(() => new Promise((r) => { resolveFn = r; }));
    render(<RefresherSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    expect(patchConfigMock).toHaveBeenCalledTimes(1);
    resolveFn();
  });

  it('writer rejection surfaces inline as role="alert"', async () => {
    patchConfigMock.mockRejectedValueOnce(new Error('Boom — invalid patch'));
    render(<RefresherSettings />);
    fireEvent.click(screen.getByRole('button', { name: 'On' }));
    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toHaveTextContent(/Boom — invalid patch/);
    });
  });
});
