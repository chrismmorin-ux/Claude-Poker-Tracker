/**
 * CreateFromQueryCTA.jsx — Sticky bottom "+ Create new: <query>" button (PEO-3)
 *
 * Label updates with the live text query. Clicking opens the editor with the
 * query pre-filled as nameSeed (see PlayerPickerView.onCreateFromQuery).
 */

import React from 'react';
import { UserPlus } from 'lucide-react';

const MAX_SEED_DISPLAY = 24;

const truncate = (s) => {
  if (!s) return '';
  if (s.length <= MAX_SEED_DISPLAY) return s;
  return `${s.slice(0, MAX_SEED_DISPLAY)}…`;
};

export const CreateFromQueryCTA = ({ nameQuery, onClick }) => {
  const seed = (nameQuery || '').trim();
  const label = seed
    ? `+ Create new: “${truncate(seed)}”`
    : '+ Create new player';
  return (
    <div className="sticky bottom-0 left-0 right-0 z-10 bg-gray-100 border-t border-gray-300 px-3 py-2">
      <button
        type="button"
        onClick={onClick}
        className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-gray-900 font-semibold text-sm px-4 py-2.5 rounded"
        data-testid="create-from-query-cta"
      >
        <UserPlus size={16} />
        {label}
      </button>
    </div>
  );
};

export default CreateFromQueryCTA;
