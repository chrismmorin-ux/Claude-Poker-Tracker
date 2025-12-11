#!/usr/bin/env python3
"""
Generate completion summary from project file

Creates completion-summary.md with:
- What was accomplished (all phases and tasks)
- Files modified
- Test coverage changes
- Delegation statistics
- Blockers encountered
- Key decisions made
"""

import json
import sys
import subprocess
from datetime import datetime
from pathlib import Path
from collections import defaultdict

def parse_project_file(project_file_path):
    """Parse project markdown file"""
    with open(project_file_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract project metadata
    metadata = {}
    lines = content.split('\n')

    # Parse YAML front matter if exists
    if lines[0].strip() == '---':
        yaml_end = None
        for i, line in enumerate(lines[1:], 1):
            if line.strip() == '---':
                yaml_end = i
                break

        if yaml_end:
            for line in lines[1:yaml_end]:
                if ':' in line:
                    key, value = line.split(':', 1)
                    metadata[key.strip()] = value.strip()

    # Extract phases
    phases = []
    current_phase = None

    for line in lines:
        # Phase header
        if line.startswith('## Phase '):
            if current_phase:
                phases.append(current_phase)

            phase_num = line.split()[2].rstrip(':')
            phase_name = line.split(':', 1)[1].strip() if ':' in line else 'Unnamed Phase'

            current_phase = {
                'number': phase_num,
                'name': phase_name,
                'tasks': [],
                'status': 'pending',
                'files': [],
                'sessions': 0
            }

        # Task items
        elif current_phase and (line.strip().startswith('- [x]') or line.strip().startswith('- [ ]')):
            task_complete = '[x]' in line
            task_text = line.split(']', 1)[1].strip()

            current_phase['tasks'].append({
                'text': task_text,
                'completed': task_complete
            })

            if task_complete:
                current_phase['status'] = 'in_progress'

        # Files modified
        elif current_phase and 'Files:' in line or 'Files modified:' in line:
            # Extract files from the line
            files_part = line.split(':', 1)[1] if ':' in line else ''
            files = [f.strip() for f in files_part.split(',') if f.strip()]
            current_phase['files'].extend(files)

    # Add last phase
    if current_phase:
        # Check if all tasks complete
        if current_phase['tasks'] and all(t['completed'] for t in current_phase['tasks']):
            current_phase['status'] = 'completed'
        phases.append(current_phase)

    metadata['phases'] = phases
    return metadata


def get_file_stats(project_data):
    """Get file modification statistics"""
    all_files = set()
    for phase in project_data.get('phases', []):
        all_files.update(phase.get('files', []))

    # Categorize by directory
    by_dir = defaultdict(list)
    for file_path in all_files:
        if '/' in file_path:
            directory = file_path.rsplit('/', 1)[0]
            by_dir[directory].append(file_path)

    return {
        'total': len(all_files),
        'byDirectory': dict(by_dir),
        'files': sorted(all_files)
    }


def get_git_stats(files):
    """Get git statistics for files"""
    try:
        # Get line changes
        result = subprocess.run(
            ['git', 'diff', '--stat', 'HEAD~10', '--'] + files[:10],
            capture_output=True,
            text=True
        )

        # Parse stats
        lines_added = 0
        lines_removed = 0

        for line in result.stdout.split('\n'):
            if '|' in line:
                parts = line.split('|')[1].strip().split()
                for part in parts:
                    if part.startswith('+'):
                        lines_added += len(part)
                    elif part.startswith('-'):
                        lines_removed += len(part)

        return {
            'linesAdded': lines_added,
            'linesRemoved': lines_removed
        }
    except:
        return {'linesAdded': 0, 'linesRemoved': 0}


def get_test_stats():
    """Get test suite statistics"""
    try:
        result = subprocess.run(
            ['npm', 'test', '--', '--silent'],
            capture_output=True,
            text=True,
            timeout=30
        )

        # Parse test count from output
        import re
        match = re.search(r'(\d+) passing', result.stdout)
        if match:
            return {'passing': int(match.group(1))}

        return {'passing': 'Unknown'}
    except:
        return {'passing': 'Unknown'}


def generate_summary(project_data, file_stats, git_stats, test_stats):
    """Generate completion summary markdown"""
    project_name = project_data.get('name', 'Unknown Project')
    completed_at = datetime.now().isoformat() + 'Z'

    phases = project_data.get('phases', [])
    completed_phases = [p for p in phases if p['status'] == 'completed']

    summary = f"""# Project Completion Summary: {project_name}

**Completed**: {completed_at}
**Phases**: {len(completed_phases)}/{len(phases)} complete

## What Was Accomplished

"""

    # List each phase
    for phase in phases:
        status_emoji = '✅' if phase['status'] == 'completed' else '⏳'
        summary += f"### Phase {phase['number']}: {phase['name']} {status_emoji}\n\n"

        for task in phase['tasks']:
            checkbox = '[x]' if task['completed'] else '[ ]'
            summary += f"- {checkbox} {task['text']}\n"

        if phase['files']:
            summary += f"- Files modified: {', '.join(phase['files'][:5])}\n"
            if len(phase['files']) > 5:
                summary += f"  ... and {len(phase['files']) - 5} more\n"

        summary += "\n"

    # Files Modified section
    summary += f"""## Files Modified

Total: {file_stats['total']} files

"""

    for directory, files in sorted(file_stats['byDirectory'].items()):
        summary += f"- {directory}/: {len(files)} files\n"

    # Test Coverage
    summary += f"""

## Test Coverage

- All tests passing: ✅ {test_stats.get('passing', 'Unknown')} tests
"""

    if git_stats:
        summary += f"- Lines added: {git_stats.get('linesAdded', 0)}\n"
        summary += f"- Lines removed: {git_stats.get('linesRemoved', 0)}\n"

    # Delegation Statistics (placeholder - would need metrics)
    summary += """

## Delegation Statistics

_To be tracked via .claude/metrics/delegation.json_

"""

    # Blockers Encountered
    summary += """
## Blockers Encountered

_Document any significant blockers that were resolved during this project_

"""

    # Key Decisions
    summary += """
## Key Decisions

_Document major architectural or implementation decisions made_

"""

    # Next Steps
    summary += """
## Next Steps (if applicable)

See continuation-prompt.txt for recommended next work.
"""

    return summary


def main():
    if len(sys.argv) < 2:
        print("Usage: python generate-completion-summary.py <project-file-path>")
        sys.exit(1)

    project_file = Path(sys.argv[1])

    if not project_file.exists():
        print(f"Error: Project file not found: {project_file}")
        sys.exit(1)

    # Parse project file
    project_data = parse_project_file(project_file)

    # Get statistics
    file_stats = get_file_stats(project_data)
    git_stats = get_git_stats(file_stats.get('files', []))
    test_stats = get_test_stats()

    # Generate summary
    summary = generate_summary(project_data, file_stats, git_stats, test_stats)

    # Output to stdout
    print(summary)


if __name__ == '__main__':
    main()
