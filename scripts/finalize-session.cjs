#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

const projectRoot = path.join(__dirname, '..');
const statsFile = path.join(os.homedir(), '.claude', 'stats-cache.json');
const metricsDir = path.join(projectRoot, '.claude', 'metrics');
const dataDir = path.join(projectRoot, '.claude', 'data');
const historyFile = path.join(dataDir, 'token-history.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Get today's date
const today = new Date().toISOString().split('T')[0];
const sessionFile = path.join(metricsDir, `session-${today}.json`);

function main() {
  try {
    // Read stats from Claude
    let stats = { totalInputTokens: 0, totalOutputTokens: 0 };
    if (fs.existsSync(statsFile)) {
      const statsData = JSON.parse(fs.readFileSync(statsFile, 'utf-8'));
      stats.totalInputTokens = statsData.totalInputTokens || 0;
      stats.totalOutputTokens = statsData.totalOutputTokens || 0;
    }

    // Read session metrics
    if (!fs.existsSync(sessionFile)) {
      console.log('No session metrics file found for today');
      return;
    }

    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    const sessions = sessionData.sessions || [];

    if (sessions.length === 0) {
      console.log('No sessions recorded today');
      return;
    }

    // Use the most recent session
    const lastSession = sessions[sessions.length - 1];
    const estimatedTokens = lastSession.estimatedTokens || 0;
    const actualTotal = stats.totalInputTokens + stats.totalOutputTokens;

    // Calculate accuracy
    const accuracy =
      actualTotal > 0 ? ((estimatedTokens / actualTotal) * 100).toFixed(1) : 0;

    // Prepare finalized session entry
    const finalizedSession = {
      date: today,
      sessionId: lastSession.sessionId,
      actualInput: stats.totalInputTokens,
      actualOutput: stats.totalOutputTokens,
      actualTotal: actualTotal,
      estimatedTokens: estimatedTokens,
      accuracy: parseFloat(accuracy),
      toolBreakdown: lastSession.byTool || {},
      timestamp: new Date().toISOString(),
    };

    // Load or create history
    let history = [];
    if (fs.existsSync(historyFile)) {
      history = JSON.parse(fs.readFileSync(historyFile, 'utf-8'));
    }

    // Calculate delta from previous session
    if (history.length > 0) {
      const prevSession = history[history.length - 1];
      finalizedSession.deltaFromPrevious = {
        actualTokens: actualTotal - (prevSession.actualTotal || 0),
        estimatedTokens: estimatedTokens - (prevSession.estimatedTokens || 0),
      };
    }

    // Append to history
    history.push(finalizedSession);

    // Write updated history
    fs.writeFileSync(
      historyFile,
      JSON.stringify(history, null, 2),
      'utf-8'
    );

    // Output summary
    console.log('\n=== Session Finalization Summary ===');
    console.log(`Date: ${today}`);
    console.log(`Session ID: ${lastSession.sessionId}`);
    console.log(`Actual tokens used: ${actualTotal} (input: ${stats.totalInputTokens}, output: ${stats.totalOutputTokens})`);
    console.log(`Estimated tokens: ${estimatedTokens}`);
    console.log(`Accuracy: ${accuracy}%`);

    if (finalizedSession.deltaFromPrevious) {
      const delta = finalizedSession.deltaFromPrevious;
      console.log(`\nDelta from previous session:`);
      console.log(`  Actual: ${delta.actualTokens > 0 ? '+' : ''}${delta.actualTokens}`);
      console.log(`  Estimated: ${delta.estimatedTokens > 0 ? '+' : ''}${delta.estimatedTokens}`);
    }

    console.log(`\nHistory saved to: ${historyFile}`);
  } catch (error) {
    console.error('Error finalizing session:', error.message);
    process.exit(1);
  }
}

main();
