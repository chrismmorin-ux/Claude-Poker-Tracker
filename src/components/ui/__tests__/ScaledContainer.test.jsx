/**
 * ScaledContainer.test.jsx - Tests for ScaledContainer component
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScaledContainer } from '../ScaledContainer';
import { LAYOUT } from '../../../constants/gameConstants';

describe('ScaledContainer', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(
        <ScaledContainer scale={1}>
          <div data-testid="child">Test Child</div>
        </ScaledContainer>
      );
      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <ScaledContainer scale={1}>
          <div>Child 1</div>
          <div>Child 2</div>
          <div>Child 3</div>
        </ScaledContainer>
      );
      expect(screen.getByText('Child 1')).toBeInTheDocument();
      expect(screen.getByText('Child 2')).toBeInTheDocument();
      expect(screen.getByText('Child 3')).toBeInTheDocument();
    });

    it('renders without children', () => {
      const { container } = render(<ScaledContainer scale={1} />);
      expect(container.firstChild).toBeInTheDocument();
    });
  });

  describe('scaling', () => {
    it('applies scale 1 correctly', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(1)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });

    it('applies scale 0.5 correctly', () => {
      const { container } = render(
        <ScaledContainer scale={0.5}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(0.5)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });

    it('applies scale 1.5 correctly', () => {
      const { container } = render(
        <ScaledContainer scale={1.5}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(1.5)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });

    it('applies scale 0.75 correctly', () => {
      const { container } = render(
        <ScaledContainer scale={0.75}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(0.75)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });
  });

  describe('dimensions', () => {
    it('uses LAYOUT.TABLE_WIDTH for width', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="width: ${LAYOUT.TABLE_WIDTH}px"]`);
      expect(scaledDiv).toBeInTheDocument();
    });

    it('uses LAYOUT.TABLE_HEIGHT for height', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="height: ${LAYOUT.TABLE_HEIGHT}px"]`);
      expect(scaledDiv).toBeInTheDocument();
    });
  });

  describe('transform origin', () => {
    it('uses center center transform origin', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="transform-origin: center center"]`);
      expect(scaledDiv).toBeInTheDocument();
    });
  });

  describe('outer container styling', () => {
    it('has flex for centering', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      expect(container.firstChild.className).toContain('flex');
    });

    it('has items-center for vertical centering', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      expect(container.firstChild.className).toContain('items-center');
    });

    it('has justify-center for horizontal centering', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      expect(container.firstChild.className).toContain('justify-center');
    });

    it('has min-h-screen for full viewport height', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      expect(container.firstChild.className).toContain('min-h-screen');
    });

    it('has gray background', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      expect(container.firstChild.className).toContain('bg-gray-800');
    });

    it('has overflow-hidden to prevent scrollbars', () => {
      const { container } = render(
        <ScaledContainer scale={1}>
          <div>Test</div>
        </ScaledContainer>
      );
      expect(container.firstChild.className).toContain('overflow-hidden');
    });
  });

  describe('edge cases', () => {
    it('handles scale of 0', () => {
      const { container } = render(
        <ScaledContainer scale={0}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(0)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });

    it('handles very small scale', () => {
      const { container } = render(
        <ScaledContainer scale={0.1}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(0.1)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });

    it('handles large scale', () => {
      const { container } = render(
        <ScaledContainer scale={2}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(2)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });

    it('handles decimal scale values', () => {
      const { container } = render(
        <ScaledContainer scale={0.857}>
          <div>Test</div>
        </ScaledContainer>
      );
      const scaledDiv = container.querySelector(`[style*="scale(0.857)"]`);
      expect(scaledDiv).toBeInTheDocument();
    });
  });
});
