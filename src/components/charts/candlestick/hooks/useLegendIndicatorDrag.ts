import { useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

/** Distance (px) à parcourir avant qu'un appui devienne un glisser : en dessous, un clic reste un clic. Même seuil que
 *  le glisser des symboles de la liste de surveillance (useWatchlistRowDrag). */
const DRAG_THRESHOLD = 4;

/**
 * Glisser-déposer des lignes d'indicateurs de la légende des prix (ChartLegend), sur le modèle des symboles de la liste
 * de surveillance : la ligne saisie suit le pointeur verticalement, un trait montre où elle tombera (au-dessus de la
 * première ligne dont le milieu est encore sous le pointeur, sinon après la dernière), et rien ne change avant le
 * relâchement — `onReorder` reçoit alors le nouvel ordre des lignes déplaçables.
 *
 * `order` : les ids des lignes déplaçables, de haut en bas. Une ligne se repère dans le DOM par son attribut
 * `data-legend-indicator-id`, cherché dans le parent de la ligne saisie (la liste).
 */
export function useLegendIndicatorDrag(order: string[], onReorder: ((orderedIds: string[]) => void) | undefined) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [offsetY, setOffsetY] = useState(0);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const orderRef = useRef(order);
  orderRef.current = order;
  // Un glisser se termine par un « click » sur la ligne : avalé, pour ne pas sélectionner l'indicateur en plus.
  const suppressClickRef = useRef(false);

  function start(id: string, e: ReactPointerEvent<HTMLElement>) {
    if (!onReorder || e.button !== 0 || orderRef.current.length < 2 || !orderRef.current.includes(id)) return;
    // Les boutons de la ligne (œil, aide, corbeille, « … ») gardent leur clic.
    if ((e.target as HTMLElement).closest("button, input, a")) return;
    const list = e.currentTarget.parentElement;
    const startX = e.clientX;
    const startY = e.clientY;
    let dragging = false;
    let index: number | null = null;

    function computeIndex(ev: PointerEvent): number {
      const rows = Array.from(list?.querySelectorAll<HTMLElement>("[data-legend-indicator-id]") ?? []).filter(
        (el) => el.dataset.legendIndicatorId !== id && orderRef.current.includes(el.dataset.legendIndicatorId ?? ""),
      );
      for (let i = 0; i < rows.length; i++) {
        const rect = rows[i]!.getBoundingClientRect();
        if (ev.clientY < rect.top + rect.height / 2) return i;
      }
      return rows.length;
    }
    function onMove(ev: PointerEvent) {
      if (!dragging) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < DRAG_THRESHOLD) return;
        dragging = true;
        setDraggingId(id);
      }
      ev.preventDefault();
      setOffsetY(ev.clientY - startY);
      index = computeIndex(ev);
      setDropIndex(index);
    }
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (dragging) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
        if (index !== null) {
          const next = orderRef.current.filter((x) => x !== id);
          next.splice(index, 0, id);
          if (next.join("|") !== orderRef.current.join("|")) onReorder?.(next);
        }
      }
      setDraggingId(null);
      setOffsetY(0);
      setDropIndex(null);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  // Où tracer le trait : au-dessus de la ligne qui suivra la ligne déposée, ou sous la dernière.
  const others = draggingId ? order.filter((x) => x !== draggingId) : order;
  const dropBeforeId = dropIndex !== null && dropIndex < others.length ? others[dropIndex]! : null;
  const dropAfterId = dropIndex !== null && dropIndex === others.length && others.length > 0 ? others[others.length - 1]! : null;

  return { draggingId, offsetY, dropBeforeId, dropAfterId, start, suppressClickRef, enabled: Boolean(onReorder) && order.length > 1 };
}
