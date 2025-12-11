#!/usr/bin/env python3
"""
Analyze slash command usage patterns

Tracks:
- Command invocation frequency
- Command recommendation adoption
- Chaining opportunities
- Confusion patterns

Data sources:
- .claude/metrics/command-usage.json (hook tracking)
- Session transcripts (if available)
"""

import json
import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict, Counter

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
METRICS_DIR = PROJECT_ROOT / ".claude" / "metrics"
COMMAND_USAGE_FILE = METRICS_DIR / "command-usage.json"


def load_command_data():
    """Load existing command usage data"""
    if not COMMAND_USAGE_FILE.exists():
        return {
            "commands": {},
            "insights": {},
            "recommendations": []
        }

    with open(COMMAND_USAGE_FILE, "r") as f:
        return json.load(f)


def analyze_usage_patterns(data):
    """Analyze command usage patterns"""
    commands = data.get("commands", {})

    # Find most/least used commands
    usage_counts = [(cmd, info.get("invocations", 0)) for cmd, info in commands.items()]
    usage_counts.sort(key=lambda x: x[1], reverse=True)

    most_used = [cmd for cmd, count in usage_counts[:5] if count > 0]
    least_used = [cmd for cmd, count in usage_counts if count == 0]

    # Find redundant commands (similar names, both low usage)
    redundant = find_redundant_commands(commands)

    # Find chaining opportunities (commands often used in sequence)
    chaining = find_chaining_opportunities(commands)

    # Update insights
    data["insights"] = {
        "mostUsedCommands": most_used,
        "leastUsedCommands": least_used,
        "redundantCommands": redundant,
        "chainingOpportunities": chaining,
        "confusionPatterns": []
    }

    return data


def find_redundant_commands(commands):
    """Identify potentially redundant commands"""
    redundant = []

    # Check for /local-* commands (multiple with low usage)
    local_commands = {
        cmd: info for cmd, info in commands.items()
        if cmd.startswith("/local-") and info.get("invocations", 0) < 5
    }

    if len(local_commands) >= 2:
        redundant.append({
            "commands": list(local_commands.keys()),
            "reason": "Multiple /local-* commands with low usage, consider consolidation",
            "suggestion": "Merge into /delegate-auto with auto-routing"
        })

    # Check for process-* commands
    process_commands = {
        cmd: info for cmd, info in commands.items()
        if cmd.startswith("/process-") and info.get("invocations", 0) < 3
    }

    if len(process_commands) >= 3:
        redundant.append({
            "commands": list(process_commands.keys()),
            "reason": "Multiple specialized process commands rarely used",
            "suggestion": "Consider consolidating related functions"
        })

    return redundant


def find_chaining_opportunities(commands):
    """Identify common command sequences"""
    # This would require session transcript analysis
    # For now, return known patterns based on workflow
    return [
        {
            "sequence": ["/project start", "/gen-tests", "/review"],
            "frequency": "unknown",
            "suggestion": "Consider /project-init-with-tests macro"
        },
        {
            "sequence": ["/local-code", "npm test", "/review"],
            "frequency": "unknown",
            "suggestion": "Already automated via execute-local-task.sh"
        }
    ]


def generate_recommendations(data):
    """Generate actionable recommendations"""
    recommendations = []
    commands = data.get("commands", {})
    insights = data.get("insights", {})

    # Recommendation: Deprecate unused commands
    least_used = insights.get("leastUsedCommands", [])
    if least_used:
        recommendations.append({
            "priority": "low",
            "category": "cleanup",
            "issue": f"{len(least_used)} commands never used in 30 days",
            "commands": least_used,
            "suggestion": "Review for deprecation or better promotion"
        })

    # Recommendation: Consolidate redundant commands
    redundant = insights.get("redundantCommands", [])
    for redundancy in redundant:
        recommendations.append({
            "priority": "medium",
            "category": "consolidation",
            "issue": redundancy["reason"],
            "commands": redundancy["commands"],
            "suggestion": redundancy["suggestion"]
        })

    # Recommendation: Improve /route adoption
    route_cmd = commands.get("/route", {})
    if route_cmd.get("recommendationsMade", 0) > 0:
        adoption = route_cmd.get("adoptionRate", 0.0)
        if adoption < 0.3:
            recommendations.append({
                "priority": "high",
                "category": "adoption",
                "issue": f"/route recommendations only followed {adoption*100:.0f}% of time",
                "suggestion": "Improve specificity of routing advice or reduce noise"
            })

    # Recommendation: Promote high-value underutilized commands
    for cmd, info in commands.items():
        invocations = info.get("invocations", 0)
        success_rate = info.get("avgSuccessRate", 0.0)

        if invocations < 5 and success_rate > 0.8:
            recommendations.append({
                "priority": "medium",
                "category": "promotion",
                "issue": f"{cmd} highly successful but rarely used",
                "suggestion": "Better documentation or automatic suggestions"
            })

    data["recommendations"] = recommendations
    return data


def update_command_usage(command, success=True):
    """Update usage stats for a command (called by hooks)"""
    data = load_command_data()

    if command not in data["commands"]:
        data["commands"][command] = {
            "invocations": 0,
            "lastUsed": None,
            "avgSuccessRate": 0.0
        }

    cmd_data = data["commands"][command]
    cmd_data["invocations"] = cmd_data.get("invocations", 0) + 1
    cmd_data["lastUsed"] = datetime.now().isoformat() + "Z"

    # Update success rate (simple moving average)
    current_rate = cmd_data.get("avgSuccessRate", 0.5)
    invocations = cmd_data["invocations"]
    new_rate = ((current_rate * (invocations - 1)) + (1.0 if success else 0.0)) / invocations
    cmd_data["avgSuccessRate"] = round(new_rate, 2)

    # Update tracking period
    if "trackingPeriod" not in data:
        data["trackingPeriod"] = {
            "start": datetime.now().isoformat() + "Z",
            "end": datetime.now().isoformat() + "Z",
            "days": 0
        }

    data["trackingPeriod"]["end"] = datetime.now().isoformat() + "Z"

    # Save
    with open(COMMAND_USAGE_FILE, "w") as f:
        json.dump(data, f, indent=2)


def analyze_command_usage():
    """Main analysis function"""
    data = load_command_data()
    data = analyze_usage_patterns(data)
    data = generate_recommendations(data)

    # Update timestamp
    data["lastUpdated"] = datetime.now().isoformat() + "Z"

    # Save
    with open(COMMAND_USAGE_FILE, "w") as f:
        json.dump(data, f, indent=2)

    return data


def print_report(data):
    """Print formatted command usage report"""
    print("\n" + "="*70)
    print("COMMAND USAGE ANALYSIS")
    print("="*70)

    insights = data.get("insights", {})

    print("\nMOST USED COMMANDS:")
    for cmd in insights.get("mostUsedCommands", [])[:10]:
        cmd_data = data["commands"].get(cmd, {})
        print(f"  {cmd}: {cmd_data.get('invocations', 0)} invocations")

    print("\nLEAST USED COMMANDS (Never Used):")
    unused = insights.get("leastUsedCommands", [])
    if unused:
        for cmd in unused[:10]:
            print(f"  {cmd}")
        if len(unused) > 10:
            print(f"  ... and {len(unused) - 10} more")
    else:
        print("  All commands have been used at least once")

    print("\nREDUNDANCY OPPORTUNITIES:")
    redundant = insights.get("redundantCommands", [])
    if redundant:
        for item in redundant:
            print(f"  Commands: {', '.join(item['commands'])}")
            print(f"  Reason: {item['reason']}")
            print(f"  Suggestion: {item['suggestion']}\n")
    else:
        print("  No obvious redundancy detected")

    print("\nRECOMMENDATIONS:")
    recommendations = data.get("recommendations", [])
    if recommendations:
        for i, rec in enumerate(recommendations[:5], 1):
            print(f"\n  {i}. [{rec['priority'].upper()}] {rec['category']}")
            print(f"     Issue: {rec['issue']}")
            print(f"     Suggestion: {rec['suggestion']}")
    else:
        print("  No recommendations at this time")

    print(f"\nLast Updated: {data.get('lastUpdated', 'Unknown')}")
    print("="*70 + "\n")


if __name__ == "__main__":
    result = analyze_command_usage()
    print_report(result)
