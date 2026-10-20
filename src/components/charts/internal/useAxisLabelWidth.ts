import { useEffect, useRef, useState, type RefObject } from "react";

/**
 * Width actually taken by an axis's tick labels, measured once d3 has drawn them (ChartAxis draws in
 * its own `useEffect`, which runs before this parent effect). Used to size a chart's left margin to
 * exactly its Y labels — no fixed reserve leaving an empty band between the chart's left edge and
 * its values. Returns `null` until measured (and in environments without SVG layout, e.g. jsdom);
 * callers then fall back to their own default margin.
 *
 * Wrap the axis in a `<g ref={ref}>`: only its `<text>` labels are measured (not the grid lines,
 * which extend across the whole plot).
 */
export function useAxisLabelWidth(gap = 8): [RefObject<SVGGElement>, number | null] {
  const ref = useRef<SVGGElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  // No dependency array on purpose: labels change with data, formatting, zoom — re-measured after
  // every render, state only updated when the width really changes (no render loop).
  useEffect(() => {
    const g = ref.current;
    if (!g) return;
    let max = 0;
    g.querySelectorAll("text").forEach((t) => {
      try {
        max = Math.max(max, (t as SVGTextElement).getBBox().width);
      } catch {
        // getBBox unavailable (no layout): keep the default margin.
      }
    });
    if (max <= 0) return;
    const next = Math.ceil(max) + gap;
    setWidth((prev) => (prev !== null && Math.abs(prev - next) <= 1 ? prev : next));
  });
  return [ref, width];
}
