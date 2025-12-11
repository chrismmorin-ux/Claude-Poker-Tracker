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

**Format**: `{priority}.{sequence}.{MMDD}-{name}.project.md`
- Priority (1-4): P1=1, P2=2, P3=3, P4=4
- Sequence (001-999): Order within priority
- Date (MMDD): When created
- Name: Project slug

**Adding new projects**:
```bash
# New urgent P1 (next sequence in P1)
touch docs/projects/1.002.1212-security-audit.project.md

# New P3 feature
touch docs/projects/3.003.1212-new-feature.project.md
```

**Changing priority**:
```bash
# Promote P2 project to P1
mv 2.001.1210-firebase-auth.project.md 1.002.1210-firebase-auth.project.md
```

**Sorting is automatic**: 1.001 < 1.002 < 2.001 < 3.001 < 3.002

## Integration
- Startup menu reads queue order from filenames
- BACKLOG.md references this queue
- `/project status` shows current position in queue
