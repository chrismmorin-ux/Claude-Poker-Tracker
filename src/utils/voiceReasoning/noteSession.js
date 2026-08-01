/**
 * voiceReasoning/noteSession.js — narration session assembly for VRN
 *
 * Surface spec: docs/design/surfaces/voice-reasoning-notes.md
 *
 * Pure functions. No side effects, no state, no IDB, no Date.now() at call sites
 * that matter — timestamps are passed in so sessions are deterministic in tests.
 *
 * A note is a SESSION with a segment timeline, not a single utterance bound to a
 * single snapshot (founder requirement F4). Recording stays open while the
 * founder navigates; each speech segment carries the state that was current when
 * it was spoken.
 *
 * RETENTION POLARITY — the inverse of Voice Card Entry's.
 * VCE gates hard and returns strict no-ops because its failure mode is data
 * corruption: a wrong card written to a hand is worse than no card. VRN's failure
 * mode is LOST EVIDENCE. So:
 *   - no confidence floor — low-confidence prose is still evidence
 *   - partial transcripts are retained and marked `interrupted`
 *   - only a genuinely empty session (no segment carries text) is a no-op
 * Do not "harden" this module by adding a confidence gate. That would be a
 * regression, not an improvement.
 */

const DEFAULT_ID_FACTORY = () => `vrn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/**
 * Start a new narration session.
 *
 * @param {object} options
 * @param {'replay'|'live'} options.source
 * @param {number} options.startedAt — ms epoch
 * @param {string|number|null} options.handId
 * @param {function} [options.idFactory] — injected for deterministic tests
 */
export function createSession({ source = 'replay', startedAt = 0, handId = null, idFactory = DEFAULT_ID_FACTORY } = {}) {
  return {
    id: idFactory(),
    handId,
    source,
    createdAt: startedAt,
    endedAt: null,
    segments: [],
    corrections: [],
    graders: {},
  };
}

/**
 * Append a speech segment. Returns a NEW session (non-mutating).
 *
 * Blank text is dropped — it carries no evidence and would only pad the timeline.
 * Everything else is retained regardless of confidence.
 *
 * @param {object} session
 * @param {object} segment
 * @param {string} segment.text
 * @param {number} [segment.confidence]
 * @param {number} [segment.startedAt]
 * @param {number} [segment.endedAt]
 * @param {object} [segment.context] — from buildReplaySnapshot()
 * @param {boolean} [segment.interrupted]
 */
export function appendSegment(session, segment = {}) {
  if (!session) return session;
  const text = typeof segment.text === 'string' ? segment.text.trim() : '';
  if (text.length === 0) return session;

  return {
    ...session,
    segments: [
      ...session.segments,
      {
        text,
        confidence: Number.isFinite(segment.confidence) ? segment.confidence : null,
        startedAt: Number(segment.startedAt) || null,
        endedAt: Number(segment.endedAt) || null,
        interrupted: !!segment.interrupted,
        context: segment.context ?? null,
      },
    ],
  };
}

/**
 * Close a session.
 *
 * Returns `null` for an empty session — nothing was said, so there is nothing to
 * persist. This is the ONLY no-op condition (see retention polarity above).
 *
 * @param {object} session
 * @param {object} options
 * @param {number} options.endedAt
 * @param {boolean} [options.interrupted] — session was cut rather than stopped
 *   cleanly (action arrived, screen slept, hand changed). Marks the trailing
 *   segment so a grader knows the thought may be unfinished (Gate 2 C-3).
 * @param {string|null} [options.endReason] — WHY it ended: 'stopped', 'silence',
 *   'max-duration', 'hidden', 'unmounted', 'restart-failed', or an engine error
 *   code. `interrupted` alone says a note may be short; this says what to do
 *   about it, and lets a grader discount a claim that was cut off mid-argument
 *   rather than reading the truncation as the founder's conclusion.
 */
export function finalizeSession(session, { endedAt = 0, interrupted = false, endReason = null } = {}) {
  if (!session || !Array.isArray(session.segments) || session.segments.length === 0) {
    return null;
  }

  let segments = session.segments;
  if (interrupted) {
    const last = segments[segments.length - 1];
    segments = [
      ...segments.slice(0, -1),
      { ...last, interrupted: true },
    ];
  }

  return {
    ...session,
    segments,
    endedAt,
    interrupted,
    endReason: typeof endReason === 'string' && endReason ? endReason : (interrupted ? 'interrupted' : 'stopped'),
  };
}

/**
 * Attach an append-only correction (Gate 2 E-5). The original segments are never
 * overwritten — a note the founder later disagrees with is still evidence about
 * what he thought at the time, and silently editing it destroys the evidentiary
 * value that is the feature's entire point.
 */
export function appendCorrection(note, { text = '', at = 0, segmentIndex = null } = {}) {
  if (!note) return note;
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed.length === 0) return note;
  return {
    ...note,
    corrections: [
      ...(note.corrections || []),
      { text: trimmed, at, segmentIndex },
    ],
  };
}

/**
 * Every distinct seat referenced by any segment's context — lets note records be
 * queried by player, not only by hand (Gate 2 B-3), so player-note surfaces can
 * consume VRN output instead of asking the founder to say it a second time.
 */
export function seatsReferencedBy(note) {
  const seats = new Set();
  for (const segment of note?.segments || []) {
    for (const seat of segment?.context?.seatsLive || []) {
      seats.add(Number(seat));
    }
  }
  return [...seats].sort((a, b) => a - b);
}

/** Concatenated transcript across all segments — for list rendering and search. */
export function fullTranscript(note) {
  return (note?.segments || []).map((s) => s.text).join(' ');
}
