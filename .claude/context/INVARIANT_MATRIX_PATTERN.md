# Invariant Matrix Pattern

How to write an audit-only matrix-fixture test for a decision surface. Origin: SPR-002 / WS-001 (TableView Invariant Audit, 2026-05-01). Authoritative for the Invariant Coverage Program (`.claude/projects/invariant-coverage-program.md`).

This doc is a SHORT authoring guide. The two canonical references are living code:
- `src/components/views/TableView/__tests__/actionInvariants.fixture.js` — schema example + 41 rows
- `src/reducers/__tests__/gameReducer.undoInvariants.fixture.js` — non-UI/reducer example
- Shared runner: `src/test/invariantMatrix.js`

When in doubt, read those. This doc explains WHY and WHEN, not WHAT (the code does that).

## When to use a matrix fixture

Use a matrix fixture (importable array of `{ inputs, expected, status }` rows fed to the shared runner via `it.each`) when AT LEAST ONE of these is true:

1. **The function under audit takes ≥2 input dimensions whose interactions matter.** Example: `getValidActions(street, hasBet, isMultiSeat)` — 5 streets × 2 bet states × 2 seat states = 20 corners. Hand-written `it()` for each is verbose and skips corners by accident.
2. **There's cross-coupling with other modules** (other reducers, other selectors, other state slices). Matrix rows can name the cross-coupling explicitly (`expected.next_player_state_subset`).
3. **The decision is user-facing** — wrong output ships a regression to the user. Matrix coverage prevents silent drift.
4. **Bugs have already shipped silently from this surface.** The matrix becomes the missing detection infrastructure.

DO NOT use a matrix fixture when:
- The function is a pure setter or trivial getter.
- Existing per-action `it()` tests already enumerate every meaningful corner explicitly. (If they don't, the matrix complements them — never replace, augment.)
- The cost of authoring the fixture exceeds the cost of fixing the next bug. Matrix fixtures are an investment; small/stable surfaces don't pay it back.

## The 4 statuses

Every fixture row carries `status: 'matches' | 'pinned_bug' | 'spec_gap' | 'regression_pinned'`. These are exhaustive.

| Status | Assert | Use when |
|--------|--------|----------|
| `matches` | `actual === expected_per_spec` | Spec and code agree. Most rows. |
| `pinned_bug` | `actual === actual_today` AND `expected_per_spec !== actual_today` | Code disagrees with spec; row LOCKS reality so any code change is detected. Future fix-wave flips status to `matches` and removes `actual_today`. |
| `spec_gap` | `it.skip` with comment naming the structural gap | Code physically cannot compute the scenario (missing dimension, missing primitive, missing concept). Surfaces in test output as a finding. |
| `regression_pinned` | `actual === expected_per_spec` (must stay fixed) | Historically broken, fixed in a known commit (`fixed_in: 'sha'`). Row asserts the fix doesn't regress. |

**Decision tree for assigning status:**

```
Does the code compute the scenario at all?
  NO  → spec_gap (name the missing dimension in `comment`)
  YES → continue
        ↓
Does code output equal the spec?
  YES → was this scenario broken before and fixed?
        YES → regression_pinned (set `fixed_in`)
        NO  → matches
  NO  → is the divergence intended (legacy behavior we're preserving)?
        YES → matches with comment explaining
        NO  → pinned_bug (set `bug_id`, owner triages)
```

## Row schema

Every fixture row has these fields. Adapt the `inputs` and `expected_*` shapes to your surface; keep everything else stable across audits.

```js
{
  id: 'INV-NNN',                  // Stable, audit-scoped
  scenario_label: 'human_readable',// Domain vocabulary; may exceed code's notion
  category: 'preflop' | 'postflop' | 'cross_coupling' | 'edge_case' | ...,
  inputs: { /* surface-specific */ },
  expected_per_spec: /* surface-specific */,
  actual_today: /* surface-specific OR null for spec_gap */,
  status: 'matches' | 'pinned_bug' | 'spec_gap' | 'regression_pinned',
  bug_id: 'BUG-XX' | null,
  fixed_in: 'sha' | null,         // regression_pinned only
  comment: 'Why this row exists / repro / spec rationale / gap nature',
}
```

For multi-state cross-coupling rows (e.g., reducer + sibling reducer), use partial-match assertions in the runner — only assert the slices the row cares about. See `gameReducer.undoInvariants.fixture.js` for the cross-coupling shape.

## The shared runner

`src/test/invariantMatrix.js` exports `runInvariantMatrix(fixtures, computeActual, options)`. The runner:

- Validates row shape (unique IDs, recognized statuses, status-sum invariant)
- Partitions by status
- Runs an `it.each` per status with appropriate assertion
- Skips `spec_gap` rows with comment surfaced in test output

Caller responsibility: provide `computeActual(inputs)` that returns the actual code output for a row's inputs. This is the **harness**.

## The harness mirroring risk

The harness MIRRORS production code. If production code changes shape and the harness doesn't, the audit silently breaks (matrix passes, reality has drifted). Two mitigations:

**A. Mirror minimally and import maximally.** The harness should call production functions directly (`getValidActions`, `gameReducer`, etc.) — not reimplement them. Mirror only the GLUE that's unavoidable (CommandStrip-style transforms that live in the rendering layer). Document every mirrored block with a file:line citation pointing at the production source.

**B. When mirroring becomes substantial, refactor to a selector.** If the harness has >30 lines of mirrored logic, the right move is to extract a selector both the test AND production code consume. Flag this as a `pinned_bug` or follow-up ticket — don't do it inside the audit sprint (audit-only discipline). This is a meta-finding the matrix surfaces.

**C. DOM-mount as alternative.** For UI surfaces, mount the component in jsdom against fixture inputs and read rendered DOM. Slower (jsdom env), heavier setup, but eliminates harness drift entirely. Trade-off case-by-case.

## Authoring a new audit (5-step recipe)

1. **Pick the function under audit.** Cite `file:line`. State its signature.
2. **Read its current test coverage.** Document existing test shape in your fixture's leading comment.
3. **Author 30-100 rows** spanning matches + edge cases + cross-couplings. Don't over-think coverage at first; the runner makes it cheap to add rows later.
4. **Run the runner.** Every status-mismatch is a finding — either reclassify the row or surface as a real bug.
5. **Write WS notes** with row count + status breakdown + named candidate bugs. The breakdown is the audit signal, not just the bug count.

## What goes into the WS notes

After completing an audit, the workstream item's `notes` field MUST include:

- Total row count
- Breakdown by status (matches / pinned_bug / spec_gap / regression_pinned)
- Headline finding (one sentence — what infrastructure was missing, what it surfaces)
- List of `BUG-CANDIDATE-*` IDs with one-line description each (handed to fix-wave)
- List of `spec_gap` structural findings with one-line description each (handed to follow-on tickets)
- Confirmation of audit-only discipline: `git diff` against production paths is empty

This format ensures any future reviewer can scan the WS notes and reconstruct what the audit found without reading the fixture file.

## When NOT a matrix — alternative patterns this doc does NOT replace

- **Per-action describe blocks** (existing reducer test convention): keeps happy-path coverage, catches regression in single-action behavior. Matrix is ADDITIVE.
- **Property-based / fuzz testing**: when the input space is too large to enumerate (e.g., random board textures × random ranges). Different program; different ergonomics. Not in scope for ICP.
- **Integration tests** (existing `src/__tests__/integration/`): when the audit needs full app context (DOM + persistence + multi-reducer). Matrix is for narrow decision surfaces; integration tests are for end-to-end flows.

## References

- **Origin sprint**: SPR-002 / WS-001
- **Program charter**: `.claude/projects/invariant-coverage-program.md`
- **Canonical UI matrix**: `src/components/views/TableView/__tests__/actionInvariants.fixture.js`
- **Canonical reducer matrix**: `src/reducers/__tests__/gameReducer.undoInvariants.fixture.js`
- **Shared runner**: `src/test/invariantMatrix.js`
- **Sidebar precedent (extension)**: `ignition-poker-tracker/side-panel/STATE_FIELD_SCOPES.md` + `state-clear-symmetry.test.js`
- **Failure-library context**: `.claude/failures/STATE_CLEAR_ASYMMETRY.md`, `.claude/failures/SIDEBAR_REBUILD_PROGRAM.md`
