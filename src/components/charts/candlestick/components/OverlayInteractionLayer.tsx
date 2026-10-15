import type { ScaleLinear } from "d3";
import { useEffect, useRef, useState } from "react";
import type { OverlayDrawingInteraction } from "../interfaces/OverlayDrawingInteraction.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";

export interface OverlayInteractionLayerProps {
  drawings: TrendLineDrawing[];
  interactions: OverlayDrawingInteraction[];
  dims: { margin: { top: number; left: number }; boundedWidth: number };
  /** Height of the price section (the drawings live there), margin included. */
  priceHeight: number;
  zoomedPriceScale: ScaleLinear<number, number>;
  zoomedXScale: ScaleLinear<number, number>;
  indexForDate: (date: Date) => number;
  /** Live shift of the drawing being dragged (null when the drag ends) — the chart redraws it shifted. */
  onPreview: (drag: { id: string; delta: number } | null) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Grab strip: wide enough to catch a 1–2 px line without aiming. */
const HIT = 10;
/** Pointer travel below which a press is a click (select), not a drag. */
const DRAG_THRESHOLD = 3;

interface Hit {
  it: OverlayDrawingInteraction;
  dr: TrendLineDrawing;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * DOM layer over the price plot that makes the app's `overlayDrawings` listed in `overlayInteractions` grabbable
 * (see `OverlayDrawingInteraction`): a horizontal line gets a thin strip along it, a rectangle its whole body.
 * Dragging moves it vertically only; a click selects it and opens a small bubble with « Supprimer ». Only these
 * strips take the pointer, so panning and drawing keep working everywhere else on the plot.
 */
export function OverlayInteractionLayer({
  drawings,
  interactions,
  dims,
  priceHeight,
  zoomedPriceScale,
  zoomedXScale,
  indexForDate,
  onPreview,
  selectedId,
  onSelect,
}: OverlayInteractionLayerProps) {
  const drag = useRef<{ id: string; startY: number; moved: boolean; delta: number } | null>(null);
  const [bubbleAt, setBubbleAt] = useState<{ x: number; y: number } | null>(null);
  const plotHeight = Math.max(0, priceHeight - dims.margin.top);

  const hits: Hit[] = interactions.flatMap((it) => {
    const dr = drawings.find((d) => d.id === it.id);
    if (!dr) return [];
    const yA = zoomedPriceScale(dr.y1);
    const yB = zoomedPriceScale(dr.y2);
    if (dr.lineType === "rectangle") {
      const xA = zoomedXScale(indexForDate(dr.x1) + 0.5);
      const xB = zoomedXScale(indexForDate(dr.x2) + 0.5);
      const ext = dr.extend ?? "none";
      const l = ext === "left" || ext === "both" ? 0 : Math.max(0, Math.min(xA, xB));
      const r = ext === "right" || ext === "both" ? dims.boundedWidth : Math.min(dims.boundedWidth, Math.max(xA, xB));
      const t = Math.max(0, Math.min(yA, yB));
      const b = Math.min(plotHeight, Math.max(yA, yB));
      return r > l && b > t ? [{ it, dr, left: l, top: t, width: r - l, height: b - t }] : [];
    }
    // Horizontal line (or any flat line): a strip across the plot.
    const y = (yA + yB) / 2;
    if (y < -HIT || y > plotHeight + HIT) return [];
    return [{ it, dr, left: 0, top: y - HIT / 2, width: dims.boundedWidth, height: HIT }];
  });

  const selected = hits.find((h) => h.it.id === selectedId) ?? null;

  // While selected: Escape closes, Delete removes, a press anywhere else closes the bubble.
  useEffect(() => {
    if (!selectedId) return;
    const it = interactions.find((x) => x.id === selectedId);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onSelect(null);
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if ((e.key === "Delete" || e.key === "Backspace") && it?.onDelete && !typing) {
        it.onDelete();
        onSelect(null);
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(".lq-overlay-hit, .lq-overlay-bubble")) onSelect(null);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [selectedId, interactions, onSelect]);

  if (!hits.length) return null;

  const title = (h: Hit) => h.it.label ?? h.dr.text ?? h.it.id;

  return (
    <div className="lq-overlay-layer" style={{ left: dims.margin.left, top: dims.margin.top, width: dims.boundedWidth, height: plotHeight }}>
      {hits.map((h) => (
        <div
          key={h.it.id}
          className={`lq-overlay-hit${h.dr.lineType === "rectangle" ? " lq-overlay-hit--area" : ""}${h.it.id === selectedId ? " is-selected" : ""}${h.it.onMove ? " is-movable" : ""}`}
          style={{ left: h.left, top: h.top, width: h.width, height: h.height }}
          role="button"
          tabIndex={0}
          aria-label={title(h)}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { id: h.it.id, startY: e.clientY, moved: false, delta: 0 };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.id !== h.it.id) return;
            e.stopPropagation();
            if (!h.it.onMove) return;
            if (!d.moved && Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
            d.moved = true;
            const base = zoomedPriceScale(h.dr.y1);
            d.delta = zoomedPriceScale.invert(base + (e.clientY - d.startY)) - h.dr.y1;
            onPreview({ id: d.id, delta: d.delta });
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d || d.id !== h.it.id) return;
            e.stopPropagation();
            if (d.moved && h.it.onMove) {
              h.it.onMove(d.delta);
              onPreview(null);
              return;
            }
            const box = e.currentTarget.parentElement?.getBoundingClientRect();
            setBubbleAt(box ? { x: e.clientX - box.left, y: e.clientY - box.top } : null);
            onSelect(h.it.id === selectedId ? null : h.it.id);
          }}
          onPointerCancel={() => {
            drag.current = null;
            onPreview(null);
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onSelect(h.it.id === selectedId ? null : h.it.id);
            }
          }}
        />
      ))}
      {selected && (
        <div
          className="lq-overlay-bubble"
          role="dialog"
          aria-label={title(selected)}
          style={{
            left: Math.min(Math.max(8, bubbleAt?.x ?? selected.left + selected.width / 2), dims.boundedWidth - 8),
            top: Math.max(0, (bubbleAt?.y ?? selected.top) - 8),
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <span className="lq-overlay-bubble__title">{title(selected)}</span>
          {selected.it.onMove && <span className="lq-overlay-bubble__hint">Glisser pour déplacer</span>}
          {selected.it.onDelete && (
            <button
              type="button"
              className="lq-overlay-bubble__delete"
              onClick={() => {
                selected.it.onDelete?.();
                onSelect(null);
              }}
            >
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  );
}
