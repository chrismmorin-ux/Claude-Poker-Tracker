/**
 * NameSearchInput.jsx — Autofocused first-name filter input (PEO-3)
 *
 * Single responsibility: render the text input that drives live filtering.
 * Autofocus on mount. Escape key clears the input. Debounce is NOT needed —
 * filtering happens synchronously against an in-memory list which is cheap
 * at current scale (see plan §Perf Ceiling Note).
 */

import React, { useEffect } from 'react';
import { Search, X } from 'lucide-react';

export const NameSearchInput = ({ value, onChange, inputRef, autoFocus = true }) => {
  useEffect(() => {
    if (autoFocus && inputRef?.current) {
      try { inputRef.current.focus({ preventScroll: true }); } catch { inputRef.current.focus(); }
    }
  }, [autoFocus, inputRef]);

  const handleKey = (e) => {
    if (e.key === 'Escape' && value) {
      e.preventDefault();
      onChange('');
    }
  };

  return (
    <div className="relative">
      <Search
        size={16}
        className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
      />
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKey}
        placeholder="First name from the dealer's plaque…"
        autoComplete="off"
        className="w-full pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
        data-testid="name-search-input"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
          data-testid="clear-search-btn"
        >
          <X size={14} />
        </button>
      ) : null}
    </div>
  );
};

export default NameSearchInput;
