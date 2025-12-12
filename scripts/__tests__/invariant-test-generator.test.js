import { describe, it, expect } from 'vitest';
import {
  generateInvariantTest,
  REQUIRES_INVARIANT_TEST,
  generateAssertions,
  getTestFilePath,
  generateTestTaskId
} from '../invariant-test-generator.cjs';

describe('invariant-test-generator', () => {
  describe('REQUIRES_INVARIANT_TEST', () => {
    it('identifies reducer files', () => {
      expect(REQUIRES_INVARIANT_TEST('src/reducers/gameReducer.js')).toBe(true);
      expect(REQUIRES_INVARIANT_TEST('src/reducers/uiReducer.jsx')).toBe(true);
    });

    it('identifies persistence files', () => {
      expect(REQUIRES_INVARIANT_TEST('src/utils/persistence.js')).toBe(true);
      expect(REQUIRES_INVARIANT_TEST('src/utils/persistenceHelpers.js')).toBe(true);
    });

    it('identifies hydration files', () => {
      expect(REQUIRES_INVARIANT_TEST('src/utils/hydration.js')).toBe(true);
      expect(REQUIRES_INVARIANT_TEST('src/utils/hydrationUtils.jsx')).toBe(true);
    });

    it('identifies context files', () => {
      expect(REQUIRES_INVARIANT_TEST('src/contexts/GameContext.js')).toBe(true);
      expect(REQUIRES_INVARIANT_TEST('src/contexts/UIContext.jsx')).toBe(true);
    });

    it('rejects non-critical files', () => {
      expect(REQUIRES_INVARIANT_TEST('src/components/Button.jsx')).toBe(false);
      expect(REQUIRES_INVARIANT_TEST('src/utils/helpers.js')).toBe(false);
      expect(REQUIRES_INVARIANT_TEST('src/hooks/useCustomHook.js')).toBe(false);
    });
  });

  describe('generateAssertions', () => {
    it('generates reducer assertions', () => {
      const assertions = generateAssertions('src/reducers/gameReducer.js', 'Add new action');

      expect(assertions).toContain('Reducer returns valid state shape');
      expect(assertions).toContain('Reducer handles all required actions');
      expect(assertions).toContain('Reducer maintains immutability');
      expect(assertions).toContain('Invalid actions return unchanged state');
    });

    it('generates persistence assertions', () => {
      const assertions = generateAssertions('src/utils/persistence.js', 'Update save logic');

      expect(assertions).toContain('Persistence saves data correctly');
      expect(assertions).toContain('Persistence loads data correctly');
      expect(assertions).toContain('Handles missing/corrupt data gracefully');
      expect(assertions).toContain('Migration paths preserve data integrity');
    });

    it('generates hydration assertions', () => {
      const assertions = generateAssertions('src/utils/hydration.js', 'Add new field');

      expect(assertions).toContain('Hydration restores complete state');
      expect(assertions).toContain('Missing fields use correct defaults');
      expect(assertions).toContain('Legacy data formats upgrade correctly');
    });

    it('generates context assertions', () => {
      const assertions = generateAssertions('src/contexts/GameContext.js', 'Add provider');

      expect(assertions).toContain('Context provides all required values');
      expect(assertions).toContain('Context updates propagate correctly');
      expect(assertions).toContain('Context handles edge cases');
    });
  });

  describe('getTestFilePath', () => {
    it('places tests in src/__tests__ for src files', () => {
      expect(getTestFilePath('src/reducers/gameReducer.js'))
        .toBe('src/__tests__/reducers/gameReducer.test.js');

      expect(getTestFilePath('src/utils/persistence.jsx'))
        .toBe('src/__tests__/utils/persistence.test.jsx');
    });

    it('handles nested directories', () => {
      expect(getTestFilePath('src/contexts/providers/GameContext.js'))
        .toBe('src/__tests__/contexts/providers/GameContext.test.js');
    });

    it('handles files outside src/', () => {
      expect(getTestFilePath('scripts/helper.js'))
        .toBe('scripts/helper.test.js');
    });
  });

  describe('generateTestTaskId', () => {
    it('generates test task IDs with +1000 offset', () => {
      expect(generateTestTaskId('T-P5-001')).toBe('T-P5-1001');
      expect(generateTestTaskId('T-ABC-042')).toBe('T-ABC-1042');
      expect(generateTestTaskId('T-P1-999')).toBe('T-P1-1999');
    });

    it('throws on invalid task ID format', () => {
      expect(() => generateTestTaskId('INVALID')).toThrow();
      expect(() => generateTestTaskId('T-P5')).toThrow();
      expect(() => generateTestTaskId('T-P5-1')).toThrow();
    });
  });

  describe('generateInvariantTest', () => {
    const baseTask = {
      id: 'T-P5-001',
      title: 'Update game reducer',
      description: 'Add new action to game reducer',
      files_touched: [],
      priority: 'P1',
      est_lines_changed: 50,
      est_local_effort_mins: 30
    };

    it('returns null for non-critical files', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/components/Button.jsx']
      };

      const result = generateInvariantTest(task);
      expect(result).toBe(null);
    });

    it('generates test task for reducer files', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/reducers/gameReducer.js']
      };

      const result = generateInvariantTest(task);

      expect(result).toBeDefined();
      expect(result.id).toBe('T-P5-1001');
      expect(result.parent_id).toBe('T-P5-001');
      expect(result.title).toContain('gameReducer.js');
      expect(result.files_touched).toEqual(['src/__tests__/reducers/gameReducer.test.js']);
      expect(result.assigned_to).toBe('local:qwen');
      expect(result.priority).toBe('P1');
      expect(result.status).toBe('open');
    });

    it('generates test task for persistence files', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/utils/persistence.js'],
        id: 'T-P2-015'
      };

      const result = generateInvariantTest(task);

      expect(result).toBeDefined();
      expect(result.id).toBe('T-P2-1015');
      expect(result.parent_id).toBe('T-P2-015');
      expect(result.title).toContain('persistence.js');
      expect(result.files_touched).toEqual(['src/__tests__/utils/persistence.test.js']);
    });

    it('includes invariant_test metadata', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/reducers/gameReducer.js']
      };

      const result = generateInvariantTest(task);

      expect(result.invariant_test).toBeDefined();
      expect(result.invariant_test.target).toBe('src/reducers/gameReducer.js');
      expect(result.invariant_test.assertions).toBeInstanceOf(Array);
      expect(result.invariant_test.assertions.length).toBeGreaterThan(0);
    });

    it('includes needs_context for source file', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/reducers/gameReducer.js']
      };

      const result = generateInvariantTest(task);

      expect(result.needs_context).toBeDefined();
      expect(result.needs_context).toHaveLength(1);
      expect(result.needs_context[0]).toEqual({
        path: 'src/reducers/gameReducer.js',
        lines_start: 1,
        lines_end: 9999
      });
    });

    it('includes proper inputs, outputs, constraints', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/reducers/gameReducer.js']
      };

      const result = generateInvariantTest(task);

      expect(result.inputs).toBeInstanceOf(Array);
      expect(result.inputs.length).toBeGreaterThan(0);
      expect(result.outputs).toBeInstanceOf(Array);
      expect(result.outputs.length).toBeGreaterThan(0);
      expect(result.constraints).toBeInstanceOf(Array);
      expect(result.constraints).toContain('Use Vitest framework');
    });

    it('generates appropriate test_command', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/reducers/gameReducer.js']
      };

      const result = generateInvariantTest(task);

      expect(result.test_command).toContain('npm test --');
      expect(result.test_command).toContain('src/__tests__/reducers/gameReducer.test.js');
    });

    it('estimates effort based on assertion count', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/reducers/gameReducer.js']
      };

      const result = generateInvariantTest(task);

      // Reducer has 4 assertions, so ~40 min effort (10 min/assertion)
      expect(result.est_local_effort_mins).toBeGreaterThan(0);
      expect(result.est_local_effort_mins).toBeLessThanOrEqual(45);
    });

    it('estimates lines changed based on assertion count', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/reducers/gameReducer.js']
      };

      const result = generateInvariantTest(task);

      // Reducer has 4 assertions, so ~80 lines (20 lines/assertion)
      expect(result.est_lines_changed).toBeGreaterThan(0);
      expect(result.est_lines_changed).toBeLessThanOrEqual(200);
    });

    it('uses first critical file when multiple exist', () => {
      const task = {
        ...baseTask,
        files_touched: [
          'src/components/Button.jsx', // Not critical
          'src/reducers/gameReducer.js', // Critical (first)
          'src/utils/persistence.js' // Critical (second)
        ]
      };

      const result = generateInvariantTest(task);

      expect(result).toBeDefined();
      expect(result.title).toContain('gameReducer.js');
      expect(result.invariant_test.target).toBe('src/reducers/gameReducer.js');
    });

    it('handles context provider files', () => {
      const task = {
        ...baseTask,
        files_touched: ['src/contexts/GameContext.js']
      };

      const result = generateInvariantTest(task);

      expect(result).toBeDefined();
      expect(result.invariant_test.assertions).toContain('Context provides all required values');
      expect(result.invariant_test.assertions).toContain('Context updates propagate correctly');
    });
  });
});
