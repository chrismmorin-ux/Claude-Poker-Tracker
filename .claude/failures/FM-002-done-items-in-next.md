# FM-002: Completed Items Lingering in Active Backlog

Severity: LOW
First observed: 2026-04-06 (detected during governance audit)
Last observed: 2026-04-06
Occurrences: 14 (RT-1 through RT-19 DONE items remained in BACKLOG.md NEXT section)

## What Happened

Sessions marked backlog items as DONE but did not move them to BACKLOG_ARCHIVE.md. The NEXT section accumulated 14 DONE items alongside 8 actual NEXT items, making it hard to see what work was actually available.

## Root Cause

The `/backlog complete` command updates the status to DONE but does not automatically archive. The archive step requires a separate `/backlog archive` call that sessions skipped. The Recommended Execution Order block also wasn't updated when items completed.

## Detection

Grep BACKLOG.md for `| DONE |` in any section other than the archive. Any match is this failure.

## Prevention

1. After marking any item DONE, immediately check if it should be archived
2. Use `/backlog sweep` (Phase 3c) to auto-archive DONE items
3. Update the Recommended Execution Order when completing items referenced in it

## Related Invariants

None directly. This is a workflow hygiene failure.
