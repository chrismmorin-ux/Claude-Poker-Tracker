// @vitest-environment jsdom
/**
 * Tests for downscaleImageBlob.js — pre-Cropper bounding-box downscale.
 *
 * jsdom limitations:
 *   - HTMLCanvasElement.getContext('2d') is a stub; no real pixel rendering.
 *   - HTMLImageElement.onload doesn't fire automatically when src is set.
 *   - canvas.toBlob doesn't exist.
 *
 * We mock the Image constructor, getContext, and toBlob to assert the
 * FLOW (target dimensions computed correctly, original blob returned when
 * already-small, throws on toBlob null) without needing a real decoder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { downscaleImageBlob } from '../downscaleImageBlob';

let imageOnload = null;
let imageOnerror = null;
let lastImageInstance = null;

let drawImageArgs = null;
let toBlobArgs = null;
let toBlobOut = null;

beforeEach(() => {
  drawImageArgs = null;
  toBlobArgs = null;
  toBlobOut = new Blob(['downscaled-jpeg-bytes'], { type: 'image/jpeg' });
  imageOnload = null;
  imageOnerror = null;
  lastImageInstance = null;

  global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
  global.URL.revokeObjectURL = vi.fn();

  global.Image = class FakeImage {
    constructor() {
      lastImageInstance = this;
      this.naturalWidth = 4000;
      this.naturalHeight = 3000;
    }
    set onload(fn) { imageOnload = fn; }
    get onload() { return imageOnload; }
    set onerror(fn) { imageOnerror = fn; }
    get onerror() { return imageOnerror; }
    set src(_v) {
      // Fire onload async in next microtask, simulating decode complete.
      Promise.resolve().then(() => {
        if (imageOnload) imageOnload();
      });
    }
  };

  HTMLCanvasElement.prototype.getContext = vi.fn(function () {
    return {
      drawImage: (...args) => { drawImageArgs = args; },
    };
  });

  HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb, type, quality) {
    toBlobArgs = { type, quality };
    cb(toBlobOut);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('downscaleImageBlob', () => {
  it('returns a downscaled Blob when source exceeds maxEdge', async () => {
    const sourceBlob = new Blob(['big'], { type: 'image/jpeg' });
    const result = await downscaleImageBlob(sourceBlob, 1500);

    expect(result).toBe(toBlobOut);
    // 4000x3000 sourced; maxEdge 1500 → scale = 1500/4000 = 0.375 → 1500x1125.
    expect(drawImageArgs).not.toBeNull();
    expect(drawImageArgs[1]).toBe(0); // dx
    expect(drawImageArgs[2]).toBe(0); // dy
    expect(drawImageArgs[3]).toBe(1500); // dw
    expect(drawImageArgs[4]).toBe(1125); // dh
    expect(toBlobArgs.type).toBe('image/jpeg');
    expect(toBlobArgs.quality).toBe(0.92);
  });

  it('returns the original blob unchanged when source is already within maxEdge', async () => {
    // Override: small image
    global.Image = class FakeSmallImage {
      constructor() {
        this.naturalWidth = 800;
        this.naturalHeight = 600;
      }
      set onload(fn) { imageOnload = fn; }
      set onerror(fn) { imageOnerror = fn; }
      set src(_v) {
        Promise.resolve().then(() => imageOnload && imageOnload());
      }
    };

    const sourceBlob = new Blob(['small'], { type: 'image/jpeg' });
    const result = await downscaleImageBlob(sourceBlob, 1500);

    expect(result).toBe(sourceBlob);
    // Canvas was never asked to draw; drawImageArgs stays null.
    expect(drawImageArgs).toBeNull();
  });

  it('respects custom maxEdge parameter', async () => {
    const sourceBlob = new Blob(['big'], { type: 'image/jpeg' });
    await downscaleImageBlob(sourceBlob, 1000);

    // 4000x3000 sourced; maxEdge 1000 → scale = 1000/4000 = 0.25 → 1000x750.
    expect(drawImageArgs[3]).toBe(1000);
    expect(drawImageArgs[4]).toBe(750);
  });

  it('preserves landscape aspect when width is the dominant edge', async () => {
    global.Image = class FakeLandscapeImage {
      constructor() {
        this.naturalWidth = 4000;
        this.naturalHeight = 1000;
      }
      set onload(fn) { imageOnload = fn; }
      set onerror(fn) { imageOnerror = fn; }
      set src(_v) {
        Promise.resolve().then(() => imageOnload && imageOnload());
      }
    };

    const sourceBlob = new Blob(['big-landscape'], { type: 'image/jpeg' });
    await downscaleImageBlob(sourceBlob, 1500);

    // scale = min(1500/4000, 1500/1000) = 0.375 → 1500 × 375
    expect(drawImageArgs[3]).toBe(1500);
    expect(drawImageArgs[4]).toBe(375);
  });

  it('preserves portrait aspect when height is the dominant edge', async () => {
    global.Image = class FakePortraitImage {
      constructor() {
        this.naturalWidth = 1000;
        this.naturalHeight = 4000;
      }
      set onload(fn) { imageOnload = fn; }
      set onerror(fn) { imageOnerror = fn; }
      set src(_v) {
        Promise.resolve().then(() => imageOnload && imageOnload());
      }
    };

    const sourceBlob = new Blob(['big-portrait'], { type: 'image/jpeg' });
    await downscaleImageBlob(sourceBlob, 1500);

    // scale = min(1500/1000, 1500/4000) = 0.375 → 375 × 1500
    expect(drawImageArgs[3]).toBe(375);
    expect(drawImageArgs[4]).toBe(1500);
  });

  it('throws when sourceBlob is missing', async () => {
    await expect(downscaleImageBlob(null)).rejects.toThrow(/sourceBlob required/);
  });

  it('throws when image decode fails', async () => {
    global.Image = class FakeBadImage {
      constructor() {}
      set onload(fn) { imageOnload = fn; }
      set onerror(fn) { imageOnerror = fn; }
      set src(_v) {
        Promise.resolve().then(() => imageOnerror && imageOnerror());
      }
    };

    const sourceBlob = new Blob(['corrupt'], { type: 'image/jpeg' });
    await expect(downscaleImageBlob(sourceBlob, 1500)).rejects.toThrow(/image decode failed/);
  });

  it('throws when toBlob returns null', async () => {
    HTMLCanvasElement.prototype.toBlob = vi.fn(function (cb) {
      cb(null);
    });

    const sourceBlob = new Blob(['big'], { type: 'image/jpeg' });
    await expect(downscaleImageBlob(sourceBlob, 1500)).rejects.toThrow(/toBlob returned null/);
  });

  it('revokes its own object URL even when downscale fails', async () => {
    global.Image = class FakeFailingImage {
      constructor() {}
      set onload(fn) { imageOnload = fn; }
      set onerror(fn) { imageOnerror = fn; }
      set src(_v) {
        Promise.resolve().then(() => imageOnerror && imageOnerror());
      }
    };

    const sourceBlob = new Blob(['corrupt'], { type: 'image/jpeg' });
    await expect(downscaleImageBlob(sourceBlob, 1500)).rejects.toThrow();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
