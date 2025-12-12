/**
 * Tests for context-provider.cjs
 */

const fs = require('fs');
const path = require('path');
const {
  extractLineRange,
  detectLanguage,
  formatContextSection,
  processContextRequests
} = require('../context-provider.cjs');

describe('context-provider', () => {
  describe('detectLanguage', () => {
    it('should detect JavaScript files', () => {
      expect(detectLanguage('file.js')).toBe('javascript');
      expect(detectLanguage('file.jsx')).toBe('javascript');
      expect(detectLanguage('file.cjs')).toBe('javascript');
      expect(detectLanguage('file.mjs')).toBe('javascript');
    });

    it('should detect TypeScript files', () => {
      expect(detectLanguage('file.ts')).toBe('typescript');
      expect(detectLanguage('file.tsx')).toBe('typescript');
    });

    it('should detect other common languages', () => {
      expect(detectLanguage('file.json')).toBe('json');
      expect(detectLanguage('file.md')).toBe('markdown');
      expect(detectLanguage('file.sh')).toBe('bash');
      expect(detectLanguage('file.css')).toBe('css');
      expect(detectLanguage('file.html')).toBe('html');
      expect(detectLanguage('file.yml')).toBe('yaml');
      expect(detectLanguage('file.yaml')).toBe('yaml');
    });

    it('should return empty string for unknown extensions', () => {
      expect(detectLanguage('file.xyz')).toBe('');
      expect(detectLanguage('file')).toBe('');
    });
  });

  describe('extractLineRange', () => {
    it('should extract valid line range from existing file', () => {
      const result = extractLineRange('package.json', 1, 5);

      expect(result.success).toBe(true);
      expect(result.lines).toBeDefined();
      expect(result.lines.length).toBe(5);
      expect(result.totalLines).toBeGreaterThan(0);
    });

    it('should handle single line extraction', () => {
      const result = extractLineRange('package.json', 1, 1);

      expect(result.success).toBe(true);
      expect(result.lines).toBeDefined();
      expect(result.lines.length).toBe(1);
    });

    it('should fail for non-existent file', () => {
      const result = extractLineRange('does-not-exist.js', 1, 10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should fail for invalid start line (too low)', () => {
      const result = extractLineRange('package.json', 0, 10);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid start line');
    });

    it('should fail for invalid start line (too high)', () => {
      const result = extractLineRange('package.json', 999999, 999999);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid start line');
    });

    it('should fail when end line is before start line', () => {
      const result = extractLineRange('package.json', 10, 5);

      expect(result.success).toBe(false);
      expect(result.error).toContain('End line');
      expect(result.error).toContain('before start line');
    });

    it('should handle extraction to end of file', () => {
      const result = extractLineRange('package.json', 1, 1000000);

      expect(result.success).toBe(true);
      expect(result.lines).toBeDefined();
      // Should get all lines from start to actual end
    });
  });

  describe('formatContextSection', () => {
    it('should format context section with proper markdown', () => {
      const contextRequest = {
        path: 'src/utils/test.js',
        lines_start: 10,
        lines_end: 20
      };
      const lines = ['line 1', 'line 2', 'line 3'];
      const totalLines = 100;

      const result = formatContextSection(contextRequest, lines, totalLines);

      expect(result).toContain('### File: src/utils/test.js');
      expect(result).toContain('lines 10-20');
      expect(result).toContain('of 100');
      expect(result).toContain('```javascript');
      expect(result).toContain('line 1');
      expect(result).toContain('line 2');
      expect(result).toContain('line 3');
    });

    it('should use correct language based on file extension', () => {
      const contextRequest = {
        path: 'src/types/index.ts',
        lines_start: 1,
        lines_end: 5
      };
      const lines = ['type Foo = string;'];

      const result = formatContextSection(contextRequest, lines, 10);

      expect(result).toContain('```typescript');
    });

    it('should handle files without total lines', () => {
      const contextRequest = {
        path: 'test.js',
        lines_start: 1,
        lines_end: 10
      };
      const lines = ['test'];

      const result = formatContextSection(contextRequest, lines, null);

      expect(result).toContain('lines 1-10');
      expect(result).not.toContain('of');
    });
  });

  describe('processContextRequests', () => {
    it('should process single valid request', () => {
      const requests = [
        { path: 'package.json', lines_start: 1, lines_end: 5 }
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(true);
      expect(result.output).toContain('### File: package.json');
      expect(result.errors).toHaveLength(0);
    });

    it('should process multiple valid requests', () => {
      const requests = [
        { path: 'package.json', lines_start: 1, lines_end: 3 },
        { path: 'package.json', lines_start: 5, lines_end: 8 }
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(true);
      expect(result.output).toContain('### File: package.json');
      expect(result.errors).toHaveLength(0);
      // Should have two sections
      expect((result.output.match(/### File:/g) || []).length).toBe(2);
    });

    it('should fail for invalid request structure (missing path)', () => {
      const requests = [
        { lines_start: 1, lines_end: 10 }
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid context request');
    });

    it('should fail for invalid request structure (missing lines_start)', () => {
      const requests = [
        { path: 'test.js', lines_end: 10 }
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Invalid context request');
    });

    it('should fail for non-existent file', () => {
      const requests = [
        { path: 'does-not-exist.js', lines_start: 1, lines_end: 10 }
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('does-not-exist.js');
      expect(result.errors[0]).toContain('File not found');
    });

    it('should collect multiple errors', () => {
      const requests = [
        { path: 'package.json', lines_start: 1, lines_end: 5 }, // valid
        { path: 'missing.js', lines_start: 1, lines_end: 10 },   // invalid (file missing)
        { lines_start: 1, lines_end: 10 },                        // invalid (no path)
        { path: 'package.json', lines_start: 10, lines_end: 5 }  // invalid (end < start)
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Should still have partial output from valid request
      expect(result.output).toContain('### File: package.json');
    });

    it('should handle empty requests array', () => {
      const requests = [];

      const result = processContextRequests(requests);

      expect(result.success).toBe(true);
      expect(result.output).toBe('');
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('integration tests', () => {
    it('should extract context from real project file', () => {
      // Test extracting from package.json (guaranteed to exist)
      const requests = [
        { path: 'package.json', lines_start: 1, lines_end: 10 }
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(true);
      expect(result.output).toContain('### File: package.json');
      expect(result.output).toContain('```json');
      expect(result.errors).toHaveLength(0);
    });

    it('should extract multiple ranges from same file', () => {
      const requests = [
        { path: 'package.json', lines_start: 1, lines_end: 2 },
        { path: 'package.json', lines_start: 4, lines_end: 6 }
      ];

      const result = processContextRequests(requests);

      expect(result.success).toBe(true);
      expect((result.output.match(/### File: package.json/g) || []).length).toBe(2);
      expect((result.output.match(/```json/g) || []).length).toBe(2);
    });
  });
});
