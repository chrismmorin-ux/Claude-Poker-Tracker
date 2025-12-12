/**
 * Tests for dispatcher.cjs
 *
 * Run with: npx vitest run scripts/__tests__/dispatcher.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const DISPATCHER_PATH = path.join(process.cwd(), 'scripts', 'dispatcher.cjs');

// Helper to run dispatcher command
function runDispatcher(command, input = '') {
  try {
    const result = execSync(`node ${DISPATCHER_PATH} ${command}`, {
      input,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { stdout: result, exitCode: 0 };
  } catch (e) {
    return { stdout: e.stdout || '', stderr: e.stderr || '', exitCode: e.status };
  }
}

// Helper to create valid task
function validTask(overrides = {}) {
  return {
    id: 'T-TEST-001',
    title: 'Test task',
    description: 'A test task for validation',
    files_touched: ['src/test.js'],
    est_lines_changed: 50,
    test_command: 'echo "test passed"',
    assigned_to: 'local:deepseek',
    priority: 'P1',
    status: 'open',
    ...overrides
  };
}

describe('dispatcher.cjs', () => {
  let originalBacklog;

  beforeEach(() => {
    // Backup original backlog
    if (fs.existsSync(BACKLOG_PATH)) {
      originalBacklog = fs.readFileSync(BACKLOG_PATH, 'utf8');
    }
  });

  afterEach(() => {
    // Restore original backlog
    if (originalBacklog) {
      fs.writeFileSync(BACKLOG_PATH, originalBacklog);
    }
  });

  describe('status command', () => {
    it('should show backlog status', () => {
      const { stdout, exitCode } = runDispatcher('status');
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Backlog Status');
    });
  });

  describe('add-tasks command', () => {
    it('should add valid task', () => {
      const task = validTask({ id: 'T-ADD-001' });
      const input = `///LOCAL_TASKS\n${JSON.stringify([task])}`;
      const { stdout, exitCode } = runDispatcher('add-tasks', input);

      expect(exitCode).toBe(0);
      expect(stdout).toContain('Added: T-ADD-001');
    });

    it('should block task with too many files', () => {
      const task = validTask({
        id: 'T-BLOCK-001',
        files_touched: ['a.js', 'b.js', 'c.js', 'd.js', 'e.js'] // > 3
      });
      const input = JSON.stringify([task]);
      const { exitCode, stderr } = runDispatcher('add-tasks', input);

      expect(exitCode).toBe(2);
    });

    it('should block task exceeding line limit', () => {
      const task = validTask({
        id: 'T-BLOCK-002',
        est_lines_changed: 500 // > 300
      });
      const input = JSON.stringify([task]);
      const { exitCode } = runDispatcher('add-tasks', input);

      expect(exitCode).toBe(2);
    });

    it('should block task without test_command', () => {
      const task = validTask({ id: 'T-BLOCK-003' });
      delete task.test_command;
      const input = JSON.stringify([task]);
      const { exitCode } = runDispatcher('add-tasks', input);

      expect(exitCode).toBe(2);
    });
  });

  describe('audit command', () => {
    it('should validate existing tasks', () => {
      const { stdout, exitCode } = runDispatcher('audit');
      expect(stdout).toContain('Atomic Criteria Audit');
    });
  });
});
