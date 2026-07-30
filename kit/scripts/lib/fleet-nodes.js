/**
 * fleet-nodes.js — Node (machine) awareness for the fleet registry (ADR-057).
 *
 * The fleet became multi-machine on 2026-07-24 (CM-NODE1 always-on anchor
 * joined MorinComputer/G16). fleet/registry.yaml gained a top-level `nodes:`
 * section and repos gained an optional `hosted_on:` list of node ids.
 *
 * Backward compatibility contract:
 *   - Registry WITHOUT a `nodes:` section (all adopted repos' view, and any
 *     pre-ADR-057 HomeBase checkout): every repo is considered hosted on the
 *     current machine — identical to pre-ADR-057 behavior.
 *   - Registry WITH `nodes:`: a repo without `hosted_on:` defaults to the
 *     node marked `default_host: true` (the design-authority machine),
 *     falling back to the first node listed.
 *   - Running on a machine whose hostname matches no `nodes:` entry is
 *     reported via `unknownHost` — callers should warn and treat repos as
 *     NOT hosted here (path checks would be meaningless noise), pointing
 *     the operator at the node bootstrap (fleet/bootstrap-node.md).
 *
 * Zero dependencies, CommonJS, Node >=14 (same rules as every kit script).
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

/** Normalized hostname of the machine we are running on. */
function currentHostname() {
  return String(os.hostname() || '').trim().toLowerCase();
}

/**
 * Resolve node context from parsed registry data.
 * Returns {
 *   multiNode: bool,          // registry has a nodes: section
 *   nodes: [...],             // raw node entries ([] when !multiNode)
 *   currentNode: {...}|null,  // node entry matching os.hostname(), if any
 *   defaultNode: {...}|null,  // default_host node (or first listed)
 *   unknownHost: bool,        // multiNode && no hostname match
 * }
 */
function resolveNodeContext(registryData) {
  const nodes = Array.isArray(registryData && registryData.nodes)
    ? registryData.nodes.filter(n => n && typeof n === 'object' && n.id)
    : [];
  if (nodes.length === 0) {
    return { multiNode: false, nodes: [], currentNode: null, defaultNode: null, unknownHost: false };
  }
  const host = currentHostname();
  let currentNode = null;
  for (const n of nodes) {
    const h = String(n.hostname || n.id || '').trim().toLowerCase();
    if (h && h === host) { currentNode = n; break; }
  }
  const defaultNode = nodes.find(n => n.default_host === true) || nodes[0];
  return {
    multiNode: true,
    nodes,
    currentNode,
    defaultNode,
    unknownHost: currentNode === null,
  };
}

/**
 * Node ids a repo entry is hosted on, honoring the legacy default.
 * Only meaningful when ctx.multiNode.
 */
function repoHostIds(repo, ctx) {
  if (Array.isArray(repo && repo.hosted_on) && repo.hosted_on.length > 0) {
    return repo.hosted_on.map(String);
  }
  return ctx.defaultNode ? [String(ctx.defaultNode.id)] : [];
}

/**
 * Is this repo expected to exist on the machine we are running on?
 *   - single-node registry: always true (legacy behavior)
 *   - multi-node, known host: hosted_on membership
 *   - multi-node, unknown host: false (caller should surface ctx.unknownHost)
 */
function isRepoHostedHere(repo, ctx) {
  if (!ctx.multiNode) return true;
  if (!ctx.currentNode) return false;
  return repoHostIds(repo, ctx).indexOf(String(ctx.currentNode.id)) !== -1;
}

/**
 * hosted_on stamp for a NEW registry entry (WS-496 — /adopt and /genesis).
 * Returns { id, warning }:
 *   - single-node registry:            { id: null, warning: null } — stamp nothing (legacy).
 *   - multi-node, host recognized:     { id: '<node id>', warning: null } — stamp hosted_on: [id].
 *   - multi-node, unknown host:        { id: null, warning: '...' } — stamp nothing; the
 *     legacy default (default_host) applies and the caller should surface the warning
 *     rather than guess a node id.
 */
function hostedOnStamp(registryData) {
  const ctx = resolveNodeContext(registryData);
  if (!ctx.multiNode) return { id: null, warning: null };
  if (ctx.currentNode) return { id: String(ctx.currentNode.id), warning: null };
  return {
    id: null,
    warning: `hosted_on not stamped: this machine ("${os.hostname()}") is not in the registry nodes: section — ` +
      `the entry will default to the ${ctx.defaultNode ? ctx.defaultNode.id : 'default'} host. ` +
      `Register the node (docs/node-bootstrap.md), then add hosted_on: manually.`,
  };
}

/** Valid node entries from parsed registry data ([] when none). */
function listNodes(registryData) {
  return Array.isArray(registryData && registryData.nodes)
    ? registryData.nodes.filter(n => n && typeof n === 'object' && n.id)
    : [];
}

/**
 * Find a node entry by id (preferred) or hostname, case-insensitive.
 * Returns the node object or null.
 */
function findNode(registryData, nodeId) {
  const want = String(nodeId == null ? '' : nodeId).trim().toLowerCase();
  if (!want) return null;
  const nodes = listNodes(registryData);
  for (const n of nodes) {
    if (String(n.id).trim().toLowerCase() === want) return n;
  }
  for (const n of nodes) {
    if (String(n.hostname || '').trim().toLowerCase() === want) return n;
  }
  return null;
}

/**
 * Does an OpenSSH client config define a Host alias exactly matching `alias`?
 * Only exact (case-insensitive) tokens count — wildcard patterns (* ?) are
 * ignored, since `ssh <alias>` connectivity via a wildcard block does not
 * imply the alias itself resolves to the right machine.
 */
function sshConfigHasHost(configText, alias) {
  const want = String(alias || '').trim().toLowerCase();
  if (!want || typeof configText !== 'string') return false;
  for (const rawLine of configText.split(/\r?\n/)) {
    const line = rawLine.trim();
    // "Host a b c" — but not "HostName ..."
    const m = /^host\s+(.+)$/i.exec(line);
    if (!m) continue;
    for (let token of m[1].split(/\s+/)) {
      token = token.replace(/^"|"$/g, '');
      if (!token || token.includes('*') || token.includes('?')) continue;
      if (token.toLowerCase() === want) return true;
    }
  }
  return false;
}

/**
 * Resolve the string to pass to `ssh` for a fleet node (ADR-057 / WS-499).
 *
 * Preference order (MagicDNS does not resolve on all nodes — FLEET.md):
 *   1. the node id, when ~/.ssh/config carries a `Host <id>` alias
 *      (the fleet convention pins aliases to tailnet IPs there)
 *   2. the registry `tailscale_ip`
 *   3. the raw hostname (last resort — may not resolve off-LAN)
 *
 * opts (all optional, mainly for tests):
 *   sshConfigPath — override ~/.ssh/config location
 *
 * Returns:
 *   { ok: true,  node, target, via: 'ssh-config'|'tailscale-ip'|'hostname' }
 *   { ok: false, node: null, target: null, via: null, knownIds: [...] }
 */
function resolveSshTarget(nodeId, registryData, opts) {
  const o = opts || {};
  const node = findNode(registryData, nodeId);
  if (!node) {
    return {
      ok: false, node: null, target: null, via: null,
      knownIds: listNodes(registryData).map(n => String(n.id)),
    };
  }
  const cfgPath = o.sshConfigPath || path.join(os.homedir(), '.ssh', 'config');
  let cfgText = null;
  try { cfgText = fs.readFileSync(cfgPath, 'utf8'); } catch { cfgText = null; }
  if (cfgText && sshConfigHasHost(cfgText, String(node.id))) {
    return { ok: true, node, target: String(node.id), via: 'ssh-config' };
  }
  if (node.tailscale_ip) {
    return { ok: true, node, target: String(node.tailscale_ip), via: 'tailscale-ip' };
  }
  return { ok: true, node, target: String(node.hostname || node.id), via: 'hostname' };
}

/** One-line description of the current node for scan output / logs. */
function describeCurrentNode(ctx) {
  if (!ctx.multiNode) return 'single-node registry (pre-ADR-057)';
  if (ctx.currentNode) return `${ctx.currentNode.id} (${ctx.currentNode.hostname || '?'})`;
  return `UNKNOWN host "${os.hostname()}" — not in registry nodes: section; run the node bootstrap to register it`;
}

module.exports = {
  currentHostname,
  resolveNodeContext,
  repoHostIds,
  isRepoHostedHere,
  hostedOnStamp,
  describeCurrentNode,
  listNodes,
  findNode,
  sshConfigHasHost,
  resolveSshTarget,
};
