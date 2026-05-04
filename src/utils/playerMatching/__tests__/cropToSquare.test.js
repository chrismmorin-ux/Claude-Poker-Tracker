// @vitest-environment jsdom
/**
 * @file Tests for cropToSquare.js — center-crop + JPEG re-encode.
 * Per WS-161 / SPR-036.
 *
 * Notes on test environment:
 *   - jsdom provides HTMLCanvasElement but its 2D context is a stub (no
 *     real pixel rendering). createImageBitmap is missing too.
 *   - We mock createImageBitmap + canvas behavior in this file. Real-pixel
 *     correctness is verified manually in the browser smoke test.
 *   - The mocks let us assert the FLOW (correct args passed, errors
 *     surfaced, options honored) without needing a real image decoder.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

let drawArgs = null;
let blobOut = null;

beforeEach(() => {
  drawArgs = null;
  blobOut = new Blob(['cropped-jpeg-bytes'], { type: 'image/jpeg' });

  // Mock createImageBitmap globally.
  global.createImageBitmap = vi.fn(async (file) => {
    if (!file || !(file instanceof Blob)) throw new Error('not a Blob');
    if (file.size === 0) throw new Error('decode failed');
    return {
      width: 800,
      height: 600,
      close: vi.fn(),
    };
  });

  // Mock OffscreenCanvas — global default available in modern node.
  global.OffscreenCanvas = class FakeOffscreenCanvas {
    constructor(w, h) { this.width = w; this.height = h; }
    getContext() {
      return {
        drawImage: (...args) => { drawArgs = args; },
      };
    }
    convertToBlob(opts) {
      return Promise.resolve(new Blob([blobOut], { type: opts?.type || 'image/jpeg' }));
    }
  };
});

afterEach(() => {
  delete global.createImageBitmap;
  delete global.OffscreenCanvas;
  drawArgs = null;
});

const { cropToSquare } = await import('../cropToSquare.js');

describe('cropToSquare — preconditions', () => {
  it('throws on non-Blob input', async () => {
    await expect(cropToSquare(null)).rejects.toThrow(/Blob/);
    await expect(cropToSquare('not-a-blob')).rejects.toThrow(/Blob/);
  });

  it('throws on invalid targetSize', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await expect(cropToSquare(blob, { targetSize: 0 })).rejects.toThrow(/targetSize/);
    await expect(cropToSquare(blob, { targetSize: -10 })).rejects.toThrow(/targetSize/);
  });

  it('throws on invalid quality', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' });
    await expect(cropToSquare(blob, { quality: 0 })).rejects.toThrow(/quality/);
    await expect(cropToSquare(blob, { quality: 1.5 })).rejects.toThrow(/quality/);
  });
});

describe('cropToSquare — center-crop math', () => {
  it('800×600 landscape: source region centered on 600×600', async () => {
    const blob = new Blob(['fake-bytes'], { type: 'image/jpeg' });
    await cropToSquare(blob, { targetSize: 256 });
    // drawImage(bitmap, sx, sy, sw, sh, dx, dy, dw, dh)
    expect(drawArgs).toBeTruthy();
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = drawArgs;
    expect(sx).toBe(100); // (800 - 600) / 2
    expect(sy).toBe(0);   // (600 - 600) / 2
    expect(sw).toBe(600);
    expect(sh).toBe(600);
    expect(dx).toBe(0);
    expect(dy).toBe(0);
    expect(dw).toBe(256);
    expect(dh).toBe(256);
  });

  it('square input: full image scaled', async () => {
    global.createImageBitmap = vi.fn(async () => ({ width: 1024, height: 1024, close: vi.fn() }));
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    await cropToSquare(blob, { targetSize: 256 });
    const [, sx, sy, sw, sh] = drawArgs;
    expect(sx).toBe(0);
    expect(sy).toBe(0);
    expect(sw).toBe(1024);
    expect(sh).toBe(1024);
  });

  it('tall portrait: source region centered vertically', async () => {
    global.createImageBitmap = vi.fn(async () => ({ width: 480, height: 800, close: vi.fn() }));
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    await cropToSquare(blob, { targetSize: 256 });
    const [, sx, sy, sw, sh] = drawArgs;
    expect(sx).toBe(0);   // (480 - 480) / 2
    expect(sy).toBe(160); // (800 - 480) / 2
    expect(sw).toBe(480);
    expect(sh).toBe(480);
  });
});

describe('cropToSquare — error surfacing', () => {
  it('rejects with descriptive error when decode fails', async () => {
    const emptyBlob = new Blob([], { type: 'image/jpeg' });
    await expect(cropToSquare(emptyBlob)).rejects.toThrow(/decode/);
  });

  it('rejects when source has zero dimension', async () => {
    global.createImageBitmap = vi.fn(async () => ({ width: 0, height: 0, close: vi.fn() }));
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    await expect(cropToSquare(blob)).rejects.toThrow(/zero dimension/);
  });
});

describe('cropToSquare — output', () => {
  it('returns a Blob with image/jpeg type', async () => {
    const blob = new Blob(['fake'], { type: 'image/jpeg' });
    const result = await cropToSquare(blob);
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('image/jpeg');
  });
});
