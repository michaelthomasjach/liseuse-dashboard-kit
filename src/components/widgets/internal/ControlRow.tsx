import { useLayoutEffect, useRef, type ReactNode } from "react";
import { PanelRow } from "../../primitives/Panel";
import { Toggle } from "../../primitives/Toggle";
import { LevelGauge } from "../../primitives/LevelGauge";
import "./ControlRow.css";

export interface ControlListEntry {
  id: string;
  label: string;
  on: boolean;
  /** 0-100. Omit for controls with no intensity (a simple on/off row still shows the toggle only). */
  level?: number;
  /** Trailing status text, e.g. "ouvert", "fermé", "80 %". */
  statusText?: string;
  onToggle?: (on: boolean) => void;
  /** Makes the row clickable (e.g. to open a detail modal), independent of the toggle. */
  onClick?: () => void;
  disabled?: boolean;
}

export interface ControlListRowProps {
  entry: ControlListEntry;
  gaugeSegments?: number;
}

/** Shared row shape for widgets built around "toggle + level gauge + status" (shutters, lights…). */
export function ControlListRow({ entry, gaugeSegments = 10 }: ControlListRowProps) {
  return (
    // `value` always rendered (empty when there is no status) so every row has the same trailing
    // column for `ControlList` to size.
    <PanelRow className="lq-control-row" label={entry.label} value={entry.statusText ?? ""} onClick={entry.onClick}>
      <Toggle
        checked={entry.on}
        onChange={entry.onToggle}
        ariaLabel={entry.label}
        disabled={entry.disabled}
      />
      {entry.level !== undefined && (
        <LevelGauge value={entry.level} segments={gaugeSegments} label={null} ariaLabel={`Niveau ${entry.label}`} />
      )}
    </PanelRow>
  );
}

/** Wraps the rows of one list so their status words share a single column width.
 *
 *  Each row is its own flex line, so a longer word ("allumée" beside "80 %") pushed that row's
 *  toggle and gauge left — up to ~25 px of zigzag down the list. The widest status is measured
 *  after layout and given to every status as its minimum width; the toggles then line up whatever
 *  the words are. A `display: contents` wrapper, so the panel's own row layout is untouched. */
export function ControlList({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el === null) return;
    const align = () => {
      const values = Array.from(el.querySelectorAll<HTMLElement>(".lq-control-row > .lq-panel-row__value"));
      for (const value of values) value.style.minWidth = "";
      const widest = values.reduce((max, value) => Math.max(max, value.getBoundingClientRect().width), 0);
      for (const value of values) value.style.minWidth = `${Math.ceil(widest)}px`;
    };
    align();
    // Again once the theme's web fonts are in: the first measure may have used a fallback font.
    let cancelled = false;
    void el.ownerDocument.fonts?.ready.then(() => {
      if (!cancelled) align();
    });
    return () => {
      cancelled = true;
    };
  });
  return (
    <div ref={ref} className="lq-control-list">
      {children}
    </div>
  );
}
