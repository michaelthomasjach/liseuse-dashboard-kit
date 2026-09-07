import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./ChartContextMenu.css";

/** One row. A separator is `{ separator: true }`; everything else is a command. */
export type ChartContextMenuItem =
  | { separator: true }
  | {
      separator?: false;
      /** Stable key, and the accessible name. */
      label: string;
      onSelect: () => void;
      /** Greyed and unclickable — used for a command whose target is not there (no cursor price
       *  to add a line at, say) rather than hiding it, so the menu keeps the same shape and the
       *  same muscle memory from one right-click to the next. */
      disabled?: boolean;
      /** Right-aligned hint: a keyboard shortcut, or what the command will act on. */
      hint?: string;
    };

export interface ChartContextMenuProps {
  /** Where the click happened, relative to the chart's own positioned root. */
  x: number;
  y: number;
  /** The box the menu must stay inside — the chart's own, so a menu opened near an edge folds back
   *  over the chart instead of being clipped by its `overflow: hidden`. */
  bounds: { width: number; height: number };
  items: ChartContextMenuItem[];
  onClose: () => void;
}

/** The chart's own right-click menu, replacing the browser's.
 *
 *  Flipped rather than clamped when it would overrun an edge: a menu pinned to the bottom of the
 *  chart with its first item off-screen is worse than one that opens upward, which is what every
 *  native menu does and what the hand already expects. */
export function ChartContextMenu({ x, y, bounds, items, onClose }: ChartContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Measured after mount, before paint: the menu's own size depends on its longest label, which
  // nothing here can know ahead of time.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: x + width > bounds.width ? Math.max(0, x - width) : x,
      top: y + height > bounds.height ? Math.max(0, y - height) : y,
    });
  }, [x, y, bounds.width, bounds.height]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    // `pointerdown` rather than `click`: a menu that is still up while the next gesture has already
    // started reads as unresponsive, and this also catches a drag beginning outside it.
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    // A second right-click elsewhere should move the menu, not leave two behaviours fighting.
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="lq-chart__context-menu"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      // Right-clicking the menu itself must not summon the browser's own on top of it.
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="lq-chart__context-menu-separator" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="lq-chart__context-menu-item"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            <span>{item.label}</span>
            {item.hint !== undefined && <span className="lq-chart__context-menu-hint">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
}
