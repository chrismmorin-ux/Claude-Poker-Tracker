# Task Routing Helper - Quick Start

## What Is This?

Automated tools to help you decide when to use local models vs Claude, conserving Claude Code tokens while maintaining quality.

## Quick Start

### Step 1: Get Routing Suggestion (RECOMMENDED)

```bash
bash ./scripts/suggest-command.sh "Your task description"
```

**Example:**
```bash
bash ./scripts/suggest-command.sh "Create a utility function to format dates"
```

**Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Task Classification: simple_utility
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Recommended: DeepSeek (local model)

Reasoning:
  - Task appears to be a simple utility function (< 80 lines)
  - Expected generation time: ~30-45 seconds
  - Expected token savings: 70-85%

Suggested Command:
  /local-code Create a utility function to format dates
```

### Step 2: Follow the Suggestion

The script tells you exactly what command to run:
- `/local-code` - Use DeepSeek for code generation
- `/local-refactor` - Use Qwen for refactoring
- Claude - Use Claude directly for complex tasks

## Available Scripts

### 1. `suggest-command.sh` - Full Routing Suggestion
**What it does:** Analyzes your task and suggests which model to use with reasoning

**Usage:**
```bash
bash ./scripts/suggest-command.sh "task description"
```

**When to use:** Every time you're about to start a new task (use this first!)

---

### 2. `call-local-model.sh` with `auto` - Auto-Select Local Model
**What it does:** Automatically picks Qwen or DeepSeek and runs the task

**Usage:**
```bash
bash ./scripts/call-local-model.sh auto "task description"
```

**When to use:** When you've already decided to use a local model but don't know which one

---

### 3. `task-classifier.sh` - Just Get Classification
**What it does:** Outputs classification without suggestions

**Usage:**
```bash
bash ./scripts/task-classifier.sh "task description"
```

**Output:** One of:
- `simple_utility` - Simple function, use DeepSeek
- `simple_component` - Simple React component, use DeepSeek
- `refactor` - Refactoring task, use Qwen
- `complex` - Moderately complex, prefer Claude
- `claude_required` - Must use Claude

**When to use:** Scripting or automation

---

## Classification Logic

The scripts use keyword analysis to classify tasks:

### Simple Utility (→ DeepSeek)
Keywords: `utility`, `function`, `helper`, `transform`, `format`, `validate`
Excludes: `state`, `api`, `complex`

### Simple Component (→ DeepSeek)
Keywords: `component`, `jsx`, `react`, `button`, `badge`
Includes: `simple`, `small`, `basic`, `< 100 lines`
Excludes: `5+ props`, `complex`, `integration`

### Refactor (→ Qwen)
Keywords: `refactor`, `rename`, `extract`, `move`, `restructure`

### Claude Required
Keywords: `state`, `reducer`, `integration`, `hook`, `business logic`
Or: `multiple files`, `> 150 lines`

---

## Token Savings

Using local models correctly can save **70-85% of Claude tokens**:

**Example: Simple utility function**
- Full Claude generation: ~1000-2000 tokens
- Local model + Claude review: ~200-300 tokens
- **Savings: 70-85%**

**Example: Simple component**
- Full Claude generation: ~1500-2500 tokens
- Local model + Claude review: ~300-400 tokens
- **Savings: 80%**

---

## Workflow

### Recommended Workflow:

1. **Get suggestion:**
   ```bash
   bash ./scripts/suggest-command.sh "your task"
   ```

2. **Follow the command:**
   - If suggests `/local-code` → Run the slash command
   - If suggests `/local-refactor` → Run the slash command
   - If suggests Claude → Describe task to Claude directly

3. **Review output:**
   - For local model output, do a quick review with Claude
   - Ask Claude to "review and fix import paths, export style, and obvious bugs"
   - This still saves 70-85% of tokens vs full generation

---

## Common Issues & Fixes

### DeepSeek Common Errors:
1. **Import paths** (90% of time) - Use `../utils` instead of `../../utils`
2. **Export style** (80% of time) - Use `export default` instead of `export const`
3. **Props vs locals** (70% of time) - Define constants locally instead of props

### Qwen Common Errors:
1. **Over-explaining** (60% of time) - Add verbose comments
2. **Context missing** (40% of time) - Don't preserve surrounding code

**Solution:** Use prompt templates from `.claude/prompts/` to minimize errors

---

## Slash Commands Integration

The routing helper integrates with your custom slash commands:

- `/local-code [task]` → Uses DeepSeek
- `/local-refactor [task]` → Uses Qwen
- `/local [task]` → Auto-selects model
- `/route [task]` → Same as `suggest-command.sh`

---

## Files Created

```
scripts/
├── suggest-command.sh     (Full routing suggestion)
├── task-classifier.sh     (Classification logic)
├── select-model.sh        (Model selection for auto mode)
└── call-local-model.sh    (Updated with auto mode)

.claude/
└── prompts/
    ├── react-component.md    (React component template)
    └── utility-function.md   (Utility function template)
```

---

## Further Reading

- **Full Guide:** `.claude/LOCAL_MODELS_GUIDE.md` (~350 lines)
  - Model characteristics
  - Proven prompt patterns
  - Common fixes needed
  - Performance benchmarks
  - Decision tree details

- **Prompt Templates:** `.claude/prompts/`
  - `react-component.md` - React component generation
  - `utility-function.md` - Utility function generation

---

## Quick Examples

### Example 1: Utility Function
```bash
$ bash ./scripts/suggest-command.sh "Create formatCardAbbreviation function"

✅ Recommended: DeepSeek (local model)
Suggested Command: /local-code Create formatCardAbbreviation function
```

### Example 2: Refactoring
```bash
$ bash ./scripts/suggest-command.sh "Rename hasSeatFolded to isSeatFolded"

✅ Recommended: Qwen (local model)
Suggested Command: /local-refactor Rename hasSeatFolded to isSeatFolded
```

### Example 3: Complex Task
```bash
$ bash ./scripts/suggest-command.sh "Add new reducer for player stats"

🔴 Recommended: Claude (REQUIRED)
Suggested Command: Just describe the task to Claude directly
```

---

## Summary

**Goal:** Conserve Claude Code tokens while maintaining quality

**Method:** Use local models for simple tasks, Claude for complex ones

**Tool:** Routing helper scripts analyze tasks and suggest best approach

**Result:** 70-85% token savings on simple tasks with minimal quality impact
