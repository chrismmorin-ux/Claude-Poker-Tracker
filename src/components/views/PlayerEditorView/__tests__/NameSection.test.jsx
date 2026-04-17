// @vitest-environment jsdom
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NameSection from '../NameSection';

describe('<NameSection />', () => {
  it('renders name + nickname inputs', () => {
    render(
      <NameSection
        name=""
        nickname=""
        onNameChange={vi.fn()}
        onNicknameChange={vi.fn()}
        duplicate={null}
      />,
    );
    expect(screen.getByTestId('player-name-input')).toBeTruthy();
    expect(screen.getByTestId('player-nickname-input')).toBeTruthy();
  });

  it('fires onNameChange on each keystroke', () => {
    const onNameChange = vi.fn();
    render(
      <NameSection
        name="Mi"
        nickname=""
        onNameChange={onNameChange}
        onNicknameChange={vi.fn()}
        duplicate={null}
      />,
    );
    fireEvent.change(screen.getByTestId('player-name-input'), { target: { value: 'Mik' } });
    expect(onNameChange).toHaveBeenCalledWith('Mik');
  });

  it('shows duplicate warning when duplicate prop is set', () => {
    render(
      <NameSection
        name="Mike"
        nickname=""
        onNameChange={vi.fn()}
        onNicknameChange={vi.fn()}
        duplicate={{ playerId: 7, name: 'Mike' }}
      />,
    );
    expect(screen.getByTestId('duplicate-warning')).toBeTruthy();
    expect(screen.getByTestId('duplicate-warning').textContent).toMatch(/Mike/);
  });

  it('hides duplicate warning when duplicate is null', () => {
    render(
      <NameSection
        name="Mike"
        nickname=""
        onNameChange={vi.fn()}
        onNicknameChange={vi.fn()}
        duplicate={null}
      />,
    );
    expect(screen.queryByTestId('duplicate-warning')).toBeNull();
  });
});
