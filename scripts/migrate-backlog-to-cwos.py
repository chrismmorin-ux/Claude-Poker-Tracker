#!/usr/bin/env python3
"""
One-shot migration: .claude/BACKLOG.md (table-format) -> .claude/workstream/queue/WS-*.yaml.

Run from repo root. Idempotent within a single run; rerun creates duplicates if
existing WS-*.yaml files aren't cleared first.
"""

from __future__ import annotations

import re
from pathlib import Path
from datetime import date

REPO_ROOT = Path(__file__).resolve().parents[1]
BACKLOG_PATH = REPO_ROOT / ".claude" / "BACKLOG.md"
QUEUE_DIR = REPO_ROOT / ".claude" / "workstream" / "queue"
QUEUE_INDEX = REPO_ROOT / ".claude" / "workstream" / "queue-index.yaml"

# Status mappings.
SKIP_STATUS_PREFIXES = (
    "complete",
    "rejected",
    "p0-complete",
    "audit-complete",
)

PRIORITY_MAP = {"P0": 30.0, "P1": 22.0, "P2": 15.0, "P3": 8.0}

# Map BACKLOG section title fragments -> CWOS program slug.
# Uses substring match on the H2 heading. First match wins.
SECTION_TO_PROGRAM = [
    ("TableView Invariant Audit", "tableview-invariant-audit"),
    ("Player Identification v2", "player-identification-v2"),
    ("Self-Coach Foundation", "self-coach-foundation"),
    ("Exploit Anchor Library", "exploit-anchor-library"),
    ("Monetization & PMF", "monetization-and-pmf"),
    ("Shape Language", "shape-language"),
    ("Printable Refresher", "printable-refresher"),
    ("Line Study Slice Widening", "line-study-slice-widening"),
    ("Line Study", "line-study"),
    ("Player Entry Overhaul", "player-entry-overhaul"),
    ("Sidebar Recurrence Program", "sidebar-recurrence"),
    ("Drills Consolidation", "drills-consolidation"),
    ("Line Study Bucket-Level", "line-study-bucket-teaching"),
    ("Ready to Start", "ready-to-start"),
    ("PAUSED", "paused-bucket"),
]


def slug_program(section: str) -> str:
    for needle, slug in SECTION_TO_PROGRAM:
        if needle.lower() in section.lower():
            return slug
    return "uncategorized"


def parse_priority(p: str) -> float:
    p = p.strip()
    return PRIORITY_MAP.get(p, 12.0)


def map_status(raw: str) -> tuple[str, str | None]:
    """Map BACKLOG status -> (cwos_status, status_note)."""
    s = raw.strip()
    s_lower = s.lower()
    if s_lower.startswith("next"):
        return "backlog", None
    if s_lower.startswith("in progress"):
        return "in_progress", s if s.lower() != "in progress" else None
    if s_lower.startswith("blocked"):
        return "backlog", s
    if s_lower.startswith("partial"):
        return "in_progress", s
    if s_lower.startswith("paused"):
        return "backlog", s
    if s_lower.startswith("deferred"):
        return "backlog", s
    if s_lower.startswith("later"):
        return "backlog", s
    if s_lower.startswith("parked"):
        return "backlog", s
    if s_lower.startswith("scheduled"):
        return "backlog", s
    if s_lower.startswith("threaded"):
        return "backlog", s
    return "backlog", s


def extract_blocked_by_legacy(status: str) -> list[str]:
    """Pull legacy IDs out of `BLOCKED by X+Y`, `BLOCKED by X / Y`, etc.

    Handles:
      - Dotted IDs: `TIA-1.1` (allows `.` inside the id body).
      - Continuation suffixes: `TIA-1.1+1.2` -> [`TIA-1.1`, `TIA-1.2`].
      - Stops scanning a piece at the first non-id token: `MPMF-G4-* + Q7 verdict` -> [`MPMF-G4-*`].
    """
    m = re.match(r"\s*BLOCKED\s+by\s+(.*)", status, re.IGNORECASE)
    if not m:
        return []
    rest = m.group(1)
    pieces = re.split(r"[+,/]| and ", rest)
    out: list[str] = []
    last_program_prefix: str | None = None
    for piece in pieces:
        piece = piece.strip()
        if not piece:
            continue
        # Full id: starts with letters, has at least one dash, allows dots/numerics/asterisks.
        full_id = re.match(r"^([A-Z][A-Z0-9]*(?:-[A-Z0-9.*]+)+)", piece)
        if full_id:
            legacy = full_id.group(1)
            out.append(legacy)
            # Preserve the leading "program-section" pair (e.g. `TIA-1` from `TIA-1.1`)
            # so a bare-numeric continuation can re-attach it.
            prefix_match = re.match(r"^([A-Z][A-Z0-9]*-[A-Z0-9]+)", legacy)
            if prefix_match:
                last_program_prefix = prefix_match.group(1)
            continue
        # Continuation: bare-numeric piece following a `+`. Reattach last prefix.
        cont = re.match(r"^([0-9.]+[A-Z0-9.]*)", piece)
        if cont and last_program_prefix:
            # Drop the trailing minor of the prefix and replace with the continuation.
            base = re.sub(r"-[A-Z0-9]+$", "", last_program_prefix)
            out.append(f"{base}-{cont.group(1)}")
    return out


def title_from_description(desc: str) -> str:
    """Title = first sentence of description, stripped of markdown emphasis."""
    desc = desc.strip()
    if not desc:
        return "(untitled)"
    # Pull bolded lead phrase if it's the opener.
    m = re.match(r"^\*\*([^*]+?)\*\*\s*(?:—|-|:)?\s*(.*)", desc, re.DOTALL)
    if m:
        title = m.group(1).strip()
    else:
        # First sentence/clause up to em-dash, period, or pipe.
        m2 = re.match(r"^([^—\.|]+)", desc)
        title = m2.group(1).strip() if m2 else desc[:80]
    title = re.sub(r"`([^`]+)`", r"\1", title)
    title = re.sub(r"\*\*([^*]+)\*\*", r"\1", title)
    title = re.sub(r"\s+", " ", title).strip()
    if len(title) > 120:
        title = title[:117] + "..."
    return title or "(untitled)"


def parse_accept_criteria(raw: str) -> list[str]:
    raw = raw.strip()
    if not raw or raw == "—" or raw.lower() == "n/a":
        return []
    # Split on `;` first, fall back to whole string.
    parts = [p.strip() for p in raw.split(";") if p.strip()]
    return parts or [raw]


def parse_backlog() -> list[dict]:
    """Walk BACKLOG.md and emit one dict per active table-row item."""
    text = BACKLOG_PATH.read_text(encoding="utf-8")
    lines = text.splitlines()

    items: list[dict] = []
    section = ""
    for idx, line in enumerate(lines, start=1):
        if line.startswith("## "):
            section = line.lstrip("# ").strip()
            continue
        if section.lower().startswith("status key"):
            continue
        if section.lower().startswith("recently completed"):
            continue
        if not line.startswith("|"):
            continue
        # Skip column-header rows (`| ID | Pri | Status | ...`).
        if re.search(r"\|\s*ID\s*\|\s*Pri\s*\|", line):
            continue
        # Skip alignment rows (`|----|----|...`).
        if re.match(r"^\|\s*-+\s*\|", line):
            continue

        # Parse pipe-separated cells (drop leading/trailing empties from `|...|`).
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        if len(cells) < 5:
            continue
        legacy_id, pri, status, desc, accept = cells[0], cells[1], cells[2], cells[3], cells[4]

        if not re.match(r"^[A-Z]+[A-Z0-9]*-[A-Z0-9]", legacy_id):
            continue

        # Filter completed/rejected outright.
        s_low = status.lower()
        if any(s_low.startswith(p) for p in SKIP_STATUS_PREFIXES):
            continue
        # Strip trailing date qualifiers from REJECTED variants too.
        if "rejected" in s_low:
            continue

        cwos_status, status_note = map_status(status)
        blocked_legacy = extract_blocked_by_legacy(status)

        items.append({
            "legacy_id": legacy_id,
            "section": section,
            "program": slug_program(section),
            "priority": pri,
            "priority_score": parse_priority(pri),
            "status_raw": status,
            "status_note": status_note,
            "cwos_status": cwos_status,
            "blocked_by_legacy": blocked_legacy,
            "description": desc,
            "accept_criteria": parse_accept_criteria(accept),
            "title": title_from_description(desc),
            "source_line": idx,
        })

    return items


def yaml_quote(s: str) -> str:
    """Conservative YAML double-quoted string."""
    s = s.replace("\\", "\\\\").replace('"', '\\"')
    s = s.replace("\n", "\\n")
    return f'"{s}"'


def yaml_block_scalar(s: str, indent: int = 2) -> str:
    """Emit a `|` block scalar with given indent."""
    pad = " " * indent
    body_lines = s.splitlines() or [s]
    body = "\n".join(pad + line for line in body_lines)
    return "|\n" + body


def render_item(item: dict, ws_id: str, legacy_to_ws: dict[str, str]) -> str:
    blocked_ws = []
    for legacy in item["blocked_by_legacy"]:
        if legacy in legacy_to_ws:
            blocked_ws.append(legacy_to_ws[legacy])

    today = date.today().isoformat()
    lines: list[str] = []
    lines.append(f'id: "{ws_id}"')
    lines.append(f"title: {yaml_quote(item['title'])}")
    lines.append(f'legacy_id: "{item["legacy_id"]}"')
    lines.append("type: improvement")
    lines.append(f'status: {item["cwos_status"]}')
    lines.append('claimed_by: ""')
    lines.append("claimed_at: null")
    lines.append("completed_at: null")
    lines.append(f"priority_score: {item['priority_score']}")
    lines.append(f'priority_label: "{item["priority"]}"')
    lines.append(f'category: "{item["program"]}"')
    lines.append('capability: "core"')
    lines.append(f'program: "{item["program"]}"')
    lines.append("description: " + yaml_block_scalar(item["description"], indent=2))

    if item["accept_criteria"]:
        lines.append("accept_criteria:")
        for ac in item["accept_criteria"]:
            lines.append(f"  - {yaml_quote(ac)}")
    else:
        lines.append("accept_criteria: []")

    lines.append('effort: "M"')
    lines.append("files_involved: []")

    if blocked_ws:
        lines.append("blocked_by:")
        for b in blocked_ws:
            lines.append(f'  - "{b}"')
    else:
        lines.append("blocked_by: []")

    if item["blocked_by_legacy"]:
        lines.append("blocked_by_legacy:")
        for b in item["blocked_by_legacy"]:
            lines.append(f'  - "{b}"')
    else:
        lines.append("blocked_by_legacy: []")

    lines.append("enables: []")
    lines.append('sprint_id: ""')
    lines.append("decision_flags: []")

    if item["status_note"]:
        lines.append(f"status_note: {yaml_quote(item['status_note'])}")

    lines.append("source:")
    lines.append('  origin: "backlog-md-migration-2026-05-01"')
    lines.append(f'  legacy_section: {yaml_quote(item["section"])}')
    lines.append(f"  source_line: {item['source_line']}")
    lines.append(f'created_at: "{today}"')
    lines.append(f'updated_at: "{today}"')

    return "\n".join(lines) + "\n"


def render_index(items_with_ids: list[tuple[str, dict]]) -> str:
    today = date.today().isoformat()
    lines: list[str] = []
    lines.append("# Queue Index — maintained automatically by /workstream commands")
    lines.append("# This file is the fast-scan summary of all active work items.")
    lines.append("# Commands read this file instead of scanning individual WS-*.yaml files.")
    lines.append("# Full item details are loaded on-demand from queue/WS-<id>.yaml.")
    lines.append("#")
    lines.append("# Rebuild from files: scan queue/WS-*.yaml, extract summary fields")
    lines.append("# Updated by: /workstream create, claim, release, start, done, block")
    lines.append("")
    lines.append(f"last_updated: \"{today}\"")
    lines.append(f"item_count: {len(items_with_ids)}")
    lines.append("items:")
    for ws_id, item in items_with_ids:
        lines.append(f'  - id: "{ws_id}"')
        lines.append(f"    title: {yaml_quote(item['title'])}")
        lines.append(f'    legacy_id: "{item["legacy_id"]}"')
        lines.append(f'    status: {item["cwos_status"]}')
        lines.append(f"    priority_score: {item['priority_score']}")
        lines.append(f'    priority_label: "{item["priority"]}"')
        lines.append(f'    category: "{item["program"]}"')
        lines.append(f'    capability: "core"')
        lines.append(f'    program: "{item["program"]}"')
        lines.append(f'    type: improvement')
        lines.append(f'    effort: "M"')
        lines.append(f'    claimed_by: ""')
        lines.append(f'    sprint_id: ""')
    return "\n".join(lines) + "\n"


def main() -> None:
    items = parse_backlog()
    print(f"Parsed {len(items)} active items from BACKLOG.md")

    # Assign sequential WS-NNN ids; preserve BACKLOG order so legacy chains stay readable.
    legacy_to_ws: dict[str, str] = {}
    items_with_ids: list[tuple[str, dict]] = []
    for n, item in enumerate(items, start=1):
        ws_id = f"WS-{n:03d}"
        legacy_to_ws[item["legacy_id"]] = ws_id
        items_with_ids.append((ws_id, item))

    QUEUE_DIR.mkdir(parents=True, exist_ok=True)

    # Clear any prior WS-*.yaml from a botched previous run.
    for existing in QUEUE_DIR.glob("WS-*.yaml"):
        existing.unlink()

    blocked_resolved = 0
    blocked_unresolved = 0
    for ws_id, item in items_with_ids:
        for legacy in item["blocked_by_legacy"]:
            if legacy in legacy_to_ws:
                blocked_resolved += 1
            else:
                blocked_unresolved += 1
        path = QUEUE_DIR / f"{ws_id}.yaml"
        path.write_text(render_item(item, ws_id, legacy_to_ws), encoding="utf-8")

    QUEUE_INDEX.write_text(render_index(items_with_ids), encoding="utf-8")

    print(f"Wrote {len(items_with_ids)} WS-*.yaml files to {QUEUE_DIR}")
    print(f"Updated {QUEUE_INDEX}")
    print(f"blocked_by mapping: {blocked_resolved} resolved, {blocked_unresolved} unresolved (legacy IDs not in active set)")


if __name__ == "__main__":
    main()
