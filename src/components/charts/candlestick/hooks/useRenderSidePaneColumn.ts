import { useEffect } from "react";
import type { RefObject } from "react";
import { renderSidePaneColumn } from "../render/renderSidePaneColumn";
import type { SidePaneColumnRenderParams } from "../interfaces/SidePaneColumnRenderParams.interface";

export interface UseRenderSidePaneColumnArgs extends SidePaneColumnRenderParams {
  canvasRef: RefObject<HTMLCanvasElement>;
  wrapperRef: RefObject<HTMLDivElement>;
  themeTick: number;
}

/** The docked-column counterpart of `useRenderCandlestickChart` — same "params changed, redraw"
 *  effect shape, just calling `renderSidePaneColumn` against this column's own canvas instead of
 *  the main plot's. A separate small effect (not folded into the main chart's own draw effect)
 *  since this column is a genuinely separate `<canvas>` element (a flex sibling, not part of the
 *  main plot's own DOM box — see ChartSidePaneColumn's own doc), with its own `canvasRef`/
 *  `wrapperRef` to read colors and size from. */
export function useRenderSidePaneColumn({ canvasRef, wrapperRef, themeTick, ...params }: UseRenderSidePaneColumnArgs) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    renderSidePaneColumn(canvas, wrapper, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef, wrapperRef, themeTick, ...Object.values(params)]);
}
