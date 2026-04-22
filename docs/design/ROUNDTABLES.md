# Blind-Spot Roundtables

The framework knows what it has been told. It does not know what it's missing. Blind-spot roundtables are the program's mechanism for hunting the things the framework itself can't surface.

---

## When to run a roundtable

**Triggered** (Gate 2 of the feature lifecycle):

- Gate 1 output is YELLOW or RED.
- Any new surface creation (new route, new panel, new modal).
- Any feature targeting a persona currently unserved by existing surfaces (e.g., first Coach feature, first Banker feature).
- Cross-product feature (affects both main-app and sidebar).
- Owner flags the work for scrutiny.

**Cadence** (baseline hygiene):

- Quarterly, even without a triggered run, to catch drift.
- After any substantial incident or regression surfaced by users.

---

## Execution model

- Use the `/eng-engine` roundtable pattern with the product-ux-engineer persona leading, plus general-purpose agent for market / external lens and senior-engineer for cross-cutting concerns.
- Each stage produces a short written output. Full roundtable ≈ 1–2 agent runs.
- Output lands in a timestamped file: `audits/YYYY-MM-DD-blindspot-<topic>.md`.

---

## Five stages

### Stage A — Persona sufficiency

**Question**: Who would plausibly use this feature who we have NOT modeled in `personas/`?

**Method**:
1. List the feature's apparent user archetypes (from the feature proposal).
2. Map each to an existing persona in `personas/core/`.
3. For every proposed archetype without a clean 1:1 match: hypothesize a new persona.
4. Also check: *does an existing persona not-quite-fit in a way that suggests we should split it?*

**Common failure modes this catches**:
- Feature is designed for "the user" when actually three different personas would use it for different reasons.
- Existing persona is stretched to cover a use case that's genuinely a different archetype.
- Edge-case persona (Newcomer, Banker, Analyst) assumed to not exist, when in fact the feature makes them directly relevant.

**Output**:
- ✅ **Match**: every proposed archetype maps cleanly to an existing persona.
- ⚠️ **Patch needed**: 1–2 sub-personas or situational personas missing; document + add in Gate 3.
- ❌ **Structural gap**: new core persona missing entirely; Gate 3 must close this before Gate 4.

---

### Stage B — JTBD coverage

**Question**: What outcomes would users of this feature want that are NOT in our JTBD atlas?

**Method**:
1. For each persona confirmed in Stage A, list the outcomes they'd pursue with this feature.
2. Map each outcome to a JTBD ID in the atlas.
3. Outcomes without an existing JTBD → gaps.

**Common failure modes this catches**:
- Feature is framed around a UI primitive ("let user tap X") rather than an outcome.
- Multiple distinct outcomes get flattened into one JTBD, hiding divergent success criteria.
- Meta-outcomes (subscription, permissions, sync, recovery) left out because the feature description is too feature-focused.

**Output**:
- ✅ **Coverage complete**: all outcomes mapped.
- ⚠️ **Expansion needed**: 1–3 JTBDs to add (or an existing JTBD to decompose).
- ❌ **Domain missing**: feature operates in a JTBD domain the atlas doesn't yet cover.

---

### Stage C — Situational stress test

**Question**: Does this feature survive the situations our users are in?

**Method**:
1. For each applicable persona, walk through every relevant situational sub-persona (`personas/situational/`).
2. For each situation, ask: *can the user complete the feature's primary JTBD within the situation's time / attention / cognitive budget?*
3. Edge cases: phone sleep, interruption, one-handed, dim light, dealer pressure, multi-table attention fragmentation.

**Common failure modes this catches**:
- Feature works for post-session review but breaks mid-hand because the input takes 15 seconds.
- Destructive action lives in thumb-reach zone for a persona where that's dangerous.
- Feature assumes focused attention but user's actual situation is shared attention.
- Form doesn't survive phone sleep mid-entry.

**Output**:
- ✅ **Pass**: every persona × situation combination is viable.
- ⚠️ **Adjust**: specific situations require targeted adjustments in the design.
- ❌ **Fundamental mismatch**: feature is not designed for the situation it will actually be used in.

---

### Stage D — Cross-product / cross-surface

**Question**: Does this feature have ripples beyond its immediate surface?

**Method**:
1. List surfaces the feature touches directly.
2. List surfaces it might influence indirectly (shared state, shared nav, cross-product sync).
3. Check both product lines: does the sidebar need a counterpart? Does this main-app feature conflict with how the sidebar presents similar data?
4. Check navigation: does this change how users return to / from this surface from others?
5. Check data: does this feature write state that other surfaces depend on?

**Common failure modes this catches**:
- Main-app feature built without sidebar parity (online players can't use it).
- State model change breaks a surface nobody remembered touched the same data.
- Navigation path created that has no return path.
- Feature shipped in one product line assuming sidebar will "come later" without a path.

**Output**:
- ✅ **Scoped correctly**: surface list is complete; no unexpected ripples.
- ⚠️ **Partner surfaces need updates**: list them.
- ❌ **Scope was wrong**: feature is actually cross-product and must be scoped accordingly.

---

### Stage E — Heuristic pre-check

**Question**: Against Nielsen 10 + Poker-Live-Table + Mobile-Landscape, does the proposed design obviously violate anything?

**Method**:
1. Walk the proposed interaction against each heuristic set.
2. Flag anything that would count as a finding if this were an audit.
3. Particular attention to H-N03 (undo), H-N05 (error prevention), H-PLT06 (misclick absorption), H-PLT07 (state-aware primary action), H-ML04 (scale interaction), H-ML06 (touch target ≥44).

**Common failure modes this catches**:
- Destructive action introduced without undo.
- New menu that's fixed-order rather than state-aware.
- New form that won't survive landscape scroll math.
- Touch targets below 44 DOM-px at common scale factors.

**Output**:
- ✅ **Clean**: no obvious pre-violations.
- ⚠️ **Specific adjustments needed**: list them.
- ❌ **Heuristic incompatible**: the proposed design is structurally at odds with a heuristic; rethink.

---

## Output format

Each roundtable produces a document at `audits/YYYY-MM-DD-blindspot-<topic>.md` with:

```markdown
# Blind-Spot Roundtable — YYYY-MM-DD — <Feature>

## Feature summary
<One paragraph on what's being proposed>

## Stage A — Persona sufficiency
Output: ✅ / ⚠️ / ❌
Findings: ...

## Stage B — JTBD coverage
Output: ✅ / ⚠️ / ❌
Findings: ...

## Stage C — Situational stress test
Output: ✅ / ⚠️ / ❌
Findings: ...

## Stage D — Cross-product / cross-surface
Output: ✅ / ⚠️ / ❌
Findings: ...

## Stage E — Heuristic pre-check
Output: ✅ / ⚠️ / ❌
Findings: ...

## Overall verdict
GREEN / YELLOW / RED — with rationale.

## Required follow-ups
- [ ] Gate 3 (Research) — scope: ...
- [ ] Persona additions: ...
- [ ] JTBD additions: ...
- [ ] Design adjustments before Gate 4: ...
```

---

## Anti-patterns for roundtables

1. **Boilerplate passes.** A roundtable that finds nothing is suspicious. Either the feature is genuinely simple or the roundtable questions were too comfortable. If a roundtable produces five ✅'s every time, tighten the questions.
2. **Rubber-stamping.** Roundtables are not for approving a design; they're for finding gaps. If the output is "proceed," the follow-ups section should still list observations for Gate 4.
3. **Post-implementation roundtables.** Gate 2 is before Gate 4. Running a roundtable after implementation surfaces issues too late to act on cleanly.
4. **One-stage roundtables.** All five stages run, in order. A persona-only pass is not a roundtable.
5. **Persona-only, forgetting situational**: Stage C (situational stress) is where most real-world failures hide. Skipping it defeats the purpose.

---

## Change log

- 2026-04-21 — Created. Part of Design Program establishment.
