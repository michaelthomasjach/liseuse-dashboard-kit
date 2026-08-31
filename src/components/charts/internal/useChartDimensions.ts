import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

export interface ChartMargin {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ChartDimensions {
  width: number;
  height: number;
  boundedWidth: number;
  boundedHeight: number;
  margin: ChartMargin;
}

const DEFAULT_MARGIN: ChartMargin = { top: 16, right: 16, bottom: 32, left: 48 };

/**
 * Tracks a wrapper element's size via ResizeObserver and derives the plot
 * area (bounded box) once margins are subtracted. `height` can be a fixed
 * number of pixels, or omitted to derive it from `aspectRatio` (height = width / ratio)
 * or, failing that, the wrapper's own observed height — pass `height: undefined`
 * (e.g. while in fullscreen mode, see `useFullscreen`) to let the chart fill
 * whatever height its container actually has. `width` works the same way, fixed
 * instead of following the wrapper's own (usually 100%-of-parent) observed width —
 * the caller is responsible for also giving the wrapper an inline width matching it,
 * since this hook only measures, it doesn't itself size the element.
 */
export function useChartDimensions(
  margin: Partial<ChartMargin> = {},
  options: { width?: number; height?: number; aspectRatio?: number } = {}
): [RefObject<HTMLDivElement>, ChartDimensions] {
  const objRef = useRef<HTMLDivElement | null>(null);
  // The DOM node itself, mirrored into React state via the callback ref below — not just
  // `objRef.current` — specifically so the two effects further down can list it as a real
  // dependency. A plain `useRef` mutating its own `.current` doesn't trigger a re-render (nor
  // re-run any effect) on its own; if the *node this ref is attached to* is ever swapped out from
  // under React by something outside its own reconciliation (a host environment that unmounts and
  // remounts the DOM subtree itself, e.g. Storybook's own "preparing story" placeholder swap,
  // confirmed via a MutationObserver during a real repro — a caller embedding this component
  // inside any other framework/tool doing similar imperative DOM surgery is exposed to the same
  // thing), a `useEffect` with only `options.*` in its own deps would keep observing whichever
  // node it *first* attached to forever: `size` then never updates again, since a disconnected
  // element's own ResizeObserver either never fires again or, per spec, fires exactly once more
  // reporting a zeroed rect — read literally, that permanently wedges this hook at 0×0. Threading
  // the node through state closes this: every one of React's own re-attachments (initial mount,
  // and any future one) re-runs both effects below against the *current* real node.
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  // The returned "ref" is a callback (so this hook notices every attach, not just the first) that
  // also keeps `objRef.current` in sync and exposes it via a `current` getter — from the outside,
  // callers keep reading/passing it exactly like the plain `useRef`-backed `RefObject` this used
  // to return (see e.g. `useRenderCandlestickChart`'s own `wrapperRef.current` read); nothing
  // about this hook's own external shape changes.
  const ref = useMemo(() => {
    const callbackRef = (el: HTMLDivElement | null) => {
      objRef.current = el;
      setNode(el);
    };
    Object.defineProperty(callbackRef, "current", { get: () => objRef.current, enumerable: true });
    return callbackRef as unknown as RefObject<HTMLDivElement>;
  }, []);
  const resolvedMargin: ChartMargin = { ...DEFAULT_MARGIN, ...margin };
  const [size, setSize] = useState({ width: options.width ?? 0, height: options.height ?? 320 });

  // Re-measures synchronously (before paint) whenever a fixed width/height/aspectRatio is added,
  // removed, or changed — most notably toggling fullscreen, which flips `height`/`width` between
  // a fixed number and `undefined` (see `useFullscreen`) — or whenever the node itself changes
  // (see `node`'s own doc above). ResizeObserver's own callback fires asynchronously; relying on
  // it alone left `size` stale for a render or two right after the CSS class actually changed (the
  // canvas redraws correctly every render off the same `dims`, but ChartAxis's own persistent tick
  // DOM was mutated in place using that stale, differently sized scale — most visibly right after
  // exiting fullscreen, where its ticks briefly kept the fullscreen-sized layout and rendered past
  // the now-smaller chart's edges).
  useLayoutEffect(() => {
    if (!node) return;
    const rect = node.getBoundingClientRect();
    const width = options.width ?? rect.width;
    const height = options.height ?? (options.aspectRatio ? width / options.aspectRatio : rect.height || 320);
    setSize({ width, height });
  }, [node, options.width, options.height, options.aspectRatio]);

  useEffect(() => {
    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const width = options.width ?? entry.contentRect.width;
      const height = options.height ?? (options.aspectRatio ? width / options.aspectRatio : entry.contentRect.height || 320);
      setSize({ width, height });
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, [node, options.width, options.height, options.aspectRatio]);

  const boundedWidth = Math.max(0, size.width - resolvedMargin.left - resolvedMargin.right);
  const boundedHeight = Math.max(0, size.height - resolvedMargin.top - resolvedMargin.bottom);

  return [
    ref,
    {
      width: size.width,
      height: size.height,
      boundedWidth,
      boundedHeight,
      margin: resolvedMargin,
    },
  ];
}
