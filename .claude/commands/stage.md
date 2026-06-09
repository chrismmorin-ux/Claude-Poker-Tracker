# /stage — declare stage, transition stage, view current

Drives the stage axis of the ADR-035 Archetype + Stage framework. Stage governs per-program tier defaults; transitioning stage cascades tier changes through the installed program set.

## Subcommands

- `/stage status` — show current declared stage + detected min stage; flag mismatch
- `/stage declare <S?>` — first-time stage capture or correction (no founder confirmation per program)
- `/stage re <S?>` — transition handler with per-program tier-change confirmation

Valid stage IDs: `S1` (Exploration) | `S2` (MVP iteration) | `S3` (Pre-launch hardening) | `S4` (Operating) | `S5` (Scaling/mature) | `N1` (Non-commercial exploration) | `N2` (Non-commercial active-use) | `N3` (Non-commercial stable-reference). See `kit/data/stages.yaml`.

---

## Step 1: Parse subcommand

```bash
node kit/scripts/cwos-stage.js --help   # if no subcommand given, show usage
```

If `<subcommand>` is `status` → Step 2. If `declare` → Step 3. If `re` → Step 4.

If `<subcommand>` is unrecognized: output the subcommand list above and stop.

## Step 2: `status`

```bash
node kit/scripts/cwos-stage.js resolve --archetype $(yq '.archetype' .cwos-onboarding.yaml) --stage $(yq '.stage' .cwos-onboarding.yaml)
node kit/scripts/cwos-stage-detect.js scan --target-dir .
```

Render to founder:

```
## Stage status

Declared:  S2 (MVP iteration)
Detected:  S2 (no upgrade signals fired)

Active programs (with starting tier):
  • prog-engineering — active
  • prog-design      — active

(Detected matches declared. No mismatch finding.)
```

If `cwos-stage-detect.js` reports `detected_min` higher than declared, replace the matching parenthetical with:

```
⚠ Stage mismatch detected. Signals fired: payment-processing (implies S3+).
   Run `/stage re S3` to escalate, or document the exception in
   system/context.md if the declaration is intentional.
```

## Step 3: `declare <S?>`

Validates the stage ID. Then:

```bash
node kit/scripts/cwos-stage.js apply --stage <S?> --target-dir .
```

The script:
- Patches `.cwos-onboarding.yaml`: `stage` + `declared_stage` set to the new value
- Computes tier-change list against prior stage (informational; no founder gate)
- Emits `stage_declared` event via `kit/scripts/cwos-event.js`

Render to founder:

```
✓ Stage declared: S3 (Pre-launch hardening).

Tier defaults updated. {N} programs changed:
  • prog-engineering    active → critical    (escalating)
  • prog-design         active → active      (staying)

Run `/pulse` to see how this affects program health.
```

If founder picks the same stage that's already declared: `Stage already S3. No change.` and exit.

## Step 4: `re <S?>`

Read current stage:

```bash
yq '.stage' .cwos-onboarding.yaml
```

Compute the change list (read-only diff):

```bash
node kit/scripts/cwos-stage.js re-tier --archetype $(yq '.archetype' .cwos-onboarding.yaml) \
  --from-stage <current> --to-stage <S?> --target-dir .
```

Render the per-program change table to founder:

```
## Re-stage from S2 → S3 (Pre-launch hardening)

| Program                 | From    | To       | Direction     |
|-------------------------|---------|----------|---------------|
| prog-engineering        | active  | critical | escalating    |
| prog-design             | active  | active   | staying       |

Confirm transition? (yes/no/customize)
```

**Founder responses:**
- `yes` — call `cwos-stage.js apply --stage <S?> --target-dir .` and emit `stage_transition` event.
- `no` — abort, no changes written.
- `customize` — for any escalating program the founder wants to opt out of, append to `.cwos-onboarding.yaml#archetype_overrides.tiers` block:
  ```yaml
  archetype_overrides:
    tiers:
      - program_id: prog-engineering
        override_tier: active
        reason: "founder pinned during S3 transition"
  ```
  Then run `cwos-stage.js apply --stage <S?> --target-dir .` (the override is honored automatically by `lib/tier-mapper.js`).

After apply, render the same confirmation as Step 3, plus:

```
Stage transition complete. Run `/audit` to baseline against the new tier
defaults if any program escalated to `critical`.
```

## Edge cases

| Situation | What to do |
|-----------|------------|
| Founder declares stage but archetype is `NONE` | Allow it (stage is meaningful even without an archetype). No tier-change list — there are no archetype-driven programs to re-tier. |
| `.cwos-onboarding.yaml` doesn't exist | "This repo isn't CWOS-adopted. Run `/adopt` first." |
| Stage ID invalid | List the valid IDs and stop. |
| `cwos-stage.js` not found | "cwos-stage.js not installed — run `/fleet-update` to install the CWOS CLI quartet (ADR-035 Phase 2 SPR-112)." |
| Founder picks a non-commercial stage (N?) but archetype is A1/A2/A3 | Warn: "Archetype A? typically uses commercial stages S1-S5. Confirm N? declaration?" — accept on confirm. |

## Prohibited reads

After `cwos-stage.js apply` returns, the AI MUST NOT re-read these (the CLI envelope captured them): `.cwos-onboarding.yaml`, `kit/data/stages.yaml`, `kit/data/archetypes.yaml`, `kit/scripts/lib/tier-mapper.js`. The apply output's `tier_changes` array carries everything needed for the founder-facing render.

## Shadow-event envelope

`node kit/scripts/cwos-event.js append command_completed --track T6:workstream-stage --tag /stage --payload '{"command":"/stage","subcommand":"<sub>"}'` — non-fatal; never gate output on it.
