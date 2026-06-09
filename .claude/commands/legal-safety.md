---
name: legal-safety
description: "Legal and compliance safety review — privacy assessment, regulatory compliance, data protection, terms of service adherence, and intervention risk evaluation"
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: legal-safety` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Legal Safety Engine

Evaluate the project's legal and compliance posture. Identifies privacy violations, regulatory gaps, TOS breaches, and risky data practices. Includes intervention risk assessment for projects that take real-world actions.

## Focus Area

$ARGUMENTS (specific area like "data-collection", "privacy", or "full")

---

## PHASE 0 — GATHER CONTEXT

1. Read `CLAUDE.md` — project purpose, what data it handles, who it serves
2. Read `system/state.md` — data volumes, active features
3. Read `system/constraints.md` — legal constraints already identified
4. Read `system/decisions.md` — past legal/compliance decisions
5. Identify: what data is collected, from whom, stored where, shared with whom
6. Identify: what third-party services are used (APIs, data sources)
7. Check for: privacy policy, terms of service, consent mechanisms

---

## PHASE 1 — PRIVACY ASSESSMENT

### Data Inventory
For each type of data the system handles:
- What is it? (PII, financial, health, behavioral, public record)
- Where does it come from? (user input, API, scraping, public database)
- Where is it stored? (database, files, cache, logs, third-party)
- Who can access it? (roles, permissions, API keys)
- How long is it kept? (retention policy)
- Can it be deleted on request? (right to deletion)

### Privacy Compliance
- GDPR applicability (EU users? EU data subjects?)
- CCPA applicability (California users? Revenue thresholds?)
- Consent mechanisms: opt-in vs opt-out, granularity, withdrawal
- Privacy policy: exists? accurate? covers actual practices?
- Data Processing Agreements with third parties
- Cookie/tracking consent (if web application)

### Data Minimization
- Is only necessary data collected?
- Are there fields collected "just in case" with no current use?
- Are there data enrichment practices that expand scope beyond stated purpose?

---

## PHASE 2 — REGULATORY COMPLIANCE

Check applicable regulations based on project type:

### General (all projects)
- Terms of Service for all third-party APIs
- License compatibility of all dependencies
- Attribution requirements met
- Export control implications (if applicable)

### If handling personal data
- Data protection impact assessment needed?
- Data breach notification procedures defined?
- Cross-border transfer mechanisms (if applicable)

### If handling financial data
- PCI DSS applicability and compliance level
- Financial record retention requirements
- Anti-money laundering considerations (if applicable)

### If handling health data
- HIPAA applicability and compliance
- De-identification procedures

### If scraping or collecting public data
- CFAA compliance (no unauthorized access)
- robots.txt and Terms of Service respect
- Rate limiting and server impact
- Distinction between public records and private data

---

## PHASE 3 — LEGAL GUARDIAN REVIEW

Launch the **legal-guardian** persona as an agent to review:
- All Phase 1 and Phase 2 findings
- The data inventory map
- Any proposed interventions or high-risk features

The legal-guardian has VETO authority over actions that:
- Violate applicable law
- Create significant legal liability
- Involve unauthorized data access
- Process personal data without legal basis

---

## PHASE 4 — INTERVENTION RISK ASSESSMENT (if applicable)

For projects that take real-world actions (FOIA requests, audits, data collection, outreach):

### Risk Evaluation Framework
For each proposed intervention:
1. **Legal basis:** Clear legal right to take this action?
2. **Proportionality:** Action proportionate to the goal?
3. **Alternatives:** Lower-risk alternatives available?
4. **Documentation:** Action documented with rationale?
5. **Reversibility:** Can it be undone?

### Risk Classification
- **LOW RISK (1.0x multiplier):** Public data collection, FOIA requests, published analysis
- **MEDIUM RISK (1.5x multiplier):** In-person observation, interview requests, data sharing
- **HIGH RISK (2.0x multiplier):** Legal filings, public accusations, investigative actions
- **EXTREME RISK (3.0x multiplier):** Actions that could trigger legal retaliation

---

## PHASE 5 — FINDINGS & WORK ITEMS

Severity mapping:
| Finding | Severity |
|---------|----------|
| Active legal violation | CRITICAL |
| PII exposure or breach risk | CRITICAL |
| Missing required consent mechanism | HIGH |
| TOS violation with enforcement risk | HIGH |
| Missing privacy policy for data collection | HIGH |
| Regulatory gap (non-immediate risk) | MEDIUM |
| Data minimization opportunity | MEDIUM |
| Documentation gap | LOW |

---

## PHASE 6 — REPORT

```
## Legal Safety Review

### Overall Risk Level: LOW / MEDIUM / HIGH / CRITICAL

### Data Inventory
| Data Type | Source | Storage | Access | Retention | Deletable? |
|-----------|--------|---------|--------|-----------|------------|
| ... | ... | ... | ... | ... | ... |

### Compliance Status
| Regulation | Applicable? | Status | Gaps |
|-----------|------------|--------|------|
| GDPR | YES/NO/MAYBE | COMPLIANT/GAPS/N/A | ... |
| CCPA | YES/NO/MAYBE | ... | ... |
| PCI DSS | YES/NO/MAYBE | ... | ... |
| TOS (3rd party) | YES | ... | ... |

### Critical Issues
[anything requiring immediate action]

### Legal Guardian Vetoes (if any)
[actions vetoed with rationale and alternatives]

### Recommendations
1. [Highest priority legal/compliance action]
2. [Second priority]
3. [Third priority]
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
