/**
 * VoicePttButton.jsx — push-to-talk widget for VCE
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Design contract (binding):
 *   - 56×56 DOM-px hit area (Gate 2 E-7). H-ML06 ≥44 visual-px floor.
 *   - 300ms hold threshold before mic activates (Gate 2 E-3, enforced in hook).
 *   - No animation in active state. Static fill-color swap only (Gate 2 E-1).
 *   - Disabled when `permissionStatus === 'denied'` OR `supported === false`.
 *   - State-aware visibility is the consumer's responsibility (see surface spec
 *     §"State-aware visibility"). This component renders unconditionally when
 *     mounted; consumer decides when to mount.
 */

import { useCallback } from 'react';

const SIZE_PX = 56;

const SVG_MIC = (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    width="22"
    height="22"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="3" width="6" height="12" rx="3" />
    <path d="M5 11a7 7 0 0 0 14 0" />
    <line x1="12" y1="18" x2="12" y2="21" />
    <line x1="9" y1="21" x2="15" y2="21" />
  </svg>
);

/**
 * @param {object} props
 * @param {boolean} props.supported              — Web Speech available
 * @param {string}  props.permissionStatus       — 'granted'|'denied'|'prompt'|'unknown'
 * @param {boolean} props.isListening            — mic active right now
 * @param {() => void} props.onHoldStart
 * @param {() => void} props.onHoldEnd
 * @param {string=} props.label                  — accessible label (defaults to a sensible string)
 * @param {string=} props.testId                 — data-testid override
 */
export default function VoicePttButton({
  supported,
  permissionStatus,
  isListening,
  onHoldStart,
  onHoldEnd,
  label = 'Hold to speak board cards',
  testId = 'voice-ptt-button',
}) {
  const disabled = !supported || permissionStatus === 'denied';

  const handlePointerDown = useCallback(
    (e) => {
      if (disabled) return;
      // Prevent text-selection on long touch + iOS context menu.
      try { e.preventDefault(); } catch { /* ignore */ }
      onHoldStart && onHoldStart();
    },
    [disabled, onHoldStart],
  );

  const handlePointerUp = useCallback(() => {
    if (disabled) return;
    onHoldEnd && onHoldEnd();
  }, [disabled, onHoldEnd]);

  // Visual state classes — no animation per Gate 2 E-1.
  // Static color swap only. Disabled = 50% opacity per spec.
  const base =
    'inline-flex items-center justify-center rounded-full select-none ' +
    'border border-gray-600 ' +
    'transition-colors duration-0'; // duration-0 = explicit no transition

  let stateClasses = 'bg-gray-700 text-white';
  if (isListening) stateClasses = 'bg-emerald-700 text-white';
  if (disabled) stateClasses = 'bg-gray-700 text-white opacity-50 cursor-not-allowed';

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={isListening}
      aria-disabled={disabled}
      data-testid={testId}
      data-state={
        disabled
          ? permissionStatus === 'denied'
            ? 'denied'
            : 'unsupported'
          : isListening
            ? 'listening'
            : 'idle'
      }
      style={{ width: SIZE_PX, height: SIZE_PX }}
      className={`${base} ${stateClasses}`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerLeave={handlePointerUp}
      // Prevent the browser's default mouse-up-only behavior from missing touch.
      onContextMenu={(e) => e.preventDefault()}
    >
      {SVG_MIC}
    </button>
  );
}
