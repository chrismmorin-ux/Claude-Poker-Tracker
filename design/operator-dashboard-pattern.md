# Operator Dashboard Pattern (Stack-Agnostic)

Extracted from Police Accountability's six-dashboard operator surface (L4 on
prog-design operator rubric). Stack-agnostic — works with React, Astro, Django
templates, Streamlit, Observable, or anything else. Lifts prog-design operator
surface from L2 → L3 → L4.

## Core principle: decision-driven, not data-dumping

Every dashboard answers a specific **founder question** — not "here's some data
about X." If you can't name the decision the dashboard supports, don't build
it. Examples:

| Decision question | Dashboard |
|---|---|
| "Is churn accelerating?" | Cohort retention curve + MoM trend |
| "Which feature adoption signals product-market fit?" | Feature usage heatmap by cohort age |
| "Where is revenue leaking?" | Funnel with drop-off rates and dollar impact |
| "Which customer segments need attention this week?" | Health score ranking with recent-change flag |

## Dashboard elements (in priority order)

### 1. Headline number (always first)
One number that answers the primary question, with sign convention.
"Churn this month: 4.2% (↑ 0.8 vs. last month)" — not "Churn trend over time."

### 2. Trend or comparison (always second)
Against what? Last period? Baseline? Target? The number alone is noise; the
trend makes it signal.

### 3. Decomposition (third, optional)
If the headline is concerning, let the founder drill one level: "Churn by cohort
age" or "Churn by plan tier." Not five levels — one.

### 4. Last-refreshed timestamp (L3+ requirement)
**Data freshness must be visible.** "Last refreshed: 2h ago" prevents the
dashboard from silently serving stale data. Especially critical for data-platform
repos.

### 5. Source attribution (L3+ for data platforms)
Click any metric → see its source (table, query, file). Prevents the "where did
this number come from?" disease.

### 6. Suppression controls (L4)
"I acknowledge this, stop showing it" for alerts that have been triaged. Without
suppression, dashboards become ignored-by-default.

## Alert routing patterns

### Tier 1: Immediate (paging, SMS)
- Revenue impact >$X AND sustained >Y minutes
- Critical security events
- Product-breaking outage

### Tier 2: Daily digest
- Anomaly detection hits
- Trend-change warnings
- Threshold breaches that aren't urgent

### Tier 3: Weekly review
- Cohort behavior changes
- Feature adoption signals
- Benchmark comparisons

**Anti-pattern:** everything in Tier 1. Alert fatigue destroys the operator surface faster than no alerts at all.

## Notification surface patterns

The founder needs **at least one place they check routinely**. Pick one:

| Surface | Best for | Cost |
|---|---|---|
| Email digest | Weekly review, not urgent | Low — founder already checks email |
| In-app toast | Real-time during active session | Medium — requires in-app presence |
| Slack/SMS | True urgency, rare | Low-medium — risks noise |
| Shared dashboard URL | Collaborative review | Low — but requires founder discipline to check |

**Pick one, commit, iterate.** Three half-wired notification surfaces are worse
than one reliable one.

## Runbook coupling (L5)

The highest-maturity operator dashboards couple detected anomalies to response
playbooks:

```
ALERT: Detection signal "settlement_spike" fired
  Signal: Indiana municipal settlements up 340% MoM
  Source: indiana_gateway.settlements (fresh 2h ago)
  Evidence tier: corroborated (2 independent sources)

  Runbook:
    1. Verify anomaly via /runbook settlement-spike-triage
    2. If confirmed, file FOIA for detailed breakdowns
    3. Escalate to legal if >$500K exposure
```

Without the runbook link, the alert is just a notification. With it, the alert is actionable.

## Anti-patterns to avoid

- **Data dumps** — "Here are 47 metrics about your product." Delete 42 of them.
- **Comparisons without context** — "Revenue up 3%" — vs. what? Since when?
- **Mystery numbers** — numbers with no source, no definition, no refresh time.
- **Alert-everything** — if every condition triggers a notification, no conditions do.
- **Dashboards as design surfaces** — if your operator dashboard is also where you demo the product, it will fail at both.

## Minimum viable operator surface (L2 starter)

If you're bootstrapping, start here:
1. One dashboard answering one question (your #1 founder question)
2. Headline number + trend vs. last period
3. Last-refreshed timestamp
4. A single email digest (weekly) summarizing the metric

That's L2. Add dashboards one at a time as new founder questions earn them.
