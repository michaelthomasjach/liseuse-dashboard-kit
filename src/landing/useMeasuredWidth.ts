import { useCallback, useEffect, useRef, useState } from "react";
import { observeElementSize } from "../internal/observeElementSize";

/** The current inner width of an element, in CSS pixels, kept up to date as it resizes.
 *
 *  `Heatmap` and `WorldExposureMap` both take a numeric `width` and neither measures anything on
 *  its own (`width = 900` and `width = 480` are their defaults). Dropped into a responsive grid
 *  they therefore either spill out of their cell or sit marooned in the middle of it, which is
 *  what happened here: the heatmap drew 900px of tiles inside a 546px frame. This hands them the
 *  width their container actually has.
 *
 *  Returns `[ref, width]`, with `width` at 0 until the first measurement lands — render nothing
 *  that depends on it until then, since a chart built for a 0-wide box is worse than no chart. */
export function useMeasuredWidth(): [(node: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(0);
  const cleanup = useRef<(() => void) | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    cleanup.current?.();
    cleanup.current = null;
    if (node === null) return;
    setWidth(node.clientWidth);
    cleanup.current = observeElementSize(node, (entry) => {
      const box = entry.contentBoxSize?.[0];
      setWidth(Math.round(box ? box.inlineSize : entry.contentRect.width));
    });
  }, []);

  useEffect(() => () => cleanup.current?.(), []);

  return [ref, width];
}
