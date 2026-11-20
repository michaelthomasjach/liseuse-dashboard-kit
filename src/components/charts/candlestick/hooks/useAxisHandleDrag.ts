import { useRef } from "react";
import type { ScaleLinear } from "d3";
import type { TrendLineDrawing } from "../interfaces/TrendLineDrawing.interface";
import type { DataPoint } from "../interfaces/DataPoint.interface";
import { isOffsetPriceLabel, round4 } from "../drawingGeometry";
import { CLICK_DRAG_THRESHOLD } from "../constants";

/** Poignées propres aux canaux ("channel", "disjointChannel"), en plus des points enregistrés.
 *  La ligne 1 est celle des deux premiers clics (x1/y1–x2/y2), la ligne 2 l'autre bord.
 *  - "line1Mid" / "line2Mid" : milieu d'une ligne, glissé à la verticale seulement — la ligne monte
 *    ou descend parallèlement à elle-même, l'autre ne bouge pas (la largeur du canal change).
 *  - "line2Start" / "line2End" ("channel" seulement) : coins de la ligne 2 (à la date de x1, de x2).
 *    Le coin suit le pointeur (aimant compris) ; le coin de la ligne 1 à la même extrémité le suit du
 *    même déplacement, la largeur reste la même — symétrique du glisser d'un point de la ligne 1, et
 *    conforme au modèle de TradingView (deux points du niveau 0 + un décalage en prix du niveau 1). */
export type ChannelHandle = "line1Mid" | "line2Mid" | "line2Start" | "line2End";

// Same shape as useDrawingInteractions' own local MutableRef — duplicated rather than imported
// to avoid a needless cross-file type dependency for something this small.
interface MutableRef<T> {
  current: T;
}

export interface UseAxisHandleDragArgs {
  drawings: TrendLineDrawing[];
  commitDrawings: (next: TrendLineDrawing[]) => void;
  drawingsLocked: boolean;
  dragAxisRef: MutableRef<{ id: string } | null>;
  zoomRef: MutableRef<SVGRectElement | null>;
  zoomedXScale: ScaleLinear<number, number>;
  zoomedPriceScale: ScaleLinear<number, number>;
  dateForIndex: (rawIndex: number) => Date;
  paneScaleAndOffset: (valueAxis: string | undefined) => { scale: ScaleLinear<number, number>; offset: number };
  /** A plain click on the handle (under CLICK_DRAG_THRESHOLD) selects its drawing, like a click on its body. */
  setSelectedDrawingId: (id: string | null) => void;
  setSelectedIndicatorId: (id: string | null) => void;
  /** Canaux : l'aimant (prix de la bougie la plus proche) pour les milieux de ligne. */
  magnetSnapPrice?: (rawIndex: number, rawY: number) => number;
  indexForDate?: (date: Date) => number;
  /** Canaux : pointeur → point du graphique (aimant, Maj = angle bloqué depuis `anchor`), pour les coins de la ligne 2. */
  toDataPoint?: (e: { clientX: number; clientY: number; shiftKey?: boolean }, anchor: DataPoint | null) => DataPoint;
}

/** The single-handle drag every axis-constrained/single-point drawing type shares — pulled out of
 *  `useDrawingInteractions` purely to keep that file under its 1000-line budget, same reasoning
 *  `distanceToDrawing` was already pulled into drawingHitTest.ts for; behavior unchanged. */
export function useAxisHandleDrag({
  drawings,
  commitDrawings,
  drawingsLocked,
  dragAxisRef,
  zoomRef,
  zoomedXScale,
  zoomedPriceScale,
  dateForIndex,
  paneScaleAndOffset,
  setSelectedDrawingId,
  setSelectedIndicatorId,
  magnetSnapPrice,
  indexForDate,
  toDataPoint,
}: UseAxisHandleDragArgs) {
  // Click or drag (see useDrawingInteractions' endpointPressRef): nothing moves until the press
  // travels CLICK_DRAG_THRESHOLD, and a press that never does selects the drawing on release.
  const pressRef = useRef<{ id: string; startClientX: number; startClientY: number; moved: boolean } | null>(null);
  // Laquelle des poignées d'un canal est tenue (sans objet pour les autres dessins).
  const channelHandleRef = useRef<ChannelHandle>("line2Mid");
  // Single-handle drag for an axis-constrained line: sets its value directly from the pointer's
  // absolute position (like the two-endpoint drag elsewhere), but along one axis only — a
  // "horizontal" line's handle only ever changes y1/y2 (kept equal), a "vertical" line's handle
  // only ever changes x1/x2 (kept equal).
  function handleAxisHandlePointerDown(drawingId: string, channelHandle: ChannelHandle = "line2Mid") {
    return (e: React.PointerEvent<SVGCircleElement>) => {
      // Still stops propagation while locked — same reasoning as handleEndpointPointerDown.
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      pressRef.current = { id: drawingId, startClientX: e.clientX, startClientY: e.clientY, moved: false };
      channelHandleRef.current = channelHandle;
      // Locked — every drawing, or this one (its own padlock used to be ignored here): selectable, never dragged.
      if (drawingsLocked || drawings.find((d) => d.id === drawingId)?.locked) return;
      dragAxisRef.current = { id: drawingId };
    };
  }

  function handleAxisHandlePointerMove(e: React.PointerEvent<SVGCircleElement>) {
    const press = pressRef.current;
    if (press && !press.moved) {
      if (Math.hypot(e.clientX - press.startClientX, e.clientY - press.startClientY) < CLICK_DRAG_THRESHOLD) return;
      press.moved = true;
    }
    const drag = dragAxisRef.current;
    if (!drag) return;
    const dr = drawings.find((d) => d.id === drag.id);
    if (!dr) return;
    const rect = zoomRef.current!.getBoundingClientRect();
    if (dr.lineType === "horizontal") {
      const mouseY = e.clientY - rect.top;
      const pane = paneScaleAndOffset(dr.valueAxis);
      const value = round4(pane.scale.invert(mouseY - pane.offset));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, y1: value, y2: value } : d)));
    } else if (dr.lineType === "vertical") {
      const mouseX = e.clientX - rect.left;
      const dateValue = dateForIndex(zoomedXScale.invert(mouseX));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: dateValue, x2: dateValue } : d)));
    } else if (
      dr.lineType === "ray" ||
      (["arrowUp", "arrowDown", "pin", "flagMark", "text", "comment", "signpost", "priceLabel"].includes(dr.lineType ?? "") && !isOffsetPriceLabel(dr))
    ) {
      // Both a ray's anchor and every single-point marker above have both degrees of freedom,
      // unlike horizontal/vertical's single axis — none of them are ever one of the pane-aware
      // lineTypes, so paneScaleAndOffset always resolves to price same as before.
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const dateValue = dateForIndex(zoomedXScale.invert(mouseX));
      const pane = paneScaleAndOffset(dr.valueAxis);
      const value = round4(pane.scale.invert(mouseY - pane.offset));
      commitDrawings(drawings.map((d) => (d.id === drag.id ? { ...d, x1: dateValue, x2: dateValue, y1: value, y2: value } : d)));
    } else if (dr.lineType === "channel" || dr.lineType === "disjointChannel") {
      const next = draggedChannel(dr, channelHandleRef.current, e, e.clientY - rect.top);
      if (next) commitDrawings(drawings.map((d) => (d.id === drag.id ? next : d)));
    }
  }

  /** Prix visé par le milieu d'une ligne de canal : le pointeur à la verticale, aimanté sur la bougie
   *  sous le milieu (le milieu ne quitte jamais sa date : le glisser est purement vertical). */
  function midPriceAt(xa: Date, xb: Date, mouseY: number): number {
    const rawY = zoomedPriceScale.invert(mouseY);
    if (!magnetSnapPrice || !indexForDate) return rawY;
    return magnetSnapPrice((indexForDate(xa) + indexForDate(xb)) / 2 + 0.5, rawY);
  }

  /** Le canal après le glisser d'une de ses poignées propres (voir ChannelHandle). */
  function draggedChannel(dr: TrendLineDrawing, handle: ChannelHandle, e: React.PointerEvent, mouseY: number): TrendLineDrawing | null {
    const offset = dr.channelOffset ?? 0;
    if (handle === "line1Mid") {
      // La ligne 1 monte ou descend en bloc ; la ligne 2 reste où elle est (le décalage compense pour "channel").
      const delta = midPriceAt(dr.x1, dr.x2, mouseY) - (dr.y1 + dr.y2) / 2;
      const moved = { ...dr, y1: round4(dr.y1 + delta), y2: round4(dr.y2 + delta) };
      return dr.lineType === "channel" ? { ...moved, channelOffset: round4(offset - delta) } : moved;
    }
    if (dr.lineType === "disjointChannel") {
      // Ligne 2 du canal disjoint : ses deux points libres (point 3 à la date de x2, point 4 à celle de x1),
      // montés ou descendus ensemble. Ses coins ont déjà leurs poignées (points enregistrés).
      const [p3, p4] = dr.extraPoints ?? [];
      if (handle !== "line2Mid" || !p3 || !p4) return null;
      const delta = midPriceAt(p3.x, p4.x, mouseY) - (p3.y + p4.y) / 2;
      return { ...dr, extraPoints: [{ ...p3, y: round4(p3.y + delta) }, { ...p4, y: round4(p4.y + delta) }, ...(dr.extraPoints ?? []).slice(2)] };
    }
    if (handle === "line2Mid") {
      // Recomputes the offset so line 2 passes through the new mouseY at the handle's own X (its
      // line 2 midpoint) — the midpoint's line-1 price simplifies to a plain average of y1/y2.
      return { ...dr, channelOffset: round4(midPriceAt(dr.x1, dr.x2, mouseY) - (dr.y1 + dr.y2) / 2) };
    }
    if (!toDataPoint) return null;
    // Coin de la ligne 2 : il suit le pointeur, et le coin de la ligne 1 à la même extrémité le suit
    // (décalage inchangé : la largeur du canal est conservée, la ligne 2 reste parallèle).
    // Maj : angle bloqué depuis l'autre coin de la ligne 2, comme pour un point de la ligne 1.
    if (handle === "line2Start") {
      const p = toDataPoint(e, { x: dr.x2, y: dr.y2 + offset });
      return { ...dr, x1: p.x, y1: round4(p.y - offset) };
    }
    const p = toDataPoint(e, { x: dr.x1, y: dr.y1 + offset });
    return { ...dr, x2: p.x, y2: round4(p.y - offset) };
  }

  function handleAxisHandlePointerUp(e: React.PointerEvent<SVGCircleElement>) {
    const press = pressRef.current;
    pressRef.current = null;
    dragAxisRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (press && !press.moved) {
      setSelectedDrawingId(press.id);
      setSelectedIndicatorId(null);
    }
  }

  return { handleAxisHandlePointerDown, handleAxisHandlePointerMove, handleAxisHandlePointerUp };
}
