/**
 * VoiceNarrationSection.jsx — Voice Reasoning Notes (VRN) capture control.
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 * Gate 1: audits/2026-08-01-entry-voice-reasoning-notes.md
 * Gate 2: audits/2026-08-01-blindspot-voice-reasoning-notes.md
 *
 * SURFACE-AGNOSTIC. Mounted on both narration surfaces:
 *   - HandReplayView / ReviewPanel — steps action-by-action
 *   - AnalysisView / HandReviewPanel walkthrough — steps street-by-street
 * The caller supplies `buildContext`, so this component never learns how a given
 * surface represents its cursor. Both mounts sit next to that surface's stepping
 * controls, so the founder can hold to start and then navigate while talking (F4).
 *
 * Deliberately NOT adjacent to AnchorObservationSection: the two controls have
 * sharply different consequences and sitting them together invites misgrab
 * (Gate 2 C-5).
 *
 * Activation is hold-to-start, tap-to-stop (Gate 2 E-4). A bare tap must never
 * open a hot mic.
 *
 * Copy discipline inherited from the sibling capture surface: descriptive, never
 * evaluative. No "How did this hand go?", no praise, no scores here (AP-09 /
 * AP-06 / red line #7). Grader output is display-separated and ships in Phase 2.
 */

import React, { useCallback, useRef, useState } from 'react';
import { useVoiceReasoningNote } from '../../hooks/useVoiceReasoningNote';
import { fullTranscript } from '../../utils/voiceReasoning/noteSession';

const HOLD_TO_START_MS = 400;
// Covers only the click emitted by the release of the starting hold. Long enough
// for the browser's pointerup -> click gap, short enough that a deliberate Stop
// tap a moment later is always honoured.
const RELEASE_CLICK_GRACE_MS = 400;

// Plain description of how a session closed. Descriptive, never evaluative —
// this states what happened to the recording, not what it thinks of the hand.
// "I think it got cut off at some point" is the failure this copy exists to end:
// an auto-ended session used to be indistinguishable from a deliberate stop.
const END_REASON_LABEL = {
  silence: 'ended itself after 45s quiet',
  'max-duration': 'hit the 10 min length limit',
  hidden: 'ended when the screen went away',
  unmounted: 'ended when you left the screen',
  'restart-failed': 'ended — the mic dropped out',
  'not-allowed': 'ended — mic access was lost',
  'service-not-allowed': 'ended — mic access was lost',
};

const describeEnd = (reason) => END_REASON_LABEL[reason] || 'was cut short';

const formatClock = (ms) => {
  if (!Number.isFinite(ms) || ms <= 0) return '';
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const NoteRow = ({ note, onDelete }) => {
  const [expanded, setExpanded] = useState(false);
  const text = fullTranscript(note);
  const preview = text.length > 90 ? `${text.slice(0, 90)}…` : text;
  const streets = [...new Set((note.segments || []).map((s) => s.context?.street).filter(Boolean))];

  return (
    <div className="border-t border-gray-700/60 pt-1 mt-1 first:border-t-0 first:mt-0 first:pt-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left text-[11px] text-gray-300 hover:text-white"
        data-testid="vrn-note-row"
      >
        <span className="text-gray-500 mr-1">
          {note.segments?.length || 0} seg{(note.segments?.length || 0) === 1 ? '' : 's'}
        </span>
        {streets.length > 0 && (
          <span className="text-cyan-500/80 mr-1">{streets.join('→')}</span>
        )}
        {note.interrupted && (
          <span className="text-amber-500/90 mr-1" title={`Recording ${describeEnd(note.endReason)}`}>⚠</span>
        )}
        <span>{expanded ? text : preview}</span>
      </button>

      {expanded && (
        <div className="mt-1 pl-2 border-l border-gray-700">
          {note.interrupted && (
            <div className="text-[10px] text-amber-500/90 mb-1" data-testid="vrn-note-end-reason">
              Recording {describeEnd(note.endReason)} — the last thought may be incomplete.
            </div>
          )}
          {(note.segments || []).map((seg, i) => (
            <div key={i} className="mb-1">
              <div className="text-[10px] text-gray-500">
                {seg.context?.street || '—'}
                {/* actionIndex is null on the street-based review surface — it
                    only has a focused action when one was clicked. */}
                {Number.isInteger(seg.context?.actionIndex) && seg.context.actionIndex >= 0
                  ? ` · action ${seg.context.actionIndex + 1}`
                  : ''}
                {/* The pot travels with its basis: 'action' is exact, 'street-start'
                    is the pot as the street began. Without it the number is ambiguous. */}
                {seg.context?.pot
                  ? ` · pot $${seg.context.pot}${
                      seg.context.potBasis === 'street-start' ? ' (street start)' : ''
                    }`
                  : ''}
                {seg.context?.board?.length ? ` · ${seg.context.board.join(' ')}` : ''}
              </div>
              <div className="text-[11px] text-gray-300">{seg.text}</div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onDelete(note.id)}
            className="text-[10px] text-gray-500 hover:text-red-400 mt-1"
            data-testid="vrn-note-delete"
          >
            Delete note
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * @param {Object} props
 * @param {number|string|null} props.handId
 * @param {() => object|null} props.buildContext — state binding for this surface
 * @param {'replay'|'review'|'live'} [props.source]
 * @param {boolean} [props.enabled] — feature flag
 * @param {boolean} [props.compact] — tighter layout for space-constrained panels
 */
export const VoiceNarrationSection = ({
  handId,
  buildContext,
  source = 'replay',
  enabled = false,
  compact = false,
}) => {
  const {
    supported,
    permissionStatus,
    isRecording,
    segmentCount,
    error,
    isSaving,
    notes,
    lastEnd,
    start,
    stop,
    removeNote,
  } = useVoiceReasoningNote({
    handId,
    buildContext,
    source,
    enabled,
  });

  const holdTimerRef = useRef(null);
  const startedAtRef = useRef(0);
  const [elapsed, setElapsed] = useState(0);
  const tickRef = useRef(null);
  // The pointerup that ENDS the starting hold produces a click on the same
  // button, which would stop the recording the instant the finger lifts.
  //
  // Suppression is TIME-ANCHORED TO THE RELEASE, not a one-shot boolean. A
  // boolean flag armed at start is consumed by whatever click arrives next — and
  // if the release-click misses the button (finger drifted, pointer capture
  // quirk), the flag stays armed and silently swallows the founder's next
  // genuine Stop tap. A window that opens on pointerup and expires on its own
  // cannot get stuck, and works no matter how long the hold lasted.
  const startHoldPendingReleaseRef = useRef(false);
  const suppressClickUntilRef = useRef(0);

  const beginTicking = useCallback(() => {
    startedAtRef.current = Date.now();
    setElapsed(0);
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      setElapsed(Date.now() - startedAtRef.current);
    }, 1000);
  }, []);

  const stopTicking = useCallback(() => {
    if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    setElapsed(0);
  }, []);

  // Hold-to-start (Gate 2 E-4). Releasing before the threshold is a no-op — no mic.
  const handlePointerDown = useCallback(() => {
    if (isRecording) return;
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    holdTimerRef.current = setTimeout(() => {
      holdTimerRef.current = null;
      // Recording begins with the finger still down. Mark that a release is
      // still owed, so we know to absorb the click it generates.
      startHoldPendingReleaseRef.current = true;
      beginTicking();
      start();
    }, HOLD_TO_START_MS);
  }, [isRecording, start, beginTicking]);

  const handlePointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (startHoldPendingReleaseRef.current) {
      startHoldPendingReleaseRef.current = false;
      // Open a brief window covering only the click this release emits. It
      // expires on its own, so a missed click cannot leave suppression armed.
      suppressClickUntilRef.current = Date.now() + RELEASE_CLICK_GRACE_MS;
    }
  }, []);

  // ONE button, one handler. Recording must survive the release of the hold that
  // started it — that release is not a stop instruction, and treating it as one
  // ended sessions the moment the finger lifted.
  const handleClick = useCallback(() => {
    if (Date.now() < suppressClickUntilRef.current) {
      suppressClickUntilRef.current = 0;
      return;
    }
    if (isRecording) {
      stop();
      stopTicking();
    }
    // Not recording + a bare click = deliberately nothing. Starting requires a
    // hold, so an accidental tap can never open a hot mic.
  }, [isRecording, stop, stopTicking]);

  React.useEffect(() => {
    // The session can end on its own (silence ceiling, tab hidden). Keep the
    // clock honest when that happens.
    if (!isRecording) stopTicking();
  }, [isRecording, stopTicking]);

  React.useEffect(() => () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
  }, []);

  if (!enabled) return null;
  if (handId === null || handId === undefined) return null;

  const micBlocked = !supported || permissionStatus === 'denied';

  return (
    <div
      data-testid="voice-narration-section"
      className="shrink-0 bg-gray-800/40 rounded-lg px-3 py-2 border border-gray-700/50 flex flex-col gap-1"
    >
      <div className="flex items-center gap-2">
        {/* ONE button across both states. Swapping in a separate Stop control
            put a fresh element under the still-pressed finger, and the release
            of the starting hold clicked it — recording died on finger-lift.
            Same element, same position, state changes only its label. */}
        <button
          type="button"
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onClick={handleClick}
          disabled={micBlocked}
          className={`px-3 py-2 rounded text-xs font-semibold min-h-[44px] ${
            micBlocked
              ? 'bg-gray-800 text-gray-600 cursor-not-allowed'
              : isRecording
                ? 'bg-red-700 text-white hover:bg-red-600'
                : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
          }`}
          data-testid={isRecording ? 'vrn-stop-button' : 'vrn-start-button'}
          title={isRecording ? 'Tap to stop recording' : 'Hold to start recording'}
        >
          {isRecording ? '■ Stop' : '🎤 Talk through this hand'}
        </button>

        {isRecording && (
          <span className="flex items-center gap-1 text-[11px] text-red-400" data-testid="vrn-recording-indicator">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
            Recording {formatClock(elapsed)}
            <span className="text-gray-500 ml-1">
              · {segmentCount} seg{segmentCount === 1 ? '' : 's'}
            </span>
          </span>
        )}

        {!isRecording && !micBlocked && !compact && (
          <span className="text-[10px] text-gray-500">Hold to start · keep stepping while you talk</span>
        )}

        {!isRecording && !micBlocked && compact && notes.length > 0 && (
          <span className="text-[10px] text-gray-500">
            {notes.length} note{notes.length === 1 ? '' : 's'}
          </span>
        )}

        {isSaving && <span className="text-[10px] text-gray-500">Saving…</span>}
      </div>

      {micBlocked && (
        <div className="text-[10px] text-gray-500" data-testid="vrn-mic-blocked">
          {!supported
            ? 'Voice not supported on this browser.'
            : 'Microphone access denied — open device settings to enable.'}
        </div>
      )}

      {/* Told at the moment it happens, not only in the saved record. A session
          that ended on its own must never look like one the founder ended. */}
      {!isRecording && lastEnd?.interrupted && (
        <div className="text-[10px] text-amber-500/90" data-testid="vrn-last-end-notice">
          ⚠ Recording {describeEnd(lastEnd.reason)}. Saved up to that point.
        </div>
      )}

      {error && (
        <div className="text-[10px] text-amber-500" data-testid="vrn-error">
          {String(error)}
        </div>
      )}

      {notes.length > 0 && (
        <div
          className={compact ? 'mt-1 max-h-28 overflow-y-auto pr-1' : 'mt-1'}
          data-testid="vrn-note-list"
        >
          {notes.map((note) => (
            <NoteRow key={note.id} note={note} onDelete={removeNote} />
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceNarrationSection;
