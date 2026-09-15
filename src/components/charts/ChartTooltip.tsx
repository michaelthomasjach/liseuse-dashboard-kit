import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./ChartTooltip.css";

export interface ChartTooltipProps {
  x: number;
  y: number;
  visible: boolean;
  children: ReactNode;
  /** Which side of `x` the box prefers. It is a preference, not a position: a box that would leave
   *  the plot is pulled back inside whichever side it was asked for. Default "right". */
  align?: "left" | "right";
}

/** How far the box sits from the point it describes, and how close it may come to the plot's own
 *  edge once it has been pulled back inside. */
const GAP_RIGHT = 12;
const GAP_LEFT = 16;
const EDGE_PADDING = 4;

/** Floating box positioned in pixel-space over a chart's plot area (absolute, parent must be
 *  `position: relative`).
 *
 *  Its horizontal placement is computed here rather than left to a CSS margin, because it has to
 *  know two things CSS cannot tell it: how wide the box came out, and how wide the plot is. The
 *  rule it replaces was "flip to the left past 65% of the width", which never measured either — so
 *  a box wider than the space its own flip left it ran straight off the left edge and took its
 *  text with it. Measured on a 300px gallery tile: 96px of a 160px box outside the plot.
 *
 *  `useLayoutEffect`, so the correction lands before the browser paints and the box never appears
 *  in the wrong place first. */
export function ChartTooltip({ x, y, visible, children, align = "right" }: ChartTooltipProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [left, setLeft] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    const host = el?.offsetParent as HTMLElement | null;
    if (el == null || host == null) return;
    const width = el.offsetWidth;
    // Where the preferred side would put it, then pulled inside the plot. Derived from `x` and the
    // two widths alone — never from where the box currently sits — so it cannot chase its own
    // correction from one render to the next.
    const preferred = align === "left" ? x - width - GAP_LEFT : x + GAP_RIGHT;
    const highest = Math.max(EDGE_PADDING, host.clientWidth - width - EDGE_PADDING);
    const next = Math.min(Math.max(EDGE_PADDING, preferred), highest);
    setLeft((current) => (current !== null && Math.abs(current - next) < 0.5 ? current : next));
    // Deliberately every render, with no dependency list. The box's own width changes with its
    // *content*, which can change while `x` does not — hovering a different series on the same
    // category — and the plot's width changes on resize; a list of ([align, x]) would miss both.
    // It cannot loop: `next` is derived from `x` and the two widths, never from `left`, so a second
    // pass computes the same number and the guard above makes React bail out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  });

  if (!visible) return null;
  return (
    <div
      ref={ref}
      className="lq-chart-tooltip"
      // Until the first measurement, the preferred side with no clamp — one frame at most, and
      // `useLayoutEffect` replaces it before anything is painted.
      style={{ transform: `translate(${left ?? (align === "left" ? x - GAP_LEFT : x + GAP_RIGHT)}px, ${y}px)` }}
    >
      {children}
    </div>
  );
}
