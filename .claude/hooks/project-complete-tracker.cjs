/**
 * project-complete-tracker.cjs
 *
 * Triggers automatic artifact generation when a project is completed.
 *
 * Runs after /project complete command to:
 * 1. Generate completion-summary.md
 * 2. Generate continuation-prompt.txt
 * 3. Generate lessons-learned.md template
 * 4. Generate metrics.json
 * 5. Run session-continuity-advisor.sh
 * 6. Display continuation prompt
 *
 * Hook Trigger: PostCommand
 * Command Pattern: /project complete
 */

module.exports = async function projectCompleteTracker(event, context) {
  const { command, args } = event;

  // Only trigger on /project complete
  if (!command || !command.includes('project') || !args || !args.includes('complete')) {
    return { allow: true };
  }

  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);
  const path = require('path');
  const fs = require('fs').promises;

  try {
    // Extract project ID from args
    // Expected: /project complete <project-id>
    const projectIdMatch = args.match(/complete\s+(\S+)/);
    if (!projectIdMatch) {
      // No project ID provided, let command handle error
      return { allow: true };
    }

    const projectId = projectIdMatch[1];
    const projectRoot = process.cwd();
    const projectFile = path.join(projectRoot, 'docs', 'projects', `${projectId}.project.md`);

    // Check if project file exists
    try {
      await fs.access(projectFile);
    } catch {
      // Project file doesn't exist, let command handle error
      return { allow: true };
    }

    // Create project artifacts directory
    const artifactsDir = path.join(projectRoot, 'docs', 'projects', projectId);
    await fs.mkdir(artifactsDir, { recursive: true });

    console.log('\n🔄 Generating project completion artifacts...\n');

    // 1. Generate completion summary
    try {
      const { stdout: summaryOutput } = await execAsync(
        `python scripts/generate-completion-summary.py "${projectFile}"`,
        { cwd: projectRoot }
      );
      await fs.writeFile(
        path.join(artifactsDir, 'completion-summary.md'),
        summaryOutput
      );
      console.log('✅ Generated completion-summary.md');
    } catch (error) {
      console.warn('⚠️  Failed to generate completion summary:', error.message);
    }

    // 2. Generate continuation prompt
    try {
      const { stdout: promptOutput } = await execAsync(
        `python scripts/generate-continuation-prompt.py "${projectFile}"`,
        { cwd: projectRoot }
      );
      await fs.writeFile(
        path.join(artifactsDir, 'continuation-prompt.txt'),
        promptOutput
      );
      console.log('✅ Generated continuation-prompt.txt');
    } catch (error) {
      console.warn('⚠️  Failed to generate continuation prompt:', error.message);
    }

    // 3. Generate lessons learned template
    try {
      const lessonsTemplate = `# Lessons Learned: Project ${projectId}

## What Went Well

[Fill in after reflection]

## What Could Be Improved

[Fill in after reflection]

## Recommendations for Similar Projects

[Fill in patterns to reuse]

## Metrics for Future Comparison

- Sessions per phase:
- Token usage per phase:
- Delegation success rate:
- Blocker resolution time:
`;
      await fs.writeFile(
        path.join(artifactsDir, 'lessons-learned.md'),
        lessonsTemplate
      );
      console.log('✅ Generated lessons-learned.md template');
    } catch (error) {
      console.warn('⚠️  Failed to generate lessons learned template:', error.message);
    }

    // 4. Generate metrics JSON
    try {
      const { stdout: metricsOutput } = await execAsync(
        `python scripts/extract-project-metrics.py "${projectFile}"`,
        { cwd: projectRoot }
      );
      await fs.writeFile(
        path.join(artifactsDir, 'metrics.json'),
        metricsOutput
      );
      console.log('✅ Generated metrics.json');
    } catch (error) {
      console.warn('⚠️  Failed to generate metrics:', error.message);
    }

    console.log(`\n📁 Completion artifacts saved to: docs/projects/${projectId}/\n`);

    // 5. Run session continuity advisor
    try {
      const { stdout: advisorOutput } = await execAsync(
        'bash scripts/session-continuity-advisor.sh',
        { cwd: projectRoot }
      );
      console.log(advisorOutput);
    } catch (error) {
      console.warn('⚠️  Failed to run session continuity advisor:', error.message);
    }

    // 6. Display continuation prompt
    try {
      const promptPath = path.join(artifactsDir, 'continuation-prompt.txt');
      const promptContent = await fs.readFile(promptPath, 'utf-8');

      console.log('\n📋 Continuation prompt for next session:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(promptContent);
      console.log('─────────────────────────────────────────────────────────────');
      console.log('\nCopy the above to resume this work in a new session.\n');
    } catch (error) {
      // Continuation prompt not available, that's okay
    }

    return {
      allow: true,
      message: '✅ Project completion artifacts generated successfully'
    };

  } catch (error) {
    console.error('Error in project-complete-tracker hook:', error);
    // Don't block the command even if hook fails
    return { allow: true };
  }
};
