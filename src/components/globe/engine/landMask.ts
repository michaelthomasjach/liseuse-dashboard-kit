import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
// Deliberately the *countries* topology rather than world-atlas's own `land-110m.json`, even
// though a single land multipolygon would be marginally cheaper to rasterise: `WorldExposureMap`
// already imports this exact path, and Vite force-inlines every asset as base64 in library mode
// (see vite.config.lib.ts's own note). Sharing the import keeps one copy in the bundle; pulling
// in land-110m would add a second ~100 KB payload for the same pixels.
import countries110mRaw from "world-atlas/countries-110m.json";

const countries110m = countries110mRaw as unknown as Topology<{ countries: GeometryCollection }>;

/** Width of the equirectangular land raster. 110m data carries nowhere near enough detail to
 *  reward going finer, and this is sampled tens of thousands of times at startup. */
const MASK_W = 1024;
const MASK_H = 512;

let cached: Uint8Array | null = null;
let cacheFailed = false;

/**
 * A 1-bit equirectangular land raster, built once per page and shared by every globe instance.
 *
 * Rasterising and sampling beats testing each candidate point against the polygons directly: the
 * dot lattice asks ~40 000 "is this land?" questions at startup, which is a few milliseconds of
 * texture lookups here versus a full point-in-polygon sweep over ~4 000 rings each time.
 */
export function getLandMask(): Uint8Array | null {
  if (cached) return cached;
  if (cacheFailed) return null;
  if (typeof document === "undefined") return null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = MASK_W;
    canvas.height = MASK_H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      cacheFailed = true;
      return null;
    }

    const land = feature(countries110m, countries110m.objects.countries) as GeoJSON.FeatureCollection;

    // `geoEquirectangular` with this exact scale/translate is what makes the sampling below a
    // plain (lon, lat) → (col, row) affine map rather than a projection call per sample.
    const projection = d3
      .geoEquirectangular()
      .scale(MASK_W / (2 * Math.PI))
      .translate([MASK_W / 2, MASK_H / 2]);

    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, MASK_W, MASK_H);
    ctx.fillStyle = "#fff";
    const path = d3.geoPath(projection, ctx);
    ctx.beginPath();
    path(land);
    ctx.fill();

    const { data } = ctx.getImageData(0, 0, MASK_W, MASK_H);
    const mask = new Uint8Array(MASK_W * MASK_H);
    for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
      mask[i] = data[p] > 127 ? 1 : 0;
    }
    cached = mask;
    return mask;
  } catch {
    // A locked-down canvas (some embedded webviews taint or refuse getImageData) must not take
    // the whole globe down — callers fall back to an undifferentiated lattice.
    cacheFailed = true;
    return null;
  }
}

/** Samples the raster. Returns false when the mask could not be built. */
export function isLand(mask: Uint8Array | null, lon: number, lat: number): boolean {
  if (!mask) return false;
  const x = Math.floor(((lon + 180) / 360) * MASK_W);
  const y = Math.floor(((90 - lat) / 180) * MASK_H);
  if (x < 0 || x >= MASK_W || y < 0 || y >= MASK_H) return false;
  return mask[y * MASK_W + x] === 1;
}
