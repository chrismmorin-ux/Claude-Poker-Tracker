/**
 * PhysicalSection.jsx — Legacy physical-description text dropdowns (PEO-2)
 *
 * Retained for records that were created pre-avatarFeatures, and for players
 * whose appearance doesn't fit the feature-avatar palette (e.g. user wants to
 * record "beard: salt-and-pepper Van Dyke" verbally). Collapsed by default so
 * avatar-builder is the primary path.
 *
 * Semantics mirror the legacy physical-description form that previously lived
 * under `src/components/ui/PlayerForm/` (deleted in PEO-4).
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  ETHNICITY_OPTIONS,
  BUILD_OPTIONS,
  GENDER_OPTIONS,
  FACIAL_HAIR_OPTIONS,
} from '../../../constants/playerConstants';

export const PhysicalSection = ({
  ethnicity, onEthnicityChange,
  build, onBuildChange,
  gender, onGenderChange,
  facialHair, onFacialHairChange,
  hat, onHatChange,
  sunglasses, onSunglassesChange,
}) => {
  const [open, setOpen] = useState(false);
  const Icon = open ? ChevronDown : ChevronRight;

  return (
    <div className="bg-white border border-gray-200 rounded" data-testid="physical-section">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 rounded-t"
        aria-expanded={open}
        data-testid="physical-section-toggle"
      >
        <Icon size={14} />
        Physical Notes (optional)
      </button>
      {open ? (
        <div className="p-3 pt-0 space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">
              Ethnicity
            </label>
            <select
              value={ethnicity || ''}
              onChange={(e) => onEthnicityChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              data-testid="physical-ethnicity"
            >
              <option value="">—</option>
              {ETHNICITY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Build</label>
            <div className="flex gap-2 flex-wrap">
              {BUILD_OPTIONS.map(o => (
                <label key={o.value} className="flex items-center gap-1 text-sm">
                  <input type="radio" name="build" checked={build === o.value} onChange={() => onBuildChange(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Gender</label>
            <div className="flex gap-2 flex-wrap">
              {GENDER_OPTIONS.map(o => (
                <label key={o.value} className="flex items-center gap-1 text-sm">
                  <input type="radio" name="gender" checked={gender === o.value} onChange={() => onGenderChange(o.value)} />
                  {o.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Facial Hair</label>
            <select
              value={facialHair || ''}
              onChange={(e) => onFacialHairChange(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
              data-testid="physical-facial-hair"
            >
              <option value="">—</option>
              {FACIAL_HAIR_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={!!hat} onChange={(e) => onHatChange(e.target.checked)} />
              Wears hat
            </label>
            <label className="flex items-center gap-1 text-sm">
              <input type="checkbox" checked={!!sunglasses} onChange={(e) => onSunglassesChange(e.target.checked)} />
              Wears sunglasses
            </label>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PhysicalSection;
