import { useEffect, useRef, useState } from "react";

export const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0 || 1e-6), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Where the sequence is, as a name. Mirrors the phase label of the original controller. */
export type CinemaPhase = "page" | "enter" | "expanding" | "hold" | "collapsing";

/** How far into the hold the reader is, 0 to 1 — the only thing the editor and the typing key off,
 *  so they are independent of the expand/collapse ramps. */
export interface CinemaState {
  phase: CinemaPhase;
  /** Raw progress through the track, 0 to 1. */
  p: number;
  /** Progress through the hold alone, 0 to 1. */
  held: number;
}

const E0 = 0.04;
const E1 = 0.2;
const H1 = 0.82;
const C1 = 0.95;

const FLOOR = 88;
const GAP = 20;

/** The scroll physics behind the cinema section, ported from `trading-lab-front`'s own
 *  `useLumenScrollController` (itself a port of the `Lumen Market Analysis` design), keeping the
 *  two decisions that give it its feel:
 *
 *  1. **The animation is smoothed, not tracked.** A `requestAnimationFrame` loop eases a `smooth`
 *     value toward `window.scrollY` at 14% per frame, and everything reads `smooth`. The geometry
 *     therefore glides into place after the wheel stops instead of snapping to it, which is the
 *     whole difference between "a chart that resizes when you scroll" and a sequence that feels
 *     driven.
 *  2. **It writes CSS custom properties, never React state.** `--chart-w`, `--chart-h`,
 *     `--chart-scale`, `--stage-y`, `--label-op` and the rest are set on the container's own
 *     style, so sixty frames a second cost zero renders and the chart inside is never touched by
 *     them.
 *
 *  What React state there is (`CinemaState`) exists only for the beats this section adds on top —
 *  the editor, the typing, the runs — and changes a few hundred times across the whole track
 *  rather than every frame. */
export function useCinemaScroll(): {
  container: (node: HTMLDivElement | null) => void;
  section: (node: HTMLElement | null) => void;
  stage: (node: HTMLDivElement | null) => void;
  label: (node: HTMLDivElement | null) => void;
  state: CinemaState;
} {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRef = useRef<HTMLElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const labelRef = useRef<HTMLDivElement | null>(null);
  const [state, setState] = useState<CinemaState>({ phase: "page", p: 0, held: 0 });

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let smooth = window.scrollY;
    let raf = 0;
    let stopped = false;
    let vh = window.innerHeight;
    let vw = document.documentElement.clientWidth || window.innerWidth;
    let colW = 0;
    let lastSig = "";
    let lastState = "";

    function measure() {
      vh = window.innerHeight;
      vw = document.documentElement.clientWidth || window.innerWidth;
      const sticky = stageRef.current?.parentElement;
      colW = sticky ? sticky.clientWidth - 64 : Math.min(vw, 1440) - 64;
    }

    function apply(scroll: number) {
      const root = containerRef.current;
      const sec = sectionRef.current;
      if (root === null || sec === null) return;
      const style = root.style;

      const rect = sec.getBoundingClientRect();
      const secTop = rect.top + window.scrollY;
      const span = Math.max(1, rect.height - vh);
      const p = clamp((scroll - secTop) / span, 0, 1);

      // Expand, hold, collapse. Flat at 1 through the whole middle, which is where the editor and
      // the script live.
      const cp = p < E1 ? smoothstep(E0, E1, p) : p < H1 ? 1 : 1 - smoothstep(H1, C1, p);

      const baseW = vw < 720 ? vw - 32 : colW;
      const labelH = labelRef.current?.offsetHeight ?? 68;
      const headroom = FLOOR + labelH + GAP;
      const baseH = clamp(vh - headroom - 24, 220, 540);
      // Laid out slightly larger and scaled back down at rest: the card pulls in as it settles,
      // which reads as depth without distorting anything at full size.
      const scale = lerp(0.972, 1, cp);

      style.setProperty("--chart-progress", cp.toFixed(4));
      style.setProperty("--chart-w", `${Math.round(lerp(baseW, vw, cp) / scale)}px`);
      style.setProperty("--chart-h", `${Math.round(lerp(baseH, vh, cp) / scale)}px`);
      style.setProperty("--chart-b", `${lerp(1, 0, cp).toFixed(2)}px`);
      style.setProperty("--chart-scale", scale.toFixed(4));
      style.setProperty("--label-op", (1 - smoothstep(0, 0.45, cp)).toFixed(3));

      const restY = Math.max(0, headroom - (vh - baseH) / 2);
      style.setProperty("--stage-y", `${Math.round(lerp(restY, 0, cp))}px`);
      style.setProperty("--label-inset", `${Math.max(0, Math.round((baseW / scale - colW) / 2))}px`);

      const stage = stageRef.current;
      const label = labelRef.current;
      if (stage !== null && label !== null) {
        const top = stage.getBoundingClientRect().top;
        const wanted = top - GAP - labelH;
        const parent = label.offsetParent as HTMLElement | null;
        const originTop = parent === null ? top : parent.getBoundingClientRect().top;
        const anchored = top >= FLOOR ? Math.max(FLOOR, wanted) : wanted;
        style.setProperty("--label-top", `${Math.round(anchored - originTop)}px`);
      }

      const phase: CinemaPhase =
        p <= 0 || p >= 1 ? "page" : p < E0 ? "enter" : p < E1 ? "expanding" : p < H1 ? "hold" : "collapsing";
      const held = clamp((p - E1) / (H1 - E1), 0, 1);
      const sig = `${phase}|${Math.round(held * 1000)}`;
      if (sig !== lastState) {
        lastState = sig;
        setState({ phase, p, held });
      }
    }

    function frame() {
      if (stopped) return;
      raf = window.requestAnimationFrame(frame);
      const target = window.scrollY || document.documentElement.scrollTop || 0;
      // Eased rather than assigned: this is what makes the geometry glide behind the wheel.
      smooth += (target - smooth) * (reduced ? 1 : 0.14);
      if (Math.abs(target - smooth) < 0.4) smooth = target;
      const sig = `${smooth}|${window.innerWidth}x${window.innerHeight}`;
      if (sig === lastSig) return;
      lastSig = sig;
      apply(smooth);
    }

    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    measure();
    frame();

    return () => {
      stopped = true;
      window.removeEventListener("resize", onResize);
      if (raf !== 0) window.cancelAnimationFrame(raf);
    };
  }, []);

  return {
    container: (node) => {
      containerRef.current = node;
    },
    section: (node) => {
      sectionRef.current = node;
    },
    stage: (node) => {
      stageRef.current = node;
    },
    label: (node) => {
      labelRef.current = node;
    },
    state,
  };
}
