---
name: research-review
description: "Adversarial research review — falsifiability analysis, load-bearing assumption scoring, credibility assessment, and portfolio balance check"
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: research-review` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Research Review Engine

Rigorous adversarial review of research projects, theoretical work, or any system built on assumptions that need validation. Combines hostile peer review with strategic prioritization based on credibility impact.

## Focus Area

$ARGUMENTS (specific claim/chapter, or "full" for complete review)

---

## PHASE 0 — GATHER CONTEXT

1. Read `CLAUDE.md` — research domain, key claims, methodology
2. Read `system/state.md` — current state of research
3. Read `system/invariants.md` — established facts and axioms (these are NOT targets for attack)
4. Read `system/constraints.md` — working assumptions (these ARE targets)
5. Read `system/decisions.md` — settled methodological choices
6. Read `system/failures.md` — past errors and corrections
7. Read all research documents, data, and analysis files
8. Map the dependency structure: what depends on what?

---

## PHASE 1 — ADVERSARIAL REVIEW (The Auditor)

Launch the **research-scientist** persona as an agent with this mandate:

> Attack this work like a hostile but competent peer reviewer. Find:
> 1. Underdefined terms
> 2. Hidden assumptions (stated or not)
> 3. Non-independent predictions (things that LOOK like separate confirmations but derive from the same source)
> 4. Category collisions (concepts from different domains mixed without justification)
> 5. Numerology (numerical coincidences presented as significant)
> 6. Retrofitting (explanations constructed after seeing data, presented as predictions)
>
> For EVERY claim examined, propose at least one falsification test:
> - What specific observation would REFUTE this claim?
> - What is the pass/fail criterion?
> - Can this be checked BEFORE investing more effort?
>
> Classify each finding:
> (a) Hard contradiction with established results
> (b) Definitional ambiguity — term used without precise meaning
> (c) Mathematical/logical incompleteness — step missing or unjustified
> (d) Presentation failure — claim is sound but framing is misleading

---

## PHASE 2 — LOAD-BEARING ANALYSIS (The Engine)

For each major claim, assumption, or component, calculate:

### Load-Bearing Score = Dependencies x Vulnerability

- **Dependencies:** How many other things depend on this being correct? (count downstream claims, features, or conclusions)
- **Vulnerability:** How confident are we this IS correct? (1=proven, 2=strong evidence, 3=reasonable assumption, 4=untested, 5=contested)

### Priority Scoring

For each potential work item:
```
Composite Score = (Leverage x Credibility_Impact x Confidence) / Effort + Bonuses - Penalties
```

**Credibility Impact Factors:**
| Factor | Score |
|--------|-------|
| Blind prediction confirmed | +4 |
| Closed derivation chain | +3 |
| Falsifiable test with clear pass/fail | +2 |
| Fewer assumptions than alternatives | +2 |
| Stress-test of existing claim | +1 |
| Post-hoc explanation only | -1 |
| Unfalsifiable claim | -3 |
| Contradiction with established results | -5 |

---

## PHASE 3 — PORTFOLIO BALANCE

Assess the mix of current and proposed research activities:

| Category | Target | Current | Status |
|----------|--------|---------|--------|
| **Exploit** (extend established results) | ~50% | ?% | OK/OVER/UNDER |
| **Explore** (investigate new territory) | ~30% | ?% | OK/OVER/UNDER |
| **Stress-test** (actively try to break results) | ~20% | ?% | OK/OVER/UNDER |

If stress-testing is below 20%: credibility claims about existing work are unsupported. Flag this prominently.

---

## PHASE 4 — PRE-MORTEM

Before finalizing recommendations, run a pre-mortem:

> Assume the top-priority recommendation was completed and FAILED. 
> What went wrong? What was the hidden assumption that broke?
> What should we have checked first?

Use the pre-mortem to add "signpost" checks — early indicators that the approach is wrong, checked before investing full effort.

---

## PHASE 5 — FINDINGS & WORK ITEMS

Severity mapping:
| Finding Type | Severity |
|-------------|----------|
| Hard contradiction (a) | CRITICAL |
| Load-Bearing Score > 15 | HIGH |
| Mathematical incompleteness (c) | HIGH |
| Definitional ambiguity (b) | MEDIUM |
| Portfolio imbalance | MEDIUM |
| Presentation failure (d) | LOW |

Work items should include:
- Falsification test criteria (what would refute the claim)
- Signpost checks (early indicators of failure)
- Expected credibility impact score

---

## PHASE 6 — REPORT

```
## Research Review Results

### Overall Rigor Score: [N]/10

### Load-Bearing Map
| Claim/Component | Dependencies | Vulnerability | LBS | Status |
|----------------|-------------|---------------|-----|--------|
| ... | N | 1-5 | NxV | SOLID/FRAGILE/CRITICAL |

### Adversarial Findings
| # | Type | Claim | Finding | Falsification Test |
|---|------|-------|---------|-------------------|
| 1 | (a/b/c/d) | ... | ... | ... |

### Portfolio Balance
| Category | Target | Actual | Recommendation |
|----------|--------|--------|---------------|
| Exploit | 50% | ?% | ... |
| Explore | 30% | ?% | ... |
| Stress-test | 20% | ?% | ... |

### Priority Recommendations
| # | Work Item | Composite Score | Credibility Impact | Signposts |
|---|-----------|----------------|-------------------|-----------|
| 1 | ... | NN.N | +N | ... |

### Pre-Mortem Warnings
[What could go wrong with the top recommendations]
```

---

## Contract Alignment (ADR-038)

The briefing/output phase MUST emit this block (per ADR-038 Decision #6):

```
### Contract Alignment
- mode: <honored | departed (reason)>
- stretch: <honored | departed (reason)>
- success_shape: <honored — list which target items hit | departed (reason)>
- scope_ceiling: <complied — items skipped: [list] | violated (reason)>
```
