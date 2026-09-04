import { useEffect, useState } from "react";

/** The window's own inner width, kept current across resizes. `0` before the first client render
 *  (and under SSR), which every consumer treats as "not measured yet" rather than "narrow" — the
 *  same convention `useChartDimensions` already uses for a wrapper that hasn't been laid out.
 *
 *  Exists because the touch layout is a decision about the *screen*, not about the box a chart
 *  happens to occupy (see MOBILE_LAYOUT_BREAKPOINT's own doc): the same phone gets the same layout
 *  whether the chart fills it or shares it with a panel. A wrapper measurement can't answer that. */
export function useViewportWidth(): number {
  const [width, setWidth] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth));
  useEffect(() => {
    const onResize = () => setWidth(window.innerWidth);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return width;
}
