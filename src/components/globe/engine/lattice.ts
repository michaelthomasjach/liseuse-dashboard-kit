import { getLandMask, isLand } from "./landMask";

/** Interleaved `[x, y, z, weight]` per point, ready to upload as-is. */
export interface DotSet {
  data: Float32Array;
  count: number;
}

const landCache = new Map<number, DotSet>();
const latticeCache = new Map<number, DotSet>();

/**
 * Evenly spaced points on a unit sphere (Fibonacci / golden-angle spiral).
 *
 * Preferred over a lon/lat grid, which bunches points together at the poles: on a rotating globe
 * that reads as two bright caps and a sparse equator, and no amount of per-dot alpha hides it.
 */
function fibonacciSphere(count: number, visit: (x: number, y: number, z: number, lon: number, lat: number) => void) {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const rad = 180 / Math.PI;
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = goldenAngle * i;
    const x = Math.cos(theta) * r;
    const z = Math.sin(theta) * r;
    visit(x, y, z, Math.atan2(x, z) * rad, Math.asin(y) * rad);
  }
}

/**
 * The bright dot cloud over landmasses.
 *
 * `samples` candidates are spread over the whole sphere and roughly 29% of them survive the land
 * test, so ask for about 3.5x the number of dots you actually want.
 */
export function buildLandDots(samples: number): DotSet {
  const hit = landCache.get(samples);
  if (hit) return hit;

  const mask = getLandMask();
  const xs: number[] = [];
  fibonacciSphere(samples, (x, y, z, lon, lat) => {
    if (!isLand(mask, lon, lat)) return;
    xs.push(x, y, z, 1);
  });

  // No mask (SSR, or a webview that refuses getImageData) means no land dots at all rather than a
  // wrong-looking sphere; the lattice below still renders and the globe stays usable.
  const set: DotSet = { data: new Float32Array(xs), count: xs.length / 4 };
  landCache.set(samples, set);
  return set;
}

/** The faint all-over lattice that gives the sphere its structure, oceans included. */
export function buildLattice(count: number, weight = 0.32): DotSet {
  const hit = latticeCache.get(count);
  if (hit) return hit;

  const data = new Float32Array(count * 4);
  let i = 0;
  fibonacciSphere(count, (x, y, z) => {
    data[i++] = x;
    data[i++] = y;
    data[i++] = z;
    data[i++] = weight;
  });

  const set: DotSet = { data, count };
  latticeCache.set(count, set);
  return set;
}
