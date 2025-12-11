#!/usr/bin/env python3
"""
Calculate process maturity score (0-10 scale)

Dimensions (with weights):
1. Delegation Compliance (25%)
2. Error Recurrence Rate (20%)
3. Documentation Coverage (15%)
4. Test Coverage (15%)
5. Context Freshness (15%)
6. Hook Adoption Rate (10%)

Data sources:
- .claude/metrics/delegation.json
- git log (error analysis)
- docs/ files (documentation)
- test/ files (test coverage)
- .claude/context/ files (freshness)
- .claude/metrics/hook-activity.json
"""

import json
import os
import re
import subprocess
from datetime import datetime, timedelta
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
METRICS_DIR = PROJECT_ROOT / ".claude" / "metrics"
CONTEXT_DIR = PROJECT_ROOT / ".claude" / "context"
SRC_DIR = PROJECT_ROOT / "src"
TEST_DIR = PROJECT_ROOT / "tests"
DOCS_DIR = PROJECT_ROOT / "docs"


def get_delegation_compliance():
    """Calculate delegation compliance rate (25% weight)"""
    delegation_file = METRICS_DIR / "delegation.json"

    if not delegation_file.exists():
        return 0.0, "No delegation data available"

    with open(delegation_file, "r") as f:
        data = json.load(f)

    total_tasks = data.get("totalDelegableTasks", 0)
    delegated = data.get("tasksDelegated", 0)

    if total_tasks == 0:
        return 0.0, "No delegable tasks recorded"

    rate = delegated / total_tasks
    return rate, f"{delegated}/{total_tasks} tasks delegated ({rate*100:.0f}%)"


def get_error_recurrence_rate():
    """Calculate error recurrence rate (20% weight)"""
    try:
        # Get all commits with "fix:" in last 30 days
        since = (datetime.now() - timedelta(days=30)).strftime("%Y-%m-%d")
        result = subprocess.run(
            ["git", "log", "--since", since, "--grep", "fix:", "--name-only", "--format=%H|%s"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )

        if not result.stdout:
            return 0.0, "No fix commits in last 30 days"

        # Parse commits and files
        commits = result.stdout.strip().split("\n\n")
        file_fixes = {}

        for commit_block in commits:
            lines = commit_block.split("\n")
            if not lines:
                continue

            # First line is commit hash and message
            for file_line in lines[1:]:
                if file_line.strip():
                    file_fixes[file_line] = file_fixes.get(file_line, 0) + 1

        # Calculate recurrence (files fixed more than once)
        total_files = len(file_fixes)
        recurring = sum(1 for count in file_fixes.values() if count > 1)

        if total_files == 0:
            return 0.0, "No files fixed in last 30 days"

        recurrence_rate = recurring / total_files
        # Invert rate for scoring (lower recurrence = higher score)
        return 1.0 - recurrence_rate, f"{recurring}/{total_files} files had recurring errors ({recurrence_rate*100:.0f}%)"

    except Exception as e:
        return 0.0, f"Error analyzing git log: {e}"


def get_documentation_coverage():
    """Calculate documentation coverage (15% weight)"""
    try:
        # Count exported functions in src/
        src_files = list(SRC_DIR.rglob("*.js")) + list(SRC_DIR.rglob("*.jsx"))

        total_exports = 0
        documented_exports = 0

        for src_file in src_files:
            with open(src_file, "r", encoding="utf-8") as f:
                content = f.read()

            # Find exported functions/components
            exports = re.findall(r'export\s+(function|const|class)\s+(\w+)', content)
            total_exports += len(exports)

            # Check for JSDoc comments
            for export_type, export_name in exports:
                # Look for JSDoc comment above export
                pattern = rf'/\*\*[\s\S]*?\*/\s*export\s+{export_type}\s+{export_name}'
                if re.search(pattern, content):
                    documented_exports += 1

        if total_exports == 0:
            return 0.0, "No exported functions found"

        coverage = documented_exports / total_exports
        return coverage, f"{documented_exports}/{total_exports} exports documented ({coverage*100:.0f}%)"

    except Exception as e:
        return 0.0, f"Error analyzing documentation: {e}"


def get_test_coverage():
    """Calculate test coverage (15% weight)"""
    try:
        # Run npm test with coverage
        result = subprocess.run(
            ["npm", "test", "--", "--coverage", "--silent"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
            timeout=60
        )

        # Parse coverage from output (look for overall coverage %)
        coverage_match = re.search(r'All files\s*\|\s*([\d.]+)', result.stdout)

        if coverage_match:
            coverage = float(coverage_match.group(1)) / 100
            return coverage, f"Test coverage: {coverage*100:.1f}%"

        # Fallback: count test files vs source files
        test_files = list(TEST_DIR.rglob("*.test.js")) + list(TEST_DIR.rglob("*.test.jsx"))
        src_files = list(SRC_DIR.rglob("*.js")) + list(SRC_DIR.rglob("*.jsx"))

        if len(src_files) == 0:
            return 0.0, "No source files found"

        estimated_coverage = min(len(test_files) / len(src_files), 1.0)
        return estimated_coverage, f"Estimated coverage: {estimated_coverage*100:.0f}% ({len(test_files)} test files for {len(src_files)} source files)"

    except Exception as e:
        return 0.0, f"Error calculating test coverage: {e}"


def get_context_freshness():
    """Calculate context freshness (15% weight)"""
    try:
        context_files = list(CONTEXT_DIR.glob("*.md"))

        if not context_files:
            return 0.0, "No context files found"

        # Get last modified date for context files
        context_dates = []
        for ctx_file in context_files:
            result = subprocess.run(
                ["git", "log", "-1", "--format=%ct", str(ctx_file.relative_to(PROJECT_ROOT))],
                capture_output=True,
                text=True,
                cwd=PROJECT_ROOT
            )

            if result.stdout.strip():
                timestamp = int(result.stdout.strip())
                context_dates.append(datetime.fromtimestamp(timestamp))

        if not context_dates:
            return 0.0, "Could not determine context file dates"

        # Average age of context files
        now = datetime.now()
        avg_age_days = sum((now - dt).days for dt in context_dates) / len(context_dates)

        # Score based on age (fresher = higher score)
        if avg_age_days < 3:
            score = 1.0
        elif avg_age_days < 8:
            score = 0.8
        elif avg_age_days < 15:
            score = 0.6
        elif avg_age_days < 30:
            score = 0.4
        else:
            score = 0.2

        return score, f"Context files avg {avg_age_days:.0f} days old"

    except Exception as e:
        return 0.0, f"Error checking context freshness: {e}"


def get_hook_adoption_rate():
    """Calculate hook adoption rate (10% weight)"""
    hook_file = METRICS_DIR / "hook-activity.json"

    if not hook_file.exists():
        return 0.0, "No hook activity data available"

    with open(hook_file, "r") as f:
        data = json.load(f)

    total_advice = data.get("aggregateMetrics", {}).get("totalAdviceGiven", 0)
    total_followed = data.get("aggregateMetrics", {}).get("totalAdviceFollowed", 0)

    if total_advice == 0:
        return 0.0, "No hook advice given yet"

    rate = total_followed / total_advice
    return rate, f"{total_followed}/{total_advice} hook advice followed ({rate*100:.0f}%)"


def score_dimension(value, thresholds):
    """
    Convert dimension value to 0-10 score using thresholds

    thresholds: list of (max_value, score) tuples, in ascending order
    """
    for threshold, score in thresholds:
        if value <= threshold:
            return score

    return thresholds[-1][1]  # Return highest score if above all thresholds


def calculate_maturity():
    """Main calculation function"""
    dimensions = [
        {
            "name": "Delegation Compliance",
            "weight": 0.25,
            "getValue": get_delegation_compliance,
            "thresholds": [
                (0.20, 2), (0.40, 4), (0.60, 6), (0.80, 8), (1.00, 10)
            ]
        },
        {
            "name": "Error Recurrence",
            "weight": 0.20,
            "getValue": get_error_recurrence_rate,
            "thresholds": [
                (0.20, 2), (0.40, 4), (0.60, 6), (0.80, 8), (1.00, 10)
            ]
        },
        {
            "name": "Documentation Coverage",
            "weight": 0.15,
            "getValue": get_documentation_coverage,
            "thresholds": [
                (0.40, 2), (0.60, 4), (0.75, 6), (0.90, 8), (1.00, 10)
            ]
        },
        {
            "name": "Test Coverage",
            "weight": 0.15,
            "getValue": get_test_coverage,
            "thresholds": [
                (0.60, 2), (0.70, 4), (0.80, 6), (0.90, 8), (1.00, 10)
            ]
        },
        {
            "name": "Context Freshness",
            "weight": 0.15,
            "getValue": get_context_freshness,
            "thresholds": [
                (0.20, 2), (0.40, 4), (0.60, 6), (0.80, 8), (1.00, 10)
            ]
        },
        {
            "name": "Hook Adoption",
            "weight": 0.10,
            "getValue": get_hook_adoption_rate,
            "thresholds": [
                (0.20, 2), (0.40, 4), (0.60, 6), (0.80, 8), (1.00, 10)
            ]
        }
    ]

    results = []
    total_score = 0.0

    for dim in dimensions:
        value, detail = dim["getValue"]()
        score = score_dimension(value, dim["thresholds"])
        weighted_score = score * dim["weight"]
        total_score += weighted_score

        results.append({
            "dimension": dim["name"],
            "value": value,
            "score": score,
            "weight": dim["weight"],
            "detail": detail
        })

    # Determine trend (TODO: Compare to historical data)
    trend = "stable"  # Would need historical data for accurate trend

    return {
        "overallScore": round(total_score, 1),
        "trend": trend,
        "dimensions": results,
        "calculatedAt": datetime.now().isoformat() + "Z"
    }


def get_maturity_level(score):
    """Get maturity level description"""
    if score < 2.0:
        return "Critical", "Immediate intervention needed"
    elif score < 4.0:
        return "Poor", "Significant gaps, high risk"
    elif score < 6.0:
        return "Fair", "Basic processes in place"
    elif score < 8.0:
        return "Good", "Solid foundation, room to grow"
    else:
        return "Excellent", "Mature, optimized system"


def print_report(data):
    """Print formatted maturity report"""
    score = data["overallScore"]
    level, description = get_maturity_level(score)
    trend_symbol = {"improving": "↗️", "stable": "→", "declining": "↘️"}.get(data["trend"], "→")

    print("\n" + "="*70)
    print("PROCESS MATURITY SCORE")
    print("="*70)

    print(f"\nOverall Score: {score} / 10 ({level}) {trend_symbol} {data['trend'].title()}")
    print(f"Description: {description}\n")

    print("Dimension Breakdown:")
    print(f"{'Dimension':<30} {'Score':<8} {'Weight':<8} {'Detail'}")
    print("-" * 70)

    for dim in data["dimensions"]:
        print(f"{dim['dimension']:<30} {dim['score']}/10    {int(dim['weight']*100)}%      {dim['detail']}")

    print("\nCalculated At: " + data["calculatedAt"])
    print("="*70 + "\n")


if __name__ == "__main__":
    result = calculate_maturity()
    print_report(result)
