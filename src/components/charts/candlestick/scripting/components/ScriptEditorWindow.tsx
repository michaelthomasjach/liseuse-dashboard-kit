import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CloseIcon, MaximizeIcon, MinimizeIcon } from "../../../../icons";
import { LqThemeProvider, useLqTheme } from "../../../../../theme";
import "./ScriptEditorWindow.css";

export interface ScriptEditorWindowProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const MIN_WIDTH = 520;
const MIN_HEIGHT = 400;
const DEFAULT_WIDTH = 960;
const DEFAULT_HEIGHT = 680;

function initialRect(): Rect {
  const width = Math.min(DEFAULT_WIDTH, window.innerWidth - 40);
  const height = Math.min(DEFAULT_HEIGHT, window.innerHeight - 40);
  return { x: Math.max(0, (window.innerWidth - width) / 2), y: Math.max(0, (window.innerHeight - height) / 2), width, height };
}

type ResizeEdges = { top?: boolean; bottom?: boolean; left?: boolean; right?: boolean };
type DragMode = "move" | ResizeEdges;

/** A real floating window — draggable by its own header, resizable from any edge/corner, and
 *  toggleable to fullscreen ("maximize"), the way a native OS window works, rather than
 *  `Modal.tsx`'s own fixed-size/centered-only presets. Purpose-built for the script editor rather
 *  than added as a new mode on `Modal.tsx` itself: every *other* Modal consumer in this library
 *  wants a blocking, centered dialog, and resize/maximize is real, fiddly logic that has no
 *  business landing on that shared primitive for a need only this one caller has. Deliberately
 *  *not* a blocking dialog either — no backdrop, no click-outside-to-close — so the chart
 *  underneath stays fully visible and interactive while the editor is open (the whole point of
 *  this being a floating window instead of a fullscreen takeover: running a script should show its
 *  result on the live chart right away, not after closing the editor first). Portaled straight to
 *  `document.body`, same stacking-context escape `Modal.tsx`/`Popover.tsx` already use and for the
 *  same reason (see either of their own docs). */
export function ScriptEditorWindow({ open, onClose, title, toolbar, children }: ScriptEditorWindowProps) {
  const theme = useLqTheme();
  const [rect, setRect] = useState<Rect>(initialRect);
  const [maximized, setMaximized] = useState(false);
  const preMaximizeRectRef = useRef<Rect | null>(null);
  const dragRef = useRef<{ startClientX: number; startClientY: number; startRect: Rect; mode: DragMode } | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // One handler for both the header's own drag-to-move and every resize handle's own drag-to-
  // resize — `mode` is either "move" (translate x/y only) or which edges a given handle owns
  // (e.g. the NW corner handle passes `{top:true, left:true}`), so growing/shrinking from the top
  // or left edges also has to shift x/y by however much width/height actually changed, or the
  // *opposite* edge would visibly drift instead of staying put — the same math a native OS window
  // manager does for the same reason.
  function startDrag(e: ReactPointerEvent, mode: DragMode) {
    if (e.button !== 0 || maximized) return;
    e.preventDefault();
    dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startRect: rect, mode };
    function onMove(ev: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = ev.clientX - drag.startClientX;
      const dy = ev.clientY - drag.startClientY;
      if (drag.mode === "move") {
        setRect({ ...drag.startRect, x: drag.startRect.x + dx, y: drag.startRect.y + dy });
        return;
      }
      let { x, y, width, height } = drag.startRect;
      if (drag.mode.right) width = Math.max(MIN_WIDTH, drag.startRect.width + dx);
      if (drag.mode.bottom) height = Math.max(MIN_HEIGHT, drag.startRect.height + dy);
      if (drag.mode.left) {
        width = Math.max(MIN_WIDTH, drag.startRect.width - dx);
        x = drag.startRect.x + (drag.startRect.width - width);
      }
      if (drag.mode.top) {
        height = Math.max(MIN_HEIGHT, drag.startRect.height - dy);
        y = drag.startRect.y + (drag.startRect.height - height);
      }
      setRect({ x, y, width, height });
    }
    function onUp() {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function toggleMaximize() {
    if (maximized) {
      setMaximized(false);
      if (preMaximizeRectRef.current) setRect(preMaximizeRectRef.current);
    } else {
      preMaximizeRectRef.current = rect;
      setMaximized(true);
    }
  }

  if (!open) return null;

  return createPortal(
    <LqThemeProvider palette={theme.palette} surface={theme.surface} font={theme.font} style={{ display: "contents" }}>
      <div
        className={["lq-script-window", maximized && "lq-script-window--maximized"].filter(Boolean).join(" ")}
        style={maximized ? undefined : { left: rect.x, top: rect.y, width: rect.width, height: rect.height }}
        role="dialog"
        aria-label={typeof title === "string" ? title : undefined}
      >
        <div className="lq-script-window__header" onPointerDown={(e) => startDrag(e, "move")} onDoubleClick={toggleMaximize}>
          <span className="lq-script-window__title">{title}</span>
          <div className="lq-script-window__header-actions">
            <button
              type="button"
              className="lq-script-window__header-button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={toggleMaximize}
              aria-label={maximized ? "Restaurer" : "Agrandir"}
              title={maximized ? "Restaurer" : "Agrandir"}
            >
              {maximized ? <MinimizeIcon size={14} /> : <MaximizeIcon size={14} />}
            </button>
            <button
              type="button"
              className="lq-script-window__header-button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={onClose}
              aria-label="Fermer"
            >
              <CloseIcon size={14} />
            </button>
          </div>
        </div>
        {toolbar}
        <div className="lq-script-window__body">{children}</div>
        {!maximized && (
          <>
            <div className="lq-script-window__resize lq-script-window__resize--n" onPointerDown={(e) => startDrag(e, { top: true })} />
            <div className="lq-script-window__resize lq-script-window__resize--s" onPointerDown={(e) => startDrag(e, { bottom: true })} />
            <div className="lq-script-window__resize lq-script-window__resize--e" onPointerDown={(e) => startDrag(e, { right: true })} />
            <div className="lq-script-window__resize lq-script-window__resize--w" onPointerDown={(e) => startDrag(e, { left: true })} />
            <div className="lq-script-window__resize lq-script-window__resize--ne" onPointerDown={(e) => startDrag(e, { top: true, right: true })} />
            <div className="lq-script-window__resize lq-script-window__resize--nw" onPointerDown={(e) => startDrag(e, { top: true, left: true })} />
            <div className="lq-script-window__resize lq-script-window__resize--se" onPointerDown={(e) => startDrag(e, { bottom: true, right: true })} />
            <div className="lq-script-window__resize lq-script-window__resize--sw" onPointerDown={(e) => startDrag(e, { bottom: true, left: true })} />
          </>
        )}
      </div>
    </LqThemeProvider>,
    document.body
  );
}
