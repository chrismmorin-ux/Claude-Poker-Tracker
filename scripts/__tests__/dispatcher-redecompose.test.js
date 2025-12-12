/**
 * Tests for dispatcher.cjs recursive decomposition
 *
 * Tests:
 * 1. redecompose increments decomposition_depth
 * 2. redecompose tracks decomposition_history
 * 3. max depth blocking (depth > 3)
 * 4. automatic redecomposition on test failure
 * 5. failure_count tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const BACKLOG_PATH = path.join(process.cwd(), '.claude', 'backlog.json');
const BACKLOG_BACKUP = BACKLOG_PATH + '.backup';

describe('Dispatcher Recursive Decomposition', () => {
  beforeEach(() => {
    // Backup existing backlog
    if (fs.existsSync(BACKLOG_PATH)) {
      fs.copyFileSync(BACKLOG_PATH, BACKLOG_BACKUP);
    }

    // Create test backlog
    const testBacklog = {
      version: '1.0.0',
      updated_at: new Date().toISOString(),
      tasks: [],
      projects: {},
      stats: { total_tasks: 0, open: 0, in_progress: 0, done: 0, failed: 0 }
    };
    fs.writeFileSync(BACKLOG_PATH, JSON.stringify(testBacklog, null, 2));
  });

  afterEach(() => {
    // Restore backlog
    if (fs.existsSync(BACKLOG_BACKUP)) {
      fs.copyFileSync(BACKLOG_BACKUP, BACKLOG_PATH);
      fs.unlinkSync(BACKLOG_BACKUP);
    } else {
      if (fs.existsSync(BACKLOG_PATH)) {
        fs.unlinkSync(BACKLOG_PATH);
      }
    }
  });

  describe('Decomposition Depth Tracking', () => {
    it('should initialize decomposition_depth to 1 on first redecompose', () => {
      // Add a task
      const task = {
        id: 'T-TEST-001',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'open'
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Redecompose
      execSync('node scripts/dispatcher.cjs redecompose T-TEST-001', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Check depth
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-001');

      expect(updatedTask.decomposition_depth).toBe(1);
      expect(updatedTask.status).toBe('blocked');
      expect(updatedTask.needs_redecomposition).toBe(true);
    });

    it('should increment decomposition_depth on each redecompose', () => {
      // Add a task with existing depth
      const task = {
        id: 'T-TEST-002',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'open',
        decomposition_depth: 1
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Redecompose
      execSync('node scripts/dispatcher.cjs redecompose T-TEST-002', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Check depth incremented
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-002');

      expect(updatedTask.decomposition_depth).toBe(2);
    });

    it('should track decomposition_history', () => {
      // Add a task
      const task = {
        id: 'T-TEST-003',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'open'
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Redecompose
      execSync('node scripts/dispatcher.cjs redecompose T-TEST-003', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Check history
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-003');

      expect(updatedTask.decomposition_history).toBeDefined();
      expect(updatedTask.decomposition_history.length).toBe(1);
      expect(updatedTask.decomposition_history[0].depth).toBe(1);
      expect(updatedTask.decomposition_history[0].reason).toBe('Manual request');
      expect(updatedTask.decomposition_history[0].timestamp).toBeDefined();
    });
  });

  describe('Max Depth Blocking', () => {
    it('should block redecomposition when depth exceeds max (3)', () => {
      // Add a task at depth 3
      const task = {
        id: 'T-TEST-004',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'open',
        decomposition_depth: 3
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Try to redecompose (should fail with exit code 3)
      let exitCode;
      try {
        execSync('node scripts/dispatcher.cjs redecompose T-TEST-004', {
          stdio: 'pipe',
          encoding: 'utf-8'
        });
        exitCode = 0;
      } catch (error) {
        exitCode = error.status;
      }

      expect(exitCode).toBe(3); // Exit code 3 = max depth exceeded

      // Check task marked as blocked with requires_permission
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-004');

      expect(updatedTask.status).toBe('blocked');
      expect(updatedTask.requires_permission).toBe(true);
      expect(updatedTask.blocked_reason).toContain('Max decomposition depth exceeded');
    });
  });

  describe('Automatic Redecomposition on Failure', () => {
    it('should automatically redecompose when task fails tests', () => {
      // Add a task
      const task = {
        id: 'T-TEST-005',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'in_progress'
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Mark as failed (tests=failed triggers redecompose)
      execSync('node scripts/dispatcher.cjs complete T-TEST-005 --tests=failed', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Check automatic redecomposition triggered
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-005');

      expect(updatedTask.status).toBe('blocked');
      expect(updatedTask.needs_redecomposition).toBe(true);
      expect(updatedTask.decomposition_depth).toBe(1);
      expect(updatedTask.failure_count).toBe(1);
      expect(updatedTask.tests_passed).toBe(false);
    });

    it('should track failure_count across multiple failures', () => {
      // Add a task
      const task = {
        id: 'T-TEST-006',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'in_progress',
        failure_count: 1
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Fail again
      execSync('node scripts/dispatcher.cjs complete T-TEST-006 --tests=failed', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Check failure count incremented
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-006');

      expect(updatedTask.failure_count).toBe(2);
    });

    it('should include failure attempt in redecompose reason', () => {
      // Add a task
      const task = {
        id: 'T-TEST-007',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'in_progress'
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Fail
      execSync('node scripts/dispatcher.cjs complete T-TEST-007 --tests=failed', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Check reason includes attempt number
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-007');

      expect(updatedTask.redecompose_reason).toContain('Test failure (attempt 1)');
    });
  });

  describe('Successful Completion', () => {
    it('should mark task as done when tests pass', () => {
      // Add a task
      const task = {
        id: 'T-TEST-008',
        title: 'Test task',
        description: 'Test description',
        files_touched: ['test.js'],
        est_lines_changed: 50,
        test_command: 'npm test',
        assigned_to: 'local:deepseek',
        priority: 'P1',
        status: 'in_progress'
      };

      const backlog = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      backlog.tasks.push(task);
      fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));

      // Mark as passed
      execSync('node scripts/dispatcher.cjs complete T-TEST-008 --tests=passed', {
        stdio: 'pipe',
        encoding: 'utf-8'
      });

      // Check marked as done
      const updated = JSON.parse(fs.readFileSync(BACKLOG_PATH, 'utf-8'));
      const updatedTask = updated.tasks.find(t => t.id === 'T-TEST-008');

      expect(updatedTask.status).toBe('done');
      expect(updatedTask.tests_passed).toBe(true);
      expect(updatedTask.needs_redecomposition).toBeUndefined();
    });
  });
});
