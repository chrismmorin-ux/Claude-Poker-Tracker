// @vitest-environment jsdom
/**
 * VenuesManager.test.jsx — custom-venue CRUD + per-venue notes.
 *
 * Phase 1 — Sessions View Improvement (2026-06-06). VenuesManager is a pure
 * props component (no context), so no provider wrapper is needed.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VenuesManager } from '../VenuesManager';

const buildProps = (overrides = {}) => ({
  settings: { customVenues: [] },
  addCustomVenue: vi.fn(() => true),
  removeCustomVenue: vi.fn(),
  setVenueNote: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('VenuesManager', () => {
  describe('add form', () => {
    it('renders a name input and a notes textarea', () => {
      render(<VenuesManager {...buildProps()} />);
      expect(screen.getByPlaceholderText('Enter venue name')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Notes for this venue (optional)')).toBeInTheDocument();
    });

    it('adds a venue with name and notes', () => {
      const props = buildProps();
      render(<VenuesManager {...props} />);

      fireEvent.change(screen.getByPlaceholderText('Enter venue name'), {
        target: { value: 'New Card Room' },
      });
      fireEvent.change(screen.getByPlaceholderText('Notes for this venue (optional)'), {
        target: { value: 'soft 1/3' },
      });
      fireEvent.click(screen.getByText('Add'));

      expect(props.addCustomVenue).toHaveBeenCalledWith('New Card Room', 'soft 1/3');
    });

    it('shows an error when name is empty', () => {
      const props = buildProps();
      render(<VenuesManager {...props} />);

      fireEvent.click(screen.getByText('Add'));

      expect(screen.getByText('Venue name is required')).toBeInTheDocument();
      expect(props.addCustomVenue).not.toHaveBeenCalled();
    });

    it('shows a duplicate error when add returns false', () => {
      const props = buildProps({ addCustomVenue: vi.fn(() => false) });
      render(<VenuesManager {...props} />);

      fireEvent.change(screen.getByPlaceholderText('Enter venue name'), {
        target: { value: 'Online' },
      });
      fireEvent.click(screen.getByText('Add'));

      expect(screen.getByText('Venue already exists')).toBeInTheDocument();
    });

    it('clears the inputs after a successful add', () => {
      const props = buildProps();
      render(<VenuesManager {...props} />);

      const nameInput = screen.getByPlaceholderText('Enter venue name');
      const noteInput = screen.getByPlaceholderText('Notes for this venue (optional)');
      fireEvent.change(nameInput, { target: { value: 'New Card Room' } });
      fireEvent.change(noteInput, { target: { value: 'soft 1/3' } });
      fireEvent.click(screen.getByText('Add'));

      expect(nameInput).toHaveValue('');
      expect(noteInput).toHaveValue('');
    });
  });

  describe('existing venues list', () => {
    const props = () =>
      buildProps({
        settings: {
          customVenues: [
            { name: 'Casino A', notes: 'tight tables' },
            { name: 'Casino B', notes: '' },
          ],
        },
      });

    it('renders each custom venue with its name and note', () => {
      render(<VenuesManager {...props()} />);
      expect(screen.getByText('Casino A')).toBeInTheDocument();
      expect(screen.getByText('Casino B')).toBeInTheDocument();
      expect(screen.getByDisplayValue('tight tables')).toBeInTheDocument();
    });

    it('shows the empty state when there are no custom venues', () => {
      render(<VenuesManager {...buildProps()} />);
      expect(screen.getByText('No custom venues added yet')).toBeInTheDocument();
    });

    it('commits a note edit on blur', () => {
      const p = props();
      render(<VenuesManager {...p} />);

      const noteField = screen.getByDisplayValue('tight tables');
      fireEvent.change(noteField, { target: { value: 'tight tables, $4 rake' } });
      fireEvent.blur(noteField);

      expect(p.setVenueNote).toHaveBeenCalledWith('Casino A', 'tight tables, $4 rake');
    });

    it('does not dispatch a note change when the note is unchanged', () => {
      const p = props();
      render(<VenuesManager {...p} />);

      const noteField = screen.getByDisplayValue('tight tables');
      fireEvent.blur(noteField);

      expect(p.setVenueNote).not.toHaveBeenCalled();
    });

    it('removes a venue by name', () => {
      const p = props();
      render(<VenuesManager {...p} />);

      // Two "Remove" buttons; click the first (Casino A).
      fireEvent.click(screen.getAllByText('Remove')[0]);

      expect(p.removeCustomVenue).toHaveBeenCalledWith('Casino A');
    });
  });
});
