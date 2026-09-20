import { useCallback, useId, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { useChartDimensions, type ChartMargin } from "./internal/useChartDimensions";
import { useD3Zoom } from "./internal/useD3Zoom";
import { useFullscreen } from "./internal/useFullscreen";
import { CHART_PALETTE_RAMP } from "./internal/palette";
import {
  SANKEY_MIN_VISIBLE,
  downstreamOf,
  sankeyLayout,
  sankeyRibbonPath,
  upstreamOf,
  type SankeyLaidOutLink,
  type SankeyLaidOutNode,
} from "./internal/sankeyLayout";
import { ChartTooltip } from "./ChartTooltip";
import { ChevronRightIcon, MaximizeIcon, MinimizeIcon } from "../icons";
import "./charts-shared.css";
import "./SankeyChart.css";

export interface SankeyNodeDatum {
  id: string;
  label: string;
  /** Overrides the cycled palette colour. The ribbons leaving this node inherit it. */
  color?: string;
}

export interface SankeyLinkDatum {
  /** `id` of the node the flow leaves. */
  source: string;
  /** `id` of the node the flow arrives at. */
  target: string;
  value: number;
  /** Overrides the source node's own colour for this one ribbon. */
  color?: string;
}

export interface SankeyChartProps {
  nodes: SankeyNodeDatum[];
  links: SankeyLinkDatum[];
  height?: number;
  /** Width of a node's bar in px. Default 12. */
  nodeWidth?: number;
  /** Vertical gap between two nodes of the same column, in px. Default 14 — a ceiling, not a
   *  promise: a column of twenty leaves would spend the whole chart on gaps, so the layout narrows
   *  it as far as it needs to keep half the height for the flows themselves. */
  nodePadding?: number;
  /** `"justify"` (default) lines every terminal node up on the right-hand edge — what a budget
   *  diagram wants. `"left"` leaves each node in the column its longest incoming path gives it. */
  align?: "justify" | "left";
  formatValue?: (value: number) => string;
  /** Wheel to zoom, drag to pan, click a node to fly to its branch. Default true. */
  zoomable?: boolean;
  /** [min, max] zoom factor. Default [1, 14] — the upper end is what makes the deepest, thinnest
   *  ribbons of a real budget separable. */
  scaleExtent?: [number, number];
  /** Shows a fullscreen toggle in the toolbar. Default true. */
  fullscreenToggle?: boolean;
  /** Drops the chart's own outer border, for a chart already inside something that draws one.
   *  Same flag and effect as `LineAreaChart.embedded`. Default false. */
  embedded?: boolean;
  margin?: Partial<ChartMargin>;
  /** Fires in addition to — not instead of — the built-in zoom-to-branch. */
  onNodeClick?: (node: SankeyNodeDatum) => void;
  className?: string;
}

const DEFAULT_MARGIN: Partial<ChartMargin> = { top: 14, right: 14, bottom: 14, left: 14 };

/** A node has to be at least this tall *on screen* before its label is drawn. Zooming in raises
 *  every node's on-screen height, so labels appear progressively rather than all at once — which is
 *  the whole reason the wheel reveals more than it magnifies. */
const LABEL_MIN_PX = 11;
/** Same idea for the value written on a ribbon: only once the ribbon itself is thick enough to
 *  hold the text without it spilling over its neighbours. */
const RIBBON_LABEL_MIN_PX = 15;

/** Zoom thresholds for how much each label says. Chosen so that the first notch of a trackpad
 *  scroll already adds the figures — the detail has to feel like it is arriving, not like it needs
 *  to be earned. */
const DETAIL_VALUE_AT = 1.25;
const DETAIL_SHARE_AT = 2.1;

/** Margin left around a branch when the view flies to it, as a fraction of the branch's own box. */
const FIT_PADDING = 1.12;

type Hover = { kind: "node"; node: SankeyLaidOutNode } | { kind: "link"; link: SankeyLaidOutLink };

/** Sankey diagram — where a quantity comes from and where it ends up, drawn as ribbons whose
 *  thickness is the quantity itself.
 *
 *  Three things make it worth interacting with rather than just looking at:
 *
 *  - **the wheel adds detail, not just size.** Labels appear as their node becomes tall enough on
 *    screen to carry one, and each label grows from a name, to a name and a figure, to a name, a
 *    figure and its share of what feeds it. Zoomed out you read the shape; zoomed in you read the
 *    numbers. Text is drawn outside the zoom transform, so it stays at its own size throughout —
 *    magnified type would give more pixels and no more information.
 *  - **clicking a node flies to its branch.** Everything downstream of it is framed, everything
 *    off that path is dimmed, and the trail of clicks is kept in the toolbar so you can walk back
 *    out. A budget's leaves are unreadably thin at full extent; this is how you get to them.
 *  - **hovering says what a ribbon is worth**, including its share of the node it leaves, which is
 *    the question a Sankey is usually being asked.
 *
 *  The layout is this library's own (`internal/sankeyLayout.ts`) rather than `d3-sankey` — see that
 *  file for why. */
export function SankeyChart({
  nodes,
  links,
  height = 420,
  nodeWidth = 12,
  nodePadding = 14,
  align = "justify",
  formatValue,
  zoomable = true,
  scaleExtent = [1, 14],
  fullscreenToggle = true,
  embedded = false,
  margin,
  onNodeClick,
  className,
}: SankeyChartProps) {
  const clipId = useId();
  const { isFullscreen, toggle: toggleFullscreen } = useFullscreen();
  const [ref, dims] = useChartDimensions(margin ?? DEFAULT_MARGIN, { height: isFullscreen ? undefined : height });

  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [hover, setHover] = useState<Hover | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  /** The click trail, outermost first. Empty means the whole diagram. */
  const [trail, setTrail] = useState<string[]>([]);

  const { ref: zoomRef, reset: resetZoom, setTransformAnimated } = useD3Zoom<SVGGElement>({
    width: dims.boundedWidth,
    height: dims.boundedHeight,
    enabled: zoomable,
    scaleExtent,
    onZoom: setTransform,
  });

  const layout = useMemo(
    () =>
      sankeyLayout(nodes, links, {
        width: dims.boundedWidth,
        height: dims.boundedHeight,
        nodeWidth,
        nodePadding,
        align,
      }),
    [nodes, links, dims.boundedWidth, dims.boundedHeight, nodeWidth, nodePadding, align]
  );

  const fmt = useMemo(() => formatValue ?? ((v: number) => v.toLocaleString("fr-FR")), [formatValue]);

  /** One colour per node, cycled by its position *within its column* rather than by the column
   *  itself. Colouring by depth was the first attempt and it loses the diagram's main reading:
   *  every leaf of every envelope came out the same tone, so there was no telling, at a glance,
   *  which of "Logement" or "Investissements" a given ribbon on the right had come out of.
   *  Ribbons take their source's colour, so giving siblings different colours is what makes a
   *  branch followable across the whole width. */
  const colorIndex = useMemo(() => {
    // Counted in the caller's own node order, not in the order the layout ended up stacking them:
    // the stacking order changes with the plot's height, and a node that changes colour when the
    // window is resized is a bug however defensible the rule behind it.
    const index = new Map<string, number>();
    const seen = new Map<number, number>();
    for (const node of layout.nodes) {
      const next = seen.get(node.depth) ?? 0;
      index.set(node.id, next);
      seen.set(node.depth, next + 1);
    }
    return index;
  }, [layout.nodes]);

  const colorOf = useCallback(
    (node: SankeyLaidOutNode) => node.color ?? CHART_PALETTE_RAMP[(colorIndex.get(node.id) ?? 0) % CHART_PALETTE_RAMP.length],
    [colorIndex]
  );

  const focusId = trail.length > 0 ? trail[trail.length - 1] : null;

  /** Which nodes belong to the focused branch — the node itself, everything it feeds, and the path
   *  back to the sources. The trunk is kept because a branch shown without what feeds it reads as a
   *  different, smaller diagram rather than as part of this one. */
  const branch = useMemo(() => {
    if (focusId === null) return null;
    const node = layout.nodes.find((n) => n.id === focusId);
    if (!node) return null;
    const down = downstreamOf(node);
    const up = upstreamOf(node);
    return { node, down, all: new Set([...down, ...up]) };
  }, [focusId, layout.nodes]);

  const inBranch = useCallback((id: string) => branch === null || branch.all.has(id), [branch]);

  /** Frames a set of nodes. `translateExtent` inside `useD3Zoom` already keeps the result on the
   *  diagram, so this only has to compute the box and hand it over. */
  const flyTo = useCallback(
    (ids: Set<string>) => {
      const boxed = layout.nodes.filter((n) => ids.has(n.id));
      if (boxed.length === 0 || dims.boundedWidth <= 0 || dims.boundedHeight <= 0) return;
      const x0 = Math.min(...boxed.map((n) => n.x0));
      const x1 = Math.max(...boxed.map((n) => n.x1));
      const y0 = Math.min(...boxed.map((n) => n.y0));
      const y1 = Math.max(...boxed.map((n) => n.y1));
      const k = Math.max(
        scaleExtent[0],
        Math.min(scaleExtent[1], Math.min(dims.boundedWidth / ((x1 - x0) * FIT_PADDING), dims.boundedHeight / ((y1 - y0) * FIT_PADDING)))
      );
      setTransformAnimated(
        d3.zoomIdentity.translate(dims.boundedWidth / 2 - (k * (x0 + x1)) / 2, dims.boundedHeight / 2 - (k * (y0 + y1)) / 2).scale(k),
        380
      );
    },
    [dims.boundedHeight, dims.boundedWidth, layout.nodes, scaleExtent, setTransformAnimated]
  );

  /** d3-zoom swallows the click that ends a pan, but not one that ends a pan of two pixels — which
   *  is every click made with a real hand on a trackpad. This is the guard that stops a nudge from
   *  being read as "focus this branch". */
  const pressedAt = useRef<{ x: number; y: number } | null>(null);

  const focusNode = useCallback(
    (node: SankeyLaidOutNode) => {
      // Clicking the node already focused steps back out of it, so the same gesture goes both
      // ways and nobody has to find the breadcrumb to undo a click.
      if (focusId === node.id) {
        const next = trail.slice(0, -1);
        setTrail(next);
        if (next.length === 0) resetZoom();
        else {
          const parent = layout.nodes.find((n) => n.id === next[next.length - 1]);
          if (parent) flyTo(downstreamOf(parent));
        }
        return;
      }
      // A click on something outside the current branch starts a new trail rather than appending
      // to one it has nothing to do with.
      setTrail((current) => (inBranch(node.id) ? [...current, node.id] : [node.id]));
      flyTo(downstreamOf(node));
      onNodeClick?.({ id: node.id, label: node.label, color: node.color });
    },
    [flyTo, focusId, inBranch, layout.nodes, onNodeClick, resetZoom, trail]
  );

  const clearFocus = useCallback(() => {
    setTrail([]);
    resetZoom();
  }, [resetZoom]);

  const detail = transform.k >= DETAIL_SHARE_AT ? "share" : transform.k >= DETAIL_VALUE_AT ? "value" : "name";

  const wrapperClass = ["lq-chart", "lq-sankey", isFullscreen && "lq-chart--fullscreen", embedded && "lq-chart--embedded", className]
    .filter(Boolean)
    .join(" ");

  if (dims.width === 0) return <div ref={ref} className={wrapperClass} style={{ height }} />;
  if (layout.links.length === 0) {
    return (
      <div ref={ref} className={wrapperClass} style={{ height }}>
        <div className="lq-chart__empty">Aucune donnée</div>
      </div>
    );
  }

  const isZoomed = transform.k !== 1 || transform.x !== 0 || transform.y !== 0;

  /** A node's label, at whatever level of detail the current zoom has earned. The share is of the
   *  node's own parent — the source of its largest incoming ribbon — which is the reading someone
   *  is actually after ("rent is 92 % of housing"), rather than a share of the diagram's grand
   *  total that would be a rounding error for every leaf. A node with nothing upstream has no
   *  parent to be a share of, and keeps the two-part label. */
  function labelFor(node: SankeyLaidOutNode): string {
    if (detail === "name") return node.label;
    const base = `${node.label} · ${fmt(node.value)}`;
    if (detail !== "share" || node.incoming.length === 0) return base;
    const parent = node.incoming.reduce((biggest, l) => (l.value > biggest.value ? l : biggest)).source;
    if (parent.value <= 0) return base;
    return `${base} · ${Math.round((node.value / parent.value) * 100)} %`;
  }

  const labelled = layout.nodes.filter((node) => {
    if ((node.y1 - node.y0) * transform.k < LABEL_MIN_PX) return false;
    const y = transform.applyY((node.y0 + node.y1) / 2);
    const x = transform.applyX(node.x0);
    // Off-screen labels are not merely invisible, they are a real cost: a budget has hundreds of
    // nodes and, once zoomed in, all but a handful are outside the plot.
    return y > -20 && y < dims.boundedHeight + 20 && x > -220 && x < dims.boundedWidth + 220;
  });

  const trailNodes = trail.map((id) => layout.nodes.find((n) => n.id === id)).filter((n): n is SankeyLaidOutNode => n !== undefined);

  return (
    <div ref={ref} className={wrapperClass}>
      <div className="lq-chart__toolbar lq-sankey__toolbar">
        {trailNodes.length > 0 && (
          <nav className="lq-sankey__trail" aria-label="Fil d'ariane du zoom">
            <button type="button" className="lq-sankey__crumb" onClick={clearFocus}>
              Tout
            </button>
            {trailNodes.map((node, i) => (
              <span key={node.id} className="lq-sankey__crumb-wrap">
                <ChevronRightIcon size={12} className="lq-sankey__crumb-sep" />
                <button
                  type="button"
                  className={["lq-sankey__crumb", i === trailNodes.length - 1 && "lq-sankey__crumb--current"].filter(Boolean).join(" ")}
                  onClick={() => {
                    setTrail(trail.slice(0, i + 1));
                    flyTo(downstreamOf(node));
                  }}
                >
                  {node.label}
                </button>
              </span>
            ))}
          </nav>
        )}
        {zoomable && isZoomed && (
          <button type="button" className="lq-chart__reset-button" onClick={clearFocus}>
            Réinitialiser le zoom
          </button>
        )}
        {fullscreenToggle && (
          <button
            type="button"
            className="lq-chart__icon-button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Quitter le plein écran" : "Plein écran"}
          >
            {isFullscreen ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
          </button>
        )}
      </div>

      <svg
        className="lq-chart__svg"
        width={dims.width}
        height={dims.height}
        role="img"
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          setPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top });
        }}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={dims.boundedWidth} height={dims.boundedHeight} />
          </clipPath>
        </defs>

        <g transform={`translate(${dims.margin.left}, ${dims.margin.top})`}>
          {/* The zoom behaviour attaches to this <g>, not to a same-size overlay rect: pointer
              events bubble through ancestors, never sideways to a sibling, so a wheel over a ribbon
              has to land on something that contains it. The rect below is only there for the grab
              cursor and for double-click-to-reset. Same arrangement as `Heatmap`. */}
          <g ref={zoomRef}>
            <rect
              className="lq-chart__overlay"
              width={dims.boundedWidth}
              height={dims.boundedHeight}
              onDoubleClick={clearFocus}
              onClick={() => {
                if (trail.length > 0) clearFocus();
              }}
            />

            <g clipPath={`url(#${clipId})`}>
              <g transform={transform.toString()}>
                {layout.links.map((link) => {
                  const lit = inBranch(link.source.id) && inBranch(link.target.id);
                  const hovered = hover?.kind === "link" && hover.link.index === link.index;
                  return (
                    <path
                      key={link.index}
                      className={["lq-sankey__ribbon", !lit && "lq-sankey__ribbon--dim", hovered && "lq-sankey__ribbon--hover"]
                        .filter(Boolean)
                        .join(" ")}
                      d={sankeyRibbonPath(link)}
                      fill={link.color ?? colorOf(link.source)}
                      onMouseEnter={() => setHover({ kind: "link", link })}
                      onMouseLeave={() => setHover(null)}
                    />
                  );
                })}

                {layout.nodes.map((node) => {
                  const lit = inBranch(node.id);
                  return (
                    <rect
                      key={node.id}
                      className={[
                        "lq-sankey__node",
                        !lit && "lq-sankey__node--dim",
                        focusId === node.id && "lq-sankey__node--focus",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      x={node.x0}
                      y={node.y0}
                      width={node.x1 - node.x0}
                      height={Math.max(SANKEY_MIN_VISIBLE, node.y1 - node.y0)}
                      fill={colorOf(node)}
                      onMouseEnter={() => setHover({ kind: "node", node })}
                      onMouseLeave={() => setHover(null)}
                      onMouseDown={(event) => {
                        pressedAt.current = { x: event.clientX, y: event.clientY };
                      }}
                      onClick={(event) => {
                        const from = pressedAt.current;
                        pressedAt.current = null;
                        if (from && Math.hypot(event.clientX - from.x, event.clientY - from.y) > 4) return;
                        event.stopPropagation();
                        focusNode(node);
                      }}
                    />
                  );
                })}
              </g>

              {/* Text lives outside the zoom transform on purpose — see this component's own doc.
                  Everything here is positioned by applying the transform to the layout coordinates
                  by hand, which is what keeps the type at one size at every zoom level. */}
              <g className="lq-sankey__labels">
                {detail === "share" &&
                  layout.links
                    .filter((link) => link.width * transform.k >= RIBBON_LABEL_MIN_PX && inBranch(link.source.id) && inBranch(link.target.id))
                    .map((link) => {
                      const x = transform.applyX((link.source.x1 + link.target.x0) / 2);
                      const y = transform.applyY((link.y0 + link.y1) / 2);
                      if (x < -40 || x > dims.boundedWidth + 40 || y < -10 || y > dims.boundedHeight + 10) return null;
                      return (
                        <text key={link.index} className="lq-sankey__ribbon-label" x={x} y={y} textAnchor="middle" dominantBaseline="middle">
                          {fmt(link.value)}
                        </text>
                      );
                    })}

                {labelled.map((node) => {
                  // Outward, away from the middle of what is currently on screen — so labels never
                  // sit on top of the ribbons they belong to. Measured on the *screen* position
                  // rather than the layout one: once zoomed into a branch on the far right, those
                  // nodes are in the middle of the view and should read rightward again.
                  const onLeftHalf = transform.applyX((node.x0 + node.x1) / 2) < dims.boundedWidth / 2;
                  const x = onLeftHalf ? transform.applyX(node.x1) + 7 : transform.applyX(node.x0) - 7;
                  return (
                    <text
                      key={node.id}
                      className={["lq-sankey__label", !inBranch(node.id) && "lq-sankey__label--dim"].filter(Boolean).join(" ")}
                      x={x}
                      y={transform.applyY((node.y0 + node.y1) / 2)}
                      textAnchor={onLeftHalf ? "start" : "end"}
                      dominantBaseline="middle"
                    >
                      {labelFor(node)}
                    </text>
                  );
                })}
              </g>
            </g>
          </g>
        </g>
      </svg>

      <ChartTooltip x={pointer.x} y={pointer.y} visible={hover !== null} align={pointer.x > dims.width * 0.6 ? "left" : "right"}>
        {hover?.kind === "node" && (
          <>
            <div className="lq-chart-tooltip__title">{hover.node.label}</div>
            <div className="lq-chart-tooltip__row">
              <span>Total</span>
              <strong>{fmt(hover.node.value)}</strong>
            </div>
            {hover.node.incoming.length > 0 && (
              <div className="lq-chart-tooltip__row">
                <span>Entrées</span>
                <strong>{hover.node.incoming.length}</strong>
              </div>
            )}
            {hover.node.outgoing.length > 0 && (
              <div className="lq-chart-tooltip__row">
                <span>Sorties</span>
                <strong>{hover.node.outgoing.length}</strong>
              </div>
            )}
            {zoomable && <div className="lq-sankey__tooltip-hint">Cliquer pour zoomer sur cette branche</div>}
          </>
        )}
        {hover?.kind === "link" && (
          <>
            <div className="lq-chart-tooltip__title">
              {hover.link.source.label} → {hover.link.target.label}
            </div>
            <div className="lq-chart-tooltip__row">
              <span>Montant</span>
              <strong>{fmt(hover.link.value)}</strong>
            </div>
            {hover.link.source.value > 0 && (
              <div className="lq-chart-tooltip__row">
                <span>Part de {hover.link.source.label}</span>
                <strong>{Math.round((hover.link.value / hover.link.source.value) * 100)} %</strong>
              </div>
            )}
          </>
        )}
      </ChartTooltip>
    </div>
  );
}
