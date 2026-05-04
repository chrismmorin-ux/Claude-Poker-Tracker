/**
 * @file cropToSquare.js — center-crop an image Blob to a square JPEG.
 *
 * Used by CameraCaptureModal (WS-161 / SPR-036) to normalize captured photos
 * to a deterministic shape (256×256 JPEG @ 0.85 quality) before atomic
 * write to IDB.
 *
 * Per `docs/design/surfaces/camera-capture-modal.md` — Stage 2 (crop preview).
 *
 * Locked owner choice: 256×256 default, JPEG quality 0.85. ~15-25 KB per blob.
 *
 * SPR-036 / WS-161 (2026-05-04).
 */

/**
 * Center-crop a source image Blob to a square + downscale + JPEG-encode.
 *
 * @param {Blob} file - any decodable image Blob (JPEG/PNG/HEIC; browser handles)
 * @param {object} [options]
 * @param {number} [options.targetSize=256] - output edge length in pixels
 * @param {number} [options.quality=0.85] - JPEG quality 0..1
 * @returns {Promise<Blob>} - JPEG Blob of size targetSize × targetSize
 */
export const cropToSquare = async (file, options = {}) => {
  if (!file || !(file instanceof Blob)) {
    throw new Error('cropToSquare requires a Blob');
  }

  const targetSize = options.targetSize ?? 256;
  const quality = options.quality ?? 0.85;

  if (typeof targetSize !== 'number' || targetSize <= 0) {
    throw new Error('cropToSquare targetSize must be > 0');
  }
  if (typeof quality !== 'number' || quality <= 0 || quality > 1) {
    throw new Error('cropToSquare quality must be in (0, 1]');
  }

  // Decode the source image. createImageBitmap handles JPEG/PNG/WebP/AVIF
  // and on iOS Safari converts HEIC to a renderable bitmap.
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (e) {
    throw new Error(`cropToSquare could not decode image: ${e?.message || e}`);
  }

  const minDim = Math.min(bitmap.width, bitmap.height);
  if (minDim <= 0) {
    throw new Error('cropToSquare: source image has zero dimension');
  }

  // Center-crop region in source coords.
  const sx = (bitmap.width - minDim) / 2;
  const sy = (bitmap.height - minDim) / 2;

  // Prefer OffscreenCanvas (browser-thread safe + worker-friendly). Fall back
  // to HTMLCanvasElement for older runtimes (e.g., test environments without
  // OffscreenCanvas polyfill).
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(targetSize, targetSize);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
    bitmap.close?.();
    return canvas.convertToBlob({ type: 'image/jpeg', quality });
  }

  // Fallback: HTMLCanvasElement + canvas.toBlob.
  const canvas = document.createElement('canvas');
  canvas.width = targetSize;
  canvas.height = targetSize;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
  bitmap.close?.();
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('cropToSquare: canvas.toBlob returned null'));
      },
      'image/jpeg',
      quality,
    );
  });
};
