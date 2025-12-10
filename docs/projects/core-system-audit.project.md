---
id: core-system-audit
name: Core System Audit - Poker Tracker Application
status: complete
priority: high
created: 2025-12-09
completed: 2025-12-09
---

# Project: Core System Audit

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with `<- CURRENT`)
3. Read the "Context Files" for that phase
4. Execute the checklist items
5. Update status when complete

---

## Overview

A comprehensive audit of the four most critical, high-leverage technical risk areas in the Poker Tracker application:

1. **Persistence System (IndexedDB)** - Storage format, hydration logic, merges & write semantics, migration correctness
2. **Reducers** - State machine mapping, transition analysis, illegal states detection
3. **Hydration & Migration Layer** - Stored state to runtime conversion, version compatibility
4. **Runtime Invariants & Schemas** - Core invariant definition, validation layer proposal

This is an **AUDIT** project - no code modifications until analysis is complete and findings are documented.

---

## Scope

### In Scope
- Full analysis of persistence.js and related CRUD operations
- State machine diagrams for all reducers
- Hydration flow documentation
- Migration code review
- Runtime invariant identification
- Schema proposal (Zod or custom)

### Out of Scope
- UI component audits
- Performance optimization
- Feature additions
- Test implementation (until Phase 5)

---

## Context Files

**ALL FILES READ** - The following source files were analyzed:

| File | Purpose | Status |
|------|---------|--------|
| `src/utils/persistence/` | IndexedDB operations (modular) | [x] Read |
| `src/hooks/useSessionPersistence.js` | Session persistence hook | [x] Read |
| `src/hooks/usePersistence.js` | Hand persistence hook | [x] Read |
| `src/hooks/usePlayerPersistence.js` | Player persistence hook | [x] Read |
| `src/reducers/gameReducer.js` | Game state machine | [x] Read |
| `src/reducers/sessionReducer.js` | Session state machine | [x] Read |
| `src/reducers/cardReducer.js` | Card state machine | [x] Read |
| `src/reducers/uiReducer.js` | UI state machine | [x] Read |
| `src/reducers/playerReducer.js` | Player state machine | [x] Read |
| `src/migrations/normalizeSeatActions.js` | Runtime migration | [x] Read |
| `src/utils/reducerUtils.js` | Validation utilities | [x] Read |
| `src/constants/*.js` | Game/Session/Player constants | [x] Read |

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 0 | [x] COMPLETE | Project Setup & Inputs Gathering |
| 1 | [x] COMPLETE | Persistence Audit |
| 2 | [x] COMPLETE | Reducer State Machine Audit |
| 3 | [x] COMPLETE | Hydration & Migration Audit |
| 4 | [x] COMPLETE | Runtime Invariant System |
| 5 | [x] COMPLETE | Formal Schemas Proposal |

---

## Before Starting Each Phase (MANDATORY)

Run this checklist before beginning ANY phase:

- [ ] **Project file active** - Verify this file is in `docs/projects/` and registered in `.claude/projects.json`
- [ ] **Input files provided** - Human has confirmed source files are available for reading
- [ ] **Previous phase docs updated** - If not Phase 1, ensure previous phase documentation was committed
- [ ] **Read context files** - Read all files listed for the current phase
- [ ] **No code modifications** - This is an AUDIT project; document findings only

---

## Phase 0: Project Setup & Inputs Gathering [x] COMPLETE

### Goal
Initialize project structure and define inputs needed from human.

### Deliverables
- [x] Project file created
- [x] Registry updated
- [x] Phase structure defined
- [x] Ticket format established
- [x] Inputs checklist created

---

## Phase 1: Persistence Audit <- CURRENT

### Goal
Audit the IndexedDB persistence layer for correctness, edge cases, and potential data integrity issues.

### Prerequisites
Human must provide access to:
- `src/utils/persistence.js`
- `src/hooks/usePersistence.js`
- `src/hooks/useSessionPersistence.js`
- `src/hooks/usePlayerPersistence.js`

### Tickets

#### TICKET-1.1: Storage Format Analysis
**Summary:** Document the complete storage schema for hands, sessions, and players.

**Purpose:** Understand what data is stored, in what format, and identify any schema inconsistencies.

**Acceptance Criteria:**
- [ ] Document all IndexedDB stores (hands, sessions, players)
- [ ] Document all indexes and their purposes
- [ ] Identify primary keys and unique constraints
- [ ] Note any implicit assumptions about data shape

**Inputs:** `persistence.js` (database schema, store definitions)

**Outputs:** `docs/audits/persistence-storage-schema.md`

---

#### TICKET-1.2: Write Semantics Audit
**Summary:** Analyze all write operations for atomicity, consistency, and error handling.

**Purpose:** Identify potential data corruption scenarios or incomplete writes.

**Acceptance Criteria:**
- [ ] Map all write operations (save, update, delete)
- [ ] Analyze transaction boundaries
- [ ] Check for proper error handling
- [ ] Identify race condition risks
- [ ] Document optimistic vs pessimistic patterns

**Inputs:** All persistence hooks

**Outputs:** `docs/audits/persistence-write-semantics.md`

---

#### TICKET-1.3: Read/Hydration Paths
**Summary:** Trace all read paths from IndexedDB to runtime state.

**Purpose:** Ensure data is correctly transformed when loading from storage.

**Acceptance Criteria:**
- [ ] Map all read operations
- [ ] Document data transformations during load
- [ ] Identify any data normalization/denormalization
- [ ] Check for default value handling

**Inputs:** Persistence hooks, reducers

**Outputs:** `docs/audits/persistence-read-paths.md`

---

#### TICKET-1.4: Migration Correctness
**Summary:** Audit database version migrations for correctness and completeness.

**Purpose:** Ensure data is preserved correctly across schema changes.

**Acceptance Criteria:**
- [ ] Document all migration versions (v1 -> v2 -> ... -> v5)
- [ ] Verify each migration preserves existing data
- [ ] Check for migration rollback considerations
- [ ] Identify any data loss risks

**Inputs:** `persistence.js` migration code

**Outputs:** `docs/audits/persistence-migrations.md`

---

## Phase 2: Reducer State Machine Audit

### Goal
Map all reducers as formal state machines and identify illegal states or transitions.

### Prerequisites
Human must provide access to:
- `src/reducers/gameReducer.js`
- `src/reducers/sessionReducer.js`
- `src/reducers/cardReducer.js`
- `src/reducers/uiReducer.js`
- `src/reducers/playerReducer.js`

### Tickets

#### TICKET-2.1: gameReducer State Machine
**Summary:** Create formal state machine diagram for gameReducer.

**Purpose:** Identify all valid states, transitions, and potential illegal state combinations.

**Acceptance Criteria:**
- [ ] Document all action types
- [ ] Map state shape and valid values
- [ ] Create state transition diagram
- [ ] Identify invariants (e.g., seat constraints)
- [ ] Flag any unreachable or illegal states

**Inputs:** `gameReducer.js`

**Outputs:** `docs/audits/state-machine-game.md`

---

#### TICKET-2.2: sessionReducer State Machine
**Summary:** Create formal state machine diagram for sessionReducer.

**Purpose:** Ensure session lifecycle is correctly modeled.

**Acceptance Criteria:**
- [ ] Document session states (inactive, active, ended)
- [ ] Map all transitions
- [ ] Verify state invariants
- [ ] Check for edge cases (multiple active sessions, incomplete sessions)

**Inputs:** `sessionReducer.js`

**Outputs:** `docs/audits/state-machine-session.md`

---

#### TICKET-2.3: cardReducer State Machine
**Summary:** Analyze card state management for validity constraints.

**Purpose:** Ensure cards cannot be in invalid states (duplicates, impossible combinations).

**Acceptance Criteria:**
- [ ] Document card slot structure
- [ ] Verify uniqueness constraints
- [ ] Check for card duplication prevention
- [ ] Analyze reset and clear behavior

**Inputs:** `cardReducer.js`

**Outputs:** `docs/audits/state-machine-card.md`

---

#### TICKET-2.4: Cross-Reducer Dependencies
**Summary:** Map dependencies and interactions between reducers.

**Purpose:** Identify coupling and potential synchronization issues.

**Acceptance Criteria:**
- [ ] Document which reducers share concepts
- [ ] Identify implicit dependencies
- [ ] Check for state synchronization needs
- [ ] Flag potential race conditions

**Inputs:** All reducers

**Outputs:** `docs/audits/cross-reducer-analysis.md`

---

## Phase 3: Hydration & Migration Audit

### Goal
Audit the conversion from stored state to runtime state and ensure version compatibility.

### Prerequisites
Phase 1 and 2 complete.

### Tickets

#### TICKET-3.1: Hydration Flow Mapping
**Summary:** Document the complete hydration flow from storage to runtime.

**Purpose:** Ensure data integrity during application startup.

**Acceptance Criteria:**
- [ ] Map hydration sequence (order of operations)
- [ ] Document state initialization defaults
- [ ] Identify partial state handling
- [ ] Check derived value computation

**Inputs:** Persistence hooks, reducers

**Outputs:** `docs/audits/hydration-flow.md`

---

#### TICKET-3.2: Version Compatibility Matrix
**Summary:** Create compatibility matrix for different stored data versions.

**Purpose:** Ensure old data can be loaded by new code.

**Acceptance Criteria:**
- [ ] List all historical schema versions
- [ ] Document breaking vs non-breaking changes
- [ ] Verify upgrade paths
- [ ] Test backward compatibility scenarios

**Inputs:** Migration code, persistence.js

**Outputs:** `docs/audits/version-compatibility.md`

---

#### TICKET-3.3: Edge Case Analysis
**Summary:** Identify edge cases in hydration (partial data, corrupted data, missing fields).

**Purpose:** Ensure graceful handling of unexpected stored state.

**Acceptance Criteria:**
- [ ] List potential edge cases
- [ ] Document current handling (or lack thereof)
- [ ] Propose fallback strategies
- [ ] Identify critical vs non-critical failures

**Inputs:** All persistence code

**Outputs:** `docs/audits/hydration-edge-cases.md`

---

## Phase 4: Runtime Invariant System

### Goal
Define core runtime invariants and propose a validation layer.

### Prerequisites
Phases 1-3 complete.

### Tickets

#### TICKET-4.1: Invariant Catalog
**Summary:** Create comprehensive catalog of runtime invariants.

**Purpose:** Define what must always be true for the application to function correctly.

**Acceptance Criteria:**
- [ ] Seat map invariants (valid seats, no duplicates)
- [ ] Action ordering invariants (valid sequences)
- [ ] Card invariants (no duplicates, valid values)
- [ ] Session invariants (single active session, valid lifecycle)
- [ ] Player invariants (unique IDs, valid seat assignments)

**Inputs:** All audit documents from Phases 1-3

**Outputs:** `docs/audits/invariant-catalog.md`

---

#### TICKET-4.2: Validation Layer Proposal
**Summary:** Propose lightweight runtime validation approach.

**Purpose:** Catch invariant violations early in development and production.

**Acceptance Criteria:**
- [ ] Evaluate Zod vs custom validation
- [ ] Propose validation points (reducers, persistence, migrations)
- [ ] Define error handling strategy
- [ ] Consider performance implications
- [ ] Draft implementation approach

**Inputs:** Invariant catalog

**Outputs:** `docs/audits/validation-proposal.md`

---

## Phase 5: Formal Schemas Proposal

### Goal
Propose formal TypeScript/Zod schemas for all state and storage.

### Prerequisites
Phase 4 complete.

### Tickets

#### TICKET-5.1: Schema Design Document
**Summary:** Design formal schemas for all state shapes.

**Purpose:** Enable type-safe state management and validation.

**Acceptance Criteria:**
- [ ] Define TypeScript interfaces for all state
- [ ] Create Zod schemas for runtime validation
- [ ] Document migration strategy from current code
- [ ] Estimate implementation effort

**Inputs:** All audit documents

**Outputs:** `docs/audits/schema-design.md`

---

#### TICKET-5.2: Implementation Roadmap
**Summary:** Create phased implementation plan for schema adoption.

**Purpose:** Provide actionable path to formal type safety.

**Acceptance Criteria:**
- [ ] Prioritize high-risk areas
- [ ] Define incremental adoption steps
- [ ] Identify breaking changes
- [ ] Estimate testing requirements

**Inputs:** Schema design document

**Outputs:** `docs/audits/schema-roadmap.md`

---

## Inputs Needed Ticket

### TICKET-0.1: Source Files Required

**Summary:** Human must provide access to the following source files before any audit work can proceed.

**Purpose:** Enable code analysis without filesystem exploration.

**Files Required:**

| Priority | File | Purpose |
|----------|------|---------|
| P0 | `src/utils/persistence.js` | Core IndexedDB operations |
| P0 | `src/hooks/usePersistence.js` | Hand persistence |
| P0 | `src/hooks/useSessionPersistence.js` | Session persistence |
| P0 | `src/hooks/usePlayerPersistence.js` | Player persistence |
| P0 | `src/reducers/gameReducer.js` | Game state |
| P0 | `src/reducers/sessionReducer.js` | Session state |
| P0 | `src/reducers/cardReducer.js` | Card state |
| P1 | `src/reducers/uiReducer.js` | UI state |
| P1 | `src/reducers/playerReducer.js` | Player state |
| P2 | Migration code (if separate) | Schema migrations |

**Acceptance Criteria:**
- [ ] Human confirms files are available
- [ ] Claude can read files when authorized
- [ ] Phase 1 can begin

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2025-12-09 | Audit-only approach | Analysis must complete before any code changes |
| 2025-12-09 | 5-phase structure | Logical progression from data layer to schemas |
| 2025-12-09 | Zod consideration | Industry-standard runtime validation library |

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| 2025-12-09 | Initial | 0 | Created project file, defined phases and tickets |

---

## Outputs Directory

All audit documents will be created in `docs/audits/`:

```
docs/audits/
├── persistence-storage-schema.md
├── persistence-write-semantics.md
├── persistence-read-paths.md
├── persistence-migrations.md
├── state-machine-game.md
├── state-machine-session.md
├── state-machine-card.md
├── cross-reducer-analysis.md
├── hydration-flow.md
├── version-compatibility.md
├── hydration-edge-cases.md
├── invariant-catalog.md
├── validation-proposal.md
├── schema-design.md
└── schema-roadmap.md
```

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] All audit documents created in `docs/audits/`
- [ ] Findings reviewed with human
- [ ] Schema proposal approved or deferred
- [ ] ADR created for any architectural decisions
- [ ] Project archived
