// @vitest-environment jsdom
/**
 * AccountSection.test.jsx — F9 dismissal behavior only.
 *
 * Existing AccountSection has zero test coverage today; full coverage is
 * its own backlog candidate. This file scopes to W4-A4-F9: localStorage-
 * backed "I'll stay local" dismissal of the guest-mode Sign-In pitch.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AccountSection } from '../AccountSection';

// Default useAuth shape — guest, no errors, nothing wired. Individual tests
// override fields as needed via mockReturnValueOnce on the spy.
const mockAuth = {
  user: null,
  isGuest: true,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  hasEmailProvider: false,
  hasGoogleProvider: false,
  signOut: vi.fn(),
  updatePassword: vi.fn(),
  linkGoogleAccount: vi.fn(),
  unlinkGoogleAccount: vi.fn(),
  deleteAccount: vi.fn(),
  clearError: vi.fn(),
};

vi.mock('../../../contexts', () => ({
  useAuth: () => mockAuth,
}));

// Mock lucide-react icons — minimal stubs.
vi.mock('lucide-react', () => ({
  User: () => <span data-testid="user-icon" />,
  Mail: () => <span data-testid="mail-icon" />,
  LogOut: () => <span data-testid="logout-icon" />,
  Trash2: () => <span data-testid="trash-icon" />,
  Key: () => <span data-testid="key-icon" />,
  Shield: () => <span data-testid="shield-icon" />,
  Link2: () => <span data-testid="link-icon" />,
  Unlink: () => <span data-testid="unlink-icon" />,
}));

// Mock children that AccountSection only uses on the authenticated path
// (these tests stay on the guest path, but the imports must resolve).
vi.mock('../ConfirmDeleteModal', () => ({
  ConfirmDeleteModal: () => null,
}));
vi.mock('../PasswordInput', () => ({
  PasswordInput: () => null,
}));

beforeEach(() => {
  try { localStorage.clear(); } catch {}
});

describe('AccountSection — W4-A4-F9 dismissal', () => {
  const onNavigateToLogin = vi.fn();
  const onNavigateToSignup = vi.fn();
  const onShowToast = vi.fn();

  beforeEach(() => {
    onNavigateToLogin.mockClear();
    onNavigateToSignup.mockClear();
    onShowToast.mockClear();
  });

  it('renders the full guest pitch panel when localStorage is empty', () => {
    render(
      <AccountSection
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onShowToast={onShowToast}
      />
    );

    expect(screen.getByText(/You.*using Poker Tracker as a guest/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /I.*ll stay local/ })).toBeInTheDocument();
  });

  it('clicking "I\'ll stay local" persists to localStorage and switches to the footer link', () => {
    render(
      <AccountSection
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onShowToast={onShowToast}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /I.*ll stay local/ }));

    expect(localStorage.getItem('accountSection.dismissed')).toBe('1');
    // Pitch panel collapses; footer link is the only remaining surface
    expect(screen.queryByText(/using Poker Tracker as a guest/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Account' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in to sync across devices/ })).toBeInTheDocument();
  });

  it('renders only the footer link when localStorage flag is preset to "1"', () => {
    localStorage.setItem('accountSection.dismissed', '1');

    render(
      <AccountSection
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onShowToast={onShowToast}
      />
    );

    expect(screen.queryByText(/using Poker Tracker as a guest/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign in to sync across devices/ })).toBeInTheDocument();
  });

  it('clicking the footer link calls onNavigateToLogin', () => {
    localStorage.setItem('accountSection.dismissed', '1');

    render(
      <AccountSection
        onNavigateToLogin={onNavigateToLogin}
        onNavigateToSignup={onNavigateToSignup}
        onShowToast={onShowToast}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Sign in to sync across devices/ }));

    expect(onNavigateToLogin).toHaveBeenCalledTimes(1);
  });
});
