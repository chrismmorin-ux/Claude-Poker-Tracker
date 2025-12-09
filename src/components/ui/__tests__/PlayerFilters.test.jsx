/**
 * PlayerFilters.test.jsx - Tests for PlayerFilters component
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PlayerFilters } from '../PlayerFilters';

describe('PlayerFilters', () => {
  const defaultProps = {
    searchTerm: '',
    setSearchTerm: vi.fn(),
    sortBy: 'lastSeen',
    setSortBy: vi.fn(),
    filterGender: '',
    setFilterGender: vi.fn(),
    filterBuild: '',
    setFilterBuild: vi.fn(),
    filterEthnicity: '',
    setFilterEthnicity: vi.fn(),
    filterFacialHair: '',
    setFilterFacialHair: vi.fn(),
    filterHat: '',
    setFilterHat: vi.fn(),
    filterSunglasses: '',
    setFilterSunglasses: vi.fn(),
    filterTag: '',
    setFilterTag: vi.fn(),
    allStyleTags: ['Tight', 'Aggressive', 'Passive', 'Loose'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders search input', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByPlaceholderText('Search by name or nickname...')).toBeInTheDocument();
    });

    it('renders sort dropdown', () => {
      render(<PlayerFilters {...defaultProps} />);
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });

    it('renders all filter dropdowns', () => {
      render(<PlayerFilters {...defaultProps} />);

      // Check for filter options
      expect(screen.getByText('All Genders')).toBeInTheDocument();
      expect(screen.getByText('All Builds')).toBeInTheDocument();
      expect(screen.getByText('All Ethnicities')).toBeInTheDocument();
      expect(screen.getByText('All Facial Hair')).toBeInTheDocument();
      expect(screen.getByText('Hat?')).toBeInTheDocument();
      expect(screen.getByText('Sunglasses?')).toBeInTheDocument();
      expect(screen.getByText('All Styles')).toBeInTheDocument();
    });
  });

  describe('search functionality', () => {
    it('displays current search term', () => {
      render(<PlayerFilters {...defaultProps} searchTerm="John" />);
      const input = screen.getByPlaceholderText('Search by name or nickname...');
      expect(input).toHaveValue('John');
    });

    it('calls setSearchTerm when typing', () => {
      render(<PlayerFilters {...defaultProps} />);
      const input = screen.getByPlaceholderText('Search by name or nickname...');

      fireEvent.change(input, { target: { value: 'Test' } });

      expect(defaultProps.setSearchTerm).toHaveBeenCalledWith('Test');
    });
  });

  describe('sort functionality', () => {
    it('displays current sort option', () => {
      render(<PlayerFilters {...defaultProps} sortBy="name" />);
      const sortSelect = screen.getAllByRole('combobox')[0];
      expect(sortSelect).toHaveValue('name');
    });

    it('has Last Seen option', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByText('Last Seen')).toBeInTheDocument();
    });

    it('has Name option', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByText('Name')).toBeInTheDocument();
    });

    it('has Hand Count option', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByText('Hand Count')).toBeInTheDocument();
    });

    it('calls setSortBy when changed', () => {
      render(<PlayerFilters {...defaultProps} />);
      const sortSelect = screen.getAllByRole('combobox')[0];

      fireEvent.change(sortSelect, { target: { value: 'handCount' } });

      expect(defaultProps.setSortBy).toHaveBeenCalledWith('handCount');
    });
  });

  describe('gender filter', () => {
    it('calls setFilterGender when changed', () => {
      render(<PlayerFilters {...defaultProps} />);

      const genderSelect = screen.getAllByRole('combobox')[1]; // Second combobox
      fireEvent.change(genderSelect, { target: { value: 'Male' } });

      expect(defaultProps.setFilterGender).toHaveBeenCalledWith('Male');
    });

    it('displays current filter value', () => {
      render(<PlayerFilters {...defaultProps} filterGender="Female" />);
      const genderSelect = screen.getAllByRole('combobox')[1];
      expect(genderSelect).toHaveValue('Female');
    });
  });

  describe('build filter', () => {
    it('calls setFilterBuild when changed', () => {
      render(<PlayerFilters {...defaultProps} />);

      const buildSelect = screen.getAllByRole('combobox')[2];
      fireEvent.change(buildSelect, { target: { value: 'Average' } });

      expect(defaultProps.setFilterBuild).toHaveBeenCalledWith('Average');
    });
  });

  describe('ethnicity filter', () => {
    it('calls setFilterEthnicity when changed', () => {
      render(<PlayerFilters {...defaultProps} />);

      const ethnicitySelect = screen.getAllByRole('combobox')[3];
      fireEvent.change(ethnicitySelect, { target: { value: 'Asian' } });

      expect(defaultProps.setFilterEthnicity).toHaveBeenCalledWith('Asian');
    });
  });

  describe('facial hair filter', () => {
    it('calls setFilterFacialHair when changed', () => {
      render(<PlayerFilters {...defaultProps} />);

      const facialHairSelect = screen.getAllByRole('combobox')[4];
      fireEvent.change(facialHairSelect, { target: { value: 'Full Beard' } });

      expect(defaultProps.setFilterFacialHair).toHaveBeenCalledWith('Full Beard');
    });
  });

  describe('hat filter', () => {
    it('has Wears Hat option', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByText('Wears Hat')).toBeInTheDocument();
    });

    it('has No Hat option', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByText('No Hat')).toBeInTheDocument();
    });

    it('calls setFilterHat when changed', () => {
      render(<PlayerFilters {...defaultProps} />);

      const hatSelect = screen.getAllByRole('combobox')[5];
      fireEvent.change(hatSelect, { target: { value: 'yes' } });

      expect(defaultProps.setFilterHat).toHaveBeenCalledWith('yes');
    });
  });

  describe('sunglasses filter', () => {
    it('has Wears Sunglasses option', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByText('Wears Sunglasses')).toBeInTheDocument();
    });

    it('has No Sunglasses option', () => {
      render(<PlayerFilters {...defaultProps} />);
      expect(screen.getByText('No Sunglasses')).toBeInTheDocument();
    });

    it('calls setFilterSunglasses when changed', () => {
      render(<PlayerFilters {...defaultProps} />);

      const sunglassesSelect = screen.getAllByRole('combobox')[6];
      fireEvent.change(sunglassesSelect, { target: { value: 'no' } });

      expect(defaultProps.setFilterSunglasses).toHaveBeenCalledWith('no');
    });
  });

  describe('style tag filter', () => {
    it('shows all provided style tags', () => {
      render(<PlayerFilters {...defaultProps} />);

      const styleSelect = screen.getAllByRole('combobox')[7];
      fireEvent.mouseDown(styleSelect);

      expect(screen.getByText('Tight')).toBeInTheDocument();
      expect(screen.getByText('Aggressive')).toBeInTheDocument();
      expect(screen.getByText('Passive')).toBeInTheDocument();
      expect(screen.getByText('Loose')).toBeInTheDocument();
    });

    it('calls setFilterTag when changed', () => {
      render(<PlayerFilters {...defaultProps} />);

      const styleSelect = screen.getAllByRole('combobox')[7];
      fireEvent.change(styleSelect, { target: { value: 'Tight' } });

      expect(defaultProps.setFilterTag).toHaveBeenCalledWith('Tight');
    });

    it('handles empty style tags array', () => {
      render(<PlayerFilters {...defaultProps} allStyleTags={[]} />);

      // Should still render without error
      expect(screen.getByText('All Styles')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('search input has flex-1 for flexible width', () => {
      render(<PlayerFilters {...defaultProps} />);
      const input = screen.getByPlaceholderText('Search by name or nickname...');
      expect(input.className).toContain('flex-1');
    });

    it('applies focus styles to inputs', () => {
      render(<PlayerFilters {...defaultProps} />);
      const input = screen.getByPlaceholderText('Search by name or nickname...');
      expect(input.className).toContain('focus:ring-2');
      expect(input.className).toContain('focus:ring-blue-500');
    });

    it('uses grid layout for filter dropdowns', () => {
      const { container } = render(<PlayerFilters {...defaultProps} />);
      const grid = container.querySelector('.grid-cols-7');
      expect(grid).toBeInTheDocument();
    });
  });

  describe('current filter values', () => {
    it('shows all current filter values', () => {
      render(
        <PlayerFilters
          {...defaultProps}
          searchTerm="Test"
          sortBy="handCount"
          filterGender="Male"
          filterHat="yes"
          filterTag="Tight"
        />
      );

      expect(screen.getByPlaceholderText('Search by name or nickname...')).toHaveValue('Test');
      expect(screen.getAllByRole('combobox')[0]).toHaveValue('handCount');
      expect(screen.getAllByRole('combobox')[1]).toHaveValue('Male');
      expect(screen.getAllByRole('combobox')[5]).toHaveValue('yes');
      expect(screen.getAllByRole('combobox')[7]).toHaveValue('Tight');
    });
  });
});
