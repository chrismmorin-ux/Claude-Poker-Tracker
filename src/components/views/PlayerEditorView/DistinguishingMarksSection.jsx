/**
 * @file DistinguishingMarksSection — structured array editor for high-info marks.
 * Phase 3 (PIO G4 v2). Per audit §A7 / §6 IA / §12 Q4.
 *
 * Distinguishing marks are top-1 discrimination signals when present
 * (4 bits each per audit §6). Stored as an array of:
 *   { type: 'tattoo' | 'scar' | 'hearing-aid' | 'bindi' | 'prosthetic' | 'other',
 *     location: string (optional, free-text),
 *     description: string (optional, free-text) }
 *
 * UI: "+ Add mark" button with type chip → expands to a row with
 *     type-chip + location text input + description text input + remove.
 */

import React from 'react';
import { Trash2, Plus } from 'lucide-react';

export const MARK_TYPES = [
  { value: 'tattoo', label: 'Tattoo' },
  { value: 'scar', label: 'Scar' },
  { value: 'hearing-aid', label: 'Hearing aid' },
  { value: 'bindi', label: 'Bindi' },
  { value: 'prosthetic', label: 'Prosthetic' },
  { value: 'other', label: 'Other' },
];

const TYPE_LABEL = Object.fromEntries(MARK_TYPES.map((t) => [t.value, t.label]));

export const DistinguishingMarksSection = ({ value, onChange }) => {
  const marks = Array.isArray(value) ? value : [];

  const addMark = (type) => {
    const next = [...marks, { type, location: '', description: '' }];
    onChange(next);
  };

  const updateMark = (index, patch) => {
    const next = marks.map((m, i) => (i === index ? { ...m, ...patch } : m));
    onChange(next);
  };

  const removeMark = (index) => {
    const next = marks.filter((_, i) => i !== index);
    onChange(next);
  };

  return (
    <section className="mb-4" data-testid="player-editor-distinguishing-marks">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
        Distinguishing marks
      </h3>

      {marks.length > 0 ? (
        <div className="space-y-2 mb-2">
          {marks.map((mark, index) => (
            <div
              key={index}
              className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded p-2"
              data-testid={`player-editor-mark-row-${index}`}
            >
              <span className="px-2 py-0.5 text-[11px] rounded-full bg-cyan-700 text-white border border-cyan-500 shrink-0">
                {TYPE_LABEL[mark.type] || mark.type}
              </span>
              <input
                type="text"
                value={mark.location || ''}
                onChange={(e) => updateMark(index, { location: e.target.value })}
                placeholder="Location (e.g. left forearm)"
                className="flex-1 bg-gray-900 text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-cyan-600"
                data-testid={`player-editor-mark-location-${index}`}
              />
              <input
                type="text"
                value={mark.description || ''}
                onChange={(e) => updateMark(index, { description: e.target.value })}
                placeholder="Notes (optional)"
                className="flex-1 bg-gray-900 text-gray-200 text-xs px-2 py-1 rounded border border-gray-700 focus:outline-none focus:border-cyan-600"
                data-testid={`player-editor-mark-description-${index}`}
              />
              <button
                type="button"
                onClick={() => removeMark(index)}
                className="text-gray-500 hover:text-red-400 p-1"
                data-testid={`player-editor-mark-remove-${index}`}
                aria-label="Remove mark"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5 items-center">
        <span className="text-gray-500 text-[10px] uppercase tracking-wide">Add:</span>
        {MARK_TYPES.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => addMark(opt.value)}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-[11px] bg-gray-800 text-gray-300 border border-gray-700 hover:bg-gray-700 transition-colors"
            data-testid={`player-editor-add-mark-${opt.value}`}
          >
            <Plus size={10} />
            {opt.label}
          </button>
        ))}
      </div>
    </section>
  );
};

export default DistinguishingMarksSection;
