import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateCompliance,
  calculateAverageDepth,
  findMaxDepth,
  analyzePermissionRequests,
  calculateTestPassRate,
  generateWarnings,
  generateRecommendations,
  calculateHealthScore
} from '../decomposition-health.cjs';

describe('decomposition-health', () => {
  describe('calculateCompliance', () => {
    it('should return 100% compliance for empty task list', () => {
      const result = calculateCompliance([]);
      expect(result.rate).toBe(1.0);
      expect(result.violations).toEqual([]);
    });

    it('should return 100% compliance for all valid tasks', () => {
      const tasks = [
        {
          id: 'T-001',
          title: 'Valid task',
          files_touched: ['file1.js', 'file2.js'],
          est_lines_changed: 150,
          test_command: 'npm test',
          est_local_effort_mins: 30
        },
        {
          id: 'T-002',
          title: 'Another valid task',
          files_touched: ['file3.js'],
          est_lines_changed: 50,
          test_command: 'npm test file3',
          est_local_effort_mins: 15
        }
      ];

      const result = calculateCompliance(tasks);
      expect(result.rate).toBe(1.0);
      expect(result.violations).toEqual([]);
    });

    it('should detect files_touched violations', () => {
      const tasks = [
        {
          id: 'T-001',
          title: 'Too many files',
          files_touched: ['f1.js', 'f2.js', 'f3.js', 'f4.js'],
          est_lines_changed: 100,
          test_command: 'npm test',
          est_local_effort_mins: 30
        }
      ];

      const result = calculateCompliance(tasks);
      expect(result.rate).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].task_id).toBe('T-001');
      expect(result.violations[0].issues).toContain('files_touched: 4 > 3');
    });

    it('should detect est_lines_changed violations', () => {
      const tasks = [
        {
          id: 'T-001',
          title: 'Too many lines',
          files_touched: ['file.js'],
          est_lines_changed: 350,
          test_command: 'npm test',
          est_local_effort_mins: 30
        }
      ];

      const result = calculateCompliance(tasks);
      expect(result.rate).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issues).toContain('est_lines_changed: 350 > 300');
    });

    it('should detect missing test_command', () => {
      const tasks = [
        {
          id: 'T-001',
          title: 'No test',
          files_touched: ['file.js'],
          est_lines_changed: 100,
          test_command: '',
          est_local_effort_mins: 30
        }
      ];

      const result = calculateCompliance(tasks);
      expect(result.rate).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issues).toContain('missing test_command');
    });

    it('should detect est_local_effort_mins violations', () => {
      const tasks = [
        {
          id: 'T-001',
          title: 'Too much effort',
          files_touched: ['file.js'],
          est_lines_changed: 100,
          test_command: 'npm test',
          est_local_effort_mins: 90
        }
      ];

      const result = calculateCompliance(tasks);
      expect(result.rate).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issues).toContain('est_local_effort_mins: 90 > 60');
    });

    it('should detect multiple violations in one task', () => {
      const tasks = [
        {
          id: 'T-001',
          title: 'Multiple violations',
          files_touched: ['f1.js', 'f2.js', 'f3.js', 'f4.js'],
          est_lines_changed: 400,
          test_command: '',
          est_local_effort_mins: 90
        }
      ];

      const result = calculateCompliance(tasks);
      expect(result.rate).toBe(0);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].issues).toHaveLength(4);
    });

    it('should calculate correct compliance rate with mixed tasks', () => {
      const tasks = [
        {
          id: 'T-001',
          title: 'Valid',
          files_touched: ['f1.js'],
          est_lines_changed: 100,
          test_command: 'npm test',
          est_local_effort_mins: 30
        },
        {
          id: 'T-002',
          title: 'Invalid',
          files_touched: ['f1.js', 'f2.js', 'f3.js', 'f4.js'],
          est_lines_changed: 100,
          test_command: 'npm test',
          est_local_effort_mins: 30
        }
      ];

      const result = calculateCompliance(tasks);
      expect(result.rate).toBe(0.5); // 1 out of 2
      expect(result.violations).toHaveLength(1);
    });
  });

  describe('calculateAverageDepth', () => {
    it('should return 0 for tasks without decomposition history', () => {
      const tasks = [
        { id: 'T-001', decomposition_history: [] },
        { id: 'T-002' }
      ];

      const result = calculateAverageDepth(tasks);
      expect(result).toBe(0);
    });

    it('should calculate correct average depth', () => {
      const tasks = [
        {
          id: 'T-001',
          decomposition_history: [
            { depth: 1, timestamp: '2025-12-12T10:00:00Z' },
            { depth: 2, timestamp: '2025-12-12T11:00:00Z' }
          ]
        },
        {
          id: 'T-002',
          decomposition_history: [
            { depth: 1, timestamp: '2025-12-12T12:00:00Z' }
          ]
        }
      ];

      const result = calculateAverageDepth(tasks);
      expect(result).toBe(1.5); // (2 + 1) / 2
    });

    it('should use max depth per task', () => {
      const tasks = [
        {
          id: 'T-001',
          decomposition_history: [
            { depth: 1, timestamp: '2025-12-12T10:00:00Z' },
            { depth: 2, timestamp: '2025-12-12T11:00:00Z' },
            { depth: 3, timestamp: '2025-12-12T12:00:00Z' }
          ]
        }
      ];

      const result = calculateAverageDepth(tasks);
      expect(result).toBe(3); // Max depth is 3
    });
  });

  describe('findMaxDepth', () => {
    it('should return 0 for tasks without depth tracking', () => {
      const tasks = [
        { id: 'T-001' },
        { id: 'T-002', decomposition_history: [] }
      ];

      const result = findMaxDepth(tasks);
      expect(result).toBe(0);
    });

    it('should find max depth from decomposition_history', () => {
      const tasks = [
        {
          id: 'T-001',
          decomposition_history: [{ depth: 2 }]
        },
        {
          id: 'T-002',
          decomposition_history: [{ depth: 1 }, { depth: 3 }]
        }
      ];

      const result = findMaxDepth(tasks);
      expect(result).toBe(3);
    });

    it('should find max depth from decomposition_depth field', () => {
      const tasks = [
        { id: 'T-001', decomposition_depth: 2 },
        { id: 'T-002', decomposition_depth: 3 }
      ];

      const result = findMaxDepth(tasks);
      expect(result).toBe(3);
    });

    it('should handle both decomposition_history and decomposition_depth', () => {
      const tasks = [
        {
          id: 'T-001',
          decomposition_history: [{ depth: 2 }]
        },
        {
          id: 'T-002',
          decomposition_depth: 3
        }
      ];

      const result = findMaxDepth(tasks);
      expect(result).toBe(3);
    });
  });

  describe('analyzePermissionRequests', () => {
    it('should handle null permission requests', () => {
      const result = analyzePermissionRequests(null);
      expect(result).toEqual({
        total: 0,
        pending: 0,
        approved: 0,
        rejected: 0,
        rate: 0
      });
    });

    it('should count permission requests by status', () => {
      const permissionRequests = {
        requests: [
          { request_id: 'PR-001', status: 'pending' },
          { request_id: 'PR-002', status: 'approved' },
          { request_id: 'PR-003', status: 'rejected' },
          { request_id: 'PR-004', status: 'pending' }
        ]
      };

      const result = analyzePermissionRequests(permissionRequests);
      expect(result.total).toBe(4);
      expect(result.pending).toBe(2);
      expect(result.approved).toBe(1);
      expect(result.rejected).toBe(1);
    });
  });

  describe('calculateTestPassRate', () => {
    it('should return null for no tasks with tests', () => {
      const tasks = [
        { id: 'T-001', status: 'done' },
        { id: 'T-002', status: 'failed' }
      ];

      const result = calculateTestPassRate(tasks);
      expect(result).toBeNull();
    });

    it('should calculate correct pass rate', () => {
      const tasks = [
        { id: 'T-001', test_command: 'npm test', status: 'done' },
        { id: 'T-002', test_command: 'npm test', status: 'done' },
        { id: 'T-003', test_command: 'npm test', status: 'failed' }
      ];

      const result = calculateTestPassRate(tasks);
      expect(result).toBeCloseTo(0.667, 2); // 2/3
    });

    it('should return null if no tasks completed or failed', () => {
      const tasks = [
        { id: 'T-001', test_command: 'npm test', status: 'open' },
        { id: 'T-002', test_command: 'npm test', status: 'in_progress' }
      ];

      const result = calculateTestPassRate(tasks);
      expect(result).toBeNull();
    });
  });

  describe('generateWarnings', () => {
    it('should generate warnings for compliance violations', () => {
      const compliance = {
        rate: 0.8,
        violations: [
          {
            task_id: 'T-001',
            issues: ['files_touched: 5 > 3']
          }
        ]
      };

      const warnings = generateWarnings(compliance, 1.0, 1, {}, null, []);
      expect(warnings.length).toBeGreaterThan(0);
      expect(warnings.some(w => w.message.includes('T-001'))).toBe(true);
    });

    it('should generate warning for high average depth', () => {
      const compliance = { rate: 1.0, violations: [] };
      const warnings = generateWarnings(compliance, 2.0, 2, {}, null, []);

      expect(warnings.some(w => w.message.includes('Average decomposition depth'))).toBe(true);
    });

    it('should generate critical warning for max depth reached', () => {
      const compliance = { rate: 1.0, violations: [] };
      const warnings = generateWarnings(compliance, 1.0, 3, {}, null, []);

      expect(warnings.some(w => w.level === 'critical' && w.message.includes('Max decomposition depth'))).toBe(true);
    });

    it('should generate warning for low test pass rate', () => {
      const compliance = { rate: 1.0, violations: [] };
      const warnings = generateWarnings(compliance, 1.0, 1, {}, 0.7, []);

      expect(warnings.some(w => w.message.includes('Test pass rate'))).toBe(true);
    });

    it('should generate critical warning for low compliance', () => {
      const compliance = { rate: 0.85, violations: [] };
      const warnings = generateWarnings(compliance, 1.0, 1, {}, null, []);

      expect(warnings.some(w => w.level === 'critical' && w.message.includes('Atomic compliance'))).toBe(true);
    });
  });

  describe('generateRecommendations', () => {
    it('should recommend redecomposition for files_touched violations', () => {
      const compliance = {
        rate: 0.8,
        violations: [
          {
            task_id: 'T-001',
            issues: ['files_touched: 5 > 3']
          }
        ]
      };

      const recommendations = generateRecommendations(compliance, 1.0, {}, null, []);
      expect(recommendations.some(r => r.includes('Redecompose T-001'))).toBe(true);
    });

    it('should recommend breaking tasks for est_lines_changed violations', () => {
      const compliance = {
        rate: 0.8,
        violations: [
          {
            task_id: 'T-001',
            issues: ['est_lines_changed: 400 > 300']
          }
        ]
      };

      const recommendations = generateRecommendations(compliance, 1.0, {}, null, []);
      expect(recommendations.some(r => r.includes('Break T-001'))).toBe(true);
    });

    it('should recommend adding test commands', () => {
      const compliance = {
        rate: 0.8,
        violations: [
          {
            task_id: 'T-001',
            issues: ['missing test_command']
          }
        ]
      };

      const recommendations = generateRecommendations(compliance, 1.0, {}, null, []);
      expect(recommendations.some(r => r.includes('Add test_command to T-001'))).toBe(true);
    });

    it('should recommend improving specifications for high depth', () => {
      const compliance = { rate: 1.0, violations: [] };
      const recommendations = generateRecommendations(compliance, 2.0, {}, null, []);

      expect(recommendations.some(r => r.includes('Improve initial task specifications'))).toBe(true);
    });

    it('should show healthy status when no warnings', () => {
      const compliance = { rate: 1.0, violations: [] };
      const warnings = [];
      const recommendations = generateRecommendations(compliance, 1.0, {}, null, warnings);

      expect(recommendations.some(r => r.includes('System healthy'))).toBe(true);
    });
  });

  describe('calculateHealthScore', () => {
    it('should return 100 for perfect metrics', () => {
      const score = calculateHealthScore(1.0, 0, 0, 1.0);
      expect(score).toBe(100);
    });

    it('should penalize low compliance', () => {
      const score = calculateHealthScore(0.8, 0, 0, 1.0);
      expect(score).toBeLessThan(100);
    });

    it('should penalize high average depth', () => {
      const score = calculateHealthScore(1.0, 2.5, 0, 1.0);
      expect(score).toBeLessThan(100);
    });

    it('should penalize high permission rate', () => {
      const score = calculateHealthScore(1.0, 0, 0.15, 1.0);
      expect(score).toBeLessThan(100);
    });

    it('should penalize low test pass rate', () => {
      const score = calculateHealthScore(1.0, 0, 0, 0.7);
      expect(score).toBeLessThan(100);
    });

    it('should handle null test pass rate', () => {
      const score = calculateHealthScore(1.0, 0, 0, null);
      expect(score).toBe(100); // Full points for missing test data
    });

    it('should never return negative scores', () => {
      const score = calculateHealthScore(0, 10, 1.0, 0);
      expect(score).toBeGreaterThanOrEqual(0);
    });

    it('should never exceed 100', () => {
      const score = calculateHealthScore(1.0, 0, 0, 1.0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
