import { useEffect, useRef, useState } from "react";

/** How far a tall section has been scrolled through, from 0 (its top just reached the top of the
 *  viewport) to 1 (its bottom is about to leave).
 *
 *  Read on scroll, but only ever written once per animation frame and only when the rounded value
 *  actually moves: the section it drives holds a live candlestick chart, and a `setState` on every
 *  scroll event would re-render it dozens of times per second for changes too small to see. The
 *  1/1000 quantisation is finer than any single pixel of the animations reading it. */
export function useScrollProgress(): [(node: HTMLElement | null) => void, number] {
  const [progress, setProgress] = useState(0);
  const nodeRef = useRef<HTMLElement | null>(null);
  const frameRef = useRef(0);
  const lastRef = useRef(-1);

  const ref = (node: HTMLElement | null) => {
    nodeRef.current = node;
  };

  useEffect(() => {
    function measure() {
      frameRef.current = 0;
      const node = nodeRef.current;
      if (node === null) return;
      const rect = node.getBoundingClientRect();
      const travel = rect.height - window.innerHeight;
      if (travel <= 0) return;
      const raw = Math.min(1, Math.max(0, -rect.top / travel));
      const next = Math.round(raw * 1000) / 1000;
      if (next === lastRef.current) return;
      lastRef.current = next;
      setProgress(next);
    }
    function onScroll() {
      if (frameRef.current !== 0) return;
      frameRef.current = window.requestAnimationFrame(measure);
    }
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frameRef.current !== 0) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  return [ref, progress];
}

/** 0 before `from`, 1 after `to`, eased in between. */
export function phase(progress: number, from: number, to: number): number {
  if (progress <= from) return 0;
  if (progress >= to) return 1;
  const t = (progress - from) / (to - from);
  return t * t * (3 - 2 * t);
}
