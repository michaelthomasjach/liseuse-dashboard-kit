import type { DataPoint } from "./DataPoint.interface";

/** A live on-canvas text entry in progress for "text"/"comment"/"note"/"priceNote"/"signpost" —
 *  not yet a `drawings` entry (see useDrawingState's own `textEntry`/`commitTextEntry`/
 *  `cancelTextEntry`). `point` is always where the input itself renders and, on commit, becomes
 *  x2/y2 (x1/y1 too for "text"/"comment"/"signpost", whose single point has no separate anchor).
 *  `anchorPoint` is only set for "note"/"priceNote" — their own 1st click, becoming x1/y1 on
 *  commit, connected to `point` by a straight line (see drawNote.ts). */
export interface TextEntryState {
  tool: "text" | "comment" | "note" | "priceNote" | "signpost";
  point: DataPoint;
  anchorPoint?: DataPoint;
  value: string;
}
