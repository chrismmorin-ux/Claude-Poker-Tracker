/**
 * AnchorObservationModal.jsx — capture form (Tier 0 owner observation).
 *
 * Per `docs/design/surfaces/hand-replay-observation-capture.md` §"Modal —
 * AnchorObservationModal". Composes `useAnchorObservationCapture` (S15) and
 * exposes the form UI: 8-tag enum chip grid + optional custom free-text +
 * optional street/action pickers + optional 280-char note + Incognito toggle
 * (primary-visible per red line #9) + Save / Cancel.
 *
 * Behavioral contract:
 *   - **Resume-banner** when `hasDraft === true` on open. Owner can dismiss
 *     by typing — no explicit "resume" / "discard" button at this scope; if
 *     the owner cancels with a dirty draft, the dirty-draft confirm sheet
 *     handles Discard vs Keep-for-later.
 *   - **Save** is disabled until ≥1 fixed-enum chip is toggled on (red line +
 *     schema-delta §3.1.1 contract). Custom tags alone do not enable Save.
 *   - **Cancel-with-dirty-draft** routes to a 2-option confirm view inside
 *     the same modal: "Discard" (calls `discard()` → clears draft + closes)
 *     vs "Keep draft for later" (calls `closeCapture()` → closes; draft
 *     persists). Plain Cancel without dirty draft just closes.
 *   - **Esc / backdrop click** behave like Cancel (route through dirty-draft
 *     check).
 *   - **Incognito toggle** is primary-visible; default off when enrolled per
 *     Q2-A opt-out; forced-on + disabled when not-enrolled (capture works
 *     but contributesToCalibration is forced false at the writer per I-WR-5).
 *
 * Save uses the orchestrator's `save(input)` which composes the W-AO-1 pure
 * writer + dispatches OBSERVATION_CAPTURED + DRAFT_CLEARED. The modal closes
 * on `{ ok: true }` and renders inline errors on `{ ok: false }`.
 *
 * EAL Phase 6 Stream D B3 — Session 16 (2026-04-27).
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  OBSERVATION_TAG_ENUM,
  NOTE_MAX_LENGTH,
} from '../../../constants/anchorLibraryConstants';
import { useAnchorObservationCapture } from '../../../hooks/useAnchorObservationCapture';

const STREET_OPTIONS = [
  { value: '', label: 'whole hand' },
  { value: 'preflop', label: 'preflop' },
  { value: 'flop', label: 'flop' },
  { value: 'turn', label: 'turn' },
  { value: 'river', label: 'river' },
];

// Char-counter color thresholds (per surface spec — amber at 270; aria-live polite at 260+)
const COUNTER_AMBER_THRESHOLD = 270;
const COUNTER_AOFF_THRESHOLD = 260;

/**
 * @param {Object} props
 * @param {string} props.handId
 * @param {() => void} props.onClose          — invoked when modal needs to dismiss
 * @param {(record: Object) => void} [props.onSaved]
 *           — invoked after a successful save (parent fires toast / deep-link)
 * @param {string} [props.initialStreetKey]   — pre-fill from ReviewPanel current step
 * @param {number} [props.initialActionIndex] — pre-fill from ReviewPanel current action
 * @param {number} [props.observationIndex=0] — for deterministic id obs:<handId>:<idx>
 * @param {Array<{value: string, label: string}>} [props.availableActions]
 *           — dropdown options when a street is selected; parent computes from gameTree
 * @param {Set<string>|string[]} [props.disabledStreets]
 *           — streets the hand didn't reach (radio entries disabled defensively)
 */
export const AnchorObservationModal = ({
  handId,
  onClose,
  onSaved,
  initialStreetKey,
  initialActionIndex,
  observationIndex = 0,
  availableActions,
  disabledStreets,
}) => {
  const capture = useAnchorObservationCapture({ handId, observationIndex });
  const { draft, hasDraft, updateDraft, save, discard, isEnrolled } = capture;

  // ── Local form state ───────────────────────────────────────────────────
  // Initialize from the persisted draft if present, else from prop hints.
  const initialState = useMemo(() => {
    const d = draft || {};
    return {
      tagsSet: new Set(Array.isArray(d.ownerTags) ? d.ownerTags : []),
      customTagInput: '',
      streetKey:
        typeof d.streetKey === 'string'
          ? d.streetKey
          : initialStreetKey || '',
      actionIndex:
        Number.isInteger(d.actionIndex)
          ? d.actionIndex
          : Number.isInteger(initialActionIndex)
            ? initialActionIndex
            : null,
      note: typeof d.note === 'string' ? d.note : '',
      // Incognito UI semantics: when not-enrolled, force on + disabled
      // (capture works but contributesToCalibration is forced false at writer).
      incognito: !isEnrolled
        ? true
        : d.contributesToCalibration === false,
    };
  }, [draft, initialStreetKey, initialActionIndex, isEnrolled]);

  // Use a single state object so we can spread updates atomically
  const [form, setForm] = useState(initialState);
  // Re-sync once when draft hydrates / handId changes (rare)
  const lastSyncedDraftRef = useRef(draft);
  useEffect(() => {
    if (draft !== lastSyncedDraftRef.current) {
      lastSyncedDraftRef.current = draft;
      setForm(initialState);
    }
  }, [draft, initialState]);

  // ── Validation derived state ──────────────────────────────────────────
  const enumTagCount = useMemo(
    () => OBSERVATION_TAG_ENUM.filter((t) => form.tagsSet.has(t)).length,
    [form.tagsSet],
  );
  const canSave = enumTagCount >= 1 && Boolean(handId);

  // ── Dirty-draft check (used by Cancel / Esc / backdrop) ──────────────
  const isDirty = useMemo(() => {
    return (
      form.tagsSet.size > 0 ||
      form.customTagInput.trim().length > 0 ||
      Boolean(form.note) ||
      Boolean(form.streetKey) ||
      form.actionIndex !== null
    );
  }, [form]);

  // ── Persistence: debounced draft writes on every form change ─────────
  // Sends the field shape that captureObservation accepts at Save.
  useEffect(() => {
    if (!handId) return;
    const ownerTags = Array.from(form.tagsSet);
    const partial = {
      ownerTags,
      ...(form.note ? { note: form.note } : {}),
      ...(form.streetKey ? { streetKey: form.streetKey } : {}),
      ...(form.actionIndex !== null ? { actionIndex: form.actionIndex } : {}),
      contributesToCalibration: !form.incognito,
    };
    // Only update draft if user has actually changed anything (avoid writing
    // an empty draft just because the modal mounted)
    if (
      ownerTags.length > 0 ||
      form.note ||
      form.streetKey ||
      form.actionIndex !== null ||
      form.incognito
    ) {
      updateDraft(partial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, handId]);

  // ── Confirm-discard sub-view state ────────────────────────────────────
  const [showDirtyConfirm, setShowDirtyConfirm] = useState(false);
  const [errorMessages, setErrorMessages] = useState([]);

  // ── Handlers ──────────────────────────────────────────────────────────
  const toggleEnumTag = useCallback((tag) => {
    setForm((prev) => {
      const next = new Set(prev.tagsSet);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return { ...prev, tagsSet: next };
    });
  }, []);

  const addCustomTag = useCallback(() => {
    setForm((prev) => {
      const candidate = prev.customTagInput.trim();
      if (!candidate) return prev;
      const next = new Set(prev.tagsSet);
      next.add(candidate); // normalization happens at the writer
      return { ...prev, tagsSet: next, customTagInput: '' };
    });
  }, []);

  const handleNoteChange = useCallback((e) => {
    const v = e.target.value;
    if (typeof v === 'string' && v.length <= NOTE_MAX_LENGTH) {
      setForm((prev) => ({ ...prev, note: v }));
    }
  }, []);

  const handleStreetChange = useCallback((e) => {
    setForm((prev) => ({
      ...prev,
      streetKey: e.target.value,
      // Clear action when street changes (parent recomputes availableActions)
      actionIndex: null,
    }));
  }, []);

  const handleActionChange = useCallback((e) => {
    const v = e.target.value;
    setForm((prev) => ({
      ...prev,
      actionIndex: v === '' ? null : Number(v),
    }));
  }, []);

  const handleIncognitoToggle = useCallback((e) => {
    if (!isEnrolled) return; // forced on when not-enrolled
    setForm((prev) => ({ ...prev, incognito: e.target.checked }));
  }, [isEnrolled]);

  // ── Cancel / dismiss path ─────────────────────────────────────────────
  const requestCancel = useCallback(() => {
    if (isDirty) {
      setShowDirtyConfirm(true);
    } else {
      onClose && onClose();
    }
  }, [isDirty, onClose]);

  const handleConfirmDiscard = useCallback(() => {
    discard();
    onClose && onClose();
  }, [discard, onClose]);

  const handleConfirmKeep = useCallback(() => {
    setShowDirtyConfirm(false);
    onClose && onClose();
  }, [onClose]);

  // ── Save ──────────────────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    setErrorMessages([]);
    const ownerTags = Array.from(form.tagsSet);
    const result = save({
      ownerTags,
      ...(form.note ? { note: form.note } : {}),
      ...(form.streetKey ? { streetKey: form.streetKey } : {}),
      ...(form.actionIndex !== null ? { actionIndex: form.actionIndex } : {}),
      contributesToCalibration: !form.incognito,
    });
    if (result.ok) {
      if (typeof onSaved === 'function') onSaved(result.record);
      onClose && onClose();
    } else {
      setErrorMessages(result.errors || ['Could not save observation']);
    }
  }, [form, save, onSaved, onClose]);

  // ── Esc to cancel ─────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (showDirtyConfirm) {
          setShowDirtyConfirm(false);
        } else {
          requestCancel();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestCancel, showDirtyConfirm]);

  // ── Initial focus on dialog ───────────────────────────────────────────
  const dialogRef = useRef(null);
  useEffect(() => {
    if (dialogRef.current) dialogRef.current.focus();
  }, []);

  // ── Char-counter color/aria ───────────────────────────────────────────
  const noteLen = form.note.length;
  const counterColor =
    noteLen >= COUNTER_AMBER_THRESHOLD ? '#f59e0b' : '#9ca3af';
  const counterAriaLive = noteLen >= COUNTER_AOFF_THRESHOLD ? 'polite' : 'off';

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) requestCancel();
      }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="anchor-modal-title"
        tabIndex={-1}
        style={{
          width: '100%',
          maxWidth: '34rem',
          maxHeight: '90vh',
          overflowY: 'auto',
          background: '#1f2937',
          color: '#e5e7eb',
          border: '1px solid #374151',
          borderRadius: '0.5rem',
          padding: '1.25rem',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
          outline: 'none',
        }}
      >
        {/* ── Title row ─────────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '0.75rem',
          }}
        >
          <h2
            id="anchor-modal-title"
            style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}
          >
            Tag pattern
          </h2>
          <button
            type="button"
            onClick={requestCancel}
            aria-label="Close"
            style={{
              minWidth: 32,
              minHeight: 32,
              background: 'transparent',
              color: '#9ca3af',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {showDirtyConfirm ? (
          <DirtyConfirmView
            onDiscard={handleConfirmDiscard}
            onKeep={handleConfirmKeep}
            onBack={() => setShowDirtyConfirm(false)}
          />
        ) : (
          <>
            {/* ── Resume banner ───────────────────────────────────── */}
            {hasDraft && (
              <p
                role="status"
                style={{
                  margin: '0 0 0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: '#374151',
                  color: '#d1d5db',
                  border: '1px solid #4b5563',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                }}
              >
                Resumed your earlier draft for this hand.
              </p>
            )}

            {/* ── Tag chip grid ───────────────────────────────────── */}
            <fieldset
              style={{
                border: 'none',
                padding: 0,
                margin: '0 0 1rem',
              }}
            >
              <legend
                style={{
                  fontSize: '0.8125rem',
                  color: '#d1d5db',
                  marginBottom: '0.5rem',
                  padding: 0,
                }}
              >
                Choose one or more tags:
              </legend>
              <div
                role="group"
                aria-label="Observation tags"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '0.375rem',
                }}
              >
                {OBSERVATION_TAG_ENUM.map((tag) => {
                  const selected = form.tagsSet.has(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleEnumTag(tag)}
                      aria-pressed={selected}
                      data-tag={tag}
                      style={{
                        minHeight: 44,
                        padding: '0.5rem 0.75rem',
                        background: selected ? '#2563eb' : '#374151',
                        color: selected ? '#ffffff' : '#e5e7eb',
                        border:
                          '1px solid ' + (selected ? '#1d4ed8' : '#4b5563'),
                        borderRadius: '0.375rem',
                        cursor: 'pointer',
                        fontSize: '0.8125rem',
                        textAlign: 'left',
                      }}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              {/* Custom tag input */}
              <div
                style={{
                  display: 'flex',
                  gap: '0.375rem',
                  marginTop: '0.5rem',
                }}
              >
                <input
                  type="text"
                  value={form.customTagInput}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      customTagInput: e.target.value,
                    }))
                  }
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addCustomTag();
                    }
                  }}
                  aria-label="Custom tag (optional)"
                  placeholder="Custom tag (optional)"
                  style={{
                    flex: 1,
                    minHeight: 36,
                    padding: '0.375rem 0.5rem',
                    background: '#111827',
                    color: '#e5e7eb',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                  }}
                />
                <button
                  type="button"
                  onClick={addCustomTag}
                  disabled={form.customTagInput.trim().length === 0}
                  aria-label="Add custom tag"
                  style={{
                    minHeight: 36,
                    padding: '0.25rem 0.75rem',
                    background:
                      form.customTagInput.trim().length === 0
                        ? '#4b5563'
                        : '#374151',
                    color: '#e5e7eb',
                    border: '1px solid #4b5563',
                    borderRadius: '0.375rem',
                    cursor:
                      form.customTagInput.trim().length === 0
                        ? 'not-allowed'
                        : 'pointer',
                    fontSize: '0.8125rem',
                  }}
                >
                  + Add
                </button>
              </div>

              {/* Selected custom tag chips (non-enum, removable) */}
              <SelectedCustomTags
                tagsSet={form.tagsSet}
                onRemove={(tag) =>
                  setForm((prev) => {
                    const next = new Set(prev.tagsSet);
                    next.delete(tag);
                    return { ...prev, tagsSet: next };
                  })
                }
              />
            </fieldset>

            {/* ── Street radio ───────────────────────────────────── */}
            <fieldset style={{ border: 'none', padding: 0, margin: '0 0 1rem' }}>
              <legend
                style={{
                  fontSize: '0.8125rem',
                  color: '#d1d5db',
                  marginBottom: '0.375rem',
                  padding: 0,
                }}
              >
                Anchor to street (optional):
              </legend>
              <div
                role="radiogroup"
                aria-label="Street selection"
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '0.75rem',
                }}
              >
                {STREET_OPTIONS.map((opt) => {
                  const isDisabled =
                    opt.value !== '' &&
                    disabledStreets &&
                    (disabledStreets instanceof Set
                      ? disabledStreets.has(opt.value)
                      : Array.isArray(disabledStreets) &&
                        disabledStreets.includes(opt.value));
                  return (
                    <label
                      key={opt.value || 'whole-hand'}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        fontSize: '0.8125rem',
                        color: isDisabled ? '#6b7280' : '#e5e7eb',
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                    >
                      <input
                        type="radio"
                        name="anchor-street"
                        value={opt.value}
                        checked={form.streetKey === opt.value}
                        onChange={handleStreetChange}
                        disabled={isDisabled}
                      />
                      {opt.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* ── Action dropdown (only when street is set + actions provided) ── */}
            {form.streetKey && Array.isArray(availableActions) && availableActions.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                <label
                  htmlFor="anchor-action-select"
                  style={{
                    display: 'block',
                    fontSize: '0.8125rem',
                    color: '#d1d5db',
                    marginBottom: '0.375rem',
                  }}
                >
                  Anchor to action (optional):
                </label>
                <select
                  id="anchor-action-select"
                  value={form.actionIndex === null ? '' : String(form.actionIndex)}
                  onChange={handleActionChange}
                  style={{
                    width: '100%',
                    minHeight: 36,
                    padding: '0.375rem 0.5rem',
                    background: '#111827',
                    color: '#e5e7eb',
                    border: '1px solid #374151',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                  }}
                >
                  <option value="">— pick an action —</option>
                  {availableActions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Note ────────────────────────────────────────────── */}
            <div style={{ marginBottom: '1rem' }}>
              <label
                htmlFor="anchor-note"
                style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  color: '#d1d5db',
                  marginBottom: '0.375rem',
                }}
              >
                Note (optional, {NOTE_MAX_LENGTH} chars max):
              </label>
              <textarea
                id="anchor-note"
                value={form.note}
                onChange={handleNoteChange}
                maxLength={NOTE_MAX_LENGTH}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  background: '#111827',
                  color: '#e5e7eb',
                  border: '1px solid #374151',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
              <div
                aria-live={counterAriaLive}
                style={{
                  textAlign: 'right',
                  fontSize: '0.75rem',
                  color: counterColor,
                  marginTop: '0.125rem',
                }}
                data-testid="anchor-note-counter"
              >
                {noteLen}/{NOTE_MAX_LENGTH}
              </div>
            </div>

            {/* ── Incognito toggle (red line #9 — primary-visible) ── */}
            <div
              style={{
                marginBottom: '1rem',
                padding: '0.5rem 0.75rem',
                background: '#374151',
                border: '1px solid #4b5563',
                borderRadius: '0.375rem',
              }}
              data-testid="anchor-incognito-block"
            >
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.5rem',
                  fontSize: '0.8125rem',
                  color: '#e5e7eb',
                  cursor: isEnrolled ? 'pointer' : 'not-allowed',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.incognito}
                  onChange={handleIncognitoToggle}
                  disabled={!isEnrolled}
                  data-testid="anchor-incognito-toggle"
                  aria-label="Incognito — this observation will not contribute to calibration. Your note is always private regardless."
                  style={{ marginTop: '0.2rem' }}
                />
                <span>
                  Incognito — this observation won't contribute to calibration
                  {!isEnrolled && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.25rem',
                        fontSize: '0.75rem',
                        color: '#9ca3af',
                      }}
                    >
                      Enrollment is off in Settings, so observations don't
                      contribute regardless. The toggle stays visible.
                    </span>
                  )}
                </span>
              </label>
            </div>

            {/* ── Inline errors ───────────────────────────────────── */}
            {errorMessages.length > 0 && (
              <div
                role="alert"
                style={{
                  marginBottom: '0.75rem',
                  padding: '0.5rem 0.75rem',
                  background: '#7f1d1d',
                  color: '#fee2e2',
                  border: '1px solid #b91c1c',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                }}
              >
                {errorMessages.map((m, i) => (
                  <div key={i}>{m}</div>
                ))}
              </div>
            )}

            {/* ── Action row ──────────────────────────────────────── */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '0.5rem',
              }}
            >
              <button
                type="button"
                onClick={requestCancel}
                style={{
                  minHeight: 44,
                  padding: '0.5rem 1rem',
                  background: '#374151',
                  color: '#e5e7eb',
                  border: '1px solid #4b5563',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                aria-disabled={!canSave}
                style={{
                  minHeight: 44,
                  padding: '0.5rem 1rem',
                  background: canSave ? '#2563eb' : '#4b5563',
                  color: '#ffffff',
                  border:
                    '1px solid ' + (canSave ? '#1d4ed8' : '#374151'),
                  borderRadius: '0.375rem',
                  cursor: canSave ? 'pointer' : 'not-allowed',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                }}
              >
                Save
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ───────────────────────────────────────────────────────────────────────────
// Sub-components
// ───────────────────────────────────────────────────────────────────────────

const SelectedCustomTags = ({ tagsSet, onRemove }) => {
  const customTags = useMemo(() => {
    const enumSet = new Set(OBSERVATION_TAG_ENUM);
    return Array.from(tagsSet).filter((t) => !enumSet.has(t));
  }, [tagsSet]);

  if (customTags.length === 0) return null;

  return (
    <div
      data-testid="anchor-custom-tag-list"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.25rem',
        marginTop: '0.5rem',
      }}
    >
      {customTags.map((tag) => (
        <span
          key={tag}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.125rem 0.5rem',
            background: '#1e40af',
            color: '#ffffff',
            border: '1px solid #1d4ed8',
            borderRadius: '999px',
            fontSize: '0.6875rem',
          }}
        >
          {tag}
          <button
            type="button"
            onClick={() => onRemove(tag)}
            aria-label={`Remove tag ${tag}`}
            style={{
              background: 'transparent',
              color: '#bfdbfe',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
};

const DirtyConfirmView = ({ onDiscard, onKeep, onBack }) => (
  <div data-testid="anchor-dirty-confirm">
    <p
      style={{
        margin: '0 0 0.75rem',
        fontSize: '0.875rem',
        color: '#d1d5db',
        lineHeight: 1.4,
      }}
    >
      You have a draft in progress. Discard it or keep it for later?
    </p>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <button
        type="button"
        onClick={onKeep}
        style={{
          minHeight: 44,
          padding: '0.5rem 1rem',
          background: '#1f2937',
          color: '#e5e7eb',
          border: '1px solid #374151',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
        }}
      >
        Keep draft for later
      </button>
      <button
        type="button"
        onClick={onDiscard}
        style={{
          minHeight: 44,
          padding: '0.5rem 1rem',
          background: '#7f1d1d',
          color: '#fee2e2',
          border: '1px solid #b91c1c',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '0.875rem',
          fontWeight: 600,
        }}
      >
        Discard draft
      </button>
      <button
        type="button"
        onClick={onBack}
        style={{
          minHeight: 36,
          padding: '0.25rem 0.5rem',
          background: 'transparent',
          color: '#9ca3af',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.8125rem',
          textDecoration: 'underline',
        }}
      >
        Back to capture
      </button>
    </div>
  </div>
);

export default AnchorObservationModal;
