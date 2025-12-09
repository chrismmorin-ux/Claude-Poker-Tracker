/**
 * StyleTagsSection.test.jsx - Tests for playing style checkboxes
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StyleTagsSection } from '../StyleTagsSection';
import { STYLE_TAGS } from '../../../../constants/playerConstants';

describe('StyleTagsSection', () => {
  const defaultProps = {
    styleTags: [],
    onToggleTag: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    return render(<StyleTagsSection {...defaultProps} {...props} />);
  };

  // Helper to get checkbox by exact label text
  const getCheckboxByLabel = (labelText) => {
    const label = screen.getByText(labelText);
    return label.parentElement.querySelector('input[type="checkbox"]');
  };

  describe('rendering', () => {
    it('renders playing style tags label', () => {
      renderComponent();
      expect(screen.getByText(/playing style tags/i)).toBeInTheDocument();
    });

    it('renders all style tags as checkboxes', () => {
      renderComponent();
      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes).toHaveLength(STYLE_TAGS.length);
    });

    it('renders each style tag label', () => {
      renderComponent();
      STYLE_TAGS.forEach((tag) => {
        expect(screen.getByText(tag)).toBeInTheDocument();
      });
    });

    it('has border-t class for top border', () => {
      const { container } = renderComponent();
      expect(container.firstChild).toHaveClass('border-t');
    });

    it('uses grid layout with 3 columns', () => {
      const { container } = renderComponent();
      const grid = container.querySelector('.grid');
      expect(grid).toHaveClass('grid-cols-3');
    });
  });

  describe('checkbox states', () => {
    it('all checkboxes are unchecked when styleTags is empty', () => {
      renderComponent({ styleTags: [] });
      const checkboxes = screen.getAllByRole('checkbox');
      checkboxes.forEach((checkbox) => {
        expect(checkbox).not.toBeChecked();
      });
    });

    it('checkbox is checked when tag is in styleTags', () => {
      renderComponent({ styleTags: ['Tight'] });
      const tightCheckbox = getCheckboxByLabel('Tight');
      expect(tightCheckbox).toBeChecked();
    });

    it('multiple checkboxes can be checked', () => {
      renderComponent({ styleTags: ['Tight', 'Aggressive', 'Reg'] });
      expect(getCheckboxByLabel('Tight')).toBeChecked();
      expect(getCheckboxByLabel('Aggressive')).toBeChecked();
      expect(getCheckboxByLabel('Reg')).toBeChecked();
    });

    it('only specified tags are checked', () => {
      renderComponent({ styleTags: ['Fish'] });
      expect(getCheckboxByLabel('Fish')).toBeChecked();
      expect(getCheckboxByLabel('Tight')).not.toBeChecked();
      expect(getCheckboxByLabel('Rock')).not.toBeChecked();
    });
  });

  describe('user interactions', () => {
    it('calls onToggleTag when checkbox is clicked', () => {
      const onToggleTag = vi.fn();
      renderComponent({ onToggleTag });

      const tightCheckbox = getCheckboxByLabel('Tight');
      fireEvent.click(tightCheckbox);

      expect(onToggleTag).toHaveBeenCalledWith('Tight');
    });

    it('calls onToggleTag with correct tag name for each tag', () => {
      const onToggleTag = vi.fn();
      renderComponent({ onToggleTag });

      const fishCheckbox = getCheckboxByLabel('Fish');
      fireEvent.click(fishCheckbox);

      expect(onToggleTag).toHaveBeenCalledWith('Fish');
    });

    it('calls onToggleTag on label click', () => {
      const onToggleTag = vi.fn();
      renderComponent({ onToggleTag });

      const looseLabel = screen.getByText('Loose');
      fireEvent.click(looseLabel);

      expect(onToggleTag).toHaveBeenCalledWith('Loose');
    });

    it('calls onToggleTag for each checkbox clicked', () => {
      const onToggleTag = vi.fn();
      renderComponent({ onToggleTag });

      fireEvent.click(getCheckboxByLabel('Tight'));
      fireEvent.click(getCheckboxByLabel('Aggressive'));
      fireEvent.click(getCheckboxByLabel('Maniac'));

      expect(onToggleTag).toHaveBeenCalledTimes(3);
      expect(onToggleTag).toHaveBeenNthCalledWith(1, 'Tight');
      expect(onToggleTag).toHaveBeenNthCalledWith(2, 'Aggressive');
      expect(onToggleTag).toHaveBeenNthCalledWith(3, 'Maniac');
    });
  });

  describe('specific tags', () => {
    it('renders compound tags correctly', () => {
      renderComponent();
      expect(screen.getByText('TAG (Tight-Aggressive)')).toBeInTheDocument();
      expect(screen.getByText('LAG (Loose-Aggressive)')).toBeInTheDocument();
    });

    it('can check compound tags', () => {
      renderComponent({ styleTags: ['TAG (Tight-Aggressive)'] });
      const tagCheckbox = getCheckboxByLabel('TAG (Tight-Aggressive)');
      expect(tagCheckbox).toBeChecked();
    });

    it('renders all poker-specific style tags', () => {
      renderComponent();
      expect(screen.getByText('Calling Station')).toBeInTheDocument();
      expect(screen.getByText('Social Player')).toBeInTheDocument();
      expect(screen.getByText('Tilty')).toBeInTheDocument();
      expect(screen.getByText('Straightforward')).toBeInTheDocument();
    });
  });
});
