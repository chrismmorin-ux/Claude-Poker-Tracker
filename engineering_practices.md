# Engineering Practices & Standards

This document defines the engineering standards, protocols, and practices for the Poker Tracker project. All contributors (human and AI) must adhere to these guidelines.

---

## Table of Contents

1. [Version Control & Branching Strategy](#1-version-control--branching-strategy)
2. [Commit Format & History Hygiene](#2-commit-format--history-hygiene)
3. [Pull Request Standards](#3-pull-request-standards)
4. [Testing Expectations](#4-testing-expectations)
5. [CI/CD Pipeline](#5-cicd-pipeline)
6. [Documentation Standards](#6-documentation-standards)
7. [Security & Secrets Handling](#7-security--secrets-handling)
8. [Coding Standards & Style](#8-coding-standards--style)
9. [Architecture Decision Records (ADRs)](#9-architecture-decision-records-adrs)
10. [Refactor Sprints](#10-refactor-sprints)
11. [AI Agent Interaction Rules](#11-ai-agent-interaction-rules)
12. [Role Definitions](#12-role-definitions)
13. [Additional Practices](#13-additional-practices)

---

## 1. Version Control & Branching Strategy

### Branch Naming Convention

```
<type>/<ticket-or-description>
```

| Type | Purpose | Example |
|------|---------|---------|
| `feature/` | New functionality | `feature/player-stats-export` |
| `fix/` | Bug fixes | `fix/seat-color-overflow` |
| `refactor/` | Code improvements (no behavior change) | `refactor/extract-card-utils` |
| `docs/` | Documentation only | `docs/update-api-reference` |
| `test/` | Test additions/fixes | `test/add-reducer-tests` |
| `chore/` | Maintenance tasks | `chore/update-dependencies` |

### Branch Workflow

1. **Main branch (`main`)**: Always deployable. Protected.
2. **Feature branches**: Created from `main`, merged back via PR.
3. **No long-lived branches**: Merge within 3 days or rebase frequently.
4. **Delete after merge**: Remove merged branches promptly.

### Branch Protection Rules

- Require PR review before merge
- Require status checks to pass
- No direct pushes to `main`
- Linear history preferred (rebase or squash merge)

---

## 2. Commit Format & History Hygiene

### Commit Message Format

```
<type>: <short description> (max 72 chars)

[optional body - wrap at 72 chars]

[optional footer]
```

### Commit Types

| Type | Use For |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructuring (no behavior change) |
| `docs` | Documentation changes |
| `test` | Adding/updating tests |
| `style` | Formatting, whitespace (no code change) |
| `chore` | Build, config, dependencies |
| `perf` | Performance improvements |

### Examples

```
feat: Add player avatar upload functionality

fix: Prevent duplicate seat assignments in TableView

refactor: Extract showdown logic to useShowdownHandlers hook

docs: Update CLAUDE.md with v111 changes
```

### History Hygiene Rules

- **Atomic commits**: Each commit does one thing
- **No WIP commits on main**: Squash or amend before merging
- **Meaningful messages**: Future you should understand why
- **No merge commits in feature branches**: Rebase instead
- **Sign commits** (optional but recommended)

---

## 3. Pull Request Standards

### PR Title Format

```
<type>: <description>
```

Same types as commits. Title becomes squash commit message.

### PR Description Template

```markdown
## Summary
Brief description of changes and motivation.

## Changes
- Bullet list of specific changes
- Include file paths for major modifications

## Testing
- [ ] Unit tests added/updated
- [ ] Manual testing completed
- [ ] Edge cases considered

## Screenshots (if UI changes)
Before/after screenshots for visual changes.

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed the code
- [ ] Documentation updated (if needed)
- [ ] No console.log or debug code left
```

### Review Requirements

| PR Size | Reviewers Required | Review Type |
|---------|-------------------|-------------|
| Small (<100 lines) | 1 | Standard |
| Medium (100-500 lines) | 1-2 | Thorough |
| Large (>500 lines) | 2+ | Split if possible |

### Review Checklist for Reviewers

- [ ] Code is readable and well-structured
- [ ] No obvious bugs or edge cases missed
- [ ] Tests cover new functionality
- [ ] No security vulnerabilities introduced
- [ ] Performance implications considered
- [ ] Documentation accurate

### Merge Strategy

- **Squash merge** for feature branches (clean history)
- **Rebase merge** for refactors with meaningful commits
- Delete source branch after merge

---

## 4. Testing Expectations

### Testing Pyramid

```
        /\
       /  \     E2E Tests (few)
      /----\
     /      \   Integration Tests (some)
    /--------\
   /          \ Unit Tests (many)
  --------------
```

### Coverage Targets

| Type | Target | Minimum |
|------|--------|---------|
| Unit Tests | 80% | 70% |
| Integration | Key flows | Critical paths |
| E2E | Happy paths | Smoke tests |

### What to Test

**Must Test:**
- Reducer logic (all action types)
- Utility functions (pure functions)
- Custom hooks (behavior)
- Critical business logic

**Should Test:**
- Component rendering
- User interactions
- Error boundaries

**May Skip:**
- Simple presentational components
- Third-party library wrappers
- Constant definitions

### Test File Naming

```
src/
  utils/
    cardUtils.js
    cardUtils.test.js    # Co-located
  reducers/
    gameReducer.js
    gameReducer.test.js
```

### Test Structure

```javascript
describe('functionName', () => {
  describe('when condition', () => {
    it('should expected behavior', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

---

## 5. CI/CD Pipeline

### Pipeline Stages

```
[Commit] → [Lint] → [Test] → [Build] → [Deploy Preview] → [Deploy Prod]
```

### Stage Requirements

| Stage | Trigger | Must Pass |
|-------|---------|-----------|
| Lint | All pushes | Yes |
| Test | All pushes | Yes |
| Build | All pushes | Yes |
| Deploy Preview | PR opened | No (informational) |
| Deploy Prod | Merge to main | Yes |

### Pipeline Configuration

```yaml
# Example structure (adapt to your CI provider)
stages:
  lint:
    - npm run lint
    - npm run type-check (if TypeScript)

  test:
    - npm test -- --coverage
    - fail if coverage below threshold

  build:
    - npm run build
    - artifact: dist/

  deploy-preview:
    - deploy to preview URL
    - comment URL on PR

  deploy-prod:
    - deploy to production
    - tag release
```

### Automated Checks

- ESLint (code quality)
- Prettier (formatting)
- Test suite (correctness)
- Build verification (no build errors)
- Bundle size check (performance)
- Dependency audit (security)

---

## 6. Documentation Standards

### Required Documentation

| Document | Purpose | Update Frequency |
|----------|---------|------------------|
| `README.md` | Project overview, setup | Each major feature |
| `CLAUDE.md` | AI context, architecture | Each version bump |
| `CHANGELOG.md` | Version history | Each release |
| `docs/SPEC.md` | Full specification | Major changes |
| `docs/QUICK_REF.md` | Quick lookup | As needed |
| `docs/STATE_SCHEMAS.md` | State shapes | State changes |
| `docs/DEBUGGING.md` | Error codes, debugging | New error codes |

### Code Documentation

**Do Document:**
- Complex algorithms with inline comments
- Non-obvious business logic
- Public API functions (JSDoc)
- Workarounds with context

**Don't Document:**
- Self-explanatory code
- Every function parameter
- Implementation details that may change

### JSDoc Format (for public functions)

```javascript
/**
 * Calculate the next seat to act based on current game state.
 * @param {number} currentSeat - Current active seat (1-9)
 * @param {Set<number>} foldedSeats - Seats that have folded
 * @param {string} street - Current street (PREFLOP, FLOP, etc.)
 * @returns {number} Next seat to act, or -1 if round complete
 */
function getNextActionSeat(currentSeat, foldedSeats, street) {
  // ...
}
```

---

## 7. Security & Secrets Handling

### Never Commit

- API keys, tokens, credentials
- `.env` files with real values
- Private keys
- Database connection strings
- User data or PII

### Allowed in Repo

- `.env.example` (with placeholder values)
- Public configuration
- Non-sensitive defaults

### Secret Management

```
Development:  .env.local (gitignored)
CI/CD:        Environment variables in CI provider
Production:   Environment variables or secret manager
```

### .gitignore Requirements

```gitignore
# Secrets
.env
.env.local
.env.*.local
*.pem
*.key

# Dependencies
node_modules/

# Build
dist/
build/

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Debug
npm-debug.log*
```

### Security Checklist

- [ ] No hardcoded secrets
- [ ] Input validation on all user input
- [ ] XSS prevention (escape output)
- [ ] CSRF protection (if applicable)
- [ ] Dependencies audited (`npm audit`)
- [ ] No `eval()` or `innerHTML` with user data

---

## 8. Coding Standards & Style

### General Principles

1. **Readability over cleverness**: Code is read more than written
2. **Consistency**: Follow existing patterns in the codebase
3. **Simplicity**: Avoid over-engineering
4. **Single Responsibility**: Functions/components do one thing

### JavaScript/React Standards

**Naming Conventions:**

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `CardSlot`, `TableView` |
| Functions | camelCase | `getNextSeat`, `handleClick` |
| Constants | SCREAMING_SNAKE | `NUM_SEATS`, `ACTIONS` |
| Files (components) | PascalCase.jsx | `CardSlot.jsx` |
| Files (utils) | camelCase.js | `cardUtils.js` |
| CSS classes | kebab-case | `card-slot`, `action-badge` |

**React Patterns:**

```javascript
// Prefer functional components
const MyComponent = ({ prop1, prop2 }) => {
  // Hooks at top
  const [state, setState] = useState(initial);

  // Derived values
  const computed = useMemo(() => /* ... */, [deps]);

  // Callbacks
  const handleAction = useCallback(() => {
    // ...
  }, [deps]);

  // Effects last
  useEffect(() => {
    // ...
  }, [deps]);

  return <div>...</div>;
};
```

**Import Order:**

```javascript
// 1. React and framework
import React, { useState, useCallback } from 'react';

// 2. External libraries
import { motion } from 'framer-motion';

// 3. Internal components
import { CardSlot } from '../ui/CardSlot';

// 4. Hooks
import { useActionUtils } from '../../hooks/useActionUtils';

// 5. Utils and constants
import { ACTIONS } from '../../constants/gameConstants';
```

### Tailwind CSS Guidelines

- Use utility classes directly (avoid @apply in most cases)
- Group related utilities logically
- Extract to components when patterns repeat 3+ times
- Use design system values (not arbitrary)

### Linting & Formatting

- **ESLint**: Enforce code quality rules
- **Prettier**: Enforce formatting (run on save)
- **No warnings**: Treat warnings as errors in CI

---

## 9. Architecture Decision Records (ADRs)

### Purpose

Document significant architectural decisions with context, rationale, and consequences.

### When to Write an ADR

- Choosing between technologies/libraries
- Establishing patterns that affect multiple files
- Making decisions that are hard to reverse
- Deviating from common practices

### ADR Template

```markdown
# ADR-XXX: Title

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-YYY]

## Context
What is the issue we're facing? What forces are at play?

## Decision
What is the change we're proposing/have decided?

## Consequences
What are the positive and negative results of this decision?

### Positive
- Benefit 1
- Benefit 2

### Negative
- Tradeoff 1
- Tradeoff 2

## Alternatives Considered
What other options were evaluated?

## References
Links to relevant documentation, discussions, or code.
```

### ADR Location

```
docs/
  adr/
    ADR-001-use-reducer-for-state.md
    ADR-002-indexeddb-for-persistence.md
    ADR-003-custom-hooks-extraction.md
```

---

## 10. Refactor Sprints

### Purpose

Dedicated time to address technical debt, improve code quality, and modernize the codebase without feature pressure.

### Cadence

- **Frequency**: Every 4-6 feature sprints, or when debt threshold reached
- **Duration**: 1-2 sprints depending on accumulated debt
- **Trigger**: Tech debt backlog exceeds 20 items, or major upgrade needed

### Refactor Sprint Focus Areas

1. **Code Quality**: Extract duplicates, simplify complexity
2. **Dependencies**: Update packages, remove unused
3. **Performance**: Profile and optimize bottlenecks
4. **Testing**: Increase coverage, fix flaky tests
5. **Documentation**: Update stale docs, add missing
6. **Tooling**: Upgrade build tools, improve DX

### Refactor Sizing

| Size | Scope | Duration |
|------|-------|----------|
| Small | Single file/function | < 1 hour |
| Medium | Single feature area | 1-4 hours |
| Large | Cross-cutting concern | 1-2 days |
| Epic | Architectural change | Full sprint |

### Process

1. **Inventory**: List all tech debt items
2. **Prioritize**: Rank by impact vs effort
3. **Plan**: Select items that fit sprint capacity
4. **Execute**: Focus on refactors only (no features)
5. **Validate**: Ensure no regressions
6. **Document**: Update relevant documentation

---

## 11. AI Agent Interaction Rules

### Token Efficiency

- **Be concise**: Avoid redundant context
- **Use references**: "See CLAUDE.md section X" vs repeating content
- **Batch requests**: Group related questions
- **Clear scope**: Define exactly what's needed

### Prompt Patterns

**Good Prompts:**
```
Add a "clear all" button to PlayersView that removes all seat assignments.
Reference: usePlayerPersistence.js has CLEAR_ALL_SEAT_PLAYERS action.
```

**Poor Prompts:**
```
Can you help me with the players? I want to be able to clear things.
```

### Context Management

- Keep `CLAUDE.md` updated with current architecture
- Use `docs/QUICK_REF.md` for frequently needed info
- Reference specific files and line numbers
- Provide error messages verbatim

### AI Code Review Checklist

When AI generates code, verify:
- [ ] Follows existing patterns in codebase
- [ ] Uses correct import paths
- [ ] Includes proper dependencies in hooks
- [ ] Handles edge cases
- [ ] No hardcoded values that should be constants
- [ ] No debug code left behind

### AI Limitations to Account For

- May not know about recent changes (provide context)
- Can hallucinate APIs/functions (verify suggestions)
- May over-engineer simple solutions (request simplicity)
- Token limits may cause incomplete responses (break up tasks)

---

## 12. Role Definitions

### Senior Developer

**Responsibilities:**
- Architectural decisions
- Code review approval
- Mentoring junior developers
- Technical direction
- Security review
- Performance optimization

**Authority:**
- Merge to main
- Approve PRs
- Create ADRs
- Define standards

### Junior Developer

**Responsibilities:**
- Implement features with guidance
- Write tests
- Fix bugs
- Update documentation
- Learn codebase patterns

**Expectations:**
- Ask questions early
- Seek review before major changes
- Follow established patterns
- Document learnings

### Capable AI Agent (e.g., Claude Code with Opus)

**Best Used For:**
- Complex multi-file refactors
- Architectural planning
- Debugging difficult issues
- Code review assistance
- Documentation generation
- Test case generation

**Expectations:**
- Follow CLAUDE.md strictly
- Use TodoWrite for complex tasks
- Verify changes don't break existing functionality
- Ask for clarification when ambiguous

**Token Budget:** Higher (complex reasoning)

### Less-Capable AI Agent (e.g., Haiku-level)

**Best Used For:**
- Simple, well-defined tasks
- Boilerplate generation
- Formatting and style fixes
- Quick lookups
- Single-file changes

**Expectations:**
- Clear, specific instructions required
- Limited context window
- May need step-by-step guidance
- Verify output more carefully

**Token Budget:** Lower (simple tasks)

### Local Models (DeepSeek/Qwen via LM Studio)

**Command Mapping for `ai:less-capable` tasks:**

| Task Type | Local Command | Model |
|-----------|---------------|-------|
| Utility functions (<80 lines) | `/local-code` | DeepSeek |
| Simple React components (<100 lines) | `/local-code` | DeepSeek |
| Refactoring/renaming | `/local-refactor` | Qwen |
| Documentation/JSDoc | `/local-doc` | Qwen |
| Unit test generation | `/local-test` | Qwen |
| Auto-route (uncertain) | `/local` | Auto |

**When CTO-Decompose Outputs `ai:less-capable`:**
1. Check task matches local model criteria (see table above)
2. Use `/route <task>` if uncertain
3. Run the appropriate `/local-*` command
4. Have Claude review and fix output (import paths, exports, edge cases)

**Local Model Limitations:**
- No project context awareness
- Often incorrect import paths
- May use wrong export style
- Cannot do multi-file changes
- No state management understanding

**Token Savings:** 70-85% for suitable tasks (utility functions, simple components)

### Research Agent

**Best Used For:**
- Codebase exploration
- Finding patterns across files
- Answering "how does X work?" questions
- Identifying dependencies
- Searching for usage examples

**Expectations:**
- Read-only operations
- Thorough exploration
- Summary with file references
- No code modifications

---

## 13. Additional Practices

### Error Handling

```javascript
// Use error codes for debugging
const ERROR_CODES = {
  INVALID_SEAT: 'E001',
  DUPLICATE_CARD: 'E002',
  // ...
};

// Always handle async errors
try {
  await asyncOperation();
} catch (error) {
  console.error(`[${ERROR_CODES.X}]`, error.message);
  // Handle gracefully
}
```

### Performance Guidelines

- Memoize expensive calculations (`useMemo`)
- Prevent unnecessary re-renders (`useCallback`, `React.memo`)
- Lazy load heavy components
- Profile before optimizing
- Measure after optimizing

### Accessibility (a11y)

- Semantic HTML elements
- Keyboard navigation support
- Sufficient color contrast
- ARIA labels where needed
- Screen reader testing

### Dependency Management

- **Add carefully**: Evaluate bundle size impact
- **Update regularly**: Monthly dependency updates
- **Audit frequently**: `npm audit` in CI
- **Remove unused**: Prune dead dependencies
- **Pin versions**: Use exact versions in production

### Incident Response

1. **Detect**: Monitoring alerts or user report
2. **Acknowledge**: Assign owner, communicate status
3. **Investigate**: Find root cause
4. **Mitigate**: Apply temporary fix if needed
5. **Resolve**: Deploy permanent fix
6. **Review**: Post-mortem, update practices

### Code Ownership

| Area | Primary Owner |
|------|---------------|
| Core game logic | Senior Dev |
| UI components | Any developer |
| State management | Senior Dev |
| Persistence | Senior Dev |
| Documentation | All (rotating) |

---

## Quick Reference

### Before Committing
- [ ] Code compiles without errors
- [ ] Tests pass
- [ ] Linter passes
- [ ] No debug code or console.logs
- [ ] Self-reviewed the diff

### Before Creating PR
- [ ] Branch is up to date with main
- [ ] Commit history is clean
- [ ] PR description is complete
- [ ] Related issues linked

### Before Merging
- [ ] At least one approval
- [ ] CI pipeline green
- [ ] No unresolved comments
- [ ] Documentation updated (if needed)

---

*Last updated: v113*
*Maintainer: Project Team*
