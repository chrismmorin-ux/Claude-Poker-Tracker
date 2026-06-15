/**
 * port-connect.test.js — reconnection backoff.
 *
 * Regression for the lifetime-counter bug: the backoff delay was derived from
 * a connectCount that only ever grew and never reset on a healthy connection,
 * so after a handful of reconnect cycles every retry waited the full maxDelay
 * (~30s). That stranded the app-bridge disconnected for long stretches
 * (appConnected=false → no advice). The fix resets the consecutive-failure
 * count once a connection stays up for STABLE_MS.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

function makeChrome() {
  const c = {
    runtime: {
      lastError: null,
      connect: vi.fn((opts) => {
        const port = {
          name: opts.name,
          onMessage: { addListener: vi.fn() },
          onDisconnect: { addListener: (cb) => { port._fireDisconnect = cb; } },
          postMessage: vi.fn(),
          disconnect: vi.fn(),
        };
        c._lastPort = port;
        return port;
      }),
    },
    _lastPort: null,
  };
  return c;
}

describe('port-connect reconnection backoff', () => {
  let chromeStub, createPortConnection;
  beforeEach(async () => {
    vi.useFakeTimers();
    chromeStub = makeChrome();
    globalThis.chrome = chromeStub;
    vi.resetModules();
    ({ createPortConnection } = await import('../port-connect.js'));
  });
  afterEach(() => { vi.useRealTimers(); });

  const connectCalls = () => chromeStub.runtime.connect.mock.calls.length;

  it('resets the backoff to initialDelay after a connection stays up past STABLE_MS', () => {
    createPortConnection({ name: 'test', initialDelay: 1000, maxDelay: 30000 });
    expect(connectCalls()).toBe(1); // auto-connect

    // Two rapid drops (never stable) → delays grow 1000, then 1500.
    chromeStub._lastPort._fireDisconnect();
    vi.advanceTimersByTime(999); expect(connectCalls()).toBe(1);
    vi.advanceTimersByTime(1);   expect(connectCalls()).toBe(2);

    chromeStub._lastPort._fireDisconnect();
    vi.advanceTimersByTime(1499); expect(connectCalls()).toBe(2);
    vi.advanceTimersByTime(1);    expect(connectCalls()).toBe(3);

    // Stay connected past STABLE_MS (3000ms) → healthy → backoff resets.
    vi.advanceTimersByTime(3000);

    // Next drop retries at initialDelay again, NOT the grown delay.
    chromeStub._lastPort._fireDisconnect();
    vi.advanceTimersByTime(999); expect(connectCalls()).toBe(3);
    vi.advanceTimersByTime(1);   expect(connectCalls()).toBe(4);
  });

  it('grows the backoff across consecutive rapid drops (no premature reset)', () => {
    createPortConnection({ name: 'test', initialDelay: 1000, maxDelay: 30000 });

    chromeStub._lastPort._fireDisconnect(); vi.advanceTimersByTime(1000); // 1000
    chromeStub._lastPort._fireDisconnect(); vi.advanceTimersByTime(1500); // 1500
    chromeStub._lastPort._fireDisconnect();                               // next = 2250
    vi.advanceTimersByTime(2249); expect(connectCalls()).toBe(3);
    vi.advanceTimersByTime(1);    expect(connectCalls()).toBe(4);
  });
});
