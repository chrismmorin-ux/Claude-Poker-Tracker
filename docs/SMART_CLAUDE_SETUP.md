# Smart Claude Setup Guide

## What is Smart Claude?

Smart Claude is an intelligent wrapper that **automatically routes your tasks** to either local models (Qwen/DeepSeek) or Claude based on task complexity.

**Benefits:**
- ✅ Automatic decision-making (no need to think about which model to use)
- 💰 30-50% token savings on routine tasks
- 🚀 Continue working when you hit Claude usage limits
- 🎯 Optimal model selection for each task

---

## Quick Start

### 1. Create the Alias

Add this line to your bash configuration file:

**For Git Bash on Windows:**
```bash
# Open your bash config file
nano ~/.bashrc

# Add this line at the end:
alias cc='bash /c/Users/chris/OneDrive/Desktop/Claude-Poker-Tracker/scripts/smart-claude.sh'

# Save (Ctrl+O, Enter, Ctrl+X)

# Reload config
source ~/.bashrc
```

**For Mac/Linux:**
```bash
# Open your bash config file
nano ~/.bash_profile  # or ~/.zshrc if using zsh

# Add this line at the end:
alias cc='bash /path/to/your/project/scripts/smart-claude.sh'

# Save and reload
source ~/.bash_profile  # or source ~/.zshrc
```

### 2. Verify Setup

Test that the alias works:
```bash
cc
```

You should see the Smart Claude banner.

### 3. Usage

**Method 1: With arguments**
```bash
cc rename the variable mySeat to myPosition
```

**Method 2: Interactive mode**
```bash
cc
> rename the variable mySeat to myPosition
```

---

## How It Works

### Automatic Routing Logic

```
User enters task
    ↓
Task Classifier analyzes keywords & complexity
    ↓
    ├─→ LOCAL (high/medium confidence)
    │   ├─ Calls local model
    │   ├─ Shows result
    │   └─ Asks for feedback
    │
    ├─→ CLAUDE (high/medium confidence)
    │   └─ Launches Claude Code
    │
    └─→ UNSURE (low confidence)
        ├─ Presents both options
        └─ User chooses
```

### Confidence Levels

**HIGH (⭐⭐⭐)**: Auto-routes without asking
- Clear indicators (rename, debug, etc.)
- Unlikely to be wrong

**MEDIUM (⭐⭐)**: Auto-routes with notification
- Moderate confidence
- Usually correct

**LOW (⭐) / UNSURE (❓)**: Asks user to decide
- Ambiguous task
- Could go either way

---

## Examples

### Example 1: Simple Rename (Auto-routes to Local)
```bash
$ cc rename getSeatColor to calculateSeatColor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Smart Claude - Automatic AI Routing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Task Classification: local (high confidence)

📍 Routing to LOCAL MODEL
Model: qwen

[... local model response ...]

Was this result helpful? (y/n): y

✅ Great! You saved Claude tokens on this task.
```

### Example 2: Complex Debugging (Auto-routes to Claude)
```bash
$ cc debug why the app crashes when clicking showdown

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Smart Claude - Automatic AI Routing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Task Classification: claude (high confidence)

📍 Routing to CLAUDE
This task requires Claude's advanced capabilities

Launching Claude Code...
```

### Example 3: Uncertain Task (User Chooses)
```bash
$ cc improve the card selection logic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 Smart Claude - Automatic AI Routing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 Task Classification: unsure

⚠️  UNCERTAIN CLASSIFICATION

This task could work with either local models or Claude.

Options:
  1) Try LOCAL MODEL first (fast, saves tokens)
  2) Use CLAUDE (reliable, guaranteed quality)
  3) Cancel

Your choice (1/2/3): 1

[... proceeds with user's choice ...]
```

---

## Configuration

### Config File Location
`scripts/smart-claude-config.json`

### Available Options

```json
{
  "defaultModel": "qwen",           // Default local model
  "autoRoute": true,                // Enable automatic routing
  "askOnUncertain": true,           // Ask user when unsure
  "logRouting": true,               // Log all decisions
  "logFile": "~/.claude/routing-log.json",
  "preferences": {
    "preferLocal": false,           // Prefer local when unsure
    "alwaysAskFirst": false,        // Always ask before routing
    "showTokenSavings": true        // Show estimated savings
  }
}
```

### Customization

**Always ask before routing:**
```json
"preferences": {
  "alwaysAskFirst": true
}
```

**Prefer local models when uncertain:**
```json
"preferences": {
  "preferLocal": true
}
```

**Change default model to DeepSeek:**
```json
"defaultModel": "deepseek"
```

---

## Logging & Analytics

### Routing Log

All routing decisions are logged to `~/.claude/routing-log.json`

**View your routing history:**
```bash
cat ~/.claude/routing-log.json
```

**Analyze your usage:**
```bash
# Count how many tasks routed to local vs Claude
grep -o '"decision":"[^"]*"' ~/.claude/routing-log.json | sort | uniq -c
```

### Token Savings Estimate

**Per task:**
- Simple tasks: ~500-1000 tokens saved
- Medium tasks: ~1000-2000 tokens saved

**Monthly estimate** (assuming 20 local tasks/day):
- 20 tasks × 1000 tokens = 20,000 tokens/day
- ~600,000 tokens/month saved
- Equivalent to $6-12 in API costs

---

## Troubleshooting

### Problem: `cc: command not found`

**Solution:** The alias isn't set up correctly.
```bash
# Check if alias exists
alias cc

# If not, add it to your shell config
echo "alias cc='bash /c/Users/chris/OneDrive/Desktop/Claude-Poker-Tracker/scripts/smart-claude.sh'" >> ~/.bashrc

# Reload
source ~/.bashrc
```

### Problem: "LM Studio server is not responding"

**Solution:** Start LM Studio and load a model.
1. Open LM Studio
2. Load Qwen or DeepSeek
3. Start Server (Developer tab)

### Problem: Script routes incorrectly

**Solution:** Provide more specific task descriptions.
- ❌ Bad: "fix the code"
- ✅ Good: "rename the variable x to playerCount"

### Problem: Want to bypass automatic routing

**Solution:** Just use the original commands directly:
- For local: Use `/local`, `/local-refactor`, etc.
- For Claude: Use `claude-code` directly

---

## Advanced Usage

### Combining with Other Tools

**With Git:**
```bash
# Automatically route commit message generation
cc write a commit message for these changes
```

**With Project Context:**
```bash
# Route refactoring tasks
cc refactor the TableView component to use hooks
```

### Batch Processing

```bash
# Process multiple tasks
for task in "rename x to y" "add comments" "fix typo"; do
    cc "$task"
done
```

---

## Disabling Smart Claude

If you want to temporarily or permanently disable automatic routing:

### Temporary (one session)
```bash
# Just use claude-code directly
claude-code
```

### Permanent
```bash
# Remove the alias from your shell config
nano ~/.bashrc

# Delete or comment out the line:
# alias cc='...'

# Reload
source ~/.bashrc
```

---

## Best Practices

1. **Be Specific**: Clear task descriptions = better routing
   - ✅ "rename mySeat to myPosition in TableView.jsx"
   - ❌ "change the name"

2. **Trust the System**: The classifier is trained on hundreds of patterns
   - High confidence decisions are usually correct

3. **Provide Feedback**: When local model results aren't good, say "no"
   - This helps you understand when to use Claude

4. **Use Direct Commands When Needed**:
   - When you know which model you want, use `/local-*` commands
   - Smart Claude is for when you're unsure

5. **Review Log Periodically**: Check `~/.claude/routing-log.json`
   - Understand your usage patterns
   - Identify opportunities for optimization

---

## Comparison: Manual vs Smart Claude

### Manual Workflow (Phase 1 & 2)
```
1. Read task
2. Think: "Is this local or Claude?"
3. Type: `/route task description`
4. Read suggestion
5. Choose command
6. Type: `/local-refactor task description`
```

### Smart Claude Workflow (Phase 3)
```
1. Type: `cc task description`
2. Done! (automatic routing)
```

**Time saved per task:** ~30 seconds
**Mental effort:** Eliminated
**Convenience:** Maximum

---

## Support

**Issues?**
- Check `.claude/LOCAL_MODELS.md` for basic usage
- Review this guide for setup
- Fall back to direct `claude-code` if needed

**Want to customize routing logic?**
- Edit `scripts/task-classifier.sh` (classification rules)
- Edit `scripts/smart-claude.sh` (routing behavior)
- Edit `scripts/smart-claude-config.json` (preferences)

---

## Summary

Smart Claude gives you **automatic AI routing** with minimal setup:

1. ✅ Create alias (`alias cc='...'`)
2. ✅ Use it (`cc your task here`)
3. ✅ Save tokens automatically

**The system learns your patterns and makes intelligent decisions, so you can focus on coding instead of choosing models.**

Happy coding! 🚀
