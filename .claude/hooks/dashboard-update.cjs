// Import necessary modules
const { exec } = require('child_process');

// Define the PostToolUse hook
module.exports = {
  type: 'PostToolUse',
  matchTool: 'Bash',
  matchPattern: /dispatcher\.cjs\s+complete/,
  run: async (context) => {
    try {
      // Run generate-dashboard.cjs silently
      await new Promise((resolve, reject) => {
        exec('node scripts/generate-dashboard.cjs', { detached: true }, (error, stdout, stderr) => {
          if (error) {
            console.error(`Error running generate-dashboard.cjs: ${error.message}`);
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      // Handle errors without blocking
      console.error(`Failed to regenerate dashboard: ${error.message}`);
    }
  }
};
