# Canonical Sources of Truth

This document defines **which file is authoritative** for each type of information in the Poker Tracker project. When documents conflict, the canonical source wins.

## Why This Matters

Multiple documents can reference the same information (for convenience), but only ONE source is authoritative. If you need to know the "real" answer, check the canonical source. If you're updating information, update the canonical source FIRST.

---

## Source Hierarchy

### Tier 1: Code (Always Authoritative)
These files ARE the truth - documentation derives from them:

| Information | Canonical Source | Verify With |
|-------------|------------------|-------------|
| Project version | `package.json` → `version` | `npm pkg get version` |
| Dependencies | `package.json` → `dependencies` | `npm ls` |
| Test configuration | `vite.config.js` → `test` | - |
| All game constants | `src/constants/gameConstants.js` | - |
| All session constants | `src/constants/sessionConstants.js` | - |
| All player constants | `src/constants/playerConstants.js` | - |
| State shapes | `src/reducers/*.js` (each reducer's initialState) | - |
| Error codes | `src/utils/errorHandler.js` | - |

### Tier 2: Generated/Derived (Must Match Tier 1)
These should be auto-generated or manually synced from code:

| Information | Derived Source | Updates When |
|-------------|----------------|--------------|
| Test count | `npm test` output | Tests run |
| Coverage stats | `npm run test:coverage` | Coverage run |
| File counts | `glob` patterns | Files added/removed |

### Tier 3: Documentation (Reference Only)
These documents DESCRIBE Tier 1/2 but are not authoritative:

| Document | Purpose | Canonical For |
|----------|---------|---------------|
| `CLAUDE.md` | AI context, architecture overview | Nothing (references code) |
| `docs/QUICK_REF.md` | Quick lookups | Nothing (compact reference) |
| `docs/STATE_SCHEMAS.md` | State shape reference | Nothing (see reducers) |
| `docs/DEBUGGING.md` | Error code guide | Nothing (see errorHandler.js) |
| `README.md` | External overview | Nothing (marketing/onboarding) |

### Tier 4: Process/Standards (Authoritative for Process)
These define HOW we work, not WHAT the code is:

| Document | Authoritative For |
|----------|-------------------|
| `engineering_practices.md` | Coding standards, PR requirements, commit format |
| `.claude/agents/*.md` | Agent behavior and capabilities |
| `.claude/settings.json` | Hook configuration |

---

## Common Questions

### "What version are we on?"
**Canonical:** `package.json` → version field
**NOT:** README.md, CLAUDE.md (may be stale)

### "How many tests do we have?"
**Canonical:** Run `npm test` and check output
**NOT:** engineering_practices.md (static number, often stale)

### "What actions are available?"
**Canonical:** `src/constants/gameConstants.js` → ACTIONS object
**NOT:** CLAUDE.md, QUICK_REF.md (may be incomplete)

### "What's the state shape for sessions?"
**Canonical:** `src/reducers/sessionReducer.js` → initialSessionState
**NOT:** docs/STATE_SCHEMAS.md (may drift)

### "What error codes exist?"
**Canonical:** `src/utils/errorHandler.js` → ERROR_CODES object
**NOT:** docs/DEBUGGING.md (may be incomplete)

---

## Update Protocol

When changing canonical sources:

1. **Update code first** (Tier 1)
2. **Run schema validation tests** (coming in Phase C)
3. **Update documentation** (Tier 3) to match
4. **Commit together** (code + docs in same commit)

---

## Schema Validation Tests

The following tests verify Tier 3 docs match Tier 1 code:

| Test | Validates |
|------|-----------|
| `schema-validation.test.js` | Version sync, constants documented, hooks listed |

These tests run on every `npm test` and will **fail CI** if docs drift from code.

---

*Last updated: v114*
