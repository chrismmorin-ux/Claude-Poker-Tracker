/**
 * betaMath.js — shared Beta-Binomial posterior primitives (pokerCore).
 *
 * Pure math, ZERO engine imports. Lives in pokerCore so BOTH rangeEngine and
 * exploitEngine can depend on it without crossing the engine boundary
 * (rangeEngine must never import from exploitEngine — see rangeEngine/equityCache.js).
 *
 * Single source of truth for the regularized incomplete Beta function and
 * Beta posterior parameters. exploitEngine/bayesianConfidence.js re-exports
 * betaPosterior / betaCDF / betaQuantile from here — do NOT duplicate this math.
 *
 * Public API:
 *   betaPosterior(k, n, α, β)  — posterior parameters {alpha, beta, mean, variance}
 *   betaCDF(x, a, b)           — regularized incomplete Beta I_x(a, b) = P(X ≤ x)
 *   betaQuantile(p, α, β)      — inverse Beta CDF via bisection
 *   bayesianSampleConfidence(n) — continuous confidence from effective sample size
 */

/**
 * Compute posterior Beta parameters after observing k successes in n trials.
 * @param {number} k - Successes
 * @param {number} n - Trials
 * @param {number} priorAlpha - Prior α
 * @param {number} priorBeta  - Prior β
 * @returns {{ alpha: number, beta: number, mean: number, variance: number }}
 */
export const betaPosterior = (k, n, priorAlpha, priorBeta) => {
  const alpha = priorAlpha + k;
  const beta = priorBeta + (n - k);
  const total = alpha + beta;
  const mean = alpha / total;
  const variance = (alpha * beta) / (total * total * (total + 1));
  return { alpha, beta, mean, variance };
};

/**
 * Continued fraction for regularized incomplete Beta function (Numerical Recipes §6.4).
 * Evaluates the CF using modified Lentz's method.
 * Returns the CF value to multiply by the front factor.
 */
const betaContinuedFraction = (x, a, b) => {
  const maxIter = 200;
  const eps = 3e-12;
  const fpmin = 1e-30;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;

  let c = 1;
  let d = 1 - qab * x / qap;
  if (Math.abs(d) < fpmin) d = fpmin;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIter; m++) {
    // Even coefficient: a_{2m}
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    h *= d * c;

    // Odd coefficient: a_{2m+1}
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < fpmin) d = fpmin;
    c = 1 + aa / c;
    if (Math.abs(c) < fpmin) c = fpmin;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < eps) break;
  }

  return h;
};

/**
 * Log of Beta function B(a, b) = Γ(a)Γ(b)/Γ(a+b).
 */
const lnBeta = (a, b) => lnGamma(a) + lnGamma(b) - lnGamma(a + b);

/**
 * Log-gamma (Lanczos approximation, g=7).
 */
const lnGamma = (z) => {
  const g = 7;
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ];

  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
  }
  z -= 1;
  let x = c[0];
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i);
  }
  const t = z + g + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x);
};

/**
 * Regularized incomplete Beta function I_x(a, b).
 * P(X ≤ x) for Beta(a, b) distribution.
 * @param {number} x - Value in [0, 1]
 * @param {number} a - Shape parameter α > 0
 * @param {number} b - Shape parameter β > 0
 * @returns {number} CDF value in [0, 1]
 */
export const betaCDF = (x, a, b) => {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry relation when x > (a+1)/(a+b+2) for better convergence
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - betaCDF(1 - x, b, a);
  }

  // Front factor: x^a * (1-x)^b / (a * B(a,b))
  const lnFront = a * Math.log(x) + b * Math.log(1 - x) - lnBeta(a, b) - Math.log(a);
  const front = Math.exp(lnFront);

  return front * betaContinuedFraction(x, a, b);
};

/**
 * Inverse Beta CDF via bisection on betaCDF.
 * Returns x such that P(X ≤ x) = p for Beta(alpha, beta).
 *
 * @param {number} p - Target probability in (0, 1)
 * @param {number} alpha - Shape parameter α
 * @param {number} beta - Shape parameter β
 * @returns {number} Quantile value in [0, 1]
 */
export const betaQuantile = (p, alpha, beta) => {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let lo = 0, hi = 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (betaCDF(mid, alpha, beta) < p) lo = mid;
    else hi = mid;
    if (hi - lo < 1e-8) break;
  }
  return (lo + hi) / 2;
};

/**
 * Continuous confidence based on effective sample size (prior + observed).
 * Calibrated to approximate existing breakpoints:
 *   n=2 → ~0.23, n=5 → ~0.38, n=10 → ~0.57, n=20 → ~0.77, n=50 → ~0.92
 *
 * Exponential saturation: confidence = floor + ceiling * (1 - exp(-n / tau)),
 * capped at 0.95. The slight reduction at low n is DESIRED — the old step
 * function was too generous at n ≤ 5.
 *
 * Shared in pokerCore so BOTH engines may use it (rangeEngine must never import
 * from exploitEngine). exploitEngine/bayesianConfidence.js re-exports this.
 *
 * @param {number} n - Observed (effective) sample size
 * @param {number} [priorAlpha=1] - Prior α (unused in current calibration, reserved)
 * @param {number} [priorBeta=1]  - Prior β (unused in current calibration, reserved)
 * @returns {number} Confidence in [0, 1]
 */
export const bayesianSampleConfidence = (n, priorAlpha = 1, priorBeta = 1) => {
  if (n <= 0) return 0;
  const tau = 12;
  const floor = 0.10;
  const ceiling = 0.83;
  return Math.min(0.95, floor + ceiling * (1 - Math.exp(-n / tau)));
};
