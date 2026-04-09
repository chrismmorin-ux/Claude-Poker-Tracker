# FM-001: Stale "Pending" References After Work Completed

Severity: MEDIUM
First observed: 2026-04-06 (detected during governance audit)
Last observed: 2026-04-06
Occurrences: 3 (RT-11, RT-12, RT-15 all completed but SYSTEM_MODEL.md still said "pending")

## What Happened

AI sessions completed roundtable findings (RT-11, RT-12, RT-15) but did not update SYSTEM_MODEL.md to remove the "pending RT-X" notes. The system model continued to describe risks as unmitigated when they were already fixed.

## Root Cause

Sessions focused on the implementation work and updated BACKLOG.md status to DONE, but did not read SYSTEM_MODEL.md to check for cross-references to the same item. The SYSTEM_MODEL.md update was a secondary task that fell outside the session's focus.

## Detection

Grep for "pending" or "Pending" in `.claude/context/SYSTEM_MODEL.md`. Any match referencing a DONE backlog item is this failure.

## Prevention

After completing any backlog item:
1. Grep SYSTEM_MODEL.md for the item ID (e.g., "RT-11")
2. If found, update the reference to reflect resolution
3. Bump SYSTEM_MODEL.md version and timestamp

## Related Invariants

None directly. This is a documentation hygiene failure, not a code invariant violation.
