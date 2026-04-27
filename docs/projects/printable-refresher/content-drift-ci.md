# Content-drift CI — Printable Refresher

**Status:** v1.0 — Gate 4, Session 4 (2026-04-24).
**Depends on:** `docs/design/surfaces/printable-refresher.md` §State; `WRITERS.md`; `copy-discipline.md` §CI-lint; charter §Acceptance Criteria (§Source-util whitelist/blacklist + all 6 fidelity gates F1-F6).
**Non-negotiable sequencing:** This spec must be ratified + CI test implemented **BEFORE** any Gate 5 card authoring PR merges. Phase A / Phase B / Phase C card authoring is gated on PRF-G5-CI being green in main.
**Purpose:** Define the CI-gate that catches content drift, source-util violations, copy-discipline regressions, and schemaVersion-bump discipline across every card manifest at build time.

---

## Why this spec exists

The Printable Refresher ships content that is laminated and carried to live tables. Staleness is invisible on paper (H-PM07) — the owner cannot know a card is wrong without consulting the app. That makes the content-drift problem an **autonomy** problem, not just a quality problem:

- If a `pokerCore/preflopCharts.js` util changes (range update, rake-aware bias) and the corresponding refresher card's `contentHash` is not bumped, the laminated card silently diverges from the engine. Red line #12 (lineage-mandatory) is violated the moment the lineage footer still says `v1.0` but the underlying util has drifted.
- If a new card is authored that sources from a blacklisted util (`villainDecisionModel` / `assumptionEngine` / etc.), fidelity bar F4 + F6 are violated. Per-villain calibration would ship on paper — a permanent wrong-answer vector (charter §Source-util whitelist/blacklist + Voice 3 F6).
- If a card's prose contains a forbidden CD-1/CD-2/CD-3/CD-4/CD-5 string (e.g., "vs Fish, always iso"), copy-discipline is violated at the content layer even when the feature layer (anti-patterns) is clean.

The CI spec catches all three at build time before a PR merges.

**Precedent:** Inherits the RT-108 snapshot-test pattern from the `drillContent/` module (established 2026-03-xx). RT-108 snapshots compute-engine output per worked example + assert byte-stability across commits; schemaVersion bumps are the explicit escape hatch for intentional re-version. PRF generalizes the pattern from "drill content" to "manifest content" and extends it with source-util whitelist scan + CD forbidden-string grep.

**Enforcement contract.** CI test suite at `src/utils/printableRefresher/__tests__/contentDrift.test.js` runs on every PR. Failure blocks merge.

---

## Scope

**In scope:**
1. Manifest `contentHash` stability vs re-computed source-util hash (the RT-108 core).
2. Source-util whitelist / blacklist enforcement at manifest level.
3. CD forbidden-string grep against rendered card body + title + lineage footer.
4. `schemaVersion` bump discipline — when content changes intentionally, schemaVersion MUST increment.
5. Markdown-vs-generated precedence rule (prose manifests vs runtime-generated numeric fields).
6. Lineage-footer completeness (7-field presence per red line #12).
7. Manifest schema validation (shape + required fields).

**Out of scope (other CI gates):**
- Writer registry compliance → `scripts/check-refresher-writers.sh` per `WRITERS.md` §CI-grep enforcement sketch.
- Print-CSS cross-browser snapshot tests → PRF-G5-PDF Playwright suite per PRF-G4-CSS.
- Red-line compliance (17-line assertion suite) → PRF-G5-RL.
- Reducer-boundary write-silence → PRF-G5-RI.

---

## Directory + file layout

```
src/utils/printableRefresher/
  cardRegistry.js                          # barrel — loads + validates all manifests at build
  manifests/                               # one manifest per card
    preflop-open-co-100bb-$2-$5.json
    math-auto-profit.json
    math-geometric-sizing.json
    math-pot-odds.json
    math-implied-odds.json
    math-binomial-survival.json
    math-spr-zones.json
    ... (15+ at MVP)
  lineage.js                                # computeLineage, hashUtil, printFooter
  stalenessDiff.js                          # runtime-side diff
  __tests__/
    contentDrift.test.js                    # THIS SPEC'S TARGET — core CI gate
    manifestSchema.test.js                   # per-manifest shape validation
    lineage.test.js                          # hash stability + schema assertions
    sourceUtilWhitelist.test.js              # F4/F6 enforcement (may be folded into contentDrift.test.js)
    copyDiscipline.test.js                   # CD forbidden-string grep (may be folded)
```

---

## Manifest shape (per card)

Every card is authored as a JSON manifest under `manifests/`. Schema enforced by `manifestSchema.test.js`.

```
{
  "cardId": "PRF-PREFLOP-OPEN-CO-100BB-2-5",     // kebab-case, globally unique
  "schemaVersion": 1,                              // bump on any intentional content change
  "class": "preflop",                              // 'preflop' | 'math' | 'equity' | 'exceptions'
  "title": "CO open · 100bb · $2/$5 · 5% rake cap $5 · 9-handed live",
  "bodyMarkdown": "...",                           // prose content — source of truth for copy
  "generatedFields": {                             // computed at render-time; names map to generator functions
    "rangeGrid": "pokerCore/preflopCharts#computeOpenRange",
    "sizingHint": "pokerCore/preflopCharts#defaultSizing"
  },
  "sourceUtils": [                                 // F4 lineage-trail enumeration
    {
      "path": "src/utils/pokerCore/preflopCharts.js",
      "hash": "sha256:a3c1d8f...",                 // updated on schemaVersion bump
      "fn": "computeOpenRange"
    }
  ],
  "theoryCitation": "POKER_THEORY.md §3.2 (equity-realization) + §4.1 (rake-adjusted EV)",
  "assumptions": {
    "stakes": "$2/$5 cash",
    "rake": { "pct": 0.05, "cap": 5, "noFlopNoDrop": true },
    "effectiveStack": 100,                          // in BB
    "field": "standard 9-handed live $1/$3 field"
  },
  "bucketDefinitionsCited": null,                  // null | string (path to glossary)
  "atomicityJustification": "Single position + single stack depth + single stakes/rake config — H-PM05 compliant as one reference unit.",
  "atomicityJustificationWordCount": 18,           // enforced ≤ 25 per H-PM05
  "phase": "A",                                    // 'A' | 'B' | 'C'
  "tier": "plus",                                  // 'free' | 'plus' — affects Phase C Plus-tier + Phase A conditional ship
  "cd5_exempt": false,                              // CD-5 assumption-explicit lint exemption (glossary/worked-example only)
  "cd5_exempt_justification": null,                 // required if cd5_exempt: true
  "fidelityChecklist": {                           // F1-F6 per-card ratification
    "F1_no_archetype_as_input": true,
    "F2_math_visible": true,
    "F3_scenario_declared": true,
    "F4_source_trail_footer": true,
    "F5_pure_exception_provenance_unambiguous": true,
    "F6_prescriptions_computed": true
  },
  "contentHash": "sha256:...",                     // CACHED HASH — compared against re-computation at CI time
  "lastVersionedAt": "2026-04-24T00:00:00Z"
}
```

---

## CI gate: the six checks

### Check 1 — Manifest contentHash vs re-computation (RT-108 core)

**Mechanism.** For each manifest in `manifests/`:
1. Load `manifest.json`.
2. For each `sourceUtils[]` entry, dynamically import the util + stable-stringify the relevant function's serialized output at `manifest.assumptions` param binding.
3. Compute a combined hash: `sha256(bodyMarkdown + sourceUtils[].hash + generatedFields[].serialized_output)`.
4. Compare to `manifest.contentHash`.

**Pass conditions.**
- Hash matches → card is current.
- Hash mismatches AND `manifest.schemaVersion` was bumped in this PR (detected via `git diff`) → **PASS**. Intentional re-version; this is the RT-108 escape hatch.

**Fail conditions.**
- Hash mismatches AND schemaVersion unchanged → **FAIL with clear error message:** `"Content drift: card PRF-XXX hash changed but schemaVersion still v1. Either bump schemaVersion + update hash (intentional re-version), or revert the source-util change."`
- Hash mismatches AND schemaVersion decremented → **FAIL** (schema is monotonic; decrement is a bug).

**Implementation sketch.**
```js
// contentDrift.test.js (excerpt)
import { manifests } from '../cardRegistry.js';
import { computeSourceHash } from '../lineage.js';
import { getSchemaVersionChange } from './_gitUtils.js';

describe('content-drift CI', () => {
  manifests.forEach((manifest) => {
    it(`${manifest.cardId}: contentHash matches source utils`, async () => {
      const recomputed = await computeSourceHash(manifest);
      const schemaVersionChangedInPR = getSchemaVersionChange(manifest.cardId);

      if (recomputed === manifest.contentHash) {
        // Passing — card is current
        return;
      }

      if (schemaVersionChangedInPR.bumped) {
        // RT-108 escape hatch — intentional re-version
        expect(manifest.contentHash).toBe(recomputed);  // ensure authored hash matches recomputation
        return;
      }

      throw new Error(
        `Content drift on ${manifest.cardId}: ` +
        `hash changed (expected ${manifest.contentHash}, computed ${recomputed}) ` +
        `but schemaVersion is still ${manifest.schemaVersion}. ` +
        `Either bump schemaVersion + update contentHash, or revert the source-util change.`
      );
    });
  });
});
```

### Check 2 — Source-util whitelist / blacklist

**Mechanism.** For each manifest:
1. Parse `sourceUtils[].path` array.
2. Match against whitelist regex set.
3. Match against blacklist regex set.
4. Also scan `bodyMarkdown` + `generatedFields` for any import / reference to blacklisted paths.

**Whitelist (charter §Source-util whitelist/blacklist):**
- `^src/utils/pokerCore/` — `preflopCharts`, `rangeMatrix`, `boardTexture`, `handEvaluator`, `cardParser`
- `^src/constants/gameTreeConstants\.js$` — population baselines (rake configs, style-prior fold curves, SPR zones, realization factors)
- `^\.claude/context/POKER_THEORY\.md$` — formal derivations + §9 documented divergences

**Blacklist:**
- `^src/utils/exploitEngine/villainDecisionModel\.js$`
- `^src/utils/exploitEngine/villainObservations\.js$`
- `^src/utils/exploitEngine/villainProfileBuilder\.js$`
- `^src/utils/assumptionEngine/` — entire namespace
- `^src/utils/anchorLibrary/` — entire namespace (calibration-state sources)
- `^src/components/views/CalibrationDashboardView/` — any UI read-through of calibration state
- `^src/components/views/AnchorLibraryView/` — any UI read-through of anchor retirement state

**Pass condition.** All `sourceUtils[].path` match whitelist + zero match blacklist + `bodyMarkdown` contains zero blacklisted path references.

**Fail condition.** Any blacklist match → FAIL with: `"Source-util violation: card PRF-XXX references <blacklisted_path>. Per charter §Source-util whitelist/blacklist, calibration / assumption / per-villain utilities must not ship on paper — they invalidate once calibration retires in-app but the laminate survives. See Voice 3 F6."`

**Pass-through case.** If `sourceUtils` is empty (pure POKER_THEORY.md citation only — e.g., auto-profit formula card) → allowed; lineage must cite `.claude/context/POKER_THEORY.md` + specific §.

### Check 3 — CD forbidden-string grep

**Mechanism.** For each manifest:
1. Concatenate rendered prose: `title + bodyMarkdown + derived lineage footer`.
2. Run regex patterns from `copy-discipline.md` §CI-lint.
3. Match against 5 categories: imperative tone / self-evaluation / engagement / labels-as-inputs / unqualified assumptions.

**Regex patterns (from `copy-discipline.md` §CI-lint — canonical list maintained there; mirrored here for CI implementation):**

- **CD-1 imperative tone:**
  - `/\byou must\b/i`
  - `/\balways\b.{0,50}(fold|iso|check|bet|bluff|call|raise|3-?bet|4-?bet|cbet|barrel)/i`
  - `/\bnever\b.{0,50}(bluff|call|bet|fold|raise|iso|cbet|barrel)/i`
  - `/\bdo not\b.{0,50}(fold|call|bet|bluff|raise|iso|cbet|barrel)/i`
  - `/\bdon't\b.{0,50}(fold|call|bet|bluff|raise|iso|cbet|barrel)/i`
- **CD-2 self-evaluation:**
  - `/\bgrade your\b/i`
  - `/\bscore your\b/i`
  - `/\bcheck your answer\b/i`
  - `/\bdid you\b/i` (with `/\bhow did you\b/i` variant)
  - `/\btest yourself\b/i`
  - `/\b(was|did) your read\b/i`
- **CD-3 engagement:**
  - `/\bmastered\b/i` / `/\bcards remaining\b/i` / `/\bprogress\b/i` / `/\bstreak\b/i` / `/\bkeep it up\b/i` / `/\bgreat job\b/i`
  - `/\blevel up\b/i` / `/\bunlock\b/i`
  - `/\blast chance\b/i` / `/\blimited time\b/i` / `/\bre-?print soon\b/i`
  - `/\busers like you\b/i` / `/\bmost popular\b/i` / `/\btrending\b/i`
  - `/your \d+%/i` — allowed only in poker-math contexts; see whitelist-bypass rule below
- **CD-4 labels-as-inputs:**
  - `/(vs|against|versus)\s+(fish|nit|lag|tag|station|maniac|whale).{0,80}(iso|bet|bluff|fold|raise|call|3-?bet|4-?bet|cbet|barrel|tighten|loosen)/i`
  - **Whitelist exception:** adjacent POKER_THEORY citation within 200 characters of the match passes the lint (glossary / population-annotation contexts require citation).
- **CD-5 unqualified assumptions:**
  - Manifest body without any match for stakes regex `(\$[\d.]+\/\$[\d.]+|tournament|rake-agnostic)` → FAIL
  - Manifest body without any match for stack regex `(\d+bb|\d+BB|effective)` → FAIL
  - Bypass: `cd5_exempt: true` with non-empty `cd5_exempt_justification` on manifest (for glossary / population-annotation / worked-example cards)

**Pass condition.** Zero forbidden-string matches outside whitelist exceptions.

**Fail condition.** Any match → FAIL with: `"Copy-discipline violation: card PRF-XXX prose contains forbidden pattern (CD-<N>). Found: '<excerpt>'. See docs/projects/printable-refresher/copy-discipline.md."`

**Amendment rule.** Adding or removing a forbidden-string pattern requires persona-level review (same as CD rules themselves). Amendment flow: update `copy-discipline.md` §CI-lint → mirror change in `contentDrift.test.js` regex → owner + one Gate-2-voice equivalent sign off.

### Check 4 — schemaVersion bump discipline

**Mechanism.** For each manifest:
1. Read `manifest.schemaVersion`.
2. Compare against `git show HEAD:src/utils/printableRefresher/manifests/<cardId>.json` previous version's schemaVersion.
3. Compute diff across body + generatedFields + sourceUtils.

**Pass conditions.**
- No diff detected (body / generated / sourceUtils unchanged) + schemaVersion unchanged → PASS (no re-version needed).
- Diff detected + schemaVersion incremented (monotonic) → PASS (intentional re-version).
- Diff detected + schemaVersion stays same + changes are PROSE-ONLY and marked `manifest.proseOnlyEdit: true` → PASS with warning (typo fix, caption polish — does not trigger staleness on laminated copies).

**Fail conditions.**
- Diff detected + schemaVersion unchanged + `proseOnlyEdit` not set → FAIL with: `"schemaVersion bump required: card PRF-XXX content changed. Either set proseOnlyEdit: true (typo fix only) or increment schemaVersion + bump contentHash."`
- Diff detected + schemaVersion decremented → FAIL (monotonic violation).
- `proseOnlyEdit: true` but diff includes generatedFields or sourceUtils → FAIL (misuse of the escape hatch).

**proseOnlyEdit rule rationale.** H-PM07 (staleness channel is in-app only) means every content change is potentially paper-visible. But typo fixes + caption polish + grammar corrections don't change the **math** — they only change the rendering. Allowing these without schemaVersion bump prevents nuisance "batch is stale" banners every time a typo is fixed. **Strict requirement:** `proseOnlyEdit` may ONLY be set for changes to `bodyMarkdown` prose that do not alter any numeric value, any table entry, any formula, any citation, any assumption, or any lineage field. CI reviewers + persona-level-review on amendments enforce at PR-review time. If unsure, bump schemaVersion.

### Check 5 — Markdown-vs-generated precedence

**Mechanism.** Rule: `bodyMarkdown` is source of truth for copy; `generatedFields` is source of truth for computed numeric content. If the two contradict at render time, CI fails.

**Detection.** Render each card with its manifest → compare rendered output to authored `bodyMarkdown`. Specifically, any numeric value referenced in `bodyMarkdown` as a placeholder (`{{rangeGrid}}`, `{{autoProfitTable[0.5]}}`) must resolve via `generatedFields`. Hardcoded numbers in `bodyMarkdown` that would naturally be generated (e.g., typing "33%" in prose when `breakeven = B/(P+B)` is generable) produce a warning + require author to either (a) use a generated placeholder, or (b) prove the number is prose-only (glossary / worked-example — `cd5_exempt` related).

**Pass condition.** All numeric values in rendered output are traceable to either (a) `generatedFields`, or (b) POKER_THEORY.md citation with specific section.

**Fail condition.** A number appears in `bodyMarkdown` that could have been generated but isn't, with no theory citation backing → WARN (not fail; author must justify). Repeated warnings → manual PR-review escalation.

**Precedent (EAL W-EA-1 doctrine):** "seed markdown is source of truth; IDB is a cache." PRF generalizes: "manifest is source of truth; render output is a cache."

### Check 6 — Lineage-footer completeness (red line #12)

**Mechanism.** For each manifest, derive the 7-field lineage footer (per red line #12 + S1 §CardDetail `LineageModal`):
1. Card ID + semver
2. Generation date (ISO8601)
3. Source-util path + contentHash
4. Engine + app version
5. Theory citation
6. Assumption bundle
7. Bucket definitions cited (if applicable — nullable per manifest `bucketDefinitionsCited: null`)

Derive each field from manifest + runtime values. Assert all 7 are non-empty strings (except bucketDefinitionsCited which may be null if unused).

**Pass condition.** All 7 fields render a non-null value.

**Fail condition.** Any field derives to `null` / empty string (except `bucketDefinitionsCited`) → FAIL with: `"Lineage footer incomplete on PRF-XXX: field <N> is <null|empty>. Red line #12 requires all 7 fields present."`

---

## Test file organization

```js
// src/utils/printableRefresher/__tests__/contentDrift.test.js
import { manifests } from '../cardRegistry.js';

describe('content-drift CI', () => {
  describe('Check 1 — contentHash vs recomputation (RT-108)', () => {
    manifests.forEach((m) => {
      it(`${m.cardId}: hash match or schemaVersion bumped`, async () => {
        // ... see sketch above
      });
    });
  });

  describe('Check 2 — source-util whitelist / blacklist', () => {
    manifests.forEach((m) => {
      it(`${m.cardId}: no blacklisted utils`, () => { /* ... */ });
      it(`${m.cardId}: all source-utils whitelisted`, () => { /* ... */ });
    });
  });

  describe('Check 3 — CD forbidden-string grep', () => {
    const cdPatterns = loadCdPatterns();  // from copy-discipline.md source of truth
    manifests.forEach((m) => {
      cdPatterns.forEach(({ rule, regex }) => {
        it(`${m.cardId}: passes ${rule}`, () => { /* ... */ });
      });
    });
  });

  describe('Check 4 — schemaVersion bump discipline', () => {
    manifests.forEach((m) => {
      it(`${m.cardId}: schemaVersion monotonic + matches diff`, () => { /* ... */ });
    });
  });

  describe('Check 5 — markdown-vs-generated precedence', () => {
    manifests.forEach((m) => {
      it(`${m.cardId}: no hardcoded numerics that should be generated`, () => { /* ... */ });
    });
  });

  describe('Check 6 — lineage-footer completeness (red line #12)', () => {
    manifests.forEach((m) => {
      it(`${m.cardId}: all 7 fields render`, () => { /* ... */ });
    });
  });
});
```

Sibling tests:
- `manifestSchema.test.js` — JSON schema validation per manifest (shape + required fields + type checks). Runs first; contentDrift.test.js depends on schema-valid manifests.
- `lineage.test.js` — hashUtil stability + schema-field mapping + printFooter format.

---

## Failure modes + developer experience

### "I just changed a util — why does CI fail?"

Expected. The first question is: **was the change intentional?**

- **Yes, intentional** (range update, rake support, new stakes tier): update affected manifests' `schemaVersion` + `contentHash`. Run `npm run refresher:recompute-hashes` (Phase 5 dev script) to batch-update. CI passes.
- **No, unintentional** (regression, bug in util): revert the util change. CI passes without touching manifests.

### "I just fixed a typo in a card — why does CI want a schemaVersion bump?"

Expected **pre-fix**. Typo fix is prose-only. Set `manifest.proseOnlyEdit: true` in the PR. CI reviewer verifies the diff is truly prose-only (no numeric change, no citation change, no lineage change). If verified, CI passes without schemaVersion bump.

### "I added a new card — the hash check fails immediately"

Expected on first-commit. New cards author `contentHash` to the computed value explicitly. Use `npm run refresher:compute-hash <cardId>` to generate the correct hash at author time.

### "The CI says my card sources from a blacklisted util — but I need that data"

The data is not allowed on paper. Either:
1. Refactor the card to source from a whitelisted util (e.g., use `gameTreeConstants.js` population baselines instead of `villainDecisionModel`). OR
2. Redirect the card to an on-screen surface (Calibration Dashboard / Anchor Library) where per-villain calibration is permitted.

There is no third option. F6 is load-bearing.

### "The CI says my card has a CD-4 violation, but the label is in a glossary entry"

CD-4 has a whitelist exception: labels adjacent to a POKER_THEORY citation within 200 characters pass. Add the citation:

```
✗ "Fish definition: players with VPIP ≥ 40."                               — FAILS CD-4
✓ "Fish definition: players with VPIP ≥ 40 (POKER_THEORY.md §5.5)."        — PASSES (citation within 200 chars)
```

If the card is a legitimate glossary / population-annotation card, set `cd5_exempt: true` with a `cd5_exempt_justification` explaining scope. Persona-level review at PR time.

---

## Relationship to other CI gates

| Gate | Scope | File |
|---|---|---|
| Content-drift CI (this spec) | Card manifest content — hashes / whitelists / forbidden-strings / schemaVersion | `contentDrift.test.js` |
| Writers CI | IDB write-path registration | `scripts/check-refresher-writers.sh` (per `WRITERS.md`) |
| Red-line compliance | All 17 red lines asserted at UI + reducer | `PRF-G5-RL.test.jsx` + `PRF-G5-RI.test.js` |
| Durable-suppression | Suppression persists across bumps | `PRF-G5-DS.test.js` |
| Lineage footer rendering | 7-field rendering across MVP cards | `PRF-G5-LG.test.jsx` |
| Print snapshot | PDF byte-stability cross-browser | `PRF-G5-PDF.test.js` (Playwright) |

Content-drift CI is complementary to the others — it catches content-layer drift while the others catch UI / reducer / persistence / render-layer regressions.

---

## Phase 5 implementation checklist

When Phase 5 begins (Gate 5 card authoring unblocked):

- [ ] Author `src/utils/printableRefresher/__tests__/contentDrift.test.js` implementing all 6 checks.
- [ ] Author `src/utils/printableRefresher/lineage.js` — `computeSourceHash`, `hashUtil`, `printFooter`, `derive7FieldLineage`.
- [ ] Author `src/utils/printableRefresher/cardRegistry.js` — barrel loading manifests via `import.meta.glob` (or equivalent).
- [ ] Author `scripts/refresher-recompute-hashes.js` (optional dev script for batch hash updates).
- [ ] Author `scripts/refresher-compute-hash.js` (dev script for single-card hash computation).
- [ ] Add to `scripts/smart-test-runner.sh` — `contentDrift.test.js` runs as mandatory pre-commit gate.
- [ ] Add to CI pipeline — `contentDrift.test.js` runs as mandatory merge gate.
- [ ] Author the first MVP card manifest (Phase B starter — `math-auto-profit.json`) + verify all 6 checks pass.
- [ ] Verify CI catches an intentionally-drifted manifest (remove a schemaVersion bump; verify CI fails with correct message).

Only after all 9 checklist items → Phase B card authoring (PRF-G5-B) may begin.

---

## Amendment rule

Adding or removing any check requires **persona-level review**. Adjusting a regex pattern within an existing check follows the amendment rules of the sibling doc that owns the pattern (e.g., CD regex adjustments follow `copy-discipline.md` amendment rule). Source-util whitelist/blacklist adjustments follow charter §Acceptance Criteria amendment rule.

Default answer for amendments is no. F6 source-util blacklist in particular is non-negotiable — attempting to relax it invalidates the entire refresher surface's autonomy contract.

---

## Change log

- **2026-04-24 — v1.0 shipped (Gate 4, Session 4).** 6 CI checks specified (contentHash vs recomputation / source-util whitelist+blacklist / CD forbidden-string grep / schemaVersion bump discipline / markdown-vs-generated precedence / lineage-footer completeness). Manifest shape v1 documented. Test-file organization + developer-experience section + Phase 5 implementation checklist. Non-negotiable sequencing: ship this CI before any Gate 5 card authoring merges. RT-108 pattern inherited from `drillContent/` precedent + extended with source-util whitelist + CD forbidden-string grep.
