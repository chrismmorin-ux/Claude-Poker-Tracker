import React from 'react';
import { SKIN_TONES } from '../../../constants/avatarFeatureConstants';
import ColorChip from './ColorChip';

/**
 * SkinToneSection — user-selectable skin tone, independent of ethnicity.
 *
 * Per feedback_color_independent_of_ethnicity.md: skin tone is its own
 * field. Ethnicity may seed the avatar's skin when this is null, but once
 * the user picks a tone explicitly, ethnicity edits leave it alone.
 *
 * Stores the bare key ('ruddy') on player.skinTone — the avatar mapping
 * normalizes it to the namespaced palette id.
 */
export const SkinToneSection = ({ value, onChange, ethnicityHint = null }) => {
  // Strip 'skin.' prefix if a full id was passed in.
  const selected = (value || '').toString().replace(/^skin\./, '').toLowerCase();

  return (
    <section className="mb-4" data-testid="player-editor-skin-tone">
      <h3 className="text-gray-400 text-xs uppercase tracking-wide mb-2">
        Skin tone
      </h3>
      <div className="flex flex-wrap gap-1.5">
        {SKIN_TONES.map((tone) => {
          const key = tone.id.replace(/^skin\./, '');
          const isActive = selected === key;
          return (
            <ColorChip
              key={tone.id}
              active={isActive}
              label={tone.label}
              hex={tone.hex}
              onClick={() => onChange(isActive ? null : key)}
              testId={`player-editor-skin-${key}`}
            />
          );
        })}
      </div>
      {!selected && ethnicityHint ? (
        <div className="text-[10px] text-gray-500 mt-1.5">
          Auto from ethnicity. Pick a tone to override.
        </div>
      ) : null}
    </section>
  );
};

export default SkinToneSection;
