// @vitest-environment jsdom
import React, { useRef } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import NameSearchInput from '../NameSearchInput';

const Harness = ({ initialValue = '', autoFocus = true }) => {
  const [val, setVal] = React.useState(initialValue);
  const ref = useRef(null);
  return <NameSearchInput value={val} onChange={setVal} inputRef={ref} autoFocus={autoFocus} />;
};

describe('<NameSearchInput />', () => {
  it('renders the input', () => {
    render(<Harness />);
    expect(screen.getByTestId('name-search-input')).toBeTruthy();
  });

  it('autofocuses the input on mount', () => {
    render(<Harness />);
    expect(document.activeElement).toBe(screen.getByTestId('name-search-input'));
  });

  it('fires onChange on user input', () => {
    const onChange = vi.fn();
    const ref = React.createRef();
    render(<NameSearchInput value="" onChange={onChange} inputRef={ref} autoFocus={false} />);
    fireEvent.change(screen.getByTestId('name-search-input'), { target: { value: 'Mi' } });
    expect(onChange).toHaveBeenCalledWith('Mi');
  });

  it('shows clear button when value is non-empty', () => {
    const ref = React.createRef();
    render(<NameSearchInput value="Mi" onChange={vi.fn()} inputRef={ref} autoFocus={false} />);
    expect(screen.getByTestId('clear-search-btn')).toBeTruthy();
  });

  it('hides clear button when empty', () => {
    const ref = React.createRef();
    render(<NameSearchInput value="" onChange={vi.fn()} inputRef={ref} autoFocus={false} />);
    expect(screen.queryByTestId('clear-search-btn')).toBeNull();
  });

  it('Escape key clears the value', () => {
    const onChange = vi.fn();
    const ref = React.createRef();
    render(<NameSearchInput value="Mike" onChange={onChange} inputRef={ref} autoFocus={false} />);
    fireEvent.keyDown(screen.getByTestId('name-search-input'), { key: 'Escape' });
    expect(onChange).toHaveBeenCalledWith('');
  });
});
