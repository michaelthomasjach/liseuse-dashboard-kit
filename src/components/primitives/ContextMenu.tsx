import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { LqThemeProvider } from "../../theme";
import { useLqThemeOptional } from "../../theme/ThemeProvider";
import "./ContextMenu.css";

/** One row. A separator is `{ separator: true }`; everything else is a command. */
export type ContextMenuItem =
  | { separator: true }
  | {
      separator?: false;
      /** Stable key, and the accessible name. */
      label: string;
      onSelect: () => void;
      /** Greyed and unclickable, so the menu keeps the same shape from one right-click to the next. */
      disabled?: boolean;
      /** Small icon before the label. */
      icon?: ReactNode;
      /** Right-aligned hint: a keyboard shortcut, or what the command will act on. */
      hint?: string;
    };

export interface ContextMenuProps {
  /** Where the right-click happened, in viewport coordinates (`event.clientX` / `event.clientY`). */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** Accessible name of the menu. */
  ariaLabel?: string;
}

/**
 * Generic right-click menu, replacing the browser's — open it from an element's `onContextMenu` (after
 * `preventDefault()`). Rendered in a portal in `position: fixed`, so no `overflow: hidden` clips it; flipped (not
 * clamped) when it would overrun the viewport, like a native menu. Closes on Escape, on a click outside and after a
 * command. Same look as the candlestick chart's own menu.
 */
export function ContextMenu({ x, y, items, onClose, ariaLabel = "Menu contextuel" }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const theme = useLqThemeOptional();
  const [pos, setPos] = useState({ left: x, top: y });

  // Measured after mount, before paint: the menu's size depends on its longest label.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      left: x + width > window.innerWidth ? Math.max(0, x - width) : x,
      top: y + height > window.innerHeight ? Math.max(0, y - height) : y,
    });
    el.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus({ preventScroll: true });
  }, [x, y]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const buttons = [...(ref.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
        if (!buttons.length) return;
        e.preventDefault();
        const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = e.key === "ArrowDown" ? (i + 1) % buttons.length : (i - 1 + buttons.length) % buttons.length;
        buttons[next]?.focus();
      }
    }
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;
  const menu = (
    <div
      ref={ref}
      className="lq-context-menu"
      style={{ left: pos.left, top: pos.top }}
      role="menu"
      aria-label={ariaLabel}
      // Right-clicking the menu itself must not summon the browser's own on top of it.
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="lq-context-menu__separator" role="separator" />
        ) : (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className="lq-context-menu__item"
            disabled={item.disabled}
            onClick={() => {
              item.onSelect();
              onClose();
            }}
          >
            {item.icon !== undefined && <span className="lq-context-menu__icon">{item.icon}</span>}
            <span className="lq-context-menu__label">{item.label}</span>
            {item.hint !== undefined && <span className="lq-context-menu__hint">{item.hint}</span>}
          </button>
        ),
      )}
    </div>
  );
  return createPortal(
    theme ? (
      <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
        {menu}
      </LqThemeProvider>
    ) : (
      menu
    ),
    document.body,
  );
}
