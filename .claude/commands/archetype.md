# /archetype — declare archetype, migrate between archetypes, view history

Drives the archetype axis of the ADR-035 Archetype + Stage framework. Archetype determines which programs/engines/personas install (via `kit/data/archetypes.yaml`). Migrating between archetypes swaps the program set — disappearing programs are soft-archived, appearing programs install fresh.

## Subcommands

- `/archetype status` — show current archetype + history
- `/archetype declare <A?>` — first-time archetype capture or correction (no diff/confirmation)
- `/archetype re <A?>` — migration handler with per-program founder confirmation

Valid archetype IDs: `A1` (Regulated commercial product) | `A2` (Civic / public-data platform) | `A3` (Real-time consumer app) | `A4` (Research framework with falsification) | `A5` (Self-modifying tool) | `NONE` (no archetype declared). See `kit/data/archetypes.yaml`.

---

## Step 1: Parse subcommand

```bash
node kit/scripts/cwos-rearchetype.js --help   # if no subcommand given, show usage
```

Route on subcommand: `status` → Step 2. `declare` → Step 3. `re` → Step 4. Unknown → list subcommands and stop.

## Step 2: `status`

Read `.cwos-onboarding.yaml` to get current `archetype` + `archetype_history[]`. Render to founder:

```
## Archetype status

Current:    A3 — Real-time consumer app  (declared <date>)
Stage:      S2 (MVP iteration)

Active programs (from current bundle):
  • prog-engineering, prog-design

History:
  - A5  declared 2026-04-15  archived 2026-05-01  ("went commercial")
  - A1  declared 2026-05-01  archived 2026-05-02  ("retreated to A3 after pivot")
```

If `archetype_history` is empty (never migrated): omit the History section.

## Step 3: `declare <A?>`

For founders coming from `NONE` (or correcting an initial declaration). No diff prompt — same semantics as `/adopt` Steps 4b-archetype + 4b-stage but post-install.

Validate the archetype ID. Then:

```bash
node kit/scripts/cwos-adopt-archetype.js apply --archetype <A?> --stage $(yq '.stage' .cwos-onboarding.yaml) --target-dir .
```

(If `stage` is null, prompt founder to pick one first via `/stage declare`.)

The script:
- Computes the bundle for `(A?, current-stage)`
- Writes `archetype` + `declared_archetype` + `archetype_bundle_resolved` to `.cwos-onboarding.yaml`

Render to founder:

```
✓ Archetype declared: A3 (Real-time consumer app).

Bundle installed:
  Programs: prog-engineering, prog-design
  Engines:  eng-engine, design-audit
  Personas: senior-engineer, product-ux

Run `/audit` to baseline against the new bundle.
```

If founder picks the same archetype that's already declared: `Archetype already A3. No change.` and exit.

## Step 4: `re <A?>`

The migration path. Computes diff between current archetype's bundle and the new one, asks founder to confirm per disappearing program, then applies.

**Step 4a — Compute diff:**

```bash
node kit/scripts/cwos-rearchetype.js diff --from $(yq '.archetype' .cwos-onboarding.yaml) --to <A?> --target-dir .
```

**Step 4b — Render the change tables:**

```
## Re-archetype from A3 → A1 (Regulated commercial product)

Disappearing programs (will be soft-archived):
  - prog-design (N open findings, M open work items)

Appearing programs (will be installed):
  - prog-compliance, prog-financial-accuracy, prog-vendor-risk, prog-launch, prog-security

Escalating tiers:
  (none — at S2 all A1 programs default to `watch`)

De-escalating tiers:
  (none)

Staying:
  - prog-engineering (watch)

Engines disappearing: design-audit
Engines appearing:    compliance-audit, legal-safety, financial-audit
Personas appearing:   legal-guardian, financial-auditor

Confirm transition? (yes / yes --keep-orphan-findings / no)
```

**Step 4c — Founder responses:**

- `yes` — call `cwos-rearchetype.js apply --to <A?> --target-dir . --reason "<founder-given>"`. The script:
  - Updates `archetype` + `declared_archetype`
  - Appends prior archetype to `archetype_history[]`
  - Replaces `archetype_bundle_resolved` block with new bundle
  - Soft-archives findings + work items tied to disappearing programs (status: archived, archived_reason: "program_removed_via_re_archetype")
  - Emits `archetype_changed` event

- `yes --keep-orphan-findings` — same as `yes` but passes `--keep-orphan-findings` to `cwos-rearchetype.js apply`. Findings/items tied to disappearing programs stay open with `program: <removed-id>`. Useful when the founder plans to address those items before the migration is "fully complete".

- `no` — abort. No changes written.

**Step 4d — Founder reason capture:**

After confirm, ask: `Why are you migrating? (one sentence — for the audit trail)`. Pass to `--reason` flag.

**Step 4e — Post-migration:**

```
Re-archetype complete.

Soft-archived: <N> findings, <M> work items.
Appended to archetype_history[].

Recommended next step: `/audit --constitutional` to baseline against the new
bundle. If any disappearing-program work items need to carry over, run
`/workstream restore <WS-NNN>` to bring them back as orphans.
```

## Edge cases

| Situation | What to do |
|-----------|------------|
| Founder migrates to current archetype | `Archetype already <A?>. No change.` |
| Stage is null | "Stage must be declared before re-archetype. Run `/stage declare <S?>` first." |
| `.cwos-onboarding.yaml` doesn't exist | "This repo isn't CWOS-adopted. Run `/adopt` first." |
| Founder picks NONE | Allow it. Bundle becomes empty (eng-engine only). All non-eng-engine programs become disappearing. |
| Founder coming from NONE → A? | Route to `/archetype declare <A?>` instead — no diff needed since there's no prior bundle. |
| `cwos-rearchetype.js` not found | "cwos-rearchetype.js not installed — run `/fleet-update` to install the CWOS CLI quartet (ADR-035 Phase 2 SPR-112)." |

## Prohibited reads

After `cwos-rearchetype.js apply` returns, the AI MUST NOT re-read these (the CLI envelope captured them): `.cwos-onboarding.yaml`, `kit/data/archetypes.yaml`, `kit/data/stages.yaml`, `kit/scripts/lib/tier-mapper.js`, `kit/scripts/cwos-adopt-archetype.js`. The apply output's `diff_summary` + `archived_*` arrays + new bundle are the canonical record.

## Shadow-event envelope

`node kit/scripts/cwos-event.js append command_completed --track T6:workstream-archetype --tag /archetype --payload '{"command":"/archetype","subcommand":"<sub>"}'` — non-fatal; never gate output on it.
