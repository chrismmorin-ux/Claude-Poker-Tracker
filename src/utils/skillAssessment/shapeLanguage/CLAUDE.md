# skillAssessment/shapeLanguage/ — Domain Rules

**MANDATORY**: Before editing or adding ANY file in this directory, read:
1. `src/utils/skillAssessment/CLAUDE.md` (parent module rules — SCF skill-assessment framework, AP-SCF-04 sample-size floor, CD-5 claim discipline, source-util-policy whitelist).
2. `docs/design/contracts/shape-mastery.md` (canonical state shape + I-SM-1..9 invariants).
3. `docs/projects/poker-shape-language/gate3-decision-memo.md` (Q1-Q7 verdicts).
4. `docs/design/surfaces/shape-skill-map.md` (transparency surface contract).

This sub-module is the **pure-math + read-API** layer for the Shape Language adaptive layer. It owns:
- Beta posterior math (update + credible interval) — read-time only.
- Temporal decay math (recognition-latency adjustment over time since `lastValidatedAt`).
- React hooks that wrap the pure math for consumer surfaces.

It does NOT own:
- The reducer + writers (those live at `src/reducers/shapeMasteryReducer.js` per the AnchorLibrary pattern).
- IDB persistence (`src/utils/persistence/shapeMasteryStorage.js`).
- Context provider (`src/contexts/ShapeMasteryContext.jsx`).
- Lesson catalog (parent `lessonRegistry.js` pattern — content lives in `docs/projects/poker-shape-language/lessons/*.md`).

## Module map (read-only sprint scope — SPR-081)

| File | Purpose |
|------|---------|
| `index.js` | Public re-exports of the pure math + hooks. |
| `betaPosterior.js` | `updateBetaPosterior({alpha, beta}, {successes, failures})` + `betaCredibleInterval(alpha, beta, level)`. Wraps the canonical `credibleInterval` from `exploitEngine/bayesianConfidence.js` to avoid a duplicate implementation. |
| `temporalDecay.js` | `applyTemporalDecay({alpha, beta}, lastValidatedAt, now, profile)` returning decay-adjusted posterior + `daysSinceValidated`. **Read-time only** per I-SM-2 — no caller writes this back. |
| `hooks.js` | `useShapeMasteryDecay(descriptorId, now?)` — wraps the context consumer + pure math. Future: `useShapeMasterySeederRanking()` once I-SM-4 enforcement ships in fast-follow. |
| `__tests__/` | Unit tests for pure-math + hook plumbing. |

## Core principles

### 1. Pure math + read-time math only

Every function in this directory is **either** a pure transformation (input → output, no side effects) **or** a hook that reads from the context. Writes happen in the reducer + persistence hook, never here. I-SM-2 binds: decay is computed at read time; there is no `dispatch({type: 'APPLY_DECAY'})` anywhere.

### 2. Beta bounds are floors, not invariants of computation

`updateBetaPosterior` clamps to α≥1 / β≥1 (the I-SM-7 floor). This guards against callers passing accumulated observation counts that drop below 1 due to subtractive bookkeeping. The reducer enforces the same floor independently — defense-in-depth.

### 3. Decay regresses toward the uniform prior

Loss of evidence pulls the posterior back toward Beta(1,1). For fixed posterior and profile, longer `daysSinceValidated` returns:
- A smaller `retainedEvidenceFraction` (monotonically non-increasing).
- A smaller `α+β` (mass shrinks toward `2 * POSTERIOR_FLOOR`).
- A point estimate closer to 0.5 (regression toward prior).

This is Bayesian-coherent. A user who was 85% on Silhouette a year ago is not assumed to be 85% today — uncertainty grows AND the central estimate softens. Tested.

### 4. SLS-side I-SM invariants this module enforces

| Invariant | Status this sprint | Enforced by |
|---|---|---|
| I-SM-1 separation of signals | ENFORCED | No function in this directory returns a fused mastery score. Test asserts. |
| I-SM-2 no decay-write action | ENFORCED | Module exports zero writer functions; reducer has zero decay-mutation case. Test asserts. |
| I-SM-7 posterior bounds α≥1, β≥1 | ENFORCED | `updateBetaPosterior` clamps; tested across 1000 random sequences. |
| I-SM-8 schemaVersion per-record | ENFORCED | Decay functions tolerate absent schemaVersion (returns adjusted posterior without claiming the record needs migration). |

I-SM-3 / I-SM-4 / I-SM-5 / I-SM-6 / I-SM-9 are enforced elsewhere (reducer + panel tests + constants).

## Anti-patterns

### DO NOT export a fused mastery score

Per I-SM-1. No function in this directory may return a single number that combines `declaredLevel` + `posterior`. A surface that needs both gets them as separate fields. Banned identifiers: `masteryScore`, `fusedMastery`, `confidenceLevel`.

### DO NOT write to IDB or dispatch from this directory

Pure-math only. If a feature needs to write, the writer goes in the reducer + persistence layer; the math here stays read-only.

### DO NOT add streak / engagement-pressure helpers

Per I-SM-9 + parent CD-3. No `currentStreak`, `longestStreak`, `daysActive`, `consecutiveCorrectCount` derivation. `lastInteractedAt` exists in the data but consumers must render it as a one-time welcome-back banner, never as a streak counter.

### DO NOT implement the seeder ranking until I-SM-4 is enforced

`useShapeMasterySeederRanking` is **deferred** to the fast-follow WS that wires `declaredLevel` + `userMuteState` writers. Implementing the ranking without those writers means the seeder pool is always full and the ranking is a placeholder, which would be misleading. Wait.

## Future scope (fast-follow WS)

- `useShapeMasterySeederRanking()` — Discover-mode seeder.
- Signal-composition inspector hook for the transparency surface's per-row expand.
- LLM-augmented narrative authorship integration (deferred per HSP-X3 / WS-157 precedent).

These ship after the reducer's deferred writers land.
