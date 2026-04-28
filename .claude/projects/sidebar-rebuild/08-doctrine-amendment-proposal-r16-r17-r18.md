# Doctrine Amendment Proposal — R-1.6, R-1.7, R-1.8

**Date:** 2026-04-27
**Author:** Claude (main) — surfaced by SHC Gate 2 outside-lens pass
**Status:** APPROVED (Option II) — owner decision 2026-04-27. Doctrine v3 amendment landed.
**Targets:** `docs/SIDEBAR_DESIGN_PRINCIPLES.md` doctrine v3 (would create v3)
**Drives:** Gate 2 audit `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` finding E6
**Authority:** `docs/SIDEBAR_DESIGN_PRINCIPLES.md` §11 amendment process

---

## Why this proposal exists

The Sidebar Holistic Coherence Gate 2 outside-lens pass surfaced three concrete cross-zone divergences in the live extension code (collected as forensics class **D-1 / D-2 / D-3** below). Per the audit's E6 finding, two parallel paths can close them:

- **Path α — full shell spec** (Gate 4 deliverable). Carries positive vocabulary; takes a Gate 3 research cycle to author rigorously.
- **Path β — doctrine rule extension** (this proposal). Forbids the violation classes structurally; lower-ceremony; ships this session if approved.

The two paths are complements, not alternatives — Path α gives the user a vocabulary; Path β prevents that vocabulary from drifting once authored. The audit recommends both, in either order.

This proposal is Path β: three rules added to §1 of the doctrine, citing D-1 / D-2 / D-3 as forensics. Per §11, the proposal is non-binding until the owner approves.

---

## The forensics this proposal cites

Three new forensics entries, parallel to S1–S5 (SR-program symptoms) and M1–M8 (SR-program mechanisms). Naming convention `D-N` for "drift" since these are post-SR design-language drifts, not bug-class symptoms.

### D-1 — Confidence rendered three incompatible ways

The same data concept (model confidence: player-model / mixed / population) is rendered with three different visual treatments across two zones — and the divergence even exists *within* Z2.

| Location | Treatment | Code |
|---|---|---|
| Z2 unified header (`render-orchestrator.js:150–151, 169`) | Colored dot, class `green`/`yellow`/`red`, with tooltip | `confClass = mq?.overallSource === 'player_model' ? 'green' : mq?.overallSource === 'mixed' ? 'yellow' : 'red'; ... <span class="confidence-dot ${confClass}" title="${confLabel}"></span>` |
| Z2 context strip (`render-orchestrator.js:442–444, 450, 462, 465, 470`) | CSS opacity classes (`conf-player`, `conf-mixed`, `conf-population`) modulating data-value appearance | `confClass = confSource === 'player_model' ? 'conf-player' : confSource === 'mixed' ? 'conf-mixed' : 'conf-population'; ... <span class="cs-value ${confClass}">…` |
| Z4 / glance tier (`render-tiers.js:70–74`) | Colored dot + inline `n=` sample label | `confClass = mq?.overallSource === 'player_model' ? 'green' : mq?.overallSource === 'mixed' ? 'yellow' : 'red'; ... innerHTML = '<span class="confidence-dot ${confClass}"></span>' + nLabel-span` |

**Failure mode:** A user who learns "colored dot = confidence" from Z2 header or Z4 cannot transfer that learning to Z2 context strip — the opacity-class form is invisible to anyone scanning for "confidence" because it modulates the data value's brightness, with no legend. The dot-form Z2 header and Z4 use *the same* visual treatment but inconsistently nest sample-label inside vs. outside.

### D-2 — `#fbbf24` (yellow) encodes five distinct semantic roles in shared design tokens

`ignition-poker-tracker/shared/design-tokens.js`:

| Token | Line | Semantic role | Hex |
|---|---|---|---|
| `trust-marginal` | 31 | Confidence: marginal / mixed / judgment call | `#fbbf24` |
| `action-call-text` | 47 | Action category: CALL | `#fbbf24` |
| `priority-med-text` | 61 | Priority severity: medium | `#fbbf24` |
| `m-yellow` | 77 | M-ratio zone: moderate tournament danger | `#fbbf24` |
| `color-warning` | 94 | Generic semantic warning | `#fbbf24` |

In live code, three of these are observed actively conflicting:

- Z2 header confidence (`render-orchestrator.js:151`) uses `class="confidence-dot yellow"` for *mixed-confidence* (resolves to `trust-marginal`).
- Z0 connection-status (`side-panel.js:213`) uses `class="status-dot yellow"` for *disconnect* (resolves to `color-warning`).
- Z0 pipeline-health (`render-orchestrator.js:1326, 1339, 1341`) uses `class="status-dot yellow"` for *service-worker not responding / waiting for hands / unknown* (resolves to `color-warning`).
- Glance tier confidence (`render-tiers.js:71`) uses `class="confidence-dot yellow"` for *mixed-confidence*.

**Failure mode:** When the user simultaneously glances Z0 (connectivity OR pipeline-health amber) and Z2/Z4 (confidence amber), the same color signals two unrelated concepts. The user must read text or shape-class to disambiguate — which defeats H-N6 (recognition rather than recall) and adds re-decoding cost on every multi-zone glance.

### D-3 — Staleness rendered with two incompatible patterns and no shared parent

| Zone | Treatment | Code |
|---|---|---|
| Z0 pipeline health (`render-orchestrator.js:1324–1342`) | Colored dot (`status-dot yellow`/`green`/`red`) + status text. No aging counter. State derived from `pipeline.tableCount` + `handCount`. | `buildStatusBar(pipeline, handCount)` returns `{ dotClass, text }`. |
| Z2 stale advice (`side-panel.js:1068–1087`) | Text badge `.stale-badge` appended to `action-bar` with aging counter ("Stale 23s") or recomputing label. Threshold: 10s + street-mismatch. | `updateStaleAdviceBadge(isStale, ageMs, reason)` mutates DOM directly; refreshes per-second via `coordinator.scheduleTimer('adviceAgeBadge', …)` (`side-panel.js:1093–1094`). |

**Failure mode:** A user who learns "yellow dot = stale data" from Z0 will not recognize "Stale 23s" text badge in Z2 as the same concept-class. Two zones encode "data is stale" with disjoint visual languages and disjoint mechanisms (state-derived vs. timer-driven aging). The doctrine's R-4.* freshness contract specifies *that* every value carry freshness metadata; it does not specify *how* freshness is rendered consistently across zones.

---

## Proposed rules

### R-1.6 — Cross-zone treatment-type consistency

**Proposed text:**

> Within the sidebar, any data concept that is rendered in two or more zones (or two or more elements within a single zone) MUST use the **same visual treatment type** — exactly one of: colored dot, colored badge, opacity-modulated value, text label, icon. A concept rendered as `dot` in one location and `opacity-class` in another is a spec violation.
>
> *Prevents:* D-1 (confidence rendered as dot, opacity-class, and dot-with-label across Z2/Z4 without shared treatment-type).
> *Constrains:* Stage 4 specs must declare the treatment type for each cross-zone concept; cross-zone occurrences re-use the declared type.
> *Does NOT prescribe:* which colors, fonts, or sizes are used (per §10, those remain per-element-spec or shell-spec scope).

**Forensics citation:** D-1.
**§10 scope test:** This rule is structural (about which *type* of treatment is used), not visual (about *which colors / fonts / sizes*). Compatible with §10's exclusion of "colours, fonts, exact sizes" because it does not specify any of those — only that the *category* of treatment is consistent.

### R-1.7 — Token semantic isolation

**Proposed text:**

> A color token in `shared/design-tokens.js` MUST NOT serve more than one semantic concept. If two semantic concepts are intended to share a hex value (e.g., the visual rendering should be identical), they MUST be expressed as separate tokens whose names disclose the semantic role, with one token aliasing the other via design intent comment. Cross-token hex collisions found by static scan that lack such an alias declaration are a spec violation.
>
> *Prevents:* D-2 (`#fbbf24` simultaneously serving trust-marginal, action-call, priority-med, m-yellow, color-warning with no semantic disambiguation in token names — five concepts on one hex with no alias declaration).
> *Constrains:* Stage 6 lint adds a static scan: any tokens sharing a hex must either declare each other as aliases (via a structured comment) or have distinct hex values.
> *Does NOT prescribe:* what color any specific concept maps to. Owners may still choose `#fbbf24` for any concept; the rule only forbids *silent* hex-sharing across semantic roles.

**Forensics citation:** D-2.
**§10 scope test:** This rule is *adjacent* to §10's visual-design exclusion. Specifically: it does not specify which color any concept gets (which is per-element-spec / shell-spec scope), but it constrains the *naming and aliasing* of color tokens — which is a structural concern about token hygiene, not visual design. Argument for inclusion: cross-zone color collisions are precisely the failure mode §10 cannot catch from the per-element side, because each per-element spec is locally consistent; the conflict only emerges when two zones glance simultaneously.

**§10 scope-tension flag:** owner may reject this rule on §10 grounds. If rejected, the substantive concern (D-2) carries forward to the shell spec.

### R-1.8 — Staleness shape-class consistency

**Proposed text:**

> Every staleness or freshness signal across all zones MUST use a consistent shape-class — a member of the small fixed set declared in the doctrine's affordance vocabulary (currently empty, to be populated by SR-4 spec index per R-1.5). Until the vocabulary is authored, sidewalk-canonical shape-classes are: dot (state-derived freshness), badge (timer-driven aging), strip (zone-level health). A panel that introduces a fourth pattern is a spec violation.
>
> *Prevents:* D-3 (Z0 pipeline-health uses dot; Z2 stale advice uses text badge with aging counter; no shared parent class; user cannot transfer recognition).
> *Constrains:* Stage 4 specs must select one of the canonical shape-classes for any freshness signal. New shape-classes require a doctrine amendment.
> *Does NOT prescribe:* the colors of the dot, the typography of the badge, or the position within the zone.

**Forensics citation:** D-3.
**§10 scope test:** Structural (about *which shape-class* is used, drawn from a closed enumeration), not visual (about *colors / fonts / sizes*). Compatible with §10. Does require the SR-4 affordance vocabulary index to be authored to be fully enforceable; in the interim, the rule names three canonical classes inline.

---

## §10 — required amendment if all three rules ship

Current §10 text:

> **Visual design (colours, fonts, exact sizes)** — separate concern; handled in per-element specs and owner review of screen recordings (Stage 6 gate).

**Proposed clarification (additive, not replacing):**

> **Visual design (colours, fonts, exact sizes)** — separate concern; handled in per-element specs and the sidebar shell spec (when authored). Doctrine rules MAY constrain *cross-zone consistency invariants* (e.g., treatment-type consistency, token-naming hygiene, shape-class enumeration) without specifying which colors / fonts / sizes are used; such rules are in scope when they prevent failure modes that per-element specs cannot detect alone (i.e., conflicts only visible when multiple per-element specs are composed in a single sidebar).

This clarification distinguishes *per-element visual design* (out of scope, per-element spec territory) from *cross-zone consistency* (in scope, doctrine territory) — closing the ambiguity that R-1.7 surfaces.

---

## Three options for the owner

The proposal can be approved at three different scope levels:

### Option I — Approve all three rules + §10 clarification (most aggressive)

R-1.6, R-1.7, R-1.8 all added to §1 with §10 amended to permit cross-zone consistency invariants. Highest immediate forensics coverage: all three D-class drifts forbidden. Risk: §10 amendment opens a door for future scope creep (every visual-design decision could be reframed as "cross-zone consistency").

**Outside-lens recommendation.**

### Option II — Approve R-1.6 and R-1.8 only; defer R-1.7 to shell spec

R-1.7 is the rule with the §10 scope tension. Defer it to the shell spec (Gate 4); the shell spec can specify token-naming hygiene as a positive vocabulary contract. R-1.6 and R-1.8 are structural-only and slot into §1 without §10 amendment.

**Cleanest doctrine-fidelity option.** Loses immediate forensics coverage on D-2 (the yellow-collision finding), but D-2 is closable by the shell spec when it lands.

### Option III — Defer all three rules; let the shell spec carry the load

Approve nothing this session. Gate 3 → Gate 4 produces the shell spec; the shell spec carries positive vocabulary that makes the rules redundant (the rules forbid violations of vocabulary; the vocabulary makes the violations impossible by construction).

**Lowest-ceremony option.** Loses the "ship something this session" benefit; the audit's three concrete violations remain in code with no doctrine constraint until the shell spec lands.

### Decision required

Owner picks **I**, **II**, or **III**. Whatever is picked:

- File a `§11 Amendment log` entry as **v3 — 2026-04-27** with the chosen scope.
- Re-author affected per-zone surface artifacts (Z0, Z2, Z4) to reference the new rule(s) where applicable.
- Update `docs/design/audits/2026-04-27-blindspot-sidebar-holistic-coherence.md` E6 with the chosen path.

Anything not approved here flows to Gate 3 / Gate 4 of the SHC audit naturally — no information is lost.

---

## What this proposal is NOT

- Not a code-change PR — rules are spec-level constraints; remediation PRs follow once rules bind.
- Not a shell-spec replacement — even Option I is a complement to the shell spec, not a substitute for its positive vocabulary.
- Not a re-rebuild trigger — existing zones may continue to violate D-1 / D-2 / D-3 until remediation PRs land; the rules govern *new spec authorship and PR review*, not retroactive churn.

---

## Change log

- 2026-04-27 — Created. Awaits owner decision (Option I / II / III).
- 2026-04-27 — **Option II approved by owner.** Doctrine v3 amendment landed in `docs/SIDEBAR_DESIGN_PRINCIPLES.md`:
  - **R-1.6 (cross-zone treatment-type consistency)** — added as proposed, citing D-1.
  - **R-1.7 (staleness shape-class consistency)** — added, citing D-3. **Renumbered from proposed R-1.8** because the proposed R-1.7 (token-semantic isolation, D-2) was deferred and the doctrine convention is sequential numbering.
  - **R-1.7 as originally proposed (token-semantic isolation, D-2) — DEFERRED.** Substantive concern (yellow #fbbf24 across 5 semantic roles in `design-tokens.js` lines 31, 47, 61, 77, 94) routes to the SHC shell spec (Gate 4) as positive token-semantic vocabulary, not as a prescriptive doctrine rule. Reason: §10's exclusion of visual design (colours, fonts, exact sizes) was retained un-amended under Option II.
  - **§10 clarification proposed in this file — NOT adopted.** Doctrine retains its current scope exclusion of visual design.

  This file remains the authoritative record of the deferral path. If a future doctrine amendment round revisits the token-semantic isolation rule, this file is the prior-art reference.
