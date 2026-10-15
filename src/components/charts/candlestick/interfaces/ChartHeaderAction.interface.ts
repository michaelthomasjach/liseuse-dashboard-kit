import type { ReactNode } from "react";

/** An app-defined button in the chart's top bar (after the built-in pickers): a mode or an analysis the app runs on
 *  the chart's own data — e.g. a forecasting model — with its own state shown on the button. Purely a trigger: the
 *  chart calls `onClick`, the app does the work and reflects it back through `active` / `busy`. */
export interface ChartHeaderAction {
  id: string;
  /** Short button text (e.g. "LSTM"). Also its accessible name unless `title` says more. */
  label: string;
  /** Tooltip and accessible description (what clicking does). */
  title?: string;
  /** Optional 14 px icon shown before the label. */
  icon?: ReactNode;
  /** Pressed look (the app's mode or result is on). */
  active?: boolean;
  /** Work in progress: a spinner-like pulse and `aria-busy`; still clickable (the app decides what a click does). */
  busy?: boolean;
  disabled?: boolean;
  onClick: () => void;
}
