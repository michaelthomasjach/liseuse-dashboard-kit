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
  /** Called with the clicked point (magnet snapping applies, same as the drawing tools). */
  onPlace: (point: { price: number; date: Date }) => void;
}
