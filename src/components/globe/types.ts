/**
 * Public data model for `InteractiveGlobe`.
 *
 * Nothing in here knows anything about economics, finance or any other domain: the globe is fed
 * plain points, arcs and markers in geographic coordinates and hands back ids on interaction. A
 * consuming product maps its own entities onto these shapes (see the component's own doc for why
 * that boundary is drawn here rather than inside the renderer).
 */

/** Longitude (−180…180), latitude (−90…90), in degrees. */
export type GlobeLonLat = [lon: number, lat: number];

/**
 * Zoom tiers, coarse to fine. The globe derives the active tier from the camera distance and
 * reports it through `onLodChange`; callers decide what each tier means for their own data by
 * setting `minLod` on individual nodes/flows. Keeping the *policy* out here is what lets the same
 * renderer drive a world-trade map and, say, a fleet tracker.
 */
export type GlobeLod = "world" | "regional" | "country" | "actor" | "detail";

export const GLOBE_LODS: GlobeLod[] = ["world", "regional", "country", "actor", "detail"];

/** Rank of a tier in `GLOBE_LODS`, for `minLod` comparisons. */
export function lodRank(lod: GlobeLod): number {
  const i = GLOBE_LODS.indexOf(lod);
  return i < 0 ? 0 : i;
}

/** A point on the sphere. Also usable as an endpoint for flows, by id. */
export interface GlobeNode {
  id: string;
  lon: number;
  lat: number;
  /** Shown by the label layer when the node is dense-enough-ranked to earn one (see `labelMode`). */
  label?: string;
  /** Any CSS color. Falls back to the `nodeColor` theme entry. */
  color?: string;
  /** Point diameter in CSS pixels at zoom 1. Default 5. */
  size?: number;
  /** Hidden until the camera reaches this tier. Default "world" (always visible). */
  minLod?: GlobeLod;
  /** Ranks nodes against each other when labels have to be thinned out. Higher wins. Default 0. */
  weight?: number;
  /** Draws a slowly expanding halo — for "something is happening here". */
  pulse?: boolean;
  /** Opaque passthrough; returned untouched in interaction callbacks. */
  data?: unknown;
}

/** How certain a relation is. Purely visual here: it selects solid vs. dashed stroke. */
export type GlobeFlowStyle = "solid" | "dashed";

/** A great-circle arc between two points, optionally carrying animated particles. */
export interface GlobeFlow {
  id: string;
  /** Node id, or explicit coordinates. */
  from: string | GlobeLonLat;
  to: string | GlobeLonLat;
  color?: string;
  /** Stroke width in CSS pixels. Default 1.4. */
  width?: number;
  /** Peak height above the surface, in sphere radii. Default derived from the arc's own length. */
  altitude?: number;
  /** Solid for documented relations, dashed for hypothetical ones. Default "solid". */
  style?: GlobeFlowStyle;
  /** 0…1 — scales both opacity and the particle count. Default 0.6. */
  intensity?: number;
  /** Particles travel from→to and to→from. Default false. */
  bidirectional?: boolean;
  /** Overrides the particle count derived from `intensity`. 0 disables particles for this flow. */
  particles?: number;
  /** Particle travel speed, in arc-lengths per second. Default 0.18. */
  speed?: number;
  minLod?: GlobeLod;
  data?: unknown;
}

/** A labelled point of interest drawn above the flow layer (cities, hubs, events…). */
export interface GlobeMarker {
  id: string;
  lon: number;
  lat: number;
  label?: string;
  color?: string;
  size?: number;
  minLod?: GlobeLod;
  data?: unknown;
}

/** Camera state. `zoom` is 1 at the default framing and grows as the camera closes in. */
export interface GlobeView {
  /** Longitude at the centre of the disc. */
  lon: number;
  /** Latitude at the centre of the disc. */
  lat: number;
  zoom: number;
}

/** Colors the renderer uses. Every entry accepts any CSS color and defaults to a `--lq-*` token. */
export interface GlobeTheme {
  /** Sphere fill at the centre of the disc. */
  sphere?: string;
  /** Sphere fill at the limb — a darker edge reads as curvature. */
  sphereEdge?: string;
  /** Atmospheric halo outside the silhouette. */
  atmosphere?: string;
  /** Dots over landmasses. */
  land?: string;
  /** The sparse lattice over the whole sphere (oceans included). Set to `"none"` to drop it. */
  lattice?: string;
  node?: string;
  flow?: string;
  marker?: string;
  label?: string;
  /** Applied to the selected node and to flows listed in `highlightedFlowIds`. */
  highlight?: string;
  /**
   * Applied to whatever the pointer is currently over.
   *
   * Distinct from `highlight` on purpose: selection is a state the reader chose and that persists,
   * hover is a transient answer to "what is under my cursor". Giving them the same colour makes a
   * passing cursor look like it has selected something.
   */
  hover?: string;
}

/** Which labels the 2D overlay is allowed to draw. */
export type GlobeLabelMode = "none" | "auto" | "all";

/** Rendering budget. "low" halves the dot lattice and stops particles; "high" is the default. */
export type GlobeQuality = "low" | "medium" | "high";

export interface GlobeNodeEvent {
  node: GlobeNode;
  /** Pointer position relative to the globe's own bounding box, in CSS pixels. */
  x: number;
  y: number;
}

export interface GlobeFlowEvent {
  flow: GlobeFlow;
  x: number;
  y: number;
}

/** Imperative handle exposed through `ref`. */
export interface InteractiveGlobeHandle {
  /** Animates the camera so that `nodeId` sits at the centre of the disc. */
  focusNode: (nodeId: string, opts?: { zoom?: number; durationMs?: number }) => void;
  /** Animates the camera to arbitrary coordinates. */
  focusLonLat: (lon: number, lat: number, opts?: { zoom?: number; durationMs?: number }) => void;
  /** Jumps (no animation) to a full camera state. */
  setView: (view: Partial<GlobeView>) => void;
  getView: () => GlobeView;
  /** Back to the initial framing. */
  resetView: (opts?: { durationMs?: number }) => void;
  zoomBy: (factor: number, opts?: { durationMs?: number }) => void;
  /** Screen position of a node, or `null` when it is behind the globe / unknown. */
  projectNode: (nodeId: string) => { x: number; y: number } | null;
  /** Current frames-per-second, averaged over the last second. For perf overlays. */
  getFps: () => number;
}
