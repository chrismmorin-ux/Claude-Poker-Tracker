/**
 * PhysicalSection.test.jsx - Tests for physical description inputs
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PhysicalSection } from '../PhysicalSection';
import {
  ETHNICITY_OPTIONS,
  BUILD_OPTIONS,
  GENDER_OPTIONS,
  FACIAL_HAIR_OPTIONS,
} from '../../../../constants/playerConstants';

describe('PhysicalSection', () => {
  const defaultProps = {
    ethnicity: '',
    setEthnicity: vi.fn(),
    build: '',
    setBuild: vi.fn(),
    gender: '',
    setGender: vi.fn(),
    facialHair: '',
    setFacialHair: vi.fn(),
    hat: false,
    setHat: vi.fn(),
    sunglasses: false,
    setSunglasses: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(<PhysicalSection {...defaultProps} {...props} />);
  };

  // Helper to get select by text content in label
  const getSelectByLabel = (labelText) => {
    const { container } = render(<PhysicalSection {...defaultProps} />);
    // Find the label element, then find the sibling select
    const labels = container.querySelectorAll('label');
    for (const label of labels) {
      if (label.textContent.includes(labelText)) {
        // Get the parent div and find the select within it
        const parentDiv = label.closest('.mb-3');
        if (parentDiv) {
          return parentDiv.querySelector('select');
        }
      }
    }
    return null;
  };

  describe('rendering', () => {
    it('renders physical description header', () => {
      renderComponent();
      expect(screen.getByText(/physical description/i)).toBeInTheDocument();
    });

    it('has border-t class for top border', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toHaveClass('border-t');
    });

    it('renders ethnicity label', () => {
      renderComponent();
      expect(screen.getByText('Ethnicity')).toBeInTheDocument();
    });

    it('renders build label', () => {
      renderComponent();
      expect(screen.getByText('Build')).toBeInTheDocument();
    });

    it('renders gender label', () => {
      renderComponent();
      expect(screen.getByText('Gender')).toBeInTheDocument();
    });

    it('renders facial hair label', () => {
      renderComponent();
      expect(screen.getByText('Facial Hair')).toBeInTheDocument();
    });
  });

  describe('ethnicity dropdown', () => {
    it('renders ethnicity select', () => {
      renderComponent();
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThanOrEqual(1);
    });

    it('has default empty option', () => {
      renderComponent();
      expect(screen.getByText('Select ethnicity...')).toBeInTheDocument();
    });

    it('renders all ethnicity options', () => {
      renderComponent();
      ETHNICITY_OPTIONS.forEach((option) => {
        expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
      });
    });

    it('displays selected ethnicity', () => {
      renderComponent({ ethnicity: 'Asian' });
      const selects = screen.getAllByRole('combobox');
      const ethnicitySelect = selects[0]; // First select is ethnicity
      expect(ethnicitySelect).toHaveValue('Asian');
    });

    it('calls setEthnicity on change', () => {
      const setEthnicity = vi.fn();
      renderComponent({ setEthnicity });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], { target: { value: 'Hispanic/Latino' } });

      expect(setEthnicity).toHaveBeenCalledWith('Hispanic/Latino');
    });
  });

  describe('build radio buttons', () => {
    it('renders all build options', () => {
      renderComponent();
      BUILD_OPTIONS.forEach((option) => {
        expect(screen.getByRole('radio', { name: option.label })).toBeInTheDocument();
      });
    });

    it('all build radios are unchecked by default', () => {
      renderComponent({ build: '' });
      BUILD_OPTIONS.forEach((option) => {
        expect(screen.getByRole('radio', { name: option.label })).not.toBeChecked();
      });
    });

    it('displays selected build', () => {
      renderComponent({ build: 'Average' });
      expect(screen.getByRole('radio', { name: 'Average' })).toBeChecked();
    });

    it('calls setBuild on change', () => {
      const setBuild = vi.fn();
      renderComponent({ setBuild });

      fireEvent.click(screen.getByRole('radio', { name: 'Heavy' }));

      expect(setBuild).toHaveBeenCalledWith('Heavy');
    });

    it('only one build can be selected', () => {
      renderComponent({ build: 'Slim' });
      expect(screen.getByRole('radio', { name: 'Slim' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Average' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Heavy' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Muscular' })).not.toBeChecked();
    });
  });

  describe('gender radio buttons', () => {
    it('renders all gender options', () => {
      renderComponent();
      GENDER_OPTIONS.forEach((option) => {
        expect(screen.getByRole('radio', { name: option.label })).toBeInTheDocument();
      });
    });

    it('all gender radios are unchecked by default', () => {
      renderComponent({ gender: '' });
      GENDER_OPTIONS.forEach((option) => {
        expect(screen.getByRole('radio', { name: option.label })).not.toBeChecked();
      });
    });

    it('displays selected gender', () => {
      renderComponent({ gender: 'Female' });
      expect(screen.getByRole('radio', { name: 'Female' })).toBeChecked();
    });

    it('calls setGender on change', () => {
      const setGender = vi.fn();
      renderComponent({ setGender });

      fireEvent.click(screen.getByRole('radio', { name: 'Male' }));

      expect(setGender).toHaveBeenCalledWith('Male');
    });
  });

  describe('facial hair dropdown', () => {
    it('renders facial hair select', () => {
      renderComponent();
      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBe(2); // Ethnicity and Facial Hair
    });

    it('has default empty option', () => {
      renderComponent();
      expect(screen.getByText('Select facial hair...')).toBeInTheDocument();
    });

    it('renders all facial hair options', () => {
      renderComponent();
      FACIAL_HAIR_OPTIONS.forEach((option) => {
        expect(screen.getByRole('option', { name: option })).toBeInTheDocument();
      });
    });

    it('displays selected facial hair', () => {
      renderComponent({ facialHair: 'Full Beard' });
      const selects = screen.getAllByRole('combobox');
      const facialHairSelect = selects[1]; // Second select is facial hair
      expect(facialHairSelect).toHaveValue('Full Beard');
    });

    it('calls setFacialHair on change', () => {
      const setFacialHair = vi.fn();
      renderComponent({ setFacialHair });

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[1], { target: { value: 'Goatee' } });

      expect(setFacialHair).toHaveBeenCalledWith('Goatee');
    });
  });

  describe('hat checkbox', () => {
    it('renders hat checkbox', () => {
      renderComponent();
      expect(screen.getByRole('checkbox', { name: /wears hat/i })).toBeInTheDocument();
    });

    it('hat is unchecked by default', () => {
      renderComponent({ hat: false });
      expect(screen.getByRole('checkbox', { name: /wears hat/i })).not.toBeChecked();
    });

    it('displays checked hat when true', () => {
      renderComponent({ hat: true });
      expect(screen.getByRole('checkbox', { name: /wears hat/i })).toBeChecked();
    });

    it('calls setHat on change', () => {
      const setHat = vi.fn();
      renderComponent({ setHat });

      fireEvent.click(screen.getByRole('checkbox', { name: /wears hat/i }));

      expect(setHat).toHaveBeenCalledWith(true);
    });
  });

  describe('sunglasses checkbox', () => {
    it('renders sunglasses checkbox', () => {
      renderComponent();
      expect(screen.getByRole('checkbox', { name: /wears sunglasses/i })).toBeInTheDocument();
    });

    it('sunglasses is unchecked by default', () => {
      renderComponent({ sunglasses: false });
      expect(screen.getByRole('checkbox', { name: /wears sunglasses/i })).not.toBeChecked();
    });

    it('displays checked sunglasses when true', () => {
      renderComponent({ sunglasses: true });
      expect(screen.getByRole('checkbox', { name: /wears sunglasses/i })).toBeChecked();
    });

    it('calls setSunglasses on change', () => {
      const setSunglasses = vi.fn();
      renderComponent({ setSunglasses });

      fireEvent.click(screen.getByRole('checkbox', { name: /wears sunglasses/i }));

      expect(setSunglasses).toHaveBeenCalledWith(true);
    });
  });

  describe('combined state', () => {
    it('renders all selected values correctly', () => {
      renderComponent({
        ethnicity: 'Asian',
        build: 'Muscular',
        gender: 'Male',
        facialHair: 'Clean-shaven',
        hat: true,
        sunglasses: true,
      });

      const selects = screen.getAllByRole('combobox');
      expect(selects[0]).toHaveValue('Asian'); // Ethnicity
      expect(screen.getByRole('radio', { name: 'Muscular' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'Male' })).toBeChecked();
      expect(selects[1]).toHaveValue('Clean-shaven'); // Facial Hair
      expect(screen.getByRole('checkbox', { name: /wears hat/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /wears sunglasses/i })).toBeChecked();
    });
  });
});
