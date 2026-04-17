// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DraftResumeBanner from '../DraftResumeBanner';

describe('<DraftResumeBanner />', () => {
  it('renders two actions', () => {
    render(<DraftResumeBanner onResume={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByTestId('draft-resume-btn')).toBeTruthy();
    expect(screen.getByTestId('draft-discard-btn')).toBeTruthy();
  });

  it('renders the provided draft snippet', () => {
    render(<DraftResumeBanner draftSnippet="Mike..." onResume={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('“Mike...”')).toBeTruthy();
  });

  it('fires onResume / onDiscard respectively', () => {
    const onResume = vi.fn();
    const onDiscard = vi.fn();
    render(<DraftResumeBanner onResume={onResume} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByTestId('draft-resume-btn'));
    fireEvent.click(screen.getByTestId('draft-discard-btn'));
    expect(onResume).toHaveBeenCalled();
    expect(onDiscard).toHaveBeenCalled();
  });
});
