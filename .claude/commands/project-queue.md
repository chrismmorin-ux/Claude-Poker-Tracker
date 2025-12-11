# /project-queue - View Project Queue

Display all projects in priority order.

## Usage
```
/project-queue           # Show full queue
/project-queue --next    # Show only next project
/project-queue --active  # Show active projects only
```

## Output
```
╔═══════════════════════════════════════════════════════════╗
║                    PROJECT QUEUE                           ║
╠═══════════════════════════════════════════════════════════╣
║ ◀ NEXT: #1 [P1] Program Manager                           ║
║   Status: Phase 4/4 - Integration & Visibility            ║
║   File: docs/projects/1-P1-program-manager.project.md      ║
║   Progress: ~95% complete                                  ║
║                                                            ║
║ QUEUED:                                                    ║
║ ├─ #2 [P2] Firebase Auth (5/6 phases) - PAUSED            ║
║ ├─ #3 [P3] Firebase Cloud Sync (0/5 phases) - Planned     ║
║ ├─ #4 [P3] Player Tendencies (0/5 phases) - Planned       ║
║ ├─ #5 [P4] Range Analysis (0/4 phases) - Planned          ║
║ └─ #6 [P4] TypeScript Migration (0/3 phases) - Optional   ║
╚═══════════════════════════════════════════════════════════╝

Commands:
  /project start 1-P1-program-manager  # Start/continue next
  /project resume 2-P2-firebase-auth   # Resume paused project
```

## Queue Management

**Format**: `{queue}-{priority}-{slug}.project.md`
- Queue number (1-6): Execution order
- Priority (P1-P4): Urgency/importance
- Slug: Project name

**To reorder**: Rename files with new queue numbers

**Example**: Move Firebase Auth to #1:
```bash
# Swap queue numbers
mv 1-P1-program-manager.project.md 2-P1-program-manager.project.md
mv 2-P2-firebase-auth.project.md 1-P2-firebase-auth.project.md
```

## Integration
- Startup menu reads queue order from filenames
- BACKLOG.md references this queue
- `/project status` shows current position in queue
