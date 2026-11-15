import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/** Bord du graphique auquel la barre flottante est accrochée (null : elle flotte librement). */
export type FloatingToolbarDock = "top" | "bottom" | "left" | "right";

export interface UseFloatingToolbarPositionArgs {
  /** Whenever this changes (and isn't null), position resets to the default — a newly-picked
   *  tool or a newly-selected drawing reappears near its own default spot instead of inheriting
   *  wherever an earlier target happened to be dragged to. Pass a stable string identifying the
   *  toolbar's current target (e.g. `tool:${activeTool}` or `drawing:${selectedDrawingId}`), or
   *  `null` while the toolbar itself is hidden. Une barre accrochée à un bord y reste. */
  resetKey: string | null;
  plotWidth: number;
  /** Marges du tracé dans le parent positionné de la barre : la barre s'accroche aux bords du
   *  tracé (pas sur la colonne d'outils à gauche, l'axe des prix à droite ou l'axe des dates en bas). */
  plotLeft?: number;
  plotBottom?: number;
}

const DEFAULT_TOP = 12;
/** Distance (px) entre le pointeur et un bord du graphique sous laquelle la barre s'y aimante. */
const SNAP_ZONE = 40;
/** Écart (px) laissé entre la barre accrochée et le bord. */
const DOCK_INSET = 4;

/** Drag position for `FloatingDrawingToolbar` — same window-pointermove-listener pattern
 *  `useSidePanel.startResize`/`usePaneLayout.startPaneResize` already use (not
 *  `setPointerCapture`, so the drag keeps tracking even once the pointer leaves the grip's own
 *  small hit area), generalized from one axis to two (x and y both move here, not just width).
 *
 *  Aimantation : amenée près d'un bord (le pointeur à moins de `SNAP_ZONE` px), la barre s'y
 *  accroche. En haut et en bas elle reste horizontale et ne glisse plus que le long du bord ; à
 *  gauche et à droite elle passe à la verticale. On la décroche en l'éloignant du bord. */
export function useFloatingToolbarPosition({ resetKey, plotWidth, plotLeft = 0, plotBottom = 0 }: UseFloatingToolbarPositionArgs) {
  const plotRight = plotLeft + plotWidth;
  const [position, setPosition] = useState({ x: plotWidth / 2, y: DEFAULT_TOP });
  const [dock, setDock] = useState<FloatingToolbarDock | null>(null);
  const dockRef = useRef<FloatingToolbarDock | null>(null);
  dockRef.current = dock;
  const toolbarRef = useRef<HTMLDivElement>(null);
  // Dernières tailles mesurées de la barre dans chaque orientation : au moment où elle change
  // d'orientation en plein glisser, la nouvelle n'est pas encore dessinée.
  const horizontalSize = useRef({ w: 0, h: 0 });
  const verticalSize = useRef({ w: 0, h: 0 });

  useEffect(() => {
    if (resetKey === null || dockRef.current !== null) return;
    setPosition({ x: plotWidth / 2, y: DEFAULT_TOP });
    // Deliberately keyed only on identity (resetKey), not plotWidth — re-centering every time the
    // plot itself merely resizes would fight a drag the user just made on an unrelated width
    // change (e.g. opening the docked side panel while a drawing stays selected).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // D'après l'orientation réellement dessinée (le rendu peut avoir un temps de retard sur l'état).
  function measure() {
    const el = toolbarRef.current;
    const rect = el?.getBoundingClientRect();
    if (!el || !rect || rect.width === 0) return;
    const size = { w: rect.width, h: rect.height };
    if (el.classList.contains("lq-chart__floating-toolbar--vertical")) verticalSize.current = size;
    else horizontalSize.current = size;
  }

  // Juste après un changement d'orientation (la nouvelle taille n'était pas connue pendant le
  // glisser) : la barre est ramenée dans le tracé si elle en dépasse.
  useLayoutEffect(() => {
    const el = toolbarRef.current;
    const parent = el?.parentElement;
    if (!el || !parent || dock === null) return;
    measure();
    const rect = el.getBoundingClientRect();
    const parentHeight = parent.getBoundingClientRect().height;
    if (dock === "left" || dock === "right") {
      const maxY = Math.max(DOCK_INSET, parentHeight - plotBottom - rect.height - DOCK_INSET);
      setPosition((p) => (p.y > maxY ? { x: p.x, y: maxY } : p));
    } else {
      const maxX = Math.max(plotLeft + DOCK_INSET, plotRight - rect.width - DOCK_INSET);
      setPosition((p) => (p.x > maxX ? { x: maxX, y: p.y } : p));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dock]);

  function startDrag(e: React.PointerEvent) {
    // Pris par le fond de la barre (pas par un de ses boutons ou champs) : même glisser que par la poignée.
    if (e.target instanceof Element && e.target !== e.currentTarget && e.target.closest("button, input, select, textarea, [role=menu]") && !e.target.closest(".lq-chart__floating-toolbar-grip")) return;
    e.preventDefault();
    e.stopPropagation();
    const el = toolbarRef.current;
    const parentRect = el?.parentElement?.getBoundingClientRect();
    const rect = el?.getBoundingClientRect();
    if (!el || !parentRect || !rect) return;
    let current = dockRef.current;
    measure();
    // Point de départ : là où la barre est réellement dessinée, quel que soit le bord qui la tient.
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = rect.left - parentRect.left;
    const startY = rect.top - parentRect.top;
    // Bas : celui du graphique (le parent positionné de la barre), pour qu'elle ne se perde pas sous la page.
    const plotHeight = parentRect.height;
    const pointerId = e.pointerId;
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(min, max), Math.max(min, v));
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      measure();
      const rawX = startX + (ev.clientX - startClientX);
      const rawY = startY + (ev.clientY - startClientY);
      // Bord le plus proche du pointeur, s'il est dans la zone d'aimantation.
      const px = ev.clientX - parentRect.left;
      const py = ev.clientY - parentRect.top;
      const distances: [FloatingToolbarDock, number][] = [
        ["left", px - plotLeft],
        ["right", plotRight - px],
        ["top", py],
        ["bottom", plotHeight - plotBottom - py],
      ];
      const nearest = distances.filter(([, d]) => d <= SNAP_ZONE).sort((a, b) => a[1] - b[1])[0];
      const next = nearest ? nearest[0] : null;
      const h = horizontalSize.current;
      const v = verticalSize.current;
      if (next === "left" || next === "right") {
        setPosition((p) => ({ x: p.x, y: clamp(rawY, DOCK_INSET, plotHeight - plotBottom - v.h - DOCK_INSET) }));
      } else if (next === "top" || next === "bottom") {
        setPosition((p) => ({ x: clamp(rawX, plotLeft + DOCK_INSET, plotRight - h.w - DOCK_INSET), y: p.y }));
      } else {
        // Barre plus large que le graphique (téléphone) : elle peut quand même glisser, jusqu'à garder sa poignée visible.
        const maxX = Math.max(0, plotRight - h.w);
        const minX = Math.min(0, plotRight - h.w);
        setPosition({ x: Math.min(maxX, Math.max(minX, rawX)), y: clamp(rawY, 0, plotHeight - h.h) });
      }
      if (next !== current) {
        current = next;
        setDock(next);
      }
    };
    const onUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    // Geste repris par le navigateur (défilement au doigt) : le glisser s'arrête proprement au lieu de rester accroché.
    window.addEventListener("pointercancel", onUp);
  }

  // Bords droit et bas tenus par la droite et le bas de la barre : ils suivent la largeur du
  // graphique et la taille de la barre sans avoir à la mesurer.
  const style: CSSProperties =
    dock === "top" ? { left: position.x, top: DOCK_INSET }
    : dock === "bottom" ? { left: position.x, bottom: plotBottom + DOCK_INSET }
    : dock === "left" ? { left: plotLeft + DOCK_INSET, top: position.y }
    : dock === "right" ? { left: plotRight - DOCK_INSET, top: position.y, transform: "translateX(-100%)" }
    : { left: position.x, top: position.y };
  const orientation: "horizontal" | "vertical" = dock === "left" || dock === "right" ? "vertical" : "horizontal";

  return { position, dock, orientation, style, toolbarRef, startDrag };
}
