#!/usr/bin/env node
/**
 * Cache-First Read Hook
 *
 * Maintains a context cache for frequently-read files.
 * On Read tool use:
 * - Checks if file has a cached summary
 * - If cached and fresh: suggests using summary instead
 * - After read: generates and caches summary for future use
 *
 * Hook Type: PreToolUse (Read) and PostToolUse (Read)
 * Exit codes: 0 (always allow - informational)
 *
 * Cache file: .claude/.context-cache.json
 * Cache TTL: 4 hours (configurable)
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const CACHE_FILE = path.join(process.cwd(), '.claude', '.context-cache.json');

const CONFIG = {
  TTL_HOURS: 4,
  MAX_CACHE_ENTRIES: 50,
  MIN_FILE_LINES_TO_CACHE: 50,  // Only cache files > 50 lines
  CACHEABLE_PATTERNS: [
    /src\/.*\.(js|jsx|ts|tsx)$/,
    /src\/.*Reducer\.js$/,
    /src\/.*Context\.jsx$/,
  ],
  SKIP_PATTERNS: [
    /node_modules/,
    /\.test\./,
    /__tests__/,
    /\.min\./,
    /dist\//,
    /coverage\//,
  ],
};

function loadCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));

      // Check if entire cache is expired
      const expiryTime = new Date(data.expires).getTime();
      if (Date.now() > expiryTime) {
        return createEmptyCache();
      }
      return data;
    }
  } catch (e) {
    // Silently fail
  }
  return createEmptyCache();
}

function createEmptyCache() {
  const now = new Date();
  const expires = new Date(now.getTime() + CONFIG.TTL_HOURS * 60 * 60 * 1000);
  return {
    version: 1,
    created: now.toISOString(),
    expires: expires.toISOString(),
    ttlHours: CONFIG.TTL_HOURS,
    entries: {},
  };
}

function saveCache(cache) {
  try {
    const dir = path.dirname(CACHE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    // Silently fail
  }
}

function getFileHash(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    // Hash first 1000 chars for quick comparison
    const sample = content.substring(0, 1000);
    return crypto.createHash('md5').update(sample).digest('hex').substring(0, 8);
  } catch (e) {
    return null;
  }
}

function getFileLineCount(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return content.split('\n').length;
  } catch (e) {
    return 0;
  }
}

function isCacheableFile(filePath) {
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Check skip patterns
  if (CONFIG.SKIP_PATTERNS.some(pattern => pattern.test(normalizedPath))) {
    return false;
  }

  // Check cacheable patterns
  return CONFIG.CACHEABLE_PATTERNS.some(pattern => pattern.test(normalizedPath));
}

function generateFileSummary(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const fileName = path.basename(filePath);

    // Extract key information
    const exports = [];
    const imports = [];
    const functions = [];
    const components = [];

    lines.forEach((line, idx) => {
      // Find exports
      if (line.match(/^export\s+(const|function|class|default)/)) {
        const match = line.match(/export\s+(?:const|function|class|default\s+(?:function\s+)?)\s*(\w+)/);
        if (match) exports.push(match[1]);
      }

      // Find imports (just count them)
      if (line.match(/^import\s+/)) {
        imports.push(line.trim());
      }

      // Find function definitions
      if (line.match(/^(?:export\s+)?(?:const|function)\s+\w+\s*[=(]/)) {
        const match = line.match(/(?:const|function)\s+(\w+)/);
        if (match) functions.push(match[1]);
      }

      // Find React components
      if (line.match(/^(?:export\s+)?(?:const|function)\s+[A-Z]\w+/)) {
        const match = line.match(/(?:const|function)\s+([A-Z]\w+)/);
        if (match && !components.includes(match[1])) {
          components.push(match[1]);
        }
      }
    });

    return {
      fileName,
      lines: lines.length,
      exports: [...new Set(exports)].slice(0, 10),
      importCount: imports.length,
      functions: [...new Set(functions)].slice(0, 15),
      components: [...new Set(components)].slice(0, 5),
      generatedAt: new Date().toISOString(),
    };
  } catch (e) {
    return null;
  }
}

function formatSummaryForDisplay(summary) {
  const parts = [`**${summary.fileName}** (${summary.lines} lines)`];

  if (summary.exports.length > 0) {
    parts.push(`Exports: ${summary.exports.join(', ')}`);
  }

  if (summary.components.length > 0) {
    parts.push(`Components: ${summary.components.join(', ')}`);
  }

  if (summary.functions.length > 0) {
    parts.push(`Functions: ${summary.functions.slice(0, 8).join(', ')}${summary.functions.length > 8 ? '...' : ''}`);
  }

  return parts.join('\n  ');
}

async function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    const timeout = setTimeout(() => {
      rl.close();
      resolve(input);
    }, 1000);

    rl.on('line', (line) => {
      input += line;
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(input);
    });
  });
}

async function main() {
  const input = await readStdin();

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  const tool = data?.tool;
  if (tool !== 'Read') {
    process.exit(0);
  }

  const filePath = data?.tool_input?.file_path || '';
  const normalizedPath = filePath.replace(/\\/g, '/');

  // Skip non-cacheable files
  if (!isCacheableFile(normalizedPath)) {
    process.exit(0);
  }

  // Skip small files
  const lineCount = getFileLineCount(filePath);
  if (lineCount < CONFIG.MIN_FILE_LINES_TO_CACHE) {
    process.exit(0);
  }

  const cache = loadCache();
  const cacheKey = normalizedPath;
  const currentHash = getFileHash(filePath);

  // Check if we have a valid cached entry
  const cached = cache.entries[cacheKey];
  if (cached && cached.hash === currentHash) {
    // Cache hit - suggest using summary
    console.log('');
    console.log('[CACHE-HIT] This file has a cached summary:');
    console.log(`  ${formatSummaryForDisplay(cached.summary)}`);
    console.log('');
    console.log('  Consider if summary is sufficient before reading full file.');
    console.log(`  Full read: ~${Math.round(lineCount * 4)} tokens | Summary: ~100 tokens`);
    console.log('');
  } else {
    // Cache miss or stale - generate new summary after read
    const summary = generateFileSummary(filePath);
    if (summary) {
      cache.entries[cacheKey] = {
        hash: currentHash,
        summary,
        cachedAt: new Date().toISOString(),
      };

      // Prune old entries if over limit
      const keys = Object.keys(cache.entries);
      if (keys.length > CONFIG.MAX_CACHE_ENTRIES) {
        // Remove oldest entries
        const sortedKeys = keys.sort((a, b) => {
          const aTime = new Date(cache.entries[a].cachedAt).getTime();
          const bTime = new Date(cache.entries[b].cachedAt).getTime();
          return aTime - bTime;
        });
        sortedKeys.slice(0, keys.length - CONFIG.MAX_CACHE_ENTRIES).forEach(key => {
          delete cache.entries[key];
        });
      }

      saveCache(cache);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('[cache-first-read] Error:', err.message);
  process.exit(0);
});
