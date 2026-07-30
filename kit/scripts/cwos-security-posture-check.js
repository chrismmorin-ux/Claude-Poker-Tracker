#!/usr/bin/env node
// cwos-security-posture-check — Verify a node's actual Claude Code permission
// settings match the posture it declares in fleet/registry.yaml.
//
// Usage:
//   node kit/scripts/cwos-security-posture-check.js            # this node, JSON
//   node kit/scripts/cwos-security-posture-check.js --pretty   # human-readable
//   node kit/scripts/cwos-security-posture-check.js --node <id>
//
// Exit code: 0 when the node matches its declaration, 1 on divergence, 2 on a
// usage/config error. This IS a gate — silent drift in the permission posture is
// exactly what ADR-059 exists to prevent.
//
// Per ADR-059 §4 the kit ships this CHECKER, not a policy: each node declares
// its own `security_posture` block and this script only reports divergence from
// what that node declared. CWOS never imposes a permission posture on an
// adopted repo, whose founder has a risk profile we cannot see.
//
// Remote nodes: run over the documented fleet channel, e.g.
//   ssh cm-node1 "node C:/Users/chris/repos/homebase/kit/scripts/cwos-security-posture-check.js --pretty"

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const { readYAMLFile, findRepoRoot } = require('./lib/cwos-utils.js');

// ─── Args ─────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { pretty: false, node: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--pretty') out.pretty = true;
    else if (argv[i] === '--node') out.node = argv[++i] || null;
    else if (argv[i] === '--help' || argv[i] === '-h') out.help = true;
    else return { error: `unknown argument: ${argv[i]}` };
  }
  return out;
}

// ─── Inputs ───────────────────────────────────────────────────────────────

function loadDeclaration(root, nodeId) {
  const registryPath = path.join(root, 'fleet', 'registry.yaml');
  if (!fs.existsSync(registryPath)) {
    return { error: `no fleet/registry.yaml at ${registryPath}` };
  }
  const { ok, data } = readYAMLFile(registryPath);
  if (!ok || !data || !Array.isArray(data.nodes)) {
    return { error: 'fleet/registry.yaml has no readable nodes: block' };
  }

  const wanted = (nodeId || os.hostname()).toLowerCase();
  const node = data.nodes.find(
    (n) => String(n.id || '').toLowerCase() === wanted
        || String(n.hostname || '').toLowerCase() === wanted
  );
  if (!node) {
    return { error: `node '${wanted}' is not registered in fleet/registry.yaml nodes:` };
  }
  if (!node.security_posture) {
    return { error: `node '${node.id}' declares no security_posture block (ADR-059)` };
  }
  return { node };
}

function loadActualSettings() {
  const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    return { error: `no ~/.claude/settings.json at ${settingsPath}` };
  }
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8').replace(/^\uFEFF/, '');
    return { settings: JSON.parse(raw), path: settingsPath };
  } catch (err) {
    return { error: `~/.claude/settings.json is not valid JSON — ${err.message}` };
  }
}

// ─── Comparison ───────────────────────────────────────────────────────────

function registeredHookCommands(settings) {
  const found = new Set();
  const pre = (settings.hooks && settings.hooks.PreToolUse) || [];
  for (const entry of pre) {
    for (const hook of entry.hooks || []) {
      for (const arg of hook.args || []) {
        const base = path.basename(String(arg));
        if (base.endsWith('.js')) found.add(base);
      }
      // Hooks may also carry the script inline on `command`.
      const cmd = String(hook.command || '');
      const m = cmd.match(/([\w-]+\.js)/);
      if (m) found.add(m[1]);
    }
  }
  return found;
}

function compare(declared, settings) {
  const findings = [];
  const perms = settings.permissions || {};

  // 1. Permission mode — the core of the posture.
  if (declared.default_mode) {
    const actual = perms.defaultMode || 'default';
    if (actual !== declared.default_mode) {
      findings.push({
        control: 'permission-mode',
        expected: declared.default_mode,
        actual,
        detail: `This node declares it runs in '${declared.default_mode}' mode but is actually in '${actual}'.`
                + (actual === 'bypassPermissions'
                    ? ' bypassPermissions means every tool call runs ungated — the state ADR-059 moved away from.'
                    : ''),
      });
    }
  }

  // 2. Bypass-era skip flags must be absent once a boundary mode is declared.
  if (declared.default_mode && declared.default_mode !== 'bypassPermissions') {
    for (const flag of ['skipDangerousModePermissionPrompt', 'skipAutoPermissionPrompt']) {
      if (settings[flag] === true) {
        findings.push({
          control: 'skip-flag',
          expected: `${flag} absent`,
          actual: `${flag}: true`,
          detail: `A bypass-era skip flag is still set while the node declares '${declared.default_mode}'. It suppresses prompts the declared posture relies on.`,
        });
      }
    }
  }

  // 3. Required PreToolUse hooks.
  if (Array.isArray(declared.required_hooks) && declared.required_hooks.length) {
    const present = registeredHookCommands(settings);
    for (const hook of declared.required_hooks) {
      if (!present.has(hook)) {
        findings.push({
          control: 'hook',
          expected: `${hook} registered as a PreToolUse hook`,
          actual: 'not registered',
          detail: `Declared guard '${hook}' is not wired into ~/.claude/settings.json, so it is not running.`,
        });
      }
    }
  }

  // 4. Admin escalation path — declared intent vs. whether it is audited.
  if (declared.admin_escalation === 'audited') {
    const present = registeredHookCommands(settings);
    if (!present.has('cwos-admin-escalation-audit.js')) {
      findings.push({
        control: 'admin-escalation',
        expected: 'admin escalation audited',
        actual: 'no audit hook registered',
        detail: 'The node declares the ssh-admin path is audited, but the audit hook is not registered — escalations would leave no record.',
      });
    }
  }

  return findings;
}

// ─── Output ───────────────────────────────────────────────────────────────

function renderPretty(nodeId, findings, settingsPath) {
  if (!findings.length) {
    return `Security posture OK on ${nodeId} — actual settings match the declared posture.\n`;
  }
  const lines = [
    `Security posture DRIFT on ${nodeId} — ${findings.length} divergence(s) from the declared posture.`,
    `Declared in: fleet/registry.yaml (nodes: ${nodeId}.security_posture)`,
    `Actual from: ${settingsPath}`,
    '',
  ];
  for (const f of findings) {
    lines.push(`  [${f.control}]`);
    lines.push(`     expected: ${f.expected}`);
    lines.push(`     actual:   ${f.actual}`);
    lines.push(`     ${f.detail}`);
    lines.push('');
  }
  lines.push('Fix by bringing settings back in line with the declaration, or — if the change was');
  lines.push('deliberate — update the declaration and record it as a superseding decision (ADR-059).');
  return lines.join('\n') + '\n';
}

// ─── Main ─────────────────────────────────────────────────────────────────

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.error) { process.stderr.write(`security-posture-check: ${args.error}\n`); process.exit(2); }
  if (args.help) {
    process.stdout.write('usage: cwos-security-posture-check [--pretty] [--node <id>]\n');
    process.exit(0);
  }

  const root = findRepoRoot(__dirname) || process.cwd();

  const decl = loadDeclaration(root, args.node);
  if (decl.error) { process.stderr.write(`security-posture-check: ${decl.error}\n`); process.exit(2); }

  const isRemote = args.node
    && args.node.toLowerCase() !== os.hostname().toLowerCase()
    && args.node.toLowerCase() !== String(decl.node.id || '').toLowerCase();

  // Settings are per-machine; we can only read the local ones. Checking another
  // node means running this script there over ssh, not guessing from here.
  if (isRemote) {
    process.stderr.write(
      `security-posture-check: cannot read settings for a remote node from here.\n`
      + `Run it on that node:\n`
      + `  ssh ${args.node} "node ${root.replace(/\\/g, '/')}/kit/scripts/cwos-security-posture-check.js --pretty"\n`
    );
    process.exit(2);
  }

  const actual = loadActualSettings();
  if (actual.error) { process.stderr.write(`security-posture-check: ${actual.error}\n`); process.exit(2); }

  const findings = compare(decl.node.security_posture, actual.settings);
  const nodeId = decl.node.id;

  if (args.pretty) {
    process.stdout.write(renderPretty(nodeId, findings, actual.path));
  } else {
    process.stdout.write(JSON.stringify({
      ok: findings.length === 0,
      node: nodeId,
      declared: decl.node.security_posture,
      settings_path: actual.path,
      findings,
    }, null, 2) + '\n');
  }

  process.exit(findings.length === 0 ? 0 : 1);
}

main();
