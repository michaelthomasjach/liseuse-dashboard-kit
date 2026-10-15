import type { ReactNode } from "react";

/** An app-defined button in the chart's own tools rail: clicking it arms the tool, the next click on the price
 *  plot reports that point's price and date to `onPlace`, then the tool disarms (Escape or a second click on its
 *  button disarms it without placing anything). For levels the app owns — an entry, a stop, a target… — that the
 *  user picks straight on the chart instead of typing them. */
export interface ChartCustomTool {
  id: string;
  /** Button text: its tooltip and accessible name. */
  label: string;
  /** Any React node, typically a 14–16 px icon (or a short text badge). */
  icon: ReactNode;
  /** Optional free text appended to the tooltip (what clicking the chart will set). */
  description?: string;
  /** Called with the clicked point (magnet snapping applies, same as the drawing tools). Not called by a
   *  `points: 2` tool — see `onPlaceRange`. */
  onPlace?: (point: { price: number; date: Date }) => void;
  /** 2: the tool takes two clicks (a dashed guide marks the first one until the second) and reports both to
   *  `onPlaceRange` — e.g. a zone whose bounds are the two clicked prices, in whichever order they were picked.
   *  Default 1. */
  points?: 1 | 2;
  /** Called with both clicks of a `points: 2` tool, in click order. */
  onPlaceRange?: (first: { price: number; date: Date }, second: { price: number; date: Date }) => void;
}
