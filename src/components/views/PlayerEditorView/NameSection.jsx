/**
 * NameSection.jsx — First-name input + non-blocking duplicate warning.
 *
 * Per plan §D5: duplicate-name detection surfaces an inline warning but
 * never blocks save. The user may legitimately intend a duplicate.
 */

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export const NameSection = ({ name, nickname, onNameChange, onNicknameChange, duplicate, nameInputRef }) => {
  return (
    <div className="bg-white border border-gray-200 rounded p-3 space-y-3">
      <div>
        <label htmlFor="player-name" className="block text-xs font-medium text-gray-600 mb-1">
          Name
        </label>
        <input
          id="player-name"
          ref={nameInputRef}
          type="text"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder="First name from the dealer's plaque"
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          data-testid="player-name-input"
        />
        {duplicate ? (
          <div
            className="mt-2 flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1"
            role="alert"
            data-testid="duplicate-warning"
          >
            <AlertTriangle size={14} className="shrink-0 mt-0.5" />
            <span>
              A player named <strong>{duplicate.name}</strong> already exists. Saving will create a duplicate.
            </span>
          </div>
        ) : null}
      </div>
      <div>
        <label htmlFor="player-nickname" className="block text-xs font-medium text-gray-600 mb-1">
          Nickname (optional)
        </label>
        <input
          id="player-nickname"
          type="text"
          value={nickname}
          onChange={(e) => onNicknameChange(e.target.value)}
          autoComplete="off"
          className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          data-testid="player-nickname-input"
        />
      </div>
    </div>
  );
};

export default NameSection;
