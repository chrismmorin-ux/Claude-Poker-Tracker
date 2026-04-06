# FM-003: Session Ended Without Closing Handoff

Severity: MEDIUM
First observed: 2026-04-06 (detected during governance audit)
Last observed: 2026-04-06
Occurrences: 1 (pm-overhaul handoff marked ACTIVE after session ended)

## What Happened

The pm-overhaul session completed its work and the session ended, but the handoff file remained Status: ACTIVE with 12 files listed under "Files I Own". This blocked other sessions from editing those files (or at minimum, the Session Start Protocol would flag them as owned).

## Root Cause

The session completed naturally (context window filled or user ended it) without running `/handoff` to close out. The handoff system has no automatic cleanup — it relies on the session explicitly writing a COMPLETE status before ending.

## Detection

Check all `.claude/handoffs/*.md` files. Any file with Status: ACTIVE where the session hasn't committed code in >24 hours is likely this failure. `/handoff status` detects this via staleness flags.

## Prevention

1. Always run `/handoff` before ending a session — this is in the CLAUDE.md protocol
2. Use `/handoff cleanup` periodically to remove COMPLETE handoffs >7 days old
3. `/status refresh` flags stale ACTIVE handoffs for manual review
4. The `/health-check` command (Phase 4) will detect and flag these automatically

## Related Invariants

None directly. This is a session lifecycle failure.
