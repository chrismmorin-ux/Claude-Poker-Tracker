// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CreateFromQueryCTA from '../CreateFromQueryCTA';

describe('<CreateFromQueryCTA />', () => {
  it('renders default label when query empty', () => {
    render(<CreateFromQueryCTA nameQuery="" onClick={vi.fn()} />);
    expect(screen.getByTestId('create-from-query-cta').textContent).toMatch(/Create new player/);
  });

  it('renders query-seeded label when non-empty', () => {
    render(<CreateFromQueryCTA nameQuery="Mi" onClick={vi.fn()} />);
    expect(screen.getByTestId('create-from-query-cta').textContent).toMatch(/Create new: “Mi”/);
  });

  it('truncates very long query text', () => {
    render(<CreateFromQueryCTA nameQuery="A very long hypothetical player name indeed" onClick={vi.fn()} />);
    expect(screen.getByTestId('create-from-query-cta').textContent).toMatch(/…/);
  });

  it('fires onClick when tapped', () => {
    const onClick = vi.fn();
    render(<CreateFromQueryCTA nameQuery="Mi" onClick={onClick} />);
    fireEvent.click(screen.getByTestId('create-from-query-cta'));
    expect(onClick).toHaveBeenCalled();
  });
});
