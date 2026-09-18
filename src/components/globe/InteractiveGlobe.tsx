import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { GlobeEngine, type GlobeEngineCallbacks, type GlobeEngineOptions } from "./engine/GlobeEngine";
import type {
  GlobeFlow,
  GlobeFlowEvent,
  GlobeLabelMode,
  GlobeLod,
  GlobeMarker,
  GlobeNode,
  GlobeNodeEvent,
  GlobeQuality,
  GlobeTheme,
  GlobeView,
  InteractiveGlobeHandle,
} from "./types";
import "./InteractiveGlobe.css";

export interface InteractiveGlobeProps {
  /** Points on the sphere. Also the lookup table flows use when they name endpoints by id. */
  nodes?: GlobeNode[];
  /** Great-circle arcs between nodes or raw coordinates, optionally carrying particles. */
  flows?: GlobeFlow[];
  /** Secondary points drawn above the flows (cities, events, infrastructure…). */
  markers?: GlobeMarker[];

  /** Spins the globe until the user touches it, then resumes a couple of seconds later. */
  autoRotate?: boolean;
  /** Degrees of longitude per second. Default 4. */
  autoRotateSpeed?: number;
  /** Set false to keep the arcs but stop every particle. Default true. */
  animateFlows?: boolean;
  /** Rendering budget — dot density and whether particles run at all. Default "high". */
  quality?: GlobeQuality;
  /** Hard cap on how many flows may carry particles at once. Default 90. */
  maxAnimatedFlows?: number;
  /** "auto" thins labels to fit the zoom tier; "all" draws every one. Default "auto". */
  labelMode?: GlobeLabelMode;
  /** Colors. Every entry accepts any CSS color and defaults to a `--lq-*` token. */
  theme?: GlobeTheme;

  /** Camera position on first mount. Changing it afterwards does nothing — use the ref. */
  initialView?: Partial<GlobeView>;
  /** Drawn with a ring, and used to dim everything it does not touch. */
  selectedNodeId?: string | null;
  /** Flows lifted out of the dimming, e.g. the steps of a scenario being played back. */
  highlightedFlowIds?: string[];
  /** Set false for a decorative globe: no drag, no zoom, no hit-testing. Default true. */
  interactive?: boolean;

  onNodeClick?: (event: GlobeNodeEvent) => void;
  onNodeHover?: (event: GlobeNodeEvent | null) => void;
  onFlowClick?: (event: GlobeFlowEvent) => void;
  onFlowHover?: (event: GlobeFlowEvent | null) => void;
  /** Fired for a click that hit neither a node nor a flow — the usual "clear selection" hook. */
  onBackgroundClick?: () => void;
  /** Throttled: only fires past half a degree of rotation or a 1% zoom change. */
  onViewChange?: (view: GlobeView) => void;
  onLodChange?: (lod: GlobeLod) => void;

  /** Absolutely-positioned content above the canvases (HUD, legend, tooltip). Not hit-testable
   *  unless a child opts back in with `pointer-events: auto`. */
  overlay?: ReactNode;
  /** Shown instead of the globe when the browser has no WebGL. */
  fallback?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Accessible name for the canvas region. */
  ariaLabel?: string;
}

/**
 * Tracks the OS "reduce motion" setting.
 *
 * A globe that spins on its own and streams particles across it is exactly the kind of continuous,
 * unprompted motion that setting exists to stop, and neither is driven by CSS — so honouring it has
 * to happen here rather than in a media query. Explicitly asking for `autoRotate` does not override
 * it: the preference is the user's, not the page's.
 */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

const EMPTY_NODES: GlobeNode[] = [];
const EMPTY_FLOWS: GlobeFlow[] = [];
const EMPTY_MARKERS: GlobeMarker[] = [];
const EMPTY_IDS: string[] = [];

/**
 * A rotating, zoomable 3D globe that draws points, great-circle flows and animated particles on
 * the GPU.
 *
 * The component knows nothing about what the data *means*: it takes points with coordinates and
 * arcs between them, and hands back ids when the user interacts. Everything domain-shaped — what a
 * node is, what a flow represents, what should happen on click — stays in the consuming product.
 * That boundary is what lets the same renderer drive an economic-dependency map, a logistics
 * dashboard and a network-latency view without forking.
 *
 * Rendering is WebGL and lives entirely outside React: the component mounts two canvases and an
 * engine, then pushes prop changes into it. React re-renders here cost one diff of an empty div —
 * they never touch the frame loop.
 *
 * @example
 * ```tsx
 * <InteractiveGlobe
 *   autoRotate
 *   nodes={[{ id: "fr", lon: 2.35, lat: 48.85, label: "France" }]}
 *   flows={[{ id: "oil", from: "ir", to: "fr", intensity: 0.8, bidirectional: true }]}
 *   onNodeClick={({ node }) => select(node.id)}
 * />
 * ```
 */
export const InteractiveGlobe = forwardRef<InteractiveGlobeHandle, InteractiveGlobeProps>(
  function InteractiveGlobe(
    {
      nodes = EMPTY_NODES,
      flows = EMPTY_FLOWS,
      markers = EMPTY_MARKERS,
      autoRotate = false,
      autoRotateSpeed = 4,
      animateFlows = true,
      quality = "high",
      maxAnimatedFlows = 90,
      labelMode = "auto",
      theme,
      initialView,
      selectedNodeId = null,
      highlightedFlowIds = EMPTY_IDS,
      interactive = true,
      onNodeClick,
      onNodeHover,
      onFlowClick,
      onFlowHover,
      onBackgroundClick,
      onViewChange,
      onLodChange,
      overlay,
      fallback,
      className,
      style,
      ariaLabel = "Interactive globe",
    },
    ref
  ) {
    const reducedMotion = usePrefersReducedMotion();
    const containerRef = useRef<HTMLDivElement>(null);
    const glCanvasRef = useRef<HTMLCanvasElement>(null);
    const labelCanvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<GlobeEngine | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Callbacks go through a ref so that a parent re-rendering with fresh closures — the normal
    // case for inline arrow props — never tears down and rebuilds the WebGL context.
    const callbacksRef = useRef<GlobeEngineCallbacks>({});
    callbacksRef.current = useMemo<GlobeEngineCallbacks>(
      () => ({
        onNodeClick: onNodeClick ? (node, x, y) => onNodeClick({ node, x, y }) : undefined,
        onNodeHover: onNodeHover ? (node, x, y) => onNodeHover(node ? { node, x, y } : null) : undefined,
        onFlowClick: onFlowClick ? (flow, x, y) => onFlowClick({ flow, x, y }) : undefined,
        onFlowHover: onFlowHover ? (flow, x, y) => onFlowHover(flow ? { flow, x, y } : null) : undefined,
        onBackgroundClick,
        onViewChange,
        onLodChange,
      }),
      [onNodeClick, onNodeHover, onFlowClick, onFlowHover, onBackgroundClick, onViewChange, onLodChange]
    );

    // Read once: the engine owns the camera from mount onward, and letting a prop yank it back
    // would fight every user drag.
    const initialViewRef = useRef<GlobeView>({
      lon: initialView?.lon ?? 10,
      lat: initialView?.lat ?? 25,
      zoom: initialView?.zoom ?? 1,
    });

    useEffect(() => {
      const container = containerRef.current;
      const glCanvas = glCanvasRef.current;
      const labelCanvas = labelCanvasRef.current;
      if (!container || !glCanvas || !labelCanvas) return;

      let engine: GlobeEngine;
      try {
        engine = new GlobeEngine(
          container,
          glCanvas,
          labelCanvas,
          initialViewRef.current,
          {
            autoRotate: false,
            autoRotateSpeed: 4,
            animateFlows: true,
            quality: "high",
            theme: {},
            labelMode: "auto",
            selectedNodeId: null,
            highlightedFlowIds: EMPTY_IDS,
            maxAnimatedFlows: 90,
            interactive: true,
          } satisfies GlobeEngineOptions,
          {
            // Forwarded through the ref rather than bound directly, for the reason above.
            onNodeClick: (n, x, y) => callbacksRef.current.onNodeClick?.(n, x, y),
            onNodeHover: (n, x, y) => callbacksRef.current.onNodeHover?.(n, x, y),
            onFlowClick: (f, x, y) => callbacksRef.current.onFlowClick?.(f, x, y),
            onFlowHover: (f, x, y) => callbacksRef.current.onFlowHover?.(f, x, y),
            onBackgroundClick: () => callbacksRef.current.onBackgroundClick?.(),
            onViewChange: (v) => callbacksRef.current.onViewChange?.(v),
            onLodChange: (l) => callbacksRef.current.onLodChange?.(l),
          }
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return;
      }

      engineRef.current = engine;
      engine.start();

      // Pausing off-screen is the single biggest win available here: a globe scrolled out of view
      // otherwise keeps a GPU busy at 60 fps for nobody.
      let observer: IntersectionObserver | null = null;
      if (typeof IntersectionObserver !== "undefined") {
        observer = new IntersectionObserver(
          ([entry]) => (entry.isIntersecting ? engine.start() : engine.stop()),
          { threshold: 0 }
        );
        observer.observe(container);
      }
      const onVisibility = () => (document.hidden ? engine.stop() : engine.start());
      document.addEventListener("visibilitychange", onVisibility);

      return () => {
        document.removeEventListener("visibilitychange", onVisibility);
        observer?.disconnect();
        engine.destroy();
        engineRef.current = null;
      };
    }, []);

    useEffect(() => {
      engineRef.current?.setData(nodes, flows, markers);
    }, [nodes, flows, markers]);

    useEffect(() => {
      engineRef.current?.setOptions({
        autoRotate: autoRotate && !reducedMotion,
        autoRotateSpeed,
        animateFlows: animateFlows && !reducedMotion,
        quality,
        theme: theme ?? {},
        labelMode,
        selectedNodeId,
        highlightedFlowIds,
        maxAnimatedFlows,
        interactive,
      });
    }, [
      reducedMotion,
      autoRotate,
      autoRotateSpeed,
      animateFlows,
      quality,
      theme,
      labelMode,
      selectedNodeId,
      highlightedFlowIds,
      maxAnimatedFlows,
      interactive,
    ]);

    const handle = useCallback<() => InteractiveGlobeHandle>(
      () => ({
        focusNode: (id, opts) => engineRef.current?.focusNode(id, opts),
        focusLonLat: (lon, lat, opts) => engineRef.current?.focusLonLat(lon, lat, opts),
        setView: (view) => engineRef.current?.camera.setView(view),
        getView: () => engineRef.current?.camera.getView() ?? initialViewRef.current,
        resetView: (opts) => engineRef.current?.camera.reset(opts?.durationMs),
        zoomBy: (factor, opts) => engineRef.current?.camera.zoomBy(factor, opts?.durationMs),
        projectNode: (id) => engineRef.current?.projectNode(id) ?? null,
        getFps: () => engineRef.current?.getFps() ?? 0,
      }),
      []
    );
    useImperativeHandle(ref, handle, [handle]);

    if (error) {
      return (
        <div className={["lq-globe", "lq-globe--error", className].filter(Boolean).join(" ")} style={style}>
          {fallback ?? <p className="lq-globe__error">{error}</p>}
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        className={["lq-globe", interactive && "lq-globe--interactive", className].filter(Boolean).join(" ")}
        style={style}
        role="img"
        aria-label={ariaLabel}
      >
        <canvas ref={glCanvasRef} className="lq-globe__canvas" aria-hidden="true" />
        <canvas ref={labelCanvasRef} className="lq-globe__canvas lq-globe__canvas--labels" aria-hidden="true" />
        {overlay && <div className="lq-globe__overlay">{overlay}</div>}
      </div>
    );
  }
);
