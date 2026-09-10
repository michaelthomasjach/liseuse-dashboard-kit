import { useId, useMemo } from "react";
import * as d3 from "d3";
import "./Sparkline.css";

export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  /** Fills the area under the line. */
  area?: boolean;
  /** Colors the line using the up/down theme tokens based on the first/last value delta. */
  colorByTrend?: boolean;
  strokeWidth?: number;
  className?: string;
}

/** Minimal, axis-free trend line — for table cells, KPI cards, watchlists. */
export function Sparkline({
  data,
  width = 96,
  height = 28,
  color,
  area = false,
  colorByTrend = false,
  strokeWidth = 1.5,
  className,
}: SparklineProps) {
  const clipId = useId();

  const path = useMemo(() => {
    if (data.length < 2) return { line: "", area: "" };
    const x = d3.scaleLinear().domain([0, data.length - 1]).range([1, width - 1]);
    const [min, max] = d3.extent(data) as [number, number];
    const y = d3.scaleLinear().domain([min, max]).range([height - 2, 2]);
    const lineGen = d3.line<number>().x((_, i) => x(i)).y((d) => y(d)).curve(d3.curveMonotoneX);
    const areaGen = d3
      .area<number>()
      .x((_, i) => x(i))
      .y0(height)
      .y1((d) => y(d))
      .curve(d3.curveMonotoneX);
    return { line: lineGen(data) ?? "", area: areaGen(data) ?? "" };
  }, [data, width, height]);

  if (data.length < 2) return <svg width={width} height={height} className={className} />;

  const resolvedColor = color ?? (colorByTrend ? (data[data.length - 1] >= data[0] ? "var(--lq-color-up)" : "var(--lq-color-down)") : "var(--lq-color-accent)");

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      /* Stretch to whatever box CSS gives this element instead of shrinking to fit inside it.
         `width`/`height` are the drawing's own coordinate space; several callers then size the
         element from CSS (StatCard and HighlightStatCard both set `width: 100%` on it). Under the
         default "xMidYMid meet" the drawing kept its 120x32 intrinsic size and sat *centred* in a
         wider card, with dead space either side — the "the curve does not use the full width of
         the card" report. With "none" the two axes scale independently, and `vector-effect` below
         keeps the stroke a constant 1.5px through that stretch instead of thinning with it.
         Where nothing overrides the size, both axes scale by 1 and this changes nothing. */
      preserveAspectRatio="none"
      className={["lq-sparkline", className].filter(Boolean).join(" ")}
      role="img"
    >
      {area && (
        <>
          <clipPath id={clipId}>
            <path d={path.area} />
          </clipPath>
          <rect width={width} height={height} fill={resolvedColor} opacity={0.12} clipPath={`url(#${clipId})`} />
        </>
      )}
      <path d={path.line} fill="none" stroke={resolvedColor} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
