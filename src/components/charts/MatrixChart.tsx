import { useCallback, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import * as d3 from "d3";
import { useD3Zoom } from "./internal/useD3Zoom";
import { observeElementSize } from "../../internal/observeElementSize";
import { labelColorOn } from "./internal/labelContrast";
import "./charts-shared.css";
import "./MatrixChart.css";

/** One axis entry — the same shape for rows and columns, since a matrix is square more often than
 *  not and a caller listing the same symbols twice should not have to describe them twice. */
export interface MatrixAxisEntry {
  id: string;
  label: string;
}

/** One line of the detail shown when a cell is clicked. Plain label/value pairs rather than free
 *  markup: what a cell means is the caller's business, but a matrix that let each one render
 *  anything would have no layout of its own left to guarantee. */
export interface MatrixCellDetail {
  label: string;
  value: ReactNode;
}

export interface MatrixCell {
  row: string;
  column: string;
  /** What colours the cell, read against `domain`. `null` draws an empty cell — the diagonal of a
   *  correlation matrix, or a pair with no data — rather than a zero, which would claim the two
   *  are uncorrelated when the truth is that nothing was measured. */
  value: number | null;
  /** Second line inside the cell, under the value: a sample count, a p-value, a period. */
  note?: string;
  /** Used instead of the computed colour when `colorMode` is `"manual"`. */
  color?: string;
  /** Shown in the detail panel once the cell is clicked. */
  details?: MatrixCellDetail[];
}

export interface MatrixChartProps {
  rows: MatrixAxisEntry[];
  columns: MatrixAxisEntry[];
  cells: MatrixCell[];
  /** The values mapped to a full negative and a full positive tint. Default `[-1, 1]`, which is
   *  what a correlation runs between. */
  domain?: [number, number];
  /** `"auto"` ramps the two colours below by opacity (see this component's own doc); `"manual"`
   *  uses each cell's own `color` and leaves the ramp entirely to the caller. */
  colorMode?: "auto" | "manual";
  positiveColor?: string;
  negativeColor?: string;
  /** Prints the value inside each cell. */
  showValues?: boolean;
  formatValue?: (value: number) => string;
  /** Wheel to zoom, drag to pan, double-click to reset. Off leaves the matrix fixed — the right
   *  choice when it already fits, since a grid that moves under an accidental scroll is worse
   *  than one that cannot move at all. */
  zoomable?: boolean;
  height?: number;
  /** Replaces the built-in detail panel. */
  renderDetail?: (cell: MatrixCell, row: MatrixAxisEntry, column: MatrixAxisEntry) => ReactNode;
  onCellClick?: (cell: MatrixCell) => void;
  className?: string;
}

const ROW_LABEL_WIDTH = 78;
const COLUMN_HEADER_HEIGHT = 28;
/** Joins a row id and a column id into one Map key. A NUL can't occur in an id that came from
 *  JSON or from a template literal, which a dash or a colon easily could — and two different
 *  pairs colliding on one key would silently hand a cell the wrong neighbour's value. Written
 *  as an escape, never as the byte itself: a literal NUL in the file makes git call the whole
 *  source binary and stop producing diffs for it. */
const KEY_SEPARATOR = "\u0000";

const MIN_CELL = 34;

/** Opacity from a value, as a share of its own side of the domain.
 *
 *  This is the whole of the `"auto"` ramp: the hue says the sign and nothing else, the opacity says
 *  the magnitude. 0 on either side is fully transparent, which is the honest rendering of "no
 *  relationship" — a neutral cell should read as the absence of colour rather than as a third
 *  colour a reader has to learn. */
function intensity(value: number, domain: [number, number]): number {
  const [min, max] = domain;
  if (value > 0) return max <= 0 ? 0 : Math.min(1, value / max);
  if (value < 0) return min >= 0 ? 0 : Math.min(1, value / min);
  return 0;
}

/** The three colours a cell can be painted from, resolved to real RGB.
 *
 *  They cannot be read from the markup. Two of them are props whose defaults are design tokens, and
 *  `d3.color("var(--lq-color-up)")` returns null — measured, and the reason the ramp came out flat
 *  the first time this chart was written. So the browser is asked instead: three hidden spans carry
 *  the values, and `getComputedStyle` hands back what they resolve to on this element, under
 *  whatever palette is currently on `.lq-root`.
 *
 *  Re-read when that palette or surface changes, the same way the heatmap watches for it: a theme
 *  switch repaints every cell without unmounting anything. */
function useResolvedPalette(
  el: HTMLElement | null,
  probes: { positive: HTMLElement | null; negative: HTMLElement | null; background: HTMLElement | null },
): { positive: d3.RGBColor | null; negative: d3.RGBColor | null; background: d3.RGBColor | null } {
  const [resolved, setResolved] = useState<{ positive: d3.RGBColor | null; negative: d3.RGBColor | null; background: d3.RGBColor | null }>({
    positive: null,
    negative: null,
    background: null,
  });
  const { positive, negative, background } = probes;

  useLayoutEffect(() => {
    if (el === null || positive === null || negative === null || background === null) return;
    function read() {
      const of = (node: HTMLElement | null) => (node === null ? null : d3.rgb(getComputedStyle(node).color));
      const next = { positive: of(positive), negative: of(negative), background: of(background) };
      setResolved((prev) => {
        const same = (a: d3.RGBColor | null, b: d3.RGBColor | null) => (a === null || b === null ? a === b : a.formatHex() === b.formatHex());
        return same(prev.positive, next.positive) && same(prev.negative, next.negative) && same(prev.background, next.background) ? prev : next;
      });
    }
    read();
    const root = el.closest(".lq-root");
    if (root === null) return;
    const observer = new MutationObserver(read);
    observer.observe(root, { attributes: true, attributeFilter: ["data-lq-palette", "data-lq-surface"] });
    return () => observer.disconnect();
  }, [el, positive, negative, background]);

  return resolved;
}

/** A matrix of scored cells — a correlation grid being the case it was built for, though nothing
 *  here assumes correlation beyond the default `[-1, 1]` domain.
 *
 *  Colour carries two separate facts and keeps them separate: the hue is the sign, the opacity is
 *  the magnitude. A cell at +1 is the positive colour at full strength, a cell at 0 is transparent,
 *  a cell at -1 is the negative colour at full strength. That is what makes the grid readable
 *  without a legend: the eye reads "how much" from how loud a cell is and "which way" from which
 *  colour it is, instead of having to place a shade along a continuous two-hue ramp.
 *
 *  Clicking a cell opens its detail underneath rather than in a tooltip. What a cell means usually
 *  takes several lines, and a tooltip that has to be kept hovered is the wrong container for
 *  anything somebody wants to sit and read. */
export function MatrixChart({
  rows,
  columns,
  cells,
  domain = [-1, 1],
  colorMode = "auto",
  positiveColor = "var(--lq-color-up)",
  negativeColor = "var(--lq-color-down)",
  showValues = true,
  formatValue = (v) => v.toFixed(2),
  zoomable = true,
  height = 360,
  renderDetail,
  onCellClick,
  className,
}: MatrixChartProps) {
  // Per-instance, like every other chart here: an `id` is document-wide, and `url(#…)` resolves to
  // whichever element carries it *first* in the document. Three fixed ids meant five matrices on
  // one page all clipping to the first one's rectangle — measured on the Docs page, which stacks
  // every story of this file. Nothing looked wrong there only because the largest happens to render
  // first; put a small matrix above a large one and the large one loses its outer cells.
  const clipBase = useId();
  const columnsClip = clipBase + "-columns";
  const rowsClip = clipBase + "-rows";
  const gridClip = clipBase + "-grid";

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  // State rather than refs: the resolver has to re-run once the nodes attach, and a ref assignment
  // never re-renders. Same reasoning as the heatmap's own `wrapperEl`.
  const [wrapperEl, setWrapperEl] = useState<HTMLDivElement | null>(null);
  const [positiveProbe, setPositiveProbe] = useState<HTMLSpanElement | null>(null);
  const [negativeProbe, setNegativeProbe] = useState<HTMLSpanElement | null>(null);
  const [backgroundProbe, setBackgroundProbe] = useState<HTMLSpanElement | null>(null);
  const palette = useResolvedPalette(wrapperEl, { positive: positiveProbe, negative: negativeProbe, background: backgroundProbe });
  const [width, setWidth] = useState(0);
  const [transform, setTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const [selected, setSelected] = useState<{ row: string; column: string } | null>(null);

  const attachWrapper = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setWrapperEl(node);
    if (node === null) return;
    setWidth(node.clientWidth);
    observeElementSize(node, (entry) => setWidth(Math.round(entry.contentRect.width)));
  }, []);

  // Indexed once rather than searched per cell: a 12x12 grid is 144 lookups a render, and the
  // caller hands the cells in as a flat list precisely so it does not have to build the grid.
  const byKey = useMemo(() => {
    const map = new Map<string, MatrixCell>();
    for (const cell of cells) map.set(cell.row + KEY_SEPARATOR + cell.column, cell);
    return map;
  }, [cells]);

  const gridWidth = Math.max(0, width - ROW_LABEL_WIDTH);
  const gridHeight = Math.max(0, height - COLUMN_HEADER_HEIGHT);
  const cellWidth = columns.length > 0 ? Math.max(MIN_CELL, gridWidth / columns.length) : 0;
  const cellHeight = rows.length > 0 ? Math.max(MIN_CELL, gridHeight / rows.length) : 0;

  const { ref: zoomRef, reset: resetZoom } = useD3Zoom<SVGGElement>({
    width: gridWidth,
    height: gridHeight,
    scaleExtent: [1, 8],
    enabled: zoomable,
    onZoom: setTransform,
  });

  const at = (rowId: string, columnId: string) => byKey.get(rowId + KEY_SEPARATOR + columnId);
  const selectedCell = selected === null ? undefined : at(selected.row, selected.column);
  const selectedRow = selected === null ? null : rows.find((r) => r.id === selected.row) ?? null;
  const selectedColumn = selected === null ? null : columns.find((c) => c.id === selected.column) ?? null;

  /* The hue and the strength are set as two separate SVG attributes rather than baked into one
     colour string. Baking needs the colour parsed, and the defaults here are design tokens:
     `d3.color("var(--lq-color-up)")` returns null — measured — so every cell came out the same
     flat colour with no ramp at all. `fill-opacity` needs nothing parsed and works with any CSS
     colour the caller cares to pass, token or not. */
  function cellFill(cell: MatrixCell | undefined): { fill: string; opacity: number } {
    if (cell === undefined || cell.value === null) return { fill: "transparent", opacity: 0 };
    if (colorMode === "manual") return { fill: cell.color ?? "transparent", opacity: 1 };
    return {
      fill: cell.value >= 0 ? positiveColor : negativeColor,
      opacity: intensity(cell.value, domain),
    };
  }

  /** The label colour for one cell, decided against the colour that cell is actually painted.
   *
   *  A cell is a hue at a fill-opacity over the chart's own background, so what the text sits on is
   *  the composite of the two — not the hue, and not the background. Recomposing it here is the only
   *  way to know: a strong positive is `--lq-color-up` at 0.9, which the E-ink palette resolves to
   *  near-black, and the value printed on it was `--lq-color-text`, near-black as well. Measured at
   *  1.63:1 on the worst cell, with fourteen of forty-two under the 4.5:1 AA threshold.
   *
   *  Applied as an inline style, never as a `fill` attribute: in SVG a CSS declaration beats a
   *  presentation attribute, and `.lq-matrix-chart__value` already declares one. The attribute was
   *  the first attempt and it computed correctly — measured at `#ffffff` on a near-black cell — and
   *  painted near-black anyway, because the stylesheet outranked it.
   *
   *  Returns undefined when a colour cannot be resolved, leaving the stylesheet's own
   *  `--lq-color-text` in place rather than guessing. */
  function labelFill(cell: MatrixCell | undefined, paint: { fill: string; opacity: number }): string | undefined {
    if (cell === undefined || cell.value === null || palette.background === null) return undefined;
    const hue = colorMode === "manual" ? (d3.color(paint.fill)?.rgb() ?? null) : cell.value >= 0 ? palette.positive : palette.negative;
    if (hue === null) return undefined;
    return labelColorOn(d3.rgb(d3.interpolateRgb(palette.background, hue)(paint.opacity)));
  }

  function pick(cell: MatrixCell | undefined, rowId: string, columnId: string) {
    if (cell === undefined || cell.value === null) return;
    setSelected({ row: rowId, column: columnId });
    onCellClick?.(cell);
  }

  return (
    <div className={["lq-matrix-chart", className].filter(Boolean).join(" ")} ref={attachWrapper}>
      {/* Not rendered, only resolved: `color` accepts any CSS colour the caller passes — a token, a
          hex, a named colour — and the browser hands back what it comes to on this element. */}
      <span ref={setPositiveProbe} aria-hidden="true" style={{ display: "none", color: positiveColor }} />
      <span ref={setNegativeProbe} aria-hidden="true" style={{ display: "none", color: negativeColor }} />
      <span ref={setBackgroundProbe} aria-hidden="true" style={{ display: "none", color: "var(--lq-color-bg)" }} />
      <svg width={width} height={height} className="lq-matrix-chart__svg" role="img">
        <defs>
          <clipPath id={columnsClip}>
            <rect x={0} y={0} width={gridWidth} height={COLUMN_HEADER_HEIGHT} />
          </clipPath>
          <clipPath id={rowsClip}>
            <rect x={0} y={0} width={ROW_LABEL_WIDTH} height={gridHeight} />
          </clipPath>
          <clipPath id={gridClip}>
            <rect x={0} y={0} width={gridWidth} height={gridHeight} />
          </clipPath>
        </defs>

        {/* The headers stay outside the zoomed group and are only translated along it. They are the
            grid's own frame of reference, and a label that scrolls away from the cells it names is
            worse than one that stays legible while the cells move under it. */}
        <g transform={"translate(" + ROW_LABEL_WIDTH + ", 0)"} clipPath={"url(#" + columnsClip + ")"}>
          {columns.map((column, i) => (
            <text
              key={column.id}
              className="lq-matrix-chart__axis-label"
              x={transform.applyX(i * cellWidth + cellWidth / 2)}
              y={COLUMN_HEADER_HEIGHT - 9}
              textAnchor="middle"
            >
              {column.label}
            </text>
          ))}
        </g>

        <g transform={"translate(0, " + COLUMN_HEADER_HEIGHT + ")"} clipPath={"url(#" + rowsClip + ")"}>
          {rows.map((row, i) => (
            <text
              key={row.id}
              className="lq-matrix-chart__axis-label"
              x={ROW_LABEL_WIDTH - 10}
              y={transform.applyY(i * cellHeight + cellHeight / 2) + 4}
              textAnchor="end"
            >
              {row.label}
            </text>
          ))}
        </g>

        <g transform={"translate(" + ROW_LABEL_WIDTH + ", " + COLUMN_HEADER_HEIGHT + ")"}>
          <g clipPath={"url(#" + gridClip + ")"} ref={zoomRef} onDoubleClick={resetZoom}>
            {/* A target for the wheel where no cell is painted. A `<g>` only receives events where
                its children draw, and d3-zoom listens on the element itself — so without this the
                gesture died in the gaps. Left click-through-able by having no handler of its own,
                rather than by `pointer-events: none`, which would have taken the wheel with it:
                that was the first attempt, and it stopped the zoom dead. */}
            <rect width={gridWidth} height={gridHeight} fill="transparent" />
            <g transform={transform.toString()}>
              {rows.map((row, r) =>
                columns.map((column, c) => {
                  const cell = at(row.id, column.id);
                  const empty = cell === undefined || cell.value === null;
                  const paint = cellFill(cell);
                  const isSelected = selected !== null && selected.row === row.id && selected.column === column.id;
                  const cx = c * cellWidth + cellWidth / 2;
                  const cy = r * cellHeight + cellHeight / 2;
                  return (
                    <g
                      key={row.id + "-" + column.id}
                      className={[
                        "lq-matrix-chart__cell",
                        empty && "lq-matrix-chart__cell--empty",
                        isSelected && "lq-matrix-chart__cell--selected",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onClick={() => pick(cell, row.id, column.id)}
                    >
                      <rect
                        x={c * cellWidth}
                        y={r * cellHeight}
                        width={cellWidth}
                        height={cellHeight}
                        fill={paint.fill}
                        fillOpacity={paint.opacity}
                      />
                      {empty && (
                        <text className="lq-matrix-chart__empty-mark" x={cx} y={cy + 4} textAnchor="middle">
                          &#8211;
                        </text>
                      )}
                      {!empty && showValues && (
                        <text
                          className="lq-matrix-chart__value"
                          style={{ fill: labelFill(cell, paint) }}
                          x={cx}
                          y={cy + (cell.note ? -1 : 4)}
                          textAnchor="middle"
                        >
                          {formatValue(cell.value as number)}
                        </text>
                      )}
                      {!empty && showValues && cell.note && (
                        <text
                          className="lq-matrix-chart__note"
                          style={{ fill: labelFill(cell, paint), fillOpacity: 0.75 }}
                          x={cx}
                          y={cy + 12}
                          textAnchor="middle"
                        >
                          {cell.note}
                        </text>
                      )}
                    </g>
                  );
                }),
              )}
            </g>
          </g>
        </g>
      </svg>

      {selectedCell !== undefined && selectedRow !== null && selectedColumn !== null && (
        <div className="lq-matrix-chart__detail">
          {renderDetail ? (
            renderDetail(selectedCell, selectedRow, selectedColumn)
          ) : (
            <>
              <div className="lq-matrix-chart__detail-head">
                <span className="lq-matrix-chart__detail-title">
                  {selectedRow.label} &#215; {selectedColumn.label}
                </span>
                <button
                  type="button"
                  className="lq-matrix-chart__detail-close"
                  onClick={() => setSelected(null)}
                  aria-label="Fermer le détail"
                >
                  &#215;
                </button>
              </div>
              <dl className="lq-matrix-chart__detail-list">
                <div className="lq-matrix-chart__detail-row">
                  <dt>Valeur</dt>
                  <dd>{selectedCell.value === null ? "–" : formatValue(selectedCell.value)}</dd>
                </div>
                {(selectedCell.details ?? []).map((detail) => (
                  <div className="lq-matrix-chart__detail-row" key={detail.label}>
                    <dt>{detail.label}</dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </div>
      )}
    </div>
  );
}
