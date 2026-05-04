/**
 * @file EthnicityTagsSection — multi-select chip input for ethnicity tags.
 *
 * Replaces PhysicalSection's legacy single-select dropdown. Backward-compat:
 * if `ethnicityTags` is empty AND legacy `ethnicity` is set, the section
 * auto-populates `ethnicityTags = [ethnicity]` on first edit (one-time shim).
 *
 * v1 ships a lightweight typeable input (free-form tags). Existing taxonomies
 * can be authored as palette options if desired; for now the simplest UI is
 * "type a tag, press enter" — matches existing styleTags pattern philosophy.
 *
 * Per `feedback_pio_identification_utility_first.md`: identification utility
 * binds; cultural-sensitivity is reviewing voice.
 *
 * SPR-035 / WS-163 (2026-05-04).
 */

import React, { useState, useEffect } from 'react';

const normalizeTag = (raw) => raw.trim();

export const EthnicityTagsSection = ({
  value,
  legacyEthnicity,
  onChange,
}) => {
  const tags = Array.isArray(value) ? value : [];
  const [input, setInput] = useState('');

  // Backward-compat shim: on first render, if tags is empty AND legacy
  // ethnicity is set, populate tags = [legacyEthnicity]. Idempotent — only
  // fires once when legacyEthnicity is non-empty + tags is empty.
  useEffect(() => {
    if (tags.length === 0 && typeof legacyEthnicity === 'string' && legacyEthnicity.length > 0) {
      onChange([legacyEthnicity]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTag = () => {
    const next = normalizeTag(input);
    if (!next) return;
    if (tags.includes(next)) {
      setInput('');
      return;
    }
    onChange([...tags, next]);
    setInput('');
  };

  const removeTag = (tag) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <section className="mb-4" data-testid="player-editor-ethnicity-tags">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
        Ethnicity (tags)
      </h3>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="bg-cyan-700 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1"
            data-testid={`player-editor-ethnicity-tag-${tag}`}
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="hover:text-gray-200"
              aria-label={`Remove ${tag}`}
              data-testid={`player-editor-ethnicity-tag-remove-${tag}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Add a tag and press Enter"
          className="flex-1 bg-gray-800 text-gray-200 text-sm rounded px-2 py-1 border border-gray-700"
          data-testid="player-editor-ethnicity-input"
        />
        <button
          type="button"
          onClick={addTag}
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded border border-gray-700"
          data-testid="player-editor-ethnicity-add"
        >
          Add
        </button>
      </div>
    </section>
  );
};
