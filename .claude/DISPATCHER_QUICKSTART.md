// Quickstart Guide for Dispatcher Workflows

// Adding tasks manually
// Example task: "Complete T-017 script"
dispatcher.addTask("T-017");

// Auto-executing project (use T-017 script)
// Run the T-017 script automatically
dispatcher.autoExecute("T-017");

// Checking status
// Check the current status of all tasks
dispatcher.checkStatus();

// Troubleshooting common errors
// Example error: "Task not found"
dispatcher.troubleshootError("Task not found");
