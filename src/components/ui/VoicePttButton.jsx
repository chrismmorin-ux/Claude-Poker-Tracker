/**
 * VoicePttButton.jsx — push-to-talk widget for VCE
 *
 * Surface spec: docs/design/surfaces/voice-card-entry.md
 * Ticket: WS-181
 *
 * Design contract (binding):
 *   - 56×56 DOM-px hit area (Gate 2 E-7). H-ML06 ≥44 visual-px floor.
 *   - 300ms hold threshold (hold mode) enforced by hook (Gate 2 E-3).
 *   - No PULSING animation (Gate 2 E-1 / H-PLT04 socially discreet).
 *   - Active state uses static color swap + 2px border thickening. Static, not animated.
 *   - Triple feedback: haptic vibration (hook), inline "Listening..." label, 2px emerald
 *     border. Multi-channel redundancy without violating H-PLT04 (no pulsing).
 *   - Activation mode: 'hold' uses pointer-down/up; 'tap' uses single tap to toggle.
 *
 * Scope label:
 *   - Defaults to "BOARD" so the user can't confuse voice-entered cards with hole
 *     cards. Per-villain instances on ShowdownView pass label="V<seat>".
 */

import { useCallback, useEffect, useRef } from 'react';

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
 * @param {boolean} props.supported
 * @param {string}  props.permissionStatus
 * @param {boolean} props.isListening
 * @param {'hold' | 'tap'} props.activationMode
 * @param {() => void} props.onHoldStart  — only used in hold mode
 * @param {() => void} props.onHoldEnd    — only used in hold mode
 * @param {() => void} props.onTapToggle  — only used in tap mode
 * @param {string=} props.scopeLabel       — e.g., "BOARD" or "V3" — displayed on chip
 * @param {string=} props.ariaLabel
 * @param {string=} props.testId
 * @param {string=} props.feedbackPlacement — 'bottom' (default) or 'top' for the
 *                                            inline "Listening..." label location.
 */
export default function VoicePttButton({
  supported,
  permissionStatus,
  isListening,
  activationMode = 'hold',
  onHoldStart,
  onHoldEnd,
  onTapToggle,
  scopeLabel = 'BOARD',
  ariaLabel,
  testId = 'voice-ptt-button',
  feedbackPlacement = 'bottom',
}) {
  const disabled = !supported || permissionStatus === 'denied';
  const wasListeningRef = useRef(false);

  // Track listening transitions for diagnostic data-attrs (also exposed for tests).
  useEffect(() => {
    wasListeningRef.current = isListening;
  }, [isListening]);

  const handlePointerDown = useCallback(
    (e) => {
      if (disabled) return;
      try { e.preventDefault(); } catch { /* ignore */ }
      if (activationMode === 'tap') return; // tap mode listens on click, not pointer-down
      onHoldStart && onHoldStart();
    },
    [disabled, onHoldStart, activationMode],
  );

  const handlePointerUp = useCallback(() => {
    if (disabled) return;
    if (activationMode === 'tap') return;
    onHoldEnd && onHoldEnd();
  }, [disabled, onHoldEnd, activationMode]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    if (activationMode !== 'tap') return;
    onTapToggle && onTapToggle();
  }, [disabled, onTapToggle, activationMode]);

  // Visual state — static color + border (no animation per Gate 2 E-1).
  const base =
    'inline-flex flex-col items-center justify-center rounded-full select-none ' +
    'transition-colors duration-0';

  let stateClasses = 'bg-gray-700 text-white border border-gray-600';
  if (isListening) {
    stateClasses = 'bg-emerald-700 text-white border-2 border-emerald-400 ring-2 ring-emerald-500/40';
  }
  if (disabled) {
    stateClasses = 'bg-gray-700 text-white border border-gray-600 opacity-50 cursor-not-allowed';
  }

  const labelText = isListening ? 'Listening…' : scopeLabel;

  const finalAriaLabel = ariaLabel || (
    activationMode === 'tap'
      ? (isListening ? `Tap to stop voice entry (${scopeLabel})` : `Tap to speak ${scopeLabel} cards`)
      : `Hold to speak ${scopeLabel} cards`
  );

  return (
    <div
      className={`relative inline-flex flex-col items-center ${feedbackPlacement === 'top' ? 'flex-col-reverse' : ''}`}
      data-testid={`${testId}-wrapper`}
    >
      <button
        type="button"
        aria-label={finalAriaLabel}
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
        data-activation-mode={activationMode}
        data-scope-label={scopeLabel}
        style={{ width: SIZE_PX, height: SIZE_PX }}
        className={`${base} ${stateClasses}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={handleClick}
        onContextMenu={(e) => e.preventDefault()}
      >
        {SVG_MIC}
      </button>
      {/* Inline scope/listening label — small, close-range only (H-PLT04 OK).
          Always renders so the button surface communicates BOARD vs V<seat>
          even before any interaction; flips to "Listening…" during capture. */}
      <span
        data-testid={`${testId}-label`}
        className={`mt-0.5 text-[10px] leading-tight px-1 rounded ${
          isListening
            ? 'bg-emerald-700/80 text-white font-semibold'
            : 'text-gray-300 font-medium'
        }`}
        aria-hidden="true"
      >
        {labelText}
      </span>
    </div>
  );
}
