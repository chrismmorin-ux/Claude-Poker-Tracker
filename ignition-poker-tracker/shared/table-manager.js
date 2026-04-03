/**
 * shared/table-manager.js — Multi-table coordinator
 *
 * Maps WebSocket connections to HandStateMachine instances.
 * Filters non-game connections. Handles table lifecycle.
 */

import * as protocol from './protocol.js';
import { HandStateMachine } from './hand-state-machine.js';

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
        const oldMachine = this.tables.get(oldConnId);
        if (oldMachine.state === 'IDLE' || oldMachine.state === 'COMPLETE') {
          machine = oldMachine;
          this.tables.delete(oldConnId);
          machine.connId = connId;
          this.tables.set(connId, machine);
          this.connectionUrls.delete(oldConnId);
        } else {
          try {
            const partial = oldMachine.buildRecord();
            if (partial) {
              partial.ignitionMeta.partial = true;
              partial.ignitionMeta.reconnectInterrupted = true;
              this.totalCompletedHands++;
              this.onHandComplete(partial);
              oldMachine.completedHandCount++;
            }
          } catch (e) {
            this.onError(e, { connId: oldConnId, op: 'reconnect_partial' });
          }
          this.tables.delete(oldConnId);
          this.connectionUrls.delete(oldConnId);
          for (const [url, cid] of this.urlToConnId) {
            if (cid === oldConnId) { this.urlToConnId.delete(url); break; }
          }
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
      this.tables.set(connId, machine);
    }

    machine.processMessage(parsed.pid, parsed.payload);
  }

  handleConnectionClosed(connId) {
    connId = String(connId);
    const machine = this.tables.get(connId);
    if (machine) {
      const state = machine.getState();
      if (state.state !== 'IDLE' && state.state !== 'COMPLETE') {
        // Emit partial record before cleanup (same pattern as reconnection path)
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
      for (const [url, cid] of this.urlToConnId) {
        if (cid === connId) {
          this.urlToConnId.delete(url);
          break;
        }
      }
    }
    this.connectionUrls.delete(connId);
  }

  getTableStates() {
    const states = {};
    for (const [connId, machine] of this.tables) {
      states[connId] = machine.getState();
    }
    return states;
  }

  getCompletedHandCount() { return this.totalCompletedHands; }
  getTableCount() { return this.tables.size; }

  getHSM(connId) {
    return this.tables.get(String(connId));
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
    let pruned = 0;
    for (const [connId, hsm] of this.tables) {
      if (hsm.state === 'IDLE' &&
          (now - (hsm.lastMessageTimestamp || hsm.startTimestamp || 0)) > maxIdleMs) {
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
