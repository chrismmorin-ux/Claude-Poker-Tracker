# Generate Token Efficiency Report

Run the efficiency learning engine and generate an audit report:

1. Run `bash scripts/efficiency-learner.sh` to analyze session history and update rules
2. Run `bash scripts/generate-efficiency-report.sh` to create the audit report
3. Display key findings to the user

The report will be saved to `.claude/reports/efficiency-audit-<timestamp>.md`

After generating, summarize:
- Executive metrics (success rate, avg tokens, trend)
- Any HIGH priority recommendations
- Key insights from pattern analysis
