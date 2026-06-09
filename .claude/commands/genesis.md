---
name: genesis
description: "Scaffold CWOS into a brand-new empty repo in dormant mode (M0) — sibling to /adopt for empty repos"
user-invocable: true
argument-hint: "<path to empty repo or new directory>"
---

# /genesis — Scaffold CWOS in Dormant Mode

Sibling to `/adopt` for **brand-new repos**. Installs the kit in **dormant mode (M0)**: kit files in place, capture buffer active, but no programs activated, no queue, no nags. Founder contributes naturally (notes, files, conversations) until they're ready to declare intention via `/intend`. Then ignition runs and the repo wakes up.

If the target already has content (existing `.claude/`, source files, or a non-empty git history), this command refuses and points to `/adopt` instead.

## When to use

- New project, no code yet, want CWOS infrastructure ready before you start writing
- Founder hasn't yet decided archetype, stage, programs — wants those proposed *after* they've shaped some intention
- Want passive capture of early notes, file drops, and conversational decisions to seed the eventual ignition bundle

## When NOT to use

- Repo already has source files, dependencies, or a CLAUDE.md → run `/adopt` instead
- Repo is already CWOS-installed (`.cwos-version` exists) → run `/discover` or `/onboard-check`
- You want to declare intention and ignite immediately → still run `/genesis` first to scaffold; ignition is `/intend` (a separate, explicit step)

## Steps

### Step 1: Parse arguments

- `$ARGUMENTS` must include a path. If the path doesn't exist, the script will create it (this is intentional — `/genesis foo/bar` scaffolds a new directory).
- Optional `--system-dir` flag (default: `system`) — sets where system state files live. Mirrors `/adopt`'s flag.

### Step 2: Refuse on non-empty repos

The scaffold script enforces this — but as a fast-fail in conversation, before invoking it, list the target directory's contents. If any of these are present, refuse with the message in the next paragraph:

- `.claude/` directory (any contents)
- `.cwos-version` file
- Source files: `package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt`, `*.csproj`, `*.sln`, `manage.py`
- A non-empty `.git/` directory (HEAD points to a real commit, not just `git init`)
- `CLAUDE.md` already present

**Refusal message:**
```
This directory has existing content. /genesis is for empty repos only.

For repos with existing code, run: /adopt <path>
For repos already CWOS-installed, run: /onboard-check or /discover
```

If the target is truly empty (or doesn't exist yet), continue.

### Step 3: Invoke the scaffold script

Run via Bash:

```
node kit/scripts/cwos-genesis-scaffold.js --target-dir "<path>" [--system-dir <value>]
```

The script does all the work:
- `git init` (if `.git/` doesn't exist)
- Creates `.claude/`, `.claude/workstream/`, `.claude/workstream/events/`, `system/`
- Writes `system/intention.md` from `kit/templates/system/intention.md` (placeholder template)
- Writes `.cwos-onboarding.yaml` with `adoption_phase: M0` + `m0_dormant.entered_at: <now>`
- Writes `.cwos-version` with `adoption_phase: M0` and `genesis: true` markers
- Hardlinks the M0-relevant commands into `.claude/commands/`: `genesis`, `intend` (when shipped), `status`, `session-start`, `session-end`
- Registers in `fleet/registry.yaml` with `status: dormant`
- Initializes the capture buffer (`events/current.jsonl` with header event)
- Computes the placeholder hash of intention.md and stores in `m0_dormant.intention_content_hash`
- Sets the integrity flags (`kit_files_installed: true`, etc.)

The script outputs a YAML summary of what was created. Surface that to the founder.

### Step 4: Render confirmation

After the scaffold script returns:

```
## Dormant repo scaffolded at <path>

CWOS is installed in dormant mode. The infrastructure is in place but inert — no programs are active, the queue is closed, engines won't run. This is by design.

**Capture is active.** Anything you do here is logged to the capture buffer and will seed the ignition proposal:
- Drop notes in notes/ (will be captured)
- Write into system/intention.md (placeholder→content transition is detected)
- Just talk to me — session summaries are captured automatically

**When you're ready to ignite:**
1. Make sure system/intention.md has at least a paragraph in any section, OR drop at least one file in system/
2. Run /intend
3. I'll propose archetype, programs, invariants, and a first sprint based on what you captured
4. You approve, edit, or cancel — single decision, no Q&A interview

For now, just start working. /status will show "Dormant — kit installed, awaiting intention" and capture counts.
```

### Step 5: Shadow-event envelope

Append a `command_completed` event:

```
node kit/scripts/cwos-event.js append command_completed --track T0:envelope --tag /genesis --payload '{"command":"/genesis","target":"<path>","scaffold_result":"success"}'
```

Failure is non-fatal — do not gate command output on its success.

## Failure modes

- **Target has content** → refuse with the message in Step 2. No partial install.
- **Scaffold script fails partway through** → script attempts atomic rollback (deletes `.claude/`, `.cwos-version`, `system/intention.md` if it created them). If rollback fails, surface the error and tell the founder to manually delete the partial `.claude/` directory before retrying.
- **Hardlink creation fails** (e.g., target on a different filesystem from kit) → fall back to file copy with a warning; founder should run `/fleet-update` later to relink properly.
- **Fleet registry write fails** (e.g., permissions) → repo is still scaffolded locally; warn that fleet visibility is missing until the registry is fixed.

## Related

- `/adopt` — sibling for existing repos
- `/intend` — ignition trigger (separate, explicit step after dormant phase)
- `/status` — renders Dormant View when `adoption_phase: M0`
- WS-321 spec: `.claude/workstream/queue/WS-321.yaml`
- Direction memory: `project_genesis_flow.md`
