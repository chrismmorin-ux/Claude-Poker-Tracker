# Methodology — AI-Assisted UX Audit

How to run an audit using this framework. Works for any surface; designed to be executed by Claude in one session with owner review afterward.

---

## Principles

1. **LLM as structured thinking partner, not oracle.** Audits raise the floor on quality by being systematic; they do not replace owner judgement or real observation.
2. **Evidence-linked or not a finding.** Every claim cites a source in `evidence/LEDGER.md`. "This feels bad" is not evidence. "On 2026-04-16 owner reported X" is.
3. **Situation over demographic.** Findings are evaluated against situational sub-personas (mid-hand, between-hands, etc.), not a single persona. The same surface can pass for one situation and fail for another.
4. **JTBD outcome, not feature presence.** A surface that *has* a "clear player" button but buries it behind five taps *fails* the JTBD "seat swap in <3s" even though the feature is "implemented."
5. **Severity calibrated to situation.** A visual misalignment is severity 2 in post-session Chris and severity 4 in mid-hand Chris (where seconds matter). Severity is always declared against the worst applicable situation.
6. **Design for the cast, but weight by today's reality.** The persona roster spans 15 archetypes. Chris is the only currently-verified user. Other personas are design targets, not research conclusions — use them for coverage, but don't trade a confirmed Chris-frustration fix against a hypothetical Traveler need.
7. **Missing features are first-class findings.** If an audit surfaces a gap a persona would need, log it as a discovery (`discoveries/`), not a hope. Discoveries get prioritized and flow to BACKLOG.
8. **Tiering is expressive, not enforced.** The framework records what would go in which tier if tiers existed. The codebase remains feature-flat. Tier assignment is a *design hypothesis*, not a permissions system.

---

## The five audit steps

### Step 1 — Define scope

Pick one of:
- **Surface audit** — one screen/menu/panel. Fastest.
- **Journey audit** — a flow across multiple surfaces to complete a JTBD. Reveals handoff defects.
- **Situation audit** — all surfaces visited by one situational persona in a typical session. Rare; expensive. Reserve for post-incident forensics.

Create a new file in `audits/` with today's date and the scope: `audits/YYYY-MM-DD-<scope>.md`.

### Step 2 — Ground yourself in the artifacts

Before opening any code, read:
- Relevant personas (always: all core personas that could plausibly use the surface; situational sub-personas for the dominant contexts)
- Relevant JTBD entries across all applicable domains
- Relevant heuristic set(s) — Nielsen 10 always, domain and platform if applicable
- Existing surface artifacts for surfaces in scope (or note they don't exist yet)
- Relevant feature-inventory entry in `features/INVENTORY.md` — confirms what the surface is supposed to do and which tier / product line it belongs to
- Relevant tier(s) for the surface — does it cross tier boundaries?

If a surface artifact doesn't exist, **create it first** (in `surfaces/`) before auditing. You cannot audit what you haven't documented.

**Persona coverage rule.** When auditing a surface that could serve multiple personas, evaluate against the worst-case situation of each applicable persona — not just the primary. A picker may pass for the Multi-Tabler (sidebar-primary, cached nav) and fail for the Weekend Warrior (first use, cold search).

### Step 3 — Walk the surface(s)

For each surface in scope, execute the walkthrough:

1. **Read the code** — component file(s), state/context touched, props contract, data-testids.
2. **Render mentally or visually** — launch `npm run dev` if the change requires it; otherwise code-read is sufficient for structural issues.
3. **For each situational persona in scope**, walk through the JTBD the persona is trying to complete, step by step. Note friction, dead ends, ambiguity, destructive-action risk.
4. **For each heuristic**, check the surface against it. Nielsen 10 provides the baseline. Domain + platform heuristics catch the non-obvious.

Capture observations as they happen — even ones you can't explain yet.

### Step 4 — Formalize findings

Each finding has:
- **Title** — short imperative or problem statement.
- **Severity** — 0 (cosmetic) to 4 (blocks JTBD completion in primary situation). See `audits/_template.md`.
- **Situation(s) affected** — which situational personas hit this.
- **JTBD impact** — which JTBD fails, partially or fully, because of this.
- **Heuristic(s) violated** — by ID from the heuristic sets.
- **Evidence** — references into `evidence/LEDGER.md` by ID.
- **Recommended fix** — specific, scoped to the surface if possible; if the fix requires cross-surface changes, note so.
- **Effort rough estimate** — S / M / L.

A finding without evidence is a hypothesis — log it under "Open questions" in the audit, not "Findings." Sometimes an audit's most valuable output is a hypothesis to test, not a fix to ship.

**Missing-feature findings.** If the audit reveals that a persona's JTBD is not served because a feature doesn't exist (not because an existing feature is broken), capture as a *discovery* in `discoveries/YYYY-MM-DD-<name>.md` rather than a finding. Discoveries are logged with: persona(s) affected, JTBD served, proposed tier, effort estimate, priority score. Log the discovery in `discoveries/LOG.md`. The audit references the discovery ID; discoveries flow to BACKLOG.md through the normal prioritization pass.

### Step 5 — Deliver

The audit file closes with:
- **Executive summary** — 3–5 sentences.
- **Prioritized fix list** — findings sorted by severity × effort.
- **Backlog proposals** — one bullet per finding, ready to drop into `.claude/BACKLOG.md` if the owner approves.
- **Open questions** — unresolved hypotheses.

The audit file is immutable once the owner reviews. Follow-up audits create new files.

---

## Using AI during an audit

Claude is doing the audit. Some guardrails:

1. **Don't fabricate evidence.** If you don't have an observation, say so and log it as "assumption, unverified."
2. **Don't invent JTBD.** If a situation doesn't map to an existing JTBD in the atlas, add one — with a `Status: PROPOSED` tag and flag for owner review — rather than force-fit.
3. **Use sub-agents for independent second opinions.** For high-stakes audits, spawn `general-purpose` or `senior-engineer` agents with the surface artifact + persona context and compare findings.
4. **Prefer direct code reading over summaries.** Read the component file before claiming something about it.
5. **Separate observations from recommendations.** Steps 3 and 4 are distinct phases. Don't recommend fixes while still walking.

---

## Severity rubric (summary — full version in `audits/_template.md`)

| Severity | Definition |
|----------|------------|
| 0 | Cosmetic. No functional impact. Owner may prefer to skip. |
| 1 | Minor friction. JTBD completes but with avoidable effort. |
| 2 | Blocks a secondary situation. JTBD completes in primary situation but fails for a sub-persona. |
| 3 | Blocks JTBD completion in a secondary situation OR causes data loss / destructive actions in primary. |
| 4 | Blocks JTBD completion in primary situation OR causes silent data corruption OR unrecoverable error. |

Severity ≥3 findings are NEXT-tier backlog items. Severity 4 findings are P0.

---

## What a good audit looks like

- 3–10 findings. More than 15 usually means scope was too broad or findings not consolidated.
- Each finding fits on one screen.
- Evidence section for any severity ≥2 finding.
- At least one "observation without fix" — surfaces things worth thinking about that don't have an obvious remedy.
- Executive summary passes the "non-technical owner" test: a human who has not read the code should understand what's broken and why it matters.

---

## What a bad audit looks like

- Findings that are code-review comments in disguise ("refactor this to use a custom hook").
- Findings without severity.
- Findings justified by heuristics alone without situational impact ("violates Nielsen H5: error prevention" — *which JTBD breaks, and for whom?*).
- Fabricated user quotes.
- Recommendations that blow up scope without acknowledging it.

---

## Handoff

An audit hands off to implementation by being referenced in a backlog item. Implementation closes the loop by:
1. Updating the surface artifact with the change.
2. Adding a dated entry in `evidence/LEDGER.md` if the fix generates new evidence (e.g., "verified landscape scroll works on 900x400 viewport 2026-04-XX").
3. Referencing the audit + finding ID in the commit message.

The audit itself is never edited after closing.
