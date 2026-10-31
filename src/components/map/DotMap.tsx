import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import * as d3 from "d3";
import type { GeoProjection } from "d3";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, Geometry } from "geojson";
// Même source, même import que WorldExposureMap : le bundler n'en garde qu'un exemplaire.
import countries110mRaw from "world-atlas/countries-110m.json";
import { useChartDimensions } from "../charts/internal/useChartDimensions";
import { CloseIcon } from "../icons";
import { toneAttribute, type SurfaceTone } from "../primitives/tone";
import "./DotMap.css";

const countries110m = countries110mRaw as unknown as Topology<{ countries: GeometryCollection }>;
const ALL_COUNTRIES = (feature(countries110m, countries110m.objects.countries) as GeoJSON.FeatureCollection).features as Feature<Geometry>[];
// L'Antarctique (« 010 ») est une large bande au bas d'une carte du monde, qui écrase le cadrage
// sans rien porter : laissée de côté sauf demande.
const WITHOUT_ANTARCTICA = ALL_COUNTRIES.filter((f) => f.id !== "010");

export type DotMapProjection = "equirectangular" | "mercator" | "naturalEarth" | "equalEarth";

const PROJECTIONS: Record<DotMapProjection, () => GeoProjection> = {
  equirectangular: d3.geoEquirectangular,
  mercator: d3.geoMercator,
  naturalEarth: d3.geoNaturalEarth1,
  equalEarth: d3.geoEqualEarth,
};

/** Un coin de cadrage : `[longitude, latitude]`, en degrés. */
export type DotMapLonLat = [number, number];

export interface DotMapMarker {
  id: string;
  /** Latitude en degrés, positive au nord. */
  lat: number;
  /** Longitude en degrés, positive à l'est. */
  lon: number;
  /** Titre de l'infobulle, et nom du repère pour les lecteurs d'écran. */
  label: string;
  /** Sous le titre, dans l'infobulle. */
  details?: ReactNode;
  /** Couleur du repère (toute couleur CSS). Par défaut, celle du texte de la page. */
  color?: string;
}

export interface DotMapProps {
  markers?: DotMapMarker[];
  /** Hauteur en px. Défaut : 320. */
  height?: number;
  /** Largeur en px. Par défaut, toute la largeur du conteneur, suivie quand il change de taille. */
  width?: number;
  /** Projection : un nom, ou une fabrique de projection d3 (`() => d3.geoAlbers()`) — définie hors du
   *  rendu, sans quoi la grille est recalculée à chaque rendu. Défaut : `"naturalEarth"`. */
  projection?: DotMapProjection | (() => GeoProjection);
  /** Région à cadrer : `[[ouest, sud], [est, nord]]`, en degrés. Elle tient entière dans la carte, la
   *  terre alentour remplit le reste. Par défaut, le monde entier. */
  bounds?: [DotMapLonLat, DotMapLonLat];
  /** Point placé au centre de la carte, après le cadrage. */
  center?: DotMapLonLat;
  /** Grossissement appliqué après le cadrage, autour de `center`. Défaut : 1. */
  zoom?: number;
  /** Pas de la grille de points, en px. Défaut : 6. */
  dotSpacing?: number;
  /** Diamètre (ou côté) d'un point, en px. Défaut : 3. */
  dotSize?: number;
  dotShape?: "circle" | "square";
  /** Couleur de fond (toute couleur CSS, `var(--lq-…)` compris). Par défaut, celle du panneau, ou le
   *  remplissage du `tone`. */
  background?: string;
  /** Couleur des points. Par défaut, le texte à 30 % ; à 70 % sur un `tone`. */
  dotColor?: string;
  /** Remplit la carte d'une couleur du thème et passe les points en contraste — voir `SurfaceTone`.
   *  Défaut : `"default"`. */
  tone?: SurfaceTone;
  /** Garde l'Antarctique dans la grille. Défaut : false. */
  antarctica?: boolean;
  /** Halo animé autour des repères (coupé par `prefers-reduced-motion`). Défaut : true. */
  pulse?: boolean;
  /** Repère dont l'infobulle est ouverte (contrôlé) ; `null` pour aucun. */
  selectedId?: string | null;
  defaultSelectedId?: string | null;
  onSelect?: (id: string | null) => void;
  /** Nom de la carte pour les lecteurs d'écran. Défaut : « Carte ». */
  label?: string;
  closeLabel?: string;
  className?: string;
}

/** Cadre la projection : la région `bounds` (ou toute la terre), puis le grossissement autour de
 *  `center`. Une région se cadre par des points semés sur son pourtour, pas par un polygone : d3
 *  tracerait ses côtés en arcs de grand cercle, qui se bombent loin des parallèles. */
function frame(
  projection: GeoProjection,
  width: number,
  height: number,
  features: Feature<Geometry>[],
  bounds: [DotMapLonLat, DotMapLonLat] | undefined,
  center: DotMapLonLat | undefined,
  zoom: number,
) {
  if (bounds) {
    const [[west, south], [east, north]] = bounds;
    const coordinates: DotMapLonLat[] = [];
    const steps = 24;
    for (let i = 0; i <= steps; i++) {
      const lon = west + ((east - west) * i) / steps;
      const lat = south + ((north - south) * i) / steps;
      coordinates.push([lon, south], [lon, north], [west, lat], [east, lat]);
    }
    projection.fitSize([width, height], { type: "MultiPoint", coordinates });
  } else {
    projection.fitSize([width, height], { type: "FeatureCollection", features });
  }
  if (zoom === 1 && !center) return;
  const focus = center ?? projection.invert?.([width / 2, height / 2]);
  projection.scale(projection.scale() * zoom);
  const at = focus && projection(focus);
  if (!at) return;
  const [tx, ty] = projection.translate();
  projection.translate([tx + width / 2 - at[0], ty + height / 2 - at[1]]);
}

/** La grille : la terre est peinte une fois dans un canevas hors écran, puis lue à chaque nœud de la
 *  grille. Tester chaque nœud contre les polygones (`geoContains`) coûterait des millions d'opérations
 *  trigonométriques ; lire un pixel n'en coûte aucune, et le canevas règle au passage le découpage
 *  aux bords et à l'antiméridien. */
function dotGrid(projection: GeoProjection, width: number, height: number, features: Feature<Geometry>[], spacing: number): string {
  if (typeof document === "undefined" || width < 1 || height < 1) return "";
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "";
  const path = d3.geoPath(projection, ctx);
  ctx.beginPath();
  for (const f of features) path(f);
  ctx.fill();
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const step = Math.max(2, spacing);
  const parts: string[] = [];
  for (let y = step / 2; y < height; y += step) {
    const row = Math.floor(y) * canvas.width;
    for (let x = step / 2; x < width; x += step) {
      if (data[(row + Math.floor(x)) * 4 + 3] > 127) parts.push(`M${x.toFixed(1)} ${y.toFixed(1)}h0`);
    }
  }
  return parts.join("");
}

/**
 * Carte du monde en pointillés : la terre dessinée par une grille régulière de points, des repères
 * dessus, et une infobulle au clic sur un repère — le bloc « géolocalisation » d'un tableau de bord.
 *
 * Les terres viennent du même `world-atlas` que `WorldExposureMap`. Projection, cadrage (`bounds`,
 * ou `center` et `zoom`), pas et taille des points se règlent ; les couleurs suivent le thème, ou le
 * `tone` qui remplit la carte. Les points sont un seul tracé SVG — des segments de longueur nulle à
 * bouts ronds ou carrés —, si bien que leur couleur reste une variable CSS et que des milliers de
 * points ne pèsent qu'un élément.
 *
 * Les repères sont des boutons : ils se prennent au clavier, Entrée ouvre l'infobulle, Échap la
 * ferme. L'infobulle est hors de la surface colorée, pour garder les couleurs ordinaires du panneau.
 */
export function DotMap({
  markers = [],
  height = 320,
  width: widthProp,
  projection = "naturalEarth",
  bounds,
  center,
  zoom = 1,
  dotSpacing = 6,
  dotSize = 3,
  dotShape = "circle",
  background,
  dotColor,
  tone = "default",
  antarctica = false,
  pulse = true,
  selectedId: selectedProp,
  defaultSelectedId = null,
  onSelect,
  label = "Carte",
  closeLabel = "Fermer",
  className,
}: DotMapProps) {
  const [ref, dims] = useChartDimensions({ top: 0, right: 0, bottom: 0, left: 0 }, { width: widthProp, height });
  const [selectedState, setSelectedState] = useState<string | null>(defaultSelectedId);
  const selectedId = selectedProp !== undefined ? selectedProp : selectedState;
  const { width } = dims;
  const features = antarctica ? ALL_COUNTRIES : WITHOUT_ANTARCTICA;

  // Les tableaux de cadrage changent d'identité à chaque rendu d'un appelant qui les écrit en ligne :
  // ils passent par une clé, comparée par valeur, et en sont relus.
  const frameKey = JSON.stringify({ bounds, center, zoom });
  const geo = useMemo(() => {
    const framing = JSON.parse(frameKey) as Pick<DotMapProps, "bounds" | "center" | "zoom">;
    const proj = (typeof projection === "function" ? projection : PROJECTIONS[projection])();
    frame(proj, width, height, features, framing.bounds, framing.center, framing.zoom ?? 1);
    return proj;
  }, [projection, width, height, features, frameKey]);

  const dots = useMemo(() => dotGrid(geo, width, height, features, dotSpacing), [geo, width, height, features, dotSpacing]);

  const select = (id: string | null) => {
    if (selectedProp === undefined) setSelectedState(id);
    onSelect?.(id);
  };

  useEffect(() => {
    if (selectedId === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (selectedProp === undefined) setSelectedState(null);
        onSelect?.(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedId, selectedProp, onSelect]);

  // Rien à placer tant que la largeur n'est pas mesurée : la projection, cadrée sur zéro pixel, mettrait
  // tous les repères au même point.
  const placed = (width > 0 ? markers : [])
    .map((m) => ({ marker: m, at: geo([m.lon, m.lat]) }))
    .filter((p): p is { marker: DotMapMarker; at: [number, number] } => p.at !== null && p.at[0] >= 0 && p.at[0] <= width && p.at[1] >= 0 && p.at[1] <= height);
  const selected = placed.find((p) => p.marker.id === selectedId);

  const style = {
    height,
    width: widthProp,
    ...(background ? { "--lq-dot-map-bg": background } : null),
    ...(dotColor ? { "--lq-dot-map-dot": dotColor } : null),
  } as CSSProperties;

  return (
    <div ref={ref} className={["lq-dot-map", className].filter(Boolean).join(" ")} style={style}>
      <div className="lq-dot-map__surface" data-lq-tone={toneAttribute(tone)} onClick={() => selectedId !== null && select(null)}>
        <svg className="lq-dot-map__svg" width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
          <path className="lq-dot-map__dots" d={dots} strokeWidth={dotSize} strokeLinecap={dotShape === "square" ? "square" : "round"} />
        </svg>
        {placed.map(({ marker, at }) => (
          <button
            key={marker.id}
            type="button"
            className={["lq-dot-map__marker", pulse && "lq-dot-map__marker--pulse", marker.id === selectedId && "lq-dot-map__marker--selected"].filter(Boolean).join(" ")}
            style={{ left: at[0], top: at[1], ...(marker.color ? { "--lq-dot-map-marker": marker.color } : null) } as CSSProperties}
            aria-label={marker.label}
            aria-expanded={marker.id === selectedId}
            onClick={(e) => {
              e.stopPropagation();
              select(marker.id === selectedId ? null : marker.id);
            }}
          >
            <span className="lq-dot-map__marker-dot" aria-hidden="true" />
          </button>
        ))}
      </div>

      {selected && (
        <div
          className={["lq-dot-map__tooltip", selected.at[1] < 90 && "lq-dot-map__tooltip--below"].filter(Boolean).join(" ")}
          style={{ left: selected.at[0], top: selected.at[1] }}
          role="dialog"
          aria-label={selected.marker.label}
        >
          <div className="lq-dot-map__tooltip-head">
            <span className="lq-dot-map__tooltip-title">{selected.marker.label}</span>
            <button type="button" className="lq-dot-map__tooltip-close" onClick={() => select(null)} aria-label={closeLabel} title={closeLabel}>
              <CloseIcon size={12} />
            </button>
          </div>
          {selected.marker.details && <div className="lq-dot-map__tooltip-details">{selected.marker.details}</div>}
        </div>
      )}
    </div>
  );
}
