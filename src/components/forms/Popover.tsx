import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { usePopoverPosition, type PopoverPlacement } from "./internal/usePopoverPosition";
import { LqThemeProvider, useLqTheme } from "../../theme";
import "./Popover.css";

export interface PopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  /** Preferred side; flips to the other side (and shifts horizontally) when there isn't room. */
  placement?: PopoverPlacement;
  /** Match the panel's width to the anchor's width (typical for a Select). */
  matchAnchorWidth?: boolean;
  /** Re-measure whenever this changes — for an anchor that moves without the page scrolling or
   *  resizing, such as an element on a canvas being panned, zoomed or dragged. See
   *  `usePopoverPosition`. */
  trackKey?: string | number;
  children: ReactNode;
  className?: string;
}

/**
 * Low-level anchored floating panel: portals to `document.body`, positions
 * itself with collision detection (see `usePopoverPosition`), and closes on
 * outside click / Escape. Powers `Select`, `DatePicker`, and any menu-style
 * dropdown built on top of this library.
 */
export function Popover({ open, onClose, anchorRef, placement = "bottom", matchAnchorWidth, trackKey, children, className }: PopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const position = usePopoverPosition(anchorRef, panelRef, open, placement, trackKey);
  const theme = useLqTheme();

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const width = matchAnchorWidth ? anchorRef.current?.getBoundingClientRect().width : undefined;

  return createPortal(
    <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
      <div
        ref={panelRef}
        className={["lq-popover", className].filter(Boolean).join(" ")}
        style={{
          top: position.top,
          left: position.left,
          width,
          visibility: position.ready ? "visible" : "hidden",
        }}
        data-placement={position.placement}
      >
        {children}
      </div>
    </LqThemeProvider>,
    document.body
  );
}
