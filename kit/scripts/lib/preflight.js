/**
 * preflight.js — Node.js version guard. Require this first.
 * Uses only ES5 syntax so it can parse on ancient Node before it rejects.
 */
'use strict';
var major = parseInt(process.versions.node.split('.')[0], 10);
if (isNaN(major) || major < 14) {
  process.stderr.write(
    'Error: Node.js v14+ is required (found v' + process.versions.node + ').\n' +
    'Install or update Node.js: https://nodejs.org/\n'
  );
  process.exit(1);
}
module.exports = {};
