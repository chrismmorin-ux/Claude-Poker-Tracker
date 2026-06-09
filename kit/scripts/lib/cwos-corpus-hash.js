'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const CORPUS_RELATIVE = 'kit/data/constitutional-detector-corpus.yaml';

function corpusPath(rootDir) {
  return path.join(rootDir, CORPUS_RELATIVE);
}

function corpusHash(rootDir) {
  const p = corpusPath(rootDir);
  if (!fs.existsSync(p)) return null;
  const raw = fs.readFileSync(p);
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 12);
}

module.exports = { corpusPath, corpusHash, CORPUS_RELATIVE };
