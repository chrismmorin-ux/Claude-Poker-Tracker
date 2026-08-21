/**
 * port-slot-identity.test.js — the stale-disconnect clobber (2026-08-21).
 *
 * The service worker holds `sidePanelPort` and `appBridgePort` as single slots.
 * Their `onDisconnect` handlers used to clear the slot unconditionally:
 *
 *     port.onDisconnect.addListener(() => { sidePanelPort = null; });
 *
 * Chrome delivers the OLD port's disconnect AFTER the replacement's connect on a
 * reload, so the sequence connect(A) → connect(B) → disconnect(A) left the slot
 * null while B was live and connected. `pushToSidePanel` then early-returned at
 * `if (!sidePanelPort) return` forever.
 *
 * The failure is asymmetric, which is what makes it hard to read off the
 * symptoms: `capturePorts` is a Set and deletes by identity, so capture kept
 * saving hands normally while the panel went dark. It presents as "the sidebar
 * is broken but the hands are fine" rather than as a connection fault.
 *
 * Reloads are the normal case, not an edge one — every `npm run build` plus
 * extension reload forces one, and so does opening the panel in a second window.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const EXT_ID = 'test-extension-id';

const makePort = (name) => {
  const port = {
    name,
    // RT-21: the SW rejects any port whose sender is not this extension.
    sender: { id: EXT_ID },
    disconnect: vi.fn(),
    postMessage: vi.fn(),
    _msgHandlers: [],
    _discHandlers: [],
    onMessage: { addListener: (fn) => port._msgHandlers.push(fn) },
    onDisconnect: { addListener: (fn) => port._discHandlers.push(fn) },
    _send: (msg) => port._msgHandlers.forEach((h) => h(msg)),
    _disconnect: () => port._discHandlers.forEach((h) => h()),
  };
  return port;
};

const installChromeMock = () => {
  const connectListeners = [];
  const noop = () => {};
  const store = () => ({
    get: vi.fn(async () => ({})),
    set: vi.fn(async () => {}),
    remove: vi.fn(async () => {}),
  });
  globalThis.chrome = {
    runtime: {
      id: EXT_ID,
      getManifest: () => ({ version: '0.9.0' }),
      onConnect: { addListener: (fn) => connectListeners.push(fn) },
      onMessage: { addListener: noop },
      onInstalled: { addListener: noop },
      onStartup: { addListener: noop },
      lastError: null,
    },
    storage: {
      local: store(),
      session: { ...store(), setAccessLevel: vi.fn(async () => {}) },
      onChanged: { addListener: noop },
    },
    action: { setBadgeText: vi.fn(async () => {}), setBadgeBackgroundColor: vi.fn(async () => {}) },
    tabs: {
      create: vi.fn(async () => ({ id: 1 })),
      query: vi.fn(async () => []),
      reload: vi.fn(async () => {}),
    },
    sidePanel: { setPanelBehavior: vi.fn(async () => {}) },
    alarms: { create: noop, onAlarm: { addListener: noop } },
  };
  return { connect: (port) => connectListeners.forEach((fn) => fn(port)) };
};

let harness;

beforeEach(async () => {
  vi.resetModules();
  harness = installChromeMock();
  await import('../service-worker.js');
});

/** Drive a synchronous side-panel push and return the messages it produced. */
const pumpPipelineStatus = (capturePort, panelPort) => {
  panelPort.postMessage.mockClear();
  capturePort._send({
    type: 'pipeline_status',
    status: { tables: {}, tableCount: 1, completedHands: 3 },
  });
  return panelPort.postMessage.mock.calls.map(([m]) => m);
};

describe('side-panel port slot survives a stale disconnect', () => {
  it('keeps pushing to the live panel when the replaced panel disconnects late', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);

    const panelA = makePort('side-panel');
    harness.connect(panelA);

    // Panel reloads: the new port connects BEFORE the old one reports disconnect.
    const panelB = makePort('side-panel');
    harness.connect(panelB);
    panelA._disconnect();

    const pushed = pumpPipelineStatus(capture, panelB);
    expect(pushed.map((m) => m.type)).toContain('push_pipeline_status');
  });

  it('still clears the slot when the CURRENT panel disconnects', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);

    const panel = makePort('side-panel');
    harness.connect(panel);
    panel._disconnect();

    expect(pumpPipelineStatus(capture, panel)).toEqual([]);
  });
});

describe('every connected client receives pushes', () => {
  it('pushes to all open side panels, not just the newest', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);

    const panelA = makePort('side-panel');
    const panelB = makePort('side-panel');
    harness.connect(panelA);
    harness.connect(panelB);

    // Under the old single slot, B took the slot and A went silent while still
    // showing as connected — a second window's panel simply stopped updating.
    for (const panel of [panelA, panelB]) {
      expect(pumpPipelineStatus(capture, panel).map((m) => m.type))
        .toContain('push_pipeline_status');
    }
  });

  it('one panel closing does not silence the other', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);

    const panelA = makePort('side-panel');
    const panelB = makePort('side-panel');
    harness.connect(panelA);
    harness.connect(panelB);
    panelA._disconnect();

    expect(pumpPipelineStatus(capture, panelB).map((m) => m.type))
      .toContain('push_pipeline_status');
    expect(pumpPipelineStatus(capture, panelA)).toEqual([]);
  });

  it('appConnected stays true until the LAST app tab closes', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);
    const panel = makePort('side-panel');
    harness.connect(panel);

    const bridgeA = makePort('app-bridge');
    const bridgeB = makePort('app-bridge');
    harness.connect(bridgeA);
    harness.connect(bridgeB);

    const appConnected = () => pumpPipelineStatus(capture, panel)
      .find((m) => m.type === 'push_pipeline_status').appConnected;

    expect(appConnected()).toBe(true);
    bridgeA._disconnect();
    expect(appConnected()).toBe(true);   // bridgeB is still there
    bridgeB._disconnect();
    expect(appConnected()).toBe(false);
  });

  it('pushes hands to every bridged app tab', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);

    const bridgeA = makePort('app-bridge');
    const bridgeB = makePort('app-bridge');
    harness.connect(bridgeA);
    harness.connect(bridgeB);
    bridgeA.postMessage.mockClear();
    bridgeB.postMessage.mockClear();

    capture._send({ type: 'live_context', context: { currentStreet: 'flop', heroSeat: 3 } });

    for (const bridge of [bridgeA, bridgeB]) {
      expect(bridge.postMessage.mock.calls.map(([m]) => m.type))
        .toContain('push_live_context');
    }
  });
});

describe('refresh button repairs a dead side-panel slot', () => {
  it('re-adopts the sending port on request_full_state', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);

    const panel = makePort('side-panel');
    harness.connect(panel);

    // Force the slot dead by any means — here, the panel's own disconnect —
    // while the port object itself stays usable, which is the real-world shape:
    // the SW's reference is gone but the panel is alive and connected.
    panel._disconnect();
    expect(pumpPipelineStatus(capture, panel)).toEqual([]);

    // Founder clicks ⟳.
    panel._send({ type: 'request_full_state' });

    const pushed = pumpPipelineStatus(capture, panel);
    expect(pushed.map((m) => m.type)).toContain('push_pipeline_status');
  });
});

describe('app-bridge port slot survives a stale disconnect', () => {
  it('reports appConnected while a live bridge is connected', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);
    const panel = makePort('side-panel');
    harness.connect(panel);

    // Two app tabs is the normal case — the SW opens one itself via
    // ensureAppTabOpen, so any tab opened by hand is a second one.
    const bridgeA = makePort('app-bridge');
    harness.connect(bridgeA);
    const bridgeB = makePort('app-bridge');
    harness.connect(bridgeB);
    bridgeA._disconnect();

    const status = pumpPipelineStatus(capture, panel)
      .find((m) => m.type === 'push_pipeline_status');
    expect(status).toBeDefined();
    expect(status.appConnected).toBe(true);
  });

  it('reports appConnected false once the live bridge disconnects', () => {
    const capture = makePort('ignition-capture');
    harness.connect(capture);
    const panel = makePort('side-panel');
    harness.connect(panel);

    const bridge = makePort('app-bridge');
    harness.connect(bridge);
    bridge._disconnect();

    const status = pumpPipelineStatus(capture, panel)
      .find((m) => m.type === 'push_pipeline_status');
    expect(status.appConnected).toBe(false);
  });
});
