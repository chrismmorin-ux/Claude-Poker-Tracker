---
name: explore-agent-rules
---

# Explore Agent Rules

**Purpose**: Constrain Explore agents to minimize token usage while maintaining effectiveness.

---

## Budget Tiers

| Mode | Max Files Read | Max Lines/File | Total Token Cap | Use Case |
|------|----------------|----------------|-----------------|----------|
| **quick** | 3 | 50 | 1,000 | Simple lookups, "where is X" |
| **medium** | 8 | 100 | 3,000 | Feature understanding, multi-file context |
| **thorough** | 15 | 200 | 8,000 | Architecture analysis, complex debugging |

**Default**: `quick` unless explicitly specified in agent prompt.

---

## Mandatory Rules

### Rule 1: Index First
Before ANY search:
1. Check `.claude/index/SYMBOLS.md` for function/constant locations
2. Check `.claude/index/STRUCTURE.md` for directory layout
3. Check `.claude/index/PATTERNS.md` for code patterns
4. Only proceed to Grep/Glob if index insufficient

### Rule 2: Scan Before Drill
```
REQUIRED SEQUENCE:
1. SCAN: Grep/Glob to find files (no Read tool)
2. EVALUATE: Review matched files, select most relevant
3. DRILL: Read ONLY selected files, ONLY relevant sections

FORBIDDEN:
- Reading a file without prior scan for that file type
- Reading full file when partial read sufficient
- Reading >3 files without reporting findings
```

### Rule 3: Exclusion Patterns
NEVER read these directories:
- `node_modules/`
- `dist/`
- `coverage/`
- `.git/`
- `*.min.js`
- `*.map`

### Rule 4: Context Preference
Prefer reading (in order):
1. `.claude/context/*.md` - Pre-summarized (~80% smaller)
2. `.claude/index/*.md` - Lookups (~95% smaller)
3. `docs/*.md` - Documentation
4. Source files - Only when above insufficient

---

## Mode Selection Guide

### Use `quick` for:
- "Where is function X defined?"
- "What file handles Y?"
- "Does the codebase have Z?"
- Simple symbol lookups

### Use `medium` for:
- "How does feature X work?"
- "What components use Y?"
- "Explain the flow of Z"
- Understanding 2-5 related files

### Use `thorough` for:
- "What is the overall architecture?"
- "Audit component X for issues"
- "Find all instances of pattern Y and analyze"
- Complex multi-file investigations

---

## Enforcement

Explore agents MUST:
1. State their budget tier at start
2. Track files read against limit
3. Stop and report if approaching limit
4. Justify any tier upgrade request

Example agent prompt format:
```
Explore (quick): Find where ACTIONS.FOLD is handled
Explore (medium): Understand the card selection flow
Explore (thorough): Audit the persistence layer architecture
```

---

## Token Estimation

| Operation | Estimated Tokens |
|-----------|------------------|
| Grep (any) | 100 |
| Glob (any) | 50 |
| Read (per 100 lines) | 400 |
| Read context file | 200-500 |
| Read index file | 50-150 |

---

## Reporting Format

At completion, Explore agent MUST report:
```
## Exploration Summary
- Mode: quick/medium/thorough
- Files scanned: N (via Grep/Glob)
- Files read: N (limit: X)
- Estimated tokens: N (budget: X)
- Answer found: Yes/No/Partial
```
