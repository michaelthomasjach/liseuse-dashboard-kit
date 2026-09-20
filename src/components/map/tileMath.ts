/**
 * Web Mercator, the projection every slippy map speaks.
 *
 * Kept apart from the component so the arithmetic can be read — and tested — without a canvas. It
 * is the part where a sign error produces a map that looks plausible and is wrong.
 */

/** Side of a tile in CSS pixels, at scale 1. Every raster provider in this family uses 256. */
export const TILE_SIZE = 256;

/**
 * The latitude Web Mercator stops at, in degrees.
 *
 * The projection sends the poles to infinity, so every implementation truncates. 85.0511° is where
 * the world becomes exactly square, which is what makes tile `z/0/0` cover it all — picking any
 * other bound would leave the top row of tiles half empty.
 */
export const MAX_LATITUDE = 85.05112878;

export function clampLatitude(lat: number): number {
  return Math.max(-MAX_LATITUDE, Math.min(MAX_LATITUDE, lat));
}

/** Longitude wrapped into [-180, 180). Panning east past the antimeridian must not run off. */
export function wrapLongitude(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180;
}

/** Horizontal position in tile units at `zoom`: 0 at the antimeridian, 2^zoom at the far side. */
export function lonToTileX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 2 ** zoom;
}

/** Vertical position in tile units. Grows southward, which is why the formula subtracts from 1. */
export function latToTileY(lat: number, zoom: number): number {
  const rad = (clampLatitude(lat) * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom;
}

export function tileXToLon(x: number, zoom: number): number {
  return (x / 2 ** zoom) * 360 - 180;
}

export function tileYToLat(y: number, zoom: number): number {
  const n = Math.PI - 2 * Math.PI * (y / 2 ** zoom);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

/** Fills `{z}/{x}/{y}` and `{s}` in a tile template. */
export function formatTileUrl(template: string, z: number, x: number, y: number, subdomain: string): string {
  return template
    .replace("{z}", String(z))
    .replace("{x}", String(x))
    .replace("{y}", String(y))
    .replace("{s}", subdomain);
}
