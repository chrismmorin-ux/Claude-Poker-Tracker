// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React, { useRef } from 'react';
import { render } from '@testing-library/react';
import {
  useScreenFocusManagement,
  findFirstFocusable,
  isFocusable,
} from '../useScreenFocusManagement';

const Harness = ({ focusTarget = 'input' }) => {
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  useScreenFocusManagement(rootRef, focusTarget === 'input' ? inputRef : null);
  return (
    <div ref={rootRef}>
      <button type="button">first button</button>
      <input ref={inputRef} type="text" />
      <a href="#link">a link</a>
    </div>
  );
};

describe('useScreenFocusManagement', () => {
  it('focuses the initialFocusRef element on mount', () => {
    render(<Harness focusTarget="input" />);
    expect(document.activeElement?.tagName).toBe('INPUT');
  });

  it('falls back to first focusable child when no ref provided', () => {
    render(<Harness focusTarget={null} />);
    // First focusable in the harness is the <button>
    expect(document.activeElement?.tagName).toBe('BUTTON');
  });

  it('restores previous focus on unmount', () => {
    // Seed a focus target outside the component
    const outside = document.createElement('button');
    outside.textContent = 'outside';
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    const { unmount } = render(<Harness focusTarget="input" />);
    expect(document.activeElement?.tagName).toBe('INPUT');
    unmount();
    expect(document.activeElement).toBe(outside);
    document.body.removeChild(outside);
  });
});

describe('findFirstFocusable', () => {
  it('returns the first focusable element in a container', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>hi</p><button>btn</button><input>';
    const first = findFirstFocusable(container);
    expect(first?.tagName).toBe('BUTTON');
  });

  it('skips disabled elements', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button disabled>skip</button><input>';
    expect(findFirstFocusable(container)?.tagName).toBe('INPUT');
  });

  it('returns null when nothing focusable', () => {
    const container = document.createElement('div');
    container.innerHTML = '<p>hi</p>';
    expect(findFirstFocusable(container)).toBeNull();
  });

  it('handles null/undefined gracefully', () => {
    expect(findFirstFocusable(null)).toBeNull();
    expect(findFirstFocusable(undefined)).toBeNull();
  });
});

describe('isFocusable', () => {
  it('true for enabled button', () => {
    const b = document.createElement('button');
    expect(isFocusable(b)).toBe(true);
  });

  it('false for disabled element', () => {
    const b = document.createElement('button');
    b.disabled = true;
    expect(isFocusable(b)).toBe(false);
  });

  it('false for aria-hidden element', () => {
    const b = document.createElement('button');
    b.setAttribute('aria-hidden', 'true');
    expect(isFocusable(b)).toBe(false);
  });

  it('false for tabIndex=-1', () => {
    const b = document.createElement('button');
    b.tabIndex = -1;
    expect(isFocusable(b)).toBe(false);
  });

  it('false for non-element input', () => {
    expect(isFocusable(null)).toBe(false);
    expect(isFocusable(undefined)).toBe(false);
  });
});
