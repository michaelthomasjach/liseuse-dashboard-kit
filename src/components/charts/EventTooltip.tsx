import { useEffect, useRef } from "react";
import { CloseIcon } from "../icons";
import type { ChartEvent } from "./CandlestickChart";
import "./EventTooltip.css";

export interface ChartEventTooltipProps {
  /** One event, or several when they share the same marker (a "stack") — every one of them is
   *  listed, scrollable past the mode's own height limit. */
  events: ChartEvent[];
  /** "popover" is the small card anchored to the marker; "modal" fills the whole chart. */
  mode: "popover" | "modal";
  onClose: () => void;
  /** Makes each event card clickable (hover overlay + click opens the modal) when set — omit to
   *  render them inert. Ignored in "modal" mode. */
  onExpand?: () => void;
  /** Popover mode only: its left edge, in px, relative to its positioned ancestor. */
  left?: number;
  /** Popover mode only: distance from its positioned ancestor's bottom edge, in px — its bottom
   *  edge grows *upward* from here as content is added, rather than a `top` that would need the
   *  box's own (content-dependent) height known up front to stay pinned above the marker. */
  bottom?: number;
  /** Popover mode only: fixed width in px. Default 320. */
  width?: number;
  formatDate?: (date: Date) => string;
  className?: string;
}

/**
 * Detail card for one or more `ChartEvent`s sharing the same marker on a chart. Two render
 * modes sharing the same outside-click/Escape-to-close behavior and the same event list:
 * "popover" is a small anchored card (position via `left`/`bottom`, capped at 350px tall with
 * its own scrollbar past that), "modal" fills its positioned ancestor entirely — meant to be
 * `CandlestickChart`'s own root, so "modal" reads as filling the whole chart. Positioning
 * (`left`/`bottom`) and mode-switching are the caller's job, same division of labor as
 * `Popover`: this component only renders what it's told and reports interaction back up.
 */
export function ChartEventTooltip({ events, mode, onClose, onExpand, left = 0, bottom = 0, width = 320, formatDate, className }: ChartEventTooltipProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dFmt = formatDate ?? ((d: Date) => d.toLocaleDateString());

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const list = (
    <div className="lq-chart-event-tooltip__list">
      {events.map((event, i) => (
        <article
          key={i}
          className={["lq-chart-event-tooltip__card", onExpand && "lq-chart-event-tooltip__card--clickable"].filter(Boolean).join(" ")}
          style={{ borderInlineStartColor: event.color }}
          onClick={onExpand}
        >
          <h4 className="lq-chart-event-tooltip__title">{event.label}</h4>
          {event.details && event.details.length > 0 && (
            <ul className="lq-chart-event-tooltip__details">
              {event.details.map((line, j) => (
                <li key={j}>{line}</li>
              ))}
            </ul>
          )}
          <div className="lq-chart-event-tooltip__date">{dFmt(event.date)}</div>
        </article>
      ))}
    </div>
  );

  if (mode === "modal") {
    return (
      <div ref={rootRef} className={["lq-chart-event-tooltip", "lq-chart-event-tooltip--modal", className].filter(Boolean).join(" ")}>
        <header className="lq-chart-event-tooltip__header">
          <span className="lq-chart-event-tooltip__header-title">{events.length === 1 ? events[0].label : `${events.length} évènements`}</span>
          <button type="button" className="lq-chart-event-tooltip__icon-button" onClick={onClose} aria-label="Fermer">
            <CloseIcon size={13} />
          </button>
        </header>
        <div className="lq-chart-event-tooltip__body lq-chart-event-tooltip__body--modal">{list}</div>
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className={["lq-chart-event-tooltip", "lq-chart-event-tooltip--popover", className].filter(Boolean).join(" ")}
      style={{ left, bottom, width }}
    >
      <div className="lq-chart-event-tooltip__body">{list}</div>
    </div>
  );
}
