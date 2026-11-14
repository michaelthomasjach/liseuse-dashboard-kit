import { useEffect, useRef, useState } from "react";

export interface UseFloatingToolbarPositionArgs {
  /** Whenever this changes (and isn't null), position resets to the default — a newly-picked
   *  tool or a newly-selected drawing reappears near its own default spot instead of inheriting
   *  wherever an earlier target happened to be dragged to. Pass a stable string identifying the
   *  toolbar's current target (e.g. `tool:${activeTool}` or `drawing:${selectedDrawingId}`), or
   *  `null` while the toolbar itself is hidden. */
  resetKey: string | null;
  plotWidth: number;
}

const DEFAULT_TOP = 12;

/** Drag position for `FloatingDrawingToolbar` — same window-pointermove-listener pattern
 *  `useSidePanel.startResize`/`usePaneLayout.startPaneResize` already use (not
 *  `setPointerCapture`, so the drag keeps tracking even once the pointer leaves the grip's own
 *  small hit area), generalized from one axis to two (x and y both move here, not just width). */
export function useFloatingToolbarPosition({ resetKey, plotWidth }: UseFloatingToolbarPositionArgs) {
  const [position, setPosition] = useState({ x: plotWidth / 2, y: DEFAULT_TOP });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (resetKey === null) return;
    setPosition({ x: plotWidth / 2, y: DEFAULT_TOP });
    // Deliberately keyed only on identity (resetKey), not plotWidth — re-centering every time the
    // plot itself merely resizes would fight a drag the user just made on an unrelated width
    // change (e.g. opening the docked side panel while a drawing stays selected).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  function startDrag(e: React.PointerEvent) {
    // Pris par le fond de la barre (pas par un de ses boutons ou champs) : même glisser que par la poignée.
    if (e.target instanceof Element && e.target !== e.currentTarget && e.target.closest("button, input, select, textarea, [role=menu]") && !e.target.closest(".lq-chart__floating-toolbar-grip")) return;
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startX = position.x;
    const startY = position.y;
    // Only x is bounded on both sides (the plot has a finite width to stay within); y only has a
    // floor (0 — flush with the plot's own top) since there's no equivalently fixed bottom edge
    // meant to constrain it here (own-pane indicators/volume already extend the plot well past
    // just the price section).
    const rect = toolbarRef.current?.getBoundingClientRect();
    const toolbarWidth = rect?.width ?? 0;
    const toolbarHeight = rect?.height ?? 0;
    // Bas : celui du graphique (le parent positionné de la barre), pour qu'elle ne se perde pas sous la page.
    const plotHeight = toolbarRef.current?.parentElement?.getBoundingClientRect().height ?? Infinity;
    const pointerId = e.pointerId;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      // Barre plus large que le graphique (téléphone) : elle peut quand même glisser, jusqu'à garder sa poignée visible.
      const maxX = Math.max(0, plotWidth - toolbarWidth);
      const minX = Math.min(0, plotWidth - toolbarWidth);
      const nextX = Math.min(maxX, Math.max(minX, startX + (ev.clientX - startClientX)));
      const nextY = Math.min(Math.max(0, plotHeight - toolbarHeight), Math.max(0, startY + (ev.clientY - startClientY)));
      setPosition({ x: nextX, y: nextY });
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

  return { position, toolbarRef, startDrag };
}
