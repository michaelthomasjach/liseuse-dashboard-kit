import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { CloseIcon } from "../icons";
import "./Modal.css";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  /** Defaults to a full-width "Fermer" button; pass null to omit, or your own footer. */
  footer?: ReactNode | null;
  closeLabel?: string;
  /** `"default"` is the small centered dialog; `"wide"` is a fixed, roomier size (not viewport-
   *  relative like fullscreen) for content with its own internal layout that needs stable side-by-
   *  side space — a filter sidebar next to a list, say — rather than reflowing at every viewport
   *  size; `"fullscreen"` takes up nearly the whole viewport (a thin margin all round) — for a
   *  detail view or editor that needs real room instead of a small popup. Default "default". */
  size?: "default" | "wide" | "fullscreen";
}

/** Centered dialog used for a row's detail view (e.g. the light color/temperature picker).
 *  Use `size="fullscreen"` for content that needs the whole screen instead. Draggable by its own
 *  header (when `title` is set) — starts centered every time it opens (this offset is plain
 *  `useState`, which resets on its own the moment `open` goes false and the component unmounts
 *  below), drag only moves it for the rest of that same open/close cycle. */
export function Modal({ open, onClose, title, children, footer, closeLabel = "Fermer", size = "default" }: ModalProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startClientX: number; startClientY: number; startOffsetX: number; startOffsetY: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Window-level listeners (not setPointerCapture on the header) since the header's own DOM node
  // never moves under the cursor the way a reordered list item can — but a plain window pair is
  // just as simple here and matches this library's own convention for every other pointer-drag
  // (see usePaneDragReorder/RangeSlider) rather than mixing patterns for no reason.
  function onHeaderPointerDown(e: ReactPointerEvent<HTMLElement>) {
    // Left button (or primary touch contact) only — a right/middle-click on the header shouldn't
    // start a drag.
    if (e.button !== 0) return;
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startOffsetX: offset.x, startOffsetY: offset.y };
    function onMove(ev: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      setOffset({ x: drag.startOffsetX + (ev.clientX - drag.startClientX), y: drag.startOffsetY + (ev.clientY - drag.startClientY) });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  if (!open) return null;

  const resolvedFooter =
    footer === undefined ? (
      <button type="button" className="lq-modal__close-button" onClick={onClose}>
        {closeLabel}
      </button>
    ) : (
      footer
    );

  return (
    <div className="lq-modal__overlay" onClick={onClose}>
      <div
        className={["lq-modal", size === "wide" && "lq-modal--wide", size === "fullscreen" && "lq-modal--fullscreen"].filter(Boolean).join(" ")}
        style={offset.x || offset.y ? { transform: `translate(${offset.x}px, ${offset.y}px)` } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Padding lives here, not on .lq-modal itself: .lq-modal is the element with
            overflow-y:auto, and a scrollbar on a *padded* box eats into that side's padding
            instead of sitting outside it — the left padding stayed full while the right one
            visually vanished under the scrollbar. Keeping .lq-modal unpadded means the
            scrollbar renders flush with its border, outside this wrapper's box entirely, so
            the padding here stays symmetric whether or not a scrollbar is showing. */}
        <div className="lq-modal__inner">
          {title && (
            <header className="lq-modal__header lq-modal__header--draggable" onPointerDown={onHeaderPointerDown}>
              <h2 className="lq-modal__title">{title}</h2>
              {/* Own pointerdown never reaches the header's drag handler above — otherwise a
                  plain click here would first arm a (zero-distance, harmless) drag before the
                  click itself closes the modal, which is pointless overhead for what should be
                  the single most direct way to back out without saving. */}
              <button
                type="button"
                className="lq-modal__close-icon"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onClose}
                aria-label="Fermer"
              >
                <CloseIcon size={16} />
              </button>
            </header>
          )}
          <div className="lq-modal__body">{children}</div>
          {resolvedFooter && <footer className="lq-modal__footer">{resolvedFooter}</footer>}
        </div>
      </div>
    </div>
  );
}
