/**
 * shared/table-manager.js — Multi-table coordinator
 *
 * Maps WebSocket connections to HandStateMachine instances.
 * Filters non-game connections. Handles table lifecycle.
 */

import * as protocol from './protocol.js';
import { HandStateMachine } from './hand-state-machine.js';

/**
 * Grace window between a socket close and the table being treated as gone.
 *
 * Ignition's game socket closes and reopens routinely mid-session. Before this
 * window existed, `handleConnectionClosed` deleted the table immediately, which
 * (a) emitted a bogus `reconnectInterrupted` partial for a hand still in
 * progress and (b) made the reconnect look like a brand-new table to every
 * downstream consumer — the side panel wiped advice, live context, seat stats
 * and villain reads on every blip. See the reconnect lifecycle tests in
 * `shared/__tests__/table-manager.test.js`.
 */
export const RECONNECT_GRACE_MS = 15_000;

export class TableManager {
  constructor(onHandComplete, onError) {
    this.onHandComplete = onHandComplete;
    this.onError = onError || (() => {});
    this.tables = new Map(); // connId → HandStateMachine
    this.totalCompletedHands = 0;
    this.connectionUrls = new Map(); // connId → url
    this.urlToConnId = new Map(); // url → connId (for reconnection reuse)
    this.lobbyLog = [];
    this.batchedFrameCount = 0;
    this.totalParsedMessages = 0;
    this.pidCounts = {};
    this._lastRoutedPids = [];
    // Count of machines currently in the post-close grace window. Guards the
    // reap sweep so the hot message path costs one integer compare when no
    // table is disconnected (the overwhelmingly common case).
    this._disconnectedCount = 0;
  }

  /**
   * Stable identity for a table, independent of which WebSocket connection is
   * currently carrying it.
   *
   * connId is a monotonic counter assigned per socket
   * (`content/capture-websocket-probe.js`), so it changes on every reconnect.
   * The game WS URL does not — it is already the key `urlToConnId` uses to
   * stitch a reconnect back to its machine, so the codebase already treats it
   * as the table's identity. This exposes that identity to consumers instead
   * of leaking the connection counter to them.
   */
  _tableKeyForUrl(url, connId) {
    return url ? `table:${url}` : `table_${connId}`;
  }

  registerConnection(connId, url) {
    connId = String(connId);
    this.connectionUrls.set(connId, url);
  }

  routeMessage(connId, rawMessage, url) {
    connId = String(connId);

    if (url) {
      this.connectionUrls.set(connId, url);
    }

    // Parse batch — Atmosphere may pack multiple messages per WS frame
    const parsedMessages = protocol.parseWsBatch(rawMessage);
    if (parsedMessages.length === 0) return;

    if (parsedMessages.length > 1) this.batchedFrameCount++;
    this.totalParsedMessages += parsedMessages.length;
    this._lastRoutedPids = [];

    for (const parsed of parsedMessages) {
      this._routeSingleParsed(connId, parsed, url);
    }
  }

  /** Route a single parsed message through lobby filter → URL filter → HSM. */
  _routeSingleParsed(connId, parsed, url) {
    this._lastRoutedPids.push(parsed.pid);
    this.pidCounts[parsed.pid] = (this.pidCounts[parsed.pid] || 0) + 1;

    // Capture lobby/tournament messages from ANY connection
    if (parsed.lobby) {
      const MAX_LOBBY = 200;
      if (this.lobbyLog.length >= MAX_LOBBY) this.lobbyLog.shift();
      const rawPayload = parsed.payload || {};
      const sampledValues = {};
      for (const [k, v] of Object.entries(rawPayload)) {
        if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
          sampledValues[k] = v;
        } else if (Array.isArray(v)) {
          sampledValues[k] = `[${v.length} items]`;
        } else if (v && typeof v === 'object') {
          sampledValues[k] = `{${Object.keys(v).join(',')}}`;
        }
      }
      this.lobbyLog.push({
        connId,
        timestamp: Date.now(),
        url: this.connectionUrls.get(connId) || url || '',
        keys: Object.keys(rawPayload),
        sampleValues: sampledValues,
        payload: rawPayload,
      });
      return;
    }

    // Check if this is a game WebSocket connection
    const connUrl = this.connectionUrls.get(connId) || url || '';
    if (!protocol.isGameWsUrl(connUrl)) {
      return;
    }

    // Get or create state machine for this table
    let machine = this.tables.get(connId);
    if (!machine && connUrl) {
      const oldConnId = this.urlToConnId.get(connUrl);
      if (oldConnId !== undefined && oldConnId !== connId && this.tables.has(oldConnId)) {
        // Same table URL, new connection: this is a reconnect, not a new table.
        // Migrate the machine wholesale — including a hand still in progress.
        //
        // Preserving mid-hand state is safe because Ignition sends CO_TABLE_INFO
        // on join/reconnect carrying a full snapshot of the live hand: dealerSeat,
        // tableState (street), hero hole cards (pcard*) and board (bcard). See
        // `spike-data/SPIKE_REPORT.md` and `adaptTableInfo` in protocol-adapter.js
        // — the adapter decomposes it into the events that resynchronise the
        // machine. The protocol supplies the rehydration; we only have to keep
        // the machine alive long enough to receive it.
        //
        // The previous behaviour emitted a `reconnectInterrupted` partial and
        // built a fresh machine, which discarded completedHandCount, tableConfig,
        // seatDisplayMap, stack observations, and the action sequence for the
        // hand actually being played.
        machine = this.tables.get(oldConnId);
        this.tables.delete(oldConnId);
        machine.connId = connId;
        this.tables.set(connId, machine);
        this.connectionUrls.delete(oldConnId);
        if (machine.disconnectedAt) {
          machine.disconnectedAt = null;
          this._disconnectedCount = Math.max(0, this._disconnectedCount - 1);
        }
      }
    }
    if (connUrl) {
      this.urlToConnId.set(connUrl, connId);
    }
    if (!machine) {
      machine = new HandStateMachine(
        connId,
        (record) => {
          this.totalCompletedHands++;
          this.onHandComplete(record);
        },
        (error, context) => {
          this.onError(error, { connId, ...context });
        }
      );
      // Stable identity, assigned once and carried across every reconnect.
      machine.tableKey = this._tableKeyForUrl(connUrl, connId);
      machine.disconnectedAt = null;
      this.tables.set(connId, machine);
    }

    // A live message proves the socket is up: cancel any pending grace window.
    if (machine.disconnectedAt) {
      machine.disconnectedAt = null;
      this._disconnectedCount = Math.max(0, this._disconnectedCount - 1);
    }
    // Cheap guard — only sweeps when something is actually in grace.
    if (this._disconnectedCount > 0) this.reapDisconnected();

    machine.processMessage(parsed.pid, parsed.payload);
  }

  /**
   * A socket closed. This is NOT proof the table is gone — Ignition cycles the
   * game socket routinely — so the table enters a grace window instead of being
   * destroyed. If the same URL reconnects within RECONNECT_GRACE_MS, routeMessage
   * migrates the machine intact. If it does not, `reapDisconnected` emits the
   * partial and removes it, which is what this method used to do inline.
   *
   * `connectionUrls` is deliberately NOT cleared here: it is the map that lets
   * the reconnect find its way home.
   */
  handleConnectionClosed(connId, now = Date.now()) {
    connId = String(connId);
    const machine = this.tables.get(connId);
    if (!machine) {
      this.connectionUrls.delete(connId);
      return;
    }
    if (!machine.disconnectedAt) {
      machine.disconnectedAt = now;
      this._disconnectedCount++;
    }
  }

  /**
   * Close out tables whose grace window expired without a reconnect. Emits the
   * mid-hand partial that `handleConnectionClosed` used to emit immediately, so
   * no captured hand is lost — it just waits to see whether the socket comes
   * back first.
   *
   * @returns {number} tables reaped
   */
  reapDisconnected(graceMs = RECONNECT_GRACE_MS, now = Date.now()) {
    if (this._disconnectedCount === 0) return 0;
    let reaped = 0;
    for (const [connId, machine] of [...this.tables]) {
      if (!machine.disconnectedAt) continue;
      if (now - machine.disconnectedAt < graceMs) continue;

      const state = machine.getState();
      if (state.state !== 'IDLE' && state.state !== 'COMPLETE') {
        try {
          const partial = machine.buildRecord();
          if (partial) {
            partial.ignitionMeta.partial = true;
            partial.ignitionMeta.reconnectInterrupted = true;
            this.totalCompletedHands++;
            this.onHandComplete(partial);
            machine.completedHandCount++;
          }
        } catch (e) {
          this.onError(e, { connId, op: 'disconnect_partial' });
        }
      }
      this.tables.delete(connId);
      this.connectionUrls.delete(connId);
      for (const [url, cid] of this.urlToConnId) {
        if (cid === connId) {
          this.urlToConnId.delete(url);
          break;
        }
      }
      this._disconnectedCount = Math.max(0, this._disconnectedCount - 1);
      reaped++;
    }
    return reaped;
  }

  /**
   * Flush every disconnected table immediately, ignoring the grace window.
   * Called on teardown (page unload / capture stop) — there will be no
   * reconnect, and an un-emitted partial would be lost with the page.
   */
  flushDisconnected() {
    return this.reapDisconnected(0, Date.now());
  }

  getTableStates() {
    const states = {};
    for (const [connId, machine] of this.tables) {
      states[connId] = {
        ...machine.getState(),
        // Stable across reconnects — consumers must key table identity on this,
        // never on connId, which is a per-socket counter.
        tableKey: machine.tableKey || `table_${connId}`,
        disconnected: !!machine.disconnectedAt,
      };
    }
    return states;
  }

  getCompletedHandCount() { return this.totalCompletedHands; }
  getTableCount() { return this.tables.size; }

  getHSM(connId) {
    return this.tables.get(String(connId));
  }

  /** Connection ids of all live tables (for reconnect re-push). */
  getConnIds() {
    return [...this.tables.keys()];
  }

  getDiagnosticData() {
    const eventLogs = {};
    const tableConfigs = {};
    for (const [connId, hsm] of this.tables) {
      const log = hsm.getEventLog();
      if (log.length > 0) eventLogs[connId] = log;
      if (hsm.tableConfig) {
        tableConfigs[connId] = {
          gameType: hsm.gameType,
          ante: hsm.ante,
          raw: hsm.tableConfig,
        };
      }
    }
    return {
      eventLogs,
      lobbyMessages: this.lobbyLog,
      tableConfigs,
      batchedFrameCount: this.batchedFrameCount,
      totalParsedMessages: this.totalParsedMessages,
      pidCounts: { ...this.pidCounts },
    };
  }

  pruneStale(maxIdleMs) {
    const now = Date.now();
    // Close out anything whose reconnect grace window has expired first, so a
    // genuinely-gone table emits its partial rather than being silently pruned.
    let pruned = this.reapDisconnected(RECONNECT_GRACE_MS, now);
    for (const [connId, hsm] of this.tables) {
      if (hsm.state === 'IDLE' &&
          (now - (hsm.lastMessageTimestamp || hsm.startTimestamp || 0)) > maxIdleMs) {
        if (hsm.disconnectedAt) {
          this._disconnectedCount = Math.max(0, this._disconnectedCount - 1);
        }
        this.tables.delete(connId);
        this.connectionUrls.delete(connId);
        pruned++;
      }
    }
    for (const [url, cid] of this.urlToConnId) {
      if (!this.tables.has(cid)) {
        this.urlToConnId.delete(url);
      }
    }
    return pruned;
  }

}
