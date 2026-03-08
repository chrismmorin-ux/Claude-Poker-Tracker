// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScaledContainer } from '../ScaledContainer';
import { LAYOUT } from '../../../constants/gameConstants';

describe('ScaledContainer', () => {
  it('renders children', () => {
    render(
      <ScaledContainer scale={1}>
        <div data-testid="child">Test Child</div>
      </ScaledContainer>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders without children', () => {
    const { container } = render(<ScaledContainer scale={1} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it.each([1, 0.5, 1.5, 0.75, 0])('applies scale(%s) correctly', (scale) => {
    const { container } = render(
      <ScaledContainer scale={scale}>
        <div>Test</div>
      </ScaledContainer>
    );
    expect(container.querySelector(`[style*="scale(${scale})"]`)).toBeInTheDocument();
  });

  it('uses LAYOUT dimensions', () => {
    const { container } = render(
      <ScaledContainer scale={1}>
        <div>Test</div>
      </ScaledContainer>
    );
    expect(container.querySelector(`[style*="width: ${LAYOUT.TABLE_WIDTH}px"]`)).toBeInTheDocument();
    expect(container.querySelector(`[style*="height: ${LAYOUT.TABLE_HEIGHT}px"]`)).toBeInTheDocument();
  });
});
