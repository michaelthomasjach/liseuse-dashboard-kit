import { useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
// world-atlas ships plain TopoJSON, not TS-typed — cast once at the module boundary rather than
// scattering `as unknown as ...` through the component below.
import countries110mRaw from "world-atlas/countries-110m.json";
import { COUNTRY_CONTINENT, CONTINENT_LABELS, CONTINENTS, matchContinent, type Continent } from "./worldGeo";
import "./charts-shared.css";
import "./WorldExposureMap.css";

const countries110m = countries110mRaw as unknown as Topology<{ countries: GeometryCollection }>;
// Antarctica ("010") has no portfolio exposure to speak of and, worse, throws off both the
// projection's own fit (geoNaturalEarth1 reserves a lot of vertical room for it) and the map's
// visual balance (it renders as a wide, disconnected-looking band along the very bottom edge) —
// excluded before anything else touches `countryFeatures`, not just hidden after the fact.
const countryFeatures = ((feature(countries110m, countries110m.objects.countries) as GeoJSON.FeatureCollection).features as Feature<Geometry, { name: string }>[]).filter(
  (f) => f.id !== "010"
);

export interface WorldExposureDatum {
  id: string;
  label: string;
  value: number;
}

export interface WorldExposureMapProps {
  /** Arbitrary region labels, e.g. straight from the same `countBy(rows, r => r.region)` helper
   *  a caller's own donut chart already uses — this component owns turning a label like "US" or
   *  "Europe" into a continent (see `matchContinent`'s own doc), not the caller. A label that
   *  doesn't resolve to any of the eight regions (e.g. "Global", or "Autre") contributes to the
   *  small "Non localisable" note instead of coloring anything, rather than being silently
   *  dropped. */
  data: WorldExposureDatum[];
  width?: number;
  height?: number;
  formatValue?: (value: number) => string;
  className?: string;
}

/** Interactive world choropleth — each of the eight regions shaded by its own share of `data`
 *  (see `matchContinent`), darker for a bigger share. Hover (mouse) or press-and-hold/tap (touch,
 *  same unified Pointer Events every other chart in this library already uses for its own
 *  hover — see DonutChart) shows that continent's own value in a floating tooltip. */
export function WorldExposureMap({ data, width = 480, height = 260, formatValue, className }: WorldExposureMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  // `x`/`y` are only meaningful when `source` is "map" (a real pointer position within
  // `wrapperRef`) — hovering the legend instead highlights the same continent's own countries
  // (via `hovered.continent` below) without a tooltip that would have nothing real to anchor to.
  const [hovered, setHovered] = useState<{ continent: Continent; x: number; y: number; source: "map" | "legend" } | null>(null);

  const { totals, unmatched, maxTotal, grandTotal } = useMemo(() => {
    // Built from CONTINENTS itself (not hardcoded here a second time) so this can't drift out of
    // sync with worldGeo.ts's own region list the way it once did.
    const byC = Object.fromEntries(CONTINENTS.map((c) => [c, 0])) as Record<Continent, number>;
    let unmatchedSum = 0;
    let grand = 0;
    for (const d of data) {
      grand += d.value;
      const c = matchContinent(d.label);
      if (c) byC[c] += d.value;
      else unmatchedSum += d.value;
    }
    return { totals: byC, unmatched: unmatchedSum, maxTotal: Math.max(1, ...Object.values(byC)), grandTotal: grand };
  }, [data]);

  const projection = useMemo(() => d3.geoNaturalEarth1().fitSize([width, height], { type: "FeatureCollection", features: countryFeatures } as GeoJSON.FeatureCollection), [width, height]);
  const pathGen = useMemo(() => d3.geoPath(projection), [projection]);

  const fmt = formatValue ?? ((v: number) => String(v));

  function fillFor(continent: Continent | undefined): string {
    if (!continent) return "var(--lq-color-panel)";
    const value = totals[continent];
    if (value <= 0) return "var(--lq-color-panel)";
    const t = value / maxTotal;
    const percent = Math.round(15 + t * 70);
    return `color-mix(in srgb, var(--lq-color-accent) ${percent}%, var(--lq-color-panel))`;
  }

  function showTooltip(continent: Continent, e: React.PointerEvent) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHovered({ continent, x: e.clientX - rect.left, y: e.clientY - rect.top, source: "map" });
  }

  const hoveredValue = hovered ? totals[hovered.continent] : 0;

  return (
    <div className={["lq-world-map", className].filter(Boolean).join(" ")} ref={wrapperRef}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Carte d'exposition par région"
        onPointerLeave={() => setHovered(null)}
      >
        {countryFeatures.map((f) => {
          const continent = f.id !== undefined ? COUNTRY_CONTINENT[String(f.id)] : undefined;
          return (
            <path
              key={String(f.id)}
              d={pathGen(f) ?? undefined}
              // `continent !== undefined` guards the comparison below on its own, not just as an
              // optimization — without it, a country absent from COUNTRY_CONTINENT (Kosovo, N.
              // Cyprus, Somaliland; see its own doc) has `continent === undefined`, which then
              // matched `hovered?.continent` (also `undefined` whenever nothing is hovered at
              // all), permanently marking every such country "highlighted" instead of only while
              // an actual continent is hovered.
              className={[
                "lq-world-map__country",
                continent !== undefined && hovered?.continent === continent && "lq-world-map__country--highlighted",
              ]
                .filter(Boolean)
                .join(" ")}
              fill={fillFor(continent)}
              onPointerEnter={(e) => continent && showTooltip(continent, e)}
              onPointerMove={(e) => continent && showTooltip(continent, e)}
              onPointerDown={(e) => continent && showTooltip(continent, e)}
            />
          );
        })}
      </svg>

      {hovered && hovered.source === "map" && (
        <div className="lq-world-map__tooltip" style={{ left: hovered.x, top: hovered.y }}>
          <strong>{CONTINENT_LABELS[hovered.continent]}</strong>
          <span>
            {fmt(hoveredValue)} {grandTotal > 0 && `(${Math.round((hoveredValue / grandTotal) * 100)}%)`}
          </span>
        </div>
      )}

      <div className="lq-chart__legend lq-world-map__legend">
        {CONTINENTS.filter((c) => totals[c] > 0).map((c) => (
          <div
            key={c}
            className="lq-chart__legend-item"
            onPointerEnter={() => setHovered({ continent: c, x: 0, y: 0, source: "legend" })}
            onPointerLeave={() => setHovered(null)}
          >
            <span className="lq-chart__legend-swatch" style={{ backgroundColor: fillFor(c) }} />
            {CONTINENT_LABELS[c]} · {fmt(totals[c])}
          </div>
        ))}
        {unmatched > 0 && <div className="lq-chart__legend-item lq-world-map__legend-unmatched">Non localisable · {fmt(unmatched)}</div>}
      </div>
    </div>
  );
}
