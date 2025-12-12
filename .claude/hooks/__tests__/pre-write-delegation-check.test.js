// Import necessary modules
const { test, expect } = require('node:test');
const fs = require('fs');
const path = require('path');

// Mock file reads and stdin
const mockReadFileSync = jest.spyOn(fs, 'readFileSync').mockImplementation(() => '');
const mockStdin = jest.spyOn(process.stdin, 'setRawMode').mockImplementation(() => {});

// Import the function to test
const { preWriteDelegationCheck } = require('../delegation-check-pre.cjs');

// Test: No active project → allows (exit 0)
test('No active project → allows', async () => {
  mockReadFileSync.mockReturnValue(JSON.stringify({}));
  const result = await preWriteDelegationCheck();
  expect(result).toBe(0);
});

// Test: File not in project → allows
test('File not in project → allows', async () => {
  mockReadFileSync.mockReturnValue(JSON.stringify({ files: {} }));
  const result = await preWriteDelegationCheck();
  expect(result).toBe(0);
});

// Test: File assigned to local model → blocks (exit 2)
test('File assigned to local model → blocks', async () => {
  mockReadFileSync.mockReturnValue(JSON.stringify({ files: { 'file.js': 'local' } }));
  const result = await preWriteDelegationCheck();
  expect(result).toBe(2);
});

// Test: File assigned to claude → allows
test('File assigned to claude → allows', async () => {
  mockReadFileSync.mockReturnValue(JSON.stringify({ files: { 'file.js': 'claude' } }));
  const result = await preWriteDelegationCheck();
  expect(result).toBe(0);
});

// Test: Error handling → allows (fail open)
test('Error handling → allows', async () => {
  mockReadFileSync.mockImplementation(() => { throw new Error('Mock error'); });
  const result = await preWriteDelegationCheck();
  expect(result).toBe(0);
});
