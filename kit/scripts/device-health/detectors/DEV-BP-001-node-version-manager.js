/**
 * DEV-BP-001 — Single active Node version manager.
 *
 * Detects which (if any) of nvm-windows / fnm / volta / system-node are
 * installed and active. More than one active = best-practice violation.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { ok, violate } = require('../lib/detector-base');

function resolveUserHome() {
  return process.env.USERPROFILE || process.env.HOME || null;
}

function existsAny(paths) {
  return paths.some(p => p && fs.existsSync(p));
}

module.exports = {
  id: 'DEV-BP-001',
  rule_type: 'best_practice',
  description: 'Single active Node version manager',
  platforms: ['win32', 'darwin', 'linux'],
  default_severity: 'low',

  async run(_ctx) {
    const home = resolveUserHome();
    const env = process.env;
    const detected = [];

    // nvm-windows
    if (env.NVM_HOME || env.NVM_SYMLINK) detected.push({ manager: 'nvm-windows', signal: 'env' });
    else if (home && existsAny([path.join(home, 'AppData', 'Roaming', 'nvm')])) detected.push({ manager: 'nvm-windows', signal: 'install_path' });

    // fnm
    if (env.FNM_DIR || env.FNM_MULTISHELL_PATH) detected.push({ manager: 'fnm', signal: 'env' });
    else if (home && existsAny([path.join(home, '.fnm'), path.join(home, 'AppData', 'Roaming', 'fnm')])) detected.push({ manager: 'fnm', signal: 'install_path' });

    // volta
    if (env.VOLTA_HOME) detected.push({ manager: 'volta', signal: 'env' });
    else if (home && existsAny([path.join(home, '.volta'), path.join(home, 'AppData', 'Local', 'Volta')])) detected.push({ manager: 'volta', signal: 'install_path' });

    // System node (always likely present if this script ran, but worth noting only if a manager isn't active)
    const systemNodeActive = !env.NVM_HOME && !env.FNM_DIR && !env.VOLTA_HOME;

    const evidence = {
      detected_managers: detected,
      system_node_active: systemNodeActive,
      node_version: process.versions.node,
    };

    if (detected.length > 1) {
      return violate(
        'medium',
        evidence,
        `Multiple Node version managers detected: ${detected.map(d => d.manager).join(', ')} — pick one and uninstall the others`
      );
    }
    if (detected.length === 1) {
      return ok(evidence, `Single Node version manager active: ${detected[0].manager}`);
    }
    return ok(evidence, `No Node version manager detected; system Node ${process.versions.node} in use`);
  },
};
