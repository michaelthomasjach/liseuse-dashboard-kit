/**
 * Country outlines, for the hover highlight.
 *
 * Separate from `landMask.ts` even though both start from the same topology: the mask answers "is
 * this pixel land?" and throws the geometry away, while this needs the rings themselves, per
 * country, to stroke one of them. Both are lazy and both are cached for the life of the page, so a
 * globe that never enables country hover never pays for any of it.
 */
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import countries110mRaw from "world-atlas/countries-110m.json";

const countries110m = countries110mRaw as unknown as Topology<{ countries: GeometryCollection }>;

/** One country, in the form the renderer and the hit-test need it. */
export interface CountryShape {
  /** ISO 3166-1 numeric, as the atlas carries it — "250" for France. Zero-padded. */
  id: string;
  /** The atlas's own English name. Products that show it are expected to localise it themselves. */
  name: string;
  /** [west, south, east, north]. `west > east` when the shape straddles the antimeridian. */
  bounds: [number, number, number, number];
  /** Every ring — outer boundaries and holes alike — flattened to [lon, lat, lon, lat, …]. */
  rings: Float64Array[];
  /** Kept for the point-in-polygon test, which d3 does on the sphere rather than on a projection. */
  feature: GeoJSON.Feature;
}

let cachedFeatures: GeoJSON.FeatureCollection | null = null;
let cached: CountryShape[] | null = null;
let cacheFailed = false;

/**
 * The parsed country features, built once per page.
 *
 * Shared with `landMask`, which rasterises the same collection: decoding the topology is the
 * expensive half of both jobs, and paying for it twice would put a visible hitch on the first
 * pointer move over the globe.
 */
export function getCountryFeatures(): GeoJSON.FeatureCollection {
  if (!cachedFeatures) {
    cachedFeatures = feature(countries110m, countries110m.objects.countries) as GeoJSON.FeatureCollection;
  }
  return cachedFeatures;
}

function flattenRings(geometry: GeoJSON.Geometry, out: Float64Array[]) {
  const push = (ring: GeoJSON.Position[]) => {
    const flat = new Float64Array(ring.length * 2);
    for (let i = 0; i < ring.length; i++) {
      flat[i * 2] = ring[i][0];
      flat[i * 2 + 1] = ring[i][1];
    }
    out.push(flat);
  };
  if (geometry.type === "Polygon") {
    for (const ring of geometry.coordinates) push(ring);
  } else if (geometry.type === "MultiPolygon") {
    for (const polygon of geometry.coordinates) for (const ring of polygon) push(ring);
  }
}

/**
 * Builds the country list once per page and shares it between every globe instance.
 *
 * Returns `null` rather than throwing if the topology cannot be read: the borders are an
 * enhancement, and a globe with no highlight is far better than a globe that does not start.
 */
export function getCountries(): CountryShape[] | null {
  if (cached) return cached;
  if (cacheFailed) return null;

  try {
    const collection = getCountryFeatures();
    const shapes: CountryShape[] = [];
    for (const f of collection.features) {
      if (!f.geometry) continue;
      const rings: Float64Array[] = [];
      flattenRings(f.geometry, rings);
      if (rings.length === 0) continue;
      const [[west, south], [east, north]] = d3.geoBounds(f);
      shapes.push({
        id: String(f.id ?? ""),
        name: String((f.properties as { name?: string } | null)?.name ?? ""),
        bounds: [west, south, east, north],
        rings,
        feature: f,
      });
    }
    cached = shapes;
    return shapes;
  } catch {
    cacheFailed = true;
    return null;
  }
}

/** True when `lon` falls inside the [west, east] span, taking the antimeridian wrap into account. */
function lonInSpan(lon: number, west: number, east: number): boolean {
  return west <= east ? lon >= west && lon <= east : lon >= west || lon <= east;
}

/**
 * The country containing (`lon`, `lat`), or `null` over open water.
 *
 * A bounding-box rejection in front of `geoContains` is what keeps this cheap enough to run on
 * every pointer move: the box test throws out ~175 of the 177 candidates with four comparisons
 * each, so the expensive spherical point-in-polygon runs once or twice rather than 177 times.
 */
export function findCountryAt(shapes: CountryShape[], lon: number, lat: number): CountryShape | null {
  for (const shape of shapes) {
    const [west, south, east, north] = shape.bounds;
    // A degree of slack: `geoBounds` is exact, and a click right on a coastline that rounds a
    // hair outside the box would otherwise fall through to "ocean" for no visible reason.
    if (lat < south - 1 || lat > north + 1) continue;
    if (!lonInSpan(lon, west - 1, east + 1)) continue;
    if (d3.geoContains(shape.feature, [lon, lat])) return shape;
  }
  return null;
}
