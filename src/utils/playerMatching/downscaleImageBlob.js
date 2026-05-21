/**
 * @file downscaleImageBlob.js — bounding-box downscale a source image Blob
 *   to a safe maximum edge BEFORE it ever reaches the Cropper or canvas
 *   crop op.
 *
 * Why this exists (WS-184 / SPR-076): mobile camera inputs hand back raw
 * sensor files (Galaxy A22 = 13MP → ~4000×3000 ≈ 48MB decoded). Loading
 * that into the Cropper + cropping into a 512×512 canvas can OOM on
 * memory-constrained mobile browsers. Downscaling at file-pick time
 * makes the OOM path structurally improbable rather than a routine
 * failure mode.
 *
 * If the source is already within maxEdge on both dimensions, the
 * original blob is returned unchanged (no re-encode).
 */

const DEFAULT_MAX_EDGE = 1500;
const JPEG_QUALITY = 0.92;

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('downscaleImageBlob: image decode failed'));
    img.src = src;
  });

/**
 * @param {Blob | File} sourceBlob - the file/blob from the camera or upload input
 * @param {number} [maxEdge=1500] - bounding-box max for either dimension
 * @returns {Promise<Blob>} a Blob no larger than maxEdge × maxEdge; the same
 *   reference as `sourceBlob` if it's already within bounds
 */
export const downscaleImageBlob = async (sourceBlob, maxEdge = DEFAULT_MAX_EDGE) => {
  if (!sourceBlob) throw new Error('downscaleImageBlob: sourceBlob required');

  const url = URL.createObjectURL(sourceBlob);
  try {
    const img = await loadImage(url);
    const w = img.naturalWidth;
    const h = img.naturalHeight;

    if (w <= maxEdge && h <= maxEdge) {
      return sourceBlob;
    }

    const scale = Math.min(maxEdge / w, maxEdge / h);
    const targetW = Math.max(1, Math.round(w * scale));
    const targetH = Math.max(1, Math.round(h * scale));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('downscaleImageBlob: 2d context unavailable');

    ctx.drawImage(img, 0, 0, targetW, targetH);

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('downscaleImageBlob: toBlob returned null'));
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};
