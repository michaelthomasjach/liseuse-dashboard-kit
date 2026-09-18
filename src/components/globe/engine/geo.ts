/** Sphere math shared by the CPU side of the globe (the GPU side re-implements the same few
 *  formulas in GLSL — see shaders.ts, and keep the two in sync if you touch either). */

export const DEG = Math.PI / 180;

/** Unit-sphere vector for a lon/lat pair, in the renderer's own frame: +Y is the north pole and
 *  +Z points at the viewer for a camera centred on (0, 0). */
export function lonLatToVec3(lon: number, lat: number, out: Float32Array | number[] = [0, 0, 0]) {
  const p = lat * DEG;
  const l = lon * DEG;
  const cp = Math.cos(p);
  out[0] = cp * Math.sin(l);
  out[1] = Math.sin(p);
  out[2] = cp * Math.cos(l);
  return out;
}

/**
 * Rotation matrix (column-major, as WebGL wants it) putting (`lon`, `lat`) at the centre of the
 * disc: `Rx(lat) · Ry(-lon)`. Derived rather than guessed — substituting the centre's own vector
 * into that product collapses it to (0, 0, 1), which is the whole requirement.
 */
export function viewRotation(lon: number, lat: number, out = new Float32Array(9)) {
  const cl = Math.cos(-lon * DEG);
  const sl = Math.sin(-lon * DEG);
  const cp = Math.cos(lat * DEG);
  const sp = Math.sin(lat * DEG);

  // Ry(-lon) rows: [cl 0 sl; 0 1 0; -sl 0 cl]
  // Rx(lat)  rows: [1 0 0; 0 cp -sp; 0 sp cp]
  // R = Rx · Ry, written out row-wise then transposed into the column-major slots below.
  const r00 = cl;
  const r01 = 0;
  const r02 = sl;
  const r10 = sp * sl;
  const r11 = cp;
  const r12 = -sp * cl;
  const r20 = -cp * sl;
  const r21 = sp;
  const r22 = cp * cl;

  out[0] = r00; out[1] = r10; out[2] = r20;
  out[3] = r01; out[4] = r11; out[5] = r21;
  out[6] = r02; out[7] = r12; out[8] = r22;
  return out;
}

/** Applies a column-major mat3 to a vector. */
export function applyMat3(m: Float32Array, x: number, y: number, z: number, out: number[] = [0, 0, 0]) {
  out[0] = m[0] * x + m[3] * y + m[6] * z;
  out[1] = m[1] * x + m[4] * y + m[7] * z;
  out[2] = m[2] * x + m[5] * y + m[8] * z;
  return out;
}

/** Great-circle (central) angle between two lon/lat pairs, in radians. */
export function angularDistance(lonA: number, latA: number, lonB: number, latB: number): number {
  const a = lonLatToVec3(lonA, latA) as number[];
  const b = lonLatToVec3(lonB, latB) as number[];
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

/**
 * Default peak height for an arc, in sphere radii.
 *
 * Short hops stay close to the surface (a tall bump over a 200 km link reads as an error), long ones
 * lift clear of the globe so they do not disappear behind it for most of their length.
 *
 * The ceiling is deliberately low. At 0.4 radii a near-antipodal arc bows so far outside the
 * silhouette that it stops reading as a route over the surface and starts reading as a stray curve
 * floating next to the planet — the link between the two endpoints is exactly what is lost. 0.27
 * clears the limb while keeping the arc visibly attached to the globe.
 */
export function defaultAltitude(omega: number): number {
  return 0.05 + 0.22 * (omega / Math.PI);
}

/** Shortest signed delta between two longitudes, in degrees — so a camera pan from +170 to −170
 *  crosses the antimeridian (20°) instead of sweeping the long way round (340°). */
export function shortestLonDelta(from: number, to: number): number {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function normalizeLon(lon: number): number {
  let l = ((lon + 180) % 360 + 360) % 360 - 180;
  if (l === -180) l = 180;
  return l;
}

export function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

/** Cubic ease-in-out, used by every camera transition. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}
