import type {
  GlobeCountryRef,
  GlobeFlow,
  GlobeLabelMode,
  GlobeLod,
  GlobeLonLat,
  GlobeMarker,
  GlobeNode,
  GlobeQuality,
  GlobeTheme,
  GlobeView,
} from "../types";
import { lodRank } from "../types";
import { GlobeCamera, lodForZoom } from "./GlobeCamera";
import { findCountryAt, getCountries, type CountryShape } from "./countries";
import {
  angularDistance,
  applyMat3,
  applyMat3Transpose,
  clamp,
  DEG,
  defaultAltitude,
  lonLatToVec3,
  vec3ToLonLat,
  viewRotation,
} from "./geo";
import { buildLandDots, buildLattice } from "./lattice";
import {
  ARCS_FS,
  ARCS_VS,
  DOTS_FS,
  DOTS_VS,
  NODES_FS,
  NODES_VS,
  PARTICLES_FS,
  PARTICLES_VS,
  SPHERE_FS,
  SPHERE_VS,
} from "./shaders";
import {
  bindInterleaved,
  clearColorCache,
  createProgram,
  resolveColor,
  unbindAttribs,
  VertexBuffer,
  type AttribSpec,
  type GlProgram,
  type Rgba,
} from "./glUtil";

/** Vertex layouts. Every layer is one interleaved buffer and one draw call. */
const DOT_ATTRIBS: AttribSpec[] = [
  { name: "aPos", size: 3, offsetFloats: 0 },
  { name: "aWeight", size: 1, offsetFloats: 3 },
];
const DOT_STRIDE = 4;

const ARC_ATTRIBS: AttribSpec[] = [
  { name: "aA", size: 2, offsetFloats: 0 },
  { name: "aB", size: 2, offsetFloats: 2 },
  { name: "aTS", size: 2, offsetFloats: 4 },
  { name: "aStyle", size: 4, offsetFloats: 6 },
  { name: "aColor", size: 4, offsetFloats: 10 },
];
const ARC_STRIDE = 14;

const PARTICLE_ATTRIBS: AttribSpec[] = [
  { name: "aA", size: 2, offsetFloats: 0 },
  { name: "aB", size: 2, offsetFloats: 2 },
  { name: "aP", size: 4, offsetFloats: 4 },
  { name: "aColor", size: 4, offsetFloats: 8 },
  { name: "aSize", size: 1, offsetFloats: 12 },
];
const PARTICLE_STRIDE = 13;

const NODE_ATTRIBS: AttribSpec[] = [
  { name: "aPos", size: 3, offsetFloats: 0 },
  { name: "aColor", size: 4, offsetFloats: 3 },
  { name: "aP", size: 3, offsetFloats: 7 },
];
const NODE_STRIDE = 10;

const SPHERE_ATTRIBS: AttribSpec[] = [{ name: "aUv", size: 2, offsetFloats: 0 }];

/** Dot budget per quality tier: [land candidates, lattice points]. Land keeps ~29% of candidates. */
const DOT_BUDGET: Record<GlobeQuality, [number, number]> = {
  low: [14000, 1200],
  medium: [30000, 2600],
  high: [46000, 4200],
};

/** How many labels the overlay may draw at each tier. Past these counts the globe reads as noise. */
const LABEL_BUDGET: Record<GlobeLod, number> = {
  world: 10,
  regional: 18,
  country: 26,
  actor: 34,
  detail: 44,
};

export interface GlobeEngineCallbacks {
  onNodeClick?: (node: GlobeNode, x: number, y: number) => void;
  onNodeHover?: (node: GlobeNode | null, x: number, y: number) => void;
  onFlowClick?: (flow: GlobeFlow, x: number, y: number) => void;
  onFlowHover?: (flow: GlobeFlow | null, x: number, y: number) => void;
  /** Fires when the pointer crosses from one country to another, or out to open water. */
  onCountryHover?: (country: GlobeCountryRef | null, x: number, y: number) => void;
  onBackgroundClick?: () => void;
  onViewChange?: (view: GlobeView) => void;
  onLodChange?: (lod: GlobeLod) => void;
}

export interface GlobeEngineOptions {
  autoRotate: boolean;
  autoRotateSpeed: number;
  animateFlows: boolean;
  quality: GlobeQuality;
  theme: GlobeTheme;
  labelMode: GlobeLabelMode;
  selectedNodeId: string | null;
  highlightedFlowIds: string[];
  maxAnimatedFlows: number;
  /** Multiplies the particle diameter. 1 is the default size. */
  particleScale: number;
  /** Outlines the country under the pointer, and reports it through `onCountryHover`. */
  countryHover: boolean;
  interactive: boolean;
}

/** A flow with its endpoints already turned into coordinates and its geometry pre-measured. */
interface ResolvedFlow {
  flow: GlobeFlow;
  aLon: number;
  aLat: number;
  bLon: number;
  bLat: number;
  altitude: number;
  intensity: number;
  /** Set when the flow touches the current selection — used for both styling and hit priority. */
  touchesSelection: boolean;
}

/** The kit's two design languages, which the globe has to render differently rather than recolour. */
type GlobePalette = "eink" | "color";
type GlobeSurface = "light" | "dark";

/**
 * How the sphere is drawn, per palette.
 *
 * `shading` and `roundDots` are not preferences — they are what makes the e-ink palette itself. That
 * palette has no gradients, no shadows and hairline borders, so a lit sphere with a soft halo in it
 * would look like a different component rather than the same one in a different colour.
 */
interface GlobeRenderStyle {
  /** 1 = lit sphere and atmospheric halo; 0 = flat disc and hairline outline. */
  shading: number;
  /** 1 = round dots; 0 = square. */
  roundDots: number;
  bodyAlpha: number;
  atmosphereAlpha: number;
  /** Multiplier on the land dot size. */
  landDotScale: number;
  /** Multiplier on the lattice dot size, relative to land. */
  latticeDotScale: number;
  /** Extra width, in CSS pixels, of the page-coloured casing drawn under each arc. 0 disables it. */
  arcCasingPx: number;
  /** Strength of the page-coloured moat around each node marker, 0…1. */
  nodeMoat: number;
  /**
   * Additive blending brightens whatever is behind it, which only reads as "glow" on a dark ground.
   * On paper it moves every particle toward white and they vanish, so the light palette composites
   * them normally instead.
   */
  additiveParticles: boolean;
  /** Knocks a page-coloured outline out from behind label text. */
  labelHalo: boolean;
  /** 1 = particles render as a soft glow, 0 = as a crisp disc. See PARTICLES_FS. */
  particleSoftness: number;
}

const RENDER_STYLE: Record<GlobePalette, GlobeRenderStyle> = {
  color: {
    shading: 1,
    roundDots: 1,
    bodyAlpha: 0.95,
    atmosphereAlpha: 0.3,
    landDotScale: 1,
    latticeDotScale: 0.7,
    arcCasingPx: 0,
    nodeMoat: 0,
    additiveParticles: true,
    labelHalo: false,
    particleSoftness: 1,
  },
  // A crisp outline instead of a glow, and square ink dots. The lattice shrinks further so the ocean
  // reads as empty paper rather than as a second, competing texture. Everything else here exists
  // because dense black stipple is a hostile background for anything drawn over it.
  eink: {
    shading: 0,
    roundDots: 0,
    bodyAlpha: 1,
    atmosphereAlpha: 0.85,
    landDotScale: 1.08,
    latticeDotScale: 0.55,
    arcCasingPx: 2.6,
    nodeMoat: 1,
    additiveParticles: false,
    labelHalo: true,
    particleSoftness: 0,
  },
};

/**
 * Default colours, per palette and surface.
 *
 * `land` is deliberately `--lq-color-text` in every mode rather than the muted variant it used to
 * be. Land against ocean is the single most important distinction on this globe — it is what makes
 * the picture a map — so it gets the palette's maximum-contrast ink, and everything else is tuned
 * around it. The lattice takes the subtle border token for the same reason: it has to suggest a
 * sphere without competing with the coastlines.
 */
function defaultThemeFor(palette: GlobePalette, surface: GlobeSurface): Required<GlobeTheme> {
  const shared = {
    sphere: "var(--lq-color-panel)",
    sphereEdge: "var(--lq-color-bg)",
    land: "var(--lq-color-text)",
    lattice: "var(--lq-color-border-subtle)",
    node: "var(--lq-color-accent)",
    flow: "var(--lq-color-accent)",
    marker: "var(--lq-color-amber)",
    label: "var(--lq-color-text)",
    highlight: "var(--lq-color-sky)",
    hover: "var(--lq-color-sky)",
    countryBorder: "var(--lq-color-sky)",
  };

  if (palette === "eink") {
    return {
      ...shared,
      // The outline is drawn with the same ink as everything else; in monochrome an "atmosphere" in
      // any other colour would just be a smudge.
      atmosphere: "var(--lq-color-border)",
      // On paper the ocean is the paper. Tinting it would defeat the point.
      sphere: "var(--lq-color-bg)",
      sphereEdge: "var(--lq-color-bg)",
      marker: "var(--lq-color-text)",
      highlight: "var(--lq-color-text)",
      // Hover keeps a real colour even in the monochrome palette. It encodes no data — it is the
      // feedback that says "this is the thing under your cursor" — so it does not owe the palette
      // the same discipline the graph itself does, and in ink-on-paper a colour is the only
      // separation left once weight and dash are already spoken for.
      hover: "var(--lq-color-sky)",
      countryBorder: "var(--lq-color-sky)",
    };
  }

  return {
    ...shared,
    atmosphere: "var(--lq-color-accent)",
    // A glow reads as light spilling past the limb, which only makes sense against a dark ground.
    // On a light surface the same effect is a grey ring, so it is dialled right back by
    // `atmosphereAlpha` below rather than recoloured.
    ...(surface === "light" ? { sphereEdge: "var(--lq-color-border-subtle)" } : {}),
  };
}

/**
 * The globe's renderer: two stacked canvases (WebGL for the sphere, flows and points; 2D for text)
 * driven by one requestAnimationFrame loop that React never participates in.
 *
 * Text lives on the 2D layer rather than in WebGL deliberately. Glyph atlases would be the only way
 * to draw labels in GL, and the globe never shows more than a few dozen of them at once — so the
 * atlas would buy nothing and cost a lot, while `fillText` gives correct shaping and subpixel
 * hinting for free.
 */
export class GlobeEngine {
  private readonly container: HTMLElement;
  private readonly glCanvas: HTMLCanvasElement;
  private readonly labelCanvas: HTMLCanvasElement;
  private readonly gl: WebGLRenderingContext;
  private readonly ctx: CanvasRenderingContext2D | null;

  readonly camera: GlobeCamera;

  /**
   * Definitely-assigned rather than initialised inline: every GL object here is owned by the
   * context and has to be recreated from scratch if that context is lost and restored, so creation
   * lives in `initGl()` where both the constructor and the restore handler can call it.
   */
  private programs!: {
    sphere: GlProgram;
    dots: GlProgram;
    arcs: GlProgram;
    particles: GlProgram;
    nodes: GlProgram;
  };

  private buffers!: {
    sphere: VertexBuffer;
    land: VertexBuffer;
    lattice: VertexBuffer;
    arcs: VertexBuffer;
    /** Just the hovered arc, so pointing at one does not rebuild the whole flow buffer. */
    hoverArc: VertexBuffer;
    /** The outline of the country under the pointer. Empty whenever there is none. */
    border: VertexBuffer;
    particles: VertexBuffer;
    nodes: VertexBuffer;
    markers: VertexBuffer;
  };

  private nodes: GlobeNode[] = [];
  private flows: GlobeFlow[] = [];
  private markers: GlobeMarker[] = [];
  private nodeById = new Map<string, GlobeNode>();
  private resolvedFlows: ResolvedFlow[] = [];

  /** Nodes currently in the point buffer, in buffer order — the hit-test and label candidates. */
  private liveNodes: GlobeNode[] = [];
  private liveMarkers: GlobeMarker[] = [];
  /** Flows currently in the arc buffer, in buffer order — the flow hit-test candidates. */
  private liveFlows: ResolvedFlow[] = [];

  /** `[x, y, visible]` in CSS pixels, refreshed each frame for hit-testing and label placement. */
  private nodeScreen = new Float32Array(0);
  private markerScreen = new Float32Array(0);

  private options: GlobeEngineOptions;
  private callbacks: GlobeEngineCallbacks;

  private rot = new Float32Array(9);
  private widthCss = 1;
  private heightCss = 1;
  private dpr = 1;
  private radiusPx = 1;

  private rafId = 0;
  private running = false;
  private lastFrame = 0;
  private startedAt = 0;
  private geometryDirty = true;
  /** Set when the hovered flow changes; only the one-arc buffer is rebuilt, never the whole set. */
  private hoverDirty = false;
  /** Set when the hovered country changes; rebuilds the outline buffer and nothing else. */
  private borderDirty = false;
  private needsDraw = true;
  private lastLod: GlobeLod;
  private lastReportedView: GlobeView;

  private fps = 0;
  private fpsFrames = 0;
  private fpsSince = 0;

  private pointer = { x: 0, y: 0, inside: false, moved: false };
  private drag = { active: false, moved: false, lastX: 0, lastY: 0, pointerId: -1 };
  private hoveredNodeId: string | null = null;
  private hoveredFlowId: string | null = null;
  /**
   * Built on first use rather than in the constructor. Parsing the topology costs a few
   * milliseconds and holds on to a megabyte or so, and a globe that never turns country hover on
   * should pay neither.
   */
  private countries: CountryShape[] | null = null;
  private countriesLoaded = false;
  private hoveredCountry: CountryShape | null = null;

  private colors: Record<string, Rgba> = {};
  private resizeObserver: ResizeObserver | null = null;
  private themeObserver: MutationObserver | null = null;
  private disposed = false;
  /** True between `webglcontextlost` and `webglcontextrestored`; every GL call is skipped meanwhile. */
  private contextLost = false;

  constructor(
    container: HTMLElement,
    glCanvas: HTMLCanvasElement,
    labelCanvas: HTMLCanvasElement,
    initialView: GlobeView,
    options: GlobeEngineOptions,
    callbacks: GlobeEngineCallbacks
  ) {
    this.container = container;
    this.glCanvas = glCanvas;
    this.labelCanvas = labelCanvas;
    this.options = options;
    this.callbacks = callbacks;

    const gl = glCanvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      // The globe is redrawn every frame it changes and the browser may composite in between;
      // preserving the buffer would only cost bandwidth.
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("globe: WebGL is not available in this browser");
    this.gl = gl;
    this.ctx = labelCanvas.getContext("2d");

    this.camera = new GlobeCamera(initialView);
    this.camera.autoRotate = options.autoRotate;
    this.camera.autoRotateSpeed = options.autoRotateSpeed;
    this.lastLod = this.camera.lod;
    this.lastReportedView = this.camera.getView();

    this.initGl();
    this.readTheme();
    this.attachObservers();
    this.attachPointer();
    this.resize();
  }

  /**
   * Creates every GL-owned object: programs, buffers, the sphere quad and the dot lattices.
   *
   * Called from the constructor and again after a context restore. A lost WebGL context invalidates
   * every program and buffer it ever handed out, so recovery is not a matter of resuming — all of it
   * has to be built again.
   */
  private initGl() {
    const gl = this.gl;

    this.programs = {
      sphere: createProgram(gl, SPHERE_VS, SPHERE_FS),
      dots: createProgram(gl, DOTS_VS, DOTS_FS),
      arcs: createProgram(gl, ARCS_VS, ARCS_FS),
      particles: createProgram(gl, PARTICLES_VS, PARTICLES_FS),
      nodes: createProgram(gl, NODES_VS, NODES_FS),
    };

    this.buffers = {
      sphere: new VertexBuffer(gl),
      land: new VertexBuffer(gl),
      lattice: new VertexBuffer(gl),
      arcs: new VertexBuffer(gl),
      hoverArc: new VertexBuffer(gl),
      border: new VertexBuffer(gl),
      particles: new VertexBuffer(gl),
      nodes: new VertexBuffer(gl),
      markers: new VertexBuffer(gl),
    };

    // The quad reaches past the silhouette so the atmospheric halo has somewhere to live.
    const q = 1.45;
    this.buffers.sphere.upload(new Float32Array([-q, -q, q, -q, -q, q, q, q]), 4, gl.STATIC_DRAW);

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);

    this.uploadDots();
    // The flow and node buffers rebuild from the arrays already in memory on the next frame, so a
    // restore needs nothing re-fetched.
    this.geometryDirty = true;
    // The outline buffer is GL-owned too, so a restored context starts with an empty one.
    this.borderDirty = true;
    this.needsDraw = true;
  }

  private onContextLost = (event: Event) => {
    // Without preventDefault the browser will not attempt to restore the context at all — this one
    // line is the difference between a globe that comes back and a permanently blank canvas.
    event.preventDefault();
    this.contextLost = true;
    this.stop();
  };

  private onContextRestored = () => {
    if (this.disposed) return;
    this.contextLost = false;
    this.initGl();
    this.readTheme();
    this.start();
  };

  // ---------------------------------------------------------------- data

  setData(nodes: GlobeNode[], flows: GlobeFlow[], markers: GlobeMarker[]) {
    this.nodes = nodes;
    this.flows = flows;
    this.markers = markers;
    this.nodeById = new Map(nodes.map((n) => [n.id, n]));
    this.resolveFlows();
    this.geometryDirty = true;
    this.needsDraw = true;
  }

  setOptions(next: Partial<GlobeEngineOptions>) {
    const qualityChanged = next.quality !== undefined && next.quality !== this.options.quality;
    const themeChanged = next.theme !== undefined && next.theme !== this.options.theme;
    this.options = { ...this.options, ...next };
    this.camera.autoRotate = this.options.autoRotate;
    this.camera.autoRotateSpeed = this.options.autoRotateSpeed;
    if (qualityChanged) this.uploadDots();
    if (themeChanged) this.readTheme();
    if (next.countryHover === false) this.clearCountryHover();
    // A recoloured theme has to reach the outline too, and it is not part of `rebuildGeometry`.
    if (themeChanged) this.borderDirty = true;
    // Selection, highlights and LOD all feed the vertex colors, so any option change rebuilds.
    this.resolveFlows();
    this.geometryDirty = true;
    this.needsDraw = true;
  }

  setCallbacks(callbacks: GlobeEngineCallbacks) {
    this.callbacks = callbacks;
  }

  /** Re-reads every CSS color token. Call after the surrounding theme switches. */
  refreshTheme() {
    clearColorCache();
    this.readTheme();
    this.geometryDirty = true;
    this.needsDraw = true;
  }

  private endpoint(ref: string | GlobeLonLat): GlobeLonLat | null {
    if (Array.isArray(ref)) return ref;
    const node = this.nodeById.get(ref);
    return node ? [node.lon, node.lat] : null;
  }

  private resolveFlows() {
    const selected = this.options.selectedNodeId;
    const out: ResolvedFlow[] = [];
    for (const flow of this.flows) {
      const a = this.endpoint(flow.from);
      const b = this.endpoint(flow.to);
      // A flow naming a node that is not in `nodes` is dropped rather than guessed at — silently
      // anchoring it at (0, 0) would draw a confident line through the Gulf of Guinea.
      if (!a || !b) continue;
      const omega = angularDistance(a[0], a[1], b[0], b[1]);
      out.push({
        flow,
        aLon: a[0],
        aLat: a[1],
        bLon: b[0],
        bLat: b[1],
        altitude: flow.altitude ?? defaultAltitude(omega),
        intensity: clamp(flow.intensity ?? 0.6, 0, 1),
        touchesSelection:
          selected !== null && (flow.from === selected || flow.to === selected),
      });
    }
    this.resolvedFlows = out;
  }

  // ---------------------------------------------------------------- theme

  /** The palette/surface currently in force, read from the kit's own root attributes. */
  private palette: GlobePalette = "color";
  private surface: GlobeSurface = "dark";

  private get renderStyle(): GlobeRenderStyle {
    return RENDER_STYLE[this.palette];
  }

  private readTheme() {
    const root = this.container.closest<HTMLElement>(".lq-root");
    this.palette = root?.dataset.lqPalette === "eink" ? "eink" : "color";
    this.surface = root?.dataset.lqSurface === "light" ? "light" : "dark";

    // Caller overrides still win, so a product can recolour any single role without losing the
    // palette-appropriate defaults for the rest.
    const t = { ...defaultThemeFor(this.palette, this.surface), ...this.options.theme };
    const host = this.container;
    this.colors = {
      sphere: resolveColor(host, t.sphere, [0.05, 0.07, 0.11, 1]),
      sphereEdge: resolveColor(host, t.sphereEdge, [0.02, 0.03, 0.05, 1]),
      atmosphere: resolveColor(host, t.atmosphere, [0.35, 0.55, 0.9, 1]),
      land: resolveColor(host, t.land, [0.55, 0.6, 0.7, 1]),
      lattice: t.lattice === "none" ? [0, 0, 0, 0] : resolveColor(host, t.lattice, [0.2, 0.25, 0.35, 1]),
      node: resolveColor(host, t.node, [0.6, 0.72, 0.95, 1]),
      flow: resolveColor(host, t.flow, [0.6, 0.72, 0.95, 1]),
      marker: resolveColor(host, t.marker, [0.9, 0.7, 0.4, 1]),
      label: resolveColor(host, t.label, [0.95, 0.96, 0.98, 1]),
      highlight: resolveColor(host, t.highlight, [0.56, 0.79, 0.86, 1]),
      hover: resolveColor(host, t.hover, [0.56, 0.79, 0.86, 1]),
      countryBorder: resolveColor(host, t.countryBorder ?? t.hover, [0.56, 0.79, 0.86, 1]),
    };
  }

  private colorFor(css: string | undefined, fallback: Rgba): Rgba {
    if (!css) return fallback;
    return resolveColor(this.container, css, fallback);
  }

  // ---------------------------------------------------------------- sizing

  resize() {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    // Capped at 2: beyond that the fill cost grows quadratically for a difference nobody can see on
    // a phone held at arm's length, and 3x displays are exactly where the headroom is thinnest.
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (w === this.widthCss && h === this.heightCss && dpr === this.dpr) return;

    this.widthCss = w;
    this.heightCss = h;
    this.dpr = dpr;

    for (const canvas of [this.glCanvas, this.labelCanvas]) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    }
    this.gl.viewport(0, 0, this.glCanvas.width, this.glCanvas.height);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.needsDraw = true;
  }

  private attachObservers() {
    this.glCanvas.addEventListener("webglcontextlost", this.onContextLost);
    this.glCanvas.addEventListener("webglcontextrestored", this.onContextRestored);

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this.container);
    }
    const root = this.container.closest<HTMLElement>(".lq-root");
    if (root && typeof MutationObserver !== "undefined") {
      // The kit switches palette/surface by flipping data attributes on `.lq-root`, so watching
      // them is how the globe learns its colors changed without the product having to tell it.
      this.themeObserver = new MutationObserver(() => this.refreshTheme());
      this.themeObserver.observe(root, {
        attributes: true,
        attributeFilter: ["data-lq-palette", "data-lq-surface"],
      });
    }
  }

  // ---------------------------------------------------------------- buffers

  private uploadDots() {
    const [landSamples, latticeCount] = DOT_BUDGET[this.options.quality];
    const land = buildLandDots(landSamples);
    const lattice = buildLattice(latticeCount);
    this.buffers.land.upload(land.data, land.count, this.gl.STATIC_DRAW);
    this.buffers.lattice.upload(lattice.data, lattice.count, this.gl.STATIC_DRAW);
    this.needsDraw = true;
  }

  private visibleAt(minLod: GlobeLod | undefined, lod: GlobeLod): boolean {
    return lodRank(minLod ?? "world") <= lodRank(lod);
  }

  /** Rebuilds every data-driven buffer. Runs only when the data, options or LOD tier change. */
  private rebuildGeometry() {
    const lod = this.camera.lod;
    const highlights = new Set(this.options.highlightedFlowIds);
    const selected = this.options.selectedNodeId;
    const hasFocus = selected !== null || highlights.size > 0;

    // ---- flows -----------------------------------------------------
    const visible = this.resolvedFlows.filter((f) => this.visibleAt(f.flow.minLod, lod));
    this.liveFlows = visible;

    let arcVerts = 0;
    // Long arcs get more segments than short ones: tessellation only has to keep the chord error
    // under a pixel, and that is a function of the arc's angular length, not of anything else.
    const segmentsFor = (f: ResolvedFlow) =>
      clamp(Math.round(angularDistance(f.aLon, f.aLat, f.bLon, f.bLat) * 28) + 10, 12, 64);
    const segCounts = visible.map(segmentsFor);
    for (let i = 0; i < visible.length; i++) arcVerts += (segCounts[i] + 1) * 2 + (i > 0 ? 2 : 0);

    const arcData = new Float32Array(arcVerts * ARC_STRIDE);
    let w = 0;
    let prev: number[] | null = null;

    for (let i = 0; i < visible.length; i++) {
      const f = visible[i];
      const seg = segCounts[i];
      const highlighted = highlights.has(f.flow.id) || f.touchesSelection;
      const base = highlighted ? this.colors.highlight : this.colorFor(f.flow.color, this.colors.flow);
      // Anything outside the current focus is pushed down rather than hidden: §44's priority order
      // only works if the secondary material is still *there*, just quieter.
      const dim = hasFocus && !highlighted ? 0.22 : 1;
      const alpha = (0.28 + 0.62 * f.intensity) * dim;
      const width = (f.flow.width ?? 0.9 + 1.8 * f.intensity) * (highlighted ? 1.6 : 1) * this.dpr;
      const dash = (f.flow.style ?? "solid") === "dashed" ? 26 : 0;
      const style = [width, f.altitude, dash, 0];
      const color = [base[0], base[1], base[2], alpha];

      for (let s = 0; s <= seg; s++) {
        const t = s / seg;
        for (const side of [-1, 1]) {
          const v = [f.aLon, f.aLat, f.bLon, f.bLat, t, side, ...style, ...color];
          if (s === 0 && side === -1 && prev) {
            // Degenerate bridge: repeat the previous strip's last vertex and this strip's first,
            // so every arc can live in a single TRIANGLE_STRIP draw call.
            w = writeVertex(arcData, w, prev);
            w = writeVertex(arcData, w, v);
          }
          w = writeVertex(arcData, w, v);
          prev = v;
        }
      }
    }
    this.buffers.arcs.upload(arcData, arcVerts, this.gl.DYNAMIC_DRAW);
    this.hoverDirty = true;

    // ---- particles -------------------------------------------------
    // Only the strongest flows animate. Everything else keeps its arc but loses its particles,
    // which is the cheapest honest way to stay fluid as the flow count climbs (§15).
    const animated = this.options.animateFlows && this.options.quality !== "low"
      ? [...visible]
          .sort((a, b) => Number(b.touchesSelection) - Number(a.touchesSelection) || b.intensity - a.intensity)
          .slice(0, this.options.maxAnimatedFlows)
      : [];

    let particleCount = 0;
    const perFlow = animated.map((f) => {
      const n = f.flow.particles ?? Math.max(1, Math.round(1 + f.intensity * 3));
      return f.flow.bidirectional ? n * 2 : n;
    });
    for (const n of perFlow) particleCount += n;

    const pData = new Float32Array(particleCount * PARTICLE_STRIDE);
    let pw = 0;
    for (let i = 0; i < animated.length; i++) {
      const f = animated[i];
      const total = perFlow[i];
      const highlighted = highlights.has(f.flow.id) || f.touchesSelection;
      const base = highlighted ? this.colors.highlight : this.colorFor(f.flow.color, this.colors.flow);
      const dim = hasFocus && !highlighted ? 0.3 : 1;
      const speed = f.flow.speed ?? 0.18;
      // Base widened from 2.2–5.4px: with the old falloff on top, a particle read as roughly half
      // the diameter it was drawn at, which left the weakest flows barely animated at all.
      const size =
        (3.6 + 5.4 * f.intensity) * (highlighted ? 1.35 : 1) * this.options.particleScale * this.dpr;
      const half = f.flow.bidirectional ? total / 2 : total;
      for (let k = 0; k < total; k++) {
        const forward = !f.flow.bidirectional || k < half;
        // Evenly staggered phases: random ones clump, and a clump reads as one fat particle.
        const phase = (k % half) / half;
        pw = writeVertex(pData, pw, [
          f.aLon,
          f.aLat,
          f.bLon,
          f.bLat,
          phase,
          speed,
          f.altitude,
          forward ? 1 : -1,
          base[0],
          base[1],
          base[2],
          (0.55 + 0.45 * f.intensity) * dim,
          size,
        ]);
      }
    }
    this.buffers.particles.upload(pData, particleCount, this.gl.DYNAMIC_DRAW);

    // ---- nodes + markers -------------------------------------------
    this.liveNodes = this.nodes.filter((n) => this.visibleAt(n.minLod, lod));
    const nData = new Float32Array(this.liveNodes.length * NODE_STRIDE);
    let nw = 0;
    for (const n of this.liveNodes) {
      const isSelected = n.id === selected;
      const c = isSelected ? this.colors.highlight : this.colorFor(n.color, this.colors.node);
      const v = lonLatToVec3(n.lon, n.lat) as number[];
      const dim = hasFocus && !isSelected ? 0.45 : 1;
      nw = writeVertex(nData, nw, [
        v[0], v[1], v[2],
        c[0], c[1], c[2], dim,
        (n.size ?? 5) * this.dpr,
        n.pulse ? 1 : 0,
        isSelected ? 1 : 0,
      ]);
    }
    this.buffers.nodes.upload(nData, this.liveNodes.length, this.gl.DYNAMIC_DRAW);

    this.liveMarkers = this.markers.filter((m) => this.visibleAt(m.minLod, lod));
    const mData = new Float32Array(this.liveMarkers.length * NODE_STRIDE);
    let mw = 0;
    for (const m of this.liveMarkers) {
      const c = this.colorFor(m.color, this.colors.marker);
      const v = lonLatToVec3(m.lon, m.lat) as number[];
      mw = writeVertex(mData, mw, [v[0], v[1], v[2], c[0], c[1], c[2], 1, (m.size ?? 4) * this.dpr, 0, 0]);
    }
    this.buffers.markers.upload(mData, this.liveMarkers.length, this.gl.DYNAMIC_DRAW);

    if (this.nodeScreen.length < this.liveNodes.length * 3) {
      this.nodeScreen = new Float32Array(this.liveNodes.length * 3);
    }
    if (this.markerScreen.length < this.liveMarkers.length * 3) {
      this.markerScreen = new Float32Array(this.liveMarkers.length * 3);
    }

    this.geometryDirty = false;
  }

  /**
   * Rebuilds the outline of the country under the pointer.
   *
   * Reuses the arc program rather than adding a line one: each border edge is a (very short)
   * great-circle arc at altitude zero, which buys correct screen-space width, the page-coloured
   * casing and the behind-the-globe fade for free. `gl.LINES` would have been less code and worse
   * output — every desktop driver clamps `lineWidth` to 1, so the outline would be a hairline that
   * vanishes at high DPI.
   */
  private buildCountryBorder() {
    this.borderDirty = false;
    const country = this.hoveredCountry;
    if (!country) {
      this.buffers.border.upload(new Float32Array(0), 0, this.gl.DYNAMIC_DRAW);
      return;
    }

    // Long edges are subdivided because the shader places the *stations* on the great circle but
    // draws straight quads between them: a 20-degree edge left as one quad visibly cuts across the
    // curve near the limb. Two degrees a step is below a pixel at any zoom this globe allows.
    const stepsFor = (i: number, ring: Float64Array) =>
      clamp(
        Math.ceil(angularDistance(ring[i * 2], ring[i * 2 + 1], ring[i * 2 + 2], ring[i * 2 + 3]) / DEG / 2),
        1,
        12
      );

    // Counted before writing so the buffer is allocated once. Building into a plain array and
    // converting would spend more time in `push` than in everything else here put together.
    let count = 0;
    let firstRing = true;
    for (const ring of country.rings) {
      const points = ring.length / 2;
      if (points < 2) continue;
      if (!firstRing) count += 2;
      firstRing = false;
      for (let i = 0; i < points - 1; i++) count += (stepsFor(i, ring) + 1) * 2;
    }
    if (count === 0) {
      this.buffers.border.upload(new Float32Array(0), 0, this.gl.DYNAMIC_DRAW);
      return;
    }

    const data = new Float32Array(count * ARC_STRIDE);
    const c = this.colors.countryBorder;
    const style = [2.1 * this.dpr, 0, 0, 0];
    const color = [c[0], c[1], c[2], 1];

    let w = 0;
    let prev: number[] | null = null;
    let bridge = false;
    for (const ring of country.rings) {
      const points = ring.length / 2;
      if (points < 2) continue;
      for (let i = 0; i < points - 1; i++) {
        const aLon = ring[i * 2];
        const aLat = ring[i * 2 + 1];
        const bLon = ring[i * 2 + 2];
        const bLat = ring[i * 2 + 3];
        const steps = stepsFor(i, ring);
        for (let s = 0; s <= steps; s++) {
          const t = s / steps;
          for (const side of [-1, 1]) {
            const v = [aLon, aLat, bLon, bLat, t, side, ...style, ...color];
            if (bridge && prev) {
              // Only between rings. Inside a ring the strip runs straight on from one edge to the
              // next, and the quad it spans across the shared endpoint is exactly the wedge that
              // fills the corner — a free mitre that a bridge here would throw away.
              w = writeVertex(data, w, prev);
              w = writeVertex(data, w, v);
              bridge = false;
            }
            w = writeVertex(data, w, v);
            prev = v;
          }
        }
      }
      bridge = true;
    }
    this.buffers.border.upload(data, count, this.gl.DYNAMIC_DRAW);
  }

  /**
   * Rebuilds the one-arc buffer for whatever the pointer is over.
   *
   * A separate buffer rather than a flag inside the main one. Hover changes as fast as the pointer
   * moves, and rewriting the whole flow buffer at that rate would make pointing at a dense graph
   * cost O(flows) per movement; this is O(1) in the number of flows.
   */
  private buildHoverArc() {
    this.hoverDirty = false;

    const f = this.hoveredFlowId ? this.liveFlows.find((x) => x.flow.id === this.hoveredFlowId) : undefined;
    if (!f) {
      this.buffers.hoverArc.upload(new Float32Array(0), 0, this.gl.DYNAMIC_DRAW);
      return;
    }

    const seg = clamp(Math.round(angularDistance(f.aLon, f.aLat, f.bLon, f.bLat) * 28) + 10, 12, 64);
    const count = (seg + 1) * 2;
    const data = new Float32Array(count * ARC_STRIDE);
    const c = this.colors.hover;
    // Thicker than the resting arc as well as recoloured: on a small screen, or for a reader who
    // does not separate these hues easily, weight carries the same message colour does.
    const width = (f.flow.width ?? 0.9 + 1.8 * f.intensity) * 2.1 * this.dpr;
    const dash = (f.flow.style ?? "solid") === "dashed" ? 26 : 0;
    const style = [width, f.altitude, dash, 0];
    const color = [c[0], c[1], c[2], 1];

    let w = 0;
    for (let s = 0; s <= seg; s++) {
      const t = s / seg;
      for (const side of [-1, 1]) {
        w = writeVertex(data, w, [f.aLon, f.aLat, f.bLon, f.bLat, t, side, ...style, ...color]);
      }
    }
    this.buffers.hoverArc.upload(data, count, this.gl.DYNAMIC_DRAW);
  }

  // ---------------------------------------------------------------- loop

  start() {
    if (this.running || this.disposed || this.contextLost) return;
    this.running = true;
    this.startedAt = performance.now();
    this.lastFrame = this.startedAt;
    this.fpsSince = this.startedAt;
    const tick = (now: number) => {
      if (!this.running) return;
      this.frame(now);
      this.rafId = requestAnimationFrame(tick);
    };
    this.rafId = requestAnimationFrame(tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  getFps() {
    return this.fps;
  }

  private frame(now: number) {
    if (this.contextLost) return;
    const dt = Math.min(0.1, (now - this.lastFrame) / 1000);
    this.lastFrame = now;

    this.fpsFrames++;
    if (now - this.fpsSince >= 500) {
      this.fps = Math.round((this.fpsFrames * 1000) / (now - this.fpsSince));
      this.fpsFrames = 0;
      this.fpsSince = now;
    }

    const moved = this.camera.step(dt, now);
    const animating = this.options.animateFlows && this.buffers.particles.count > 0;

    if (moved) {
      const lod = this.camera.lod;
      if (lod !== this.lastLod) {
        this.lastLod = lod;
        this.geometryDirty = true;
        this.callbacks.onLodChange?.(lod);
      }
      const view = this.camera.getView();
      // Reported coarsely: a consumer that mirrors this into React state should not get 60
      // updates a second describing a tenth of a degree.
      if (
        Math.abs(view.lon - this.lastReportedView.lon) > 0.5 ||
        Math.abs(view.lat - this.lastReportedView.lat) > 0.5 ||
        Math.abs(view.zoom - this.lastReportedView.zoom) > 0.01
      ) {
        this.lastReportedView = view;
        this.callbacks.onViewChange?.(view);
      }
    }

    if (this.geometryDirty) this.rebuildGeometry();
    if (this.hoverDirty) this.buildHoverArc();
    if (this.borderDirty) this.buildCountryBorder();

    // A settled globe with animation off draws nothing at all — no GPU work, no battery drain.
    if (moved || animating || this.needsDraw) {
      this.draw(now);
      this.needsDraw = false;
    }

    if (this.pointer.moved || moved) {
      this.updateHover();
      this.pointer.moved = false;
    }
  }

  // ---------------------------------------------------------------- draw

  private draw(now: number) {
    const gl = this.gl;
    const time = (now - this.startedAt) / 1000;

    viewRotation(this.camera.lon, this.camera.lat, this.rot);
    const minSide = Math.min(this.glCanvas.width, this.glCanvas.height);
    this.radiusPx = minSide * 0.42 * this.camera.zoom;

    const vpx = this.glCanvas.width / 2;
    const vpy = this.glCanvas.height / 2;

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    // ---- sphere + atmosphere
    {
      const p = this.programs.sphere;
      gl.useProgram(p.program);
      bindInterleaved(gl, p, this.buffers.sphere.buffer, 2, SPHERE_ATTRIBS);
      gl.uniform1f(p.uniform("uRadiusPx"), this.radiusPx);
      gl.uniform2f(p.uniform("uViewport"), vpx, vpy);
      gl.uniform3fv(p.uniform("uCore"), this.colors.sphere.slice(0, 3));
      gl.uniform3fv(p.uniform("uEdge"), this.colors.sphereEdge.slice(0, 3));
      gl.uniform3fv(p.uniform("uAtmo"), this.colors.atmosphere.slice(0, 3));
      const style = this.renderStyle;
      gl.uniform1f(p.uniform("uBodyAlpha"), style.bodyAlpha);
      gl.uniform1f(p.uniform("uAtmoAlpha"), style.atmosphereAlpha);
      gl.uniform1f(p.uniform("uShading"), style.shading);
      // Feathering is in sphere-radius units, so it has to be derived from the on-screen radius to
      // stay a constant ~1.5px however far the camera is.
      gl.uniform1f(p.uniform("uFeather"), 1.5 / Math.max(1, this.radiusPx));
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      unbindAttribs(gl, p, SPHERE_ATTRIBS);
    }

    // ---- dot layers
    {
      const p = this.programs.dots;
      gl.useProgram(p.program);
      gl.uniformMatrix3fv(p.uniform("uRot"), false, this.rot);
      gl.uniform1f(p.uniform("uRadiusPx"), this.radiusPx);
      gl.uniform2f(p.uniform("uViewport"), vpx, vpy);

      const style = this.renderStyle;
      gl.uniform1f(p.uniform("uRound"), style.roundDots);

      // 1.7px rather than the 1.05px this used to be. A single-pixel dot, further shrunk by the
      // circular mask and the depth falloff, covered so little of its pixel that a continent read
      // as a faint haze rather than as land — which is exactly the contrast complaint this fixes.
      const dotPx = clamp(2.2 * this.dpr * Math.pow(this.camera.zoom, 0.35), 1.6, 7);

      if (this.colors.lattice[3] > 0 && this.buffers.lattice.count > 0) {
        bindInterleaved(gl, p, this.buffers.lattice.buffer, DOT_STRIDE, DOT_ATTRIBS);
        gl.uniform3fv(p.uniform("uColor"), this.colors.lattice.slice(0, 3));
        gl.uniform1f(p.uniform("uPointSize"), dotPx * style.latticeDotScale);
        gl.drawArrays(gl.POINTS, 0, this.buffers.lattice.count);
      }
      if (this.buffers.land.count > 0) {
        bindInterleaved(gl, p, this.buffers.land.buffer, DOT_STRIDE, DOT_ATTRIBS);
        gl.uniform3fv(p.uniform("uColor"), this.colors.land.slice(0, 3));
        gl.uniform1f(p.uniform("uPointSize"), dotPx * style.landDotScale);
        gl.drawArrays(gl.POINTS, 0, this.buffers.land.count);
      }
      unbindAttribs(gl, p, DOT_ATTRIBS);
    }

    // ---- country outline, under the flows: it answers "where am I pointing", which must never
    // compete with the data drawn on top of it.
    if (this.buffers.border.count > 0) {
      const p = this.programs.arcs;
      const style = this.renderStyle;
      gl.useProgram(p.program);
      bindInterleaved(gl, p, this.buffers.border.buffer, ARC_STRIDE, ARC_ATTRIBS);
      gl.uniformMatrix3fv(p.uniform("uRot"), false, this.rot);
      gl.uniform1f(p.uniform("uRadiusPx"), this.radiusPx);
      gl.uniform2f(p.uniform("uViewport"), vpx, vpy);
      if (style.arcCasingPx > 0) {
        gl.uniform1f(p.uniform("uCasing"), 1);
        gl.uniform3fv(p.uniform("uCasingColor"), this.colors.sphere.slice(0, 3));
        gl.uniform1f(p.uniform("uWidthBoost"), style.arcCasingPx * this.dpr);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.buffers.border.count);
      }
      gl.uniform1f(p.uniform("uCasing"), 0);
      gl.uniform1f(p.uniform("uWidthBoost"), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.buffers.border.count);
      unbindAttribs(gl, p, ARC_ATTRIBS);
    }

    // ---- arcs
    if (this.buffers.arcs.count > 0) {
      const p = this.programs.arcs;
      const style = this.renderStyle;
      gl.useProgram(p.program);
      bindInterleaved(gl, p, this.buffers.arcs.buffer, ARC_STRIDE, ARC_ATTRIBS);
      gl.uniformMatrix3fv(p.uniform("uRot"), false, this.rot);
      gl.uniform1f(p.uniform("uRadiusPx"), this.radiusPx);
      gl.uniform2f(p.uniform("uViewport"), vpx, vpy);

      if (style.arcCasingPx > 0) {
        // Same buffer, drawn wider and in the page colour first. One extra draw call for the whole
        // flow layer, which is why this is affordable at any flow count.
        gl.uniform1f(p.uniform("uCasing"), 1);
        gl.uniform3fv(p.uniform("uCasingColor"), this.colors.sphere.slice(0, 3));
        gl.uniform1f(p.uniform("uWidthBoost"), style.arcCasingPx * this.dpr);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.buffers.arcs.count);
      }

      gl.uniform1f(p.uniform("uCasing"), 0);
      gl.uniform1f(p.uniform("uWidthBoost"), 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.buffers.arcs.count);

      // The hovered arc last, so it sits above every other flow it crosses — the whole point is to
      // be able to follow it through a tangle.
      if (this.buffers.hoverArc.count > 0) {
        bindInterleaved(gl, p, this.buffers.hoverArc.buffer, ARC_STRIDE, ARC_ATTRIBS);
        if (style.arcCasingPx > 0) {
          gl.uniform1f(p.uniform("uCasing"), 1);
          gl.uniform3fv(p.uniform("uCasingColor"), this.colors.sphere.slice(0, 3));
          gl.uniform1f(p.uniform("uWidthBoost"), style.arcCasingPx * this.dpr);
          gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.buffers.hoverArc.count);
          gl.uniform1f(p.uniform("uCasing"), 0);
          gl.uniform1f(p.uniform("uWidthBoost"), 0);
        }
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, this.buffers.hoverArc.count);
      }

      unbindAttribs(gl, p, ARC_ATTRIBS);
    }

    // ---- particles
    if (this.buffers.particles.count > 0 && this.options.animateFlows) {
      // Additive on a dark ground so overlapping trails brighten rather than muddy; normal on paper,
      // where additive would only push them toward the page colour and erase them.
      if (this.renderStyle.additiveParticles) gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
      const p = this.programs.particles;
      gl.useProgram(p.program);
      bindInterleaved(gl, p, this.buffers.particles.buffer, PARTICLE_STRIDE, PARTICLE_ATTRIBS);
      gl.uniformMatrix3fv(p.uniform("uRot"), false, this.rot);
      gl.uniform1f(p.uniform("uRadiusPx"), this.radiusPx);
      gl.uniform2f(p.uniform("uViewport"), vpx, vpy);
      gl.uniform1f(p.uniform("uTime"), time);
      gl.uniform1f(p.uniform("uSoftness"), this.renderStyle.particleSoftness);
      gl.drawArrays(gl.POINTS, 0, this.buffers.particles.count);
      unbindAttribs(gl, p, PARTICLE_ATTRIBS);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    }

    // ---- nodes + markers
    {
      const p = this.programs.nodes;
      gl.useProgram(p.program);
      gl.uniformMatrix3fv(p.uniform("uRot"), false, this.rot);
      gl.uniform1f(p.uniform("uRadiusPx"), this.radiusPx);
      gl.uniform2f(p.uniform("uViewport"), vpx, vpy);
      gl.uniform1f(p.uniform("uTime"), time);
      gl.uniform1f(p.uniform("uMoat"), this.renderStyle.nodeMoat);
      gl.uniform3fv(p.uniform("uMoatColor"), this.colors.sphere.slice(0, 3));
      if (this.buffers.nodes.count > 0) {
        bindInterleaved(gl, p, this.buffers.nodes.buffer, NODE_STRIDE, NODE_ATTRIBS);
        gl.drawArrays(gl.POINTS, 0, this.buffers.nodes.count);
      }
      if (this.buffers.markers.count > 0) {
        bindInterleaved(gl, p, this.buffers.markers.buffer, NODE_STRIDE, NODE_ATTRIBS);
        gl.drawArrays(gl.POINTS, 0, this.buffers.markers.count);
      }
      unbindAttribs(gl, p, NODE_ATTRIBS);
    }

    this.projectAll();
    this.drawLabels();
  }

  /** Projects live nodes/markers into CSS pixels, for hit-testing and label layout. */
  private projectAll() {
    const rCss = this.radiusPx / this.dpr;
    const cx = this.widthCss / 2;
    const cy = this.heightCss / 2;
    const out: number[] = [0, 0, 0];

    for (let i = 0; i < this.liveNodes.length; i++) {
      const n = this.liveNodes[i];
      const v = lonLatToVec3(n.lon, n.lat) as number[];
      applyMat3(this.rot, v[0], v[1], v[2], out);
      this.nodeScreen[i * 3] = cx + out[0] * rCss;
      // Screen Y grows downward while the sphere's +Y is north, hence the sign flip here and
      // nowhere else — WebGL's own NDC already points the right way.
      this.nodeScreen[i * 3 + 1] = cy - out[1] * rCss;
      this.nodeScreen[i * 3 + 2] = out[2] > 0 ? 1 : 0;
    }
    for (let i = 0; i < this.liveMarkers.length; i++) {
      const m = this.liveMarkers[i];
      const v = lonLatToVec3(m.lon, m.lat) as number[];
      applyMat3(this.rot, v[0], v[1], v[2], out);
      this.markerScreen[i * 3] = cx + out[0] * rCss;
      this.markerScreen[i * 3 + 1] = cy - out[1] * rCss;
      this.markerScreen[i * 3 + 2] = out[2] > 0 ? 1 : 0;
    }
  }

  private drawLabels() {
    const ctx = this.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, this.widthCss, this.heightCss);
    if (this.options.labelMode === "none") return;

    const lod = this.camera.lod;
    const budget = this.options.labelMode === "all" ? Number.POSITIVE_INFINITY : LABEL_BUDGET[lod];

    interface Candidate {
      text: string;
      x: number;
      y: number;
      rank: number;
      emphasis: boolean;
    }
    const candidates: Candidate[] = [];

    for (let i = 0; i < this.liveNodes.length; i++) {
      const n = this.liveNodes[i];
      if (!n.label || this.nodeScreen[i * 3 + 2] === 0) continue;
      const selected = n.id === this.options.selectedNodeId;
      const hovered = n.id === this.hoveredNodeId;
      candidates.push({
        text: n.label,
        x: this.nodeScreen[i * 3],
        y: this.nodeScreen[i * 3 + 1],
        // Selection and hover outrank everything, then the caller's own weight — §44's priority
        // list applied to the one resource labels actually compete for, which is space.
        rank: (selected ? 1e6 : 0) + (hovered ? 5e5 : 0) + (n.weight ?? 0),
        emphasis: selected || hovered,
      });
    }
    for (let i = 0; i < this.liveMarkers.length; i++) {
      const m = this.liveMarkers[i];
      if (!m.label || this.markerScreen[i * 3 + 2] === 0) continue;
      candidates.push({
        text: m.label,
        x: this.markerScreen[i * 3],
        y: this.markerScreen[i * 3 + 1],
        rank: -1,
        emphasis: false,
      });
    }

    candidates.sort((a, b) => b.rank - a.rank);

    const fontSize = 11;
    ctx.font = `600 ${fontSize}px ${getComputedStyle(this.container).fontFamily || "sans-serif"}`;
    ctx.textBaseline = "middle";
    const [lr, lg, lb] = this.colors.label;
    const css = (a: number) => `rgba(${Math.round(lr * 255)}, ${Math.round(lg * 255)}, ${Math.round(lb * 255)}, ${a})`;

    const placed: { x0: number; y0: number; x1: number; y1: number }[] = [];
    let drawn = 0;

    for (const c of candidates) {
      if (drawn >= budget) break;
      const w = ctx.measureText(c.text).width;
      const x0 = c.x + 9;
      const y0 = c.y - fontSize * 0.7;
      const box = { x0, y0, x1: x0 + w, y1: y0 + fontSize * 1.4 };
      if (box.x1 > this.widthCss || box.x0 < 0 || box.y0 < 0 || box.y1 > this.heightCss) continue;
      // Greedy rejection, highest rank first. With a few dozen boxes the quadratic scan is far
      // cheaper than maintaining any spatial structure for it.
      if (placed.some((p) => !(box.x1 < p.x0 || box.x0 > p.x1 || box.y1 < p.y0 || box.y0 > p.y1))) continue;
      placed.push(box);

      if (this.renderStyle.labelHalo) {
        // Knocked out of the page colour rather than drawn in a box: a plate behind every label
        // would tile the globe with rectangles, while an outline follows the glyphs and leaves the
        // map visible between them.
        const [br, bg2, bb] = this.colors.sphere;
        ctx.strokeStyle = `rgba(${Math.round(br * 255)}, ${Math.round(bg2 * 255)}, ${Math.round(bb * 255)}, 0.92)`;
        ctx.lineWidth = 3;
        ctx.lineJoin = "round";
        ctx.strokeText(c.text, x0, c.y);
      }

      ctx.fillStyle = css(c.emphasis ? 1 : this.renderStyle.labelHalo ? 0.88 : 0.66);
      ctx.fillText(c.text, x0, c.y);
      drawn++;
    }
  }

  // ---------------------------------------------------------------- input

  private attachPointer() {
    const el = this.container;
    el.addEventListener("pointerdown", this.onPointerDown);
    el.addEventListener("pointermove", this.onPointerMove);
    el.addEventListener("pointerup", this.onPointerUp);
    el.addEventListener("pointercancel", this.onPointerUp);
    el.addEventListener("pointerleave", this.onPointerLeave);
    el.addEventListener("wheel", this.onWheel, { passive: false });
  }

  private detachPointer() {
    const el = this.container;
    el.removeEventListener("pointerdown", this.onPointerDown);
    el.removeEventListener("pointermove", this.onPointerMove);
    el.removeEventListener("pointerup", this.onPointerUp);
    el.removeEventListener("pointercancel", this.onPointerUp);
    el.removeEventListener("pointerleave", this.onPointerLeave);
    el.removeEventListener("wheel", this.onWheel);
  }

  private localPoint(e: PointerEvent | WheelEvent) {
    const rect = this.container.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  private onPointerDown = (e: PointerEvent) => {
    if (!this.options.interactive || e.button !== 0) return;
    const p = this.localPoint(e);
    this.drag = { active: true, moved: false, lastX: p.x, lastY: p.y, pointerId: e.pointerId };
    this.camera.stopInertia();
    this.container.setPointerCapture?.(e.pointerId);
  };

  private onPointerMove = (e: PointerEvent) => {
    const p = this.localPoint(e);
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.inside = true;
    // Hover resolution is deferred to the next frame rather than run here: a fast drag fires
    // pointermove far more often than the screen refreshes, and every one of those would
    // otherwise re-scan the flow set.
    this.pointer.moved = true;

    if (this.drag.active) {
      const dx = p.x - this.drag.lastX;
      const dy = p.y - this.drag.lastY;
      if (Math.abs(dx) > 0 || Math.abs(dy) > 0) this.drag.moved = true;
      this.drag.lastX = p.x;
      this.drag.lastY = p.y;
      this.camera.drag(dx, dy, this.radiusPx / this.dpr);
      this.needsDraw = true;
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    const wasDragging = this.drag.active;
    const moved = this.drag.moved;
    if (this.drag.pointerId >= 0) this.container.releasePointerCapture?.(this.drag.pointerId);
    this.drag = { active: false, moved: false, lastX: 0, lastY: 0, pointerId: -1 };
    if (!wasDragging) return;

    if (moved) {
      this.camera.release();
      return;
    }

    // A press that never moved is a click. Nodes win over flows: they are the smaller target and
    // the one a user is more likely to be aiming at when the two overlap.
    const p = this.localPoint(e);
    const node = this.pickNode(p.x, p.y);
    if (node) {
      this.callbacks.onNodeClick?.(node, p.x, p.y);
      return;
    }
    const flow = this.pickFlow(p.x, p.y);
    if (flow) {
      this.callbacks.onFlowClick?.(flow.flow, p.x, p.y);
      return;
    }
    this.callbacks.onBackgroundClick?.();
  };

  private onPointerLeave = () => {
    this.pointer.inside = false;
    if (this.hoveredNodeId !== null) {
      this.hoveredNodeId = null;
      this.callbacks.onNodeHover?.(null, 0, 0);
      this.needsDraw = true;
    }
    if (this.hoveredFlowId !== null) {
      this.hoveredFlowId = null;
      this.hoverDirty = true;
      this.needsDraw = true;
      this.callbacks.onFlowHover?.(null, 0, 0);
    }
    this.clearCountryHover();
    this.container.style.cursor = "";
  };

  private onWheel = (e: WheelEvent) => {
    if (!this.options.interactive) return;
    e.preventDefault();
    // deltaMode 1 is "lines" (Firefox); treating those as pixels makes one notch zoom ~15x too
    // little, so they are scaled to a comparable pixel delta first.
    const delta = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    this.camera.nudgeZoom(Math.exp(-delta * 0.0015));
    this.needsDraw = true;
  };

  /**
   * Turns a pointer position into the coordinates under it, or `null` when the pointer is off the
   * globe entirely.
   *
   * The projection is orthographic, so this inverts cleanly: undo the screen scaling to get the
   * point's x and y on the unit sphere, recover z from them (the near hemisphere is the only one
   * that can be pointed at), then undo the camera rotation — which, being orthonormal, inverts by
   * transposition.
   */
  private pointerToLonLat(x: number, y: number): [number, number] | null {
    const rCss = this.radiusPx / this.dpr;
    if (rCss <= 0) return null;
    const nx = (x - this.widthCss / 2) / rCss;
    const ny = -(y - this.heightCss / 2) / rCss;
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) return null;
    const v = applyMat3Transpose(this.rot, nx, ny, Math.sqrt(1 - d2));
    return vec3ToLonLat(v[0], v[1], v[2]);
  }

  /** Resolves, and reports, the country under the pointer. No-op unless `countryHover` is on. */
  private updateCountryHover(x: number, y: number) {
    if (!this.options.countryHover) return;
    if (!this.countriesLoaded) {
      this.countries = getCountries();
      this.countriesLoaded = true;
    }
    if (!this.countries) return;

    const ll = this.pointerToLonLat(x, y);
    const country = ll ? findCountryAt(this.countries, ll[0], ll[1]) : null;
    if ((country?.id ?? null) === (this.hoveredCountry?.id ?? null)) return;

    this.hoveredCountry = country;
    this.borderDirty = true;
    this.needsDraw = true;
    this.callbacks.onCountryHover?.(country ? { id: country.id, name: country.name } : null, x, y);
  }

  private clearCountryHover() {
    if (!this.hoveredCountry) return;
    this.hoveredCountry = null;
    this.borderDirty = true;
    this.needsDraw = true;
    this.callbacks.onCountryHover?.(null, 0, 0);
  }

  private pickNode(x: number, y: number): GlobeNode | null {
    let best: GlobeNode | null = null;
    let bestD = Infinity;
    for (let i = 0; i < this.liveNodes.length; i++) {
      if (this.nodeScreen[i * 3 + 2] === 0) continue;
      const dx = this.nodeScreen[i * 3] - x;
      const dy = this.nodeScreen[i * 3 + 1] - y;
      const d = dx * dx + dy * dy;
      // A generous radius on purpose: a 5px dot on a rotating sphere is a hard target, and the
      // cost of being slightly forgiving is far lower than the cost of a click that does nothing.
      const r = Math.max(11, (this.liveNodes[i].size ?? 5) * 1.6);
      if (d < r * r && d < bestD) {
        bestD = d;
        best = this.liveNodes[i];
      }
    }
    return best;
  }

  /**
   * Nearest visible arc within a few pixels, by sampling each candidate.
   *
   * Sampling beats an analytic solution here: an arc's screen path depends on the camera rotation
   * and the altitude bump, so there is no closed form to invert. 16 samples per flow, only on
   * frames where the pointer actually moved, keeps this in the tens of microseconds even with
   * several hundred flows.
   */
  private pickFlow(x: number, y: number): ResolvedFlow | null {
    const rCss = this.radiusPx / this.dpr;
    const cx = this.widthCss / 2;
    const cy = this.heightCss / 2;
    const out: number[] = [0, 0, 0];
    const SAMPLES = 16;
    const threshold = 7;

    let best: ResolvedFlow | null = null;
    let bestD = threshold * threshold;

    for (const f of this.liveFlows) {
      const a = lonLatToVec3(f.aLon, f.aLat) as number[];
      const b = lonLatToVec3(f.bLon, f.bLat) as number[];
      const omega = Math.acos(clamp(a[0] * b[0] + a[1] * b[1] + a[2] * b[2], -1, 1));
      const so = Math.sin(omega);

      for (let s = 0; s <= SAMPLES; s++) {
        const t = s / SAMPLES;
        let px: number, py: number, pz: number;
        if (so < 1e-4) {
          px = a[0]; py = a[1]; pz = a[2];
        } else {
          const w0 = Math.sin((1 - t) * omega) / so;
          const w1 = Math.sin(t * omega) / so;
          px = a[0] * w0 + b[0] * w1;
          py = a[1] * w0 + b[1] * w1;
          pz = a[2] * w0 + b[2] * w1;
        }
        const lift = 1 + f.altitude * Math.sin(t * Math.PI);
        applyMat3(this.rot, px * lift, py * lift, pz * lift, out);
        if (out[2] < 0 && Math.hypot(out[0], out[1]) < 1) continue; // behind the globe
        const sx = cx + out[0] * rCss;
        const sy = cy - out[1] * rCss;
        const d = (sx - x) * (sx - x) + (sy - y) * (sy - y);
        if (d < bestD) {
          bestD = d;
          best = f;
        }
      }
    }
    return best;
  }

  private updateHover() {
    if (!this.pointer.inside || this.drag.active || !this.options.interactive) return;
    const { x, y } = this.pointer;

    const node = this.pickNode(x, y);
    const nodeId = node?.id ?? null;
    if (nodeId !== this.hoveredNodeId) {
      this.hoveredNodeId = nodeId;
      this.callbacks.onNodeHover?.(node, x, y);
      this.needsDraw = true;
    }

    const flow = node ? null : this.pickFlow(x, y);
    const flowId = flow?.flow.id ?? null;
    if (flowId !== this.hoveredFlowId) {
      this.hoveredFlowId = flowId;
      this.hoverDirty = true;
      this.needsDraw = true;
      this.callbacks.onFlowHover?.(flow?.flow ?? null, x, y);
    }

    this.updateCountryHover(x, y);

    this.container.style.cursor = node || flow ? "pointer" : this.options.interactive ? "grab" : "";
  }

  // ---------------------------------------------------------------- public helpers

  focusNode(nodeId: string, opts?: { zoom?: number; durationMs?: number }) {
    const node = this.nodeById.get(nodeId);
    if (!node) return;
    this.camera.flyTo(node.lon, node.lat, opts?.zoom ?? Math.max(this.camera.zoom, 2.2), opts?.durationMs ?? 900);
  }

  focusLonLat(lon: number, lat: number, opts?: { zoom?: number; durationMs?: number }) {
    this.camera.flyTo(lon, lat, opts?.zoom ?? this.camera.zoom, opts?.durationMs ?? 900);
  }

  projectNode(nodeId: string): { x: number; y: number } | null {
    const i = this.liveNodes.findIndex((n) => n.id === nodeId);
    if (i < 0 || this.nodeScreen[i * 3 + 2] === 0) return null;
    return { x: this.nodeScreen[i * 3], y: this.nodeScreen[i * 3 + 1] };
  }

  destroy() {
    this.disposed = true;
    this.stop();
    this.detachPointer();
    this.glCanvas.removeEventListener("webglcontextlost", this.onContextLost);
    this.glCanvas.removeEventListener("webglcontextrestored", this.onContextRestored);
    this.resizeObserver?.disconnect();
    this.themeObserver?.disconnect();
    if (!this.contextLost) {
      for (const b of Object.values(this.buffers)) b.dispose();
      for (const p of Object.values(this.programs)) this.gl.deleteProgram(p.program);
    }

    // Deliberately NOT calling `WEBGL_lose_context.loseContext()` here.
    //
    // It used to, to free the drawing buffer eagerly rather than wait for GC. But a context belongs
    // to the *canvas*, not to this engine, and `getContext("webgl")` returns the same context object
    // for a given canvas every time — so losing it poisons that canvas for any engine mounted on it
    // afterwards, permanently. React StrictMode does exactly that in development: it mounts,
    // unmounts and remounts every effect, so the second engine inherited a dead context and every
    // shader compile failed with CONTEXT_LOST_WEBGL and an empty info log. Production builds do not
    // double-invoke, which is why this only ever showed up under `npm run dev`.
    //
    // Deleting the programs and buffers above already releases the GPU memory this engine
    // allocated; the context goes when the canvas is dropped and collected.
  }
}

/** Writes one vertex and returns the next write offset. */
function writeVertex(target: Float32Array, offset: number, values: number[]): number {
  for (let i = 0; i < values.length; i++) target[offset + i] = values[i];
  return offset + values.length;
}


export { lodForZoom };
