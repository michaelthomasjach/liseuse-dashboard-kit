import type { ScaleLinear } from "d3";
import { useEffect, useRef, useState } from "react";
import type { OverlayDrawingInteraction } from "../interfaces/OverlayDrawingInteraction.interface";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";

/** What a drag acts on: a whole line or zone ("body"), or one edge of a zone ("high" / "low"). */
export type OverlayDragPart = "body" | "high" | "low";

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
  onPreview: (drag: { id: string; delta: number; part: OverlayDragPart } | null) => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

/** Grab strip: wide enough to catch a 1–2 px line without aiming. */
const HIT = 10;
/** Pointer travel below which a press is a click (select), not a drag. */
const DRAG_THRESHOLD = 3;

interface Hit {
  key: string;
  part: OverlayDragPart;
  it: OverlayDrawingInteraction;
  dr: TrendLineDrawing;
  /** Price the dragged part sits at (the line, or the zone edge) — the shift is measured from it. */
  price: number;
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * DOM layer over the price plot that makes the app's `overlayDrawings` listed in `overlayInteractions` grabbable
 * (see `OverlayDrawingInteraction`): a horizontal line gets a thin strip along it; a rectangle gets its body (drag
 * = move the whole zone) and, when the app accepts `onResize`, a strip on its top and bottom edges (drag = move
 * that bound only). Every drag is vertical. A click selects and opens a small bubble with « Supprimer ». Only these
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
  const drag = useRef<{ key: string; startY: number; moved: boolean; delta: number } | null>(null);
  const [bubbleAt, setBubbleAt] = useState<{ x: number; y: number } | null>(null);
  const plotHeight = Math.max(0, priceHeight - dims.margin.top);

  const hits: Hit[] = interactions.flatMap((it): Hit[] => {
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
      if (r <= l) return [];
      const hi = Math.max(dr.y1, dr.y2);
      const lo = Math.min(dr.y1, dr.y2);
      const yHi = zoomedPriceScale(hi);
      const yLo = zoomedPriceScale(lo);
      const out: Hit[] = [];
      // Edges first in the list but painted above the body (z-index), so a press right on an edge resizes.
      const edge = HIT / 2;
      const bodyTop = Math.max(0, Math.min(yHi, yLo) + (it.onResize ? edge : 0));
      const bodyBottom = Math.min(plotHeight, Math.max(yHi, yLo) - (it.onResize ? edge : 0));
      if (bodyBottom > bodyTop)
        out.push({ key: `${it.id}:body`, part: "body", it, dr, price: hi, left: l, top: bodyTop, width: r - l, height: bodyBottom - bodyTop });
      if (it.onResize) {
        if (yHi > -HIT && yHi < plotHeight + HIT) out.push({ key: `${it.id}:high`, part: "high", it, dr, price: hi, left: l, top: yHi - edge, width: r - l, height: HIT });
        if (yLo > -HIT && yLo < plotHeight + HIT) out.push({ key: `${it.id}:low`, part: "low", it, dr, price: lo, left: l, top: yLo - edge, width: r - l, height: HIT });
      }
      return out;
    }
    // Horizontal line (or any flat line): a strip across the plot.
    const y = (yA + yB) / 2;
    if (y < -HIT || y > plotHeight + HIT) return [];
    return [{ key: `${it.id}:body`, part: "body", it, dr, price: dr.y1, left: 0, top: y - HIT / 2, width: dims.boundedWidth, height: HIT }];
  });

  const selected = hits.find((h) => h.it.id === selectedId && h.part === "body") ?? hits.find((h) => h.it.id === selectedId) ?? null;

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
  const canDrag = (h: Hit) => (h.part === "body" ? Boolean(h.it.onMove) : Boolean(h.it.onResize));

  return (
    <div className="lq-overlay-layer" style={{ left: dims.margin.left, top: dims.margin.top, width: dims.boundedWidth, height: plotHeight }}>
      {hits.map((h) => (
        <div
          key={h.key}
          className={[
            "lq-overlay-hit",
            h.dr.lineType === "rectangle" && h.part === "body" ? "lq-overlay-hit--area" : "",
            h.part !== "body" ? "lq-overlay-hit--edge" : "",
            h.it.id === selectedId ? "is-selected" : "",
            canDrag(h) ? "is-movable" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{ left: h.left, top: h.top, width: h.width, height: h.height }}
          role="button"
          tabIndex={0}
          aria-label={h.part === "body" ? title(h) : `${title(h)} — borne ${h.part === "high" ? "haute" : "basse"}`}
          title={h.part === "body" ? undefined : `Glisser pour déplacer la borne ${h.part === "high" ? "haute" : "basse"}`}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { key: h.key, startY: e.clientY, moved: false, delta: 0 };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || d.key !== h.key) return;
            e.stopPropagation();
            if (!canDrag(h)) return;
            if (!d.moved && Math.abs(e.clientY - d.startY) < DRAG_THRESHOLD) return;
            d.moved = true;
            d.delta = zoomedPriceScale.invert(zoomedPriceScale(h.price) + (e.clientY - d.startY)) - h.price;
            onPreview({ id: h.it.id, delta: d.delta, part: h.part });
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            if (!d || d.key !== h.key) return;
            e.stopPropagation();
            if (d.moved && canDrag(h)) {
              if (h.part === "body") h.it.onMove?.(d.delta);
              else h.it.onResize?.(h.part, d.delta);
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
          {(selected.it.onMove || selected.it.onResize) && (
            <span className="lq-overlay-bubble__hint">
              {selected.it.onResize ? "Glisser le milieu pour déplacer, un bord pour redimensionner" : "Glisser pour déplacer"}
            </span>
          )}
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
