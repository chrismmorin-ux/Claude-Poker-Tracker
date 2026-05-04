# HSP Narrative Template — Authorship Conventions

Authored 2026-05-03 by WS-138. Binds WS-138 (preflop), WS-139 (flop), and any future archetype authoring (turn/river v2). Read before editing or adding templates.

## File location

- `docs/design/hero-state-templates/preflop/<ARCHETYPE_ID>.md` — 8 files (WS-138)
- `docs/design/hero-state-templates/flop/<ARCHETYPE_ID>.md` — 10 files (WS-139)
- Filename matches `archetypeId` field in frontmatter (case-sensitive)

## File structure

Each template file has:

1. YAML frontmatter (metadata for tooling)
2. `## Headline` section (single line, markdown-bold)
3. `## Body` section (multi-paragraph)
4. `## Branch summary` section (short prose)

## Frontmatter

```yaml
---
archetypeId: PF_OPEN_RFI
family: PREFLOP_OPEN
voiceNotes: |
  Hand-conditioned headline; range-config branches; first-person plural.
slotsUsed:
  - handContext.hand
  - situation.positionClass
  - plan.primary.sizing
  - plan.branches[*].trigger
---
```

Required fields:

| Field | Type | Notes |
|---|---|---|
| `archetypeId` | string | Matches one of `ARCHETYPE_IDS` from `src/utils/heroState/types.js` |
| `family` | string | Matches one of `ARCHETYPE_FAMILIES` |
| `voiceNotes` | string | One-paragraph note for future authors — what's distinctive about this template |
| `slotsUsed` | string[] | Dot-paths into HeroState that the template references. Used by future CI/tooling to verify all referenced slots exist on the typedef |

## Slot syntax

**Mustache-style `{{path.to.field}}`** with dot-paths into HeroState.

| Slot pattern | Resolves to | Example |
|---|---|---|
| `{{handContext.hand}}` | Hero hand notation | "AJo" |
| `{{situation.positionClass}}` | Hero position | "HJ" |
| `{{situation.actionContext}}` | Action context label | "OPEN" |
| `{{plan.primary.action}}` | Primary recommended action | "BET" |
| `{{plan.primary.sizing}}` | Primary sizing (bb preflop, % postflop) | "2.5" or "33%" |
| `{{plan.primary.sizingRationale}}` | Inline sizing rationale | "standard open, balances range cost" |
| `{{plan.branches[*].trigger}}` | Iterates branch triggers | "called from BTN" |
| `{{equity.overall}}` | Overall hero equity | "62%" |
| `{{equity.vsRangeParts.vsValue}}` | Equity vs villain value combos | "22%" |
| `{{handContext.handClass}}` | Hand class (e.g., TOP_OF_RANGE) | "premium-lite" |

Array iteration: `{{plan.branches[*].trigger}}` expands to each branch trigger. Renderer (WS-142 orchestrator) is responsible for the iteration logic; templates just signal the array path.

**Hardcoding numerics is forbidden.** All sizings, equities, and EVs MUST come from slots. Authoring "open 2.5bb" instead of "open `{{plan.primary.sizing}}`bb" violates the first-principles guard (POKER_THEORY.md §7) by treating the archetype label as a plan input.

## Voice constraints (from `HERO_STATE_DESIGN.md §5` worked examples)

- **First-person plural.** "We're planning to open." Not "you should" or "hero opens."
- **Pedagogical, concise.** Each paragraph teaches a frame; no filler.
- **Range/nut advantage** referenced where structurally important (e.g., 3-bet pots, dry low boards), not for every hand.
- **Sizing rationale required.** Never bare sizings — always explain why this size, this spot.
- **Branch reasoning explains "why."** "If 3-bet from BB we usually fold — BB 3-bet range is heavy on AQ+/JJ+ which dominates us." Not just "fold to BB 3-bet."

## First-principles guard (mandatory — `POKER_THEORY.md §7` + `exploitEngine/CLAUDE.md`)

The classifier emits `archetypeId`. The template emits prose. Plan computation lives elsewhere (`gameTreeEvaluator`).

- ✅ Templates reference `{{plan.primary.sizing}}` — Plan is computed from equity/SPR/pot odds/players remaining.
- ✅ Templates reference `{{handContext.handClass}}` for narrative framing — hand class is read from HeroState, not hardcoded.
- ❌ Templates do NOT hardcode "open 2.5bb" because the sizing comes from Plan, not from the archetype label.
- ❌ Templates do NOT contain conditional logic gated on `archetypeId` (e.g., "if PF_VS_OPEN_SB then 4.5x") — the archetypeId IS the template selector; that's the only place it's used.
- ❌ Templates do NOT mix style adjustments into base prose (adjustments are layered separately at render time via `adjustments[*]`).

## Per-archetype headline pattern (recommendations)

Headlines should be hand-conditioned where natural and structurally framed otherwise:

- Hand-conditioned: `"{{handContext.hand}} on {{situation.positionClass}} — standard open"` (PF_OPEN_RFI)
- Structurally framed: `"SB vs {{villainPosition}} open — tighten + 3bet polarize"` (PF_VS_OPEN_SB — applies to whole defending range)

Pick whichever fits the archetype's coherence. Some archetypes are hand-class-agnostic at the headline level (PF_VS_OPEN_SB, PF_LIMP_NAV); others are hand-specific (PF_OPEN_RFI, PF_3BET).

## Adjustment references

If an archetype commonly stacks specific tendency adjustments (calling station, nit, short-stacked), reference them in the body via:

```markdown
If villain is a calling station, we {{adjustments.callingStation.delta.actionOverride}}
at {{adjustments.callingStation.delta.sizingMultiplier}}× standard sizing — {{adjustments.callingStation.rationale}}.
```

Adjustments are an array on HeroState (`adjustments[]`). Template can reference adjustments by `condition` lookup if needed — exact slot syntax for conditional adjustment rendering is up to WS-142 orchestrator design and may evolve.

For v1, keep adjustment references simple and rely on the orchestrator to assemble.

## v2 expansion

When turn + river archetype catalogs are authored (deferred per `HERO_STATE_DESIGN.md §4.4–§4.5`):
- Same conventions apply
- Add `turn/` and `river/` subdirectories
- Extend `ARCHETYPE_IDS` in `types.js`
- No template-format changes anticipated
