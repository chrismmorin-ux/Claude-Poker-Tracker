/**
 * @file OwnerTierRadio — owner-set tier radio.
 *
 * The 6 rank labels (novice .. pro) are imported from
 * `learningStateDescriber.FORBIDDEN_RANK_LABELS` (single source of truth) —
 * this is the ONLY place in the app where these labels render as
 * user-facing copy. Every other surface treats them as forbidden tokens
 * (per `feedback_scf_learning_state_not_tier_rank.md` + AP-SCF-03).
 *
 * Reversibility: the radio supports an "(unset)" option (null) so the
 * owner can reset the field. AP-SCF-03 binds: never inferred, owner-only.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { useSettings } from '../../../contexts';
import { SETTINGS_ACTIONS } from '../../../constants/settingsConstants';
import { FORBIDDEN_RANK_LABELS } from '../../../utils/skillAssessment/learningStateDescriber';
import { GOLD } from '../../../constants/designTokens';

const TIER_OPTIONS = [
  { value: null, label: '(unset)' },
  ...FORBIDDEN_RANK_LABELS.map((tier) => ({ value: tier, label: tier })),
];

export const OwnerTierRadio = () => {
  const { settings, dispatchSettings } = useSettings();
  const current = settings?.selfCoach?.ownerTier ?? null;

  const onSelect = (tier) => {
    dispatchSettings({
      type: SETTINGS_ACTIONS.SET_SELF_COACH_OWNER_TIER,
      payload: { tier },
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-5" data-testid="self-coach-owner-tier">
      <h3 className="text-lg font-bold mb-2" style={{ color: GOLD.base }}>
        Owner tier
      </h3>
      <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.75rem' }}>
        Authoring metadata only. Used to scope curriculum sequencing. NEVER rendered as a rank elsewhere.
      </p>
      <div role="radiogroup" aria-label="Owner tier" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        {TIER_OPTIONS.map(({ value, label }) => {
          const selected = current === value;
          const testId = `self-coach-owner-tier-${value === null ? 'unset' : value}`;
          return (
            <label
              key={String(value)}
              data-testid={testId}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                minHeight: 32,
                padding: '0.25rem 0.5rem',
                background: selected ? '#1e293b' : 'transparent',
                border: '1px solid',
                borderColor: selected ? '#7c3aed' : 'transparent',
                borderRadius: 6,
                cursor: 'pointer',
                color: selected ? '#f3f4f6' : '#d1d5db',
              }}
            >
              <input
                type="radio"
                name="self-coach-owner-tier"
                value={value === null ? '' : value}
                checked={selected}
                onChange={() => onSelect(value)}
                aria-checked={selected}
              />
              <span style={{ fontSize: '0.85rem' }}>{label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
