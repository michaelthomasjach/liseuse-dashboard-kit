import type * as d3 from "d3";
import type { AxisAnnotations, AxisLabel } from "../axisAnnotations";
import { axisLabelBand, resolveAxisLabelCollisions } from "../axisAnnotations";
import { formatCompactNumber } from "../formatting";

/** Height of one axis badge, in px — font-size .7rem plus its own padding (see
 *  `.lq-chart__axis-value` in charts-shared.css). Used as the value axis' collision extent. */
const AXIS_LABEL_HEIGHT = 17;

/** Rough px per character at the badge's own .7rem tabular-nums font, plus its horizontal
 *  padding. An estimate rather than a measurement on purpose: this decides only *which* date
 *  labels survive a crowded axis, so being a pixel or two out changes nothing a user could see,
 *  and measuring every label on every pan would cost a layout pass per frame to earn it. */
function estimatedLabelWidth(text: string): number {
  return text.length * 6.2 + 14;
}

export interface ChartAxisAnnotationsProps {
  /** What the current selection wants shown, or null when nothing is selected. */
  annotations: AxisAnnotations | null;
  dims: { margin: { top: number; left: number; right: number; bottom: number }; boundedWidth: number };
  plotBoundedHeight: number;
  zoomedXScale: d3.ScaleLinear<number, number>;
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: d3.ScaleLinear<number, number>; offset: number };
  priceAxisFmt: (value: number) => string;
  vFmt: (value: number) => string;
  dFmt: (date: Date) => string;
  dateForIndex: (index: number) => Date;
}

/** The axis labels belonging to whichever drawing or indicator is currently selected: its prices
 *  on the value axis, its start and end dates on the date axis, and a shaded band in each gutter
 *  spanning the two extremes.
 *
 *  Nothing renders unless something is selected — the whole point is that these appear on demand
 *  rather than permanently, so a chart carrying a dozen indicators is not also carrying a dozen
 *  numbers up its axis.
 *
 *  Plain DOM in the axis gutters, like every other badge in ChartHoverBadges, so the labels sit
 *  in the same stacking context as the hover badge and can be layered against it deliberately —
 *  the hover badge wins, since it answers what the user is pointing at *now*. */
export function ChartAxisAnnotations({
  annotations,
  dims,
  plotBoundedHeight,
  zoomedXScale,
  paneScaleAndOffset,
  priceAxisFmt,
  vFmt,
  dFmt,
  dateForIndex,
}: ChartAxisAnnotationsProps) {
  if (annotations === null || (annotations.y.length === 0 && annotations.x.length === 0)) return null;

  const { scale, offset } = paneScaleAndOffset(annotations.valueAxis);
  // The pane's own vertical bounds, read straight off its scale's range rather than passed in —
  // a label outside them belongs to a value that has been scrolled or zoomed off this pane, and
  // is hidden rather than clamped for the same reason the last-close badge is: on an axis, a
  // badge is read as a height first, so a clamped one keeps its number while its position lies.
  const [rangeA, rangeB] = scale.range();
  const paneTop = Math.min(rangeA, rangeB);
  const paneBottom = Math.max(rangeA, rangeB);

  const valueText = (l: AxisLabel): string => {
    if (l.text !== undefined) return l.text;
    const v =
      annotations.valueAxis === "price" ? priceAxisFmt(l.at) : annotations.valueAxis === "volume" ? vFmt(l.at) : formatCompactNumber(l.at);
    return l.label ? `${l.label} ${v}` : v;
  };
  const dateText = (l: AxisLabel): string => {
    const d = dFmt(dateForIndex(l.at));
    return l.label ? `${l.label} ${d}` : d;
  };

  const yPos = annotations.y.map((l) => scale(l.at));
  const yInPane = yPos.map((y) => Number.isFinite(y) && y >= paneTop && y <= paneBottom);
  // Only labels actually on the pane compete for space — an off-pane one is already hidden, and
  // letting it win a collision would silently suppress a visible neighbour in favour of nothing.
  const yVisible = resolveAxisLabelCollisions(
    annotations.y,
    yPos.map((y, i) => (yInPane[i] ? y : NaN)),
    annotations.y.map(() => AXIS_LABEL_HEIGHT),
  );

  const xPos = annotations.x.map((l) => zoomedXScale(l.at + 0.5));
  const xTexts = annotations.x.map(dateText);
  const xInPlot = xPos.map((x) => Number.isFinite(x) && x >= 0 && x <= dims.boundedWidth);
  const xVisible = resolveAxisLabelCollisions(
    annotations.x,
    xPos.map((x, i) => (xInPlot[i] ? x : NaN)),
    xTexts.map(estimatedLabelWidth),
  );

  // Bands come from every label the selection has, including ones a collision or the pane's own
  // edge just hid: the band describes the selection's real extent, and letting it shrink because
  // a label happened to be dropped would make the shading lie about the shape it brackets.
  const yBand = axisLabelBand(annotations.y);
  const xBand = axisLabelBand(annotations.x);
  const yBandPx = yBand === null ? null : [scale(yBand.from), scale(yBand.to)].sort((a, b) => a - b);
  const xBandPx = xBand === null ? null : [zoomedXScale(xBand.from + 0.5), zoomedXScale(xBand.to + 0.5)].sort((a, b) => a - b);

  return (
    <>
      {yBandPx !== null && (
        <div
          className="lq-chart__axis-band lq-chart__axis-band--y"
          style={{
            top: dims.margin.top + offset + Math.max(paneTop, yBandPx[0]),
            height: Math.max(0, Math.min(paneBottom, yBandPx[1]) - Math.max(paneTop, yBandPx[0])),
            left: dims.margin.left + dims.boundedWidth,
            width: dims.margin.right,
            backgroundColor: annotations.color,
          }}
        />
      )}
      {xBandPx !== null && (
        <div
          className="lq-chart__axis-band lq-chart__axis-band--x"
          style={{
            left: dims.margin.left + Math.max(0, xBandPx[0]),
            width: Math.max(0, Math.min(dims.boundedWidth, xBandPx[1]) - Math.max(0, xBandPx[0])),
            top: dims.margin.top + plotBoundedHeight,
            height: dims.margin.bottom,
            backgroundColor: annotations.color,
          }}
        />
      )}
      {annotations.y.map((l, i) =>
        !yVisible[i] ? null : (
          <div
            key={l.key}
            className="lq-chart__axis-value lq-chart__axis-value--y lq-chart__axis-value--annotation"
            style={{
              top: dims.margin.top + offset + yPos[i],
              left: dims.margin.left + dims.boundedWidth,
              minWidth: dims.margin.right,
              backgroundColor: annotations.color,
            }}
          >
            <span className="lq-chart__axis-value-text">{valueText(l)}</span>
          </div>
        ),
      )}
      {annotations.x.map((l, i) =>
        !xVisible[i] ? null : (
          <div
            key={l.key}
            className="lq-chart__axis-value lq-chart__axis-value--x lq-chart__axis-value--annotation"
            style={{ left: dims.margin.left + xPos[i], top: dims.margin.top + plotBoundedHeight, backgroundColor: annotations.color }}
          >
            <span className="lq-chart__axis-value-text">{xTexts[i]}</span>
          </div>
        ),
      )}
    </>
  );
}
