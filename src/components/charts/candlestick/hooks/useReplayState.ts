import { useEffect, useRef, useState } from "react";
import type * as React from "react";
import type { ScaleLinear } from "d3";

export interface UseReplayStateArgs {
  /** `data.length` — the auto-advance timer's own stopping point (see the effect below) and the
   *  clamp on a pointer position resolved past the last real candle. */
  dataLength: number;
}

const SPEED_INTERVAL_MS = 600;

/** Replay mode's own state machine and pointer handling — kept out of CandlestickChart.tsx
 *  (already past its own 1000-line budget) entirely, mirroring useDrawingState's shape: a mode
 *  flag (`armed`), a live preview while choosing (`previewIndex`), and a committed value
 *  (`cutoffIndex`) once chosen. Deliberately independent of `activeTool`/`DrawingToolType` (see
 *  the plan's own doc on why) — replay isn't a drawing tool and has nothing to do with the
 *  drawing catalog.
 *
 *  Doesn't touch `data` or the chart's own scale at all — `cutoffIndex`/`previewIndex` are pure
 *  positions, read by `drawReplayMask.ts` to paint a cover from that index to the plot's right
 *  edge. This is deliberate: slicing `data` down would shrink `useZoomAndScales`' own X domain,
 *  re-fitting (and so re-positioning) every candle still visible — the opposite of what "hover
 *  dims, click cuts" is supposed to look like (nothing left of the cut should ever move).
 *
 *  `zoomedXScale` is deliberately NOT a hook argument (unlike everywhere else it's needed) — this
 *  hook's own `armed` is itself an input to `useZoomAndScales` (it suspends pan/zoom while
 *  choosing a cutoff, see that hook's own `replayArmed` doc), which would make `zoomedXScale` and
 *  `armed` circularly dependent on each other within the same render. `handlePointerMove`/
 *  `handleClick` below take it as a plain call-time argument instead — curried at the JSX call
 *  site, once `useZoomAndScales` has already run. */
export function useReplayState({ dataLength }: UseReplayStateArgs) {
  const [armed, setArmed] = useState(false);
  // Non-null is what "replay is active" means — no separate boolean to keep in sync with it.
  const [cutoffIndex, setCutoffIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  // The speed picker's own popover — owned here rather than in CandlestickChart.tsx (already past
  // its own 1000-line budget), same "the hook owns its own popover state" precedent
  // useChartDisplayMode.ts already sets for its own displayModeOpen/displayModeAnchorRef.
  const [speedOpen, setSpeedOpen] = useState(false);
  const speedAnchorRef = useRef<HTMLButtonElement>(null);
  const active = cutoffIndex !== null;

  // Same pixel->index formula as useDrawingInteractions.ts's own updateHoverState (mouseX relative
  // to the overlay rect's own bounding box, zoomedXScale.invert, round to the nearest candle,
  // clamp to the data's own bounds) — the established idiom in this codebase for this exact
  // conversion, reused rather than re-derived.
  function indexFromEvent(e: { currentTarget: SVGRectElement; clientX: number }, zoomedXScale: ScaleLinear<number, number>): number {
    const rect = e.currentTarget.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    return Math.min(dataLength - 1, Math.max(0, Math.round(zoomedXScale.invert(mouseX) - 0.5)));
  }

  // Click Replay again while still choosing a cutoff to back out of it — same "click the active
  // one again to cancel" convention the rail's own tools/toggles already use.
  function toggleArm() {
    if (armed) {
      setArmed(false);
      setPreviewIndex(null);
    } else {
      setArmed(true);
    }
  }

  // Curried on `zoomedXScale` (see this hook's own doc on why it isn't a plain hook argument) —
  // called at the ChartCanvasOverlay JSX call site as `replayState.handlePointerMove(zoomedXScale)`,
  // swapped in for the normal drawing-interaction handler only while `armed`.
  function handlePointerMove(zoomedXScale: ScaleLinear<number, number>) {
    return (e: React.PointerEvent<SVGRectElement>) => {
      if (!armed) return;
      setPreviewIndex(indexFromEvent(e, zoomedXScale));
    };
  }

  function handleClick(zoomedXScale: ScaleLinear<number, number>) {
    return (e: React.MouseEvent<SVGRectElement>) => {
      if (!armed) return;
      setCutoffIndex(indexFromEvent(e, zoomedXScale));
      setArmed(false);
      setPreviewIndex(null);
    };
  }

  function togglePlay() {
    setPlaying((p) => !p);
  }

  function quit() {
    setArmed(false);
    setCutoffIndex(null);
    setPreviewIndex(null);
    setPlaying(false);
  }

  // Escape exits replay entirely — while still choosing a cutoff (armed) or once one is already
  // active (playing or paused) — same "Escape backs out of this mode" convention useDrawingState's
  // own Escape handler already uses for an active drawing tool. Only listens while there's actually
  // something to exit, same reasoning that effect only listens while its own tool/selection state
  // is non-empty.
  useEffect(() => {
    if (!armed && !active) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      quit();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [armed, active]);

  // Same setInterval/clearInterval-in-cleanup shape useChartAppearance.ts's own live-price tick
  // uses — the only other self-ticking state in this whole chart library. Reveals one more candle
  // per tick, exiting replay entirely (not just pausing on the last bar, which left the mask
  // sitting at the data's own edge — visually a no-op cover, but still "in" replay: the reset-zoom
  // button kept targeting the revealed range and the header kept showing the replay toolbar) once
  // there's nothing left to reveal.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setCutoffIndex((i) => {
        if (i === null) return i;
        if (i + 1 >= dataLength - 1) {
          setPlaying(false);
          return null;
        }
        return i + 1;
      });
    }, SPEED_INTERVAL_MS / speed);
    return () => clearInterval(id);
  }, [playing, speed, dataLength]);

  return {
    armed,
    active,
    cutoffIndex,
    previewIndex,
    playing,
    speed,
    setSpeed,
    speedOpen,
    setSpeedOpen,
    speedAnchorRef,
    toggleArm,
    handlePointerMove,
    handleClick,
    togglePlay,
    quit,
  };
}
