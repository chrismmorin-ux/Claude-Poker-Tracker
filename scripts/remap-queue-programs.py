"""Remap queue items from project-name-as-program to registered-program.

Each WS-*.yaml has both `category` (project) and `program` (accountability).
The 2026-05-01 BACKLOG migration set program == category, but only
domain-correctness is a registered program. This script remaps program
to a real registered program while keeping category as project identity.
"""
import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
QUEUE_DIR = REPO / ".claude" / "workstream" / "queue"
INDEX = REPO / ".claude" / "workstream" / "queue-index.yaml"

# project-name -> registered-program
MAP = {
    "tableview-invariant-audit":   "engineering",
    "ready-to-start":              "engineering",
    "sidebar-recurrence":          "engineering",
    "exploit-anchor-library":      "domain-correctness",
    "line-study-slice-widening":   "domain-correctness",
    "player-identification-v2":    "design",
    "self-coach-foundation":       "design",
    "shape-language":              "design",
    "printable-refresher":         "design",
    "monetization-and-pmf":        "launch",
    # domain-correctness already maps to itself (no-op)
    "domain-correctness":          "domain-correctness",
}

PROGRAM_LINE_RE = re.compile(r'^(\s*)program:\s*"([^"]+)"\s*$', re.MULTILINE)

def remap_file(path: Path) -> tuple[bool, str]:
    text = path.read_text(encoding="utf-8")
    changes = []

    def sub(m):
        indent, current = m.group(1), m.group(2)
        target = MAP.get(current, current)
        if target != current:
            changes.append(f"{current} -> {target}")
        return f'{indent}program: "{target}"'

    new = PROGRAM_LINE_RE.sub(sub, text)
    if new != text:
        path.write_text(new, encoding="utf-8")
    return bool(changes), "; ".join(changes)


def main():
    individual = list(QUEUE_DIR.glob("WS-*.yaml"))
    changed_files = 0
    for f in individual:
        changed, _ = remap_file(f)
        if changed:
            changed_files += 1

    # queue-index.yaml has many program: lines; remap_file handles them all in one pass
    idx_changed, _ = remap_file(INDEX)

    print(f"WS-*.yaml files changed: {changed_files} of {len(individual)}")
    print(f"queue-index.yaml changed: {idx_changed}")


if __name__ == "__main__":
    main()
