#!/usr/bin/env python3
"""
Analyze subagent effectiveness (DeepSeek vs Qwen vs Claude)

Tracks:
- First-pass test success rates
- Average token usage per task
- Common failure patterns
- Task classification recommendations

Data sources:
- .claude/metrics/delegation.json (all delegated tasks)
- .claude/metrics/local-model-tasks.log (execution results)
- git log --grep="fix:" (errors after delegation)
"""

import json
import os
import re
import subprocess
from datetime import datetime, timedelta
from pathlib import Path
from collections import defaultdict

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
METRICS_DIR = PROJECT_ROOT / ".claude" / "metrics"
DELEGATION_FILE = METRICS_DIR / "delegation.json"
SUBAGENT_FILE = METRICS_DIR / "subagent-effectiveness.json"
TASK_LOG = METRICS_DIR / "local-model-tasks.log"


def load_delegation_data():
    """Load delegation history"""
    if not DELEGATION_FILE.exists():
        return {"tasks": []}

    with open(DELEGATION_FILE, "r") as f:
        return json.load(f)


def load_subagent_data():
    """Load existing subagent effectiveness data"""
    if not SUBAGENT_FILE.exists():
        return {
            "models": {
                "deepseek": {"tasksAttempted": 0, "tasksSucceeded": 0, "taskTypes": {}, "commonFailures": []},
                "qwen": {"tasksAttempted": 0, "tasksSucceeded": 0, "taskTypes": {}, "commonFailures": []},
                "claude": {"tasksAttempted": 0, "tasksSucceeded": 0, "taskTypes": {}, "commonFailures": []}
            }
        }

    with open(SUBAGENT_FILE, "r") as f:
        return json.load(f)


def parse_task_log():
    """Parse local model task execution log"""
    if not TASK_LOG.exists():
        return []

    tasks = []
    with open(TASK_LOG, "r") as f:
        for line in f:
            # Expected format: timestamp|model|taskType|status|tokens
            parts = line.strip().split("|")
            if len(parts) >= 5:
                tasks.append({
                    "timestamp": parts[0],
                    "model": parts[1],
                    "taskType": parts[2],
                    "status": parts[3],  # "success" or "failure"
                    "tokens": int(parts[4]) if parts[4].isdigit() else 0
                })

    return tasks


def get_fix_commits(days=30):
    """Get fix commits from git log"""
    try:
        since = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        result = subprocess.run(
            ["git", "log", "--since", since, "--grep", "fix:", "--oneline"],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT
        )
        return result.stdout.strip().split("\n") if result.stdout else []
    except Exception as e:
        print(f"Warning: Could not fetch git log: {e}")
        return []


def analyze_effectiveness():
    """Main analysis function"""
    delegation_data = load_delegation_data()
    subagent_data = load_subagent_data()
    task_log = parse_task_log()
    fix_commits = get_fix_commits()

    # Aggregate task data
    model_stats = defaultdict(lambda: {
        "attempted": 0,
        "succeeded": 0,
        "totalTokens": 0,
        "byTaskType": defaultdict(lambda: {"attempted": 0, "succeeded": 0})
    })

    for task in task_log:
        model = task["model"]
        task_type = task["taskType"]

        model_stats[model]["attempted"] += 1
        model_stats[model]["totalTokens"] += task["tokens"]
        model_stats[model]["byTaskType"][task_type]["attempted"] += 1

        if task["status"] == "success":
            model_stats[model]["succeeded"] += 1
            model_stats[model]["byTaskType"][task_type]["succeeded"] += 1

    # Calculate rates and update subagent data
    for model, stats in model_stats.items():
        if model not in subagent_data["models"]:
            subagent_data["models"][model] = {
                "tasksAttempted": 0,
                "tasksSucceeded": 0,
                "taskTypes": {},
                "commonFailures": []
            }

        attempted = stats["attempted"]
        succeeded = stats["succeeded"]

        subagent_data["models"][model]["tasksAttempted"] = attempted
        subagent_data["models"][model]["tasksSucceeded"] = succeeded
        subagent_data["models"][model]["firstPassRate"] = round(succeeded / attempted, 2) if attempted > 0 else 0.0
        subagent_data["models"][model]["avgTokensUsed"] = round(stats["totalTokens"] / attempted) if attempted > 0 else 0
        subagent_data["models"][model]["totalTokensUsed"] = stats["totalTokens"]

        # Task type breakdown
        for task_type, type_stats in stats["byTaskType"].items():
            type_attempted = type_stats["attempted"]
            type_succeeded = type_stats["succeeded"]

            subagent_data["models"][model]["taskTypes"][task_type] = {
                "attempted": type_attempted,
                "succeeded": type_succeeded,
                "firstPassRate": round(type_succeeded / type_attempted, 2) if type_attempted > 0 else 0.0
            }

    # Generate recommendations
    subagent_data["comparisonMetrics"] = generate_recommendations(subagent_data["models"])

    # Update timestamp
    subagent_data["lastUpdated"] = datetime.now().isoformat() + "Z"

    # Save updated data
    with open(SUBAGENT_FILE, "w") as f:
        json.dump(subagent_data, f, indent=2)

    return subagent_data


def generate_recommendations(models):
    """Generate comparison metrics and recommendations"""
    recommendations = {}

    # Find best model for each task type
    task_types = set()
    for model_data in models.values():
        task_types.update(model_data.get("taskTypes", {}).keys())

    for task_type in task_types:
        best_model = None
        best_rate = 0.0

        for model, model_data in models.items():
            if task_type in model_data.get("taskTypes", {}):
                rate = model_data["taskTypes"][task_type].get("firstPassRate", 0.0)
                if rate > best_rate:
                    best_rate = rate
                    best_model = model

        if best_model:
            recommendations[f"bestFor_{task_type}"] = best_model

    # Find most token-efficient model
    min_tokens = float("inf")
    most_efficient = None
    for model, model_data in models.items():
        avg_tokens = model_data.get("avgTokensUsed", float("inf"))
        if 0 < avg_tokens < min_tokens and model_data.get("tasksAttempted", 0) > 0:
            min_tokens = avg_tokens
            most_efficient = model

    recommendations["mostTokenEfficient"] = most_efficient or "insufficient_data"

    # Find highest overall quality
    best_quality = 0.0
    highest_quality = None
    for model, model_data in models.items():
        rate = model_data.get("firstPassRate", 0.0)
        if rate > best_quality and model_data.get("tasksAttempted", 0) > 5:  # Min 5 tasks for significance
            best_quality = rate
            highest_quality = model

    recommendations["highestQuality"] = highest_quality or "insufficient_data"

    return recommendations


def print_report(data):
    """Print formatted effectiveness report"""
    print("\n" + "="*70)
    print("SUBAGENT EFFECTIVENESS ANALYSIS")
    print("="*70)

    for model, model_data in data["models"].items():
        print(f"\n{model.upper()}:")
        print(f"  Tasks Attempted: {model_data.get('tasksAttempted', 0)}")
        print(f"  First-Pass Rate: {model_data.get('firstPassRate', 0.0)*100:.1f}%")
        print(f"  Avg Tokens: {model_data.get('avgTokensUsed', 0)}")

        if model_data.get("taskTypes"):
            print(f"  Task Type Breakdown:")
            for task_type, stats in model_data["taskTypes"].items():
                print(f"    {task_type}: {stats['firstPassRate']*100:.0f}% ({stats['succeeded']}/{stats['attempted']})")

        if model_data.get("recommendation"):
            print(f"  Recommendation: {model_data['recommendation']}")

    print(f"\n{'='*70}")
    print("COMPARISON METRICS:")
    print(f"{'='*70}")
    for key, value in data.get("comparisonMetrics", {}).items():
        print(f"  {key}: {value}")

    print(f"\nLast Updated: {data.get('lastUpdated', 'Unknown')}")
    print("="*70 + "\n")


if __name__ == "__main__":
    result = analyze_effectiveness()
    print_report(result)
