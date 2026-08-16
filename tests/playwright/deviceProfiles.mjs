/**
 * Device profiles for touch-floor enforcement (WS-441).
 *
 * THE one place a corrected device measurement changes. The galaxyS22 dpr is
 * PROVISIONAL — assumed, never measured on the actual phone. The founder can
 * read the real numbers any time from /device-probe.html on the S22 (Chrome,
 * landscape): update `dpr` here and re-run the touch-floor suite. The evidence
 * README (docs/design/evidence/2026-07-31-tvr-device-baseline/README.md) flags
 * s×DPR≈1.26 from a device photo, consistent with DPR 2 (s≈0.63–0.695) or
 * DPR 2.625 (s≈0.48–0.53). If the probe returns DPR > ~2.15, the WS-441
 * interim 64px controls fall below the floor again and their raises re-derive
 * from ceil(44 / s).
 */
export const TOUCH_FLOOR_CSS_PX = 44;

export const DEVICE_PROFILES = {
  // The app's own 1600×720 design canvas; the unconditional 0.95 fit margin
  // means even here nothing renders at its declared size (s = 0.95).
  designCanvas: {
    viewport: { width: 1600, height: 720 },
    note: 'design canvas, s=0.95',
  },
  // Founder's device: Samsung Galaxy S22, 2340×1080 physical.
  galaxyS22: {
    physical: { width: 2340, height: 1080 },
    dpr: 2, // PROVISIONAL — update from the founder's /device-probe.html reading
    get viewport() {
      return {
        width: Math.round(this.physical.width / this.dpr),
        height: Math.round(this.physical.height / this.dpr),
      };
    },
    note: 'S22 @ assumed DPR 2 → 1170×540 CSS, s≈0.695',
  },
};
