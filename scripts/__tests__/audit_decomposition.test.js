/**
 * Tests for audit_decomposition.cjs
 *
 * Run with: npx vitest run scripts/__tests__/audit_decomposition.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const REPORT_PATH = path.join(process.cwd(), '.claude', 'audits', 'atomicity_report.json');
const AUDIT_PATH = path.join(process.cwd(), 'scripts', 'audit_decomposition.cjs');

// Helper to run audit command
function runAudit(args = '') {
  try {
    const result = execSync(`node ${AUDIT_PATH} ${args}`, {
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

// Helper to create backlog with tasks
function createBacklog(tasks) {
  const backlog = {
    version: '1.0.0',
    updated_at: new Date().toISOString(),
    tasks: tasks,
    projects: {},
    stats: { total_tasks: tasks.length, open: tasks.length, in_progress: 0, done: 0, failed: 0 }
  };
  fs.mkdirSync(path.dirname(BACKLOG_PATH), { recursive: true });
  fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));
}

describe('audit_decomposition.cjs', () => {
  let originalBacklog;
  let originalReport;

  beforeEach(() => {
    // Backup original files
    if (fs.existsSync(BACKLOG_PATH)) {
      originalBacklog = fs.readFileSync(BACKLOG_PATH, 'utf8');
    }
    if (fs.existsSync(REPORT_PATH)) {
      originalReport = fs.readFileSync(REPORT_PATH, 'utf8');
    }
  });

  afterEach(() => {
    // Restore original files
    if (originalBacklog) {
      fs.writeFileSync(BACKLOG_PATH, originalBacklog);
    } else if (fs.existsSync(BACKLOG_PATH)) {
      // If no original, we may have created one - check if it matches test data
      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf8'));
      if (backlog.tasks?.some(t => t.id?.startsWith('T-TEST-'))) {
        // Reset to empty backlog
        fs.writeFileSync(BACKLOG_PATH, JSON.stringify({
          version: '1.0.0',
          updated_at: new Date().toISOString(),
          tasks: [],
          projects: {},
          stats: { total_tasks: 0, open: 0, in_progress: 0, done: 0, failed: 0 }
        }, null, 2));
      }
    }

    if (originalReport) {
      fs.writeFileSync(REPORT_PATH, originalReport);
    }
  });

  describe('validateTask function', () => {
    it('should pass valid task', () => {
      createBacklog([validTask()]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(0);
      expect(stdout).toContain('Valid:           1');
    });

    it('should fail task with too many files_touched', () => {
      createBacklog([
        validTask({
          id: 'T-TOOMANY-001',
          files_touched: ['a.js', 'b.js', 'c.js', 'd.js'] // > 3
        })
      ]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(2);
      expect(stdout).toContain('files_touched');
    });

    it('should fail task with too many lines changed', () => {
      createBacklog([
        validTask({
          id: 'T-BIGLINES-001',
          est_lines_changed: 500 // > 300
        })
      ]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(2);
      expect(stdout).toContain('est_lines_changed');
    });

    it('should fail task with too much effort', () => {
      createBacklog([
        validTask({
          id: 'T-BIGEFFORT-001',
          est_local_effort_mins: 90 // > 60
        })
      ]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(2);
      expect(stdout).toContain('est_local_effort_mins');
    });

    it('should fail task without test_command', () => {
      const task = validTask({ id: 'T-NOTEST-001' });
      delete task.test_command;
      createBacklog([task]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(2);
      expect(stdout).toContain('test_command');
    });

    it('should fail task with invalid assigned_to', () => {
      createBacklog([
        validTask({
          id: 'T-BADASSIGN-001',
          assigned_to: 'invalid-model'
        })
      ]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(2);
      expect(stdout).toContain('assigned_to');
    });
  });

  describe('needs_context validation', () => {
    it('should pass valid needs_context', () => {
      createBacklog([
        validTask({
          id: 'T-CTX-001',
          needs_context: [
            { path: 'src/foo.js', lines_start: 10, lines_end: 50 }
          ]
        })
      ]);
      const { exitCode } = runAudit();
      expect(exitCode).toBe(0);
    });

    it('should fail needs_context without line ranges', () => {
      createBacklog([
        validTask({
          id: 'T-BADCTX-001',
          needs_context: [
            { path: 'src/foo.js' } // missing lines_start and lines_end
          ]
        })
      ]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(2);
      expect(stdout).toContain('needs_context');
    });
  });

  describe('report generation', () => {
    it('should generate atomicity_report.json', () => {
      createBacklog([validTask()]);
      runAudit();
      expect(fs.existsSync(REPORT_PATH)).toBe(true);

      const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
      expect(report.timestamp).toBeDefined();
      expect(report.summary.total).toBe(1);
      expect(report.summary.valid).toBe(1);
    });

    it('should include compliance percentage', () => {
      createBacklog([
        validTask({ id: 'T-V1-001' }),
        validTask({ id: 'T-V2-001' })
      ]);
      runAudit();

      const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
      expect(report.summary.compliance_percent).toBe(100);
    });
  });

  describe('empty backlog', () => {
    it('should handle empty backlog gracefully', () => {
      createBacklog([]);
      const { stdout, exitCode } = runAudit();
      expect(exitCode).toBe(0);
      expect(stdout).toContain('empty');
    });
  });
});
