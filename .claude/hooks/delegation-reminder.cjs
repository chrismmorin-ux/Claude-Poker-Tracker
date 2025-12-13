// .claude/hooks/delegation-reminder.cjs
const fs = require('fs');
let toolUseCount = 0; // Track usage count in memory for this process only, not persistent across restarts or different processes
if (fs.existsSync('./.claude/tool_use_count')) {
    const data = fs.readFileSync('./.claude/tool_use_count', 'utf8');
    toolUseCount = parseInt(data, 10); // Read the count from a file if it exists and is not empty
}
const reminderThreshold = 10;

// PostToolUse hook function that increments usage counter and shows reminders when needed.
function postToolUse() {
    ++toolUseCount;
    fs.writeFileSync('./.claude/tool_use_count', toolUseCount.toString()); // Save the count to a file for persistence across restarts or different processes
    
    if (toolUseCount % reminderThreshold === 0) {
        console.log('Remember: All code tasks should be delegated to local models via dispatcher');
    }
}
module.exports = postToolUse; // Export the hook function so it can be used in other parts of your application or tooling setup if needed
