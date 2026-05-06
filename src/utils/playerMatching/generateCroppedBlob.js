/**
 * @file generateCroppedBlob.js — render a user-positioned crop region of
 *   a source image into a square JPEG blob.
 *
 * Pairs with react-easy-crop's `onCropComplete(_, croppedAreaPixels)`
 * payload. The pixel-space crop rectangle is what's passed in. We draw
 * just that rectangle of the source image onto a square canvas and
 * export as JPEG at quality 0.92 (good size/quality tradeoff for
 * 256-512px portraits).
 *
 * Replaces the auto-crop pre-emptive cropToSquare path — the user now
 * positions the crop manually via pinch + drag in the modal.
 */

const TARGET_SIZE = 512; // square output edge in pixels

const loadImage = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.crossOrigin = 'anonymous';
    img.src = src;
  });

/**
 * @param {string} imageSrc - object URL or data URL of the source image
 * @param {{x: number, y: number, width: number, height: number}} cropPixels
 *   the rectangle of the source image that should become the output
 *   (from react-easy-crop's onCropComplete second argument)
 * @returns {Promise<Blob>} JPEG blob, square, sized to TARGET_SIZE
 */
export const generateCroppedBlob = async (imageSrc, cropPixels) => {
  if (!imageSrc) throw new Error('generateCroppedBlob: imageSrc required');
  if (!cropPixels) throw new Error('generateCroppedBlob: cropPixels required');

  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = TARGET_SIZE;
  canvas.height = TARGET_SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('generateCroppedBlob: 2d context unavailable');

  // Draw the source rectangle onto the full target canvas.
  ctx.drawImage(
    image,
    cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height,
    0, 0, TARGET_SIZE, TARGET_SIZE,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('generateCroppedBlob: toBlob returned null'));
      },
      'image/jpeg',
      0.92,
    );
  });
};
