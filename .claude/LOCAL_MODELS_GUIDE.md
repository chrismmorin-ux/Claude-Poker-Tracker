# Local Models Guide - Token Conservation Strategy

**Goal**: Maximize local model usage to conserve Claude Code tokens while maintaining code quality.

## Quick Reference

### When to Use Local Models
```
✅ Utility functions (< 80 lines)
✅ Simple React components (< 100 lines, minimal props)
✅ Data transformations
✅ Boilerplate generation
✅ Test data/fixtures
✅ Simple refactoring (rename, extract)
```

### When to Use Claude
```
❌ State management (reducers, complex hooks)
❌ Integration code (connecting multiple pieces)
❌ Complex validation logic
❌ Components with 5+ props
❌ Anything touching multiple files
❌ Business logic requiring project understanding
```

---

## Model Characteristics

### DeepSeek Coder 7B v1.5
- **Speed**: ~30-45 seconds per task
- **Strengths**: Code generation, boilerplate
- **Weaknesses**: Project conventions, import paths
- **Best For**: Isolated utility functions, simple components
- **Max Complexity**: ~100 lines, single responsibility

### Qwen 2.5 Coder 7B
- **Speed**: ~3-10 seconds per task
- **Strengths**: Refactoring, simple transforms
- **Weaknesses**: New code generation
- **Best For**: Renaming, extracting functions, format changes
- **Max Complexity**: ~50 lines, mechanical changes

---

## Proven Prompt Patterns

### Pattern 1: Ultra-Specific Imports
```
BAD:  "Import the utilities"
GOOD: "Import from '../../utils/foo' (count: src/components/ui/ → src/utils/)"
```

### Pattern 2: Template-First
```
Provide the exact code template, then ask for modifications:

"Here's the template:
[paste exact code structure]

Now modify it to:
- Add prop X
- Implement feature Y"
```

### Pattern 3: Explicit Export Style
```
BAD:  "Export the component"
GOOD: "Use named export: export const Foo = ..."
```

### Pattern 4: Props as Parameters
```
BAD:  "Use ACTIONS constant"
GOOD: "Receive ACTIONS as a prop parameter (never define locally)"
```

### Pattern 5: Concrete Examples
```
"Format like this example:
Input: ['open', '3bet', 'call']
Output: 'open → 3bet → call'
Use arrow symbol: →"
```

---

## Common Fixes Needed

### DeepSeek Common Errors
1. **Import paths** (90% of time)
   - Uses `../utils` instead of `../../utils`
   - Fix: Count directories explicitly in prompt

2. **Export style** (80% of time)
   - Uses `export default` instead of `export const`
   - Fix: Say "MUST use named export" in caps

3. **Props vs locals** (70% of time)
   - Defines constants locally instead of receiving as props
   - Fix: List ALL props explicitly, say "receive as props"

4. **Tailwind** (50% of time)
   - Uses template literals: `bg-${color}`
   - Fix: Say "static Tailwind classes only, no template literals"

### Qwen Common Errors
1. **Over-explaining** (60% of time)
   - Adds verbose comments
   - Fix: Say "code only, no explanations"

2. **Context missing** (40% of time)
   - Doesn't preserve surrounding code
   - Fix: "Show ONLY the changed lines, preserve all else"

---

## Workflow: Local Model + Claude Review

### Step 1: Generate with Local Model
```bash
bash ./scripts/call-local-model.sh deepseek "$(cat .claude/prompts/react-component.md)

Create ActionBadge component...
[specific requirements]"
```

### Step 2: Quick Claude Review
Use Claude for JUST the review (saves 90% of tokens vs full generation):

```
Review this DeepSeek output for correctness:
[paste output]

Fix ONLY:
1. Import paths
2. Export style
3. Obvious bugs

Don't rewrite if 80%+ correct.
```

### Token Savings
- Full Claude generation: ~1000-2000 tokens
- Local model + review: ~200-300 tokens
- **Savings: 70-85%**

---

## Prompt Library Usage

Location: `.claude/prompts/`

### Available Templates
1. `react-component.md` - React components
2. `utility-function.md` - Pure functions

### How to Use
```bash
# Method 1: Inline
bash ./scripts/call-local-model.sh deepseek "$(cat .claude/prompts/react-component.md)

Task: Create Foo component..."

# Method 2: Template + specifics file
# Create prompts/my-task.txt with specific requirements
bash ./scripts/call-local-model.sh deepseek "$(cat .claude/prompts/react-component.md; cat prompts/my-task.txt)"
```

---

## Performance Benchmarks

From real implementation (Multiple Actions Per Street):

| Task Type | Local Model | Fix Time | Total | Claude Direct | Savings |
|-----------|-------------|----------|-------|---------------|---------|
| Simple utility | 30s | 2min | 2.5min | 1min | -60% ⚠️ |
| Medium component | 40s | 5min | 5.5min | 3min | -45% ⚠️ |
| Complex component | 45s | 10min | 10.5min | 5min | -52% ⚠️ |

**Current Reality**: Local models are **slower overall** due to fix overhead.

**Target** (with improved prompts):
| Task Type | Local Model | Fix Time | Total | Claude Direct | Savings |
|-----------|-------------|----------|-------|---------------|---------|
| Simple utility | 30s | 30s | 1min | 1min | Break-even ✓ |
| Medium component | 40s | 2min | 2.5min | 3min | +20% ✓ |
| Complex component | N/A | N/A | N/A | 5min | Use Claude ✓ |

---

## Task Classification Decision Tree

```
START: Need code generated
│
├─ Does it touch state/reducers?
│  └─ YES → Use Claude (complex)
│
├─ Does it integrate multiple pieces?
│  └─ YES → Use Claude (requires context)
│
├─ Is it > 150 lines?
│  └─ YES → Use Claude (too complex)
│
├─ Does it need 5+ props?
│  └─ YES → Use Claude (too many dependencies)
│
├─ Is it pure function < 80 lines?
│  └─ YES → Try DeepSeek with utility template
│
├─ Is it refactoring existing code?
│  └─ YES → Try Qwen (fast at refactoring)
│
├─ Is it UI component < 100 lines with < 5 props?
│  └─ YES → Try DeepSeek with component template
│
└─ Default → Use Claude (safest)
```

---

## Iterative Improvement Log

### 2025-12-06: Initial Implementation
**Learned**:
- JSON escaping was broken (fixed with Python)
- Import paths are consistently wrong
- Export style defaults to `export default`
- Props get defined locally instead of received

**Prompt Improvements**:
1. Added "count directories" for import paths
2. Added "MUST use named export" in caps
3. Added "receive ALL as props, NEVER define locally"
4. Added template code to copy

**Results**: TBD (test on next task)

---

## Completed Enhancements

### ✅ Model Selection Auto-Router (2025-12-06)
```bash
# IMPLEMENTED: Three routing helper scripts
bash ./scripts/suggest-command.sh "task"    # Full routing suggestion
bash ./scripts/task-classifier.sh "task"    # Classification only
bash ./scripts/select-model.sh "task"       # Model selection only

# Auto-select mode in call-local-model.sh
bash ./scripts/call-local-model.sh auto "task description..."
```

---

## Future Enhancements

### Priority 1: Auto-Review Script
```bash
# scripts/local-gen-review.sh
# 1. Generate with local model
# 2. Auto-review with Claude (fixed prompt)
# 3. Output corrected code
```

### Priority 2: Prompt Testing Suite
```bash
# Test each prompt template
# Track success rate
# Auto-update guide with results
```

---

## Success Metrics

Track these for each local model task:

```markdown
## Task: [Name]
- Model: DeepSeek / Qwen
- Generation time: Xs
- Fix time: Xmin
- Issues found:
  - [ ] Import paths
  - [ ] Export style
  - [ ] Props vs locals
  - [ ] Tailwind usage
  - [ ] Other: ___
- Would use Claude next time? Y/N
- Token savings: ~X tokens
```

**Goal**: 70%+ of simple tasks use local models successfully

---

## Quick Command Reference

```bash
# Get task routing suggestion (RECOMMENDED - use this first!)
bash ./scripts/suggest-command.sh "Your task description..."

# Auto-select local model (qwen or deepseek)
bash ./scripts/call-local-model.sh auto "Task description..."

# Use template with specific model
bash ./scripts/call-local-model.sh deepseek "$(cat .claude/prompts/react-component.md)

Task: Create Foo component..."

# DeepSeek for generation
bash ./scripts/call-local-model.sh deepseek "Create function..."

# Qwen for refactoring
bash ./scripts/call-local-model.sh qwen "Rename foo to bar in: [code]"

# Test with multi-line prompt
bash ./scripts/call-local-model.sh qwen "Line 1
Line 2
Line 3"

# Just classify (without running)
bash ./scripts/task-classifier.sh "Your task description..."
```
