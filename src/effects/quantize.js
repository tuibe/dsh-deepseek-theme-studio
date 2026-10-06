/**
 * Quantisation helpers (量子化).
 *
 * Q2's colour quantisation runs on the GPU (see fluid-shaders.js). These are
 * the CPU-side pieces:
 *   - `BAYER4` / `bayer4()`: the same ordered-dither matrix in JavaScript, so
 *     the JS and GLSL sides cannot drift apart, and so the matrix is testable
 *     without a GPU.
 *   - `quantizeStep()`: Q4 state quantisation — a signal that would otherwise
 *     interpolate continuously is snapped to N discrete steps.
 *
 * PROVENANCE
 *   The Bayer ordering is the classic 4x4 matrix taken from the MIT package
 *   `glsl-dither@1.0.1` (hughsk/glsl-dither), whose 4x4.glsl lists the 16
 *   thresholds. Upstream normalises as (m + 1) / 16 because it only performs a
 *   1-bit `brightness < limit` test; a multi-level quantiser needs the
 *   unbiased (m + 0.5) / 16 form used here. See REUSE.md §0.4.3.
 */

/** Bayer 4x4 matrix, normalised to [0, 1). */
export const BAYER4 = [
  0.03125, 0.53125, 0.15625, 0.65625,
  0.78125, 0.28125, 0.90625, 0.40625,
  0.21875, 0.71875, 0.09375, 0.59375,
  0.96875, 0.46875, 0.84375, 0.34375,
]

/** Threshold at one integer pixel position. */
export function bayer4(x, y) {
  const ix = ((Math.trunc(x) % 4) + 4) % 4
  const iy = ((Math.trunc(y) % 4) + 4) % 4
  return BAYER4[iy * 4 + ix]
}

/**
 * Snap a 0..1 signal to `steps` discrete levels.
 * Used by Q4 wherever the UI would otherwise interpolate smoothly.
 */
export function quantizeStep(value, steps) {
  if (!Number.isFinite(steps) || steps < 2) return value
  const clamped = Math.min(1, Math.max(0, value))
  return Math.round(clamped * (steps - 1)) / (steps - 1)
}

/** Quantise one colour channel to `levels` steps with an explicit dither offset. */
export function quantizeChannel(value, levels, offset = 0) {
  if (!Number.isFinite(levels) || levels < 2) return value
  const stepCount = levels - 1
  return Math.min(1, Math.max(0, Math.floor(value * stepCount + offset + 0.5) / stepCount))
}
